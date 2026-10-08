/**
 * รัน migration ที่ยังไม่เคยรันในเครื่องนี้ ตามลำดับชื่อไฟล์ใน database/migrations/
 *
 *   npm run migrate            รันไฟล์ที่ค้าง
 *   npm run migrate -- --fake  บันทึกว่ารันแล้วโดยไม่รันจริง (ใช้ครั้งเดียวกับ DB เก่าที่ ALTER มือไปแล้ว)
 *
 * ตาราง schema_migrations เก็บชื่อไฟล์ที่รันแล้ว — ห้ามแก้/ลบไฟล์ที่ push ไปแล้ว ให้เพิ่มไฟล์ใหม่แทน
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env.js';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../../../database/migrations');
const fake = process.argv.includes('--fake');

// connection แยกจาก pool ของแอป เพราะต้องเปิด multipleStatements ให้รันทั้งไฟล์ได้
const conn = await mysql.createConnection({
    host : env.HOST,
    user : env.USER,
    password : env.PASSWORD,
    port : env.DB_PORT,
    database : env.DB_NAME,
    charset : 'utf8mb4',
    multipleStatements : true
});

try {
    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        name       VARCHAR(255) PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    const [rows] = await conn.query<({ name : string } & RowDataPacket)[]>('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map(r => r.name));

    const files = (await readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort();
    const pending = files.filter(f => !applied.has(f));

    if(pending.length === 0){
        console.log(`up to date (${files.length} migrations)`);
    }

    for(const file of pending){
        if(!fake){
            const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
            try {
                await conn.query(sql);
            } catch (err) {
                // ★ MySQL: DDL (ALTER/CREATE) commit ทันที rollback ไม่ได้ — ถ้าพังกลางไฟล์ต้องแก้มือแล้วรันใหม่
                console.error(`FAILED ${file}`);
                throw err;
            }
        }
        await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
        console.log(`${fake ? 'marked ' : 'applied'} ${file}`);
    }
} finally {
    await conn.end();
}
