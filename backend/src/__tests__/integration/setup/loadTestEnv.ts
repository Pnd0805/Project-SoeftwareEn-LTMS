import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * โหลด backend/.env.test ทับค่าใน process.env — ใช้ทั้งใน globalSetup (process หลัก) และ perFile (worker)
 *
 * ★ ทำไมต้องเป็นไฟล์แยก ไม่ใช้ .env
 *   integration test **ลบข้อมูลทั้งฐานก่อนทุกเทส** และสร้างฐานใหม่ทั้งก้อนทุกครั้งที่รัน
 *   ถ้าชี้ไปฐานเดียวกับที่ใช้ dev (ltms) ข้อมูลที่ทุกคน seed ไว้หายหมดในการรันครั้งแรก
 */
export const ENV_TEST_PATH = path.resolve(import.meta.dirname, '../../../../.env.test');

export function loadTestEnv(): void {
    if (!existsSync(ENV_TEST_PATH)) {
        throw new Error(
            `[integration] ไม่พบ ${ENV_TEST_PATH}\n` +
            `  คัดลอก backend/.env.test.example เป็น backend/.env.test แล้วใส่รหัสผ่าน MySQL ให้ตรงกับ .env\n` +
            `  (DB_NAME ต้องลงท้ายด้วย _test — ห้ามชี้ไปฐาน dev)`);
    }
    config({ path: ENV_TEST_PATH, override: true, quiet: true });

    /**
     * 🔴 ด่านกันลบฐานผิดตัว — ห้ามเอาออก
     *   globalSetup สั่ง DROP DATABASE ตามชื่อนี้ · helper ลบทุกตารางก่อนทุกเทส
     *   ⇒ ถ้าใครพิมพ์ DB_NAME=ltms ใน .env.test โดยไม่ตั้งใจ ฐาน dev จะหายทั้งก้อน
     */
    const dbName = process.env['DB_NAME'] ?? '';
    if (!/_test$/.test(dbName)) {
        throw new Error(
            `[integration] DB_NAME="${dbName}" ไม่ได้ลงท้ายด้วย _test — ไม่ยอมรัน\n` +
            `  integration test ลบและสร้างฐานนี้ใหม่ทั้งก้อน ⇒ ต้องเป็นฐานสำหรับเทสเท่านั้น (เช่น ltms_test)`);
    }
}

/** ค่าต่อฐานจาก .env.test — ตัวเดียวที่ globalSetup กับ helpers/db.ts ใช้ (ไม่อ่าน process.env กระจายหลายที่) */
export function testDbConnection(): { host: string; port: number; user: string; password: string; database: string } {
    const read = (key: string) => {
        const value = process.env[key];
        if (value === undefined || value === '') {
            throw new Error(`[integration] ${key} ว่างใน ${ENV_TEST_PATH} — ดูตัวอย่างที่ .env.test.example`);
        }
        return value;
    };
    return {
        host: read('DB_HOST'),
        port: Number(read('DB_PORT')),
        user: read('DB_USER'),
        // ★ รหัสว่างเป็นค่าที่ถูกต้องได้ (MySQL root ไม่มีรหัส) ⇒ ไม่บังคับเหมือนตัวอื่น
        password: process.env['DB_PASSWORD'] ?? '',
        database: read('DB_NAME'),
    };
}
