import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), insertAccepted: vi.fn(), reassign: vi.fn() }));
const connection = {
  beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), query: mocks.query,
};
vi.mock('../../config/db.js', () => ({ default: { getConnection: vi.fn(async () => connection), query: vi.fn() } }));
vi.mock('../matchReferee.repo.js', () => ({ insertAccepted: mocks.insertAccepted, reassign: mocks.reassign }));

import { apply } from '../refereeChangeRequest.repo.js';
import type { RefereeChangeRequestRow } from '../../types/db.js';

const req = (o: Partial<RefereeChangeRequestRow> = {}) => ({
  request_id: 1, tournament_id: 50, request_type: 'org_add_match', requested_by: 9003,
  referee_a_id: 11, referee_b_id: null, match_a_id: 7, match_b_id: null,
  a_status: 'accepted', b_status: 'not_required', request_status: 'open',
  created_at: new Date(), resolved_at: null, ...o,
}) as RefereeChangeRequestRow;

/** คิวรีที่ยกเลิกคำขออื่น — ตัวเดียวที่มีคำว่า 'cancelled' */
const cancelCall = () => mocks.query.mock.calls.find(([sql]) => String(sql).includes("'cancelled'"));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue([{ affectedRows: 1 }, []]);
  mocks.insertAccepted.mockResolvedValue(true);
  mocks.reassign.mockResolvedValue(true);
});

/**
 * FE-second-referee-request-cancelled (มติ 27 ก.ย. ทางเลือก ก)
 *
 * เดิม apply() ยกเลิกคำขอ open **ทุกชนิด** ที่อ้างแมตช์เดียวกัน · เหตุผลของการยกเลิกคือสมมติฐาน
 * "กรรมการ X ถือแมตช์ M อยู่" กลายเป็นเท็จ ซึ่งจริงกับการย้ายคน แต่ `org_add_match` ไม่มีสมมติฐานนั้น
 *
 * ผลของบั๊กเดิม: BR-10 บังคับกรรมการ 2 คนสำหรับแมตช์ onsite ที่เก็บสถิติ · ORG เชิญสองคนพร้อมกัน
 * คนแรกกดรับ → ใบของคนที่สองกลายเป็น cancelled → กดรับไม่ได้อีก → startMatch ตอบ
 * INSUFFICIENT_REFEREES ตลอดกาล และไม่มีประตูอื่นเพราะ F11 ถูกถอดไปแล้ว = แมตช์นั้นแข่งไม่ได้เลย
 */
describe('refereeChangeRequest.repo.apply — คำขออื่นที่ถูกยกเลิก', () => {
  it('ยกเลิกเฉพาะชนิดที่ย้ายคน ไม่แตะ org_add_match', async () => {
    await expect(apply(req())).resolves.toBe(true);

    const [sql, values] = cancelCall()!;
    expect(String(sql)).toContain("request_type IN ('ref_transfer', 'ref_swap', 'org_swap')");
    expect(String(sql)).not.toContain('org_add_match');
    expect(values).toEqual([1, [7], [7]]);
  });

  // หัวใจของข้อนี้: ใบเพิ่มกรรมการคนที่สองต้องรอดจากการ apply ของคนแรก
  it('ใบ org_add_match ของกรรมการคนที่สองบนแมตช์เดียวกันต้องไม่ถูกแตะ', async () => {
    await apply(req({ request_id: 1, referee_a_id: 11, match_a_id: 7 }));

    const [sql] = cancelCall()!;
    // เงื่อนไขชนิดตัด org_add_match ออกก่อนถึงเงื่อนไขแมตช์ ใบที่ 2 จึงยัง open
    expect(String(sql)).toMatch(/request_type IN \('ref_transfer', 'ref_swap', 'org_swap'\)[\s\S]*match_a_id IN/);
  });

  it('ย้ายคน (ref_transfer) ยังยกเลิกคำขอย้ายอื่นบนแมตช์เดียวกันเหมือนเดิม', async () => {
    await expect(apply(req({ request_type: 'ref_transfer', referee_b_id: 12 }))).resolves.toBe(true);

    expect(mocks.reassign).toHaveBeenCalledWith(connection, 7, 11, 12);
    expect(cancelCall()).toBeDefined();
  });

  it('สลับสองแมตช์ (ref_swap) ยกเลิกคำขอย้ายบนทั้งสองแมตช์', async () => {
    await expect(apply(req({ request_type: 'ref_swap', referee_b_id: 12, match_b_id: 9 }))).resolves.toBe(true);

    expect(mocks.reassign).toHaveBeenNthCalledWith(1, connection, 7, 11, 12);
    expect(mocks.reassign).toHaveBeenNthCalledWith(2, connection, 9, 12, 11);
    expect(cancelCall()![1]).toEqual([1, [7, 9], [7, 9]]);
  });

  it('ไม่ยกเลิกตัวเอง', async () => {
    await apply(req({ request_id: 42 }));
    const [sql, values] = cancelCall()!;
    expect(String(sql)).toContain('request_id <> ?');
    expect((values as unknown[])[0]).toBe(42);
  });

  /** ใบซ้ำของกรรมการคนเดิม: insertAccepted คืน false → rollback → service เป็นฝ่าย cancel เอง */
  it('คืน false และ rollback เมื่อกรรมการคนนั้นรับแมตช์นี้ไปแล้ว — ไม่เขียนอะไรเลย', async () => {
    mocks.insertAccepted.mockResolvedValue(false);

    await expect(apply(req())).resolves.toBe(false);

    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(cancelCall()).toBeUndefined();
  });

  it('คืน false เมื่อการย้ายล้มเหลว (สถานะจริงไม่ตรงกับคำขอแล้ว)', async () => {
    mocks.reassign.mockResolvedValue(false);

    await expect(apply(req({ request_type: 'ref_transfer', referee_b_id: 12 }))).resolves.toBe(false);
    expect(connection.rollback).toHaveBeenCalled();
  });

  it('คืน connection คืนแม้คิวรีโยน error', async () => {
    mocks.query.mockRejectedValue(new Error('boom'));

    await expect(apply(req())).rejects.toThrow('boom');
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });
});
