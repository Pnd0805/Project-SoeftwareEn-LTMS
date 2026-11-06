import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * โหลด backend/.env.perf — ใช้ทั้งสคริปต์ seed และตอนเปิดเซิร์ฟเวอร์ที่จะถูกวัด
 *
 * ★ ไฟล์แยกจาก .env / .env.test เพราะ perf DROP ฐานแล้ว seed ใหม่ทั้งก้อนทุกครั้ง
 */
export const BACKEND_DIR = path.resolve(import.meta.dirname, '../..');
export const PERF_ENV_PATH = path.join(BACKEND_DIR, '.env.perf');

export function loadPerfEnv(): void {
    if (!existsSync(PERF_ENV_PATH)) {
        throw new Error(`[perf] ไม่พบ ${PERF_ENV_PATH}\n  คัดลอก backend/.env.perf.example เป็น backend/.env.perf แล้วใส่รหัสผ่าน MySQL`);
    }
    config({ path: PERF_ENV_PATH, override: true, quiet: true });

    // 🔴 ด่านกันลบฐานผิดตัว — setupDb สั่ง DROP DATABASE ตามชื่อนี้
    const dbName = process.env['DB_NAME'] ?? '';
    if (!/_perf$/.test(dbName)) {
        throw new Error(`[perf] DB_NAME="${dbName}" ไม่ได้ลงท้ายด้วย _perf — ไม่ยอมรัน (สคริปต์นี้ลบและสร้างฐานใหม่ทั้งก้อน)`);
    }
}

export function perfDb() {
    const read = (key: string) => {
        const v = process.env[key];
        if (v === undefined || v === '') throw new Error(`[perf] ${key} ว่างใน ${PERF_ENV_PATH}`);
        return v;
    };
    return {
        host: read('DB_HOST'),
        port: Number(read('DB_PORT')),
        user: read('DB_USER'),
        password: process.env['DB_PASSWORD'] ?? '',
        database: read('DB_NAME'),
    };
}

export const perfPort = () => Number(process.env['PORT'] ?? 3999);
