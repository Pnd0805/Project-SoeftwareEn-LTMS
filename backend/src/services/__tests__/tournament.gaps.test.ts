import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * tournament.service — paths the other tournament.*.test.ts files don't reach:
 *   createTournament date/scope validation · visibility via admin · list/read endpoints ·
 *   approve/reject race conditions · amendment preview & admin impact view · approve/reject amendment edges ·
 *   publish/complete/delete edges · eligibility rules read · background jobs (auto-delete, warning, purge)
 */

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(), notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(), notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));
vi.mock('../../repositories/notification.repo.js', () => ({ findTournamentCancellationAudience: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(), findTournamentOrganizer: vi.fn(), countApprovedTeams: vi.fn(() => Promise.resolve(0)),
  insertTournament: vi.fn(() => Promise.resolve(100)), approveTournament: vi.fn(), rejectTournament: vi.fn(),
  findMyTournamentRequests: vi.fn(), findTournamentsByOrganizer: vi.fn(), findPublicTournaments: vi.fn(),
  countStartedMatchesOfTournament: vi.fn(() => Promise.resolve(0)), setTournamentBestOfTx: vi.fn(),
  findPendingAmendmentOfTournament: vi.fn(() => Promise.resolve(null)), insertAmendmentRequest: vi.fn(() => Promise.resolve(55)),
  findAmendmentById: vi.fn(), approveAmendment: vi.fn(), rejectAmendment: vi.fn(), hasLiveApplications: vi.fn(() => Promise.resolve(false)),
  publishTournament: vi.fn(), findUnfinishedMatchIds: vi.fn(), completeTournament: vi.fn(),
  countApplicationsByTournament: vi.fn(() => Promise.resolve(0)), softDeleteTournament: vi.fn(),
  sweepPrivatePastDueTournaments: vi.fn(), findTournamentsToWarnBeforeAutoDelete: vi.fn(), markAutoDeleteWarned: vi.fn(),
  purgeTournamentsClosedOver: vi.fn(), findPendingTournamentRequests: vi.fn(),
}));
vi.mock('../../repositories/matchResultComplaint.repo.js', () => ({ countOpenByTournament: vi.fn(() => Promise.resolve(0)) }));
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../repositories/tournamentReferee.repo.js', () => ({ findActiveByTournamentAndUser: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../repositories/application.repo.js', () => ({
  findEligibilityRules: vi.fn(() => Promise.resolve([])),
  findEligibilityRulesOfMany: vi.fn(() => Promise.resolve(new Map())),
  findApprovedSquadsForFilter: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../repositories/department.repo.js', () => ({ findDepartmentInFaculty: vi.fn() }));
vi.mock('../../repositories/faculty.repo.js', () => ({ findFacultyById: vi.fn(() => Promise.resolve({ faculty_id: 2 })) }));
vi.mock('../../repositories/sportType.repo.js', () => ({ findSportTypeById: vi.fn(() => Promise.resolve({ sport_type_id: 1, default_mode: 'onsite', allowed_best_of: null })) }));
vi.mock('../../repositories/user.repo.js', () => ({}));
vi.mock('../../repositories/match.repo.js', () => ({ countMatchesByTournament: vi.fn(() => Promise.resolve(0)) }));
vi.mock('../matchResult.service.js', () => ({ autoVerifyDue: vi.fn(() => Promise.resolve([])), resolveChampionTeamId: vi.fn() }));
vi.mock('../referee.service.js', () => ({
  refereesNeededPerMatch: vi.fn(async () => (mode: 'onsite' | 'online') => (mode === 'onsite' ? 2 : 1)),
}));
vi.mock('../../utils/matchFormat.js', () => ({ assertBestOfAllowed: vi.fn() }));
vi.mock('../../mappers/tournament.mapper.js', () => ({
  toTournamentDetailDto: vi.fn((t: { tournament_id: number }, organizer: unknown, approved: number, hasOpen: boolean) =>
    ({ id: t.tournament_id, organizer, approvedTeamCount: approved, hasOpenComplaints: hasOpen })),
  toTournamentListDto: vi.fn((t: { tournament_id: number; name: string }) => ({ id: t.tournament_id, name: t.name })),
}));
vi.mock('../../mappers/user.mapper.js', () => ({ toUserRef: vi.fn((r: { user_id: number }) => ({ id: r.user_id })) }));

import * as Service from '../tournament.service.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as AdminScopeRepo from '../../repositories/adminScope.repo.js';
import * as TournamentRefereeRepo from '../../repositories/tournamentReferee.repo.js';
import * as ApplicationRepo from '../../repositories/application.repo.js';
import * as DepartmentRepo from '../../repositories/department.repo.js';
import * as FacultyRepo from '../../repositories/faculty.repo.js';
import * as SportTypeRepo from '../../repositories/sportType.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as MatchResultService from '../matchResult.service.js';
import * as NotificationService from '../notification.service.js';
import type { AdminScopeRow, TournamentRow } from '../../types/db.js';

const NOW = new Date('2026-10-01T03:00:00Z');

const tournament = (o: Partial<TournamentRow> = {}) => ({
  tournament_id: 50, name: 'ฟุตบอลคณะ', tournament_status: 'private', requested_by_user_id: 7,
  organizing_faculty_id: 2, sport_type_id: 1, registration_open: 0,
  registration_start: new Date('2026-10-05T00:00:00Z'), registration_end: new Date('2026-10-20T00:00:00Z'),
  event_start_date: '2026-11-01', event_end_date: '2026-11-03', min_teams: 4, max_teams: 16,
  gender_requirement: 'any', min_age: null, max_age: null, ...o,
}) as unknown as TournamentRow;

const admin = (o: Partial<AdminScopeRow> = {}) =>
  ({ admin_scope_id: 1, user_id: 1, scope_type: 'university_wide', faculty_id: null, ...o }) as AdminScopeRow;

const createInput = (o: Record<string, unknown> = {}) => ({
  name: 'ฟุตบอลคณะ', sportTypeId: 1, bracketFormat: 'single_elimination', scopeType: 'faculty',
  organizingFacultyId: 2, registrationStart: '2026-10-05T00:00:00+07:00', registrationEnd: '2026-10-20T00:00:00+07:00',
  eventStartDate: '2026-11-01', eventEndDate: '2026-11-03', minTeams: 4, maxTeams: 16, venue: 'สนามกลาง',
  genderRequirement: 'any', ...o,
}) as never;

const amendmentRow = (o: Record<string, unknown> = {}) => ({
  tournament_amendment_request_id: 30, tournament_id: 50, tournament_name: 'ฟุตบอลคณะ',
  tournament_amendment_request_status: 'pending', requested_changes: { maxTeams: 12 }, request_reason: 'สนามเล็กลง',
  requested_by: 7, ...o,
});

async function rejected(p: Promise<unknown>) {
  return p.then(() => { throw new Error('expected rejection'); }, (e) => e);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament());
  vi.mocked(TournamentRepo.findTournamentOrganizer).mockResolvedValue({ user_id: 7, full_name: 'ผู้จัด', profile_image_key: null } as never);
  vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(null);
});
afterEach(() => vi.useRealTimers());

// ───────────────────────── createTournament validation ─────────────────────────

describe('createTournament — schedule and scope validation', () => {
  it('creates a pending tournament for a normal user', async () => {
    await expect(Service.createTournament(createInput(), 7)).resolves.toEqual({
      id: 100, status: 'pending_approval', name: 'ฟุตบอลคณะ', autoApproved: false,
    });
  });

  it('400 INVALID_DATE_RANGE for an unparseable date', async () => {
    expect(await rejected(Service.createTournament(createInput({ registrationStart: 'not-a-date' }), 7)))
      .toMatchObject({ status: 400, code: 'INVALID_DATE_RANGE', extra: { fields: { eventStartDate: expect.any(String) } } });
  });

  it('400 INVALID_DATE_RANGE when the event ends before it starts', async () => {
    expect(await rejected(Service.createTournament(createInput({ eventEndDate: '2026-10-31' }), 7)))
      .toMatchObject({ code: 'INVALID_DATE_RANGE', extra: { fields: { eventEndDate: expect.any(String) } } });
  });

  it('a one-day event (start = end) is allowed', async () => {
    await expect(Service.createTournament(createInput({ eventEndDate: '2026-11-01' }), 7)).resolves.toMatchObject({ id: 100 });
  });

  // ensureNotInPast's "event before today" check can't fire: ensureSchedule already requires
  // event start > registration end, and the registration end must be in the future.
  it('characterization: an event start in the past is caught earlier as INVALID_DATE_RANGE', async () => {
    expect(await rejected(Service.createTournament(createInput({
      registrationStart: '2026-09-01T00:00:00+07:00', registrationEnd: '2026-10-02T00:00:00+07:00',
      eventStartDate: '2026-09-30', eventEndDate: '2026-10-03',
    }), 7))).toMatchObject({ status: 400, code: 'INVALID_DATE_RANGE', extra: { fields: { eventStartDate: expect.any(String) } } });
  });

  it('400 TOURNAMENT_DATES_IN_PAST when registration has already closed', async () => {
    expect(await rejected(Service.createTournament(createInput({
      registrationStart: '2026-09-01T00:00:00+07:00', registrationEnd: '2026-09-30T00:00:00+07:00',
    }), 7))).toMatchObject({ status: 400, code: 'TOURNAMENT_DATES_IN_PAST', extra: { fields: { registrationEnd: expect.any(String) } } });
  });

  it('400 when minTeams > maxTeams', async () => {
    expect(await rejected(Service.createTournament(createInput({ minTeams: 20, maxTeams: 16 }), 7)))
      .toMatchObject({ code: 'VALIDATION_FAILED', extra: { fields: { minTeams: expect.any(String) } } });
  });

  it('400 when minAge > maxAge', async () => {
    expect(await rejected(Service.createTournament(createInput({ minAge: 25, maxAge: 18 }), 7)))
      .toMatchObject({ code: 'VALIDATION_FAILED', extra: { fields: { minAge: expect.any(String) } } });
  });

  it('400 for an unknown sport type', async () => {
    vi.mocked(SportTypeRepo.findSportTypeById).mockResolvedValueOnce(null as never);
    expect(await rejected(Service.createTournament(createInput(), 7)))
      .toMatchObject({ code: 'VALIDATION_FAILED', extra: { fields: { sportTypeId: expect.any(String) } } });
  });

  it('faculty scope: 400 without organizingFacultyId', async () => {
    expect(await rejected(Service.createTournament(createInput({ organizingFacultyId: null }), 7)))
      .toMatchObject({ extra: { fields: { organizingFacultyId: expect.stringContaining('faculty') } } });
  });

  it('faculty scope: 400 when a department is also given', async () => {
    expect(await rejected(Service.createTournament(createInput({ organizingDepartmentId: 3 }), 7)))
      .toMatchObject({ extra: { fields: { organizingDepartmentId: expect.any(String) } } });
  });

  it('faculty scope: 400 for an unknown faculty', async () => {
    vi.mocked(FacultyRepo.findFacultyById).mockResolvedValueOnce(null as never);
    expect(await rejected(Service.createTournament(createInput(), 7)))
      .toMatchObject({ extra: { fields: { organizingFacultyId: expect.any(String) } } });
  });

  it('department scope: creates when the department is in the faculty', async () => {
    vi.mocked(DepartmentRepo.findDepartmentInFaculty).mockResolvedValueOnce({ department_id: 3 } as never);

    await Service.createTournament(createInput({ scopeType: 'department', organizingDepartmentId: 3 }), 7);

    expect(DepartmentRepo.findDepartmentInFaculty).toHaveBeenCalledWith(2, 3);
    expect(TournamentRepo.insertTournament).toHaveBeenCalledWith(expect.objectContaining({ scopeType: 'department', organizingDepartmentId: 3 }));
  });

  it.each([
    ['no faculty', { organizingFacultyId: undefined, organizingDepartmentId: 3 }, 'organizingFacultyId'],
    ['no department', { organizingDepartmentId: null }, 'organizingDepartmentId'],
  ])('department scope: 400 with %s', async (_l, o, field) => {
    expect(await rejected(Service.createTournament(createInput({ scopeType: 'department', ...o }), 7)))
      .toMatchObject({ extra: { fields: { [field]: expect.stringContaining('department') } } });
  });

  it('department scope: 400 when the department belongs to another faculty', async () => {
    vi.mocked(DepartmentRepo.findDepartmentInFaculty).mockResolvedValueOnce(null as never);
    expect(await rejected(Service.createTournament(createInput({ scopeType: 'department', organizingDepartmentId: 3 }), 7)))
      .toMatchObject({ extra: { fields: { organizingDepartmentId: expect.any(String) } } });
    expect(TournamentRepo.insertTournament).not.toHaveBeenCalled();
  });

  it('a university admin is auto-approved', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValueOnce(admin({ user_id: 7 }));
    vi.mocked(TournamentRepo.approveTournament).mockResolvedValueOnce(true as never);

    await expect(Service.createTournament(createInput(), 7)).resolves.toMatchObject({ status: 'private', autoApproved: true });
    expect(TournamentRepo.approveTournament).toHaveBeenCalledWith(100, 7, true);
  });

  it('a faculty admin whose tournament is open to all faculties is not auto-approved', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValueOnce(admin({ user_id: 7, scope_type: 'faculty', faculty_id: 2 }));

    await expect(Service.createTournament(createInput(), 7)).resolves.toMatchObject({ status: 'pending_approval', autoApproved: false });
    expect(TournamentRepo.approveTournament).not.toHaveBeenCalled();
  });
});

// ───────────────────────── format lock ─────────────────────────

describe('setTournamentFormat', () => {
  it('409 MATCH_FORMAT_LOCKED once any match has started', async () => {
    vi.mocked(TournamentRepo.countStartedMatchesOfTournament).mockResolvedValueOnce(2 as never);
    expect(await rejected(Service.setTournamentFormat(50, { bestOf: 3 } as never, 7)))
      .toMatchObject({ status: 409, code: 'MATCH_FORMAT_LOCKED', extra: { startedMatches: 2 } });
    expect(TournamentRepo.setTournamentBestOfTx).not.toHaveBeenCalled();
  });

  it('403 for someone who is not the organizer', async () => {
    expect(await rejected(Service.setTournamentFormat(50, { bestOf: 3 } as never, 8))).toMatchObject({ status: 403, code: 'NOT_TOURNAMENT_ORGANIZER' });
  });

  it('saves the format before any match starts', async () => {
    await expect(Service.setTournamentFormat(50, { bestOf: 3 } as never, 7)).resolves.toEqual({ id: 50, bestOf: 3 });
    expect(TournamentRepo.setTournamentBestOfTx).toHaveBeenCalledWith(50, 3);
  });

  it('still saves when the sport row is missing (no sport rule to check)', async () => {
    vi.mocked(SportTypeRepo.findSportTypeById).mockResolvedValueOnce(null as never);
    await expect(Service.setTournamentFormat(50, { bestOf: 5 } as never, 7)).resolves.toEqual({ id: 50, bestOf: 5 });
  });
});

// ───────────────────────── visibility and reads ─────────────────────────

describe('getTournament — visibility', () => {
  it.each(['public', 'completed', 'cancelled'])('%s tournaments are visible to anyone', async (status) => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValueOnce(tournament({ tournament_status: status } as never));
    await expect(Service.getTournament(50)).resolves.toMatchObject({ id: 50, organizer: { id: 7 } });
  });

  it('a private tournament is visible to an admin who oversees it', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValueOnce(admin({ user_id: 1, scope_type: 'faculty', faculty_id: 2 }));
    await expect(Service.getTournament(50, 1)).resolves.toMatchObject({ id: 50 });
  });

  it('…but not to a faculty admin of another faculty', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValueOnce(admin({ user_id: 1, scope_type: 'faculty', faculty_id: 9 }));
    expect(await rejected(Service.getTournament(50, 1))).toMatchObject({ status: 404, code: 'TOURNAMENT_NOT_FOUND' });
  });

  it('a private tournament is visible to an invited referee', async () => {
    vi.mocked(TournamentRefereeRepo.findActiveByTournamentAndUser).mockResolvedValueOnce([{}] as never);
    await expect(Service.getTournament(50, 30)).resolves.toMatchObject({ id: 50 });
  });

  it('an auto-deleted tournament is hidden even from its referees', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValueOnce(tournament({ tournament_status: 'auto_deleted' } as never));
    vi.mocked(TournamentRefereeRepo.findActiveByTournamentAndUser).mockResolvedValueOnce([{}] as never);

    expect(await rejected(Service.getTournament(50, 30))).toMatchObject({ status: 404 });
    expect(TournamentRefereeRepo.findActiveByTournamentAndUser).not.toHaveBeenCalled();
  });

  it('a private tournament is hidden from anonymous viewers', async () => {
    expect(await rejected(Service.getTournament(50))).toMatchObject({ status: 404, code: 'TOURNAMENT_NOT_FOUND' });
  });

  it('404 when the tournament exists but its organizer row is gone', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValueOnce(tournament({ tournament_status: 'public' } as never));
    vi.mocked(TournamentRepo.findTournamentOrganizer).mockResolvedValueOnce(null as never);
    expect(await rejected(Service.getTournament(50))).toMatchObject({ status: 404, code: 'TOURNAMENT_NOT_FOUND' });
  });

  it('404 for an unknown tournament', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValueOnce(null as never);
    expect(await rejected(Service.getTournament(50))).toMatchObject({ status: 404 });
  });
});

describe('list endpoints', () => {
  it('getMyTournamentRequests maps rows and paginates', async () => {
    vi.mocked(TournamentRepo.findMyTournamentRequests).mockResolvedValueOnce({
      rows: [{ tournament_id: 50, name: 'ก', tournament_status: 'rejected', rejection_reason: 'วันชน', created_at: new Date('2026-09-01T00:00:00Z') }],
      totalItems: 1,
    } as never);

    await expect(Service.getMyTournamentRequests(7, 0, 1, 20)).resolves.toEqual({
      items: [{ id: 50, name: 'ก', status: 'rejected', rejectionReason: 'วันชน', createdAt: '2026-09-01T00:00:00.000Z' }],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    });
    expect(TournamentRepo.findMyTournamentRequests).toHaveBeenCalledWith(7, 0, 20);
  });

  it('getMyTournaments passes a known status filter through', async () => {
    vi.mocked(TournamentRepo.findTournamentsByOrganizer).mockResolvedValueOnce({
      rows: [{ tournament_id: 50, name: 'ก', tournament_status: 'public', rejection_reason: null, created_at: NOW }], totalItems: 1,
    } as never);

    const result = await Service.getMyTournaments(7, 'public', 0, 1, 20);

    expect(TournamentRepo.findTournamentsByOrganizer).toHaveBeenCalledWith(7, 'public', 0, 20);
    expect(result.items[0]).toMatchObject({ id: 50, status: 'public', rejectionReason: null });
  });

  it('getMyTournaments with no status lists everything', async () => {
    vi.mocked(TournamentRepo.findTournamentsByOrganizer).mockResolvedValueOnce({ rows: [], totalItems: 0 } as never);
    await Service.getMyTournaments(7, undefined, 0, 1, 20);
    expect(TournamentRepo.findTournamentsByOrganizer).toHaveBeenCalledWith(7, undefined, 0, 20);
  });

  it('getMyTournaments rejects an unknown status', async () => {
    expect(await rejected(Service.getMyTournaments(7, 'archived', 0, 1, 20)))
      .toMatchObject({ status: 400, code: 'VALIDATION_FAILED', extra: { fields: { status: expect.any(String) } } });
    expect(TournamentRepo.findTournamentsByOrganizer).not.toHaveBeenCalled();
  });

  // 'cancelled' is a real status (cancelTournament sets it, getVisibleTournament shows it) but is not in the filter list.
  it('characterization: getMyTournaments rejects status=cancelled', async () => {
    expect(await rejected(Service.getMyTournaments(7, 'cancelled', 0, 1, 20))).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('getPublicTournaments maps rows with the list mapper', async () => {
    vi.mocked(TournamentRepo.findPublicTournaments).mockResolvedValueOnce({
      rows: [{ tournament_id: 50, name: 'ก' }, { tournament_id: 51, name: 'ข' }], totalItems: 2,
    } as never);

    await expect(Service.getPublicTournaments({} as never, 0, 1, 20)).resolves.toEqual({
      items: [{ id: 50, name: 'ก' }, { id: 51, name: 'ข' }],
      pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
    });
  });
});

describe('getEligibilityRules', () => {
  it('maps rules of a visible tournament', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValueOnce(tournament({ tournament_status: 'public' } as never));
    vi.mocked(ApplicationRepo.findEligibilityRules).mockResolvedValueOnce([{ rule_type: 'faculty', rule_value: 2 }, { rule_type: 'year', rule_value: 1 }] as never);

    await expect(Service.getEligibilityRules(50)).resolves.toEqual({
      items: [{ ruleType: 'faculty', ruleValue: 2 }, { ruleType: 'year', ruleValue: 1 }],
    });
  });

  it('404 for a hidden tournament without reading rules', async () => {
    expect(await rejected(Service.getEligibilityRules(50))).toMatchObject({ status: 404 });
    expect(ApplicationRepo.findEligibilityRules).not.toHaveBeenCalled();
  });
});

// ───────────────────────── approve / reject races ─────────────────────────

describe('approveTournament / rejectTournament — status races', () => {
  beforeEach(() => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(admin());
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: 'pending_approval' } as never));
  });

  it('approve: 409 when the tournament is not pending', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValueOnce(tournament({ tournament_status: 'private' } as never));
    expect(await rejected(Service.approveTournament(50, 1))).toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
  });

  it('approve: 409 when another admin decided first (repo updated 0 rows), and nobody is notified', async () => {
    vi.mocked(TournamentRepo.approveTournament).mockResolvedValueOnce(false as never);
    expect(await rejected(Service.approveTournament(50, 1))).toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
    expect(NotificationService.notify).not.toHaveBeenCalled();
  });

  it('approve: marks self-approval when the admin is also the requester', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValueOnce(tournament({ tournament_status: 'pending_approval', requested_by_user_id: 1 } as never));
    vi.mocked(TournamentRepo.approveTournament).mockResolvedValueOnce(true as never);

    await Service.approveTournament(50, 1);
    expect(TournamentRepo.approveTournament).toHaveBeenCalledWith(50, 1, true);
  });

  it('reject: 409 when the tournament is not pending', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValueOnce(tournament({ tournament_status: 'rejected' } as never));
    expect(await rejected(Service.rejectTournament(50, 1, 'x'))).toMatchObject({ status: 409 });
    expect(TournamentRepo.rejectTournament).not.toHaveBeenCalled();
  });

  it('reject: 409 when another admin decided first', async () => {
    vi.mocked(TournamentRepo.rejectTournament).mockResolvedValueOnce(false as never);
    expect(await rejected(Service.rejectTournament(50, 1, 'x'))).toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
    expect(NotificationService.notify).not.toHaveBeenCalled();
  });

  it('reject: notifies the requester with the reason', async () => {
    vi.mocked(TournamentRepo.rejectTournament).mockResolvedValueOnce(true as never);

    await expect(Service.rejectTournament(50, 1, 'วันชนกับสอบ')).resolves.toEqual({ id: 50, status: 'rejected', reason: 'วันชนกับสอบ' });
    expect(NotificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7, type: 'tournament_decided', message: expect.stringContaining('วันชนกับสอบ'),
    }));
  });
});

// ───────────────────────── amendments ─────────────────────────

describe('previewAmendmentImpact', () => {
  it('a clean change can be submitted', async () => {
    await expect(Service.previewAmendmentImpact(50, 7, { requestedChanges: { maxTeams: 12 }, reason: 'x' } as never))
      .resolves.toEqual({ canSubmit: true, blockers: [], pendingAmendmentId: null });
  });

  it('reports a schedule conflict as a blocker instead of throwing', async () => {
    const result = await Service.previewAmendmentImpact(50, 7, { requestedChanges: { maxTeams: 2 }, reason: 'x' } as never);

    expect(result.canSubmit).toBe(false);
    expect(result.blockers).toEqual([expect.objectContaining({ code: 'VALIDATION_FAILED', details: { fields: { minTeams: expect.any(String) } } })]);
  });

  it('reports approved teams that the change would make ineligible', async () => {
    vi.mocked(ApplicationRepo.findApprovedSquadsForFilter).mockResolvedValueOnce([
      { team_id: 11, team_name: 'ทีม A', user_id: 100, full_name: 'สมชาย', gender: 'male', birth_date: '2004-01-01' },
      { team_id: 11, team_name: 'ทีม A', user_id: 101, full_name: 'สมหญิง', gender: 'female', birth_date: '2004-01-01' },
    ] as never);

    const result = await Service.previewAmendmentImpact(50, 7, { requestedChanges: { genderRequirement: 'female' }, reason: 'x' } as never);

    expect(result.canSubmit).toBe(false);
    expect(result.blockers[0]).toMatchObject({
      code: 'AMENDMENT_BREAKS_APPROVED_TEAMS',
      details: { affectedTeamCount: 1, affectedTeams: [{ teamId: 11, teamName: 'ทีม A', players: [{ userId: 100, fullName: 'สมชาย', reason: 'gender' }] }] },
    });
  });

  it('an already-pending amendment blocks submission but is not a "blocker"', async () => {
    vi.mocked(TournamentRepo.findPendingAmendmentOfTournament).mockResolvedValueOnce({ tournament_amendment_request_id: 30 } as never);

    await expect(Service.previewAmendmentImpact(50, 7, { requestedChanges: { maxTeams: 12 }, reason: 'x' } as never))
      .resolves.toEqual({ canSubmit: false, blockers: [], pendingAmendmentId: 30 });
  });

  it('still throws for fields that can never be amended (shape problem, not a blocker)', async () => {
    expect(await rejected(Service.previewAmendmentImpact(50, 7, { requestedChanges: { name: 'ใหม่' }, reason: 'x' } as never)))
      .toMatchObject({ status: 400, code: 'AMENDMENT_FIELD_NOT_ALLOWED', extra: { fields: ['name'] } });
  });

  it('400 when an allowed field has the wrong type', async () => {
    expect(await rejected(Service.previewAmendmentImpact(50, 7, { requestedChanges: { maxTeams: 'many' }, reason: 'x' } as never)))
      .toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
  });

  it('accepts requestedChanges sent as a JSON string', async () => {
    await expect(Service.previewAmendmentImpact(50, 7, { requestedChanges: '{"maxTeams":12}', reason: 'x' } as never))
      .resolves.toMatchObject({ canSubmit: true });
  });

  it.each([['an array', [1, 2]], ['broken JSON', '{maxTeams'], ['null', null]])('400 for requestedChanges as %s', async (_l, value) => {
    expect(await rejected(Service.previewAmendmentImpact(50, 7, { requestedChanges: value, reason: 'x' } as never)))
      .toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
  });

  // The "no registrationEnd → skip the approved-team check" early return in
  // assertAmendmentKeepsApprovedTeamsEligible can't be reached: a null registration_end already fails
  // ensureSchedule, which runs first, and the schema doesn't accept registrationEnd: null in a change.
  it('characterization: a tournament with no registration end gets TOURNAMENT_DATA_CONFLICT before the team check', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValueOnce(tournament({ registration_end: null } as never));

    const result = await Service.previewAmendmentImpact(50, 7, { requestedChanges: { genderRequirement: 'female' }, reason: 'x' } as never);

    expect(result.blockers).toEqual([expect.objectContaining({
      code: 'TOURNAMENT_DATA_CONFLICT', details: expect.objectContaining({ requestedFields: ['genderRequirement'] }),
    })]);
    expect(ApplicationRepo.findApprovedSquadsForFilter).not.toHaveBeenCalled();
  });

  it('registrationEnd: null in a change is rejected by the schema', async () => {
    expect(await rejected(Service.previewAmendmentImpact(50, 7, { requestedChanges: { registrationEnd: null }, reason: 'x' } as never)))
      .toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
  });
});

describe('requestAmendment', () => {
  it('409 AMENDMENT_ALREADY_PENDING when one is waiting, with its id', async () => {
    vi.mocked(TournamentRepo.findPendingAmendmentOfTournament).mockResolvedValueOnce({ tournament_amendment_request_id: 30 } as never);
    expect(await rejected(Service.requestAmendment(50, 7, { requestedChanges: { maxTeams: 12 }, reason: 'x' } as never)))
      .toMatchObject({ status: 409, code: 'AMENDMENT_ALREADY_PENDING', extra: { amendmentId: 30 } });
    expect(TournamentRepo.insertAmendmentRequest).not.toHaveBeenCalled();
  });

  it('stores a valid request', async () => {
    await expect(Service.requestAmendment(50, 7, { requestedChanges: { maxTeams: 12 }, reason: 'สนามเล็กลง' } as never))
      .resolves.toEqual({ id: 55, status: 'pending' });
    expect(TournamentRepo.insertAmendmentRequest).toHaveBeenCalledWith(50, 7, { maxTeams: 12 }, 'สนามเล็กลง');
  });
});

describe('getAmendmentImpactForAdmin', () => {
  beforeEach(() => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(admin());
    vi.mocked(TournamentRepo.findAmendmentById).mockResolvedValue(amendmentRow() as never);
  });

  it('a clean pending request can be approved', async () => {
    await expect(Service.getAmendmentImpactForAdmin(30, 1)).resolves.toEqual({
      requestId: 30, tournamentId: 50, tournamentName: 'ฟุตบอลคณะ', status: 'pending',
      requestedChanges: { maxTeams: 12 }, reason: 'สนามเล็กลง', selfRequested: false,
      alreadyDecided: false, canApprove: true, blockers: [],
    });
  });

  it('flags a self-request', async () => {
    vi.mocked(TournamentRepo.findAmendmentById).mockResolvedValueOnce(amendmentRow({ requested_by: 1 }) as never);
    expect((await Service.getAmendmentImpactForAdmin(30, 1)).selfRequested).toBe(true);
  });

  it('an already decided request cannot be approved even if clean', async () => {
    vi.mocked(TournamentRepo.findAmendmentById).mockResolvedValueOnce(amendmentRow({ tournament_amendment_request_status: 'approved' }) as never);
    await expect(Service.getAmendmentImpactForAdmin(30, 1)).resolves.toMatchObject({ alreadyDecided: true, canApprove: false, blockers: [] });
  });

  it('a stored payload that no longer parses becomes a blocker, returned raw', async () => {
    vi.mocked(TournamentRepo.findAmendmentById).mockResolvedValueOnce(amendmentRow({ requested_changes: { bracketFormat: 'round_robin' } }) as never);

    const result = await Service.getAmendmentImpactForAdmin(30, 1);

    expect(result.canApprove).toBe(false);
    expect(result.requestedChanges).toEqual({ bracketFormat: 'round_robin' });
    expect(result.blockers[0]).toMatchObject({ code: 'AMENDMENT_FIELD_NOT_ALLOWED' });
  });

  it('a faculty admin cannot approve a change to an all-faculty tournament (eligibility out of scope)', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(admin({ scope_type: 'faculty', faculty_id: 2 }));

    const result = await Service.getAmendmentImpactForAdmin(30, 1);
    expect(result.blockers).toEqual([expect.objectContaining({ code: 'ELIGIBILITY_OUT_OF_SCOPE' })]);
  });

  it('a faculty admin can approve when the tournament is limited to their faculty', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(admin({ scope_type: 'faculty', faculty_id: 2 }));
    vi.mocked(ApplicationRepo.findEligibilityRules).mockResolvedValueOnce([{ rule_type: 'faculty', rule_value: 2 }] as never);

    expect((await Service.getAmendmentImpactForAdmin(30, 1)).canApprove).toBe(true);
  });

  it('a change of eligibility rules is checked against the NEW rules and the edit lock', async () => {
    vi.mocked(TournamentRepo.findAmendmentById).mockResolvedValueOnce(amendmentRow({
      requested_changes: { eligibilityRules: [{ type: 'faculty', value: 2 }] },
    }) as never);
    vi.mocked(TournamentRepo.hasLiveApplications).mockResolvedValueOnce(true as never);

    const result = await Service.getAmendmentImpactForAdmin(30, 1);
    expect(result.blockers).toEqual([expect.objectContaining({ code: 'ELIGIBILITY_LOCKED' })]);
  });

  it('a faculty admin: new rules opening the tournament to everyone → out of scope', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(admin({ scope_type: 'faculty', faculty_id: 2 }));
    vi.mocked(TournamentRepo.findAmendmentById).mockResolvedValueOnce(amendmentRow({ requested_changes: { eligibilityRules: [] } }) as never);

    const result = await Service.getAmendmentImpactForAdmin(30, 1);
    expect(result.blockers).toEqual([expect.objectContaining({ code: 'ELIGIBILITY_OUT_OF_SCOPE' })]);
  });

  it('404 AMENDMENT_NOT_FOUND for an unknown request', async () => {
    vi.mocked(TournamentRepo.findAmendmentById).mockResolvedValueOnce(null as never);
    expect(await rejected(Service.getAmendmentImpactForAdmin(30, 1))).toMatchObject({ status: 404, code: 'AMENDMENT_NOT_FOUND' });
  });

  it('403 for an admin who does not oversee the tournament', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(admin({ scope_type: 'faculty', faculty_id: 9 }));
    expect(await rejected(Service.getAmendmentImpactForAdmin(30, 1))).toMatchObject({ status: 403, code: 'INSUFFICIENT_ADMIN_SCOPE' });
  });
});

describe('approveAmendment / rejectAmendment — edges', () => {
  beforeEach(() => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(admin());
    vi.mocked(TournamentRepo.findAmendmentById).mockResolvedValue(amendmentRow() as never);
  });

  it.each([['cancelled', 'TOURNAMENT_CANCELLED'], ['completed', 'TOURNAMENT_COMPLETED']])(
    'approve: 409 on a %s tournament', async (status, code) => {
      vi.mocked(TournamentRepo.findTournamentById).mockResolvedValueOnce(tournament({ tournament_status: status } as never));
      expect(await rejected(Service.approveAmendment(30, 1))).toMatchObject({ status: 409, code, extra: { tournamentId: 50 } });
      expect(TournamentRepo.approveAmendment).not.toHaveBeenCalled();
    });

  it.each([
    ['not_found', 404, 'AMENDMENT_NOT_FOUND'],
    ['already_decided', 409, 'ALREADY_DECIDED'],
    ['capacity_conflict', 409, 'TEAM_CAPACITY_CONFLICT'],
  ])('approve: repo result %s → %i %s', async (result, status, code) => {
    vi.mocked(TournamentRepo.approveAmendment).mockResolvedValueOnce(result as never);
    expect(await rejected(Service.approveAmendment(30, 1))).toMatchObject({ status, code });
  });

  it('approve: success', async () => {
    vi.mocked(TournamentRepo.approveAmendment).mockResolvedValueOnce('ok' as never);
    await expect(Service.approveAmendment(30, 1)).resolves.toEqual({ id: 30, status: 'approved' });
    expect(TournamentRepo.approveAmendment).toHaveBeenCalledWith(30, 1, { maxTeams: 12 });
  });

  it.each([['not_found', 404, 'AMENDMENT_NOT_FOUND'], ['already_decided', 409, 'ALREADY_DECIDED']])(
    'reject: repo result %s → %i %s', async (result, status, code) => {
      vi.mocked(TournamentRepo.rejectAmendment).mockResolvedValueOnce(result as never);
      expect(await rejected(Service.rejectAmendment(30, 1, 'ไม่จำเป็น'))).toMatchObject({ status, code });
    });

  it('reject: success returns the reason', async () => {
    vi.mocked(TournamentRepo.rejectAmendment).mockResolvedValueOnce('ok' as never);
    await expect(Service.rejectAmendment(30, 1, 'ไม่จำเป็น')).resolves.toEqual({ id: 30, status: 'rejected', reason: 'ไม่จำเป็น' });
  });
});

// ───────────────────────── publish / complete / delete edges ─────────────────────────

describe('publishTournament — status changed', () => {
  it('409 INVALID_STATUS_TRANSITION for any repo status other than ok / referees_incomplete', async () => {
    vi.mocked(TournamentRepo.publishTournament).mockResolvedValueOnce({ status: 'invalid_status' } as never);
    expect(await rejected(Service.publishTournament(tournament(), 7))).toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
    expect(NotificationService.notifyTournamentReferees).not.toHaveBeenCalled();
  });

  it('uses the online referee count when the sport defaults to online', async () => {
    vi.mocked(SportTypeRepo.findSportTypeById).mockResolvedValueOnce({ sport_type_id: 1, default_mode: 'online' } as never);
    vi.mocked(TournamentRepo.publishTournament).mockResolvedValueOnce({ status: 'ok' } as never);

    await Service.publishTournament(tournament(), 7);
    expect(TournamentRepo.publishTournament).toHaveBeenCalledWith(50, 7, 1);
  });

  it('falls back to on-site when the sport row is missing', async () => {
    vi.mocked(SportTypeRepo.findSportTypeById).mockResolvedValueOnce(null as never);
    vi.mocked(TournamentRepo.publishTournament).mockResolvedValueOnce({ status: 'ok' } as never);

    await Service.publishTournament(tournament(), 7);
    expect(TournamentRepo.publishTournament).toHaveBeenCalledWith(50, 7, 2);
  });
});

describe('completeTournament — auto-verify on close', () => {
  it('re-reads unfinished matches after auto-verifying, then completes when none remain', async () => {
    vi.mocked(TournamentRepo.findUnfinishedMatchIds)
      .mockResolvedValueOnce([{ match_id: 9, match_status: 'finished' }] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(MatchResultService.autoVerifyDue).mockResolvedValueOnce([9]);
    vi.mocked(MatchRepo.countMatchesByTournament).mockResolvedValueOnce(7 as never);
    vi.mocked(MatchResultService.resolveChampionTeamId).mockResolvedValueOnce(11);
    vi.mocked(TournamentRepo.completeTournament).mockResolvedValueOnce(true as never);

    await expect(Service.completeTournament(tournament({ tournament_status: 'public' } as never), 7))
      .resolves.toEqual({ id: 50, status: 'completed', championTeamId: 11 });
    expect(MatchResultService.autoVerifyDue).toHaveBeenCalledWith([9]);
    expect(TournamentRepo.findUnfinishedMatchIds).toHaveBeenCalledTimes(2);
  });

  it('does not re-read when nothing was auto-verified', async () => {
    vi.mocked(TournamentRepo.findUnfinishedMatchIds).mockResolvedValueOnce([{ match_id: 9, match_status: 'in_progress' }] as never);

    expect(await rejected(Service.completeTournament(tournament({ tournament_status: 'public' } as never), 7)))
      .toMatchObject({ status: 409, code: 'MATCHES_UNFINISHED', extra: { matches: [{ id: 9, status: 'in_progress' }] } });
    expect(TournamentRepo.findUnfinishedMatchIds).toHaveBeenCalledTimes(1);
  });
});

describe('deleteTournament — statuses', () => {
  it.each(['auto_deleted', 'cancelled'])('409 INVALID_STATUS_TRANSITION for a %s tournament', async (status) => {
    expect(await rejected(Service.deleteTournament(tournament({ tournament_status: status } as never), 7)))
      .toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
    expect(TournamentRepo.softDeleteTournament).not.toHaveBeenCalled();
  });
});

// ───────────────────────── background jobs ─────────────────────────

describe('sweepAutoDeleteTournaments', () => {
  it('notifies each organizer whose tournament was closed, and returns what was swept', async () => {
    const swept = [
      { tournamentId: 50, organizerId: 7, name: 'ก' },
      { tournamentId: 51, organizerId: 8, name: 'ข' },
    ];
    vi.mocked(TournamentRepo.sweepPrivatePastDueTournaments).mockResolvedValueOnce(swept as never);

    await expect(Service.sweepAutoDeleteTournaments()).resolves.toBe(swept);
    expect(NotificationService.notifyUsers).toHaveBeenCalledTimes(2);
    expect(NotificationService.notifyUsers).toHaveBeenNthCalledWith(1, [7], expect.objectContaining({
      type: 'tournament_auto_deleted', title: expect.stringContaining('ก'), relatedEntityId: 50,
    }));
  });

  it('nothing to sweep → no notifications', async () => {
    vi.mocked(TournamentRepo.sweepPrivatePastDueTournaments).mockResolvedValueOnce([] as never);
    await expect(Service.sweepAutoDeleteTournaments()).resolves.toEqual([]);
    expect(NotificationService.notifyUsers).not.toHaveBeenCalled();
  });
});

describe('warnBeforeAutoDelete', () => {
  it('asks for tournaments 7 days out, warns each once, and returns the warned ids', async () => {
    vi.mocked(TournamentRepo.findTournamentsToWarnBeforeAutoDelete).mockResolvedValueOnce([
      { tournamentId: 50, organizerId: 7, name: 'ก', eventStartDate: '2026-10-08' },
      { tournamentId: 51, organizerId: 8, name: 'ข', eventStartDate: '2026-10-08' },
    ] as never);
    // 51 was claimed by another process between the read and the mark
    vi.mocked(TournamentRepo.markAutoDeleteWarned).mockResolvedValueOnce(true as never).mockResolvedValueOnce(false as never);

    await expect(Service.warnBeforeAutoDelete()).resolves.toEqual([50]);

    expect(TournamentRepo.findTournamentsToWarnBeforeAutoDelete).toHaveBeenCalledWith(Service.AUTO_DELETE_WARNING_DAYS, expect.any(Date));
    expect(Service.AUTO_DELETE_WARNING_DAYS).toBe(7);
    expect(NotificationService.notifyUsers).toHaveBeenCalledTimes(1);
    expect(NotificationService.notifyUsers).toHaveBeenCalledWith([7], expect.objectContaining({
      type: 'tournament_auto_delete_warning', message: expect.stringContaining('2026-10-08'),
    }));
  });

  it('nothing to warn → empty list', async () => {
    vi.mocked(TournamentRepo.findTournamentsToWarnBeforeAutoDelete).mockResolvedValueOnce([] as never);
    await expect(Service.warnBeforeAutoDelete()).resolves.toEqual([]);
  });
});

describe('purgeExpiredTournaments', () => {
  it('purges tournaments closed for more than 4 years and returns the repo result', async () => {
    vi.mocked(TournamentRepo.purgeTournamentsClosedOver).mockResolvedValueOnce(3 as never);

    await expect(Service.purgeExpiredTournaments()).resolves.toBe(3);
    expect(TournamentRepo.purgeTournamentsClosedOver).toHaveBeenCalledWith(4);
    expect(Service.TOURNAMENT_RETENTION_YEARS).toBe(4);
  });
});

// ───────────────────────── remaining branches ─────────────────────────

describe('unexpected errors are not swallowed as blockers', () => {
  it('previewAmendmentImpact rethrows a non-AppError (e.g. the database is down)', async () => {
    vi.mocked(ApplicationRepo.findApprovedSquadsForFilter).mockRejectedValueOnce(new Error('DB_DOWN'));
    await expect(Service.previewAmendmentImpact(50, 7, { requestedChanges: { minAge: 18 }, reason: 'x' } as never))
      .rejects.toThrow('DB_DOWN');
  });

  it('getAmendmentImpactForAdmin rethrows a non-AppError', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(admin());
    vi.mocked(TournamentRepo.findAmendmentById).mockResolvedValueOnce(amendmentRow({ requested_changes: { minAge: 18 } }) as never);
    vi.mocked(ApplicationRepo.findApprovedSquadsForFilter).mockRejectedValueOnce(new Error('DB_DOWN'));

    await expect(Service.getAmendmentImpactForAdmin(30, 1)).rejects.toThrow('DB_DOWN');
  });
});

describe('getPendingTournamentRequests — faculty admin', () => {
  it('a tournament with no rules at all is open to every faculty → canDecide false', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValueOnce(admin({ scope_type: 'faculty', faculty_id: 2 }));
    vi.mocked(TournamentRepo.findPendingTournamentRequests).mockResolvedValueOnce({
      rows: [
        { tournament_id: 50, name: 'ก', organizing_faculty_id: 2, user_id: 7, full_name: 'x', profile_image_key: null, sport_type_id: 1, event_start_date: '2026-11-01', created_at: NOW },
        { tournament_id: 51, name: 'ข', organizing_faculty_id: 2, user_id: 8, full_name: 'y', profile_image_key: null, sport_type_id: 1, event_start_date: '2026-11-01', created_at: NOW },
      ],
      totalItems: 2,
    } as never);
    vi.mocked(ApplicationRepo.findEligibilityRulesOfMany).mockResolvedValueOnce(
      new Map([[51, [{ rule_type: 'faculty', rule_value: 2 }]]]) as never);

    const { items } = await Service.getPendingTournamentRequests(1, 0, 1, 20);

    expect(ApplicationRepo.findEligibilityRulesOfMany).toHaveBeenCalledWith([50, 51]);
    expect(items.map(i => [i.id, i.canDecide, i.cannotDecideReason])).toEqual([
      [50, false, 'ELIGIBILITY_OUT_OF_SCOPE'],
      [51, true, null],
    ]);
  });
});

describe('faculty admin changing eligibility rules inside their own faculty', () => {
  beforeEach(() => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(admin({ scope_type: 'faculty', faculty_id: 2 }));
    vi.mocked(TournamentRepo.findAmendmentById).mockResolvedValue(amendmentRow({
      requested_changes: { eligibilityRules: [{ type: 'faculty', value: 2 }, { type: 'year', value: 1 }] },
    }) as never);
  });

  it('impact view: can approve', async () => {
    await expect(Service.getAmendmentImpactForAdmin(30, 1)).resolves.toMatchObject({ canApprove: true, blockers: [] });
  });

  it('approve: goes through to the repo', async () => {
    vi.mocked(TournamentRepo.approveAmendment).mockResolvedValueOnce('ok' as never);
    await expect(Service.approveAmendment(30, 1)).resolves.toEqual({ id: 30, status: 'approved' });
  });

  it('approve: rules adding another faculty are out of scope', async () => {
    vi.mocked(TournamentRepo.findAmendmentById).mockResolvedValueOnce(amendmentRow({
      requested_changes: { eligibilityRules: [{ type: 'faculty', value: 2 }, { type: 'faculty', value: 3 }] },
    }) as never);
    expect(await rejected(Service.approveAmendment(30, 1))).toMatchObject({ status: 403, code: 'ELIGIBILITY_OUT_OF_SCOPE' });
    expect(TournamentRepo.approveAmendment).not.toHaveBeenCalled();
  });
});
