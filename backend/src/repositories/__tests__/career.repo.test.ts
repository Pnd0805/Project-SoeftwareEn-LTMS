import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));

import { findCareerByUser } from '../career.repo.js';

beforeEach(() => vi.clearAllMocks());

describe('career.repo', () => {
  it('builds career only from approved applications and verified match results', async () => {
    mocks.query.mockResolvedValueOnce([[], []]);
    await findCareerByUser(9);

    const [sql, values] = mocks.query.mock.calls[0]!;
    expect(sql).toContain("ta.tournament_application_status = 'approved'");
    expect(sql).toContain("mr.match_result_status = 'verified'");
    expect(sql).toContain('t.deleted_at IS NULL');
    expect(sql).not.toContain("mr.match_result_status = 'walkover'");
    // OD-47 — ไม่ส่ง tournamentId = NULL ทั้งคู่ ⇒ `(? IS NULL OR ...)` ปล่อยผ่าน ได้ทุกทัวร์เหมือนเดิม
    expect(values).toEqual([9, null, null]);
  });

  /** OD-47 — RW06 ใช้ repo ตัวเดียวกันโดยกรองทัวร์ ⇒ ตัวเลขชุดเดียวกับ U14 ไม่ใช่ SQL ชุดใหม่ */
  it('OD-47 — ส่ง tournamentId แล้วกรองเหลือทัวร์เดียว ด้วย SQL ชุดเดิม', async () => {
    mocks.query.mockResolvedValueOnce([[], []]);
    await findCareerByUser(9, 20);

    const [sql, values] = mocks.query.mock.calls[0]!;
    expect(sql).toContain('(? IS NULL OR t.tournament_id = ?)');
    expect(sql).toContain("ta.tournament_application_status = 'approved'");
    expect(values).toEqual([9, 20, 20]);
  });
});
