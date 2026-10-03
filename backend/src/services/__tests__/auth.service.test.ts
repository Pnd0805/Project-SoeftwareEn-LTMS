import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock every dependency auth.service.ts imports ----
vi.mock('../../repositories/user.repo.js', () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updatePassword: vi.fn(),
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
}));

// ---- Import the module under test AFTER mocks are declared ----
import * as authService from '../auth.service.js';
import * as userRepo from '../../repositories/user.repo.js';
import * as passwordResetRepo from '../../repositories/passwordReset.repo.js';
import { findFacultyById } from '../../repositories/faculty.repo.js';
import { findDepartmentInFaculty } from '../../repositories/department.repo.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { signToken } from '../../utils/token.js';
import { sendPasswordResetEmail } from '../mail.service.js';
import { AppError } from '../../utils/AppError.js';
import type { RegisterInput } from '../../schemas/auth.schema.js';
import type { UserRow, PasswordResetTokenRow } from '../../types/db.js';

const mockedUserRepo = vi.mocked(userRepo);
const mockedPasswordResetRepo = vi.mocked(passwordResetRepo);
const mockedFindFacultyById = vi.mocked(findFacultyById);
const mockedFindDepartmentInFaculty = vi.mocked(findDepartmentInFaculty);
const mockedHashPassword = vi.mocked(hashPassword);
const mockedVerifyPassword = vi.mocked(verifyPassword);
const mockedSignToken = vi.mocked(signToken);
const mockedSendPasswordResetEmail = vi.mocked(sendPasswordResetEmail);

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
  notification_prefs: null,
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
      }),
    );
    expect(result).toEqual({
      id: 42,
      fullName: registerInput.fullName,
      email: registerInput.email,
    });
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
    mockedSendPasswordResetEmail.mockRejectedValue(new Error('SMTP down'));

    await expect(authService.forgotPassword(baseUser.email)).resolves.toEqual({
      message: 'ถ้าอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว',
    });
  });

  it('ขอครั้งที่ 4 ในชั่วโมงเดียว: ถูกปฏิเสธด้วย RATE_LIMITED', async () => {
    mockedUserRepo.findByEmail.mockResolvedValue(baseUser);
    mockedPasswordResetRepo.countIssuedWithinLastHour.mockResolvedValue(3);

    await expect(authService.forgotPassword(baseUser.email)).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
    });

    expect(mockedPasswordResetRepo.create).not.toHaveBeenCalled();
    expect(mockedSendPasswordResetEmail).not.toHaveBeenCalled();
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
