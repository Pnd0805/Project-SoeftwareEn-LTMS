import type { Response , Request } from 'express';
import * as authService from '../services/auth.service.js';

export async function register(req : Request , res : Response){
    res.status(201).json(await authService.register(req.body))
}

export async function login(req : Request , res : Response){
    res.status(200).json(await authService.login(req.body.email , req.body.password));
}

/**
 * BE-07 (มติ 7 ต.ค. 2569 ข้อ ⑮ ง) — **ตั้งใจไม่ยกเลิก token ที่ฝั่งเซิร์ฟเวอร์**
 *
 * `POST /auth/logout` คือการบอกให้ฝั่ง client ทิ้ง token ของตัวเอง เซิร์ฟเวอร์ไม่ทำอะไร
 * ⇒ token ใบเดิมยังใช้ได้จนหมดอายุ (7 วัน) ถ้ามีใครคัดลอกไปก่อน
 *
 * ทางเลือกที่พิจารณาแล้วและเหตุผลที่ไม่เลือก (ประชุม 7 ต.ค.)
 *   ก bump `token_version` ตอน logout — ของมีอยู่แล้วตั้งแต่ B1 ⇒ ฟรี
 *     แต่ `token_version` เป็นเลขต่อ**ผู้ใช้** ไม่ใช่ต่อ**เครื่อง** ⇒ กด logout ที่มือถือ
 *     แล้วหลุดจากคอมพิวเตอร์ด้วย · เท่ากับฟื้น "ออกจากระบบทุกเครื่อง" ที่ทีมตัดทิ้งไปแล้ว
 *     ในรูปที่แย่กว่า เพราะผู้ใช้ไม่ได้ขอ
 *   ข ใส่ `jti` ใน token + ตาราง denylist — ถูกต้องตามความคาดหวังของผู้ใช้
 *     แต่ต้อง migration + อ่านฐานเพิ่มทุก request ที่ต้องล็อกอิน
 *   ค ลด TTL + refresh token — แก้ที่รากที่สุด แต่เป็นงานใหญ่และ FE ต้องแก้ด้วย
 *
 * 🔴 ถ้าจะทำจริง ให้ไปทาง **ข** — ห้ามไปทาง ก เพราะมันเปลี่ยนความหมายของปุ่ม
 *   จาก "ออกจากเครื่องนี้" เป็น "ออกจากทุกเครื่อง" โดยที่หน้าจอไม่ได้บอกผู้ใช้
 * ★ สิ่งที่ยังจริงอยู่: เปลี่ยนรหัสผ่านแล้ว token เก่าทุกใบใช้ไม่ได้ทันที (B1, migration 046)
 *   ⇒ บัญชีที่สงสัยว่าหลุดยังกู้ได้ด้วยการตั้งรหัสใหม่
 */
export async function logout(req : Request , res : Response){
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