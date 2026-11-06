import * as z from 'zod';
import { MIN_STUDY_YEAR , MAX_STUDY_YEAR } from '../utils/studyYear.js';
import { isKuEmail } from '../utils/kuEmail.js';

/**
 * วันนี้ตามเวลาไทยในรูป YYYY-MM-DD
 * ★ เทียบเป็น **สตริง** ไม่ใช่ Date — `birthDate` เป็นวันที่ล้วน ถ้าแปลงเป็น Date จะกลายเป็น
 *   เที่ยงคืน UTC แล้วคนที่เกิดวันนี้จะถูกปฏิเสธช่วงเช้าเวลาไทย (เป็นบั๊กเวลาแบบเดียวกับที่เจอใน
 *   เทส tournament.create เมื่อ 7 ต.ค.) · เลื่อน +7 ชม. แล้วอ่านส่วนวันที่ = วันที่ของไทยตรง ๆ
 */
function todayInThailand(): string {
    return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0 , 10);
}

// แยกออกมาจาก registerSchema เพื่อใช้ร่วมกับ resetPasswordSchema — ห้าม copy กฎรหัสผ่านซ้ำ (TASK-password-recovery)
const passwordRule = z.string().refine(v => v.length >= 8 && /[0-9]/.test(v),
            'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีตัวเลขอย่างน้อย 1 ตัว');

const registerSchema = z.object({
    fullName : z.string().min(2, 'ชื่อ-นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร').max(100, 'ชื่อ-นามสกุลต้องไม่เกิน 100 ตัวอักษร'),
    email : z.email('รูปแบบอีเมลไม่ถูกต้อง'),
    password  : passwordRule,
    gender : z.enum(["male" , "female" , "other"], 'เพศต้องเป็น male, female หรือ other'),
    // 🔴 BE-05 — เดิมตรวจแค่รูปแบบ ⇒ สมัครด้วย birthDate 2030-01-01 ได้ โปรไฟล์ขึ้น "Age -4"
    //    และอายุติดลบนั้นถูกใช้ตัดสิน Hard Filter (min_age/max_age) จริง
    birthDate : z.iso.date('รูปแบบวันเกิดไม่ถูกต้อง ต้องเป็น YYYY-MM-DD')
        .refine(v => v <= todayInThailand() , 'วันเกิดต้องไม่อยู่ในอนาคต'),
    // 🔴 มติ 8 ต.ค. 2569 — สามช่องนี้บังคับ **เฉพาะคนในมหาวิทยาลัย**
    //   ของเดิมบังคับทุกคน ⇒ คนนอกที่ไม่มีคณะ/ภาควิชา/ชั้นปี **สมัครไม่ได้เลย**
    //   (คอลัมน์ในฐานเป็น NULL ได้มาตั้งแต่ schema.sql:62-64 แล้ว — ที่บังคับไว้คือชั้นนี้ชั้นเดียว)
    //   ★ FE: อีเมล @ku.th ⇒ พาไปหน้าสมัครขั้นสองเพื่อกรอกสามช่องนี้ แล้วค่อยยิงครั้งเดียวตอนจบ
    facultyId : z.int('รหัสคณะต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกคณะ').optional(),
    departmentId : z.int('รหัสภาควิชาต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกภาควิชา').optional(),
    // 🔴 BE-05 — เดิม positive() เฉย ๆ ⇒ ชั้นปี 99 สมัครได้ · ใช้กฎกลางตัวเดียวกับกฎคุณสมบัติ
    year : z.int('ชั้นปีต้องเป็นจำนวนเต็ม')
        .min(MIN_STUDY_YEAR , `ชั้นปีต้องอยู่ระหว่าง ${MIN_STUDY_YEAR}–${MAX_STUDY_YEAR}`)
        .max(MAX_STUDY_YEAR , `ชั้นปีต้องอยู่ระหว่าง ${MIN_STUDY_YEAR}–${MAX_STUDY_YEAR}`)
        .optional()
})
/**
 * คนใน (@ku.th) ต้องกรอกคณะ · ภาควิชา · ชั้นปี ให้ครบ
 *
 * ★ ใช้ `isKuEmail` ตัวเดียวกับที่ service ใช้เขียน `user_type` — ห้ามเขียนกฎโดเมนซ้ำที่นี่
 *   ไม่งั้นวันหนึ่งจะมีคนแก้ลิสต์โดเมนที่เดียว แล้ว "ต้องกรอกไหม" กับ "เป็นคนในไหม"
 *   ตอบไม่เหมือนกันแบบเงียบ ๆ (เหตุผลเดียวกับที่ `kuEmail.ts` อยู่ใน utils/)
 * ★ ข้อความเท่าเดิมทุกช่อง และยิง issue แยกต่อช่อง ⇒ รูป `{ fields: {...} }` ที่ FE ใช้ไม่เปลี่ยน
 */
.superRefine((val , ctx) => {
    if(!isKuEmail(val.email)) return;
    const required = [
        ['facultyId' , val.facultyId , 'กรุณาเลือกคณะ'] ,
        ['departmentId' , val.departmentId , 'กรุณาเลือกภาควิชา'] ,
        ['year' , val.year , 'กรุณาเลือกชั้นปี'] ,
    ] as const;
    for(const [path , value , message] of required){
        if(value === undefined) ctx.addIssue({ code : 'custom' , path : [path] , message });
    }
});

const loginSchema = z.object({
    email : z.email('รูปแบบอีเมลไม่ถูกต้อง'),
    password  : z.string()
});

const forgotPasswordSchema = z.object({
    email : z.email('รูปแบบอีเมลไม่ถูกต้อง')
});

// OD-53 — code เป็น string ไม่ใช่ number โดยเจตนา: เลขที่ขึ้นต้นด้วยศูนย์ (007431) ต้องใช้ได้
// ถ้าเป็น number ค่า 007431 จะกลายเป็น 7431 แล้วเทียบ hash ไม่ผ่านทั้งที่ผู้ใช้กรอกถูก
const verifyEmailSchema = z.object({
    email : z.email('รูปแบบอีเมลไม่ถูกต้อง'),
    code  : z.string().regex(/^[0-9]{6}$/ , 'รหัสยืนยันต้องเป็นตัวเลข 6 หลัก')
});

const resendVerificationSchema = z.object({
    email : z.email('รูปแบบอีเมลไม่ถูกต้อง')
});

const resetPasswordSchema = z.object({
    token : z.string().min(1, 'กรุณาระบุ token'),
    newPassword : passwordRule
});

export { registerSchema , loginSchema , forgotPasswordSchema , resetPasswordSchema , verifyEmailSchema , resendVerificationSchema };
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
