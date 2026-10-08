import 'dotenv/config';
import {env} from './env.js';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host : env.HOST,
    user : env.USER,
    password : env.PASSWORD,
    port : env.DB_PORT,
    database : env.DB_NAME,
    timezone : 'Z',
    dateStrings : ['DATE'],
    charset : 'utf8mb4',
    // C3 — ปรับได้ตอน deploy โดยไม่ต้องแก้โค้ด (ไม่ตั้ง = 10 เท่าเดิม)
    connectionLimit : env.DB_POOL_SIZE
});

/**
 * 🔴 A3 (8 ต.ค. 2569) — บังคับให้ทุก connection คิดเวลาเป็น UTC
 *
 * `timezone : 'Z'` ข้างบนสั่งแค่ **ตัว driver** ให้แปลง `Date` ที่เขียน/อ่านเป็น UTC
 * แต่ SQL ที่เราเขียนเองใช้ `NOW()` และ `INTERVAL` ซึ่ง **MySQL คิดตามเขตเวลาของตัวเอง**
 * ⇒ ถ้า MySQL รันเป็น +07 การเทียบเวลาจะเพี้ยน 7 ชั่วโมง ในของที่ไม่มีใครสังเกต:
 *     กวาดทีมไม่ใช้งาน 14 วัน / 6 เดือน · หน้าต่าง 48 ชม. ของเรื่องร้องเรียน
 *     เวลาเปิดเช็คอิน · คำเชิญกรรมการหมดอายุ 7 วัน (migration 050) · token หมดอายุ
 *
 * เจอจริง: integration test แดง 23 ข้อ เมื่อ MySQL ของเครื่องทดสอบตั้งเป็น Asia/Bangkok
 * ★ เครื่องที่เขียวอยู่ตอนนี้เขียวเพราะ image `mysql:8` ตั้งต้นเป็น UTC (`@@time_zone = SYSTEM`)
 *   ซึ่งแปลว่า **ขึ้นกับเครื่อง** ไม่ใช่สิ่งที่เราควบคุม ⇒ ตรึงที่ฝั่งแอปเอง
 *
 * ทำที่ชั้น connection ไม่ใช่ตอน query เพราะคำสั่งของแต่ละ connection ทำตามลำดับ
 * ⇒ `SET time_zone` ถูกคิวไว้ก่อนคำสั่งแรกของคนที่ขอ connection นั้นเสมอ
 * ★ ยังตั้ง `--default-time-zone=+00:00` ใน docker-compose ไว้อีกชั้น — ชั้นนี้กันเครื่อง
 *   ที่ไม่ได้ใช้ compose ของเรา (production / เครื่องที่มี MySQL ของตัวเอง)
 */
pool.pool.on('connection', (conn) => {
    conn.query("SET time_zone = '+00:00'");
});

export default pool;