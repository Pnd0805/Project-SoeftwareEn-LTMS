import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * BR-07 ชั้น SQL — แอดมินอนุมัติโอนหัวหน้าทีม: เปลี่ยน leader_id และบันทึกผลการพิจารณาในธุรกรรมเดียว
 * (ถ้าเปลี่ยนหัวหน้าได้แต่บันทึกคำร้องไม่สำเร็จ คำร้องจะค้าง pending ให้อนุมัติซ้ำได้)
 */
const mocks = vi.hoisted(() => ({
  query: vi.fn((..._args: unknown[]) => Promise.resolve([{ affectedRows: 1 }, []] as unknown)),
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

import { approveTransferRequest, transferLeaderByAdmin } from '../adminScope.repo.js';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue([{ affectedRows: 1 }, []]);
});

describe('adminScope.repo approveTransferRequest — BR-07', () => {
  it('เปลี่ยนหัวหน้าทีม และบันทึกคำร้องเป็น approved พร้อมแอดมินผู้พิจารณา', async () => {
    await expect(approveTransferRequest(1, 300, 10, 8)).resolves.toBe(1);

    const [leaderSql, leaderValues] = mocks.query.mock.calls[0]!;
    expect(String(leaderSql)).toContain('UPDATE teams SET leader_id = ?');
    expect(leaderValues).toEqual([8, 10]);

    const [reqSql, reqValues] = mocks.query.mock.calls[1]!;
    expect(String(reqSql)).toMatch(/UPDATE team_admin_requests SET team_admin_request_status = \? , reviewed_by = \? , reviewed_at = NOW\(\)/);
    expect(reqValues).toEqual(['approved', 1, 300]);

    expect(mocks.commit).toHaveBeenCalledTimes(1);
  });

  it('บันทึกผลคำร้องล้ม → rollback การเปลี่ยนหัวหน้าด้วย', async () => {
    mocks.query
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockRejectedValueOnce(new Error('lock wait timeout'));

    await expect(approveTransferRequest(1, 300, 10, 8)).rejects.toThrow('lock wait timeout');
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
});

describe('adminScope.repo transferLeaderByAdmin — BR-07 บันทึกผลการพิจารณาเหมือนเส้นคำร้อง', () => {
  it("เปลี่ยนหัวหน้า และบันทึกคำร้อง leader_transfer สถานะ 'approved' โดยแอดมินคนนั้นทันที (audit trail เดียวกัน)", async () => {
    await expect(transferLeaderByAdmin(1, 10, 8)).resolves.toBe(1);
    expect(mocks.query.mock.calls[0]![1]).toEqual([8, 10]);
    const [insertSql, insertValues] = mocks.query.mock.calls[1]!;
    expect(String(insertSql)).toContain('INSERT INTO team_admin_requests');
    expect(insertValues).toEqual([10, 'leader_transfer', 1, 8, 'approved', 1]);
    expect(mocks.commit).toHaveBeenCalledTimes(1);
  });

  it('บันทึกคำร้องล้ม → rollback การเปลี่ยนหัวหน้าด้วย (ไม่มีการโอนที่ไม่มีร่องรอย)', async () => {
    mocks.query.mockResolvedValueOnce([{ affectedRows: 1 }, []]).mockRejectedValueOnce(new Error('fk fail'));
    await expect(transferLeaderByAdmin(1, 10, 8)).rejects.toThrow('fk fail');
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
