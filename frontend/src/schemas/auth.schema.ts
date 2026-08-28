/**
 * src/schemas/auth.schema.ts
 * ก็อปกฎมาจาก GUIDE/04 §6 (schemas/auth.schema.ts ฝั่ง backend) ตรงเป๊ะ
 * เจตนา: frontend เช็คไว-ให้ user feedback ทันที / backend เช็คซ้ำเสมอ (ห้ามเชื่อ client)
 * ข้อความ error ใช้ภาษาไทยตาม NF-US-03 เหมือนฝั่ง backend
 */
import { z } from "zod";
import { GenderEnum } from "../types/enums";

export const registerSchema = z.object({
  fullName: z
    .string()
    .min(2, { message: "ชื่อ-นามสกุลต้องมี 2-100 ตัวอักษร" })
    .max(100, { message: "ชื่อ-นามสกุลต้องมี 2-100 ตัวอักษร" }),
  email: z.string().email({ message: "รูปแบบอีเมลไม่ถูกต้อง" }),
  password: z
    .string()
    .min(8, { message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีตัวเลขอย่างน้อย 1 ตัว" })
    .regex(/\d/, { message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีตัวเลขอย่างน้อย 1 ตัว" }),
  gender: GenderEnum,
  // "YYYY-MM-DD" ตรงกับ birth_date DATE ในฝั่ง backend — ห้ามส่ง Date object
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "รูปแบบวันเกิดไม่ถูกต้อง (YYYY-MM-DD)" }),
  facultyId: z.number().int().positive({ message: "กรุณาเลือกคณะ" }),
  departmentId: z.number().int().positive({ message: "กรุณาเลือกภาควิชา" }),
  year: z.number().int().positive({ message: "กรุณาระบุชั้นปี" }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// GUIDE/04 §6: loginSchema ห้ามใส่กฎความยาวรหัสผ่าน — คนสมัครไว้ก่อนกฎเปลี่ยนจะล็อกอินไม่ได้
export const loginSchema = z.object({
  email: z.string().email({ message: "รูปแบบอีเมลไม่ถูกต้อง" }),
  password: z.string().min(1, { message: "กรุณากรอกรหัสผ่าน" }),
});
export type LoginInput = z.infer<typeof loginSchema>;
