import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));

import {
    create,
    findActiveByUser,
    countIssuedWithinLastHour,
    invalidateAllForUser,
    markUsed,
    claimAttempt,
} from '../emailVerification.repo.js';

beforeEach(() => vi.clearAllMocks());

/**
 * OD-53 — OTP ยืนยันอีเมล
 *
 * ★ ตารางนี้ลอกโครงมาจาก password_reset_tokens แต่ **ต่างกัน 2 จุดที่พลาดแล้วเงียบ**
 *   ทั้งสองจุดไม่ทำให้อะไรพัง ไม่มี error ไม่มีเทสไหนแดง แค่ด่านความปลอดภัยหายไป
 *   ⇒ ต้องตรึงด้วยการอ่าน SQL ตรงๆ ไม่ใช่ดูว่าฟังก์ชันคืนค่าออกมาไหม
 */
describe('findActiveByUser — ด่านกันเดาต้องอยู่ใน SQL', () => {
    it('กรอง attempt_count < ? ที่ฐาน ไม่ใช่ปล่อยให้ service เช็คเอง', async () => {
        mocks.query.mockResolvedValueOnce([[], []]);
        await findActiveByUser(1, 5);

        const [sql, params] = mocks.query.mock.calls[0]!;
        // ★ ถ้าเงื่อนไขนี้หลุด ใบที่ถูกเดาผิดครบโควตาแล้วจะกลับมาใช้ได้อีก
        //   = เดา 6 หลักได้ไม่จำกัดครั้ง ซึ่งคือการล้มด่านเดียวที่กัน OTP อยู่
        expect(sql).toContain('attempt_count < ?');
        expect(params).toEqual([1, 5]);
    });

    it('ยังกรองครบทั้งสามเงื่อนไขพื้นฐาน — เจ้าของใบ · ยังไม่ถูกใช้ · ยังไม่หมดอายุ', async () => {
        mocks.query.mockResolvedValueOnce([[], []]);
        await findActiveByUser(1, 5);

        const [sql] = mocks.query.mock.calls[0]!;
        expect(sql).toContain('user_id = ?');
        expect(sql).toContain('used_at IS NULL');
        expect(sql).toContain('expires_at > NOW()');
    });
});

describe('countIssuedWithinLastHour — ต้องนับจาก created_at ไม่ใช่ expires_at', () => {
    it('ใช้ created_at + INTERVAL 1 HOUR และไม่แอบใช้ทริกของ passwordReset.repo', async () => {
        mocks.query.mockResolvedValueOnce([[{ cnt: 2 }], []]);
        await countIssuedWithinLastHour(1);

        const [sql] = mocks.query.mock.calls[0]!;
        /**
         * ★ passwordReset.repo ใช้ `expires_at > NOW()` นับ rate limit ได้ เพราะที่นั่น
         *   TTL (1 ชม.) = หน้าต่าง rate limit (1 ชม.) พอดี ⇒ "ยังไม่หมดอายุ" = "ออกใน 1 ชม."
         *   ที่นี่ TTL 10 นาที แต่หน้าต่างยัง 1 ชม. ⇒ ทริกนั้นใช้ไม่ได้
         *   ถ้าลอกมาทั้งดุ้น จะนับได้แค่ 10 นาทีล่าสุด = ขอรหัสใหม่ได้ 18 ใบ/ชม. แทน 3
         *   และจะไม่มีอะไรฟ้อง เพราะคิวรียังรันผ่านและยังคืนตัวเลขออกมาปกติ
         */
        expect(sql).toContain('created_at');
        expect(sql).toContain('INTERVAL 1 HOUR');
        expect(sql).not.toContain('expires_at');
    });

    it('นับใบที่ใช้ไปแล้วด้วย — rate limit คือ "ขอกี่ครั้ง" ไม่ใช่ "เหลือกี่ใบที่ใช้ได้"', async () => {
        mocks.query.mockResolvedValueOnce([[{ cnt: 0 }], []]);
        await countIssuedWithinLastHour(1);

        const [sql] = mocks.query.mock.calls[0]!;
        expect(sql).not.toContain('used_at');
    });
});

describe('claimAttempt — จองสิทธิ์เดาที่ฐานในคำสั่งเดียว (bug hunt ข้อ 8)', () => {
    it('นับขึ้นที่ฐาน + มีเงื่อนไขโควตาในคำสั่งเดียวกัน', async () => {
        mocks.query.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
        await expect(claimAttempt(7, 5)).resolves.toBe(true);

        const [sql, params] = mocks.query.mock.calls[0]!;
        // ★ อ่านค่ามาบวกในแอปแล้วเขียนกลับ จะนับหายเมื่อยิงพร้อมกันหลายเส้น
        //   ซึ่งคือท่าที่คนเดา OTP จะใช้พอดี — ยิงรัวขนานกัน
        expect(sql).toContain('attempt_count = attempt_count + 1');
        // 🔴 เงื่อนไขโควตาต้องอยู่ใน UPDATE เอง — แยกไปเช็คก่อน = ยิงพร้อมกันแล้วผ่านทุกคำขอ
        expect(sql).toContain('attempt_count < ?');
        expect(sql).toContain('used_at IS NULL');
        expect(params).toEqual([7, 5]);
    });

    it('ไม่โดนแถว = หมดสิทธิ์ → false', async () => {
        mocks.query.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
        await expect(claimAttempt(7, 5)).resolves.toBe(false);
    });
});

describe('ของพื้นฐานที่เหลือ', () => {
    it('create เก็บ code_hash ตามที่ส่งมา และไม่มีคอลัมน์ attempt_count/created_at ใน INSERT', async () => {
        mocks.query.mockResolvedValueOnce([{ insertId: 9 }, []]);
        const expiresAt = new Date();
        const id = await create(1, 'bcrypt-hash', expiresAt);

        const [sql, params] = mocks.query.mock.calls[0]!;
        expect(id).toBe(9);
        expect(params).toEqual([1, 'bcrypt-hash', expiresAt]);
        // ทั้งสองคอลัมน์มี DEFAULT ที่ฐาน — ระบุเองจะกลายเป็นมีสองที่ที่ตั้งค่าเริ่มต้น
        expect(sql).not.toContain('attempt_count');
        expect(sql).not.toContain('created_at');
    });

    it('invalidateAllForUser แตะเฉพาะใบที่ยังไม่ถูกใช้ — ไม่เขียนทับ used_at เดิม', async () => {
        mocks.query.mockResolvedValueOnce([{ affectedRows: 2 }, []]);
        await invalidateAllForUser(1);

        const [sql] = mocks.query.mock.calls[0]!;
        expect(sql).toContain('used_at = NOW()');
        expect(sql).toContain('used_at IS NULL');
    });

    it('markUsed ปิดทีละใบด้วย primary key', async () => {
        mocks.query.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
        await markUsed(7);

        const [sql, params] = mocks.query.mock.calls[0]!;
        expect(sql).toContain('email_verification_otp_id = ?');
        expect(params).toEqual([7]);
    });
});
