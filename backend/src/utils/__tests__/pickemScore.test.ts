import { describe, it, expect } from 'vitest';
import { pickemScoreFor } from '../pickemScore.js';
import { PICKEM_TIER_POINTS } from '../../config/scoring.js';

/**
 * OD-56 ก้าวที่ 2-3 (4 ต.ค. 2569) — แต้ม Pick'em 3 ชั้น · เส้นต่อฝั่ง · ยึดฝั่งที่แย่กว่า
 *
 * ★ เทสชุดนี้เขียนด้วยกีฬาจริงทั้ง 5 ของระบบ ไม่ใช่ตัวเลขลอย ๆ
 *   เพราะประเด็นทั้งหมดของ `tolerance` คือ "สูตรเดียวต้องยุติธรรมข้ามกีฬาที่นับคนละหน่วย"
 *   ถ้าเทสด้วยเลขสมมติ จะไม่จับได้ว่าชั้นกลางไปทำอะไรกับกีฬาที่นับเป็นเกม
 */

const A = 10, B = 11;          // รหัสทีมสองฝั่ง
const sc = (a: number, b: number) => ({ [String(A)]: a, [String(B)]: b });

// เส้นต่อกีฬาตาม migration 040 — ตัวเลขชุดเดียวกับที่ UPDATE ลงฐานจริง
const TOL = {
  badminton  : { exact: 0, close: 0  },
  rov        : { exact: 0, close: 0  },
  valorant   : { exact: 0, close: 0  },
  football   : { exact: 0, close: 1  },
  basketball : { exact: 5, close: 10 },
};

describe('ด่านแรก — ทายฝั่งผิด = 0 เสมอ (มติข้อ ②)', () => {
  it('ทายผิดฝั่งแต่สกอร์กลับด้านเป๊ะ ก็ยังได้ 0', () => {
    // ทาย A ชนะ 3-1 · จริง B ชนะ 3-1 (คือ 1-3 ในมุมของ A) — "ใกล้" ที่สุดที่จะใกล้ได้
    expect(pickemScoreFor(A, sc(3, 1), B, sc(1, 3), TOL.football))
      .toEqual({ points: 0, tier: 'wrong_side' });
  });

  it('ทายผิดฝั่งแต่คลาดแค่ 1 ก็ยังได้ 0 แม้เส้นจะกว้าง', () => {
    expect(pickemScoreFor(A, sc(2, 1), B, sc(2, 3), TOL.basketball).points).toBe(0);
  });

  /**
   * ★ ข้อนี้คือสิ่งที่ทำให้ `SUM(points_earned > 0) AS correct` ใน E28/E29 ยังพูดความจริง
   *   ถ้าเคสไหนที่ฝั่งผิดได้แต้ม > 0 หลุดมา ช่อง "ทายถูก" และ rank จะเพี้ยนทั้งตาราง
   */
  it('ไม่มีทางได้แต้ม > 0 เลยถ้าฝั่งผิด — ไล่ทุกเส้นที่ระบบมี', () => {
    for (const tolerance of Object.values(TOL)) {
      for (const [pa, pb] of [[1, 0], [5, 0], [21, 19], [100, 98]]) {
        expect(pickemScoreFor(A, sc(pa!, pb!), B, sc(0, 1), tolerance).points).toBe(0);
      }
    }
  });
});

/**
 * ★★ หัวใจของ migration 040 — ชั้นถูกตัดสินด้วย "ฝั่งที่คลาดมากสุด" ไม่ใช่ผลรวมสองฝั่ง
 *
 *   ชุดนี้คือเทสที่จะแดงทันทีถ้ามีคนเปลี่ยนกลับไปบวกความคลาดสองฝั่งเข้าด้วยกัน
 *   ซึ่งเป็นสิ่งที่ 039 ทำและถูกยกเลิกไปแล้ว
 */
describe('★ ยึดฝั่งที่แย่กว่า — ไม่ใช่ผลรวมสองฝั่ง', () => {
  it('เคสต้นเรื่อง: บาส ทาย 50-39 ได้จริง 52-45 → close (คลาด 2 กับ 6 ยึด 6)', () => {
    expect(pickemScoreFor(A, sc(50, 39), A, sc(52, 45), TOL.basketball))
      .toEqual({ points: PICKEM_TIER_POINTS.close, tier: 'close' });
  });

  it('คลาดฝั่งละ 5 พอดี → ยังเป็น spot_on (ถ้าบวกกันจะได้ 10 แล้วร่วงไป close)', () => {
    expect(pickemScoreFor(A, sc(95, 85), A, sc(100, 90), TOL.basketball).tier).toBe('spot_on');
  });

  it('คลาดฝั่งละ 8 → close (ถ้าบวกกันจะได้ 16 แล้วร่วงไป side_only)', () => {
    expect(pickemScoreFor(A, sc(90, 82), A, sc(98, 90), TOL.basketball).tier).toBe('close');
  });

  /**
   * ★ เหตุผลข้อ ข) ของ migration 040 — "อ่านผลต่างถูก" ต้องไม่ถูกลงโทษ
   *   ทาย 2-1 ได้จริง 3-2 = ผลต่าง +1 ถูกเป๊ะ แค่ประเมินจำนวนประตูต่ำไปหนึ่ง
   *   สูตรเก่า (ผลรวม 2) ให้ side_only ซึ่งแย่กว่าคนที่อ่านผลต่างผิด (2-1 vs 3-1 รวม 1 = close)
   */
  it('ฟุตบอล ทาย 2-1 ได้จริง 3-2 (ผลต่างถูกเป๊ะ) → close ไม่ใช่ side_only', () => {
    expect(pickemScoreFor(A, sc(2, 1), A, sc(3, 2), TOL.football).tier).toBe('close');
  });

  it('ความคลาดกระจุกฝั่งเดียวกับกระจายสองฝั่ง ถ้าค่ามากสุดเท่ากัน ต้องได้ชั้นเดียวกัน', () => {
    const concentrated = pickemScoreFor(A, sc(100, 90), A, sc(103, 90), TOL.basketball);
    const spread       = pickemScoreFor(A, sc(100, 90), A, sc(103, 93), TOL.basketball);
    expect(spread.tier).toBe(concentrated.tier);
    expect(spread.tier).toBe('spot_on');
  });
});

describe('ฟุตบอล — นับแต้มจริง (ประตู) · เส้น (0 , 1)', () => {
  it('ทาย 2-1 ได้จริง 2-1 → spot_on', () => {
    expect(pickemScoreFor(A, sc(2, 1), A, sc(2, 1), TOL.football))
      .toEqual({ points: PICKEM_TIER_POINTS.spot_on, tier: 'spot_on' });
  });

  /**
   * ★ ฟุตบอลตั้ง exact = 0 โดยเจตนา — ทายสกอร์เป๊ะเป็นสิ่งที่คนดูบอลทายกันจริงและเกิดได้
   *   ชั้นเต็มของฟุตบอลจึงควรหมายถึง "เป๊ะ" จริง ๆ ไม่ใช่แถบ
   */
  it('ทาย 2-1 ได้จริง 3-1 (คลาดฝั่งเดียว 1) → close ไม่ใช่ spot_on', () => {
    expect(pickemScoreFor(A, sc(2, 1), A, sc(3, 1), TOL.football))
      .toEqual({ points: PICKEM_TIER_POINTS.close, tier: 'close' });
  });

  it('ทาย 3-1 ได้จริง 2-0 (คลาดฝั่งละ 1) → close', () => {
    expect(pickemScoreFor(A, sc(3, 1), A, sc(2, 0), TOL.football).tier).toBe('close');
  });

  it('ทาย 1-0 ได้จริง 5-0 (คลาด 4) → side_only', () => {
    expect(pickemScoreFor(A, sc(1, 0), A, sc(5, 0), TOL.football).tier).toBe('side_only');
  });

  it('ทาย 1-0 ได้จริง 3-1 (ฝั่งแย่สุดคลาด 2) → side_only', () => {
    expect(pickemScoreFor(A, sc(1, 0), A, sc(3, 1), TOL.football).tier).toBe('side_only');
  });
});

describe('บาสเกตบอล — นับแต้มจริง ช่วง 50–120 · เส้น (5 , 10)', () => {
  /**
   * ★★ นี่คือสิ่งที่ migration 040 แก้ให้บาส
   *   ก่อนหน้านี้ชั้นเต็มต้องคลาด 0 ทั้งสองตัว ⇒ เพดานจริงของคนทายบาสคือ 7 ตลอดชีวิต
   *   ทั้งที่ทายแม่นกว่าคนทาย Bo3 ที่ได้ 10 จากการเลือกใน 2 ทางเลือก
   */
  it('ทาย 95-90 ได้จริง 98-90 (คลาด 3) → spot_on — ข้อที่ทำให้บาสเอื้อมถึง 10 ได้จริง', () => {
    expect(pickemScoreFor(A, sc(95, 90), A, sc(98, 90), TOL.basketball))
      .toEqual({ points: PICKEM_TIER_POINTS.spot_on, tier: 'spot_on' });
  });

  it('ขอบในของทั้งสองเส้นนับด้วย — คลาด 5 = spot_on · คลาด 10 = close', () => {
    expect(pickemScoreFor(A, sc(100, 90), A, sc(105, 90), TOL.basketball).tier).toBe('spot_on');
    expect(pickemScoreFor(A, sc(100, 90), A, sc(110, 90), TOL.basketball).tier).toBe('close');
  });

  it('เกินเส้นไป 1 → ร่วงชั้น — คลาด 6 = close · คลาด 11 = side_only', () => {
    expect(pickemScoreFor(A, sc(100, 90), A, sc(106, 90), TOL.basketball).tier).toBe('close');
    expect(pickemScoreFor(A, sc(100, 90), A, sc(111, 90), TOL.basketball).tier).toBe('side_only');
  });

  it('ถ้าเส้นเป็น (0 , 0) เคสคลาด 3 จะร่วงไป side_only — พิสูจน์ว่าเส้นมีผลจริง', () => {
    expect(pickemScoreFor(A, sc(95, 90), A, sc(98, 90), { exact: 0, close: 0 }).tier).toBe('side_only');
  });
});

describe('แบดมินตัน / RoV / VALORANT — นับเป็นเกมที่ชนะ · เส้น (0 , 0)', () => {
  it('Bo3 ทาย 2-0 ได้จริง 2-0 → spot_on', () => {
    expect(pickemScoreFor(A, sc(2, 0), A, sc(2, 0), TOL.badminton).tier).toBe('spot_on');
  });

  it('Bo3 ทาย 2-0 ได้จริง 2-1 → side_only (ไม่ใช่ close เพราะเส้นใกล้ก็เป็น 0)', () => {
    expect(pickemScoreFor(A, sc(2, 0), A, sc(2, 1), TOL.rov).tier).toBe('side_only');
  });

  /**
   * ★ สาระของการตั้งเส้นเป็น (0 , 0) ในกีฬาที่นับเป็นเกม
   *   Bo3 ผู้ชนะต้องได้ 2 เกม ⇒ สกอร์ที่เป็นไปได้มีแค่ 2-0 กับ 2-1
   *   ⇒ "รู้ว่าใครชนะ + รู้ผลต่าง" = "รู้สกอร์เป๊ะ" ⇒ ชั้นกลางไม่มีความหมาย
   *     และชั้นเต็มก็ง่ายอยู่แล้ว (เหลือ 2 ทางเลือก) ไม่ต้องใจดีเพิ่ม
   *   เทสนี้ตรึงว่าในกีฬานับเกม มีแค่ 2 ชั้นที่เป็นไปได้จริง ไม่ใช่ 3
   */
  it('Bo3: ทายฝั่งถูกแล้วได้แค่ spot_on หรือ side_only — ไม่มีทางได้ close', () => {
    const tiers = new Set<string>();
    for (const predicted of [sc(2, 0), sc(2, 1)]) {
      for (const actual of [sc(2, 0), sc(2, 1)]) {
        tiers.add(pickemScoreFor(A, predicted, A, actual, TOL.valorant).tier);
      }
    }
    expect([...tiers].sort()).toEqual(['side_only', 'spot_on']);
  });

  it('Bo5 ทาย 3-2 ได้จริง 3-2 → spot_on', () => {
    expect(pickemScoreFor(A, sc(3, 2), A, sc(3, 2), TOL.rov).tier).toBe('spot_on');
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
    // คลาดฝั่ง B = |0-1| = 1 ⇒ ฟุตบอลเส้น (0,1) → close ไม่ใช่ spot_on
    expect(pickemScoreFor(A, predicted, A, actual, TOL.football).tier).toBe('close');
  });

  it('key ที่มีแต่ในของที่ทาย ก็ถูกนับ', () => {
    const predicted = { [String(A)]: 2, [String(B)]: 1 };
    const actual = { [String(A)]: 2 };
    expect(pickemScoreFor(A, predicted, A, actual, TOL.football).tier).toBe('close');
  });

  it('เส้นติดลบถือเท่ากับ 0 — ไม่ทำให้ทายเป๊ะหลุดจากชั้นเต็ม', () => {
    expect(pickemScoreFor(A, sc(2, 1), A, sc(2, 1), { exact: -5, close: -5 }).tier).toBe('spot_on');
    expect(pickemScoreFor(A, sc(2, 1), A, sc(3, 1), { exact: -5, close: -5 }).tier).toBe('side_only');
  });

  /**
   * ★ ฐานมี CHECK กันค่า close < exact ไว้แล้ว แต่สูตรรับค่าจากพารามิเตอร์
   *   ถ้าค่าเพี้ยนหลุดมา ต้องไม่ทำให้ "ชั้นเต็ม" หดลงตาม close
   */
  it('close < exact (ค่าเพี้ยน) → ยกให้เท่า exact ชั้นเต็มไม่หด', () => {
    expect(pickemScoreFor(A, sc(100, 90), A, sc(104, 90), { exact: 5, close: 1 }).tier).toBe('spot_on');
  });
});

describe('อัตราส่วนของสเกล (มติ: ตัวเลือก ก)', () => {
  it('เพดานยังเป็น 10 เหมือนก่อน OD-56', () => {
    expect(PICKEM_TIER_POINTS.spot_on).toBe(10);
  });

  // ★ 2.5 เท่าคืออัตราที่ pool ฟุตบอลจริงใช้กันมากสุด — ตรึงไว้กันการขยับโดยไม่ตั้งใจ
  it('ชั้นเต็มคุ้ม 2.5 เท่าของทายแค่ฝั่งถูก', () => {
    expect(PICKEM_TIER_POINTS.spot_on / PICKEM_TIER_POINTS.side_only).toBe(2.5);
  });

  it('ชั้นกลางอยู่ระหว่างสองชั้นจริง ไม่เท่ากับชั้นใดชั้นหนึ่ง', () => {
    expect(PICKEM_TIER_POINTS.side_only).toBeLessThan(PICKEM_TIER_POINTS.close);
    expect(PICKEM_TIER_POINTS.close).toBeLessThan(PICKEM_TIER_POINTS.spot_on);
  });
});
