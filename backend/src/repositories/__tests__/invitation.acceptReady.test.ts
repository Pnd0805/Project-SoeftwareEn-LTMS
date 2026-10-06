import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * BR-04 — Create Team → Invite → Members Confirm แล้วจึงเป็น Ready
 *   "ทีมจะมีสถานะ Ready เมื่อจำนวนสมาชิกถึงขั้นต่ำของประเภทกีฬานั้น"
 *
 * จุดที่ทีมกลายเป็น Ready มีที่เดียว: createAcceptInvite (ตอบรับคำเชิญ) ซึ่งนับสมาชิกในธุรกรรมเดียวกับการเพิ่มคน
 * ขาย้อนกลับ (ถอดสมาชิกจนต่ำกว่าขั้นต่ำ → Forming) มีเทสแล้วใน team.service.test.ts
 * ด่าน "ทีมที่ยังไม่ Ready สมัครแข่งไม่ได้" มีเทสแล้วใน application.service.test.ts
 */
const mocks = vi.hoisted(() => ({
  query: vi.fn((..._args: unknown[]) => Promise.resolve([{ affectedRows: 1, insertId: 500 }, []] as unknown)),
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

import { createAcceptInvite } from '../invitation.repo.js';

function setup(memberCountAfterJoin: number, minMembers: number) {
  mocks.query.mockImplementation(async (sql: unknown) => {
    const s = String(sql);
    if (s.includes('count(*) as memberCount')) return [[{ memberCount: memberCountAfterJoin }], []];
    if (s.includes('SELECT s.min_members')) return [[{ min_members: minMembers }], []];
    if (s.includes('INSERT INTO team_members')) return [{ insertId: 500, affectedRows: 1 }, []];
    return [{ affectedRows: 1 }, []];
  });
}
const readyUpdates = () => mocks.query.mock.calls.filter(([sql]) => String(sql).includes('SET readiness_status'));

beforeEach(() => vi.clearAllMocks());

describe('createAcceptInvite — BR-04 ทีมเป็น Ready เมื่อสมาชิกถึงขั้นต่ำของกีฬา', () => {
  it.each([
    ['ยังไม่ถึง (4 จาก 5)', 4, 5, false],
    ['ถึงพอดี (5 จาก 5)', 5, 5, true],
    ['เกินขั้นต่ำ (6 จาก 5)', 6, 5, true],
    ['กีฬาเดี่ยว/คู่ ขั้นต่ำ 2 · คนที่สองกดรับ', 2, 2, true],
    ['กีฬาทีมใหญ่ ขั้นต่ำ 11 · มีแค่ 10', 10, 11, false],
  ])('%s → Ready = %s', async (_label, count, min, becomesReady) => {
    setup(count, min);
    await expect(createAcceptInvite(1, 10, 7)).resolves.toBe(500);
    expect(readyUpdates()).toHaveLength(becomesReady ? 1 : 0);
    if (becomesReady) expect(readyUpdates()[0]![1]).toEqual(['Ready', 10]);
  });

  it('นับสมาชิก "หลัง" เพิ่มคนที่กดรับเข้าไปแล้ว — ไม่ใช่ก่อน', async () => {
    setup(5, 5);
    await createAcceptInvite(1, 10, 7);
    const order = mocks.query.mock.calls.map(([sql]) => String(sql));
    const inserted = order.findIndex(s => s.includes('INSERT INTO team_members'));
    const counted = order.findIndex(s => s.includes('count(*) as memberCount'));
    expect(inserted).toBeGreaterThanOrEqual(0);
    expect(counted).toBeGreaterThan(inserted);
  });

  it('ขั้นต่ำมาจากชนิดกีฬาของทีมนั้น (JOIN teams → sport_types) ไม่ใช่ค่าตายตัว', async () => {
    setup(5, 5);
    await createAcceptInvite(1, 10, 7);
    const minQuery = mocks.query.mock.calls.find(([sql]) => String(sql).includes('SELECT s.min_members'))!;
    expect(String(minQuery[0])).toContain('JOIN teams t ON t.sport_type_id = s.sport_type_id');
    expect(minQuery[1]).toEqual([10]);
  });

  it('รับเฉพาะคำเชิญที่ยัง pending และยังไม่หมดอายุ', async () => {
    setup(1, 5);
    await createAcceptInvite(1, 10, 7);
    const accept = mocks.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE team_invitations'))!;
    expect(String(accept[0])).toMatch(/expires_at > NOW\(\) AND team_invitation_status = \?/);
    expect(accept[1]).toEqual(['accepted', 1, 'pending']);
  });

  it('เพิ่มสมาชิกไม่สำเร็จ (เช่น เป็นสมาชิกอยู่แล้ว) → rollback ทั้งก้อน ทีมไม่เปลี่ยนสถานะ', async () => {
    mocks.query.mockImplementation(async (sql: unknown) => {
      if (String(sql).includes('INSERT INTO team_members')) throw new Error('ER_DUP_ENTRY');
      return [{ affectedRows: 1 }, []];
    });
    await expect(createAcceptInvite(1, 10, 7)).rejects.toThrow('ER_DUP_ENTRY');
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(readyUpdates()).toHaveLength(0);
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
});
