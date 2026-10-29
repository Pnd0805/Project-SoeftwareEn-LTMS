import { describe, expect, it, vi } from 'vitest';
import { one, testDb } from './helpers/db.js';
import { createSportType, createTeam, createUser } from './helpers/factories.js';
import { purgeUnverifiedOlderThan } from '../../repositories/user.repo.js';

/**
 * OD-53 (29 ต.ค. 2569) — ลบบัญชีที่สมัครแล้วไม่ยืนยันอีเมลเกินกำหนด
 *
 * ★ ต้องเป็นเทส integration ไม่ใช่ unit เพราะของที่ต้องพิสูจน์คือ **พฤติกรรมของฐานจริง**:
 *   `email_verification_otps` มี FK ไป `users` **แบบไม่มี ON DELETE CASCADE** (migration 037)
 *   ⇒ ลบ user ตรง ๆ จะติด FK error · ของจำลองจับข้อนี้ไม่ได้เลย
 *
 * ★ เหตุผลที่ลบคือ **ข้อมูลส่วนบุคคล** (ชื่อ อีเมล วันเกิด เพศ คณะ ของคนที่สมัครไม่สำเร็จ)
 *   ไม่ใช่เรื่องพื้นที่ฐานข้อมูล — หลักการเดียวกับ OD-70 ที่ลบภาพยืนยันตัวตนกรรมการ
 */

/** สร้างบัญชีแล้วย้อน created_at ให้เก่าตามต้องการ (ย้อนด้วย SQL เพราะ factory ตั้ง NOW() ให้) */
async function agedUser(hoursAgo: number, emailVerified: boolean) {
    const user = await createUser({ emailVerified });
    await testDb().query('UPDATE users SET created_at = NOW() - INTERVAL ? HOUR WHERE user_id = ?',
        [hoursAgo, user.id]);
    return user;
}

async function addOtp(userId: number) {
    await testDb().query(
        `INSERT INTO email_verification_otps(user_id , code_hash , expires_at)
         VALUES(? , 'not-a-real-hash' , NOW() + INTERVAL 10 MINUTE)`, [userId]);
}

const exists = async (userId: number) =>
    (await one<{ c: number }>('SELECT COUNT(*) AS c FROM users WHERE user_id = ?', [userId]))!.c === 1;

describe('งานกวาดบัญชีที่ไม่ยืนยันอีเมล', () => {
    it('ลบบัญชีที่เกินกำหนดและยังไม่ยืนยัน พร้อมใบ OTP ของมัน (FK ไม่ล้ม)', async () => {
        const stale = await agedUser(30, false);
        await addOtp(stale.id);

        const removed = await purgeUnverifiedOlderThan(24);

        expect(removed).toBeGreaterThanOrEqual(1);
        expect(await exists(stale.id)).toBe(false);
        // 🔴 ใบ OTP ต้องหายไปด้วย ไม่ใช่ค้างเป็นแถวกำพร้า
        const otps = await one<{ c: number }>(
            'SELECT COUNT(*) AS c FROM email_verification_otps WHERE user_id = ?', [stale.id]);
        expect(otps!.c).toBe(0);
    });

    it('🔴 ไม่ลบบัญชีที่ยืนยันแล้ว แม้จะเก่ากว่ากำหนด', async () => {
        const old = await agedUser(500, true);

        await purgeUnverifiedOlderThan(24);

        expect(await exists(old.id)).toBe(true);
    });

    it('ไม่ลบบัญชีที่ยังไม่ครบกำหนด', async () => {
        const fresh = await agedUser(2, false);

        await purgeUnverifiedOlderThan(24);

        expect(await exists(fresh.id)).toBe(true);
    });

    it('TTL = 0 คือปิดงานกวาด — ต้องไม่ลบอะไรเลย', async () => {
        const stale = await agedUser(500, false);

        const removed = await purgeUnverifiedOlderThan(0);

        expect(removed).toBe(0);
        expect(await exists(stale.id)).toBe(true);
    });

    it('รันตอนไม่มีอะไรเข้าเกณฑ์ ต้องไม่พังและคืน 0', async () => {
        await agedUser(1, false);

        await expect(purgeUnverifiedOlderThan(24)).resolves.toBe(0);
    });
});

/**
 * 🔴 29 ต.ค. 2569 — เดิม DELETE ก้อนเดียว ⇒ บัญชีเดียวที่มีข้อมูลผูกอยู่ทำให้ทั้งรอบล้ม (ER_ROW_IS_REFERENCED)
 *   ไม่มีใครถูกลบเลย และ error ซ้ำทุกชั่วโมง · เจอจริงตอนลองรัน: บัญชีหนึ่งเป็นหัวหน้าทีม อีกบัญชีไม่มีอะไร → ไม่ถูกลบทั้งคู่
 */
describe('ลบทีละบัญชี — บัญชีที่มีข้อมูลผูกอยู่ไม่ขวางคนอื่น', () => {
    it('🔴 บัญชีที่เป็นหัวหน้าทีม → ข้าม (ไม่ล้ม) · บัญชีที่ไม่มีอะไรผูก → ลบตามปกติ', async () => {
        const idle = await agedUser(30, false);
        await addOtp(idle.id);
        const active = await agedUser(30, false);
        await addOtp(active.id);
        await createTeam({ leader: active.id, sportTypeId: await createSportType() });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        await expect(purgeUnverifiedOlderThan(24)).resolves.toBe(1);

        expect(await exists(idle.id)).toBe(false);
        expect(await exists(active.id)).toBe(true);
        // ใบ OTP ของคนที่ถูกข้ามต้องยังอยู่ (ย้อน transaction ของบัญชีนั้นทั้งก้อน)
        const otps = await one<{ c: number }>('SELECT COUNT(*) AS c FROM email_verification_otps WHERE user_id = ?', [active.id]);
        expect(otps!.c).toBe(1);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('ข้าม 1 บัญชี'));
        warn.mockRestore();
    });
});

