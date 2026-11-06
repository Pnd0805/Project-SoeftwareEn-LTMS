import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2/promise';
import { BACKEND_DIR, perfDb } from './env.js';

/**
 * สร้างฐาน perf ใหม่ทั้งก้อน — ลำดับเดียวกับ integration globalSetup:
 *   DROP + CREATE → database/schema.sql → migration ที่ schema.sql ยังไม่ได้บันทึก
 */
const DATABASE_DIR = path.resolve(BACKEND_DIR, '../database');

export async function setupPerfDb(): Promise<void> {
    const { database: dbName, ...server } = perfDb();
    const conn = await mysql.createConnection({ ...server, charset: 'utf8mb4', multipleStatements: true });
    try {
        const [[tz]] = await conn.query<RowDataPacket[]>('SELECT @@global.time_zone AS tz');
        if (tz?.['tz'] !== '+00:00' && tz?.['tz'] !== 'UTC') {
            throw new Error(`[perf] MySQL time_zone = ${tz?.['tz']} — ต้องเป็น UTC (+00:00) ไม่งั้นเวลาเพี้ยน 7 ชม. (ดู perf/README.md)`);
        }
        await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
        await conn.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
        await conn.query(`USE \`${dbName}\``);
        await conn.query(await readFile(path.join(DATABASE_DIR, 'schema.sql'), 'utf8'));

        const [rows] = await conn.query<({ name: string } & RowDataPacket)[]>('SELECT name FROM schema_migrations');
        const applied = new Set(rows.map(r => r.name));
        const dir = path.join(DATABASE_DIR, 'migrations');
        const pending = (await readdir(dir)).filter(f => f.endsWith('.sql') && !applied.has(f)).sort();
        for (const file of pending) {
            await conn.query(await readFile(path.join(dir, file), 'utf8'));
            await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
        }
        console.log(`[perf] ${dbName} พร้อม — schema.sql + ${pending.length} migration`);
    } finally {
        await conn.end();
    }
}
