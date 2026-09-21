import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/notification.service.js', () => ({
  notify: vi.fn(),
  notifyUsers: vi.fn(),
  notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTournamentReferees: vi.fn(),
  notifyMatchResultParties: vi.fn(),
}));

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
  findRefereesAmongUsers: vi.fn(() => Promise.resolve([])),
  findEligibilityRules: vi.fn(),
  insertApplication: vi.fn(),
  insertApplicationWithPlayers: vi.fn(),
  findPlayerConflicts: vi.fn(() => Promise.resolve([])),
  findPlayersByApplication: vi.fn(() => Promise.resolve([])),
  deletePlayersByApplication: vi.fn(),
}));

vi.mock('../../repositories/sportType.repo.js', () => ({
  findSportTypeById: vi.fn(),
}));

vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(),
}));

vi.mock('../../repositories/match.repo.js', () => ({
  countMatchesByTournament: vi.fn(),
}));

vi.mock('../../services/upload.service.js', () => ({
  getPresignedDownloadUrl: vi.fn(),
}));

vi.mock('../../repositories/walkover.repo.js', () => ({
  hasInProgressMatch: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('../../services/walkover.service.js', () => ({
  processTeamWithdrawal: vi.fn(() => Promise.resolve([])),
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
import * as SportTypeRepo from '../../repositories/sportType.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as UploadService from '../../services/upload.service.js';
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
import * as WalkoverRepo from '../../repositories/walkover.repo.js';
import * as Walkover from '../../services/walkover.service.js';
import * as NotificationService from '../../services/notification.service.js';

const mockedApplicationRepo = vi.mocked(ApplicationRepo);
const mockedTournamentRepo = vi.mocked(TournamentRepo);
const mockedSportTypeRepo = vi.mocked(SportTypeRepo);
const mockedMatchRepo = vi.mocked(MatchRepo);
const mockedUploadService = vi.mocked(UploadService);
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
  return { team_id: 10, leader_id: 5, sport_type_id: 1, readiness_status: 'Ready', ...overrides };
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
    sport_type_id: 1,
    tournament_status: 'public',
    registration_open: 1,
    registration_start: null,
    registration_end: '2026-09-20',   // อายุคำนวณ ณ วันปิดรับสมัคร (ADR-0011) — null ทำให้ TOURNAMENT_CONFIGURATION_INVALID
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
  it('returns every application led by the user, mapped to a DTO, with pagination', async () => {
    const rows = [
      makeLeaderApplication({ tournament_application_id: 1 }),
      makeLeaderApplication({ tournament_application_id: 2 }),
    ];
    mockedApplicationRepo.findApplicationsByLeader.mockResolvedValue({ rows, totalItems: 2 });
    mockedToMyApplicationDto
      .mockReturnValueOnce({ id: 1 } as any)
      .mockReturnValueOnce({ id: 2 } as any);

    const result = await applicationService.getMyappication(5, 1, 20, 0);

    expect(mockedApplicationRepo.findApplicationsByLeader).toHaveBeenCalledWith(5, 0, 20);
    expect(mockedToMyApplicationDto.mock.calls[0]?.[0]).toEqual(rows[0]);
    expect(result).toEqual({
      items: [{ id: 1 }, { id: 2 }],
      pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
    });
  });

  it('returns an empty items array when the user leads no applications', async () => {
    mockedApplicationRepo.findApplicationsByLeader.mockResolvedValue({ rows: [], totalItems: 0 });

    const result = await applicationService.getMyappication(5, 1, 20, 0);

    expect(result).toEqual({
      items: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
  });
});

describe('getTournamentApplications', () => {
  it('returns every application for the tournament mapped to a DTO, with pagination', async () => {
    const rows = [makeOrganizerApplication({ tournament_application_id: 1 })];
    mockedApplicationRepo.findApplicationsByTournament.mockResolvedValue({ rows, totalItems: 1 });
    mockedToOrganizerApplicationDto.mockReturnValue({ id: 1 } as any);

    const result = await applicationService.getTournamentApplications(20, 1, 20, 0);

    expect(mockedApplicationRepo.findApplicationsByTournament).toHaveBeenCalledWith(20, 0, 20);
    // .map(toOrganizerApplicationDto) invokes the callback as (item, index,
    // array), so only assert on the first argument the call actually cares about.
    expect(mockedToOrganizerApplicationDto.mock.calls[0]?.[0]).toEqual(rows[0]);
    expect(result).toEqual({
      items: [{ id: 1 }],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    });
  });

  it('returns an empty items array when the tournament has no applications', async () => {
    mockedApplicationRepo.findApplicationsByTournament.mockResolvedValue({ rows: [], totalItems: 0 });

    const result = await applicationService.getTournamentApplications(20, 1, 20, 0);

    expect(result).toEqual({
      items: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
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

  it('returns the detail DTO when the requester is the team leader (no soft filter documents)', async () => {
    const app = makeApplicationDetail({ team_leader_id: 5, tournament_requested_by_user_id: 999 });
    mockedApplicationRepo.findApplicationById.mockResolvedValue(app);
    mockedToApplicationDetailDto.mockReturnValue({ id: 100 } as any);

    const result = await applicationService.getApplicationDetail(100, 5);

    expect(mockedToApplicationDetailDto).toHaveBeenCalledWith(app, [], []);
    expect(mockedUploadService.getPresignedDownloadUrl).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 100 });
  });

  it('presigns every soft filter document S3 key before mapping (P04 must return URLs, not raw keys)', async () => {
    const app = makeApplicationDetail({
      team_leader_id: 5,
      tournament_requested_by_user_id: 999,
      soft_filter_documents: ['docs/student-card.jpg', 'docs/national-id.jpg'],
    });
    mockedApplicationRepo.findApplicationById.mockResolvedValue(app);
    mockedUploadService.getPresignedDownloadUrl
      .mockResolvedValueOnce('https://s3.example.com/student-card.jpg?sig=1')
      .mockResolvedValueOnce('https://s3.example.com/national-id.jpg?sig=2');
    mockedToApplicationDetailDto.mockReturnValue({ id: 100 } as any);

    await applicationService.getApplicationDetail(100, 5);

    expect(mockedUploadService.getPresignedDownloadUrl).toHaveBeenCalledWith('docs/student-card.jpg');
    expect(mockedUploadService.getPresignedDownloadUrl).toHaveBeenCalledWith('docs/national-id.jpg');
    expect(mockedToApplicationDetailDto).toHaveBeenCalledWith(app, [
      'https://s3.example.com/student-card.jpg?sig=1',
      'https://s3.example.com/national-id.jpg?sig=2',
    ], []);
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
    // ใบสมัครตาย → ปลดล็อกผู้เล่นให้ไปทีมอื่นในทัวร์เดียวกันได้ (มติ 19 ก.ย. 2569)
    expect(mockedApplicationRepo.deletePlayersByApplication).toHaveBeenCalledWith(100);
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

  it('withdraws an approved application owned by the team leader (no bracket yet)', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(
      makeApplicationDetail({ team_leader_id: 5, tournament_application_status: 'approved' }),
    );
    mockedMatchRepo.countMatchesByTournament.mockResolvedValue(0);

    const result = await applicationService.withdrawApplication(100, 5);

    expect(mockedApplicationRepo.updateApplicationStatus).toHaveBeenCalledWith(100, 'withdrawn');
    expect(mockedApplicationRepo.deletePlayersByApplication).toHaveBeenCalledWith(100);
    expect(mockedMatchRepo.countMatchesByTournament).toHaveBeenCalledWith(20);
    expect(result).toEqual({ id: 100, status: 'withdrawn', bracketExists: false, walkovers: [] });
    // C1-ข — แจ้งผู้จัดว่ามีทีมถอนตัว
    expect(NotificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7, type: 'application_withdrawn', relatedEntityId: 20,
    }));
    expect(Walkover.processTeamWithdrawal).not.toHaveBeenCalled();
  });

  it('reports bracketExists: true when the tournament already has matches', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(
      makeApplicationDetail({ team_leader_id: 5, tournament_application_status: 'approved' }),
    );
    mockedMatchRepo.countMatchesByTournament.mockResolvedValue(8);
    vi.mocked(Walkover.processTeamWithdrawal).mockResolvedValue([{ matchId: 3, winnerTeamId: 11, loserTeamId: 10 }]);

    const result = await applicationService.withdrawApplication(100, 5);

    // มีสายแล้ว → แมตช์ที่ยังไม่เริ่มของทีมนี้ อีกฝั่งชนะบาย (GUIDE/11 §10.4)
    expect(Walkover.processTeamWithdrawal).toHaveBeenCalledWith(20, 10, 5);
    expect(result).toEqual({ id: 100, status: 'withdrawn', bracketExists: true, walkovers: [{ matchId: 3, winnerTeamId: 11, loserTeamId: 10 }] });
  });

  it('refuses to withdraw while the team has a match in progress (MATCH_IN_PROGRESS)', async () => {
    mockedApplicationRepo.findApplicationById.mockResolvedValue(
      makeApplicationDetail({ team_leader_id: 5, tournament_application_status: 'approved' }),
    );
    vi.mocked(WalkoverRepo.hasInProgressMatch).mockResolvedValueOnce(true);

    await expect(applicationService.withdrawApplication(100, 5)).rejects.toMatchObject({ status: 409, code: 'MATCH_IN_PROGRESS' });
    expect(mockedApplicationRepo.updateApplicationStatus).not.toHaveBeenCalled();
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
    // C1-ข — แจ้งหัวหน้าทีมว่าผ่านแล้ว
    expect(NotificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: 5, type: 'application_decided', relatedEntityType: 'tournament', relatedEntityId: 20,
    }));
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
    expect(mockedApplicationRepo.deletePlayersByApplication).toHaveBeenCalledWith(100);
    // C1-ข — แจ้งหัวหน้าทีมพร้อมเหตุผล
    expect(NotificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: 5, type: 'application_decided', message: expect.stringContaining('not eligible'),
    }));
    expect(result).toEqual({ id: 100, status: 'rejected', reason: 'not eligible' });
  });
});

describe('applyTournament', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fixed "today" so calculateAge() is deterministic across every test below.
    vi.setSystemTime(new Date('2026-06-15T00:00:00.000Z'));
    // กีฬาเริ่มต้นของเทสต์กลุ่มนี้: 1–20 คน — เทสต์ที่สนใจขนาดทีมจะ override เอง
    mockedSportTypeRepo.findSportTypeById.mockResolvedValue({ min_members: 1, max_members: 20 } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws TEAM_NOT_FOUND when the team does not exist', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(null);

    await expect(applicationService.applyTournament(20, 10, 5, [1])).rejects.toMatchObject({
      status: 404,
      code: 'TEAM_NOT_FOUND',
    });
    expect(mockedTournamentRepo.findTournamentById).not.toHaveBeenCalled();
  });

  it('throws NOT_TEAM_LEADER when the requester is not the team leader', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 999 }));

    await expect(applicationService.applyTournament(20, 10, 5, [1])).rejects.toMatchObject({
      status: 403,
      code: 'NOT_TEAM_LEADER',
    });
  });

  it('throws TEAM_NOT_READY when the team is not in Ready status', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(
      makeTeamForApply({ leader_id: 5, readiness_status: 'Forming' }),
    );

    await expect(applicationService.applyTournament(20, 10, 5, [1])).rejects.toMatchObject({
      status: 409,
      code: 'TEAM_NOT_READY',
    });
  });

  it('throws TOURNAMENT_NOT_FOUND when the tournament does not exist', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(null);

    await expect(applicationService.applyTournament(20, 10, 5, [1])).rejects.toMatchObject({
      status: 404,
      code: 'TOURNAMENT_NOT_FOUND',
    });
  });

  it('throws REGISTRATION_CLOSED when the tournament is not accepting registrations', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament({ registration_open: 0 }));

    await expect(applicationService.applyTournament(20, 10, 5, [1])).rejects.toMatchObject({
      status: 409,
      code: 'REGISTRATION_CLOSED',
    });
  });

  // ข้อ 6 — ทีมคนละกีฬากับทัวร์
  it('throws SPORT_TYPE_MISMATCH when the team plays a different sport than the tournament', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5, sport_type_id: 3 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament({ sport_type_id: 1 }));

    await expect(applicationService.applyTournament(20, 10, 5, [1])).rejects.toMatchObject({ status: 409, code: 'SPORT_TYPE_MISMATCH' });
    expect(mockedApplicationRepo.insertApplication).not.toHaveBeenCalled();
  });

  // ข้อ 7 — สมาชิกทีมเป็น ORG หรือกรรมการของทัวร์นี้
  it('throws TEAM_CONFLICT_OF_INTEREST when a member is the organizer or a referee of this tournament', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament({ requested_by_user_id: 77 }));
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue([
      makeMember({ user_id: 5 }), makeMember({ user_id: 77 }), makeMember({ user_id: 88 }),
    ] as never);
    vi.mocked(mockedApplicationRepo.findRefereesAmongUsers).mockResolvedValueOnce([88]);   // Once — clearAllMocks ไม่ล้าง mockResolvedValue

    const err = await applicationService.applyTournament(20, 10, 5, [5, 77, 88]).catch((e: unknown) => e as { code: string; extra: unknown });
    expect(err).toMatchObject({ status: 409, code: 'TEAM_CONFLICT_OF_INTEREST' });
    expect(err.extra).toEqual({ conflicts: [{ userId: 77, role: 'organizer' }, { userId: 88, role: 'referee' }] });
    expect(mockedApplicationRepo.insertApplication).not.toHaveBeenCalled();
  });

  // Part2 P01 "อยู่ในช่วงรับสมัคร" — ธงเปิดอยู่แต่วันที่ไม่ตรง ก็สมัครไม่ได้
  it('throws REGISTRATION_CLOSED when the registration window has already ended even if the flag is still open', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament({
      registration_open: 1, registration_start: new Date('2026-05-01'), registration_end: new Date('2026-06-01'),   // ระบบเวลา = 2026-06-15
    }));

    const err = await applicationService.applyTournament(20, 10, 5, [5, 77, 88]).catch((e: unknown) => e as { code: string; message: string });
    expect(err).toMatchObject({ status: 409, code: 'REGISTRATION_CLOSED' });
    expect(err.message).toBe('หมดช่วงรับสมัครแล้ว');
    expect(mockedApplicationRepo.insertApplication).not.toHaveBeenCalled();
  });

  it('throws REGISTRATION_CLOSED when the registration window has not started yet', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament({
      registration_open: 1, registration_start: new Date('2099-01-01'), registration_end: new Date('2099-02-01'),
    }));

    const err = await applicationService.applyTournament(20, 10, 5, [1]).catch((e: unknown) => e as { code: string; message: string });
    expect(err).toMatchObject({ status: 409, code: 'REGISTRATION_CLOSED' });
    expect(err.message).toBe('ยังไม่ถึงช่วงรับสมัคร');
  });

  it('throws ALREADY_APPLIED when the team already has an application for this tournament', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament());
    mockedApplicationRepo.findExistingApplication.mockResolvedValue({ tournament_application_id: 999 });

    await expect(applicationService.applyTournament(20, 10, 5, [1])).rejects.toMatchObject({
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

    const err: any = await applicationService.applyTournament(20, 10, 5, [1]).catch((e) => e);

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

    const err: any = await applicationService.applyTournament(20, 10, 5, [2]).catch((e) => e);

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

    const err: any = await applicationService.applyTournament(20, 10, 5, [3]).catch((e) => e);

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

    const err: any = await applicationService.applyTournament(20, 10, 5, [4]).catch((e) => e);

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

    const err: any = await applicationService.applyTournament(20, 10, 5, [6]).catch((e) => e);

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

    const err: any = await applicationService.applyTournament(20, 10, 5, [5]).catch((e) => e);

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

    const err: any = await applicationService.applyTournament(20, 10, 5, [1, 2, 3]).catch((e) => e);

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
    mockedApplicationRepo.insertApplicationWithPlayers.mockResolvedValue(500);

    const result = await applicationService.applyTournament(20, 10, 5, [1, 2]);

    expect(mockedApplicationRepo.insertApplicationWithPlayers).toHaveBeenCalledWith(
      20,
      10,
      [
        { userId: 1, fullName: 'Alice', passed: true },
        { userId: 2, fullName: 'Bob', passed: true },
      ],
      [1, 2],
    );
    expect(result).toEqual({ id: 500, status: 'pending', hardFilterPassed: true, playerIds: [1, 2] });
  });

  // รายชื่อที่ส่งลงแข่ง (มติ 19 ก.ย. 2569)
  it('throws SQUAD_SIZE_INVALID when the squad is smaller than the sport minimum', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament());
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue([makeMember({ user_id: 1 }), makeMember({ user_id: 2 })]);
    mockedSportTypeRepo.findSportTypeById.mockResolvedValue({ min_members: 5, max_members: 7 } as never);

    const err: any = await applicationService.applyTournament(20, 10, 5, [1, 2]).catch((e) => e);

    expect(err).toMatchObject({ status: 422, code: 'SQUAD_SIZE_INVALID' });
    expect(err.extra).toEqual({ minMembers: 5, maxMembers: 7, submitted: 2 });
    expect(mockedApplicationRepo.insertApplicationWithPlayers).not.toHaveBeenCalled();
  });

  it('throws SQUAD_SIZE_INVALID when the squad is larger than the sport maximum', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament());
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue([makeMember({ user_id: 1 })]);
    mockedSportTypeRepo.findSportTypeById.mockResolvedValue({ min_members: 1, max_members: 2 } as never);

    await expect(applicationService.applyTournament(20, 10, 5, [1, 2, 3])).rejects.toMatchObject({
      status: 422, code: 'SQUAD_SIZE_INVALID',
    });
  });

  it('throws PLAYER_NOT_IN_TEAM when a submitted player is not a member of the team', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament());
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue([makeMember({ user_id: 1 })]);

    const err: any = await applicationService.applyTournament(20, 10, 5, [1, 99]).catch((e) => e);

    expect(err).toMatchObject({ status: 422, code: 'PLAYER_NOT_IN_TEAM' });
    expect(err.extra).toEqual({ userIds: [99] });
    expect(mockedApplicationRepo.insertApplicationWithPlayers).not.toHaveBeenCalled();
  });

  it('checks the hard filter only for the submitted players, not the whole team', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament({ gender_requirement: 'male' }));
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue([
      makeMember({ user_id: 1, full_name: 'Alice', gender: 'female' }),   // อยู่ในทีมแต่ไม่ได้ลงแข่ง
      makeMember({ user_id: 2, full_name: 'Bob' }),
    ]);
    mockedApplicationRepo.findEligibilityRules.mockResolvedValue([]);
    mockedApplicationRepo.insertApplicationWithPlayers.mockResolvedValue(501);

    await expect(applicationService.applyTournament(20, 10, 5, [2])).resolves.toMatchObject({ id: 501 });
  });

  it('throws PLAYER_ALREADY_REGISTERED when a player is already registered with another team', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament());
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue([makeMember({ user_id: 1, full_name: 'Alice' })]);
    mockedApplicationRepo.findEligibilityRules.mockResolvedValue([]);
    mockedApplicationRepo.insertApplicationWithPlayers.mockResolvedValue(null);   // ชน uq_tournament_player
    mockedApplicationRepo.findPlayerConflicts.mockResolvedValue([
      { user_id: 1, full_name: 'Alice', team_id: 11, team_name: 'Other Team' },
    ]);

    const err: any = await applicationService.applyTournament(20, 10, 5, [1]).catch((e) => e);

    expect(err).toMatchObject({ status: 409, code: 'PLAYER_ALREADY_REGISTERED' });
    expect(err.extra).toEqual({ players: [{ userId: 1, fullName: 'Alice', teamId: 11, teamName: 'Other Team' }] });
  });

  it('skips the gender check entirely when the tournament has no gender requirement', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue(makeTeamForApply({ leader_id: 5 }));
    mockedTournamentRepo.findTournamentById.mockResolvedValue(makeTournament({ gender_requirement: 'any' }));
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue([
      makeMember({ user_id: 1, gender: 'female' }),
    ]);
    mockedApplicationRepo.findEligibilityRules.mockResolvedValue([]);
    mockedApplicationRepo.insertApplicationWithPlayers.mockResolvedValue(500);

    await expect(applicationService.applyTournament(20, 10, 5, [1])).resolves.toMatchObject({
      hardFilterPassed: true,
    });
  });
});
