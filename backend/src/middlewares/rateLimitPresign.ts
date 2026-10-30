import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';

/**
 * 🔴 QA 30 ต.ค. 2569 (D1 · ทางเบา) — จำกัดจำนวนครั้งที่ขอลิงก์อัปโหลด (`POST /uploads/presign`) ต่อผู้ใช้
 *
 * เดิมเส้นนี้มีแค่ `requireAuth` ⇒ สคริปต์ขอลิงก์ได้ไม่จำกัด แล้วอัปโหลดไฟล์ตรงเข้า MinIO จนดิสก์เต็ม
 * ⇒ ชั้นนี้กัน "จำนวนครั้ง" · ชั้นที่กัน "ดิสก์เต็มจนทั้งระบบพัง" จริงคือโควตาของ bucket (`mc quota set` · DEPLOY.md)
 *
 * 🔴 สิ่งที่ทางนี้ **ไม่ได้** แก้: ไฟล์เดียวขนาดใหญ่มากยังอัปได้ (ลิงก์แบบ PUT จำกัดขนาดไม่ได้)
 *    เพดานต่อไฟล์ต้องเปลี่ยนเป็น presigned POST ⇒ FE รื้อการอัปโหลด 25 จุด — เลื่อนไป future scope (OPEN_DECISIONS)
 *    nginx ช่วยไม่ได้: มัน proxy แค่ `/api/` ส่วนการอัปโหลดยิงจากเบราว์เซอร์ตรงไป MinIO
 *
 * ═══ ต่างจาก rateLimitLogin โดยเจตนา (อ่านหัวไฟล์นั้นก่อน — ข้อจำกัดเรื่องเก็บในหน่วยความจำเหมือนกันทุกข้อ) ═══
 * ★ คีย์เป็น `user_id` ไม่ใช่ IP — เส้นนี้ต้องล็อกอินอยู่แล้ว และ IP ของเครือข่ายมหาวิทยาลัยใช้ร่วมกันทั้งตึก
 * ★ นับ **ทุกคำขอ** ไม่ใช่เฉพาะที่ล้มเหลว — คำขอที่สำเร็จนั่นแหละคือสิ่งที่ต้องจำกัด
 * ★ หน้าต่างคงที่ 1 ชม. นับจากคำขอแรก (แบบเดียวกับ rateLimitLogin) · 30 ครั้ง = เผื่อคนอัปรูปหลายใบจริง แต่กันสคริปต์
 */
export const PRESIGN_WINDOW_MS = 60 * 60 * 1000;
export const MAX_PRESIGN_PER_USER = 30;

type Bucket = { count : number; resetAt : number };
const buckets = new Map<number, Bucket>();

/** ★ ไม่มี scheduler — เก็บกวาดตรงจังหวะที่มีคนมาใช้งาน (รูปแบบเดียวกับ rateLimitLogin) */
function sweep(now : number): void {
    if (buckets.size < 1000) return;
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
    }
}

/** ให้เทสล้างสถานะระหว่างเคสได้ — ตัวนับอยู่ในโมดูล ไม่ใช่ในคำขอ */
export function resetPresignRateLimit(): void {
    buckets.clear();
}

/** ต้องอยู่หลัง requireAuth — ใช้ req.user */
export function rateLimitPresign(req : Request, res : Response, next : NextFunction): void {
    const now = Date.now();
    sweep(now);
    const userId = req.user!.user_id;

    let bucket = buckets.get(userId);
    if (!bucket || bucket.resetAt <= now) {
        bucket = { count : 0, resetAt : now + PRESIGN_WINDOW_MS };
        buckets.set(userId, bucket);
    }
    if (bucket.count >= MAX_PRESIGN_PER_USER) {
        const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        res.setHeader('Retry-After', String(retryAfterSeconds));
        next(new AppError(429, 'TOO_MANY_UPLOADS',
            `ขอลิงก์อัปโหลดได้ไม่เกิน ${MAX_PRESIGN_PER_USER} ครั้งต่อชั่วโมง กรุณารอแล้วลองใหม่`,
            { retryAfterSeconds }));
        return;
    }
    bucket.count += 1;
    next();
}
