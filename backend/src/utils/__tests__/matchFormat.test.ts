import { describe, it, expect } from 'vitest';
import {
    BEST_OF_VALUES, isBestOf, gamesToWin, maxGamesForLoser, possibleScores,
    scorePairError, toleranceForBestOf, toleranceFor, walkoverScoreForBestOf,
    bestOfNotSupportedError, assertBestOfAllowed,
} from '../matchFormat.js';

describe('BEST_OF_VALUES', () => {
    // 🔴 ตรึงไว้เพราะต้องตรงกับ CHECK ในฐาน (migration 044) และ zod ของสองเส้น PATCH
    // ถ้าเพิ่ม/ลดค่าโดยไม่แก้ทั้งสามที่ ฐานจะปฏิเสธค่าที่ API ยอมรับ (หรือกลับกัน)
    it('มีแค่เลขคี่ 1/3/5/7 — ตรงกับ CHECK ในฐานและ zod', () => {
        expect([...BEST_OF_VALUES]).toEqual([1, 3, 5, 7]);
    });

    it('isBestOf ปฏิเสธเลขคู่ · null · string · ค่าที่ดูใกล้เคียง', () => {
        for (const ok of [1, 3, 5, 7]) expect(isBestOf(ok)).toBe(true);
        for (const bad of [0, 2, 4, 6, 8, 9, -1, 1.5, null, undefined, '3', '', {}, []]) {
            expect(isBestOf(bad)).toBe(false);
        }
    });
});

describe('gamesToWin / maxGamesForLoser', () => {
    it('ผู้ชนะต้องได้ (N+1)/2 · ผู้แพ้ได้ไม่เกิน (N-1)/2', () => {
        expect([1, 3, 5, 7].map(n => gamesToWin(n as 1 | 3 | 5 | 7))).toEqual([1, 2, 3, 4]);
        expect([1, 3, 5, 7].map(n => maxGamesForLoser(n as 1 | 3 | 5 | 7))).toEqual([0, 1, 2, 3]);
    });

    // ★ ความสัมพันธ์นี้เป็นเหตุผลทั้งข้อที่ BO-N "กำหนดผล" ไม่ใช่แค่ "จำกัด":
    //   จำนวนเกมสองฝั่งรวมกันสูงสุด = N พอดี ⇒ ไม่มีทางแข่งเกินจำนวนที่ประกาศ
    it('เกมของสองฝั่งรวมกันไม่เกิน N', () => {
        for (const n of [1, 3, 5, 7] as const) {
            expect(gamesToWin(n) + maxGamesForLoser(n)).toBe(n);
        }
    });
});

describe('possibleScores', () => {
    it('คืนคู่สกอร์ครบทุกแบบ เรียงจากขาดลอยไปสูสี', () => {
        expect(possibleScores(1)).toEqual([[1, 0]]);
        expect(possibleScores(3)).toEqual([[2, 0], [2, 1]]);
        expect(possibleScores(5)).toEqual([[3, 0], [3, 1], [3, 2]]);
        expect(possibleScores(7)).toEqual([[4, 0], [4, 1], [4, 2], [4, 3]]);
    });

    // ★ จำนวนคำตอบที่เป็นไปได้คือสิ่งที่ทำให้ BO3 ทาย "เป๊ะ" ง่ายกว่าฟุตบอลมาก
    //   (เหตุผลที่มติ 5 ต.ค. ให้ BO7 มีชั้นกลางแต่ BO3 ไม่มี — ดู toleranceForBestOf)
    it('จำนวนแบบ = (N+1)/2', () => {
        for (const n of [1, 3, 5, 7] as const) {
            expect(possibleScores(n)).toHaveLength(gamesToWin(n));
        }
    });

    it('ทุกคู่ที่คืนมาต้องผ่าน scorePairError — สองฟังก์ชันนี้ห้ามขัดกัน', () => {
        for (const n of [1, 3, 5, 7] as const) {
            for (const [w, l] of possibleScores(n)) {
                expect(scorePairError(n, w!, l!)).toBeNull();
            }
        }
    });
});

describe('scorePairError', () => {
    it('ผ่านเมื่อสกอร์เข้ารูปแบบ', () => {
        expect(scorePairError(3, 2, 0)).toBeNull();
        expect(scorePairError(3, 2, 1)).toBeNull();
        expect(scorePairError(7, 4, 3)).toBeNull();
    });

    // 🔴 เคสหลักที่ด่านนี้มีไว้กัน: หน่วยสกอร์ผิด (กรอกแต้มในเกมแทนจำนวนเกม)
    it('ปฏิเสธสกอร์ที่เป็นหน่วยอื่น — แบดมินตันกรอก 21-19 แทน 2-0', () => {
        const problem = scorePairError(3, 21, 19);
        expect(problem).not.toBeNull();
        expect(problem).toContain('2 เกมพอดี');
    });

    it('ปฏิเสธเมื่อฝ่ายชนะได้เกินจำนวนที่ต้องได้ (BO3 แล้วส่ง 3-1)', () => {
        expect(scorePairError(3, 3, 1)).toContain('2 เกมพอดี');
    });

    it('ปฏิเสธเมื่อฝ่ายชนะได้น้อยกว่าที่ต้องได้ (BO5 แล้วส่ง 2-1 = ยังไม่จบ)', () => {
        expect(scorePairError(5, 2, 1)).toContain('3 เกมพอดี');
    });

    it('ปฏิเสธเมื่อฝ่ายแพ้ได้เกินเพดาน (BO3 แล้วส่ง 2-2)', () => {
        // 🔴 2-2 เป็นไปไม่ได้ใน BO3 เพราะแข่งจบที่เกมที่สามแล้ว
        expect(scorePairError(3, 2, 2)).toContain('ไม่เกิน 1 เกม');
    });

    // ★ ข้อความต้องแยกสองสาเหตุ ไม่ใช่ "สกอร์ไม่ถูกต้อง" รวม ๆ
    //   ไม่งั้นผู้ใช้ไม่รู้ว่าต้องแก้ตัวเลขของฝั่งไหน
    it('ข้อความบอกต่างกันระหว่าง "เกมผู้ชนะผิด" กับ "เกมผู้แพ้เกิน"', () => {
        expect(scorePairError(5, 4, 0)).toContain('ชนะต้องได้');
        expect(scorePairError(5, 3, 3)).toContain('แพ้ได้ไม่เกิน');
    });

    it('ปฏิเสธเกมผู้แพ้ที่ติดลบ', () => {
        expect(scorePairError(3, 2, -1)).not.toBeNull();
    });

    // 🔴 ฟังก์ชันนี้ **ไม่ใช่** ด่านตรวจว่าใครชนะ หรือว่าสองค่าต่างกัน
    //   สองข้อนั้นอยู่ที่ ensureScoreData / resolvePredictedWinner ซึ่งต้องทำงานกับ
    //   กีฬาที่ best_of เป็น null ด้วย ⇒ ถ้าย้ายมารวมที่นี่ กีฬาพวกนั้นจะไม่มีด่าน
    it('ไม่แตะเรื่อง "ใครชนะ" — ส่งค่าสลับฝั่งมาก็ยังตรวจตามตำแหน่งที่ส่ง', () => {
        expect(scorePairError(3, 2, 0)).toBeNull();
        expect(scorePairError(3, 0, 2)).not.toBeNull();   // 0 ไม่ใช่ 2 ⇒ ผิดที่ฝั่งผู้ชนะ
    });
});

describe('toleranceForBestOf (มติ 5 ต.ค. — ชั้นกลางเริ่มมีที่ BO7)', () => {
    it('BO7 มีชั้นกลาง (0,1) · BO1/BO3/BO5 ไม่มี (0,0)', () => {
        expect(toleranceForBestOf(1)).toEqual({ exact: 0, close: 0 });
        expect(toleranceForBestOf(3)).toEqual({ exact: 0, close: 0 });
        expect(toleranceForBestOf(5)).toEqual({ exact: 0, close: 0 });
        expect(toleranceForBestOf(7)).toEqual({ exact: 0, close: 1 });
    });

    // ★ เหตุผลของมติ: BO3 มีคำตอบ 2 แบบ ⇒ ให้ชั้นกลางกับ "ผิดไป 1" เท่ากับให้ชั้นกลาง
    //   กับทุกคำตอบที่ไม่ใช่คำตอบที่ถูก ⇒ ไม่ต่างจากไม่มีชั้นกลาง
    it('ชั้นกลางของ BO7 ครอบได้แค่ 1 ⇒ ทาย 4-2 ได้จริง 4-3 ยังนับ "ใกล้"', () => {
        const t = toleranceForBestOf(7);
        expect(Math.abs(2 - 3)).toBeLessThanOrEqual(t.close);
        expect(Math.abs(0 - 3)).toBeGreaterThan(t.close);
    });

    it('exact เป็น 0 ทุกค่า — "เป๊ะ" ของกีฬาที่นับเกมคือเป๊ะจริง ไม่มีผ่อน', () => {
        for (const n of [1, 3, 5, 7] as const) expect(toleranceForBestOf(n).exact).toBe(0);
    });
});

describe('toleranceFor — แหล่งความจริงเดียวของเส้น tolerance', () => {
    const SPORT = { exact: 5, close: 10 };   // เส้นของบาสเกตบอลในฐานจริง

    it('best_of มีค่า ⇒ เส้นมาจากรูปแบบ ไม่ใช่จากกีฬา', () => {
        expect(toleranceFor(7, SPORT)).toEqual({ exact: 0, close: 1 });
        expect(toleranceFor(3, SPORT)).toEqual({ exact: 0, close: 0 });
    });

    it('best_of เป็น null ⇒ เส้นมาจากกีฬาตามเดิม', () => {
        expect(toleranceFor(null, SPORT)).toEqual(SPORT);
    });

    // 🔴 ข้อนี้คือเหตุผลที่เส้นต้องย้ายมาอยู่กับรูปแบบ: คอลัมน์ใน sport_types เก็บค่าเดียว
    //   ต่อกีฬา แต่ทัวร์เดียวมีได้ทั้ง BO3 และ BO7 ⇒ ค่าเดียวตอบสองรูปแบบไม่ได้
    it('กีฬาเดียวกันแต่ต่างรูปแบบ ได้เส้นต่างกัน', () => {
        expect(toleranceFor(3, SPORT)).not.toEqual(toleranceFor(7, SPORT));
    });

    it('ค่าที่ไม่ใช่ 1/3/5/7 ถือเป็น "ไม่ได้แข่งเป็นรอบ" ⇒ ใช้เส้นของกีฬา', () => {
        // ฐานมี CHECK กันไว้แล้ว แต่ถ้าหลุดมาได้ (เช่นข้อมูลเก่า) ต้องไม่กลายเป็น (0,0)
        // ซึ่งจะทำให้คนที่ทายถูกตามเกณฑ์ของกีฬากลายเป็นทายไม่ถูกเงียบ ๆ
        expect(toleranceFor(2, SPORT)).toEqual(SPORT);
        expect(toleranceFor(0, SPORT)).toEqual(SPORT);
    });
});

describe('walkoverScoreForBestOf (มติข้อ ④ · 5 ต.ค.)', () => {
    it('BO1 1-0 · BO3 2-0 · BO5 3-0 · BO7 4-0', () => {
        expect(walkoverScoreForBestOf(1)).toEqual({ winner: 1, loser: 0 });
        expect(walkoverScoreForBestOf(3)).toEqual({ winner: 2, loser: 0 });
        expect(walkoverScoreForBestOf(5)).toEqual({ winner: 3, loser: 0 });
        expect(walkoverScoreForBestOf(7)).toEqual({ winner: 4, loser: 0 });
    });

    // ★ ข้อนี้คือเหตุผลที่เลิกอ่าน sport_types.walkover_score สำหรับกีฬาที่แข่งเป็นรอบ:
    //   ค่านั้นเก็บต่อกีฬา (แบด/RoV/VALORANT ถูก seed 2-0 ไว้ตั้งแต่ migration 011)
    //   ⇒ รอบชิง BO5 จะได้ 2-0 ซึ่งผิดรูปแบบ แล้ว ensureScoreData จะปฏิเสธถ้ามีคนแก้ผลทีหลัง
    it('สกอร์ walkover ต้องเข้ารูปแบบของตัวเองเสมอ — ไม่งั้นด่านตรวจผลจะปฏิเสธผลของระบบเอง', () => {
        for (const n of [1, 3, 5, 7] as const) {
            const wo = walkoverScoreForBestOf(n);
            expect(scorePairError(n, wo.winner, wo.loser)).toBeNull();
        }
    });
});

/**
 * 🆕 มติ 7 ต.ค. 2569 (②ก) — กีฬาที่ไม่ได้แข่งเป็นรอบ ตั้ง best_of ไม่ได้
 *
 * ก่อนมตินี้ `best_of` ไม่ได้ผูกกับกีฬาเลย (อยู่ที่ทัวร์/แมตช์) ⇒ ตั้ง BO5 ให้ฟุตบอลก็ได้
 * ★ บังคับทางเดียว: "ไม่แข่งเป็นรอบ + ส่ง BO มา" = ผิด · "แข่งเป็นรอบ + ไม่ส่ง (null)" = ผ่าน
 *   เพราะผู้จัดตั้ง BO ทีหลังได้ก่อนแมตช์แรกเริ่ม (มติ 5 ต.ค.) ⇒ บังคับให้มีตอนสร้างไม่ได้
 */
describe('bestOfNotSupportedError / assertBestOfAllowed (มติ 7 ต.ค.)', () => {
  const rounds = { name: 'E-Sport: RoV', supports_best_of: 1 };
  const points = { name: 'ฟุตบอล', supports_best_of: 0 };

  it.each([1, 3, 5, 7])('กีฬาที่แข่งเป็นรอบ ตั้ง BO%i ได้', (bo) => {
    expect(bestOfNotSupportedError(rounds, bo)).toBeNull();
  });

  it.each([1, 3, 5, 7])('กีฬาที่นับแต้ม ตั้ง BO%i ไม่ได้ และข้อความบอกชื่อกีฬา', (bo) => {
    const problem = bestOfNotSupportedError(points, bo);

    expect(problem).not.toBeNull();
    expect(problem).toContain('ฟุตบอล');
  });

  /** ★ null/undefined = "ไม่ได้แข่งเป็นรอบ" ⇒ ผ่านทั้งสองกลุ่ม (undefined = ไม่ส่งคีย์มาเลย) */
  it.each([
    ['null กับกีฬาที่นับแต้ม', points, null],
    ['undefined กับกีฬาที่นับแต้ม', points, undefined],
    ['null กับกีฬาที่แข่งเป็นรอบ', rounds, null],
  ])('%s ⇒ ผ่าน', (_name, sport, bo) => {
    expect(bestOfNotSupportedError(sport, bo)).toBeNull();
  });

  it('assertBestOfAllowed โยน 400 BEST_OF_NOT_SUPPORTED พร้อม fields.bestOf', () => {
    try {
      assertBestOfAllowed(points, 3);
      expect.unreachable('ต้องโยน');
    } catch (err) {
      expect(err).toMatchObject({ status: 400, code: 'BEST_OF_NOT_SUPPORTED' });
      expect((err as { extra?: { fields?: Record<string, string> } }).extra?.fields?.['bestOf']).toBeTruthy();
    }
  });

  it('assertBestOfAllowed ไม่โยนเมื่อผ่าน', () => {
    expect(() => assertBestOfAllowed(rounds, 5)).not.toThrow();
    expect(() => assertBestOfAllowed(points, null)).not.toThrow();
  });
});
