import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const connection = {
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  query,
};

vi.mock('../../config/db.js', () => ({
  default: { getConnection: vi.fn(async () => connection), query: vi.fn() },
}));

import { closeCheckin } from '../walkover.repo.js';

const ORG = 9003;

beforeEach(() => {
  vi.clearAllMocks();
});

/** คิวรีตามลำดับจริง: UPDATE matches → DELETE match_checkins → INSERT audit_logs */
function mockQueries(updated: number, deleted: number) {
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('UPDATE matches')) return [{ affectedRows: updated }, []];
    if (sql.includes('DELETE FROM match_checkins')) return [{ affectedRows: deleted }, []];
    return [{ affectedRows: 1, insertId: 1 }, []];
  });
}

/**
 * มติ 27 ก.ย. — ปิดเช็คอินลบ `match_checkins` ทุกแถวทิ้ง ผู้เล่นที่เช็คอินแล้วต้องทำใหม่หมด
 * เดิมเป็นช่องเดียวในวงจรแมตช์ที่ลบข้อมูลของผู้ใช้แล้วไม่บันทึกอะไรเลย (ไม่รับ userId ด้วยซ้ำ)
 * ผู้เล่นมาบอกว่า "เช็คอินแล้วหาย" ก็ไล่ไม่ได้ว่าใครกดเมื่อไร
 */
describe('walkover.repo.closeCheckin', () => {
  it('records who closed it and how many check-ins that destroyed', async () => {
    mockQueries(1, 10);

    await expect(closeCheckin(1, ORG)).resolves.toBe(true);

    const audit = query.mock.calls.find(([sql]) => String(sql).includes('audit_logs'));
    expect(audit).toBeDefined();
    expect(audit![1]).toEqual([ORG, 1, JSON.stringify({ deletedCheckins: 10 })]);
    expect(String(audit![0])).toContain("'match_checkin_closed'");
    expect(connection.commit).toHaveBeenCalled();
  });

  it('records a zero when there was nothing to delete', async () => {
    mockQueries(1, 0);

    await closeCheckin(1, ORG);

    const audit = query.mock.calls.find(([sql]) => String(sql).includes('audit_logs'));
    expect(audit![1]![2]).toBe(JSON.stringify({ deletedCheckins: 0 }));
  });

  // สถานะเปลี่ยนไปแล้ว (กดพร้อมกัน) — ต้องไม่ลบอะไรและไม่เขียน audit ปลอม
  it('writes nothing at all when the match is no longer open for check-in', async () => {
    mockQueries(0, 0);

    await expect(closeCheckin(1, ORG)).resolves.toBe(false);

    expect(query.mock.calls.some(([sql]) => String(sql).includes('DELETE FROM match_checkins'))).toBe(false);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('audit_logs'))).toBe(false);
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it('releases the connection even when a query throws', async () => {
    query.mockRejectedValue(new Error('boom'));

    await expect(closeCheckin(1, ORG)).rejects.toThrow('boom');
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });
});
