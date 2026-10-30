import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';

/**
 * QA 30 ต.ค. 2569 ข้อ 1 — จำกัดจำนวนคำขอที่ทำให้ระบบ "ส่งอีเมลออก"
 *
 * เดิมมีตัวจำกัดแค่ `POST /auth/login` ตัวเดียวในทั้งไฟล์ `auth.routes.ts`
 * ส่วนสามเส้นที่ส่งอีเมลจริงไม่มีอะไรกันเลย:
 *   `/auth/register` · `/auth/resend-verification` · `/auth/forgot-password`
 * (`resend-verification` มีเพดาน 3 ครั้ง/ชม. **ต่อบัญชี** อยู่ในชั้น service — กันยิงใส่คนคนเดียวได้
 *  แต่กันการสมัครด้วยอีเมลใหม่ไปเรื่อย ๆ ไม่ได้ เพราะทุกคำขอเป็นคนละบัญชี)
 *
 * ⇒ สคริปต์สั้น ๆ ยิง `register` ด้วยอีเมลสุ่มรัว ๆ ทำให้:
 *   ① **โควตาส่งอีเมลของผู้ให้บริการหมดทั้งวัน** ⇒ OTP · ลืมรหัสผ่าน · แจ้งเตือน ส่งไม่ออกทั้งระบบ
 *   ② อีเมลปลอมส่วนใหญ่ตีกลับ ⇒ อัตรา bounce สูง ⇒ **บัญชีผู้ส่งถูกระงับได้**
 *   ③ ตอนด่านยืนยันอีเมลปิด งานกวาดบัญชีไม่ทำงาน ⇒ บัญชีขยะค้างในตาราง `users` ถาวร
 *
 * ═══ ข้อจำกัดที่ยอมรับแล้ว (เหมือน rateLimitLogin ทุกข้อ) ═══
 * 🔴 เก็บในหน่วยความจำของ process ⇒ รีสตาร์ทแล้วตัวนับหาย · หลาย process จะคูณเพดาน
 *    ยอมรับได้ในขอบเขตโครงงานนี้ที่รัน process เดียวและไม่มี redis
 *
 * ★ **นับทุกคำขอ ไม่ใช่เฉพาะที่ล้มเหลว** — ต่างจาก `rateLimitLogin` โดยเจตนา
 *   เพราะคำขอที่ "สำเร็จ" นี่แหละคือสิ่งที่ทำให้อีเมลถูกส่งออก ⇒ สิ่งที่ต้องจำกัด
 *
 * ★ คีย์เป็น **IP อย่างเดียว** ไม่ใช่ (IP, อีเมล) — ตรงข้ามกับ rateLimitLogin โดยเจตนา
 *   การโจมตีที่แพงที่สุดคือ "อีเมลใหม่ทุกครั้ง" ⇒ เพดานต่อคู่จับไม่ได้เลยเพราะไม่มีคู่ไหนซ้ำ
 *   🔴 ผลข้างเคียงที่ยอมรับ: เครือข่ายมหาวิทยาลัยทำ NAT ออกไอพีเดียวทั้งตึก
 *      ⇒ **โควตานี้คนทั้งตึกใช้ร่วมกัน** เพดานจึงต้องหลวมพอที่คนทั้งห้องสมัครพร้อมกันไม่ชน
 *
 * ★ ที่มาของเลข 50 (ผู้ใช้เคาะ 30 ต.ค.) — ของเดิมคือ "ไม่จำกัดเลย"
 *   ⇒ 20 กับ 50 ต่างกันแทบไม่มีผลกับฝั่งคนร้าย (ตัดกำลังจากหลักหมื่นเหลือหลักสิบเท่ากัน)
 *     แต่ต่างกันมากกับผู้ใช้จริงที่ใช้เน็ตร่วมกัน เช่นวันสาธิตที่ทั้งห้องสมัครพร้อมกัน
 *   🔴 ห้ามลดกลับโดยไม่คิดถึง NAT — คนที่ 21 ของตึกจะสมัครไม่ได้ และหาสาเหตุไม่เจอ
 */

const WINDOW_MS = 60 * 60 * 1000;
/**
 * ต่อ IP รวมทุกเส้นที่ส่งอีเมล · หลวมเพราะ NAT — มีไว้ตัดกำลังสคริปต์ ไม่ใช่กันคนพิมพ์ผิด
 * ★ export ให้เทสใช้ค่าเดียวกัน — ไม่งั้นวันที่ปรับเลข เทสจะยังนับเลขเก่าแล้วแดงโดยไม่มีบั๊กจริง
 */
export const MAX_PER_IP = 50;

type Bucket = { count : number; resetAt : number };
const buckets = new Map<string, Bucket>();

/** ★ ไม่มี scheduler — เก็บกวาดตรงจังหวะที่มีคนมาใช้งาน (รูปแบบเดียวกับ rateLimitLogin) */
function sweep(now : number): void {
    if (buckets.size < 1000) return;
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
    }
}

/** ให้เทสล้างสถานะระหว่างเคสได้ — ตัวนับอยู่ในโมดูล ไม่ใช่ในคำขอ */
export function resetEmailRateLimit(): void {
    buckets.clear();
}

export function rateLimitEmail(req : Request, _res : Response, next : NextFunction): void {
    const now = Date.now();
    sweep(now);

    // `req.ip` ถูกต้องเพราะตั้ง `trust proxy` แล้ว (bug hunt 30 ต.ค. ข้อ 1)
    const key = `ip:${req.ip ?? 'unknown'}`;
    const existing = buckets.get(key);
    const bucket = existing && existing.resetAt > now ? existing : { count : 0, resetAt : now + WINDOW_MS };
    buckets.set(key, bucket);

    if (bucket.count >= MAX_PER_IP) {
        const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        _res.setHeader('Retry-After', String(retryAfterSeconds));
        next(new AppError(429, 'TOO_MANY_EMAIL_REQUESTS',
            'ขอรหัส/สมัครสมาชิกถี่เกินไป กรุณารอสักครู่แล้วลองใหม่',
            { retryAfterSeconds }));
        return;
    }

    /**
     * ★ นับ **ก่อน** ส่งต่อ ไม่ใช่ตอน `res.on('finish')` เหมือน rateLimitLogin
     *   เพราะที่นี่นับทุกคำขอไม่ว่าผลเป็นอย่างไร ⇒ ไม่ต้องรอดูผลลัพธ์
     *   และการนับก่อนทำให้คำขอที่ยิงพร้อมกันรัว ๆ ถูกนับครบ ไม่หลุดไปเพราะยังไม่มีอันไหน finish
     */
    bucket.count += 1;
    next();
}
