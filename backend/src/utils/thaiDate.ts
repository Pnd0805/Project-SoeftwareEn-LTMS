/**
 * "วันที่ตามเวลาไทย" — ที่เดียวของทั้ง backend (31 ต.ค. 2569)
 *
 * 🔴 ปัญหาที่เจอซ้ำหลายรอบ: pool ตั้ง `time_zone = '+00:00'` (config/db.ts) ⇒ `CURDATE()` / `toISOString().slice(0, 10)`
 *   ให้วันที่แบบ **UTC** ⇒ ช่วง 00:00–06:59 ตามเวลาไทย ระบบยังคิดว่าเป็น "เมื่อวาน"
 *   เช่นทัวร์ที่เริ่มวันที่ 31 ถูกนับว่า "ถึงวันแข่ง" ตอน 07:00 ของวันที่ 31 ไม่ใช่ 00:00
 * ★ เวลาไทยคงที่ UTC+7 (ไม่มีเวลาออมแสง) ⇒ บวก 7 ชม. แล้วตัดวันได้ตรง ๆ
 * ★ คอลัมน์ DATE (event_start_date ฯลฯ) เป็น "วันตามปฏิทินไทย" ที่ผู้จัดกรอก ⇒ ต้องเทียบกับวันไทยเสมอ
 *   ส่วนการเทียบ "จุดเวลา" กับ DATETIME (เช่น registration_end <= NOW()) ถูกอยู่แล้ว ไม่ต้องใช้ตัวนี้
 */
export const THAI_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** วันที่ไทย (YYYY-MM-DD) ของจุดเวลานี้ */
export function thaiDateOf(value: Date | number): string {
    const ms = value instanceof Date ? value.getTime() : value;
    return new Date(ms + THAI_OFFSET_MS).toISOString().slice(0, 10);
}

/** วันที่ไทยของ "วันนี้ + days วัน" — ใช้เป็นพารามิเตอร์แทน `CURDATE() + INTERVAL ? DAY` */
export function thaiDatePlusDays(now: Date | number, days: number): string {
    const ms = now instanceof Date ? now.getTime() : now;
    return thaiDateOf(ms + days * DAY_MS);
}
