import type { Response , Request } from 'express';
import * as authService from '../services/auth.service.js';

export async function register(req : Request , res : Response){
    res.status(201).json(await authService.register(req.body))
}

export async function login(req : Request , res : Response){
    res.status(200).json(await authService.login(req.body.email , req.body.password));
}

/**
 * 🔴 QA 30 ต.ค. 2569 (C3) — ออกจากระบบแล้ว token ต้องใช้ไม่ได้ · **แทนที่มติ BE-07 (7 ต.ค.)**
 *
 * เดิม (BE-07): ตั้งใจไม่ยกเลิก token ที่ฝั่งเซิร์ฟเวอร์ — logout แค่ตอบ 204 ⇒ token ใบเดิมใช้ต่อได้ 7 วัน
 *   ถ้ามีใครคัดลอกไปก่อน · ตอนนั้นไม่เลือก "บวก token_version" เพราะมันออกจาก **ทุกเครื่อง**
 *   ในขณะที่หน้าจอบอกแค่ "ออกจากระบบ"
 * ตอนนี้: เจ้าของงานเคาะ 30 ต.ค. ให้บวก `token_version` (ทาง ก เดิม) — ของมีครบแล้วตั้งแต่ B1
 *   (`requireAuth` เทียบเลขรุ่นทุกคำขออยู่แล้ว) · ข้อเสียเรื่อง "ทุกเครื่อง" แก้ที่ข้อความปุ่มฝั่ง FE
 * 🔴 ผลคือ **ออกจากระบบทุกเครื่องพร้อมกัน** — เป็นข้อจำกัดของวิธีนี้ ไม่ใช่บั๊ก
 * ★ "ออกเฉพาะเครื่องนี้" ต้องมี `jti` + ตาราง denylist (ทาง ข เดิม) — เกินขอบเขตรอบนี้
 * ★ requireAuth ผ่านแล้วแน่นอน (route ใส่ไว้) ⇒ token ใบนี้ยังถูกต้อง ณ ตอนกด
 */
export async function logout(req : Request , res : Response){
    await authService.logout(req.user!.user_id);
    res.status(204).send();
}

export async function verifyEmail(req : Request , res : Response){
    res.status(200).json(await authService.verifyEmail(req.body.email , req.body.code));
}

export async function resendVerification(req : Request , res : Response){
    res.status(200).json(await authService.resendEmailVerification(req.body.email));
}

export async function forgotPassword(req : Request , res : Response){
    res.status(200).json(await authService.forgotPassword(req.body.email));
}

export async function resetPassword(req : Request , res : Response){
    res.status(200).json(await authService.resetPassword(req.body.token , req.body.newPassword));
}