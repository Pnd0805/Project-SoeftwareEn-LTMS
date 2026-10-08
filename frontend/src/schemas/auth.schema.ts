/**
 * src/schemas/auth.schema.ts
 * ก็อปกฎมาจาก GUIDE/04 §6 (schemas/auth.schema.ts ฝั่ง backend) ตรงเป๊ะ
 * เจตนา: frontend เช็คไว-ให้ user feedback ทันที / backend เช็คซ้ำเสมอ (ห้ามเชื่อ client)
 * ข้อความ error ใช้ภาษาไทยตาม NF-US-03 เหมือนฝั่ง backend
 */
import { z } from "zod";
import { GenderEnum } from "../types/enums";

// เทียบวันล้วนตามเวลาไทย เช่นเดียวกับ backend ไม่แปลงวันเกิดเป็นเที่ยงคืน UTC
export function todayInThailand(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

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
  birthDate: z.iso.date("Enter a valid birth date.")
    .refine(value => value <= todayInThailand(), "Birth date cannot be in the future."),
  facultyId: z.number().int().positive({ message: "กรุณาเลือกคณะ" }),
  departmentId: z.number().int().positive({ message: "กรุณาเลือกภาควิชา" }),
  year: z.number().int("Enter a whole year.").min(1, "Year must be 1–8.").max(8, "Year must be 1–8."),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const verificationEmailSchema = z.string().email("Enter a valid email.");
export const verifyEmailSchema = z.object({
  email: verificationEmailSchema,
  code: z.string().regex(/^[0-9]{6}$/, "Enter a 6-digit code."),
});

// GUIDE/04 §6: loginSchema ห้ามใส่กฎความยาวรหัสผ่าน — คนสมัครไว้ก่อนกฎเปลี่ยนจะล็อกอินไม่ได้
export const loginSchema = z.object({
  email: z.string().email({ message: "รูปแบบอีเมลไม่ถูกต้อง" }),
  password: z.string().min(1, { message: "กรุณากรอกรหัสผ่าน" }),
});
export type LoginInput = z.infer<typeof loginSchema>;
