import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../utils/token.js', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('../../repositories/user.repo.js', () => ({
  findById: vi.fn(),
}));

import { requireAuth } from '../requireAuth.js';
import { verifyToken } from '../../utils/token.js';
import { findById } from '../../repositories/user.repo.js';
import { AppError } from '../../utils/AppError.js';
import type { UserRow } from '../../types/db.js';

const mockedVerifyToken = vi.mocked(verifyToken);
const mockedFindById = vi.mocked(findById);

function makeReq(authHeader?: string): Request {
  return {
    headers: { authorization: authHeader },
  } as unknown as Request;
}

function makeRes(): Response {
  return {} as Response;
}

const activeUser: UserRow = {
  user_id: 7,
  full_name: 'Active User',
  email: 'active@example.com',
  password_hash: 'hash',
  gender: 'other',
  birth_date: '1999-01-01',
  user_type: 'student',
  faculty_id: 1,
  department_id: 1,
  year: 3,
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireAuth middleware', () => {
  it('calls next with NO_TOKEN when Authorization header is missing', async () => {
    const req = makeReq(undefined);
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(401);
    expect(err.code).toBe('NO_TOKEN');
    expect(mockedVerifyToken).not.toHaveBeenCalled();
  });

  it('calls next with NO_TOKEN when the scheme is not "Bearer"', async () => {
    const req = makeReq('Basic abc123');
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.code).toBe('NO_TOKEN');
    expect(mockedVerifyToken).not.toHaveBeenCalled();
  });

  it('calls next with NO_TOKEN when "Bearer" has no token after it', async () => {
    const req = makeReq('Bearer');
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.code).toBe('NO_TOKEN');
    expect(mockedVerifyToken).not.toHaveBeenCalled();
  });

  it('rejects (does not call next) when verifyToken throws for an invalid/expired token', async () => {
    const req = makeReq('Bearer bad.token.here');
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    const tokenError = new AppError(401, 'TOKEN_EXPIRED', 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    mockedVerifyToken.mockImplementation(() => {
      throw tokenError;
    });

    await expect(requireAuth(req, res, next)).rejects.toBe(tokenError);
    expect(next).not.toHaveBeenCalled();
    expect(mockedFindById).not.toHaveBeenCalled();
  });

  it('calls next with USER_NOT_FOUND when the token is valid but the user no longer exists', async () => {
    const req = makeReq('Bearer valid.token');
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedVerifyToken.mockReturnValue({ sub: '7' });
    mockedFindById.mockResolvedValue(null);

    await requireAuth(req, res, next);

    expect(mockedFindById).toHaveBeenCalledWith(7);
    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(401);
    expect(err.code).toBe('USER_NOT_FOUND');
  });

  it('calls next with ACCOUNT_SUSPENDED when the user is suspended', async () => {
    const req = makeReq('Bearer valid.token');
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedVerifyToken.mockReturnValue({ sub: '7' });
    mockedFindById.mockResolvedValue({ ...activeUser, is_suspended: 1 });

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('ACCOUNT_SUSPENDED');
    expect(req.user).toBeUndefined();
  });

  it('attaches req.user and calls next() with no error for a valid, active user', async () => {
    const req = makeReq('Bearer valid.token');
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedVerifyToken.mockReturnValue({ sub: '7' });
    mockedFindById.mockResolvedValue(activeUser);

    await requireAuth(req, res, next);

    expect(req.user).toEqual(activeUser);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});
