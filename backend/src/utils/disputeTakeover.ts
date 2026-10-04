import { ORG_RESOLVE_HOURS } from '../config/scoring.js';

/**
 * OD-58 (4 ต.ค. 2569) — เส้นเวลา "แอดมินมหาวิทยาลัยเข้ามารับช่วงตัดสินข้อโต้แย้งได้"
 *
 * ★ อยู่ที่นี่เพราะมี **สองที่** ที่ต้องตอบคำถามเดียวกันให้ตรงกันเป๊ะ
 *     requireCanResolveDispute  (middleware) — ด่าน "กดตัดสินได้มั้ย"
 *     canSeeUnfinishedResult    (service)    — ด่าน "อ่านเรื่องได้มั้ย"
 *   ถ้าคำนวณเวลาแยกกันสองที่ แล้ววันหนึ่งมีคนแก้ที่เดียว จะได้ระบบที่
 *   **อ่านได้แต่กดไม่ได้** หรือ **กดได้แต่อ่านไม่ได้** ซึ่งเป็นบั๊กที่ไม่มี error ฟ้อง
 *   (อย่างหลังคือสิ่งที่เกิดขึ้นจริงก่อน OD-58 — FE แจ้งมาเมื่อ 1 ต.ค.)
 *
 * ไม่ตอบ "เป็นแอดมินมั้ย" — คนละคำถาม คนเรียกถาม AdminRepo เอง
 */

/** เวลาที่พ้นแล้วแอดมินเข้ามาแทนได้ · `null` = ยังไม่มีข้อโต้แย้ง จึงไม่มีอะไรให้รับช่วง */
export function adminTakeoverOpensAt(disputeRaisedAt : Date | null): Date | null {
    if(disputeRaisedAt === null) return null;
    return new Date(disputeRaisedAt.getTime() + ORG_RESOLVE_HOURS * 3600 * 1000);
}

/**
 * ถึงเวลาที่แอดมินรับช่วงได้แล้วหรือยัง
 *
 * ★ **ไม่เช็คว่าเรื่องถูกตัดสินไปแล้วหรือยัง** โดยเจตนา — ให้ตรงกับ `requireCanResolveDispute`
 *   ที่ดูแค่ `dispute_raised_at` กับเวลา · ถ้าจะแคบลงต้องแคบทั้งสองที่พร้อมกัน
 *   ไม่ใช่ให้ด่านอ่านกับด่านกดตอบไม่เหมือนกันอีก
 */
export function isAdminTakeoverOpen(disputeRaisedAt : Date | null, now : number = Date.now()): boolean {
    const openAt = adminTakeoverOpensAt(disputeRaisedAt);
    return openAt !== null && now >= openAt.getTime();
}
