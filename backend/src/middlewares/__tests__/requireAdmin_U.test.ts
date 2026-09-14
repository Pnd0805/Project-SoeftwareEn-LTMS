import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../repositories/adminScope.repo.js', () => ({
  findAdminByUserId: vi.fn(),
}));

import { requireAdmin_U } from '../requireAdmin_U.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import { AppError } from '../../utils/AppError.js';
import type { UserRow, AdminScopeRow } from '../../types/db.js';

const mockedFindAdminByUserId = vi.mocked(AdminRepo.findAdminByUserId);

function makeReq(user: UserRow): Request {
  return { user } as unknown as Request;
}

function makeRes(): Response {
  return {} as Response;
}

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    user_id: 42,
    full_name: 'Test User',
    email: 'test@example.com',
    password_hash: 'hashed-password',
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
    ...overrides,
  };
}

const baseUser = makeUser();

const universityWideAdmin: AdminScopeRow = {
  admin_scope_id: 1,
  user_id: 42,
  scope_type: 'university_wide',
  faculty_id: null,
  created_at: new Date(),
  created_by: null,
};

const facultyAdmin: AdminScopeRow = {
  admin_scope_id: 2,
  user_id: 42,
  scope_type: 'faculty',
  faculty_id: 3,
  created_at: new Date(),
  created_by: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireAdmin_U middleware', () => {
  it('calls next with INSUFFICIENT_ADMIN_SCOPE when the user has no admin record', async () => {
    const req = makeReq(baseUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedFindAdminByUserId.mockResolvedValue(null);

    await requireAdmin_U(req, res, next);

    expect(mockedFindAdminByUserId).toHaveBeenCalledWith(42);
    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(403);
    expect(err.code).toBe('INSUFFICIENT_ADMIN_SCOPE');
    expect((req as any).admin).toBeUndefined();
  });

  it('calls next with INSUFFICIENT_ADMIN_SCOPE when the admin scope is not university_wide', async () => {
    const req = makeReq(baseUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedFindAdminByUserId.mockResolvedValue(facultyAdmin);

    await requireAdmin_U(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('INSUFFICIENT_ADMIN_SCOPE');
    expect((req as any).admin).toBeUndefined();
  });

  it('attaches req.admin and calls next() with no error for a university-wide admin', async () => {
    const req = makeReq(baseUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedFindAdminByUserId.mockResolvedValue(universityWideAdmin);

    await requireAdmin_U(req, res, next);

    expect((req as any).admin).toEqual(universityWideAdmin);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('passes req.user.user_id (not the whole user object) to the repo lookup', async () => {
    const req = makeReq(makeUser({ user_id: 777 }));
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedFindAdminByUserId.mockResolvedValue({ ...universityWideAdmin, user_id: 777 });

    await requireAdmin_U(req, res, next);

    expect(mockedFindAdminByUserId).toHaveBeenCalledWith(777);
  });
});
