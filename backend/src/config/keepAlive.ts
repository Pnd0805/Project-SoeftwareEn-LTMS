import { env } from './env.js';

/**
 * 🆕 C4 (8 ต.ค. 2569) — ตั้งอายุ keep-alive ของเซิร์ฟเวอร์ให้ยาวกว่าของ reverse proxy
 *
 * เมื่อขึ้น production หลัง nginx (ดู `docker-compose.yml` — เรามี nginx จริง)
 * proxy จะถือ connection ไว้ใช้ซ้ำ ถ้า **Node ปิดก่อน** proxy จะเพิ่งส่งคำขอใหม่เข้าไป
 * ใน connection ที่กำลังถูกปิดพอดี ⇒ ผู้ใช้ได้ **502 ประปราย** โดยไม่มีอะไรผิดในโค้ดเลย
 * (load test เห็น `ECONNRESET` 4 ครั้งจาก 29,000 คำขอ ด้วยเหตุนี้)
 *
 * ค่าตั้งต้นของ Node คือ 5 วินาที ซึ่ง **สั้นกว่า** ของ nginx (60 วินาที) อยู่มาก
 * ⇒ ตั้ง 65 วินาที ให้ยาวกว่าฝั่ง proxy เสมอ แล้วให้ proxy เป็นฝ่ายปิด
 *
 * 🔴 `headersTimeout` ต้อง **มากกว่า** `keepAliveTimeout` เสมอ
 *   Node นับ `headersTimeout` ตั้งแต่ connection เปิด ไม่ใช่ตั้งแต่ byte แรกของคำขอ
 *   ⇒ ถ้าตั้งเท่ากันหรือสั้นกว่า connection ที่ idle อยู่จะถูกตัดด้วย 408 แทนที่จะถูก
 *     นำกลับมาใช้ซ้ำ ซึ่งเป็นอาการเดียวกับที่เรากำลังแก้ · บวก 1 วินาทีไว้ที่นี่ที่เดียว
 *
 * ★ แยกเป็นไฟล์แทนที่จะเขียนใน `server.ts` เพื่อให้เทสได้ — `server.ts` เรียก `listen()`
 *   ตั้งแต่ import จึงเอามาเทสตรง ๆ ไม่ได้
 */
export const HEADERS_TIMEOUT_MARGIN_MS = 1_000;

export function configureKeepAlive(server: { keepAliveTimeout: number; headersTimeout: number }): void {
    server.keepAliveTimeout = env.KEEP_ALIVE_TIMEOUT_MS;
    server.headersTimeout = env.KEEP_ALIVE_TIMEOUT_MS + HEADERS_TIMEOUT_MARGIN_MS;
}
