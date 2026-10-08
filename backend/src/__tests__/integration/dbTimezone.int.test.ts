import { describe, expect, it } from 'vitest';
import type { RowDataPacket } from 'mysql2/promise';
import pool from '../../config/db.js';

/**
 * 🔴 A3 (8 ต.ค. 2569) — ทุก connection ของแอปต้องคิดเวลาเป็น UTC
 *
 * `timezone : 'Z'` ใน `createPool` สั่งแค่ **ตัว driver** ให้แปลง `Date` ที่เขียน/อ่าน
 * แต่ SQL ที่เราเขียนเองใช้ `NOW()` และ `INTERVAL` ซึ่ง **MySQL คิดตามเขตเวลาของตัวเอง**
 * ⇒ ถ้า MySQL รันเป็น +07 การเทียบเวลาจะเพี้ยน 7 ชั่วโมงในของที่ไม่มีใครสังเกต:
 *   กวาดทีมไม่ใช้งาน 14 วัน/6 เดือน · หน้าต่าง 48 ชม. ของเรื่องร้องเรียน · เวลาเปิดเช็คอิน ·
 *   คำเชิญกรรมการหมดอายุ 7 วัน (migration 050) · อายุ token
 *
 * เจอจริง: integration แดง 23 ข้อ เมื่อ MySQL ของเครื่องทดสอบตั้งเป็น Asia/Bangkok
 * ★ เครื่องที่เขียวอยู่ก่อนหน้านี้เขียวเพราะ image `mysql:8` ตั้งต้นเป็น UTC (`SYSTEM`)
 *   ซึ่งแปลว่า **ขึ้นกับเครื่อง** ⇒ ไฟล์นี้ทำให้ "โชคดี" กลายเป็น "รับประกัน"
 *
 * ★ ไฟล์นี้ใช้ pool ของ **แอปจริง** (`config/db.ts`) ไม่ใช่ pool ของฝั่งเทส —
 *   ถ้าเทสด้วย pool ของเทสเอง จะพิสูจน์แค่ว่าเทสตั้งถูก ไม่ได้พิสูจน์ว่าแอปตั้งถูก
 */
describe('A3 — เขตเวลาของ connection ที่แอปใช้', () => {
    it("ทุก connection ที่ pool แจกต้องได้ session time_zone = '+00:00'", async () => {
        // ขอหลาย connection พร้อมกัน เพื่อให้ pool สร้างตัวใหม่จริง ๆ ไม่ใช่คืนตัวเดิมซ้ำ
        const rows = await Promise.all(
            Array.from({ length: 5 }, () =>
                pool.query<({ tz: string } & RowDataPacket)[]>('SELECT @@session.time_zone AS tz')
                    .then(([r]) => r[0]?.tz))
        );
        expect(rows).toEqual(['+00:00', '+00:00', '+00:00', '+00:00', '+00:00']);
    });

    /**
     * ★ ข้อนี้คือคุณสมบัติที่สำคัญจริง ๆ — ไม่สนว่าตั้งด้วยวิธีไหน
     *   ขอแค่ `NOW()` ที่คิวรีของเราใช้ ต้องเท่ากับเวลา UTC
     *   (ถ้าใครถอด `SET time_zone` ออกแล้วเครื่องนั้นเป็น +07 ข้อนี้จะได้ 25200 วินาที)
     */
    it('NOW() ที่ SQL ของเราใช้ ต้องตรงกับ UTC (ต่างกัน 0 วินาที)', async () => {
        const [rows] = await pool.query<({ drift: number } & RowDataPacket)[]>(
            'SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) AS drift');
        expect(Number(rows[0]?.drift)).toBe(0);
    });
});
