import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), poolQuery: vi.fn(), respond: vi.fn() }));
const connection = {
  beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), query: mocks.query,
};
vi.mock('../../config/db.js', () => ({
  default: { getConnection: vi.fn(async () => connection), query: mocks.poolQuery },
}));
vi.mock('../matchReferee.repo.js', () => ({ respond: mocks.respond, insertPending: vi.fn() }));

import { accept, approveUser } from '../tournamentReferee.repo.js';
import { AppError } from '../../utils/AppError.js';

/** error จริงที่ mysql2 โยนเมื่อชน UNIQUE ของ migration 036 */
function dupError(indexName = 'uq_tr_active_once'){
  return Object.assign(new Error(`Duplicate entry '13-9002' for key 'tournament_referees.${indexName}'`),
                       { code: 'ER_DUP_ENTRY' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue([{ affectedRows: 1 }, []]);
  mocks.poolQuery.mockResolvedValue([{ affectedRows: 1 }, []]);
  mocks.respond.mockResolvedValue(undefined);
});

/**
 * migration 036 (OD-48) — UNIQUE uq_tr_active_once ห้ามคนเดียวกันมีแถว "ใช้งานได้"
 * เกินหนึ่งแถวต่อทัวร์ · ด่านในโค้ด (dabe9e3) กันขาเข้าแล้ว แต่เป็น read-then-write ไม่มีล็อก
 * ⇒ คำเชิญสองใบที่ยิงพร้อมกันผ่านได้ทั้งคู่ แล้วมาชนตอนกดรับ/ตอนแอดมินอนุมัติ
 * ซึ่งเป็นจังหวะที่ผู้ใช้เป็นคนกด ⇒ ต้องเป็น 409 ที่อ่านรู้เรื่อง ไม่ใช่ 500 จาก ER_DUP_ENTRY ดิบ
 */
describe('accept — ชน UNIQUE ของแถวที่ใช้งานได้', () => {
  it('แปลงเป็น 409 REFEREE_ALREADY_ACTIVE และ rollback', async () => {
    mocks.query.mockRejectedValueOnce(dupError());

    const err = await accept(49, [], { status: 'not_required', approvedBy: null, approvedAt: null, docs: null, reason: null })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(409);
    expect((err as AppError).code).toBe('REFEREE_ALREADY_ACTIVE');
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  // ตารางนี้อาจมี UNIQUE อื่นเพิ่มทีหลัง — ห้ามกลืน error ของกฎที่ไม่เกี่ยวกันมาตอบผิดเรื่อง
  it('ER_DUP_ENTRY ของ index อื่นต้องไม่ถูกแปลง', async () => {
    mocks.query.mockRejectedValueOnce(dupError('uq_some_other_rule'));

    const err = await accept(49, [], { status: 'not_required', approvedBy: null, approvedAt: null, docs: null, reason: null })
      .catch((e: unknown) => e);

    expect(err).not.toBeInstanceOf(AppError);
    expect((err as { code?: string }).code).toBe('ER_DUP_ENTRY');
  });

  it('error อื่นยังโยนต่อตามเดิม', async () => {
    const other = Object.assign(new Error('deadlock'), { code: 'ER_LOCK_DEADLOCK' });
    mocks.query.mockRejectedValueOnce(other);

    await expect(accept(49, [], { status: 'not_required', approvedBy: null, approvedAt: null, docs: null, reason: null }))
      .rejects.toBe(other);
  });

  it('ทางปกติไม่ถูกแตะ — commit และคืน true', async () => {
    await expect(accept(49, [7], { status: 'not_required', approvedBy: null, approvedAt: null, docs: null, reason: null }))
      .resolves.toBe(true);
    expect(connection.commit).toHaveBeenCalled();
  });
});

/**
 * AR02 อนุมัติ "คน" = UPDATE ทุกแถวของคนนั้นพร้อมกันข้ามทัวร์
 * ถ้าเขามีสองแถวรออยู่ในทัวร์เดียวกัน ทั้งคู่จะกลายเป็นใช้งานได้พร้อมกัน ⇒ ล้มทั้งก้อน
 * แอดมินต้องได้คำสั่งว่าต้องทำอะไรต่อ ไม่ใช่ 500
 */
describe('approveUser — ชน UNIQUE ของแถวที่ใช้งานได้', () => {
  it('แปลงเป็น 409 REFEREE_DUPLICATE_ROWS', async () => {
    mocks.poolQuery.mockRejectedValueOnce(dupError());

    const err = await approveUser(9002, 9001).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(409);
    expect((err as AppError).code).toBe('REFEREE_DUPLICATE_ROWS');
  });

  it('ER_DUP_ENTRY ของ index อื่นต้องไม่ถูกแปลง', async () => {
    mocks.poolQuery.mockRejectedValueOnce(dupError('uq_some_other_rule'));

    const err = await approveUser(9002, 9001).catch((e: unknown) => e);

    expect(err).not.toBeInstanceOf(AppError);
  });

  it('ทางปกติคืนจำนวนแถวที่อัปเดต', async () => {
    mocks.poolQuery.mockResolvedValueOnce([{ affectedRows: 3 }, []]);

    await expect(approveUser(9002, 9001)).resolves.toBe(3);
  });
});
