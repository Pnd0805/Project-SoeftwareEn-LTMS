import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * OD-53 (29 ต.ค. 2569) — ด่านบังคับยืนยันอีเมล + งานกวาดบัญชีที่ไม่ยืนยัน
 *
 * ★ แยกเป็นไฟล์ของตัวเองเพราะต้อง **สลับค่า env ระหว่างเทส** ซึ่ง auth.service.test.ts
 *   ไม่ได้ทำ (ไฟล์นั้น mock config/auth.js แบบค่าคงที่) ⇒ ถ้าไปแก้ไฟล์เดิมจะกระทบเทสของคนอื่น
 * ★ mock `config/env.js` เป็น object ที่แก้ค่าได้ แล้ว service อ่านค่าตอนถูกเรียก
 *   ⇒ สลับสวิตช์ได้โดยไม่ต้อง resetModules ทุกเทส
 */

// ★ ต้องเป็น vi.hoisted — vi.mock ถูกยกขึ้นไปบนสุดของไฟล์ ⇒ อ้างตัวแปรระดับบนธรรมดาไม่ได้
const mockEnv = vi.hoisted(() => ({ REQUIRE_EMAIL_VERIFIED : false , UNVERIFIED_ACCOUNT_TTL_HOURS : 24 }));

vi.mock('../../config/env.js', () => ({ env : mockEnv }));

vi.mock('../../repositories/user.repo.js', () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updatePassword: vi.fn(),
  markEmailVerified: vi.fn(),
  overwriteUnverified: vi.fn(),
  purgeUnverifiedOlderThan: vi.fn(),
}));
vi.mock('../../repositories/faculty.repo.js', () => ({ findFacultyById: vi.fn() }));
vi.mock('../../repositories/department.repo.js', () => ({ findDepartmentInFaculty: vi.fn() }));
vi.mock('../../repositories/passwordReset.repo.js', () => ({
  create: vi.fn(), findActiveByUser: vi.fn(), findActiveByHash: vi.fn(),
  countIssuedWithinLastHour: vi.fn(), invalidateAllForUser: vi.fn(), markUsed: vi.fn(),
}));
vi.mock('../../repositories/emailVerification.repo.js', () => ({
  create: vi.fn(), findActiveByUser: vi.fn(), countIssuedWithinLastHour: vi.fn(),
  invalidateAllForUser: vi.fn(), markUsed: vi.fn(), claimAttempt: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('../../utils/password.js', () => ({ hashPassword: vi.fn(), verifyPassword: vi.fn() }));
vi.mock('../../utils/token.js', () => ({ signToken: vi.fn() }));
vi.mock('../../config/auth.js', () => ({ authConfig : { secret : 'test-secret' , expireIn : 3600 } }));
vi.mock('../mail.service.js', () => ({ sendPasswordResetEmail: vi.fn(), sendEmailVerificationOtp: vi.fn() }));

import * as authService from '../auth.service.js';
import * as userRepo from '../../repositories/user.repo.js';
import { verifyPassword } from '../../utils/password.js';
import { signToken } from '../../utils/token.js';
import type { UserRow } from '../../types/db.js';

const mockedUserRepo = vi.mocked(userRepo);
const mockedVerifyPassword = vi.mocked(verifyPassword);
const mockedSignToken = vi.mocked(signToken);

const user = (over : Partial<UserRow> = {}) : UserRow => ({
  user_id: 1, full_name: 'Test User', email: 'test@example.com', password_hash: 'hash',
  gender: 'male', birth_date: '2000-01-01', user_type: 'student',
  faculty_id: 1, department_id: 1, year: 2, profile_image_key: null,
  contact_info: null, address: null, is_suspended: 0, suspended_until: null,
  suspended_reason: null, suspension_category_id: null, token_version: 1,
  email_verified: 0, total_points: 0, show_profile_stats: 1,
  notification_prefs: null, email_notification_prefs: null,
  created_at: new Date('2026-10-01T00:00:00Z'), updated_at: null,
  ...over,
} as unknown as UserRow);

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.REQUIRE_EMAIL_VERIFIED = false;
  mockEnv.UNVERIFIED_ACCOUNT_TTL_HOURS = 24;
  mockedVerifyPassword.mockResolvedValue(true);
  mockedSignToken.mockReturnValue('token');
});
afterEach(() => { mockEnv.REQUIRE_EMAIL_VERIFIED = false; });

describe('ด่านบังคับยืนยันอีเมลตอนล็อกอิน', () => {
  it('สวิตช์ปิด — คนที่ยังไม่ยืนยันล็อกอินได้ตามเดิม', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(user({ email_verified : 0 }));

    const result = await authService.login('test@example.com' , 'pw');

    expect(result.accessToken).toBe('token');
  });

  it('สวิตช์เปิด — คนที่ยังไม่ยืนยันได้ 403 EMAIL_NOT_VERIFIED พร้อมอีเมลกลับไป', async () => {
    mockEnv.REQUIRE_EMAIL_VERIFIED = true;
    mockedUserRepo.findByEmail.mockResolvedValue(user({ email_verified : 0 }));

    await expect(authService.login('test@example.com' , 'pw')).rejects.toMatchObject({
      status : 403,
      code : 'EMAIL_NOT_VERIFIED',
      // FE ต้องใช้อีเมลนี้ยิง resend-verification ต่อได้ทันที
      extra : { email : 'test@example.com' },
    });
    // 🔴 ห้ามออก token ให้คนที่ยังไม่ยืนยัน
    expect(mockedSignToken).not.toHaveBeenCalled();
  });

  it('สวิตช์เปิด — คนที่ยืนยันแล้วล็อกอินได้ปกติ', async () => {
    mockEnv.REQUIRE_EMAIL_VERIFIED = true;
    mockedUserRepo.findByEmail.mockResolvedValue(user({ email_verified : 1 }));

    await expect(authService.login('test@example.com' , 'pw')).resolves.toMatchObject({ accessToken : 'token' });
  });

  it('🔴 รหัสผ่านผิด ต้องได้ 401 เหมือนเดิม ไม่ใช่ 403 — ไม่งั้นบอกคนนอกว่าอีเมลนี้มีบัญชีจริง', async () => {
    mockEnv.REQUIRE_EMAIL_VERIFIED = true;
    mockedUserRepo.findByEmail.mockResolvedValue(user({ email_verified : 0 }));
    mockedVerifyPassword.mockResolvedValue(false);

    await expect(authService.login('test@example.com' , 'wrong')).rejects.toMatchObject({
      status : 401,
      code : 'INVALID_CREDENTIALS',
    });
  });

  it('🔴 บัญชีถูกระงับต้องได้ข้อความระงับก่อน แม้ยังไม่ยืนยันอีเมล', async () => {
    mockEnv.REQUIRE_EMAIL_VERIFIED = true;
    mockedUserRepo.findByEmail.mockResolvedValue(user({ email_verified : 0 , is_suspended : 1 , suspended_until : null }));

    await expect(authService.login('test@example.com' , 'pw')).rejects.toMatchObject({ status : 403 });
    const err = await authService.login('test@example.com' , 'pw').catch(e => e);
    expect(err.code).not.toBe('EMAIL_NOT_VERIFIED');
  });
});

describe('งานกวาดบัญชีที่ไม่ยืนยันอีเมล', () => {
  // 🔴 29 ต.ค. — ด่านปิด = คนที่ไม่ยืนยันใช้งานได้ตามปกติ เป็นผู้ใช้จริง ⇒ ห้ามลบ
  it('🔴 ด่านปิด → ไม่ลบอะไรเลย ไม่แตะ repo', async () => {
    mockEnv.REQUIRE_EMAIL_VERIFIED = false;

    await expect(authService.purgeUnverifiedAccounts()).resolves.toBe(0);
    expect(mockedUserRepo.purgeUnverifiedOlderThan).not.toHaveBeenCalled();
  });

  it('ส่งค่า TTL จาก env เข้า repo (ด่านเปิด)', async () => {
    mockEnv.REQUIRE_EMAIL_VERIFIED = true;
    mockedUserRepo.purgeUnverifiedOlderThan.mockResolvedValue(3);

    await expect(authService.purgeUnverifiedAccounts()).resolves.toBe(3);
    expect(mockedUserRepo.purgeUnverifiedOlderThan).toHaveBeenCalledWith(24);
  });

  it('ตั้ง TTL เป็น 0 = ปิดงานกวาด (repo เป็นคนกันไว้ แต่ค่าต้องส่งถึง)', async () => {
    mockEnv.REQUIRE_EMAIL_VERIFIED = true;
    mockEnv.UNVERIFIED_ACCOUNT_TTL_HOURS = 0;
    mockedUserRepo.purgeUnverifiedOlderThan.mockResolvedValue(0);

    await authService.purgeUnverifiedAccounts();
    expect(mockedUserRepo.purgeUnverifiedOlderThan).toHaveBeenCalledWith(0);
  });
});
