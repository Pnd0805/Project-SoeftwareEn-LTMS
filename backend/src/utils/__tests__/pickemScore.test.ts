import { describe, it, expect } from 'vitest';
import { pickemScoreFor } from '../pickemScore.js';
import { PICKEM_TIER_POINTS } from '../../config/scoring.js';

/**
 * OD-56 ก้าวที่ 2 (4 ต.ค. 2569) — แต้ม Pick'em 3 ชั้น
 *
 * ★ เทสชุดนี้เขียนด้วยกีฬาจริงทั้ง 5 ของระบบ ไม่ใช่ตัวเลขลอย ๆ
 *   เพราะประเด็นทั้งหมดของ `tolerance` คือ "สูตรเดียวต้องยุติธรรมข้ามกีฬาที่นับคนละหน่วย"
 *   ถ้าเทสด้วยเลขสมมติ จะไม่จับได้ว่าชั้นกลางไปทำอะไรกับกีฬาที่นับเป็นเกม
 */

const A = 10, B = 11;          // รหัสทีมสองฝั่ง
const sc = (a: number, b: number) => ({ [String(A)]: a, [String(B)]: b });

// tolerance ตาม migration 039
const TOL = { badminton: 0, rov: 0, valorant: 0, football: 1, basketball: 5 };

describe('ด่านแรก — ทายฝั่งผิด = 0 เสมอ (มติข้อ ②)', () => {
  it('ทายผิดฝั่งแต่สกอร์กลับด้านเป๊ะ ก็ยังได้ 0', async () => {
    // ทาย A ชนะ 3-1 · จริง B ชนะ 3-1 (คือ 1-3 ในมุมของ A) — "ใกล้" ที่สุดที่จะใกล้ได้
    expect(pickemScoreFor(A, sc(3, 1), B, sc(1, 3), TOL.football))
      .toEqual({ points: 0, tier: 'wrong_side' });
  });

  it('ทายผิดฝั่งแต่สกอร์คลาดแค่ 1 ก็ยังได้ 0 แม้ tolerance จะกว้าง', () => {
    expect(pickemScoreFor(A, sc(2, 1), B, sc(2, 3), TOL.basketball).points).toBe(0);
  });

  /**
   * ★ ข้อนี้คือสิ่งที่ทำให้ `SUM(points_earned > 0) AS correct` ใน E28/E29 ยังพูดความจริง
   *   ถ้าเคสไหนที่ฝั่งผิดได้แต้ม > 0 หลุดมา ช่อง "ทายถูก" และ rank จะเพี้ยนทั้งตาราง
   */
  it('ไม่มีทางได้แต้ม > 0 เลยถ้าฝั่งผิด — ไล่ทุก tolerance ที่ระบบมี', () => {
    for (const tolerance of Object.values(TOL)) {
      for (const [pa, pb] of [[1, 0], [5, 0], [21, 19], [100, 98]]) {
        expect(pickemScoreFor(A, sc(pa!, pb!), B, sc(0, 1), tolerance).points).toBe(0);
      }
    }
  });
});

describe('ฟุตบอล — นับแต้มจริง (ประตู) · tolerance 1', () => {
  it('ทาย 2-1 ได้จริง 2-1 → exact', () => {
    expect(pickemScoreFor(A, sc(2, 1), A, sc(2, 1), TOL.football))
      .toEqual({ points: PICKEM_TIER_POINTS.exact, tier: 'exact' });
  });

  it('ทาย 2-1 ได้จริง 3-1 (คลาด 1) → close', () => {
    expect(pickemScoreFor(A, sc(2, 1), A, sc(3, 1), TOL.football))
      .toEqual({ points: PICKEM_TIER_POINTS.close, tier: 'close' });
  });

  it('ทาย 2-1 ได้จริง 2-0 (คลาด 1) → close', () => {
    expect(pickemScoreFor(A, sc(2, 1), A, sc(2, 0), TOL.football).tier).toBe('close');
  });

  // คลาดรวม = ผลรวมทั้งสองฝั่ง ⇒ 3-1 กับ 2-0 คลาดฝั่งละ 1 = รวม 2 เกิน tolerance
  it('ทาย 3-1 ได้จริง 2-0 (คลาดฝั่งละ 1 = รวม 2) → side_only', () => {
    expect(pickemScoreFor(A, sc(3, 1), A, sc(2, 0), TOL.football))
      .toEqual({ points: PICKEM_TIER_POINTS.side_only, tier: 'side_only' });
  });

  it('ทาย 1-0 ได้จริง 5-0 → side_only', () => {
    expect(pickemScoreFor(A, sc(1, 0), A, sc(5, 0), TOL.football).tier).toBe('side_only');
  });
});

describe('บาสเกตบอล — นับแต้มจริง ช่วง 50–120 · tolerance 5', () => {
  it('ทาย 98-95 ได้จริง 98-95 → exact (เกิดได้ยากมาก แต่ได้)', () => {
    expect(pickemScoreFor(A, sc(98, 95), A, sc(98, 95), TOL.basketball).tier).toBe('exact');
  });

  /**
   * ★ นี่คือเหตุผลที่คอลัมน์ tolerance ต้องมี — ถ้า tolerance เป็น 0 เหมือนกันหมด
   *   คนทายบาสจะได้แต่ชั้นพื้นตลอดชีวิต เพราะทายสองตัวเลขให้เป๊ะแทบเป็นไปไม่ได้
   */
  it('ทาย 95-90 ได้จริง 98-90 (คลาด 3) → close — ข้อที่ทำให้บาสมีสิทธิ์ได้โบนัสจริง', () => {
    expect(pickemScoreFor(A, sc(95, 90), A, sc(98, 90), TOL.basketball).tier).toBe('close');
  });

  it('คลาดรวมพอดี 5 → ยังเป็น close (ขอบในนับด้วย)', () => {
    expect(pickemScoreFor(A, sc(100, 90), A, sc(103, 92), TOL.basketball).tier).toBe('close');
  });

  it('คลาดรวม 6 → side_only (เกินขอบไป 1)', () => {
    expect(pickemScoreFor(A, sc(100, 90), A, sc(104, 92), TOL.basketball).tier).toBe('side_only');
  });

  it('ถ้า tolerance เป็น 0 เคสคลาด 3 จะร่วงไป side_only — พิสูจน์ว่า tolerance มีผลจริง', () => {
    expect(pickemScoreFor(A, sc(95, 90), A, sc(98, 90), 0).tier).toBe('side_only');
  });
});

describe('แบดมินตัน / RoV / VALORANT — นับเป็นเกมที่ชนะ · tolerance 0', () => {
  it('Bo3 ทาย 2-0 ได้จริง 2-0 → exact', () => {
    expect(pickemScoreFor(A, sc(2, 0), A, sc(2, 0), TOL.badminton).tier).toBe('exact');
  });

  it('Bo3 ทาย 2-0 ได้จริง 2-1 → side_only (ไม่ใช่ close เพราะ tolerance = 0)', () => {
    expect(pickemScoreFor(A, sc(2, 0), A, sc(2, 1), TOL.rov).tier).toBe('side_only');
  });

  /**
   * ★ สาระของการตั้ง tolerance = 0 ในกีฬาที่นับเป็นเกม
   *   Bo3 ผู้ชนะต้องได้ 2 เกม ⇒ สกอร์ที่เป็นไปได้มีแค่ 2-0 กับ 2-1
   *   ⇒ "รู้ว่าใครชนะ + รู้ผลต่าง" = "รู้สกอร์เป๊ะ" ⇒ ชั้นกลางไม่มีความหมาย
   *     และชั้น exact ก็ง่ายอยู่แล้ว (เหลือ 2 ทางเลือก) ไม่ต้องใจดีเพิ่ม
   *   เทสนี้ตรึงว่าในกีฬานับเกม มีแค่ 2 ชั้นที่เป็นไปได้จริง ไม่ใช่ 3
   */
  it('Bo3: ทายฝั่งถูกแล้วได้แค่ exact หรือ side_only — ไม่มีทางได้ close', () => {
    const tiers = new Set<string>();
    for (const predicted of [sc(2, 0), sc(2, 1)]) {
      for (const actual of [sc(2, 0), sc(2, 1)]) {
        tiers.add(pickemScoreFor(A, predicted, A, actual, TOL.valorant).tier);
      }
    }
    expect([...tiers].sort()).toEqual(['exact', 'side_only']);
  });

  it('Bo5 ทาย 3-2 ได้จริง 3-2 → exact', () => {
    expect(pickemScoreFor(A, sc(3, 2), A, sc(3, 2), TOL.rov).tier).toBe('exact');
  });
});

describe('แถวเก่าก่อน migration 038 (ไม่มีสกอร์ที่ทาย)', () => {
  it('ฝั่งถูก → side_only ไม่ใช่ 0 — ตอนนั้นระบบไม่ได้ขอสกอร์จากเขา', () => {
    expect(pickemScoreFor(A, null, A, sc(2, 1), TOL.football))
      .toEqual({ points: PICKEM_TIER_POINTS.side_only, tier: 'side_only' });
  });

  it('ฝั่งผิด → 0 เหมือนเดิม', () => {
    expect(pickemScoreFor(A, null, B, sc(1, 2), TOL.football).points).toBe(0);
  });

  it('ผลจริงไม่มีสกอร์ (ไม่ควรเกิดกับผลที่ verified) → side_only ไม่ระเบิด', () => {
    expect(pickemScoreFor(A, sc(2, 1), A, null, TOL.football).tier).toBe('side_only');
  });
});

describe('ความทนทานต่อข้อมูลเพี้ยน', () => {
  /**
   * ★ ถ้าวนแค่ key ของก้อนที่ทาย จะมองข้ามส่วนต่างของ key ที่มีแต่ในผลจริง
   *   แล้วแจกโบนัสผิด — เทสนี้กันการ "optimize" ให้วนก้อนเดียว
   */
  it('key ที่มีแต่ในผลจริง ต้องถูกนับเป็นความคลาดด้วย', () => {
    const predicted = { [String(A)]: 2 };                       // ขาด key ของ B
    const actual = { [String(A)]: 2, [String(B)]: 1 };
    // คลาด = |2-2| + |0-1| = 1 ⇒ ฟุตบอล tolerance 1 → close ไม่ใช่ exact
    expect(pickemScoreFor(A, predicted, A, actual, TOL.football).tier).toBe('close');
  });

  it('key ที่มีแต่ในของที่ทาย ก็ถูกนับ', () => {
    const predicted = { [String(A)]: 2, [String(B)]: 1 };
    const actual = { [String(A)]: 2 };
    expect(pickemScoreFor(A, predicted, A, actual, TOL.football).tier).toBe('close');
  });

  it('tolerance ติดลบถือเท่ากับ 0 — ไม่ทำให้ exact กลายเป็น close', () => {
    expect(pickemScoreFor(A, sc(2, 1), A, sc(2, 1), -5).tier).toBe('exact');
    expect(pickemScoreFor(A, sc(2, 1), A, sc(3, 1), -5).tier).toBe('side_only');
  });
});

describe('อัตราส่วนของสเกล (มติ: ตัวเลือก ก)', () => {
  it('เพดานยังเป็น 10 เหมือนก่อน OD-56', () => {
    expect(PICKEM_TIER_POINTS.exact).toBe(10);
  });

  // ★ 2.5 เท่าคืออัตราที่ pool ฟุตบอลจริงใช้กันมากสุด — ตรึงไว้กันการขยับโดยไม่ตั้งใจ
  it('ทายเป๊ะคุ้ม 2.5 เท่าของทายแค่ฝั่งถูก', () => {
    expect(PICKEM_TIER_POINTS.exact / PICKEM_TIER_POINTS.side_only).toBe(2.5);
  });

  it('ชั้นกลางอยู่ระหว่างสองชั้นจริง ไม่เท่ากับชั้นใดชั้นหนึ่ง', () => {
    expect(PICKEM_TIER_POINTS.side_only).toBeLessThan(PICKEM_TIER_POINTS.close);
    expect(PICKEM_TIER_POINTS.close).toBeLessThan(PICKEM_TIER_POINTS.exact);
  });
});
