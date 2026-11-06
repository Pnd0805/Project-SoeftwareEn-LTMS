import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';

/**
 * BE-06 (มติ 7 ต.ค. 2569 ข้อ ⑭ ค) — จำกัดจำนวนครั้งที่ล็อกอินผิด
 *
 * เดิม `POST /auth/login` ไม่มีด่านอะไรเลย: ยิงรหัสผิด 12 ครั้งติดกันได้ 401 ทุกครั้ง
 * ไม่มีหน่วง ไม่มีล็อก ⇒ เครื่องเดารหัสทำงานได้เต็มความเร็วของเซิร์ฟเวอร์
 * (ฝั่ง OTP มีเพดานอยู่แล้วและทำงานถูก — `email_verification_otps.attempt_count`)
 *
 * ═══ ข้อจำกัดที่ยอมรับแล้ว ต้องอ่านก่อนแก้ ═══
 * 🔴 เก็บในหน่วยความจำของ process ⇒ ① รีสตาร์ทเซิร์ฟเวอร์แล้วตัวนับหาย
 *    ② ถ้ารันหลาย process/instance ตัวนับแยกกัน เพดานจริงจะคูณตามจำนวน process
 *    ยอมรับได้ในขอบเขตโครงงานนี้ที่รัน process เดียวและไม่มี redis
 *    ถ้าวันหนึ่งขึ้นหลาย instance ต้องย้ายตัวนับไปที่เก็บร่วม (redis / ตารางในฐาน)
 *
 * 🔴 ทำไม**ไม่**นับที่ `users` (คอลัมน์ `failed_login_count` + `locked_until`)
 *    วิธีนั้นดูชัดกว่าและทนรีสตาร์ท แต่ล็อกบัญชี **ทุกที่ทุกเครื่อง**:
 *    ใครก็ยิงรหัสผิดรัว ๆ ใส่อีเมลเหยื่อ แล้วเหยื่อเข้าระบบไม่ได้เลยจากที่ไหนก็ตาม
 *    ⇒ กลายเป็นปุ่มปิดบัญชีคนอื่นที่ใครก็กดได้ ซึ่งแย่กว่าปัญหาที่กำลังแก้
 *
 * ★ คีย์เป็น **IP + อีเมล** ไม่ใช่อีเมลเดี่ยว ๆ
 *   ① อีเมลเดี่ยว = ล็อกบัญชีคนอื่นได้ทุกที่ (ปัญหาข้างบน)
 *   ② IP เดี่ยว = เครือข่ายมหาวิทยาลัยทำ NAT ทั้งตึกออกไอพีเดียว ⇒ คนหนึ่งพิมพ์ผิด
 *      แล้วทั้งหอล็อกอินไม่ได้ · เพดานต่อ IP จึงหลวมกว่ามากและมีไว้กันการยิงกวาด
 *      (ยิงหลายอีเมลจากไอพีเดียว) ซึ่งเพดานต่อคู่จับไม่ได้
 *
 * 🔴 สิ่งที่วิธีนี้ **ไม่ได้** แก้ (ยืนยันด้วยเทสแล้ว ไม่ใช่การคาดเดา)
 *    ด่านนี้ปฏิเสธ **ก่อน** ตรวจรหัสผ่าน ⇒ เมื่อโควตาของคู่ (IP, อีเมล) หมด
 *    เจ้าของบัญชีที่อยู่ "ไอพีเดียวกัน" ก็เข้าไม่ได้ด้วยแม้กรอกรหัสถูก
 *    ⇒ ในเครือข่ายที่ทำ NAT ร่วมกัน ยังมีช่องกวนบัญชีคนอื่นได้ชั่วคราว (15 นาที)
 *    ที่ดีขึ้นจากการนับที่บัญชีคือ **ขอบเขต**: เหยื่อย้ายไปเน็ตมือถือแล้วเข้าได้ทันที
 *    ส่วนการนับที่บัญชีจะล็อกทุกเส้นทาง · ยอมรับข้อนี้ตามมติ ⑭ ค
 *    ถ้าจะปิดช่องนี้จริงต้องแยก "โควตาของคนร้าย" ออกจาก "สิทธิ์ของเจ้าของบัญชี"
 *    ซึ่งต้องมีสัญญาณอื่นนอกจากไอพี (อุปกรณ์/คุกกี้) — เกินขอบเขตของโครงงานนี้
 *
 * ★ นับเฉพาะครั้งที่ **ล้มเหลว** (401) และล้างตัวนับเมื่อเข้าได้
 *   ⇒ คนที่พิมพ์ผิดสองครั้งแล้วถูกไม่เสียสิทธิ์อะไรเลย
 *   อ่านสถานะจากผลลัพธ์จริงผ่าน `res.on('finish')` ไม่ใช่เดาจาก payload
 */

const WINDOW_MS = 15 * 60 * 1000;
/** ต่อคู่ (IP, อีเมล) — คนพิมพ์ผิดจริงไม่ถึง 10 ครั้งใน 15 นาที */
const MAX_PER_IDENTITY = 10;
/** ต่อ IP รวมทุกอีเมล — หลวมเพราะ NAT · มีไว้จับการยิงกวาดหลายอีเมลจากที่เดียว */
const MAX_PER_IP = 60;

type Bucket = { count : number; resetAt : number };
const buckets = new Map<string, Bucket>();

/** ★ ไม่มี scheduler — เก็บกวาดตรงจังหวะที่มีคนมาใช้งาน (รูปแบบเดียวกับ autoVerifyDue) */
function sweep(now : number): void {
    if (buckets.size < 1000) return;
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
    }
}

function hit(key : string, now : number): Bucket {
    const existing = buckets.get(key);
    if (existing && existing.resetAt > now) return existing;
    const fresh : Bucket = { count : 0, resetAt : now + WINDOW_MS };
    buckets.set(key, fresh);
    return fresh;
}

/** ให้เทสล้างสถานะระหว่างเคสได้ — ตัวนับอยู่ในโมดูล ไม่ใช่ในคำขอ */
export function resetLoginRateLimit(): void {
    buckets.clear();
}

export function rateLimitLogin(req : Request, res : Response, next : NextFunction): void {
    const now = Date.now();
    sweep(now);

    /**
     * ★ `req.ip` ขึ้นกับการตั้ง `trust proxy` ของ express — ตอนนี้ไม่ได้ตั้ง ⇒ ได้ไอพีของ
     *   ขาที่ต่อเข้ามาจริง ซึ่งถูกต้องเมื่อไม่มี reverse proxy
     *   ถ้าวันหนึ่งขึ้นหลัง nginx/cloud LB ต้องตั้ง `app.set('trust proxy', ...)` ก่อน
     *   ไม่งั้นทุกคำขอจะนับเป็นไอพีเดียวกันหมด แล้วเพดานต่อ IP จะล็อกทุกคน
     */
    const ip = req.ip ?? 'unknown';
    const email = typeof req.body?.['email'] === 'string' ? String(req.body['email']).toLowerCase() : '';

    const identityBucket = hit(`id:${ip}|${email}`, now);
    const ipBucket = hit(`ip:${ip}`, now);

    const blocked = identityBucket.count >= MAX_PER_IDENTITY ? identityBucket
                  : ipBucket.count >= MAX_PER_IP ? ipBucket
                  : null;
    if (blocked !== null) {
        const retryAfterSeconds = Math.max(1, Math.ceil((blocked.resetAt - now) / 1000));
        res.setHeader('Retry-After', String(retryAfterSeconds));
        next(new AppError(429, 'TOO_MANY_LOGIN_ATTEMPTS',
            'พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอแล้วลองใหม่',
            { retryAfterSeconds }));
        return;
    }

    /**
     * ★ นับหลังรู้ผล ไม่ใช่ตอนเข้า — ถ้านับตอนเข้า คนที่ล็อกอินถูกทุกครั้งก็จะถูกจำกัดด้วย
     *   401 = รหัสผิด/ไม่พบบัญชี (สิ่งที่ต้องกัน)
     *   403 = บัญชีถูกระงับ/ยังไม่ยืนยันอีเมล — รหัสถูกแล้ว ไม่ใช่การเดา จึงไม่นับ
     */
    res.on('finish', () => {
        if (res.statusCode === 401) {
            identityBucket.count += 1;
            ipBucket.count += 1;
        } else if (res.statusCode < 400) {
            buckets.delete(`id:${ip}|${email}`);
        }
    });

    next();
}
