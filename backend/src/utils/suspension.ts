/**
 * การระงับบัญชี — แหล่งความจริงแห่งเดียวของคำว่า "ตอนนี้ถูกระงับอยู่ไหม" (มติ 1 ต.ค. 2569)
 *
 * ตั้งแต่ migration 033 การระงับมีสองแบบในคอลัมน์เดียวกัน
 *   is_suspended = 1 , suspended_until = NULL   → ถาวร รอแอดมินปลด (พฤติกรรมเดิมทั้งหมด)
 *   is_suspended = 1 , suspended_until = เวลา   → พ้นเองเมื่อถึงเวลา
 *
 * ระบบนี้ไม่มี cron (หลักเดียวกับ TM-07 ที่กวาดทีมตอนอ่าน) จึง **ไม่มีอะไรมาล้างธงให้**
 * ⇒ is_suspended ค้างเป็น 1 ได้ทั้งที่พ้นแล้ว · การอ่าน `is_suspended = 0` ตรงๆ จะบอกว่าคนที่พ้นโทษแล้ว
 *   ยังถูกระงับอยู่ ซึ่งอันตรายที่สุดกับ countActiveUniversityWideAdmins — ระบบจะคิดว่าไม่เหลือแอดมิน
 *
 * ทุก query ใหม่ที่ถามถึงสถานะระงับต้องใช้ตัวช่วยในไฟล์นี้ ห้ามเขียนเงื่อนไขเองซ้ำ
 */

/** เพดานของการระงับแบบมีกำหนด — ยาวกว่านี้ให้ใช้ถาวรไปเลย จะได้ไม่มี "ถาวรที่แอบซ่อนอยู่ในรูปของ 3650 วัน" */
export const MAX_SUSPENSION_DAYS = 90;

/** SQL: แถวนี้ถูกระงับอยู่ *ตอนนี้* — ใช้คู่กับ alias ของตาราง users ใน query นั้น */
export function suspendedSql(alias : string) : string{
    return `(${alias}.is_suspended = 1 AND (${alias}.suspended_until IS NULL OR ${alias}.suspended_until > NOW()))`;
}

/** SQL: แถวนี้ใช้งานได้ตอนนี้ (ไม่ถูกระงับ หรือถูกระงับแต่พ้นกำหนดแล้ว) */
export function notSuspendedSql(alias : string) : string{
    return `NOT ${suspendedSql(alias)}`;
}

/** TS: เทียบกับ Date.now() ของเครื่อง app — ยอมรับความคลาดเคลื่อนระดับวินาทีกับ NOW() ของ MySQL ได้ เพราะหน่วยคือวัน */
export function isCurrentlySuspended(row : { is_suspended : number , suspended_until : Date | null }) : boolean{
    if(row.is_suspended !== 1) return false;
    return row.suspended_until === null || row.suspended_until.getTime() > Date.now();
}

/** แปลงจำนวนวันเป็นเวลาสิ้นสุด · undefined = ถาวร (คืน null ให้ลงคอลัมน์ได้ตรงๆ) */
export function suspensionEndsAt(days : number | undefined) : Date | null{
    if(days === undefined) return null;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
