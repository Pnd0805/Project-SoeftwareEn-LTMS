import { AppError } from './AppError.js';

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

/**
 * ประเภทของโทษที่ **ส่งให้เจ้าตัวเห็น** (มติ 1 ต.ค. 2569 · OD-40 ทางเลือก ข)
 *
 * แยกจาก `suspended_reason` ที่แอดมินพิมพ์ ซึ่งยังเป็นบันทึกภายในและไม่ส่งออกไปไหน —
 * ตอนแอดมินพิมพ์ช่องนั้น เขาเขียนให้แอดมินคนถัดไปอ่าน ไม่ได้เขียนให้คู่กรณีอ่าน
 * การส่งออกทีหลังคือการเปลี่ยนความหมายของข้อมูลที่เก็บมาแล้วย้อนหลัง จึงใช้ชุดปิดที่เขียนถ้อยคำไว้ก่อนแทน
 *
 * ถ้อยคำอยู่ที่นี่ที่เดียว · `other` ตั้งใจให้กว้างแต่ไม่ว่างเปล่า — คนอ่านต้องรู้ว่ามีกฎข้อหนึ่งถูกละเมิด
 * แม้จะไม่รู้ข้อไหน · เพิ่มประเภทใหม่ต้องแก้ทั้งที่นี่และ ENUM ในฐาน (migration ใหม่) โดยเจตนา
 */
export const SUSPENSION_CATEGORIES = {
    abusive_language  : 'ใช้ถ้อยคำไม่เหมาะสมหรือคุกคามผู้อื่น',
    cheating          : 'ทุจริตในการแข่งขันหรือบิดเบือนผลการแข่งขัน',
    false_information : 'ให้ข้อมูลเท็จหรือสวมรอยเป็นผู้อื่น',
    spam              : 'ก่อกวนระบบหรือส่งข้อความรบกวนซ้ำ',
    other             : 'ละเมิดกฎการใช้งานระบบ',
} as const;

export type SuspensionCategory = keyof typeof SUSPENSION_CATEGORIES;

export const SUSPENSION_CATEGORY_KEYS = Object.keys(SUSPENSION_CATEGORIES) as [SuspensionCategory , ...SuspensionCategory[]];

/** แถวเก่าก่อน migration 034 เป็น NULL — คืน null ไม่ใช่ข้อความเดา */
export function suspensionCategoryLabel(category : SuspensionCategory | null) : string | null{
    return category === null ? null : SUSPENSION_CATEGORIES[category];
}

/**
 * ข้อความของ `403 ACCOUNT_SUSPENDED` — ต่อประเภทเข้าไปให้เมื่อรู้
 * client ที่แสดงแค่ `message` (ซึ่งมีอยู่จริง) จึงได้ประโยชน์โดยไม่ต้องแก้อะไร
 * ส่วน client ที่อ่าน `extra` ได้ ก็ประกอบข้อความเองได้ละเอียดกว่า
 */
export function suspendedMessage(category : SuspensionCategory | null) : string{
    const label = suspensionCategoryLabel(category);
    return label === null
        ? 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ'
        : `บัญชีนี้ถูกระงับการใช้งานเนื่องจาก${label} กรุณาติดต่อผู้ดูแลระบบ`;
}

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

/**
 * `403` ตัวเดียวที่ทั้ง `requireAuth` และ `login` ใช้ร่วมกัน
 * สองด่านนี้ต้องตอบเหมือนกันเป๊ะ ไม่งั้นผู้ใช้เห็นข้อความคนละอย่างจากสองทาง
 * แล้วเดาว่าการล็อกอินสำเร็จกว่าการเรียก API ซึ่งไม่จริง
 */
export function suspendedError(row : { suspended_category : SuspensionCategory | null , suspended_until : Date | null }) : AppError{
    return new AppError(403 , 'ACCOUNT_SUSPENDED' , suspendedMessage(row.suspended_category) , {
        suspendedUntil    : row.suspended_until?.toISOString() ?? null,
        suspendedCategory : row.suspended_category,
        suspendedCategoryLabel : suspensionCategoryLabel(row.suspended_category),
    });
}
