import * as z from 'zod';

// แยกออกมาจาก registerSchema เพื่อใช้ร่วมกับ resetPasswordSchema — ห้าม copy กฎรหัสผ่านซ้ำ (TASK-password-recovery)
const passwordRule = z.string().refine(v => v.length >= 8 && /[0-9]/.test(v),
            'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีตัวเลขอย่างน้อย 1 ตัว');

const registerSchema = z.object({
    fullName : z.string().min(2, 'ชื่อ-นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร').max(100, 'ชื่อ-นามสกุลต้องไม่เกิน 100 ตัวอักษร'),
    email : z.email('รูปแบบอีเมลไม่ถูกต้อง'),
    password  : passwordRule,
    gender : z.enum(["male" , "female" , "other"], 'เพศต้องเป็น male, female หรือ other'),
    birthDate : z.iso.date('รูปแบบวันเกิดไม่ถูกต้อง ต้องเป็น YYYY-MM-DD'),
    facultyId : z.int('รหัสคณะต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกคณะ'),
    departmentId : z.int('รหัสภาควิชาต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกภาควิชา'),
    year : z.int('ชั้นปีต้องเป็นจำนวนเต็ม').positive('กรุณาระบุชั้นปี')
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
