import mysql from 'mysql2/promise';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { testDbConnection } from '../setup/loadTestEnv.js';

/**
 * pool ของฝั่งเทส — ใช้ปั้นข้อมูลก่อนยิง API และอ่านฐานหลังยิงเพื่อตรวจผล
 *
 * ★ แยกจาก pool ของแอป (config/db.ts) โดยเจตนา
 *   - ต้องเปิด multipleStatements สำหรับ resetDb() (แอปห้ามเปิด — เป็นช่อง SQL injection)
 *   - เทสอ่านฐานด้วยช่องทางที่ไม่ผ่านโค้ดที่กำลังทดสอบ ⇒ repo ที่เขียนผิดจะไม่ "ยืนยันตัวเอง"
 * ★ สร้างตอนเรียกครั้งแรก ไม่ใช่ตอน import — ให้ perFile.ts โหลด .env.test เสร็จก่อนเสมอ
 */
let pool: Pool | null = null;

export function testDb(): Pool {
    pool ??= mysql.createPool({
        ...testDbConnection(),
        timezone: 'Z',              // ตรงกับ pool ของแอป — ไม่งั้นวันที่ที่เขียน/อ่านจะเลื่อนตามโซนเวลาเครื่อง
        dateStrings: ['DATE'],
        charset: 'utf8mb4',
        multipleStatements: true,
        connectionLimit: 2,
    });
    return pool;
}

export async function closeTestDb(): Promise<void> {
    await pool?.end();
    pool = null;
}

/** INSERT แล้วคืน id ใหม่ */
export async function insert(table: string, row: Record<string, unknown>): Promise<number> {
    const [result] = await testDb().query<ResultSetHeader>(`INSERT INTO \`${table}\` SET ?`, [row]);
    return result.insertId;
}

/** อ่านแถวเดียว (หรือ null) — ใช้ตรวจผลในฐานหลังยิง API */
export async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
    const [rows] = await testDb().query<RowDataPacket[]>(sql, params);
    return (rows[0] as T | undefined) ?? null;
}

export async function all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await testDb().query<RowDataPacket[]>(sql, params);
    return rows as T[];
}

/**
 * ตารางที่ **ไม่** ล้างระหว่างเทส — มีข้อมูลตั้งต้นที่ migration ใส่ไว้
 *   schema_migrations : บันทึกว่ารัน migration อะไรไปแล้ว
 *   rewards           : แคตตาล็อกเหรียญ 6 รายการจาก 041_reward_catalogue.sql
 * ⚠️ ถ้ามี migration ใหม่ที่ seed ข้อมูลอ้างอิงลงตารางอื่น ต้องเติมชื่อที่นี่ ไม่งั้นข้อมูลนั้นหายหลังเทสแรก
 */
const KEEP = new Set(['schema_migrations', 'rewards']);

let resetSql: string | null = null;

/**
 * ล้างทุกตาราง (ยกเว้น KEEP) — perFile.ts เรียกก่อนทุกเทส ⇒ ทุกเทสเริ่มจากฐานว่าง
 *
 * ★ DELETE ไม่ใช่ TRUNCATE: TRUNCATE ใน MySQL 8 เป็น DDL ราว 10-30 ms ต่อตาราง × 40 ตาราง ต่อทุกเทส
 *   DELETE บนตารางเล็ก/ว่างแทบไม่เสียเวลา และส่งไปรอบเดียวด้วย multipleStatements
 *   ผลข้างเคียง: AUTO_INCREMENT ไม่ย้อน ⇒ **เทสห้ามเดา id** ให้ใช้ค่าที่ factory คืนมาเสมอ
 */
export async function resetDb(): Promise<void> {
    if (resetSql === null) {
        const tables = await all<{ name: string }>(
            `SELECT table_name AS name FROM information_schema.tables
              WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`);
        resetSql = [
            'SET FOREIGN_KEY_CHECKS = 0',
            ...tables.filter(t => !KEEP.has(t.name)).map(t => `DELETE FROM \`${t.name}\``),
            'SET FOREIGN_KEY_CHECKS = 1',
        ].join(';\n');
    }
    await testDb().query(resetSql);
}
