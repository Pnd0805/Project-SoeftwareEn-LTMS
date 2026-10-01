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
    // includeWithdrawn = 0 โดยค่าเริ่มต้น ⇒ U14 ยังนับแค่ใบที่ approved (ไม่เปลี่ยนตัวเลขโปรไฟล์ใคร)
    expect(values).toEqual([9, 0, null, null]);
  });

  /** OD-47 — RW06 ใช้ repo ตัวเดียวกันโดยกรองทัวร์ ⇒ ตัวเลขชุดเดียวกับ U14 ไม่ใช่ SQL ชุดใหม่ */
  it('OD-47 — ส่ง tournamentId แล้วกรองเหลือทัวร์เดียว ด้วย SQL ชุดเดิม', async () => {
    mocks.query.mockResolvedValueOnce([[], []]);
    await findCareerByUser(9, 20);

    const [sql, values] = mocks.query.mock.calls[0]!;
    expect(sql).toContain('(? IS NULL OR t.tournament_id = ?)');
    expect(sql).toContain("ta.tournament_application_status = 'approved'");
    expect(values).toEqual([9, 0, 20, 20]);
  });

  /**
   * OD-47 ข้อ ก (2 ต.ค.) — RW06 นับใบที่ถอนตัวด้วย เพราะ M19 รายชื่อผู้เล่นแสดงคนของทีมที่ถอน
   * อยู่แล้ว (มติ 26 ก.ย.) ⇒ ถ้าไม่นับ ชื่อจะกดได้แต่กดไปเจอ 404
   */
  it('OD-47 — includeWithdrawn ส่ง 1 และ SQL รับใบที่ withdrawn ด้วย', async () => {
    mocks.query.mockResolvedValueOnce([[], []]);
    await findCareerByUser(9, 20, true);

    const [sql, values] = mocks.query.mock.calls[0]!;
    expect(sql).toContain("ta.tournament_application_status = 'withdrawn'");
    expect(values).toEqual([9, 1, 20, 20]);
  });

  // คิด has_approved เป็น MAX() ไม่ใส่ใน GROUP BY ⇒ คนที่ถอนแล้วสมัครใหม่ยังได้แถวเดียวต่อ (ทัวร์, ทีม)
  it('OD-47 — has_approved คิดเป็น MAX ไม่ได้อยู่ใน GROUP BY', async () => {
    mocks.query.mockResolvedValueOnce([[], []]);
    await findCareerByUser(9);

    const [sql] = mocks.query.mock.calls[0]!;
    expect(sql).toContain('AS has_approved');
    expect(sql).not.toContain('ta.tournament_application_status,');
  });
});
