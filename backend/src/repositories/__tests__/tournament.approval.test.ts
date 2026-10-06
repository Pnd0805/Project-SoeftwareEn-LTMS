import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * BR-01 ชั้น SQL — "ทัวร์ที่ยื่นขอต้องอยู่ในสถานะ pending_approval และห้ามข้ามขั้นตอนการอนุมัติ"
 *
 *   ① insert เขียน 'pending_approval' เป็นค่าคงที่ใน SQL — ไม่ใช่พารามิเตอร์ที่ใครส่งค่าอื่นมาได้
 *   ② approve/reject เปลี่ยนสถานะได้เฉพาะแถวที่ยัง pending_approval อยู่
 *      ⇒ อนุมัติซ้ำ · อนุมัติทัวร์ที่ถูกปฏิเสธแล้ว · ปฏิเสธทัวร์ที่อนุมัติแล้ว → ไม่มีผล (คืน false)
 *   ③ audit เขียนเฉพาะเมื่อเปลี่ยนสถานะได้จริง
 */
const mocks = vi.hoisted(() => ({
  query: vi.fn((..._args: unknown[]) => Promise.resolve([{ affectedRows: 1, insertId: 77 }, []] as unknown)),
  beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
}));
vi.mock('../../config/db.js', () => ({
  default: {
    query: mocks.query,
    getConnection: () => Promise.resolve({
      query: mocks.query, beginTransaction: mocks.beginTransaction,
      commit: mocks.commit, rollback: mocks.rollback, release: mocks.release,
    }),
  },
}));
vi.mock('../reward.repo.js', () => ({}));

import { insertTournament, approveTournament, rejectTournament } from '../tournament.repo.js';

const calls = () => mocks.query.mock.calls.map(([sql, values]) => ({ sql: String(sql), values: values as unknown[] }));
const auditCalls = () => calls().filter(c => c.sql.includes('INSERT INTO audit_logs'));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue([{ affectedRows: 1, insertId: 77 }, []]);
});

describe('insertTournament — ① เกิดมาเป็น pending_approval เสมอ', () => {
  const record = {
    name: 'T', sportTypeId: 1, bracketFormat: 'single_elimination', bestOf: null, scopeType: 'faculty',
    organizingFacultyId: 3, organizingDepartmentId: null, requestedByUserId: 9,
    registrationStart: '2026-11-01T00:00:00Z', registrationEnd: '2026-11-10T00:00:00Z',
    eventStartDate: '2026-11-20', eventEndDate: '2026-11-21', maxTeams: 16, minTeams: 4, venue: 'V',
    entryNotes: null, genderRequirement: 'any', minAge: null, maxAge: null, disputeWindowHours: null,
    eligibilityRules: [],
  } as never;

  it("สถานะเป็นค่าคงที่ 'pending_approval' ใน SQL และไม่เปิดรับสมัคร", async () => {
    await expect(insertTournament(record)).resolves.toBe(77);
    const insert = calls().find(c => c.sql.includes('INSERT INTO tournaments'))!;
    expect(insert.sql).toMatch(/'pending_approval', FALSE\)\s*$/);
    // ไม่มีค่าสถานะใดในพารามิเตอร์ — ถ้ามีคนเปลี่ยนเป็น ? แล้วส่งค่ามา เทสนี้จะพัง
    expect(insert.values).not.toContain('private');
    expect(insert.values).not.toContain('public');
    expect(insert.values).not.toContain('pending_approval');
  });

  it('ผู้ยื่นถูกบันทึกเป็น requested_by_user_id', async () => {
    await insertTournament(record);
    const insert = calls().find(c => c.sql.includes('INSERT INTO tournaments'))!;
    expect(insert.values[8]).toBe(9);
  });
});

describe.each([
  ['approveTournament', () => approveTournament(50, 1), 'private', 'tournament_approved'],
  ['rejectTournament', () => rejectTournament(50, 1, 'สนามไม่ว่าง'), 'rejected', 'tournament_rejected'],
] as const)('%s — ② รับเฉพาะทัวร์ที่ยัง pending_approval', (_name, run, toStatus, auditAction) => {
  it(`เปลี่ยนเป็น '${toStatus}' เฉพาะแถวที่ยัง pending_approval และยังไม่ถูกลบ`, async () => {
    await expect(run()).resolves.toBe(true);
    const update = calls().find(c => c.sql.includes('UPDATE tournaments'))!;
    expect(update.sql).toContain(`tournament_status = '${toStatus}'`);
    expect(update.sql).toMatch(/WHERE tournament_id = \? AND tournament_status = 'pending_approval' AND deleted_at IS NULL/);
  });

  it('③ สำเร็จ → เขียน audit ในธุรกรรมเดียวกัน', async () => {
    await run();
    expect(auditCalls()).toHaveLength(1);
    expect(auditCalls()[0]!.values.slice(0, 4)).toEqual([1, auditAction, 'tournament', 50]);
    expect(mocks.commit).toHaveBeenCalledTimes(1);
  });

  it('แถวไม่ได้อยู่ pending แล้ว (ตัดสินไปแล้ว/ข้ามขั้น) → false และไม่เขียน audit', async () => {
    mocks.query.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
    await expect(run()).resolves.toBe(false);
    expect(auditCalls()).toHaveLength(0);
  });

  it('ฐานล้ม → rollback และคืน connection', async () => {
    mocks.query.mockRejectedValueOnce(new Error('db down'));
    await expect(run()).rejects.toThrow('db down');
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
});
