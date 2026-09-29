import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(),
  notifyUsers: vi.fn(),
  notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
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
vi.mock('../../repositories/application.repo.js', () => ({ findEligibilityRules: vi.fn() }));
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

    const result = await Service.requestAmendment(26, 9, { requestedChanges: JSON.stringify({ maxTeams: 20 }), reason: 'ทีมสมัครเยอะ' });

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
