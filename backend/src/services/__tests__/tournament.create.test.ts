import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * BR-01 — การสร้างทัวร์นาเมนต์ต้องได้รับอนุญาตจากส่วนกลางคณะหรือ อบก. เสมอ ผู้ใช้สร้างเองโดยตรงไม่ได้
 *   ผลต่อการออกแบบ: ทัวร์ที่ยื่นขอต้องอยู่ในสถานะ pending_approval และห้ามข้ามขั้นตอนการอนุมัติ
 *
 * ★ ข้อยกเว้นเดียวคือ autoApproveIfOwnScope: คนยื่นเป็นแอดมินที่ครอบขอบเขตนั้นอยู่แล้ว
 *   ⇒ ยังเป็น "ส่วนกลางอนุมัติ" ตาม BR-01 แค่คนยื่นกับคนอนุมัติเป็นคนเดียวกัน · ผ่าน approveTournament ตัวเดียวกัน
 *   (เส้นที่ตรวจ pending_approval ใน WHERE) ไม่ได้เขียนสถานะ private ตรง ๆ
 * ส่วน SQL (insert บังคับ pending · approve/reject รับเฉพาะ pending) → repositories/__tests__/tournament.approval.test.ts
 */

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(), notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(), notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));
vi.mock('../../repositories/tournament.repo.js', () => ({
  insertTournament: vi.fn(async () => 77),
  approveTournament: vi.fn(async () => true),
  findTournamentById: vi.fn(),
}));
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn() }));
vi.mock('../../repositories/tournamentReferee.repo.js', () => ({}));
vi.mock('../../repositories/application.repo.js', () => ({}));
vi.mock('../../repositories/department.repo.js', () => ({}));
vi.mock('../../repositories/faculty.repo.js', () => ({
  findFacultyById: vi.fn(async (id: number) => (id < 100 ? { faculty_id: id, name: 'F' } : null)),
}));
vi.mock('../../repositories/sportType.repo.js', () => ({
  findSportTypeById: vi.fn(async (id: number) => (id === 1 ? { sport_type_id: 1, name: 'Football' } : null)),
}));
vi.mock('../referee.service.js', () => ({}));
vi.mock('../../repositories/user.repo.js', () => ({}));
vi.mock('../../mappers/tournament.mapper.js', () => ({}));
vi.mock('../../mappers/user.mapper.js', () => ({ toUserRef: vi.fn() }));

import * as Service from '../tournament.service.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as AdminScopeRepo from '../../repositories/adminScope.repo.js';
import type { AdminScopeRow } from '../../types/db.js';
import type { CreateTournamentInput } from '../../schemas/tournament.schema.js';

const DAY = 24 * 3600 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
const dateOnly = (offsetDays: number) => iso(offsetDays).slice(0, 10);

const input = (o: Partial<CreateTournamentInput> = {}) => ({
  name: 'ฟุตบอลคณะ',
  sportTypeId: 1,
  bracketFormat: 'single_elimination',
  scopeType: 'faculty',
  organizingFacultyId: 3,
  registrationStart: iso(1),
  registrationEnd: iso(10),
  eventStartDate: dateOnly(20),
  eventEndDate: dateOnly(21),
  maxTeams: 16,
  minTeams: 4,
  venue: 'สนามกลาง',
  genderRequirement: 'any',
  eligibilityRules: [],
  ...o,
}) as unknown as CreateTournamentInput;

beforeEach(() => vi.clearAllMocks());

describe('createTournament — BR-01 ต้องผ่านการอนุมัติเสมอ', () => {
  it('ผู้ใช้ทั่วไป → pending_approval และไม่มีการอนุมัติเกิดขึ้นเอง', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(null);

    await expect(Service.createTournament(input(), 9)).resolves.toEqual({
      id: 77, status: 'pending_approval', name: 'ฟุตบอลคณะ', autoApproved: false,
    });
    expect(TournamentRepo.approveTournament).not.toHaveBeenCalled();
  });

  it('บันทึกผู้ยื่นเป็นคนที่ล็อกอิน — ไม่ใช่ค่าที่ส่งมาใน body', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(null);
    await Service.createTournament({ ...input(), requestedByUserId: 1 } as never, 9);
    expect(TournamentRepo.insertTournament).toHaveBeenCalledWith(expect.objectContaining({ requestedByUserId: 9 }));
  });

  it('ส่งสถานะมาใน body ก็ไม่มีผล — repo ไม่รับฟิลด์สถานะเลย', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(null);
    await Service.createTournament({ ...input(), status: 'public', tournamentStatus: 'private' } as never, 9);
    const record = vi.mocked(TournamentRepo.insertTournament).mock.calls[0]![0] as unknown as Record<string, unknown>;
    expect(Object.keys(record).some(k => /status/i.test(k))).toBe(false);
  });

  it('แอดมินคณะที่ยื่นทัวร์ในคณะตัวเอง (จำกัดผู้สมัครเฉพาะคณะนี้) → อนุมัติผ่าน approveTournament (ไม่ข้ามขั้น) แล้วเป็น private', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'faculty', faculty_id: 3 } as AdminScopeRow);

    await expect(Service.createTournament(input({ eligibilityRules: [{ type: 'faculty', value: 3 }] }), 9))
      .resolves.toMatchObject({ status: 'private', autoApproved: true });
    expect(TournamentRepo.approveTournament).toHaveBeenCalledWith(77, 9);
  });

  it('แอดมินคณะ + ทัวร์ในคณะตัวเองแต่เปิดรับทุกคณะ → เกินอำนาจคณะ ⇒ ยัง pending_approval (รอแอดมินมหาวิทยาลัย)', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'faculty', faculty_id: 3 } as AdminScopeRow);

    await expect(Service.createTournament(input({ eligibilityRules: [] }), 9))
      .resolves.toMatchObject({ status: 'pending_approval', autoApproved: false });
    expect(TournamentRepo.approveTournament).not.toHaveBeenCalled();
  });

  it('แอดมินมหาวิทยาลัย → ครอบทุกขอบเขต ⇒ อนุมัติได้แม้เปิดรับทุกคณะ', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'university_wide', faculty_id: null } as AdminScopeRow);

    await expect(Service.createTournament(input({ eligibilityRules: [] }), 9))
      .resolves.toMatchObject({ status: 'private', autoApproved: true });
  });

  it('แอดมินคณะอื่น → ไม่ครอบขอบเขต ⇒ ยัง pending_approval', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'faculty', faculty_id: 5 } as AdminScopeRow);

    await expect(Service.createTournament(input({ eligibilityRules: [{ type: 'faculty', value: 3 }] }), 9)).resolves.toMatchObject({ status: 'pending_approval', autoApproved: false });
    expect(TournamentRepo.approveTournament).not.toHaveBeenCalled();
  });

  it('approveTournament ตอบ false (แถวไม่ได้อยู่ pending แล้ว) → รายงานว่าไม่ได้อนุมัติ', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'university_wide', faculty_id: null } as AdminScopeRow);
    vi.mocked(TournamentRepo.approveTournament).mockResolvedValueOnce(false);

    await expect(Service.createTournament(input(), 9)).resolves.toMatchObject({ status: 'pending_approval', autoApproved: false });
  });

  it.each([
    ['ไม่พบชนิดกีฬา', { sportTypeId: 999 }, 'VALIDATION_FAILED'],
    ['ไม่พบคณะ', { organizingFacultyId: 500 }, 'VALIDATION_FAILED'],
    ['ปิดรับสมัครก่อนเปิด', { registrationStart: iso(10), registrationEnd: iso(5) }, 'INVALID_DATE_RANGE'],
    ['วันแข่งก่อนปิดรับสมัคร', { eventStartDate: dateOnly(5) }, 'INVALID_DATE_RANGE'],
    ['ขั้นต่ำทีมมากกว่าสูงสุด', { minTeams: 20, maxTeams: 8 }, 'VALIDATION_FAILED'],
    ['อายุขั้นต่ำมากกว่าสูงสุด', { minAge: 30, maxAge: 18 }, 'VALIDATION_FAILED'],
  ])('คำขอไม่ถูกต้อง (%s) → ไม่สร้างแถวเลย', async (_label, patch, code) => {
    await expect(Service.createTournament(input(patch as Partial<CreateTournamentInput>), 9)).rejects.toMatchObject({ code });
    expect(TournamentRepo.insertTournament).not.toHaveBeenCalled();
  });
});
