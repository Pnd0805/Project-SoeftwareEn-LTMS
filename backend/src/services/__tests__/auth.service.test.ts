import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock every dependency auth.service.ts imports ----
vi.mock('../../repositories/user.repo.js', () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updatePassword: vi.fn(),
  markEmailVerified: vi.fn(),
}));

vi.mock('../../repositories/faculty.repo.js', () => ({
  findFacultyById: vi.fn(),
}));

vi.mock('../../repositories/department.repo.js', () => ({
  findDepartmentInFaculty: vi.fn(),
}));

vi.mock('../../repositories/passwordReset.repo.js', () => ({
  create: vi.fn(),
  findActiveByUser: vi.fn(),
  findAllActive: vi.fn(),
  countIssuedWithinLastHour: vi.fn(),
  invalidateAllForUser: vi.fn(),
  markUsed: vi.fn(),
}));

vi.mock('../../repositories/emailVerification.repo.js', () => ({
  create: vi.fn(),
  findActiveByUser: vi.fn(),
  countIssuedWithinLastHour: vi.fn(),
  invalidateAllForUser: vi.fn(),
  markUsed: vi.fn(),
  bumpAttempt: vi.fn(),
}));

vi.mock('../../utils/password.js', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('../../utils/token.js', () => ({
  signToken: vi.fn(),
}));

vi.mock('../../config/auth.js', () => ({
  authConfig: {
    secret: 'test-secret',
    expireIn: 3600,
  },
}));

vi.mock('../mail.service.js', () => ({
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerificationOtp: vi.fn(),
}));

// ---- Import the module under test AFTER mocks are declared ----
import * as authService from '../auth.service.js';
import * as userRepo from '../../repositories/user.repo.js';
import * as passwordResetRepo from '../../repositories/passwordReset.repo.js';
import * as emailVerifyRepo from '../../repositories/emailVerification.repo.js';
import { findFacultyById } from '../../repositories/faculty.repo.js';
import { findDepartmentInFaculty } from '../../repositories/department.repo.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { signToken } from '../../utils/token.js';
import { sendPasswordResetEmail , sendEmailVerificationOtp } from '../mail.service.js';
import { AppError } from '../../utils/AppError.js';
import type { RegisterInput } from '../../schemas/auth.schema.js';
import type { UserRow, PasswordResetTokenRow } from '../../types/db.js';

const mockedUserRepo = vi.mocked(userRepo);
const mockedPasswordResetRepo = vi.mocked(passwordResetRepo);
const mockedEmailVerifyRepo = vi.mocked(emailVerifyRepo);
const mockedFindFacultyById = vi.mocked(findFacultyById);
const mockedFindDepartmentInFaculty = vi.mocked(findDepartmentInFaculty);
const mockedHashPassword = vi.mocked(hashPassword);
const mockedVerifyPassword = vi.mocked(verifyPassword);
const mockedSignToken = vi.mocked(signToken);
const mockedSendPasswordResetEmail = vi.mocked(sendPasswordResetEmail);
const mockedSendEmailVerificationOtp = vi.mocked(sendEmailVerificationOtp);

// ---- Test fixtures ----
const baseUser: UserRow = {
  user_id: 1,
  full_name: 'Test User',
  email: 'test@example.com',
  password_hash: 'hashed-password',
  gender: 'male',
  birth_date: '2000-01-01',
  user_type: 'student',
  faculty_id: 1,
  department_id: 1,
  year: 2,
  profile_image_key: null,
  contact_info: null,
  address: null,
  is_suspended: 0,
  suspended_reason: null,
  suspended_until: null,
  suspended_category: null,
  total_points: 0,
  notification_prefs: null, show_profile_stats: 1,
  email_verified: 0,
  profile_edit_log: null,
  created_at: new Date(),
  updated_at: null,
};

const registerInput: RegisterInput = {
  fullName: 'New User',
  email: 'new@example.com',
  password: 'plaintext-password',
  gender: 'female',
  birthDate: '2001-05-05',
  facultyId: 1,
  departmentId: 2,
  year: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('auth.service register()', () => {
  it('registers a new user successfully', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(null);
    mockedFindFacultyById.mockResolvedValue({ faculty_id: 1, name: 'Engineering' });
    mockedFindDepartmentInFaculty.mockResolvedValue({
      department_id: 2,
      faculty_id: 1,
      name: 'Computer Engineering',
    });
    mockedHashPassword.mockResolvedValue('hashed-plaintext-password');
    mockedUserRepo.create.mockResolvedValue(42);

    const result = await authService.register(registerInput);

    expect(mockedUserRepo.findByEmail).toHaveBeenCalledWith(registerInput.email);
    expect(mockedFindFacultyById).toHaveBeenCalledWith(registerInput.facultyId);
    expect(mockedFindDepartmentInFaculty).toHaveBeenCalledWith(
      registerInput.facultyId,
      registerInput.departmentId,
    );
    expect(mockedHashPassword).toHaveBeenCalledWith(registerInput.password);
    expect(mockedUserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: registerInput.fullName,
        email: registerInput.email,
        passwordHash: 'hashed-plaintext-password',
        userType: 'external',   // registerInput.email ไม่ใช่โดเมน @ku.th
      }),
    );
    expect(result).toEqual({
      id: 42,
      fullName: registerInput.fullName,
      email: registerInput.email,
      emailVerificationSent: true,
    });
  });

  it('สมัครด้วยอีเมล @ku.th ได้ userType เป็น student', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(null);
    mockedFindFacultyById.mockResolvedValue({ faculty_id: 1, name: 'Engineering' });
    mockedFindDepartmentInFaculty.mockResolvedValue({
      department_id: 2,
      faculty_id: 1,
      name: 'Computer Engineering',
    });
    mockedHashPassword.mockResolvedValue('hashed-plaintext-password');
    mockedUserRepo.create.mockResolvedValue(43);

    await authService.register({ ...registerInput, email: 'somchai@ku.th' });

    expect(mockedUserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userType: 'student' }),
    );
  });

  it('throws EMAIL_ALREADY_REGISTERED when the email is already in use', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(baseUser);

    await expect(authService.register(registerInput)).rejects.toMatchObject({
      status: 400,
      code: 'EMAIL_ALREADY_REGISTERED',
    });

    expect(mockedFindFacultyById).not.toHaveBeenCalled();
    expect(mockedUserRepo.create).not.toHaveBeenCalled();
  });

  it('throws VALIDATION_FAILED with facultyId field when faculty does not exist', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(null);
    mockedFindFacultyById.mockResolvedValue(null);

    const err: AppError = await authService.register(registerInput).catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_FAILED');
    expect(err.extra?.fields).toHaveProperty('facultyId');
    expect(mockedFindDepartmentInFaculty).not.toHaveBeenCalled();
    expect(mockedUserRepo.create).not.toHaveBeenCalled();
  });

  it('throws VALIDATION_FAILED with departmentId field when department is not in the faculty', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(null);
    mockedFindFacultyById.mockResolvedValue({ faculty_id: 1, name: 'Engineering' });
    mockedFindDepartmentInFaculty.mockResolvedValue(null);

    const err: AppError = await authService.register(registerInput).catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_FAILED');
    expect(err.extra?.fields).toHaveProperty('departmentId');
    expect(mockedUserRepo.create).not.toHaveBeenCalled();
  });
});

describe('auth.service login()', () => {
  it('logs in successfully and returns an access token', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(baseUser);
    mockedVerifyPassword.mockResolvedValue(true);
    mockedSignToken.mockReturnValue('signed-jwt-token');

    const result = await authService.login(baseUser.email, 'correct-password');

    expect(mockedUserRepo.findByEmail).toHaveBeenCalledWith(baseUser.email);
    expect(mockedVerifyPassword).toHaveBeenCalledWith('correct-password', baseUser.password_hash);
    expect(mockedSignToken).toHaveBeenCalledWith(baseUser.user_id);
    expect(result).toEqual({
      accessToken: 'signed-jwt-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
      user: {
        id: baseUser.user_id,
        fullName: baseUser.full_name,
        userType: baseUser.user_type,
      },
    });
  });

  it('throws INVALID_CREDENTIALS when the user does not exist', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(null);

    await expect(authService.login('nobody@example.com', 'whatever')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });

    expect(mockedVerifyPassword).not.toHaveBeenCalled();
    expect(mockedSignToken).not.toHaveBeenCalled();
  });

  it('throws INVALID_CREDENTIALS when the password is wrong', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(baseUser);
    mockedVerifyPassword.mockResolvedValue(false);

    await expect(authService.login(baseUser.email, 'wrong-password')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });

    expect(mockedSignToken).not.toHaveBeenCalled();
  });

  it('throws ACCOUNT_SUSPENDED when the account is suspended', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue({ ...baseUser, is_suspended: 1 });
    mockedVerifyPassword.mockResolvedValue(true);

    await expect(authService.login(baseUser.email, 'correct-password')).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_SUSPENDED',
    });

    expect(mockedSignToken).not.toHaveBeenCalled();
  });

  // migration 033 — ประตูล็อกอินต้องคิดเวลาเหมือน requireAuth ไม่งั้นคนพ้นโทษแล้วล็อกอินไม่ได้
  it('ระงับแบบมีกำหนดที่เลยเวลาแล้ว: ล็อกอินได้ตามปกติ', async () => {
    const expired = new Date(Date.now() - 1000);
    mockedUserRepo.findByEmail.mockResolvedValue({ ...baseUser, is_suspended: 1, suspended_until: expired });
    mockedVerifyPassword.mockResolvedValue(true);

    await expect(authService.login(baseUser.email, 'correct-password')).resolves.toMatchObject({ tokenType: 'Bearer' });
    expect(mockedSignToken).toHaveBeenCalled();
  });

  it('ระงับแบบมีกำหนดที่ยังไม่ถึงเวลา: 403 พร้อมกำหนดพ้น', async () => {
    const until = new Date(Date.now() + 86400000);
    mockedUserRepo.findByEmail.mockResolvedValue({ ...baseUser, is_suspended: 1, suspended_until: until });
    mockedVerifyPassword.mockResolvedValue(true);

    await expect(authService.login(baseUser.email, 'correct-password')).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_SUSPENDED',
      extra: { suspendedUntil: until.toISOString(), suspendedCategory: null, suspendedCategoryLabel: null },
    });
    expect(mockedSignToken).not.toHaveBeenCalled();
  });
});

const baseResetToken: PasswordResetTokenRow = {
  password_reset_token_id: 10,
  user_id: baseUser.user_id,
  token_hash: 'hashed-raw-token',
  expires_at: new Date(Date.now() + 60 * 60 * 1000),
  used_at: null,
};

describe('auth.service forgotPassword()', () => {
  it('อีเมลที่มีจริง: ส่งเมล 1 ครั้ง สร้าง token ใหม่ และล้าง token เก่า', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(baseUser);
    mockedPasswordResetRepo.countIssuedWithinLastHour.mockResolvedValue(0);
    mockedHashPassword.mockResolvedValue('hashed-raw-token');
    mockedPasswordResetRepo.invalidateAllForUser.mockResolvedValue(0);
    mockedPasswordResetRepo.create.mockResolvedValue(10);
    mockedSendPasswordResetEmail.mockResolvedValue(undefined);

    const result = await authService.forgotPassword(baseUser.email);

    expect(mockedPasswordResetRepo.invalidateAllForUser).toHaveBeenCalledWith(baseUser.user_id);
    expect(mockedPasswordResetRepo.create).toHaveBeenCalledWith(baseUser.user_id, 'hashed-raw-token', expect.any(Date));
    expect(mockedSendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(mockedSendPasswordResetEmail).toHaveBeenCalledWith(baseUser.email, baseUser.full_name, expect.any(String));
    expect(result).toEqual({ message: expect.any(String) });
  });

  it('ลิงก์ในเมลมี token ดิบ แต่สิ่งที่บันทึกลงฐานเป็น hash ไม่ใช่ token ดิบ', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(baseUser);
    mockedPasswordResetRepo.countIssuedWithinLastHour.mockResolvedValue(0);
    mockedHashPassword.mockResolvedValue('hashed-raw-token');
    mockedPasswordResetRepo.invalidateAllForUser.mockResolvedValue(0);
    mockedPasswordResetRepo.create.mockResolvedValue(10);
    mockedSendPasswordResetEmail.mockResolvedValue(undefined);

    await authService.forgotPassword(baseUser.email);

    const rawTokenSentInEmail = mockedSendPasswordResetEmail.mock.calls[0]?.[2];
    const tokenHashPersisted = mockedPasswordResetRepo.create.mock.calls[0]?.[1];

    expect(rawTokenSentInEmail).toEqual(expect.any(String));
    expect(tokenHashPersisted).toBe('hashed-raw-token');
    expect(tokenHashPersisted).not.toBe(rawTokenSentInEmail);
  });

  it('อีเมลที่ไม่มีในระบบ: ตอบ body เหมือนกัน แต่ไม่ส่งเมลและไม่สร้าง token', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(null);

    const result = await authService.forgotPassword('nobody@example.com');

    expect(result).toEqual({ message: 'ถ้าอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว' });
    expect(mockedSendPasswordResetEmail).not.toHaveBeenCalled();
    expect(mockedPasswordResetRepo.create).not.toHaveBeenCalled();
  });

  it('บัญชีที่ถูกระงับ: ตอบ body เหมือนกัน แต่ไม่ส่งเมลและไม่สร้าง token', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue({ ...baseUser, is_suspended: 1 });

    const result = await authService.forgotPassword(baseUser.email);

    expect(result).toEqual({ message: 'ถ้าอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว' });
    expect(mockedSendPasswordResetEmail).not.toHaveBeenCalled();
    expect(mockedPasswordResetRepo.create).not.toHaveBeenCalled();
  });

  it('ตัวส่งเมลโยน error: ยังตอบ 200 เหมือนเดิม (ไม่ throw ต่อ)', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(baseUser);
    mockedPasswordResetRepo.countIssuedWithinLastHour.mockResolvedValue(0);
    mockedHashPassword.mockResolvedValue('hashed-raw-token');
    mockedPasswordResetRepo.invalidateAllForUser.mockResolvedValue(0);
    mockedPasswordResetRepo.create.mockResolvedValue(10);
    mockedSendPasswordResetEmail.mockRejectedValueOnce(new Error('SMTP down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});   // log นี้คือสิ่งที่เทสตั้งใจให้เกิด

    await expect(authService.forgotPassword(baseUser.email)).resolves.toEqual({
      message: 'ถ้าอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว',
    });
    expect(spy).toHaveBeenCalledWith('sendPasswordResetEmail failed:', expect.any(Error));
    spy.mockRestore();
  });

  /**
   * OD-54 — เกินโควตาแล้วต้อง **ไม่** โยน 429 เพราะ 429 โผล่เฉพาะกับอีเมลที่มีจริง
   * เทสชุดนี้ตรึงสองเรื่องคู่กัน: การกันยังอยู่ (ไม่ออก token ไม่ส่งเมล)
   * และคำตอบที่ส่งออกไปแยกจากเคสอีเมลไม่มีจริงไม่ออก
   */
  it('ขอครั้งที่ 4 ในชั่วโมงเดียว: ยังกันไว้ครบ — ไม่ออก token และไม่ส่งเมล', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(baseUser);
    mockedPasswordResetRepo.countIssuedWithinLastHour.mockResolvedValue(3);

    await expect(authService.forgotPassword(baseUser.email)).resolves.toEqual({
      message: 'ถ้าอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว',
    });

    expect(mockedPasswordResetRepo.create).not.toHaveBeenCalled();
    expect(mockedPasswordResetRepo.invalidateAllForUser).not.toHaveBeenCalled();
    expect(mockedSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('ขอครั้งที่ 4 ไม่โยน error ใดๆ — ห้ามกลับไปเป็น 429 (OD-54)', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(baseUser);
    mockedPasswordResetRepo.countIssuedWithinLastHour.mockResolvedValue(99);

    // ★ ถ้าวันหนึ่งมีคนเติม throw กลับเข้าไป เทสนี้จะแดงทันที
    await expect(authService.forgotPassword(baseUser.email)).resolves.toBeDefined();
  });

  it('★ เคสเกินโควตา · อีเมลไม่มีจริง · บัญชีถูกระงับ ต้องได้คำตอบเหมือนกันเป๊ะทั้งสาม', async () => {
    // ① เกินโควตา (อีเมลมีจริง)
    mockedUserRepo.findByEmail.mockResolvedValue(baseUser);
    mockedPasswordResetRepo.countIssuedWithinLastHour.mockResolvedValue(3);
    const overQuota = await authService.forgotPassword(baseUser.email);

    // ② ไม่มีอีเมลนี้ในระบบ
    mockedUserRepo.findByEmail.mockResolvedValue(null);
    const unknown = await authService.forgotPassword('nobody@example.com');

    // ③ มีอีเมลแต่บัญชีถูกระงับถาวร
    mockedUserRepo.findByEmail.mockResolvedValue({
      ...baseUser, is_suspended: 1, suspended_until: null,
    });
    const suspended = await authService.forgotPassword(baseUser.email);

    /**
     * ★ นี่คือหัวใจของ OD-54 — ถ้าสามเคสนี้แยกจากกันออก
     *   endpoint นี้จะกลายเป็นเครื่องมือกวาดหาว่าอีเมลไหนมีในระบบ
     *   ซึ่งเป็นสิ่งเดียวที่คำสัญญา "ตอบ 200 เหมือนกันเป๊ะ" มีไว้เพื่อปิด
     */
    expect(overQuota).toEqual(unknown);
    expect(suspended).toEqual(unknown);
  });
});

describe('auth.service resetPassword()', () => {
  it('token ถูกต้อง + รหัสผ่านผ่านกฎ: ตั้งรหัสใหม่ และล้าง token อื่นๆ ของคนนั้นทั้งหมด', async () => {
    mockedPasswordResetRepo.findAllActive.mockResolvedValue([baseResetToken]);
    mockedVerifyPassword.mockResolvedValue(true);
    mockedUserRepo.findById.mockResolvedValue(baseUser);
    mockedHashPassword.mockResolvedValue('new-hashed-password');
    mockedUserRepo.updatePassword.mockResolvedValue(1);
    mockedPasswordResetRepo.invalidateAllForUser.mockResolvedValue(1);

    const result = await authService.resetPassword('raw-token', 'newpassword1');

    expect(mockedUserRepo.updatePassword).toHaveBeenCalledWith(baseUser.user_id, 'new-hashed-password');
    expect(mockedPasswordResetRepo.invalidateAllForUser).toHaveBeenCalledWith(baseUser.user_id);
    expect(result).toEqual({ message: expect.any(String) });
    expect(result).not.toHaveProperty('accessToken');
  });

  it('token ที่ไม่มีในระบบ (ไม่มีแถว active เลย): 400 INVALID_RESET_TOKEN', async () => {
    mockedPasswordResetRepo.findAllActive.mockResolvedValue([]);

    await expect(authService.resetPassword('unknown-token', 'newpassword1')).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_RESET_TOKEN',
    });
    expect(mockedUserRepo.updatePassword).not.toHaveBeenCalled();
  });

  it('token ที่ไม่ตรงกับ hash ของแถว active ใดเลย (ครอบคลุมทั้งกรณีใช้ไปแล้ว/หมดอายุ — ไม่อยู่ใน findAllActive() แล้ว): 400 ข้อความเดียวกัน', async () => {
    mockedPasswordResetRepo.findAllActive.mockResolvedValue([baseResetToken]);
    mockedVerifyPassword.mockResolvedValue(false);

    const err1: AppError = await authService.resetPassword('wrong-token', 'newpassword1').catch((e) => e);
    mockedPasswordResetRepo.findAllActive.mockResolvedValue([]);
    const err2: AppError = await authService.resetPassword('expired-or-used-token', 'newpassword1').catch((e) => e);

    expect(err1.status).toBe(400);
    expect(err1.code).toBe('INVALID_RESET_TOKEN');
    expect(err2.status).toBe(400);
    expect(err2.code).toBe('INVALID_RESET_TOKEN');
    expect(err1.message).toBe(err2.message);
  });

  it('response ไม่มี accessToken', async () => {
    mockedPasswordResetRepo.findAllActive.mockResolvedValue([baseResetToken]);
    mockedVerifyPassword.mockResolvedValue(true);
    mockedUserRepo.findById.mockResolvedValue(baseUser);
    mockedHashPassword.mockResolvedValue('new-hashed-password');
    mockedUserRepo.updatePassword.mockResolvedValue(1);
    mockedPasswordResetRepo.invalidateAllForUser.mockResolvedValue(1);

    const result = await authService.resetPassword('raw-token', 'newpassword1');

    expect(result).not.toHaveProperty('accessToken');
  });

  it('บัญชีถูกระงับ + token ที่ออกก่อนถูกระงับ: ใช้ไม่ได้ (400 INVALID_RESET_TOKEN)', async () => {
    mockedPasswordResetRepo.findAllActive.mockResolvedValue([baseResetToken]);
    mockedVerifyPassword.mockResolvedValue(true);
    mockedUserRepo.findById.mockResolvedValue({ ...baseUser, is_suspended: 1 });

    await expect(authService.resetPassword('raw-token', 'newpassword1')).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_RESET_TOKEN',
    });
    expect(mockedUserRepo.updatePassword).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// OD-53 · ยืนยันอีเมลด้วย OTP 6 หลัก (A06/A07)
// ══════════════════════════════════════════════════════════════════════════

const unverifiedUser: UserRow = { ...baseUser, email_verified: 0 };
const verifiedUser: UserRow = { ...baseUser, email_verified: 1 };

const otpRow = {
  email_verification_otp_id: 7,
  user_id: 1,
  code_hash: 'hashed-otp',
  expires_at: new Date(Date.now() + 600_000),
  used_at: null,
  attempt_count: 0,
  created_at: new Date(),
};

describe('auth.service register() — OTP ยืนยันอีเมล', () => {
  function arrangeRegister() {
    mockedUserRepo.findByEmail.mockResolvedValue(null);
    mockedFindFacultyById.mockResolvedValue({ faculty_id: 1, name: 'Engineering' });
    mockedFindDepartmentInFaculty.mockResolvedValue({ department_id: 2, faculty_id: 1, name: 'CE' });
    mockedHashPassword.mockResolvedValue('hashed');
    mockedUserRepo.create.mockResolvedValue(42);
  }

  it('ส่งเลข 6 หลักเสมอ และยอมรับเลขที่ขึ้นต้นด้วยศูนย์ (padStart)', async () => {
    arrangeRegister();

    // สุ่มจริง 300 รอบ — ถ้าลืม padStart เลขที่น้อยกว่า 100000 จะหลุดมาเป็น 5 หลัก
    for (let i = 0; i < 300; i++) {
      mockedSendEmailVerificationOtp.mockClear();
      await authService.register(registerInput);
      const code = mockedSendEmailVerificationOtp.mock.calls[0]![2];
      expect(code).toMatch(/^[0-9]{6}$/);
    }
  });

  it('เก็บลงฐานเป็น hash ไม่ใช่เลขดิบ', async () => {
    arrangeRegister();
    mockedHashPassword.mockResolvedValue('bcrypt-of-otp');

    await authService.register(registerInput);

    const code = mockedSendEmailVerificationOtp.mock.calls[0]![2];
    expect(mockedEmailVerifyRepo.create).toHaveBeenCalledWith(42, 'bcrypt-of-otp', expect.any(Date));
    // ★ ข้อนี้คือหัวใจ — เลขดิบต้องไม่โผล่ไปเป็นอาร์กิวเมนต์ที่เขียนลงฐาน
    expect(mockedEmailVerifyRepo.create).not.toHaveBeenCalledWith(42, code, expect.any(Date));
  });

  it('ล้างใบเก่าก่อนออกใบใหม่ทุกครั้ง', async () => {
    arrangeRegister();
    await authService.register(registerInput);
    expect(mockedEmailVerifyRepo.invalidateAllForUser).toHaveBeenCalledWith(42);
  });

  it('TTL อยู่ที่ 10 นาที ไม่ใช่ 1 ชั่วโมงแบบ reset token', async () => {
    arrangeRegister();
    const before = Date.now();
    await authService.register(registerInput);

    const expiresAt = mockedEmailVerifyRepo.create.mock.calls[0]![2] as Date;
    const ttlMs = expiresAt.getTime() - before;
    expect(ttlMs).toBeGreaterThan(9 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(10 * 60 * 1000 + 1000);
  });

  it('เมลพัง → สมัครยังสำเร็จ แต่คืน emailVerificationSent: false', async () => {
    arrangeRegister();
    // ★ Once — mockRejectedValue ถาวรจะค้างข้ามเทส (clearAllMocks ไม่ล้าง implementation) ⇒ เทสหลังจากนี้ส่งเมลไม่ได้ทั้งหมด
    mockedSendEmailVerificationOtp.mockRejectedValueOnce(new Error('SMTP down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await authService.register(registerInput);

    // ★ ต่างจาก forgotPassword ที่กลืนเงียบ — ที่นี่ผู้ใช้ต้องรู้ว่าเมลไม่มา
    expect(result).toMatchObject({ id: 42, emailVerificationSent: false });
    spy.mockRestore();
  });

  it('ไม่คืนเลข OTP ออกทาง response', async () => {
    arrangeRegister();
    const result = await authService.register(registerInput);
    const code = mockedSendEmailVerificationOtp.mock.calls[0]![2];

    expect(JSON.stringify(result)).not.toContain(code);
  });
});

describe('auth.service verifyEmail()', () => {
  it('กรอกถูก → ติดธงที่ users แล้วปิดใบนั้น แล้วล้างใบที่เหลือ', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(unverifiedUser);
    mockedEmailVerifyRepo.findActiveByUser.mockResolvedValue([otpRow]);
    mockedVerifyPassword.mockResolvedValue(true);

    const result = await authService.verifyEmail('test@example.com', '123456');

    expect(result).toEqual({ message: expect.any(String), emailVerified: true });
    expect(mockedEmailVerifyRepo.markUsed).toHaveBeenCalledWith(7);
    expect(mockedUserRepo.markEmailVerified).toHaveBeenCalledWith(1);
    expect(mockedEmailVerifyRepo.invalidateAllForUser).toHaveBeenCalledWith(1);
    expect(mockedEmailVerifyRepo.bumpAttempt).not.toHaveBeenCalled();
  });

  it('ส่งโควตา 5 ครั้งลงไปให้ SQL กรอง — ด่านกันเดาต้องไม่หายไป', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(unverifiedUser);
    mockedEmailVerifyRepo.findActiveByUser.mockResolvedValue([otpRow]);
    mockedVerifyPassword.mockResolvedValue(true);

    await authService.verifyEmail('test@example.com', '123456');

    expect(mockedEmailVerifyRepo.findActiveByUser).toHaveBeenCalledWith(1, 5);
  });

  it('กรอกผิด → นับขึ้น 1 แล้วโยน INVALID_OTP', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(unverifiedUser);
    mockedEmailVerifyRepo.findActiveByUser.mockResolvedValue([otpRow]);
    mockedVerifyPassword.mockResolvedValue(false);

    await expect(authService.verifyEmail('test@example.com', '000000'))
      .rejects.toMatchObject({ status: 400, code: 'INVALID_OTP' });

    expect(mockedEmailVerifyRepo.bumpAttempt).toHaveBeenCalledWith(7);
    expect(mockedUserRepo.markEmailVerified).not.toHaveBeenCalled();
  });

  it('ไม่มีใบที่ใช้ได้ (หมดอายุ/ใช้แล้ว/ครบโควตา) → INVALID_OTP และไม่มีอะไรให้นับ', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(unverifiedUser);
    mockedEmailVerifyRepo.findActiveByUser.mockResolvedValue([]);

    await expect(authService.verifyEmail('test@example.com', '123456'))
      .rejects.toMatchObject({ code: 'INVALID_OTP' });

    expect(mockedEmailVerifyRepo.bumpAttempt).not.toHaveBeenCalled();
  });

  it('ยืนยันซ้ำ → 200 เหมือนเดิม ไม่แตะตาราง OTP เลย (idempotent)', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(verifiedUser);

    const result = await authService.verifyEmail('test@example.com', '123456');

    expect(result.emailVerified).toBe(true);
    expect(mockedEmailVerifyRepo.findActiveByUser).not.toHaveBeenCalled();
    expect(mockedUserRepo.markEmailVerified).not.toHaveBeenCalled();
  });

  it('ไม่มีอีเมลนี้ → ได้ error ก้อนเดียวกับกรอกเลขผิด ไม่ใช่ 404', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(null);

    const unknown = await authService.verifyEmail('nobody@example.com', '123456')
      .catch((e: AppError) => e);

    mockedUserRepo.findByEmail.mockResolvedValue(unverifiedUser);
    mockedEmailVerifyRepo.findActiveByUser.mockResolvedValue([otpRow]);
    mockedVerifyPassword.mockResolvedValue(false);
    const wrongCode = await authService.verifyEmail('test@example.com', '000000')
      .catch((e: AppError) => e);

    // ★ สองเคสนี้ต้องแยกจากกันไม่ออก ไม่งั้นกลายเป็นเครื่องมือกวาดหาว่าอีเมลไหนมีในระบบ
    expect((unknown as AppError).status).toBe((wrongCode as AppError).status);
    expect((unknown as AppError).code).toBe((wrongCode as AppError).code);
    expect((unknown as AppError).message).toBe((wrongCode as AppError).message);
  });
});

describe('auth.service resendEmailVerification()', () => {
  it('ยังไม่ยืนยัน + ไม่เกินโควตา → ออกใบใหม่แล้วส่งเมล', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(unverifiedUser);
    mockedEmailVerifyRepo.countIssuedWithinLastHour.mockResolvedValue(2);

    await authService.resendEmailVerification('test@example.com');

    expect(mockedEmailVerifyRepo.create).toHaveBeenCalled();
    expect(mockedSendEmailVerificationOtp).toHaveBeenCalledWith(
      'test@example.com', 'Test User', expect.stringMatching(/^[0-9]{6}$/), 10);
  });

  /**
   * ★★ ตรึงการแก้ enumeration เมื่อ 4 ต.ค. — ห้ามกลับไปตอบ 429
   *   เดิมเกินโควตา = 429 ซึ่งคัดกรองได้ว่าบัญชีไหน "มีจริงและยังไม่ยืนยัน"
   *   (register บอกแค่ว่ามีบัญชี ไม่ได้บอกสถานะยืนยัน)
   *   ตรวจจริงบนเซิร์ฟเวอร์ที่รันอยู่ได้ผล 200·200·429 ขณะที่อีเมลที่ไม่มีได้ 200 ทุกครั้ง
   */
  it('★ เกินโควตา → 200 เหมือนเคสอื่น (ไม่ใช่ 429) และไม่ออกใบใหม่', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(unverifiedUser);
    mockedEmailVerifyRepo.countIssuedWithinLastHour.mockResolvedValue(3);

    await expect(authService.resendEmailVerification('test@example.com'))
      .resolves.toEqual({ message: expect.any(String) });

    // การกันยังทำงานครบ — เอาออกแค่การประกาศ
    expect(mockedEmailVerifyRepo.create).not.toHaveBeenCalled();
    expect(mockedSendEmailVerificationOtp).not.toHaveBeenCalled();
  });

  it('★ เกินโควตา ต้องได้ก้อนตอบ "เท่ากันเป๊ะ" กับอีเมลที่ไม่มีในระบบ', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(null);
    const ghost = await authService.resendEmailVerification('nobody@example.com');

    mockedUserRepo.findByEmail.mockResolvedValue(unverifiedUser);
    mockedEmailVerifyRepo.countIssuedWithinLastHour.mockResolvedValue(99);
    const throttled = await authService.resendEmailVerification('test@example.com');

    expect(throttled).toEqual(ghost);
  });

  it('ไม่มีอีเมลนี้ → 200 เหมือนกัน แต่ไม่ส่งเมลและไม่เขียนฐาน', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(null);

    await expect(authService.resendEmailVerification('nobody@example.com'))
      .resolves.toEqual({ message: expect.any(String) });

    expect(mockedEmailVerifyRepo.create).not.toHaveBeenCalled();
    expect(mockedSendEmailVerificationOtp).not.toHaveBeenCalled();
  });

  it('ยืนยันไปแล้ว → 200 เหมือนกัน และไม่ส่งซ้ำ', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(verifiedUser);

    await authService.resendEmailVerification('test@example.com');

    expect(mockedSendEmailVerificationOtp).not.toHaveBeenCalled();
  });

  it('เคสไม่มีอีเมล กับ เคสยืนยันแล้ว ต้องได้ข้อความเดียวกันเป๊ะ', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(null);
    const a = await authService.resendEmailVerification('nobody@example.com');

    mockedUserRepo.findByEmail.mockResolvedValue(verifiedUser);
    const b = await authService.resendEmailVerification('test@example.com');

    expect(a).toEqual(b);
  });
});
