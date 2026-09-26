import { SUBMIT_ESCALATION_HOURS } from '../config/scoring.js';
import type { MatchRow } from '../types/db.js';

/**
 * OD-26 ข้อ 6 — แมตช์จบมานานพอจะเปิด "บันไดสำรอง" แล้วหรือยัง
 * ขั้นแรก กรรมการของแมตช์ส่งผลแทนได้ (รวมโหมด online ที่ปกติส่งไม่ได้) · ขั้นสอง ผู้จัดตัดสินเอง
 *
 * อยู่ใน utils ไม่ใช่ใน service เพราะทั้ง middleware (ด่านส่งผล) และ service (ทางของผู้จัด) ต้องใช้
 * ถ้าวางไว้ใน service จะเกิด import วนกันระหว่าง middleware กับ service
 * ยังไม่ได้กดจบการแข่งขัน = ยังไม่มีเวลาจบจริง = นาฬิกายังไม่เริ่มเดิน
 */
export function isSubmitEscalationOpen(match: Pick<MatchRow, 'actual_end_time'>): boolean {
    if (!match.actual_end_time) return false;   // ยังไม่กดจบการแข่งขัน = นาฬิกายังไม่เริ่มเดิน
    return Date.now() >= match.actual_end_time.getTime() + SUBMIT_ESCALATION_HOURS * 3600 * 1000;
}
