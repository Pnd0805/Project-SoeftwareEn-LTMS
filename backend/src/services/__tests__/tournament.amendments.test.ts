import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(),
  notifyUsers: vi.fn(),
  notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(),
  notifyTournamentReferees: vi.fn(),
  notifyMatchResultParties: vi.fn(),
}));

vi.mock('../../repositories/tournament.repo.js', () => ({
  findAmendmentsByTournament: vi.fn(),
  findAmendmentById: vi.fn(),
  findTournamentById: vi.fn(),
  approveAmendment: vi.fn(),
  rejectAmendment: vi.fn(),
  insertAmendmentRequest: vi.fn(),
  hasLiveApplications: vi.fn(),
  findPendingAmendments: vi.fn(),
}));
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn() }));
// 🆕 BE-36 (7 ต.ค. 2569) — ไม่ใส่ findApprovedSquadsForFilter = ไฟล์นี้พังทั้งไฟล์
vi.mock('../../repositories/application.repo.js', () => ({
  findEligibilityRules: vi.fn(),
  findApprovedSquadsForFilter: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../repositories/department.repo.js', () => ({}));
vi.mock('../../repositories/faculty.repo.js', () => ({ findFacultyById: vi.fn() }));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../../repositories/match.repo.js', () => ({}));
vi.mock('../referee.service.js', () => ({}));
vi.mock('../matchResult.service.js', () => ({}));
vi.mock('../../repositories/user.repo.js', () => ({}));
vi.mock('../../mappers/tournament.mapper.js', () => ({}));
vi.mock('../../mappers/user.mapper.js', () => ({ toUserRef: vi.fn() }));

import * as Service from '../tournament.service.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as AdminScopeRepo from '../../repositories/adminScope.repo.js';
import * as ApplicationRepo from '../../repositories/application.repo.js';
import * as FacultyRepo from '../../repositories/faculty.repo.js';
import { toUserRef } from '../../mappers/user.mapper.js';
import type { AdminScopeRow, TournamentRow } from '../../types/db.js';

const mockedTournamentRepo = vi.mocked(TournamentRepo);
const mockedAdminScopeRepo = vi.mocked(AdminScopeRepo);
const mockedApplicationRepo = vi.mocked(ApplicationRepo);
const mockedFacultyRepo = vi.mocked(FacultyRepo);
const mockedToUserRef = vi.mocked(toUserRef);

const DAY = 24 * 3600 * 1000;
const futureIso = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const futureDateOnly = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

const uniAdmin: AdminScopeRow = { admin_scope_id: 1, user_id: 9, scope_type: 'university_wide', faculty_id: null, created_at: new Date(), created_by: null };
const facultyAdmin3: AdminScopeRow = { admin_scope_id: 2, user_id: 9, scope_type: 'faculty', faculty_id: 3, created_at: new Date(), created_by: null };
const facultyAdmin5: AdminScopeRow = { admin_scope_id: 3, user_id: 9, scope_type: 'faculty', faculty_id: 5, created_at: new Date(), created_by: null };

const baseTournament = (o: Partial<TournamentRow> = {}) => ({
  tournament_id: 26,
  tournament_status: 'private',
  organizing_faculty_id: 3,
  registration_open: 0,
  registration_start: futureIso(1),
  registration_end: futureIso(5),
  event_start_date: futureDateOnly(10),
  event_end_date: futureDateOnly(12),
  min_teams: 4,
  max_teams: 16,
  min_age: null,
  max_age: null,
  ...o,
}) as unknown as TournamentRow;

beforeEach(() => {
  vi.resetAllMocks();
  mockedApplicationRepo.findEligibilityRules.mockResolvedValue([]);
  mockedApplicationRepo.findApprovedSquadsForFilter.mockResolvedValue([]);   // BE-36 — ค่าเริ่ม: ยังไม่มีทีมที่อนุมัติ
  mockedTournamentRepo.hasLiveApplications.mockResolvedValue(false);
});

// C09b — FE-organizer-see-their-own (21 ก.ย.)
describe('getTournamentAmendments', () => {
  it('maps every request with the requester reason and the admin decision', async () => {
    vi.mocked(TournamentRepo.findAmendmentsByTournament).mockResolvedValue([
      { tournament_amendment_request_id: 5, requested_changes: JSON.stringify({ maxTeams: 12 }), request_reason: 'มีทีมสมัครเยอะ',
        tournament_amendment_request_status: 'rejected', requested_at: new Date('2026-09-20T01:00:00Z'),
        reviewed_by: 9001, reviewed_at: new Date('2026-09-20T02:00:00Z'), rejection_reason: 'สนามรองรับไม่พอ', reviewer_name: 'สมชาย' },
      { tournament_amendment_request_id: 6, requested_changes: { venue: 'B' }, request_reason: null,
        tournament_amendment_request_status: 'pending', requested_at: new Date('2026-09-21T01:00:00Z'),
        reviewed_by: null, reviewed_at: null, rejection_reason: null, reviewer_name: null },
    ]);
    await expect(Service.getTournamentAmendments(26)).resolves.toEqual({ items: [
      { id: 5, requestedChanges: { maxTeams: 12 }, reason: 'มีทีมสมัครเยอะ', status: 'rejected', requestedAt: '2026-09-20T01:00:00.000Z',
        reviewedAt: '2026-09-20T02:00:00.000Z', reviewedBy: { id: 9001, name: 'สมชาย' }, rejectionReason: 'สนามรองรับไม่พอ' },
      { id: 6, requestedChanges: { venue: 'B' }, reason: null, status: 'pending', requestedAt: '2026-09-21T01:00:00.000Z',
        reviewedAt: null, reviewedBy: null, rejectionReason: null },
    ] });
    expect(TournamentRepo.findAmendmentsByTournament).toHaveBeenCalledWith(26);
  });
});

describe('requestAmendment (C09)', () => {
  it('404 TOURNAMENT_NOT_FOUND when the tournament does not exist', async () => {
    mockedTournamentRepo.findTournamentById.mockResolvedValue(null);
    await expect(Service.requestAmendment(26, 9, { requestedChanges: { maxTeams: 20 }, reason: 'x' }))
      .rejects.toMatchObject({ status: 404, code: 'TOURNAMENT_NOT_FOUND' });
  });

  it('400 AMENDMENT_FIELD_NOT_ALLOWED for a field that must go through a direct update instead (e.g. venue)', async () => {
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament());
    await expect(Service.requestAmendment(26, 9, { requestedChanges: { venue: 'New Gym' }, reason: 'x' }))
      .rejects.toMatchObject({ status: 400, code: 'AMENDMENT_FIELD_NOT_ALLOWED', extra: { fields: ['venue'] } });
    expect(mockedTournamentRepo.insertAmendmentRequest).not.toHaveBeenCalled();
  });

  it('400 VALIDATION_FAILED when requestedChanges is not a JSON object', async () => {
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament());
    await expect(Service.requestAmendment(26, 9, { requestedChanges: 'not json' as any, reason: 'x' }))
      .rejects.toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
  });

  it('accepts requestedChanges given as a JSON string and parses it', async () => {
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament());
    mockedTournamentRepo.insertAmendmentRequest.mockResolvedValue(900);

    // as any ไม่ใช่เพราะชนิดผิด — route ส่ง string มาไม่ได้ (amendmentRequestSchema ปฏิเสธที่ zod ก่อน)
    // มติ 6 ต.ค. 2569 (B7 ทางเลือก ก): ไม่เปิดให้ API รับ string · เทสนี้คุ้มครอง branch กันเหนียว
    //   ไว้เผื่อมีคนเรียก service ตรง ๆ (สคริปต์/เทส) และเผื่อฐานที่ตั้งด้วยมือได้คอลัมน์เป็น text
    // 🔴 แก้คอมเมนต์ 6 ต.ค. — เดิมเขียนว่า "อ่าน requested_changes จากฐานได้เป็น string จริง"
    //   ตรวจกับฐานจริงแล้วไม่ใช่: คอลัมน์เป็น json และ mysql2 คืนเป็น object ทุกทาง (ดูหัว normalizeChanges)
    //   ⇒ อย่าอ้างเหตุผลนั้นต่อ แต่ก็ยังไม่ต้องลบ branch — ราคาถูกและกันเคสข้างบนได้
    const result = await Service.requestAmendment(26, 9, { requestedChanges: JSON.stringify({ maxTeams: 20 }) as any, reason: 'ทีมสมัครเยอะ' });

    expect(mockedTournamentRepo.insertAmendmentRequest).toHaveBeenCalledWith(26, 9, { maxTeams: 20 }, 'ทีมสมัครเยอะ');
    expect(result).toEqual({ id: 900, status: 'pending' });
  });

  it('validates the changed schedule against the tournament\'s current values (400 when it would break the schedule)', async () => {
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament());
    await expect(Service.requestAmendment(26, 9, { requestedChanges: { minTeams: 20, maxTeams: 5 }, reason: 'x' }))
      .rejects.toMatchObject({ status: 400 });
  });

  it('409 ELIGIBILITY_LOCKED when registration is already open and eligibilityRules are being changed', async () => {
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament({ registration_open: 1 }));
    await expect(Service.requestAmendment(26, 9, { requestedChanges: { eligibilityRules: [] }, reason: 'x' }))
      .rejects.toMatchObject({ status: 409, code: 'ELIGIBILITY_LOCKED' });
  });

  it('409 ELIGIBILITY_LOCKED when teams have already applied', async () => {
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament());
    mockedTournamentRepo.hasLiveApplications.mockResolvedValue(true);
    await expect(Service.requestAmendment(26, 9, { requestedChanges: { eligibilityRules: [] }, reason: 'x' }))
      .rejects.toMatchObject({ status: 409, code: 'ELIGIBILITY_LOCKED' });
  });

  it('validates and normalizes a new eligibilityRules set (rejects an unknown faculty)', async () => {
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament());
    mockedFacultyRepo.findFacultyById.mockResolvedValue(null);
    await expect(Service.requestAmendment(26, 9, { requestedChanges: { eligibilityRules: [{ type: 'faculty', value: 999 }] }, reason: 'x' }))
      .rejects.toMatchObject({ status: 400 });
  });

  it('creates the amendment request with the normalized changes on the happy path', async () => {
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament());
    mockedFacultyRepo.findFacultyById.mockResolvedValue({ faculty_id: 3, name: 'Eng' } as any);
    mockedTournamentRepo.insertAmendmentRequest.mockResolvedValue(901);

    const result = await Service.requestAmendment(26, 9, {
      requestedChanges: { maxTeams: 20, eligibilityRules: [{ type: 'faculty', value: 3 }] }, reason: 'ขยายจำนวนทีม',
    });

    expect(mockedTournamentRepo.insertAmendmentRequest).toHaveBeenCalledWith(
      26, 9, { maxTeams: 20, eligibilityRules: [{ type: 'faculty', value: 3 }] }, 'ขยายจำนวนทีม',
    );
    expect(result).toEqual({ id: 901, status: 'pending' });
  });
});

describe('getPendingAmendments', () => {
  it('403 INSUFFICIENT_ADMIN_SCOPE when the caller is not an admin', async () => {
    mockedAdminScopeRepo.findAdminByUserId.mockResolvedValue(null);
    await expect(Service.getPendingAmendments(9, 0, 1, 20)).rejects.toMatchObject({ status: 403, code: 'INSUFFICIENT_ADMIN_SCOPE' });
  });

  it('maps the queue scoped to the admin, including requester info and parsed changes', async () => {
    mockedAdminScopeRepo.findAdminByUserId.mockResolvedValue(uniAdmin);
    const row = {
      tournament_amendment_request_id: 5, tournament_id: 26, tournament_name: 'Cup',
      requested_changes: JSON.stringify({ maxTeams: 20 }), request_reason: 'x',
      tournament_amendment_request_status: 'pending', requested_at: new Date('2026-01-01T00:00:00Z'),
      user_id: 100, full_name: 'สมชาย', profile_image_key: null,
    };
    mockedTournamentRepo.findPendingAmendments.mockResolvedValue({ rows: [row] as any, totalItems: 1 });
    mockedToUserRef.mockReturnValue({ id: 100, fullName: 'สมชาย', avatarUrl: null });

    const result = await Service.getPendingAmendments(9, 0, 1, 20);

    expect(mockedTournamentRepo.findPendingAmendments).toHaveBeenCalledWith(uniAdmin, 0, 20);
    expect(result.items).toEqual([{
      id: 5, tournamentId: 26, tournamentName: 'Cup', requestedBy: { id: 100, fullName: 'สมชาย', avatarUrl: null },
      requestedChanges: { maxTeams: 20 }, reason: 'x', status: 'pending', requestedAt: '2026-01-01T00:00:00.000Z',
    }]);
  });
});

describe('approveAmendment (C11)', () => {
  const amendment = { tournament_amendment_request_id: 5, tournament_id: 26, requested_changes: { maxTeams: 20 } };

  it('404 AMENDMENT_NOT_FOUND when the amendment does not exist', async () => {
    mockedTournamentRepo.findAmendmentById.mockResolvedValue(null);
    await expect(Service.approveAmendment(5, 9)).rejects.toMatchObject({ status: 404, code: 'AMENDMENT_NOT_FOUND' });
  });

  it('403 INSUFFICIENT_ADMIN_SCOPE when the admin does not manage this tournament', async () => {
    mockedTournamentRepo.findAmendmentById.mockResolvedValue(amendment as any);
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament({ organizing_faculty_id: 3 }));
    mockedAdminScopeRepo.findAdminByUserId.mockResolvedValue(facultyAdmin5);
    await expect(Service.approveAmendment(5, 9)).rejects.toMatchObject({ status: 403, code: 'INSUFFICIENT_ADMIN_SCOPE' });
  });

  it('403 ELIGIBILITY_OUT_OF_SCOPE when the requested eligibilityRules change is outside the admin\'s faculty', async () => {
    mockedTournamentRepo.findAmendmentById.mockResolvedValue({
      ...amendment, requested_changes: { eligibilityRules: [{ type: 'faculty', value: 5 }] },
    } as any);
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament({ organizing_faculty_id: 3 }));
    mockedAdminScopeRepo.findAdminByUserId.mockResolvedValue(facultyAdmin3);
    await expect(Service.approveAmendment(5, 9)).rejects.toMatchObject({ status: 403, code: 'ELIGIBILITY_OUT_OF_SCOPE' });
  });

  it('403 ELIGIBILITY_OUT_OF_SCOPE when there is no rules change but the tournament\'s CURRENT rules are out of the admin\'s scope', async () => {
    mockedTournamentRepo.findAmendmentById.mockResolvedValue(amendment as any);
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament({ organizing_faculty_id: 3 }));
    mockedAdminScopeRepo.findAdminByUserId.mockResolvedValue(facultyAdmin3);
    mockedApplicationRepo.findEligibilityRules.mockResolvedValue([]); // open to all faculties
    await expect(Service.approveAmendment(5, 9)).rejects.toMatchObject({ status: 403, code: 'ELIGIBILITY_OUT_OF_SCOPE' });
  });

  it('409 ALREADY_DECIDED when the amendment was already resolved', async () => {
    mockedTournamentRepo.findAmendmentById.mockResolvedValue(amendment as any);
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament());
    mockedAdminScopeRepo.findAdminByUserId.mockResolvedValue(uniAdmin);
    mockedTournamentRepo.approveAmendment.mockResolvedValue('already_decided');
    await expect(Service.approveAmendment(5, 9)).rejects.toMatchObject({ status: 409, code: 'ALREADY_DECIDED' });
  });

  it('409 TEAM_CAPACITY_CONFLICT when the new maxTeams would be below the already-approved team count', async () => {
    mockedTournamentRepo.findAmendmentById.mockResolvedValue(amendment as any);
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament());
    mockedAdminScopeRepo.findAdminByUserId.mockResolvedValue(uniAdmin);
    mockedTournamentRepo.approveAmendment.mockResolvedValue('capacity_conflict');
    await expect(Service.approveAmendment(5, 9)).rejects.toMatchObject({ status: 409, code: 'TEAM_CAPACITY_CONFLICT' });
  });

  it('404 AMENDMENT_NOT_FOUND when the row disappeared between the lookup and the update (race)', async () => {
    mockedTournamentRepo.findAmendmentById.mockResolvedValue(amendment as any);
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament());
    mockedAdminScopeRepo.findAdminByUserId.mockResolvedValue(uniAdmin);
    mockedTournamentRepo.approveAmendment.mockResolvedValue('not_found');
    await expect(Service.approveAmendment(5, 9)).rejects.toMatchObject({ status: 404, code: 'AMENDMENT_NOT_FOUND' });
  });

  it('approves the amendment with the validated changes on the happy path', async () => {
    mockedTournamentRepo.findAmendmentById.mockResolvedValue(amendment as any);
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament());
    mockedAdminScopeRepo.findAdminByUserId.mockResolvedValue(uniAdmin);
    mockedTournamentRepo.approveAmendment.mockResolvedValue('ok');

    const result = await Service.approveAmendment(5, 9);

    expect(mockedTournamentRepo.approveAmendment).toHaveBeenCalledWith(5, 9, { maxTeams: 20 });
    expect(result).toEqual({ id: 5, status: 'approved' });
  });
});

describe('rejectAmendment', () => {
  const amendment = { tournament_amendment_request_id: 5, tournament_id: 26, requested_changes: { maxTeams: 20 } };

  it('404 AMENDMENT_NOT_FOUND when the amendment does not exist', async () => {
    mockedTournamentRepo.findAmendmentById.mockResolvedValue(null);
    await expect(Service.rejectAmendment(5, 9, 'x')).rejects.toMatchObject({ status: 404, code: 'AMENDMENT_NOT_FOUND' });
  });

  it('403 INSUFFICIENT_ADMIN_SCOPE when the admin does not manage this tournament', async () => {
    mockedTournamentRepo.findAmendmentById.mockResolvedValue(amendment as any);
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament({ organizing_faculty_id: 3 }));
    mockedAdminScopeRepo.findAdminByUserId.mockResolvedValue(facultyAdmin5);
    await expect(Service.rejectAmendment(5, 9, 'x')).rejects.toMatchObject({ status: 403, code: 'INSUFFICIENT_ADMIN_SCOPE' });
  });

  it('409 ALREADY_DECIDED when the amendment was already resolved', async () => {
    mockedTournamentRepo.findAmendmentById.mockResolvedValue(amendment as any);
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament());
    mockedAdminScopeRepo.findAdminByUserId.mockResolvedValue(uniAdmin);
    mockedTournamentRepo.rejectAmendment.mockResolvedValue('already_decided');
    await expect(Service.rejectAmendment(5, 9, 'x')).rejects.toMatchObject({ status: 409, code: 'ALREADY_DECIDED' });
  });

  it('rejects the amendment and returns the reason', async () => {
    mockedTournamentRepo.findAmendmentById.mockResolvedValue(amendment as any);
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament());
    mockedAdminScopeRepo.findAdminByUserId.mockResolvedValue(uniAdmin);
    mockedTournamentRepo.rejectAmendment.mockResolvedValue('ok');

    const result = await Service.rejectAmendment(5, 9, 'ไม่เห็นด้วย');

    expect(mockedTournamentRepo.rejectAmendment).toHaveBeenCalledWith(5, 9, 'ไม่เห็นด้วย');
    expect(result).toEqual({ id: 5, status: 'rejected', reason: 'ไม่เห็นด้วย' });
  });
});

/**
 * 🆕 การแก้ 7 ต.ค. 2569 (BE-39) — "คำขอถูกปฏิเสธด้วยข้อผิดพลาดที่ไม่เกี่ยวกับช่องที่ขอ"
 *
 * ทัวร์ 14 ของ baseline มีวันปิดรับสมัคร (30 พ.ย.) อยู่**หลัง**วันแข่ง (20 ต.ค.) อยู่แล้ว
 * ⇒ ผู้จัดขอเปลี่ยนแค่ `genderRequirement` ก็ได้ `INVALID_DATE_RANGE` ที่ชี้ไปที่ `eventStartDate`
 *   ซึ่งเขาไม่ได้กรอก และไม่มีทางรู้ว่าต้องทำอะไรต่อ
 *
 * ★ ไม่ได้ผ่อนด่าน — ยังปฏิเสธเหมือนเดิม เปลี่ยนแค่รหัส/ข้อความเมื่อพิสูจน์ได้ว่า**ข้อมูลเดิม**
 *   ผิดอยู่ก่อนแล้ว ⇒ FE แยก "ค่าที่คุณกรอกผิด" ออกจาก "ข้อมูลเดิมพัง ต้องแก้มาด้วย" ได้
 * ★ เทสคู่สุดท้ายคือหัวใจ: ถ้าใครเปลี่ยนไปปล่อยผ่านเมื่อข้อมูลเดิมพัง เทสนั้นจะแดง
 */
describe('ข้อมูลเดิมของทัวร์ขัดกันเองอยู่แล้ว (BE-39)', () => {
  // ปิดรับสมัครหลังวันแข่ง — ผิดกฎ ensureSchedule อยู่ก่อนที่จะมีใครยื่นคำขอ
  // ★ cast เหมือน baseTournament — pool ตั้ง dateStrings ⇒ ของจริงที่ mysql คืนมาก็เป็นสตริง
  const brokenTournament = () => baseTournament({
    registration_start: futureIso(1),
    registration_end: futureIso(60),
    event_start_date: futureDateOnly(10),
    event_end_date: futureDateOnly(12),
  } as unknown as Partial<TournamentRow>);

  beforeEach(() => {
    mockedTournamentRepo.findTournamentById.mockResolvedValue(brokenTournament());
    mockedTournamentRepo.insertAmendmentRequest.mockResolvedValue(7 as never);
  });

  it('ขอแก้ช่องที่ไม่เกี่ยวกับวัน → บอกว่าข้อมูลเดิมพัง ไม่ใช่ INVALID_DATE_RANGE', async () => {
    await expect(Service.requestAmendment(26, 7, { requestedChanges: { genderRequirement: 'female' }, reason: 'ขอเปลี่ยน' } as never))
      .rejects.toMatchObject({ status: 409, code: 'TOURNAMENT_DATA_CONFLICT' });
  });

  /** ★ ต้องบอกด้วยว่า "ช่องที่พัง" คือช่องไหน เพื่อให้ผู้จัดรู้ว่าต้องขอแก้อะไรเพิ่ม */
  it('บอกช่องที่พังของเดิม แยกจากช่องที่ผู้ขอกรอก', async () => {
    const err = await Service.requestAmendment(26, 7,
      { requestedChanges: { genderRequirement: 'female' }, reason: 'ขอเปลี่ยน' } as never).catch((e: unknown) => e);

    expect((err as { extra: { conflictingFields: Record<string, string>; requestedFields: string[] } }).extra)
      .toMatchObject({ requestedFields: ['genderRequirement'] });
    expect(Object.keys((err as { extra: { conflictingFields: Record<string, string> } }).extra.conflictingFields).length)
      .toBeGreaterThan(0);
  });

  /** ★ ยังปฏิเสธ — ด่านไม่ได้หายไป เปลี่ยนแค่ข้อความ */
  it('ไม่อนุมัติให้ผ่าน (ด่านยังอยู่ แค่เปลี่ยนข้อความ)', async () => {
    await expect(Service.requestAmendment(26, 7, { requestedChanges: { genderRequirement: 'female' }, reason: 'ขอเปลี่ยน' } as never))
      .rejects.toThrow();

    expect(mockedTournamentRepo.insertAmendmentRequest).not.toHaveBeenCalled();
  });

  /**
   * ★ เคสตรงข้าม: ข้อมูลเดิมสะอาด แต่ผู้ขอกรอกวันที่ผิดมาเอง ⇒ ต้องได้ error เดิม
   *   ถ้าเทสนี้แดง แปลว่าโค้ดกลบทุกอย่างเป็น TOURNAMENT_DATA_CONFLICT ซึ่งทำให้ผู้ใช้
   *   ที่กรอกผิดจริงไม่รู้ว่าตัวเองกรอกผิด
   */
  it('ข้อมูลเดิมสะอาด แต่ค่าที่ขอมาผิด → ยังเป็น INVALID_DATE_RANGE ตามเดิม', async () => {
    mockedTournamentRepo.findTournamentById.mockResolvedValue(baseTournament());

    await expect(Service.requestAmendment(26, 7,
      { requestedChanges: { registrationEnd: futureIso(60) }, reason: 'ขอเลื่อน' } as never))
      .rejects.toMatchObject({ status: 400, code: 'INVALID_DATE_RANGE' });
  });
});

/**
 * 🆕 BE-36 (แก้ 7 ต.ค. 2569) — แก้เพศ/อายุแล้วทีมที่อนุมัติไปแล้วผิดกฎย้อนหลัง
 *
 * QA: ทัวร์ 22 เปิดรับสมัครอยู่ มีทีมชาย 2 ทีมที่อนุมัติแล้ว · ผู้จัดขอเปลี่ยนเป็น female
 * แอดมินอนุมัติ ⇒ ทัวร์กลายเป็นหญิงล้วนทันที ทีมชายทั้งสองยังอยู่ในรายชื่อที่อนุมัติ
 * ไม่มีการตรวจซ้ำ ไม่มีแจ้งเตือน
 *
 * ★ กฎนี้ระบบบังคับอยู่แล้ว 2 ใน 3 เส้น (maxTeams → capacity_conflict ·
 *   eligibilityRules → ELIGIBILITY_LOCKED) · เพศ/อายุคือเส้นที่ขาดไป ไม่ใช่การออกแบบ
 * ★ ใช้สูตร `genderAgeFailReason` ตัวเดียวกับที่ใบสมัครใช้ (utils/hardFilter.ts)
 *   ⇒ ทีมที่ผ่านตอนสมัครจะไม่ถูกตีว่าไม่ผ่านตอนแก้กฎด้วยสูตรที่ต่างกัน
 */
describe('ทีมที่อนุมัติแล้วต้องไม่ผิดกฎย้อนหลัง (BE-36)', () => {
  const maleSquad = [
    { team_id: 30, team_name: 'ทีมชาย A', user_id: 101, full_name: 'สมชาย', gender: 'male' as const, birth_date: '2004-01-15' },
    { team_id: 31, team_name: 'ทีมชาย B', user_id: 102, full_name: 'สมศักดิ์', gender: 'male' as const, birth_date: '2004-02-20' },
  ];

  beforeEach(() => {
    // ★ ต้องระบุ gender_requirement/อายุให้ชัด — baseTournament ไม่ได้ตั้งไว้ และ undefined
    //   จะถูกอ่านว่า "ไม่ใช่ any" ⇒ ทุกคนตกเพศ ทำให้เทสเคสอายุอ่านผลผิดเหตุ
    mockedTournamentRepo.findTournamentById.mockResolvedValue(
      baseTournament({ gender_requirement: 'any', min_age: null, max_age: null }));
    mockedTournamentRepo.insertAmendmentRequest.mockResolvedValue(7 as never);
    mockedTournamentRepo.findAmendmentById.mockResolvedValue(
      { tournament_amendment_request_id: 7, tournament_id: 26, tournament_amendment_request_status: 'pending',
        requested_changes: { genderRequirement: 'female' } } as never);
    mockedAdminScopeRepo.findAdminByUserId.mockResolvedValue(uniAdmin);
    mockedApplicationRepo.findApprovedSquadsForFilter.mockResolvedValue(maleSquad as never);
  });

  it('ยื่นคำขอเปลี่ยนเป็นหญิงล้วน ขณะมีทีมชายที่อนุมัติแล้ว → 409 และไม่บันทึกคำขอ', async () => {
    await expect(Service.requestAmendment(26, 7,
      { requestedChanges: { genderRequirement: 'female' }, reason: 'เปลี่ยนรุ่น' } as never))
      .rejects.toMatchObject({ status: 409, code: 'AMENDMENT_BREAKS_APPROVED_TEAMS' });

    expect(mockedTournamentRepo.insertAmendmentRequest).not.toHaveBeenCalled();
  });

  /** ★ ด่านตัวจริงอยู่ตอนอนุมัติ — ทีมอาจถูกอนุมัติเพิ่มหลังยื่นคำขอไปแล้ว */
  it('แอดมินอนุมัติคำขอนั้น → 409 และทัวร์ไม่ถูกแก้', async () => {
    await expect(Service.approveAmendment(7, 9))
      .rejects.toMatchObject({ status: 409, code: 'AMENDMENT_BREAKS_APPROVED_TEAMS' });

    expect(mockedTournamentRepo.approveAmendment).not.toHaveBeenCalled();
  });

  /** ★ ต้องบอกว่าทีมไหนและใครชน ไม่ใช่แค่ปฏิเสธ — ผู้จัดต้องรู้ว่าต้องถอนทีมไหนก่อน */
  it('บอกจำนวนทีมและรายชื่อคนที่ชน พร้อมเหตุผลรายคน', async () => {
    const err = await Service.approveAmendment(7, 9).catch((e: unknown) => e);
    const extra = (err as { extra: { affectedTeamCount: number; affectedTeams: { teamId: number; players: { userId: number; reason: string }[] }[] } }).extra;

    expect(extra.affectedTeamCount).toBe(2);
    expect(extra.affectedTeams.map(t => t.teamId).sort()).toEqual([30, 31]);
    expect(extra.affectedTeams[0]!.players[0]).toMatchObject({ userId: 101, reason: 'gender' });
  });

  /** ★ อายุใช้วันปิดรับสมัครเป็นหลัก ไม่ใช่วันนี้ — สูตรเดียวกับตอนตรวจใบสมัคร */
  it('จับเคสอายุด้วย ไม่ใช่แค่เพศ', async () => {
    mockedTournamentRepo.findAmendmentById.mockResolvedValue(
      { tournament_amendment_request_id: 7, tournament_id: 26, tournament_amendment_request_status: 'pending',
        requested_changes: { minAge: 30 } } as never);

    const err = await Service.approveAmendment(7, 9).catch((e: unknown) => e);

    expect((err as { code: string }).code).toBe('AMENDMENT_BREAKS_APPROVED_TEAMS');
    expect((err as { extra: { affectedTeams: { players: { reason: string }[] }[] } }).extra.affectedTeams[0]!.players[0]!.reason)
      .toBe('age');
  });

  /**
   * ★ เคสตรงข้าม: การแก้ที่ไม่ทำให้ใครผิด ต้องผ่านตามเดิม
   *   ถ้าเทสนี้แดง แปลว่าด่านใหม่กว้างเกินไปและบล็อกการแก้ที่ควรทำได้
   */
  it('แก้เป็นเงื่อนไขที่ทุกทีมยังผ่าน → อนุมัติได้ตามเดิม', async () => {
    mockedTournamentRepo.findAmendmentById.mockResolvedValue(
      { tournament_amendment_request_id: 7, tournament_id: 26, tournament_amendment_request_status: 'pending',
        requested_changes: { genderRequirement: 'male' } } as never);
    mockedTournamentRepo.approveAmendment.mockResolvedValue('ok' as never);

    await expect(Service.approveAmendment(7, 9)).resolves.toMatchObject({ status: 'approved' });
  });

  /** ★ คำขอที่ไม่แตะเพศ/อายุเลย ต้องไม่ไปอ่านรายชื่อทีมโดยเปล่าประโยชน์ */
  it('คำขอที่ไม่เกี่ยวกับเพศ/อายุ ไม่ต้องอ่านรายชื่อทีม', async () => {
    mockedTournamentRepo.findAmendmentById.mockResolvedValue(
      { tournament_amendment_request_id: 7, tournament_id: 26, tournament_amendment_request_status: 'pending',
        requested_changes: { minTeams: 3 } } as never);
    mockedTournamentRepo.approveAmendment.mockResolvedValue('ok' as never);

    await expect(Service.approveAmendment(7, 9)).resolves.toMatchObject({ status: 'approved' });
    expect(mockedApplicationRepo.findApprovedSquadsForFilter).not.toHaveBeenCalled();
  });
});
