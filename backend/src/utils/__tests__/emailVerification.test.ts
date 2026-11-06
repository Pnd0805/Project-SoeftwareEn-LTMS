import { describe, it, expect, vi, beforeEach } from 'vitest';

// ★ vi.hoisted — vi.mock ถูกยกขึ้นบนสุดของไฟล์ ⇒ อ้างตัวแปรระดับบนธรรมดาไม่ได้
const mockEnv = vi.hoisted(() => ({ REQUIRE_EMAIL_VERIFIED : false }));
vi.mock('../../config/env.js', () => ({ env : mockEnv }));

import { emailVerifiedSql } from '../emailVerification.js';

beforeEach(() => { mockEnv.REQUIRE_EMAIL_VERIFIED = false; });

/**
 * OD-53 (29 ต.ค. 2569) — ตัวกรองบัญชีที่ยังไม่ยืนยันออกจากผลค้นหา
 *
 * ★ ผูกกับสวิตช์ตัวเดียวกับด่านล็อกอินโดยเจตนา — ถ้ากรองตลอดเวลา จะเกิดสภาพ
 *   "ล็อกอินได้แต่ไม่มีใครค้นเจอ" ซึ่งผู้ใช้จะงงและไม่มีข้อความอะไรอธิบาย
 */
describe('emailVerifiedSql', () => {
    it('สวิตช์ปิด — คืนเงื่อนไขที่จริงเสมอ ⇒ ผลค้นหาไม่เปลี่ยนจากเดิม', () => {
        expect(emailVerifiedSql('u')).toBe('1');
    });

    it('สวิตช์เปิด — คืนเงื่อนไขที่กรองเฉพาะบัญชีที่ยืนยันแล้ว พร้อม alias ที่ส่งมา', () => {
        mockEnv.REQUIRE_EMAIL_VERIFIED = true;

        expect(emailVerifiedSql('u')).toBe('u.email_verified = 1');
        expect(emailVerifiedSql('target')).toBe('target.email_verified = 1');
    });

    it('🔴 อ่านค่า env ตอนถูกเรียก ไม่ใช่ตอน import — ไม่งั้นสลับสวิตช์แล้วไม่มีผลจนรีสตาร์ต', () => {
        expect(emailVerifiedSql('u')).toBe('1');
        mockEnv.REQUIRE_EMAIL_VERIFIED = true;
        expect(emailVerifiedSql('u')).toBe('u.email_verified = 1');
    });
});
