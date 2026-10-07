import { afterAll, beforeEach, vi } from 'vitest';
import { loadTestEnv } from './loadTestEnv.js';
import { resetDb, closeTestDb } from '../helpers/db.js';
import { mailbox } from '../helpers/mailbox.js';

/**
 * setup ของทุกไฟล์ *.int.test.ts — แทนที่ noRealIO.ts ของ unit test
 *
 *                 unit (noRealIO)      integration (ไฟล์นี้)
 *   MySQL         บล็อก                 ✅ ต่อฐานเทสจริง (ltms_test)
 *   SMTP          บล็อก                 แทนด้วย mailbox (เก็บเมลไว้ให้อ่าน ไม่ส่งจริง)
 *   S3/MinIO      บล็อก                 บล็อก (เทสไหนต้องใช้ ให้ vi.mock ในไฟล์นั้นเอง)
 *
 * ★ ห้าม import อะไรจาก src/config/* ที่ระดับบนของไฟล์นี้
 *   import ถูกยกขึ้นไปรันก่อน loadTestEnv() ⇒ config/env.ts จะอ่าน .env (ฐาน dev) แทน .env.test
 */
loadTestEnv();

// ═══ SMTP → mailbox ═══
vi.mock('../../../config/mail.js', async () => {
    const { mailbox: box } = await import('../helpers/mailbox.js');
    return { default: { sendMail: box.sendMail } };
});

// ═══ S3 → บล็อก (เหมือน unit test) ═══
vi.mock('../../../config/s3.js', () => ({
    default: new Proxy({}, {
        get(_t, prop) {
            if (typeof prop === 'symbol' || prop === 'then') return undefined;
            return () => {
                throw new Error(
                    `[integration] เทสแตะ S3 (${String(prop)}) — integration test ไม่ต่อ MinIO/S3 จริง\n` +
                    `  ให้ mock upload.service ในไฟล์เทสนั้น เช่น\n` +
                    `  vi.mock('../../services/upload.service.js', async (orig) => ({ ...(await orig()), presignAll: vi.fn(async () => []) }))`);
            };
        },
    }),
}));

beforeEach(async () => {
    await resetDb();
    mailbox.clear();
    /**
     * 🆕 BE-06 (7 ต.ค. 2569) — ล้างตัวนับของด่านจำกัดการล็อกอินผิด
     *
     * ตัวนับอยู่ในหน่วยความจำของ **โมดูล** ไม่ใช่ของคำขอ ⇒ ค้างข้ามเทสในไฟล์เดียวกัน
     * เทสที่ยิงรหัสผิดหลายครั้ง (authFlows) จะทำให้เทสถัดไปได้ 429 แทนผลที่มันทดสอบ
     * ★ ล้างที่นี่ที่เดียว ไม่ใช่ไปใส่ทีละไฟล์ — ทุกไฟล์ที่ยิง /auth/login ได้ประโยชน์เท่ากัน
     *   และคนเขียนเทสใหม่ไม่ต้องรู้ว่ามีตัวนับนี้อยู่
     */
    const { resetLoginRateLimit } = await import('../../../middlewares/rateLimitLogin.js');
    resetLoginRateLimit();
});

afterAll(async () => {
    await closeTestDb();
    // pool ของแอป — import ตอนนี้ (ไม่ใช่ข้างบน) ด้วยเหตุผลเดียวกับคอมเมนต์หัวไฟล์
    const { default: appPool } = await import('../../../config/db.js');
    await appPool.end();
});
