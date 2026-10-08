/**
 * ชั้นปีที่ระบบรองรับ — 1 ถึง 8 (มติ 20 ก.ย. 2569 Q1-ค)
 *
 * 🔴 แก้ 7 ต.ค. 2569 (BE-05 · FE-08) — เดิมเลข 8 ฮาร์ดโค้ดอยู่ที่ `normalizeEligibilityRules`
 *   ที่เดียว ส่วนตอนสมัครสมาชิกรับ `positive()` เฉย ๆ ⇒ สมัครด้วยชั้นปี 99 ได้ และค่านั้น
 *   ไปโผล่ที่ Hard Filter ของทุกทัวร์ โดยผู้ใช้แก้เองไม่ได้ (โปรไฟล์ขึ้น "Year 99")
 *
 * ★ อยู่ใน utils/ เพราะต้องใช้ทั้งใน **schema** (ตอนสมัคร) และใน **service** (ตอนตั้งกฎคุณสมบัติ)
 *   schema เรียก service ไม่ได้ตามการแบ่งชั้นของโปรเจกต์ ⇒ กฎร่วมต้องอยู่ที่นี่
 *   ห้ามเขียนเลข 1/8 ซ้ำที่อื่น — ถ้าหลักสูตรยาวกว่านี้ต้องแก้ไฟล์นี้ไฟล์เดียว
 */
export const MIN_STUDY_YEAR = 1;
export const MAX_STUDY_YEAR = 8;

export function isStudyYear(value : number): boolean {
    return Number.isInteger(value) && value >= MIN_STUDY_YEAR && value <= MAX_STUDY_YEAR;
}
