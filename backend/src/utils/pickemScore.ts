import { PICKEM_TIER_POINTS } from '../config/scoring.js';

/**
 * OD-56 ก้าวที่ 2-3 (4 ต.ค. 2569) — คิดแต้ม Pick'em จากสกอร์ที่ทาย
 *
 * ★ อยู่ใน `utils` ไม่ใช่ `services` เพราะคนเรียกคือ `pickem.repo.settleTx()` ซึ่งถูกเรียก
 *   จาก `matchResult.repo.applyOutcomeTx()` ภายในทรานแซกชันของผลการแข่ง
 *   repository เรียก service ไม่ได้ (ชั้นผิดทาง) ⇒ สูตรต้องอยู่ในที่ที่ไม่พึ่งใครเลย
 *
 * ★ เป็นฟังก์ชันบริสุทธิ์โดยเจตนา ไม่คิดใน SQL — เพราะ
 *     1. สูตรนี้คาดว่าจะถูกปรับอีก (สเกลเพิ่งตกลงกัน) ⇒ ต้องอ่านง่ายและตรึงด้วยเทสได้ตรง ๆ
 *     2. ถ้าเขียนเป็น CASE WHEN ใน SQL ต้องใช้ JSON_EXTRACT กับ key ที่เป็นรหัสทีม
 *        ซึ่งอ่านยากมากและทดสอบไม่ได้โดยไม่มีฐาน
 */

export type PickemTier = 'spot_on' | 'close' | 'side_only' | 'wrong_side';

export type PickemScoreResult = {
    points: number;
    tier: PickemTier;
};

/**
 * เส้นสองเส้นของกีฬานั้น — มาจาก `sport_types.pickem_tolerance_exact / _close` (migration 040)
 * ความหมาย: **ความคลาดที่ยอมได้ "ต่อฝั่ง"** ไม่ใช่ผลรวมสองฝั่ง
 */
export type PickemTolerance = {
    exact: number;
    close: number;
};

/**
 * @param predictedWinnerId  ผู้ชนะที่ทาย (อนุมานจากสกอร์ตอนบันทึก — ดู resolvePredictedWinner)
 * @param predictedScore     สกอร์ที่ทาย · `null` = แถวก่อน migration 038 (ทายแค่ฝั่ง)
 * @param actualWinnerId     ผู้ชนะจริงจากผลที่ยืนยันแล้ว
 * @param actualScore        สกอร์จริง · `null` = ผลที่ไม่มีสกอร์ (ไม่ควรเกิดกับผลที่ verified)
 * @param tolerance          เส้นต่อฝั่งของกีฬานั้น · `{ exact: 0, close: 0 }` = ต้องเป๊ะ
 */
export function pickemScoreFor(
    predictedWinnerId: number,
    predictedScore: Record<string, number> | null,
    actualWinnerId: number,
    actualScore: Record<string, number> | null,
    tolerance: PickemTolerance,
): PickemScoreResult {
    /**
     * ★ ด่านแรกและสำคัญที่สุด (OD-56 มติข้อ ②) — ทายฝั่งผิด = 0 เสมอ
     *   ไม่ว่าสกอร์จะใกล้แค่ไหน · ห้ามย้ายด่านนี้ลงไปอยู่หลังการคิดโบนัส
     *
     *   เหตุผลไม่ใช่แค่เรื่องกติกา: กฎข้อนี้ทำให้ `points_earned > 0` ยังแปลว่า
     *   "ทายฝั่งถูก" ⇒ `SUM(points_earned > 0) AS correct` ใน E28/E29 และ
     *   `pickStatus()` won/lost ยังพูดความจริงอยู่ **ถ้าวันหนึ่งให้ฝั่งผิดได้แต้ม
     *   ต้องกลับไปแก้สองที่นั้นพร้อมกัน** ไม่งั้นโกหกเงียบ ๆ โดยไม่มีเทสไหนแดง
     */
    if (predictedWinnerId !== actualWinnerId) {
        return { points: 0, tier: 'wrong_side' };
    }

    // แถวเก่าก่อน migration 038 ไม่มีสกอร์ให้เทียบ — ได้คะแนนพื้น ไม่มีสิทธิ์ได้โบนัส
    // (ไม่ใช่การลงโทษ: ตอนนั้นระบบไม่ได้ขอสกอร์จากเขา)
    if (predictedScore === null || actualScore === null) {
        return { points: PICKEM_TIER_POINTS.side_only, tier: 'side_only' };
    }

    /**
     * ★ "ฝั่งที่แย่กว่า" ไม่ใช่ "ผลรวมสองฝั่ง" (เปลี่ยนใน migration 040)
     *
     *   ตัวเลขที่ตัดสินชั้น = ความคลาดของฝั่งที่คลาดมากสุด
     *   เช่น บาส ทาย 50-39 ได้จริง 52-45 → คลาด 2 กับ 6 → ยึด 6
     *        ด้วยเส้น (5 , 10) ⇒ 6 เกินเส้นเต็ม แต่ไม่เกินเส้นใกล้ ⇒ close
     *
     *   เหตุผลที่ไม่บวกกัน (เหตุผลเต็มอยู่ในหัว migration 040):
     *     ก) การบวกทำให้ค่า tolerance แปลไม่เหมือนกันระหว่าง "คลาดฝั่งเดียว" กับ "คลาดสองฝั่ง"
     *        ⇒ ยิ่งกีฬาแต้มสูง สองฝั่งยิ่งคลาดพร้อมกัน = ถูกลงโทษสองเท่าโดยไม่ตั้งใจ
     *     ข) ทาย 2-1 ได้จริง 3-2 (อ่านผลต่างถูกเป๊ะ) จะแย่กว่า 2-1 ได้จริง 3-1 (ผลต่างผิด)
     *        ถ้าใช้ผลรวม — กลับหัวกลับหาง
     *
     *   ★ นับทุก key ที่โผล่ในก้อนใดก้อนหนึ่ง ไม่ใช่วนแค่ก้อนที่ทาย — ถ้าสองก้อนมี key
     *     ไม่ตรงกัน (ซึ่งไม่ควรเกิด แต่ข้อมูลเก่า/ผลที่ถูกแก้มืออาจเพี้ยนได้)
     *     การวนแค่ก้อนเดียวจะมองข้ามส่วนต่างไปเงียบ ๆ แล้วแจกโบนัสผิด
     */
    const keys = new Set([...Object.keys(predictedScore), ...Object.keys(actualScore)]);
    let worstSideDrift = 0;
    for (const key of keys) {
        const drift = Math.abs((predictedScore[key] ?? 0) - (actualScore[key] ?? 0));
        if (drift > worstSideDrift) worstSideDrift = drift;
    }

    /**
     * บีบค่าให้ปลอดภัยก่อนใช้ — ฐานมี CHECK กันไว้แล้ว (chk_sport_pickem_tolerance)
     * แต่สูตรนี้รับค่าจากพารามิเตอร์ จึงกันเองอีกชั้นไม่ให้ค่าเพี้ยนทำชั้นหาย:
     *   - ติดลบ → ถือเป็น 0 (ไม่ให้ "ทายเป๊ะ" หลุดจากชั้นเต็ม)
     *   - close < exact → ยกให้เท่า exact (ไม่ให้ชั้นกลางถูกกลืนแบบไม่มีใครรู้)
     */
    const exactLimit = Math.max(0, tolerance.exact);
    const closeLimit = Math.max(exactLimit, tolerance.close);

    if (worstSideDrift <= exactLimit) {
        return { points: PICKEM_TIER_POINTS.spot_on, tier: 'spot_on' };
    }
    if (worstSideDrift <= closeLimit) {
        return { points: PICKEM_TIER_POINTS.close, tier: 'close' };
    }
    return { points: PICKEM_TIER_POINTS.side_only, tier: 'side_only' };
}
