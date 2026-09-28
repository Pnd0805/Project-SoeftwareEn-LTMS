import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/oversight.repo.js', () => ({
  findStalledDisputes: vi.fn(),
  findComplaintsAwaitingAdmin: vi.fn(),
  countUniversityAdmins: vi.fn(),
}));

import { getStalledWork } from '../oversight.service.js';
import * as OversightRepo from '../../repositories/oversight.repo.js';
import { ORG_RESOLVE_HOURS } from '../../config/scoring.js';

const setup = (disputes: number[], complaints: number[], admins: { total: number; active: number }) => {
  vi.mocked(OversightRepo.findStalledDisputes).mockResolvedValue(disputes);
  vi.mocked(OversightRepo.findComplaintsAwaitingAdmin).mockResolvedValue(complaints);
  vi.mocked(OversightRepo.countUniversityAdmins).mockResolvedValue(admins);
};

beforeEach(() => vi.clearAllMocks());

/**
 * OD-34 — root ต้องเห็นว่ามีอะไรค้าง ไม่งั้นเป็นบัญชีทุบกระจกฉุกเฉินที่มองไม่เห็นกระจก
 * audit log บอกว่า *เกิดอะไรขึ้นแล้ว* แต่เรื่องที่ค้างคือเรื่องที่ไม่มี log
 */
describe('getStalledWork — ตัวเลขที่ต้องคืน', () => {
  it('คืนจำนวนกับ id ของทั้งสามก้อน และบอกเส้นเวลาที่ใช้', async () => {
    setup([88, 91, 102], [7], { total: 3, active: 3 });

    const out = await getStalledWork();

    expect(out.thresholdHours).toBe(ORG_RESOLVE_HOURS);
    expect(out.disputesPastDeadline).toEqual({ count: 3, matchIds: [88, 91, 102] });
    expect(out.complaintsAwaitingAdmin).toEqual({ count: 1, complaintIds: [7] });
    expect(out.universityAdmins).toEqual({ total: 3, active: 3 });
  });

  it('ไม่มีของค้างเลยก็ยังตอบ 0 ไม่ใช่ undefined — FE จะได้ไม่ต้องเช็ค null', async () => {
    setup([], [], { total: 1, active: 1 });

    const out = await getStalledWork();

    expect(out.disputesPastDeadline).toEqual({ count: 0, matchIds: [] });
    expect(out.complaintsAwaitingAdmin).toEqual({ count: 0, complaintIds: [] });
    expect(out.needsAttention).toBe(false);
  });

  /**
   * ★ ตัวเลขที่สำคัญที่สุด — LAST_UNIVERSITY_ADMIN รับประกันว่า **มี** แอดมินเหลือ
   * แต่ไม่ได้รับประกันว่าคนนั้น **ใช้งานได้** · active = 0 ทั้งที่ total > 0 คือระบบตัน
   */
  it('มีของค้าง + ไม่มีแอดมินที่ใช้งานได้เลย → needsAttention', async () => {
    setup([88], [], { total: 2, active: 0 });

    expect((await getStalledWork()).needsAttention).toBe(true);
  });

  it('ไม่มีแอดมินที่ใช้งานได้ แต่ก็ไม่มีของค้าง → ยังไม่ต้องปลุกใคร', async () => {
    setup([], [], { total: 2, active: 0 });

    expect((await getStalledWork()).needsAttention).toBe(false);
  });

  it('มีของค้างแต่ยังมีแอดมินกดได้ → ไม่ใช่เรื่องของ root', async () => {
    setup([88, 91], [7], { total: 2, active: 1 });

    expect((await getStalledWork()).needsAttention).toBe(false);
  });

  it('เรื่องร้องเรียนอย่างเดียวก็นับเป็นของค้าง', async () => {
    setup([], [7], { total: 1, active: 0 });

    expect((await getStalledWork()).needsAttention).toBe(true);
  });
});

/**
 * ★ เส้นแบ่ง "เห็น" กับ "ทำ" — root เป็นคนตรวจ ไม่ใช่คนตัดสิน
 * ถ้าวันหนึ่งมีคนเติมเนื้อหาเข้ามาให้ "สะดวกขึ้น" เทสนี้จะแดง
 */
describe('getStalledWork — ต้องไม่รั่วเนื้อหาของเรื่อง', () => {
  it('ไม่มีเหตุผล หลักฐาน หรือชื่อคู่กรณีอยู่ใน payload เลย', async () => {
    setup([88], [7], { total: 1, active: 1 });

    const json = JSON.stringify(await getStalledWork());

    for (const leaked of ['reason', 'evidence', 'fullName', 'full_name', 'statement', 'filedBy', 'filed_by']) {
      expect(json).not.toContain(leaked);
    }
  });

  it('คิวรีทั้งสามยิงขนานกันและไม่รับพารามิเตอร์จากผู้เรียก', async () => {
    setup([], [], { total: 1, active: 1 });

    await getStalledWork();

    expect(OversightRepo.findStalledDisputes).toHaveBeenCalledWith();
    expect(OversightRepo.findComplaintsAwaitingAdmin).toHaveBeenCalledWith();
    expect(OversightRepo.countUniversityAdmins).toHaveBeenCalledWith();
  });
});
