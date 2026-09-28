import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn() }));

import { requireAdminOversight } from '../requireAdminOversight.js';
import { requireAdmin_U } from '../requireAdmin_U.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import { AppError } from '../../utils/AppError.js';
import type { AdminScopeRow } from '../../types/db.js';

const findAdmin = vi.mocked(AdminRepo.findAdminByUserId);

const req = () => ({ user: { user_id: 42 } } as unknown as Request);
const res = () => ({} as Response);
const scope = (scope_type: AdminScopeRow['scope_type']): AdminScopeRow =>
  ({ admin_scope_id: 1, user_id: 42, scope_type, faculty_id: scope_type === 'faculty' ? 3 : null,
     created_at: new Date(), created_by: null });

const errorOf = (next: NextFunction) => (next as ReturnType<typeof vi.fn>).mock.calls[0]![0] as AppError;

beforeEach(() => vi.clearAllMocks());

/**
 * OD-34 — ด่าน "อ่านได้" ของชั้นกำกับดูแล
 * root ถูกกันออกจากงานประจำวันทั้งหมด แต่ต้องเห็นว่ามีอะไรค้างจนต้องแต่งตั้งคนใหม่
 */
describe('requireAdminOversight — ใครอ่านคิวที่ค้างได้', () => {
  for (const type of ['root', 'university_wide'] as const) {
    it(`${type} ผ่าน และได้ req.admin`, async () => {
      const r = req(); const next = vi.fn() as NextFunction;
      findAdmin.mockResolvedValue(scope(type));

      await requireAdminOversight(r, res(), next);

      expect(next).toHaveBeenCalledWith();
      expect((r as any).admin).toEqual(scope(type));
    });
  }

  it('แอดมินคณะไม่ผ่าน — audit/คิวไม่มี faculty_id ผูกตรงให้ scope ได้', async () => {
    const r = req(); const next = vi.fn() as NextFunction;
    findAdmin.mockResolvedValue(scope('faculty'));

    await requireAdminOversight(r, res(), next);

    expect(errorOf(next).status).toBe(403);
    expect(errorOf(next).code).toBe('INSUFFICIENT_ADMIN_SCOPE');
    expect((r as any).admin).toBeUndefined();
  });

  it('ไม่ใช่แอดมินเลยไม่ผ่าน', async () => {
    const r = req(); const next = vi.fn() as NextFunction;
    findAdmin.mockResolvedValue(null);

    await requireAdminOversight(r, res(), next);

    expect(errorOf(next).status).toBe(403);
    expect((r as any).admin).toBeUndefined();
  });

  it('ถาม repo ด้วย user_id ไม่ใช่ทั้ง object', async () => {
    findAdmin.mockResolvedValue(scope('root'));
    await requireAdminOversight({ user: { user_id: 777 } } as unknown as Request, res(), vi.fn() as NextFunction);
    expect(findAdmin).toHaveBeenCalledWith(777);
  });
});

/**
 * ★ ข้อที่ห้ามพลาด — เหตุผลทั้งหมดที่ requireAdminOversight ต้องเป็นคนละตัวกับ requireAdmin_U
 *
 * ถ้าวันหนึ่งมีคนเติม root เข้าไปใน requireAdmin_U เพื่อให้ root "เห็น" อะไรสักอย่าง
 * root จะได้อำนาจ **กด** อนุมัติทีม official / กรรมการภายนอก / ลบความเห็น / วินิจฉัยเรื่องร้องเรียน
 * มาด้วยทั้งชุด ซึ่งขัดมติ OD-34 ตรง ๆ · เทสนี้จะแดงทันทีถ้าเกิดขึ้น
 */
describe('requireAdmin_U ยังกัน root ไว้เหมือนเดิม (regression ของ OD-34)', () => {
  it('root ไม่ผ่านด่าน "กดได้"', async () => {
    const r = req(); const next = vi.fn() as NextFunction;
    findAdmin.mockResolvedValue(scope('root'));

    await requireAdmin_U(r, res(), next);

    expect(errorOf(next).status).toBe(403);
    expect(errorOf(next).code).toBe('INSUFFICIENT_ADMIN_SCOPE');
    expect((r as any).admin).toBeUndefined();
  });

  it('สองด่านนี้ตอบ root ต่างกัน — อ่านได้ แต่กดไม่ได้', async () => {
    findAdmin.mockResolvedValue(scope('root'));
    const readNext = vi.fn() as NextFunction;
    const writeNext = vi.fn() as NextFunction;

    await requireAdminOversight(req(), res(), readNext);
    await requireAdmin_U(req(), res(), writeNext);

    expect(readNext).toHaveBeenCalledWith();
    expect(errorOf(writeNext)).toBeInstanceOf(AppError);
  });
});
