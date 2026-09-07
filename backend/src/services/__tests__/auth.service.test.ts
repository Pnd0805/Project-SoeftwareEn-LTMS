import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock every dependency auth.service.ts imports ----
vi.mock('../../repositories/user.repo.js', () => ({
  findByEmail: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../../repositories/faculty.repo.js', () => ({
  findFacultyById: vi.fn(),
}));

vi.mock('../../repositories/department.repo.js', () => ({
  findDepartmentInFaculty: vi.fn(),
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

// ---- Import the module under test AFTER mocks are declared ----
import * as authService from '../auth.service.js';
import * as userRepo from '../../repositories/user.repo.js';
import { findFacultyById } from '../../repositories/faculty.repo.js';
import { findDepartmentInFaculty } from '../../repositories/department.repo.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { signToken } from '../../utils/token.js';
import { AppError } from '../../utils/AppError.js';
import type { RegisterInput } from '../../schemas/auth.schema.js';
import type { UserRow } from '../../types/db.js';

const mockedUserRepo = vi.mocked(userRepo);
const mockedFindFacultyById = vi.mocked(findFacultyById);
const mockedFindDepartmentInFaculty = vi.mocked(findDepartmentInFaculty);
const mockedHashPassword = vi.mocked(hashPassword);
const mockedVerifyPassword = vi.mocked(verifyPassword);
const mockedSignToken = vi.mocked(signToken);

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
});
