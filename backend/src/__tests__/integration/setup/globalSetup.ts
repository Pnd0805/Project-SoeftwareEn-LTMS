import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2/promise';
import { loadTestEnv, testDbConnection } from './loadTestEnv.js';

/**
 * สร้างฐานเทสใหม่ทั้งก้อน **ครั้งเดียวต่อการรัน** (ก่อนไฟล์เทสไฟล์แรก)
 *
 *   DROP + CREATE DATABASE  →  database/schema.sql  →  migration ที่ schema.sql ยังไม่ได้บันทึกว่ารันแล้ว
 *
 * ★ ทำไมต้องรัน migration ต่อ: schema.sql บันทึกไว้ถึง 036 เท่านั้น (6 ต.ค.)
 *   ⇒ ถ้าโหลด schema.sql อย่างเดียว ฐานเทสจะขาด 037-045 (OTP · Pick'em · reward · best_of · ขอถอนตัวกรรมการ)
 *   ลำดับเดียวกับที่ทุกคนทำในเครื่อง: สร้างจาก schema.sql แล้ว npm run migrate
 *
 * ★ ทำไมสร้างใหม่ทุกครั้ง ไม่ใช้ฐานเดิมต่อ: ฐานต้องตรงกับ schema + migration ของ commit ที่กำลังเทส
 *   ใครเพิ่ม migration ใหม่ เทสรอบถัดไปได้ของใหม่เองโดยไม่ต้องจำไปสั่งอะไร
 */
const DATABASE_DIR = path.resolve(import.meta.dirname, '../../../../../database');

export default async function globalSetup(): Promise<void> {
    loadTestEnv();
    const { database: dbName, ...server } = testDbConnection();
    const started = Date.now();

    // ต่อเซิร์ฟเวอร์โดยยังไม่เลือกฐาน — ฐานนั้นกำลังจะถูก DROP
    const conn = await mysql.createConnection({
        ...server,
        charset: 'utf8mb4',
        multipleStatements: true,
    });

    try {
        await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
        await conn.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
        await conn.query(`USE \`${dbName}\``);

        await conn.query(await readFile(path.join(DATABASE_DIR, 'schema.sql'), 'utf8'));

        // ตรรกะเดียวกับ src/scripts/migrate.ts — ไฟล์นั้นรันทันทีที่ import จึงเรียกซ้ำจากที่นี่ไม่ได้
        const [rows] = await conn.query<({ name: string } & RowDataPacket)[]>('SELECT name FROM schema_migrations');
        const applied = new Set(rows.map(r => r.name));
        const migrationsDir = path.join(DATABASE_DIR, 'migrations');
        const pending = (await readdir(migrationsDir)).filter(f => f.endsWith('.sql') && !applied.has(f)).sort();

        for (const file of pending) {
            try {
                await conn.query(await readFile(path.join(migrationsDir, file), 'utf8'));
            } catch (err) {
                throw new Error(`[integration] migration ${file} ล้มบนฐานเปล่า: ${(err as Error).message}`);
            }
            await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
        }

        console.log(`[integration] ${dbName} พร้อม — schema.sql + ${pending.length} migration (${Date.now() - started} ms)`);
    } finally {
        await conn.end();
    }
}
