import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../repositories/application.repo.js', () => ({
  findApprovedTeamsByTournament: vi.fn(),
  findApplicationsByLeader: vi.fn(),
  findApplicationsByTournament: vi.fn(),
  findApplicationById: vi.fn(),
  updateApplicationStatus: vi.fn(),
  rejectApplicationInDb: vi.fn(),
  findTeamForApply: vi.fn(),
  findExistingApplication: vi.fn(),
  findTeamMembersForFilter: vi.fn(),
  findEligibilityRules: vi.fn(),
  insertApplication: vi.fn(),
}));

vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(),
}));

vi.mock('../../mappers/team.mapper.js', () => ({
  toTeamRef: vi.fn(),
}));

vi.mock('../../mappers/application.mapper.js', () => ({
  toApplicationDetailDto: vi.fn(),
  toMyApplicationDto: vi.fn(),
  toOrganizerApplicationDto: vi.fn(),
}));

import * as applicationService from '../application.service.js';
import * as ApplicationRepo from '../../repositories/application.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import { toTeamRef } from '../../mappers/team.mapper.js';
import {
  toApplicationDetailDto,
  toMyApplicationDto,
  toOrganizerApplicationDto,
} from '../../mappers/application.mapper.js';
import { AppError } from '../../utils/AppError.js';
import type {
  ApplicationDetailRow,
  LeaderApplicationRow,
  OrganizerApplicationRow,
  TeamForApplyRow,
  TeamMemberForFilterRow,
  EligibilityRuleRow,
} from '../../repositories/application.repo.js';
import type { TeamRow, TournamentRow } from '../../types/db.js';

const mockedApplicationRepo = vi.mocked(ApplicationRepo);
const mockedTournamentRepo = vi.mocked(TournamentRepo);
const mockedToTeamRef = vi.mocked(toTeamRef);
const mockedToApplicationDetailDto = vi.mocked(toApplicationDetailDto);
const mockedToMyApplicationDto = vi.mocked(toMyApplicationDto);
const mockedToOrganizerApplicationDto = vi.mocked(toOrganizerApplicationDto);

type ApprovedTeamRow = Pick<TeamRow, 'team_id' | 'name' | 'sport_type_id'>;

function makeApprovedTeam(overrides: Partial<ApprovedTeamRow> = {}): ApprovedTeamRow {
  return { team_id: 1, name: 'Team A', sport_type_id: 1, ...overrides };
}

function makeLeaderApplication(overrides: Partial<LeaderApplicationRow> = {}): LeaderApplicationRow {
  return {
    tournament_application_id: 1,
    tournament_application_status: 'pending',
    rejection_reason: null,
    applied_at: new Date(),
    tournament_id: 20,
    tournament_name: 'Championship Cup',
    team_id: 10,
    team_name: 'Dream Team',
    sport_type_id: 1,
    ...overrides,
  };
}

function makeOrganizerApplication(overrides: Partial<OrganizerApplicationRow> = {}): OrganizerApplicationRow {
  return {
    tournament_application_id: 1,
    tournament_application_status: 'pending',
    hard_filter_passed: 1,
    soft_filter_documents: null,
    applied_at: new Date(),
    team_id: 10,
    team_name: 'Dream Team',
    sport_type_id: 1,
    ...overrides,
  };
}

function makeApplicationDetail(overrides: Partial<ApplicationDetailRow> = {}): ApplicationDetailRow {
  return {
    tournament_application_id: 100,
    tournament_application_status: 'pending',
    hard_filter_details: null,
    soft_filter_documents: null,
    tournament_id: 20,
    tournament_requested_by_user_id: 7,
    tournament_status: 'public',
    team_id: 10,
    team_name: 'Dream Team',
    sport_type_id: 1,
    team_leader_id: 5,
    ...overrides,
  };
}

function makeTeamForApply(overrides: Partial<TeamForApplyRow> = {}): TeamForApplyRow {
  return { team_id: 10, leader_id: 5, readiness_status: 'Ready', ...overrides };
}

function makeTournament(overrides: Partial<TournamentRow> = {}): TournamentRow {
  return {
    tournament_id: 20,
    name: 'Championship Cup',
    sport_type_id: 1,
    bracket_format: 'single_elimination',
    scope_type: 'university',
    organizing_faculty_id: null,
    organizing_department_id: null,
    requested_by_user_id: 7,
    organizer_external_approval_status: 'not_required',
    organizer_external_reviewed_by: null,
    organizer_external_reviewed_at: null,
    organizer_external_rejection_reason: null,
    organizer_external_verification_docs: null,
    tournament_status: 'public',
    registration_open: 1,
    registration_start: null,
    registration_end: null,
    event_start_date: '2026-10-01',
    event_end_date: null,
    max_teams: 16,
    min_teams: 4,
    venue: null,
    dispute_window_hours: 24,
    gender_requirement: 'any',
    min_age: null,
    max_age: null,
    rejection_reason: null,
    approved_by: null,
    approved_at: null,
    created_at: new Date(),
    updated_at: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  };
}

function makeMember(overrides: Partial<TeamMemberForFilterRow> = {}): TeamMemberForFilterRow {
  return {
    user_id: 1,
    full_name: 'Member One',
    gender: 'male',
    birth_date: '2000-06-15',
    year: 2,
    faculty_id: 1,
    ...overrides,
  };
}

function makeRule(overrides: Partial<EligibilityRuleRow> = {}): EligibilityRuleRow {
  return { rule_type: 'year', rule_value: 1, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getApprovedTeams', () => {
  it('returns every approved team mapped to a DTO', async () => {
    const rows = [makeApprovedTeam({ team_id: 1 }), makeApprovedTeam({ team_id: 2, name: 'Team B' })];
    mockedApplicationRepo.findApprovedTeamsByTournament.mockResolvedValue(rows);
    mockedToTeamRef
      .mockReturnValueOnce({ id: 1 } as any)
      .mockReturnValueOnce({ id: 2 } as any);

    const result = await applicationService.getApprovedTeams(20);

    expect(mockedApplicationRepo.findApprovedTeamsByTournament).toHaveBeenCalledWith(20);
    expect(mockedToTeamRef.mock.calls[0]?.[0]).toEqual(rows[0]);
    expect(result).toEqual({ items: [{ id: 1 }, { id: 2 }] });
  });

  it('returns an empty items array when there are no approved teams', async () => {
    mockedApplicationRepo.findApprovedTeamsByTournament.mockResolvedValue([]);

    const result = await applicationService.getApprovedTeams(20);

    expect(result).toEqual({ items: [] });
    expect(mockedToTeamRef).not.toHaveBeenCalled();
  });
});

describe('getMyappication', () => {
  it('returns every application led by the user, mapped to a DTO', async () => {
    const rows = [
      makeLeaderApplication({ tournament_application_id: 1 }),
      makeLeaderApplication({ tournament_application_id: 2 }),
    ];
    mockedApplicationRepo.findApplicationsByLeader.mockResolvedValue(rows);
    mockedToMyApplicationDto
      .mockReturnValueOnce({ id: 1 } as any)
      .mockReturnValueOnce({ id: 2 } as any);

    const result = await applicationService.getMyappication(5);

    expect(mockedApplicationRepo.findApplicationsByLeader).toHaveBeenCalledWith(5);
    expect(mockedToMyApplicationDto.mock.calls[0]?.[0]).toEqual(rows[0]);
    expect(result).toEqual({ items: [{ id: 1 }, { id: 2 }] });
  });

  it('returns an empty items array when the user leads no applications', async () => {
    mockedApplicationRepo.findApplicationsByLeader.mockResolvedValue([]);

    const result = await applicationService.getMyappication(5);

    expect(result).toEqual({ items: [] });
  });
});

describe('getTournamentApplications', () => {
  it('returns every application for the tournament mapped to a DTO', async () => {
    const rows = [makeOrganizerApplication({ tournament_application_id: 1 })];
    mockedApplicationRepo.findApplicationsByTournament.mockResolvedValue(rows);
    mockedToOrganizerApplicationDto.mockReturnValue({ id: 1 } as any);

    const result = await applicationService.getTournamentApplications(20);

    expect(mockedApplicationRepo.findApplicationsByTournament).toHaveBeenCalledWith(20);
    // .map(toOrganizerApplicationDto) invokes the callback as (item, index,
    // array), so only assert on the first argument the call actually cares about.
    expect(mockedToOrganizerApplicationDto.mock.calls[0]?.[0]).toEqual(rows[0]);
    expect(result).toEqual({ items: [{ id: 1 }] });
  });

  it('returns an empty items array when the tournament has no applications', async () => {
    mockedApplicationRepo.findApplicationsByTournament.mockResolvedValue([]);

    const result = await applicationService.getTournamentApplications(20);

    expect(result).toEqual({ items: [] });
  });
});

describe('getApplicationDetail', () => {
  it('throws APPLICATION_NOT_FOUND when the application does not exist', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(null);

    await expect(applicationService.getApplicationDetail(100, 5)).rejects.toMatchObject({
      status: 404,
      code: 'APPLICATION_NOT_FOUND',
    });
  });

  it('returns the detail DTO when the requester is the team leader', async () => {
    const app = makeApplicationDetail({ team_leader_id: 5, tournament_requested_by_user_id: 999 });
    mockedApplicationRepo.findApplicationById.mockResolvedValue(app);
    mockedToApplicationDetailDto.mockReturnValue({ id: 100 } as any);

    const result = await applicationService.getApplicationDetail(100, 5);

    expect(mockedToApplicationDetailDto).toHaveBeenCalledWith(app);
    expect(result).toEqual({ id: 100 });
  });

  it('returns the detail DTO when the requester is the organizer of a non-pending/rejected tournament', async () => {
    const app = makeApplicationDetail({
      team_leader_id: 999,
      tournament_requested_by_user_id: 7,
      tournament_status: 'public',
    });
    mockedApplicationRepo.findApplicationById.mockResolvedValue(app);
    mockedToApplicationDetailDto.mockReturnValue({ id: 100 } as any);

    const result = await applicationService.getApplicationDetail(100, 7);

    expect(result).toEqual({ id: 100 });
  });

  it('throws APPLICATION_ACCESS_DENIED when the requester is neither the leader nor a valid organizer', async () => {
    const app = makeApplicationDetail({ team_leader_id: 999, tournament_requested_by_user_id: 888 });
    mockedApplicationRepo.findApplicationById.mockResolvedValue(app);

    await expect(applicationService.getApplicationDetail(100, 5)).rejects.toMatchObject({
      status: 403,
      code: 'APPLICATION_ACCESS_DENIED',
    });
  });

  it.each(['pending_approval', 'rejected'] as const)(
    'throws APPLICATION_ACCESS_DENIED when the requester owns the tournament but its status is %s',
    async (status) => {
      const app = makeApplicationDetail({
        team_leader_id: 999,
        tournament_requested_by_user_id: 7,
        tournament_status: status,
      });
      mockedApplicationRepo.findApplicationById.mockResolvedValue(app);

      await expect(applicationService.getApplicationDetail(100, 7)).rejects.toMatchObject({
        status: 403,
        code: 'APPLICATION_ACCESS_DENIED',
      });
    },
  );
});

describe('cancelApplication', () => {
  it('throws APPLICATION_NOT_FOUND when the application does not exist', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(null);

    await expect(applicationService.cancelApplication(100, 5)).rejects.toMatchObject({
      status: 404,
      code: 'APPLICATION_NOT_FOUND',
    });
  });

  it('throws NOT_TEAM_LEADER when the requester is not the team leader', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(
      makeApplicationDetail({ team_leader_id: 999 }),
    );

    await expect(applicationService.cancelApplication(100, 5)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_TEAM_LEADER',
    });
    expect(mockedApplicationRepo.updateApplicationStatus).not.toHaveBeenCalled();
  });

  it('throws ALREADY_DECIDED when the application is no longer pending', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(
      makeApplicationDetail({ team_leader_id: 5, tournament_application_status: 'approved' }),
    );

    await expect(applicationService.cancelApplication(100, 5)).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_DECIDED',
    });
    expect(mockedApplicationRepo.updateApplicationStatus).not.toHaveBeenCalled();
  });

  it('cancels a pending application owned by the team leader', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(
      makeApplicationDetail({ team_leader_id: 5, tournament_application_status: 'pending' }),
    );

    const result = await applicationService.cancelApplication(100, 5);

    expect(mockedApplicationRepo.updateApplicationStatus).toHaveBeenCalledWith(100, 'cancelled');
    expect(result).toEqual({ id: 100, status: 'cancelled' });
  });
});

describe('withdrawApplication', () => {
  it('throws APPLICATION_NOT_FOUND when the application does not exist', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(null);

    await expect(applicationService.withdrawApplication(100, 5)).rejects.toMatchObject({
      status: 404,
      code: 'APPLICATION_NOT_FOUND',
    });
  });

  it('throws NOT_TEAM_LEADER when the requester is not the team leader', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(
      makeApplicationDetail({ team_leader_id: 999 }),
    );

    await expect(applicationService.withdrawApplication(100, 5)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_TEAM_LEADER',
    });
  });

  it('throws APPLICATION_NOT_APPROVED when the application was never approved', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(
      makeApplicationDetail({ team_leader_id: 5, tournament_application_status: 'pending' }),
    );

    await expect(applicationService.withdrawApplication(100, 5)).rejects.toMatchObject({
      status: 409,
      code: 'APPLICATION_NOT_APPROVED',
    });
    expect(mockedApplicationRepo.updateApplicationStatus).not.toHaveBeenCalled();
  });

  it('withdraws an approved application owned by the team leader', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(
      makeApplicationDetail({ team_leader_id: 5, tournament_application_status: 'approved' }),
    );

    const result = await applicationService.withdrawApplication(100, 5);

    expect(mockedApplicationRepo.updateApplicationStatus).toHaveBeenCalledWith(100, 'withdrawn');
    expect(result).toEqual({ id: 100, status: 'withdrawn', bracketExists: false });
  });
});

describe('approveApplication', () => {
  it('throws APPLICATION_NOT_FOUND when the application does not exist', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(null);

    await expect(applicationService.approveApplication(100, 7)).rejects.toMatchObject({
      status: 404,
      code: 'APPLICATION_NOT_FOUND',
    });
  });

  it('throws NOT_ORGANIZER when the requester did not request the tournament', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(
      makeApplicationDetail({ tournament_requested_by_user_id: 999 }),
    );

    await expect(applicationService.approveApplication(100, 7)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_ORGANIZER',
    });
    expect(mockedApplicationRepo.updateApplicationStatus).not.toHaveBeenCalled();
  });

  it.each(['pending_approval', 'rejected'] as const)(
    'throws NOT_ORGANIZER when the requester owns the tournament but its status is %s',
    async (status) => {
      mockedApplicationRepo.findApplicationById.mockResolvedValue(
        makeApplicationDetail({ tournament_requested_by_user_id: 7, tournament_status: status }),
      );

      await expect(applicationService.approveApplication(100, 7)).rejects.toMatchObject({
        status: 403,
        code: 'NOT_ORGANIZER',
      });
    },
  );

  it('throws ALREADY_DECIDED when the application is no longer pending', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(
      makeApplicationDetail({
        tournament_requested_by_user_id: 7,
        tournament_status: 'public',
        tournament_application_status: 'approved',
      }),
    );

    await expect(applicationService.approveApplication(100, 7)).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_DECIDED',
    });
  });

  it('approves a pending application for the tournament organizer', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(
      makeApplicationDetail({
        tournament_requested_by_user_id: 7,
        tournament_status: 'public',
        tournament_application_status: 'pending',
      }),
    );

    const result = await applicationService.approveApplication(100, 7);

    expect(mockedApplicationRepo.updateApplicationStatus).toHaveBeenCalledWith(100, 'approved');
    expect(result).toEqual({ id: 100, status: 'approved' });
  });
});

describe('rejectApplication', () => {
  it('throws APPLICATION_NOT_FOUND when the application does not exist', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(null);

    await expect(applicationService.rejectApplication(100, 7, 'not eligible')).rejects.toMatchObject({
      status: 404,
      code: 'APPLICATION_NOT_FOUND',
    });
  });

  it('throws NOT_ORGANIZER when the requester did not request the tournament', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(
      makeApplicationDetail({ tournament_requested_by_user_id: 999 }),
    );

    await expect(applicationService.rejectApplication(100, 7, 'not eligible')).rejects.toMatchObject({
      status: 403,
      code: 'NOT_ORGANIZER',
    });
    expect(mockedApplicationRepo.rejectApplicationInDb).not.toHaveBeenCalled();
  });

  it('throws ALREADY_DECIDED when the application is no longer pending', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(
      makeApplicationDetail({
        tournament_requested_by_user_id: 7,
        tournament_status: 'public',
        tournament_application_status: 'rejected',
      }),
    );

    await expect(applicationService.rejectApplication(100, 7, 'not eligible')).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_DECIDED',
    });
  });

  it('rejects a pending application with the given reason', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(
      makeApplicationDetail({
        tournament_requested_by_user_id: 7,
        tournament_status: 'public',
        tournament_application_status: 'pending',
      }),
    );

    const result = await applicationService.rejectApplication(100, 7, 'not eligible');

    expect(mockedApplicationRepo.rejectApplicationInDb).toHaveBeenCalledWith(100, 'not eligible');
    expect(result).toEqual({ id: 100, status: 'rejected', reason: 'not eligible' });
  });
});

describe('applyTournament', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fixed "today" so calculateAge() is deterministic across every test below.
    vi.setSystemTime(new Date('2026-06-15T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws TEAM_NOT_FOUND when the team does not exist', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(null);

    await expect(applicationService.applyTournament(20, 10, 5)).rejects.toMatchObject({
      status: 404,
      code: 'TEAM_NOT_FOUND',
    });
    expect(mockedTournamentRepo.findTournamentById).not.toHaveBeenCalled();
  });

  it('throws NOT_TEAM_LEADER when the requester is not the team leader', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 999 }));

    await expect(applicationService.applyTournament(20, 10, 5)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_TEAM_LEADER',
    });
  });

  it('throws TEAM_NOT_READY when the team is not in Ready status', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(
      makeTeamForApply({ leader_id: 5, readiness_status: 'Forming' }),
    );

    await expect(applicationService.applyTournament(20, 10, 5)).rejects.toMatchObject({
      status: 409,
      code: 'TEAM_NOT_READY',
    });
  });

  it('throws TOURNAMENT_NOT_FOUND when the tournament does not exist', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(null);

    await expect(applicationService.applyTournament(20, 10, 5)).rejects.toMatchObject({
      status: 404,
      code: 'TOURNAMENT_NOT_FOUND',
    });
  });

  it('throws REGISTRATION_CLOSED when the tournament is not accepting registrations', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament({ registration_open: 0 }));

    await expect(applicationService.applyTournament(20, 10, 5)).rejects.toMatchObject({
      status: 409,
      code: 'REGISTRATION_CLOSED',
    });
  });

  it('throws ALREADY_APPLIED when the team already has an application for this tournament', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament());
    mockedApplicationRepo.findExistingApplication.mockResolvedValue({ tournament_application_id: 999 });

    await expect(applicationService.applyTournament(20, 10, 5)).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_APPLIED',
    });
    expect(mockedApplicationRepo.findTeamMembersForFilter).not.toHaveBeenCalled();
  });

  it('throws HARD_FILTER_FAILED with reason "gender" for a member of the wrong gender', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(
      makeTournament({ gender_requirement: 'male' }),
    );
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue([
      makeMember({ user_id: 1, full_name: 'Alice', gender: 'female' }),
    ]);
    mockedApplicationRepo.findEligibilityRules.mockResolvedValue([]);

    const err: any = await applicationService.applyTournament(20, 10, 5).catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(422);
    expect(err.code).toBe('HARD_FILTER_FAILED');
    expect(err.extra?.details).toEqual([{ userId: 1, fullName: 'Alice', reason: 'gender' }]);
    expect(mockedApplicationRepo.insertApplication).not.toHaveBeenCalled();
  });

  it('throws HARD_FILTER_FAILED with reason "age" for a member younger than the minimum age', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament({ min_age: 18 }));
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue([
      // Birthday (Jul 1) hasn't happened yet relative to "today" (Jun 15,
      // 2026), so this member is 15, not 16.
      makeMember({ user_id: 2, full_name: 'Young Person', birth_date: '2010-07-01' }),
    ]);
    mockedApplicationRepo.findEligibilityRules.mockResolvedValue([]);

    const err: any = await applicationService.applyTournament(20, 10, 5).catch((e) => e);

    expect(err.code).toBe('HARD_FILTER_FAILED');
    expect(err.extra?.details).toEqual([{ userId: 2, fullName: 'Young Person', reason: 'age' }]);
  });

  it('throws HARD_FILTER_FAILED with reason "age" for a member older than the maximum age', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament({ max_age: 30 }));
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue([
      makeMember({ user_id: 3, full_name: 'Older Person', birth_date: '1990-01-01' }),
    ]);
    mockedApplicationRepo.findEligibilityRules.mockResolvedValue([]);

    const err: any = await applicationService.applyTournament(20, 10, 5).catch((e) => e);

    expect(err.code).toBe('HARD_FILTER_FAILED');
    expect(err.extra?.details).toEqual([{ userId: 3, fullName: 'Older Person', reason: 'age' }]);
  });

  it('throws HARD_FILTER_FAILED with reason "year" when a member\'s year is not in the allowed list', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament());
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue([
      makeMember({ user_id: 4, full_name: 'Wrong Year', year: 1 }),
    ]);
    mockedApplicationRepo.findEligibilityRules.mockResolvedValue([
      makeRule({ rule_type: 'year', rule_value: 3 }),
      makeRule({ rule_type: 'year', rule_value: 4 }),
    ]);

    const err: any = await applicationService.applyTournament(20, 10, 5).catch((e) => e);

    expect(err.code).toBe('HARD_FILTER_FAILED');
    expect(err.extra?.details).toEqual([{ userId: 4, fullName: 'Wrong Year', reason: 'year' }]);
  });

  it('throws HARD_FILTER_FAILED with reason "year" when a member has no year on file and a year rule exists', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament());
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue([
      makeMember({ user_id: 6, full_name: 'No Year', year: null }),
    ]);
    mockedApplicationRepo.findEligibilityRules.mockResolvedValue([
      makeRule({ rule_type: 'year', rule_value: 3 }),
    ]);

    const err: any = await applicationService.applyTournament(20, 10, 5).catch((e) => e);

    expect(err.code).toBe('HARD_FILTER_FAILED');
    expect(err.extra?.details).toEqual([{ userId: 6, fullName: 'No Year', reason: 'year' }]);
  });

  it('throws HARD_FILTER_FAILED with reason "faculty" when a member\'s faculty is not in the allowed list', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament());
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue([
      makeMember({ user_id: 5, full_name: 'Wrong Faculty', faculty_id: 9 }),
    ]);
    mockedApplicationRepo.findEligibilityRules.mockResolvedValue([
      makeRule({ rule_type: 'faculty', rule_value: 1 }),
      makeRule({ rule_type: 'faculty', rule_value: 2 }),
    ]);

    const err: any = await applicationService.applyTournament(20, 10, 5).catch((e) => e);

    expect(err.code).toBe('HARD_FILTER_FAILED');
    expect(err.extra?.details).toEqual([{ userId: 5, fullName: 'Wrong Faculty', reason: 'faculty' }]);
  });

  it('collects a failure for every member that fails, not just the first', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(
      makeTournament({ gender_requirement: 'male', min_age: 18 }),
    );
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue([
      makeMember({ user_id: 1, full_name: 'Alice', gender: 'female' }),
      makeMember({ user_id: 2, full_name: 'Young Person', birth_date: '2010-07-01' }),
      makeMember({ user_id: 3, full_name: 'Valid Member' }),
    ]);
    mockedApplicationRepo.findEligibilityRules.mockResolvedValue([]);

    const err: any = await applicationService.applyTournament(20, 10, 5).catch((e) => e);

    expect(err.code).toBe('HARD_FILTER_FAILED');
    expect(err.extra?.details).toEqual([
      { userId: 1, fullName: 'Alice', reason: 'gender' },
      { userId: 2, fullName: 'Young Person', reason: 'age' },
    ]);
    expect(mockedApplicationRepo.insertApplication).not.toHaveBeenCalled();
  });

  it('creates the application when every member passes the hard filter', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament());
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    const members = [
      makeMember({ user_id: 1, full_name: 'Alice' }),
      makeMember({ user_id: 2, full_name: 'Bob' }),
    ];
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue(members);
    mockedApplicationRepo.findEligibilityRules.mockResolvedValue([]);
    mockedApplicationRepo.insertApplication.mockResolvedValue(500);

    const result = await applicationService.applyTournament(20, 10, 5);

    expect(mockedApplicationRepo.insertApplication).toHaveBeenCalledWith(
      20,
      10,
      expect.objectContaining({
        checkedAt: expect.any(String),
        memberIds: [1, 2],
      }),
    );
    expect(result).toEqual({ id: 500, status: 'pending', hardFilterPassed: true });
  });

  it('skips the gender check entirely when the tournament has no gender requirement', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament({ gender_requirement: 'any' }));
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue([
      makeMember({ user_id: 1, gender: 'female' }),
    ]);
    mockedApplicationRepo.findEligibilityRules.mockResolvedValue([]);
    mockedApplicationRepo.insertApplication.mockResolvedValue(500);

    await expect(applicationService.applyTournament(20, 10, 5)).resolves.toMatchObject({
      hardFilterPassed: true,
    });
  });
});
