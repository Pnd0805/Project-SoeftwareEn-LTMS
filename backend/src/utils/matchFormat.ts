/**
 * รูปแบบ "แข่งหลายรอบ" BO-N — สูตรกลางที่ทุกที่ต้องเรียกตัวเดียวกัน (มติ 5 ต.ค. 2569)
 *
 * ★ อยู่ใน utils/ ไม่ใช่ service/ เพราะ **repository ต้องเรียกได้** (pickem.repo ตัดสินชั้นแต้ม
 *   ในทรานแซกชันเดียวกับที่อ่านสกอร์) และ repository เรียก service ไม่ได้ตามชั้นของโปรเจกต์
 *   เหตุผลเดียวกับที่ utils/pickemScore.ts อยู่ที่นี่
 *
 * ═══ สิ่งที่ BO-N กำหนด (ไม่ใช่แค่ "จำกัด") ═══
 * ผู้ชนะต้องได้ (N+1)/2 **เป๊ะ** เพราะแข่งจบทันทีที่ฝั่งใดถึงจำนวนนั้น ⇒ ไม่มีทางได้มากกว่า
 * ผู้แพ้ได้ 0 .. (N-1)/2
 *     BO1 → 1-0                        1 แบบ
 *     BO3 → 2-0 · 2-1                  2 แบบ
 *     BO5 → 3-0 · 3-1 · 3-2            3 แบบ
 *     BO7 → 4-0 · 4-1 · 4-2 · 4-3      4 แบบ
 * ⇒ หน้าส่งผลและหน้าทายผลของกีฬาเหล่านี้ควรเป็น "ให้เลือก" ไม่ใช่ช่องกรอกเลข
 *
 * ═══ 🔴 null ไม่ใช่ "ยังไม่ตั้ง" แต่คือ "กีฬานี้ไม่ได้แข่งเป็นรอบ" ═══
 * ฟุตบอล/บาสเกตบอลเป็น null โดยเจตนา (มติข้อ ①) — สกอร์คือประตู/แต้มในเกมเดียว ไม่มีเพดาน
 * ทุกฟังก์ชันในไฟล์นี้จึงรับ null ได้ และคืน "ไม่บังคับอะไร" กลับไป
 */

/** ค่าที่อนุญาต — ตรงกับ CHECK ในฐาน (migration 044) ห้ามแก้ที่เดียวแล้วลืมอีกที่ */
export const BEST_OF_VALUES = [1, 3, 5, 7] as const;
export type BestOf = (typeof BEST_OF_VALUES)[number];

export function isBestOf(value: unknown): value is BestOf {
    return typeof value === 'number' && (BEST_OF_VALUES as readonly number[]).includes(value);
}

/** จำนวนเกม/แมพที่ผู้ชนะต้องได้ — เป๊ะค่านี้เท่านั้น ไม่ใช่ "อย่างน้อย" */
export function gamesToWin(bestOf: BestOf): number {
    return (bestOf + 1) / 2;
}

/** จำนวนเกมสูงสุดที่ผู้แพ้ได้ */
export function maxGamesForLoser(bestOf: BestOf): number {
    return (bestOf - 1) / 2;
}

/**
 * คู่สกอร์ทั้งหมดที่เป็นไปได้ เรียงจากห่างสุดไปใกล้สุด — ใช้ส่งให้ FE ทำปุ่มให้เลือก
 * คืนเป็น [เกมของผู้ชนะ, เกมของผู้แพ้] เช่น BO5 → [[3,0],[3,1],[3,2]]
 */
export function possibleScores(bestOf: BestOf): [number, number][] {
    const win = gamesToWin(bestOf);
    return Array.from({ length: maxGamesForLoser(bestOf) + 1 }, (_, loss) => [win, loss]);
}

/**
 * ตรวจว่าสกอร์คู่นี้เป็นไปได้ในรูปแบบนี้ไหม · คืนข้อความเหตุผลเมื่อไม่ผ่าน (null = ผ่าน)
 *
 * ★ คืน "ข้อความ" ไม่ใช่ boolean เพราะคนกรอกผิดได้สองแบบที่ต้องบอกต่างกัน:
 *   ฝั่งที่ชนะได้เกมไม่ถูกจำนวน (เช่น BO3 แล้วส่ง 3-1) กับ ฝั่งที่แพ้ได้เกมเกินเพดาน (2-2)
 *   ถ้าบอกรวม ๆ ว่า "สกอร์ไม่ถูกต้อง" ผู้ใช้จะไม่รู้ว่าต้องแก้ตัวเลขไหน
 *
 * 🔴 ไม่ตรวจว่าใครชนะ และไม่ตรวจว่าสองค่าต่างกัน — สองข้อนั้นเป็นหน้าที่ของ
 *   ensureScoreData / resolvePredictedWinner ที่เรียกฟังก์ชันนี้ ด่านนั้นต้องทำงาน
 *   กับกีฬาที่ best_of เป็น null ด้วย ⇒ แยกกันไว้ไม่ให้กฎซ้อนกันสองที่
 */
export function scorePairError(bestOf: BestOf, winnerGames: number, loserGames: number): string | null {
    const need = gamesToWin(bestOf);
    if (winnerGames !== need) {
        return `รูปแบบ BO${bestOf} ⇒ ฝ่ายที่ชนะต้องได้ ${need} เกมพอดี (ส่งมา ${winnerGames})`;
    }
    const cap = maxGamesForLoser(bestOf);
    if (loserGames < 0 || loserGames > cap) {
        return `รูปแบบ BO${bestOf} ⇒ ฝ่ายที่แพ้ได้ไม่เกิน ${cap} เกม (ส่งมา ${loserGames})`;
    }
    return null;
}

/**
 * เส้นความคลาดของ Pick'em สำหรับรูปแบบนี้ (มติ 5 ต.ค.)
 *
 * BO7 → (0,1) **มีชั้นกลาง** — ทาย 4-2 ได้จริง 4-3 ยังได้ชั้น "ใกล้" ไม่ร่วงถึงชั้นล่างสุด
 * BO1/BO3/BO5 → (0,0) ไม่มีชั้นกลาง
 *
 * ★ ทำไม BO3 ไม่ให้มีชั้นกลาง: BO3 มีคำตอบแค่ 2 แบบ (2-0 / 2-1) ⇒ ให้ชั้นกลางกับ "ผิดไป 1"
 *   เท่ากับให้แต้มชั้นกลางกับทุกคำตอบที่ไม่ใช่คำตอบที่ถูก ⇒ ไม่มีความหมายต่างจากไม่มีชั้น
 *   BO5 เหตุผลเดียวกันแต่แรงน้อยกว่า (3 แบบ) ⇒ มติเลือกให้เริ่มมีชั้นกลางที่ BO7
 *
 * 🔴 เส้นของกีฬาที่ best_of เป็น null **ไม่ได้มาจากที่นี่** — อยู่ใน sport_types ตามเดิม
 *   (ฟุตบอล (0,1) · บาสเกตบอล (5,10)) ⇒ คนเรียกต้องเลือกแหล่งตาม best_of
 *   ดู toleranceFor() ที่รวมสองแหล่งไว้ให้แล้ว อย่าเรียกตัวนี้ตรง ๆ จากที่อื่น
 */
export function toleranceForBestOf(bestOf: BestOf): { exact: number; close: number } {
    return bestOf === 7 ? { exact: 0, close: 1 } : { exact: 0, close: 0 };
}

/**
 * แหล่งความจริงเดียวของเส้น tolerance — รวมสองแหล่งเข้าด้วยกัน
 * best_of มีค่า ⇒ เส้นมาจากรูปแบบ · best_of เป็น null ⇒ เส้นมาจากกีฬา
 */
export function toleranceFor(
    bestOf: number | null,
    sportTolerance: { exact: number; close: number }
): { exact: number; close: number } {
    return isBestOf(bestOf) ? toleranceForBestOf(bestOf) : sportTolerance;
}

/**
 * สกอร์ที่บันทึกเมื่อชนะบาย (มติข้อ ④ · 5 ต.ค.) — BO1 1-0 · BO3 2-0 · BO5 3-0 · BO7 4-0
 *
 * ★ มตินี้ทำให้ `sport_types.walkover_score` เลิกเป็นแหล่งความจริงของกีฬาที่แข่งเป็นรอบ
 *   เหตุ: walkover_score เก็บค่าเดียว **ต่อกีฬา** แต่ทัวร์เดียวมีได้หลายรูปแบบ
 *   (กลุ่ม BO3 ชิง BO5) ⇒ ค่าเดียวตอบสองรูปแบบไม่ได้ และถ้าปล่อยให้มีสองแหล่ง
 *   วันหนึ่งมันจะขัดกันเองโดยไม่มีใครรู้ว่าอันไหนถูก
 * ⇒ walkover_score เหลือใช้เฉพาะกีฬาที่ best_of เป็น null (ฟุตบอล 3-0 · บาสเกตบอล 20-0)
 */
export function walkoverScoreForBestOf(bestOf: BestOf): { winner: number; loser: number } {
    return { winner: gamesToWin(bestOf), loser: 0 };
}
