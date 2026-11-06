import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn() }));

import { requireAdmin } from '../requireAdmin.js';
import { requireAdmin_U } from '../requireAdmin_U.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import { AppError } from '../../utils/AppError.js';
import type { AdminScopeRow } from '../../types/db.js';

const findAdmin = vi.mocked(AdminRepo.findAdminByUserId);

const req = () => ({ user: { user_id: 42 } } as unknown as Request);
const res = () => ({} as Response);
const AT = new Date('2026-09-28T00:00:00Z');
const scope = (scope_type: AdminScopeRow['scope_type']): AdminScopeRow =>
  ({ admin_scope_id: 1, user_id: 42, scope_type, faculty_id: scope_type === 'faculty' ? 3 : null,
     created_at: AT, created_by: null });

const errorOf = (next: NextFunction) => (next as ReturnType<typeof vi.fn>).mock.calls[0]![0] as AppError;

beforeEach(() => vi.clearAllMocks());

/**
 * requireAdmin — ด่าน "เป็นแอดมินชั้นไหนก็เข้าได้" ต่างจาก requireAdmin_U (university_wide เท่านั้น)
 * และ requireAdminOversight (root + university_wide เท่านั้น) — ตัวนี้รับทั้งสามชั้น
 * แต่ละ service (listUsers/suspendUser/grantScope ฯลฯ) เป็นคนเช็คเองว่า scope ที่มีทำ action นั้นได้แค่ไหน
 */
describe('requireAdmin — รับแอดมินได้ทั้งสามชั้น (ต่างจาก requireAdmin_U และ requireAdminOversight)', () => {
  for (const type of ['root', 'university_wide', 'faculty'] as const) {
    it(`${type} ผ่าน และได้ req.admin`, async () => {
      const r = req(); const next = vi.fn() as NextFunction;
      findAdmin.mockResolvedValue(scope(type));

      await requireAdmin(r, res(), next);

      expect(next).toHaveBeenCalledWith();
      expect((r as any).admin).toEqual(scope(type));
    });
  }

  it('ไม่ใช่แอดมินเลยไม่ผ่าน — 403 INSUFFICIENT_ADMIN_SCOPE', async () => {
    const r = req(); const next = vi.fn() as NextFunction;
    findAdmin.mockResolvedValue(null);

    await requireAdmin(r, res(), next);

    expect(errorOf(next).status).toBe(403);
    expect(errorOf(next).code).toBe('INSUFFICIENT_ADMIN_SCOPE');
    expect((r as any).admin).toBeUndefined();
  });

  it('ถาม repo ด้วย user_id ไม่ใช่ทั้ง object', async () => {
    findAdmin.mockResolvedValue(scope('university_wide'));
    await requireAdmin({ user: { user_id: 777 } } as unknown as Request, res(), vi.fn() as NextFunction);
    expect(findAdmin).toHaveBeenCalledWith(777);
  });
});

/**
 * ★ requireAdmin ต้องรับ faculty ได้ ซึ่งเป็นจุดต่างสำคัญจาก requireAdmin_U —
 * ถ้าวันหนึ่งมีคนสลับให้ route ของ C2 (เช่น GET /admin/users) ไปใช้ requireAdmin_U แทน
 * แอดมินคณะจะเข้าหน้านี้ไม่ได้อีกเลยทั้งที่ควรเข้าได้ (เห็นแค่คณะตัวเอง) — เทสนี้ล็อกไว้ว่าสองด่านต่างกัน
 */
describe('requireAdmin ยอมรับ faculty ที่ requireAdmin_U ปฏิเสธ (เทสกันการสลับด่านผิด)', () => {
  it('faculty ผ่าน requireAdmin แต่ไม่ผ่าน requireAdmin_U', async () => {
    findAdmin.mockResolvedValue(scope('faculty'));
    const admitNext = vi.fn() as NextFunction;
    const strictNext = vi.fn() as NextFunction;

    await requireAdmin(req(), res(), admitNext);
    await requireAdmin_U(req(), res(), strictNext);

    expect(admitNext).toHaveBeenCalledWith();
    expect(errorOf(strictNext)).toBeInstanceOf(AppError);
    expect(errorOf(strictNext).status).toBe(403);
  });
});
