import * as z from 'zod';

const registerSchema = z.object({
    fullName : z.string().min(2, 'ชื่อ-นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร').max(100, 'ชื่อ-นามสกุลต้องไม่เกิน 100 ตัวอักษร'),
    email : z.email('รูปแบบอีเมลไม่ถูกต้อง'),
    password  : z.string().refine(v => v.length >= 8 && /[0-9]/.test(v),
                'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีตัวเลขอย่างน้อย 1 ตัว'),
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

export { registerSchema , loginSchema };
export type RegisterInput = z.infer<typeof registerSchema>;
