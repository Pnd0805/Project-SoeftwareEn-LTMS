import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

/**
 * 🆕 C2 (8 ต.ค. 2569) — log คำขอที่ช้าเกินเกณฑ์
 *
 * ตอน load test มีคำขอค้างจน timeout **2,000+ ครั้ง** แต่ log ของเซิร์ฟเวอร์ **ว่างเปล่า**
 * ⇒ ถ้า production ช้าหรือค้าง เราจะไม่เห็นอะไรเลย ไม่รู้ด้วยซ้ำว่าเส้นไหน
 *
 * ★ ตั้งใจให้เล็กและไม่มี dependency — ไม่ดึง logger library เข้ามาเพราะทั้งโปรเจกต์
 *   ยังใช้ `console` อย่างเดียว (deleteObjectBestEffort ฯลฯ) · ถ้าวันหนึ่งเปลี่ยน
 *   ไปใช้ logger จริง จุดที่ต้องแก้คือไฟล์นี้ไฟล์เดียว
 *
 * ═══ 🔴 ทำไมต้องฟัง `close` ไม่ใช่แค่ `finish` ═══
 *
 * `finish` ยิงเมื่อ **ส่งคำตอบจบ** ⇒ คำขอที่ client ยอมแพ้ไปก่อน (timeout / ปิดแท็บ /
 * proxy ตัด) **ไม่ยิง `finish` เลย** — ซึ่งคือเคสที่เราอยากเห็นที่สุด
 * ⇒ ถ้าทำตามข้อเสนอเดิมที่วัดแค่ `res.on('finish')` log จะยัง**ว่างเปล่าเหมือนเดิม**
 *   สำหรับ timeout 2,000+ ครั้งนั้น
 *
 * `close` ยิงเสมอเมื่อ connection ปิด ไม่ว่าจะจบดีหรือถูกตัด ⇒ ใช้ `close` เป็นตัวจบงาน
 * แล้วดู `res.writableEnded` ว่าได้ส่งคำตอบครบไหม
 *   writableEnded = true   → ตอบครบ แต่ช้า        (ของเราช้า)
 *   writableEnded = false  → client ยอมแพ้ก่อน    (ของเราช้ากว่าที่เขารอไหว)
 * สองอย่างนี้คนละอาการและแก้คนละทาง จึงต้องแยกให้เห็นในบรรทัด log
 *
 * ═══ ไม่ log อะไรบ้าง ═══
 *
 * 🔴 ตัด query string ทิ้งเสมอ — มันพาข้อมูลของผู้ใช้ (คำค้น ฯลฯ) ลง log ได้
 *   เก็บแค่ path ซึ่งมี id ที่จำเป็นต่อการไล่ปัญหา · header (รวม Authorization) ไม่ถูกแตะเลย
 */

/** `Date.now()` ไม่ใช่ `hrtime` — เกณฑ์เป็นหลักวินาที ความละเอียด ms พอ และ fake timer ของเทสคุมได้ */
export function slowRequestLog(req: Request, res: Response, next: NextFunction): void {
    if (env.SLOW_REQUEST_MS <= 0) return next();   // 0 = ปิดสนิท ไม่ต้องผูก listener ให้เปลือง

    const startedAt = Date.now();
    res.on('close', () => {
        const ms = Date.now() - startedAt;
        if (ms < env.SLOW_REQUEST_MS) return;

        const path = req.originalUrl.split('?')[0];
        if (res.writableEnded) {
            console.warn(`[slow] ${ms}ms ${req.method} ${path} → ${res.statusCode}`);
        } else {
            // ★ ไม่มี status ที่มีความหมายให้รายงาน — ไม่มีใครได้รับคำตอบนี้
            console.warn(`[slow] ${ms}ms ${req.method} ${path} → ไม่ได้ส่งคำตอบ (client ยกเลิกก่อน)`);
        }
    });
    next();
}
