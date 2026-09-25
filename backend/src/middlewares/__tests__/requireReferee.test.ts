import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../utils/parseId.js', () => ({
  parseId: vi.fn(),
}));

vi.mock('../../utils/checkExist.js', () => ({
  checkMatch: vi.fn(),
  checkMatchResult: vi.fn(),
}));

vi.mock('../../services/referee.service.js', () => ({
  isActiveReferee: vi.fn(),
  refereesNeededPerMatch: vi.fn(),
}));

vi.mock('../../repositories/tournamentReferee.repo.js', () => ({
  findLatestByTournamentAndUser: vi.fn(),
}));

vi.mock('../../repositories/matchReferee.repo.js', () => ({
  findByMatch: vi.fn(),
  countAcceptedByMatch: vi.fn(),
}));

vi.mock('../../repositories/match.repo.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../repositories/team.repo.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(),
}));

vi.mock('../../repositories/matchResult.repo.js', () => ({
  findmatchResultByMatchId: vi.fn(),
}));

import {
  isRefereeOfMatch,
  isTeamLeaderOfMatch,
  isLeaderOfTeam,
  isDisputeWindow,
  isRefereeSufficient,
  requireCanSubmitResult,
  requireCanVerifyResult,
  requireCanDisputeResult,
  requireCanRecordStats,
  requireReferee,
} from '../requireReferee.js';
import { parseId } from '../../utils/parseId.js';
import { checkMatch, checkMatchResult } from '../../utils/checkExist.js';
import { isActiveReferee, refereesNeededPerMatch } from '../../services/referee.service.js';
import { findLatestByTournamentAndUser } from '../../repositories/tournamentReferee.repo.js';
import * as MatchRefereeRepo from '../../repositories/matchReferee.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import { findTournamentById } from '../../repositories/tournament.repo.js';
import * as MatchResRepo from '../../repositories/matchResult.repo.js';
import { AppError } from '../../utils/AppError.js';
import type {
  UserRow,
  MatchRow,
  TournamentRow,
  TeamRow,
  MatchResultRow,
  TournamentRefereeRow,
} from '../../types/db.js';

const mockedParseId = vi.mocked(parseId);
const mockedCheckMatch = vi.mocked(checkMatch);
const mockedCheckMatchResult = vi.mocked(checkMatchResult);
const mockedIsActiveReferee = vi.mocked(isActiveReferee);
const mockedRefereesNeededPerMatch = vi.mocked(refereesNeededPerMatch);
const mockedFindLatestByTournamentAndUser = vi.mocked(findLatestByTournamentAndUser);
const mockedFindByMatch = vi.mocked(MatchRefereeRepo.findByMatch);
const mockedCountAcceptedByMatch = vi.mocked(MatchRefereeRepo.countAcceptedByMatch);
const mockedMatchFindById = vi.mocked(MatchRepo.findById);
const mockedTeamFindById = vi.mocked(TeamRepo.findById);
const mockedFindTournamentById = vi.mocked(findTournamentById);
const mockedFindmatchResultByMatchId = vi.mocked(MatchResRepo.findmatchResultByMatchId);

function makeReq(params: Record<string, string>, user?: UserRow): Request {
  return { params, user } as unknown as Request;
}

function makeRes(): Response {
  return {} as Response;
}

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    user_id: 1,
    full_name: 'Test User',
    email: 'test@example.com',
    password_hash: 'hashed-password',
    gender: 'other',
    birth_date: '2000-01-01',
    user_type: 'student',
    faculty_id: null,
    department_id: null,
    year: null,
    profile_image_key: null,
    contact_info: null,
    address: null,
    is_suspended: 0,
    suspended_reason: null,
    total_points: 0,
    notification_prefs: null,
    profile_edit_log: null,
    created_at: new Date(),
    updated_at: null,
    ...overrides,
  };
}

const refereeUser = makeUser({ user_id: 5 });
const otherUser = makeUser({ user_id: 99 });

const baseTournament: TournamentRow = {
  tournament_id: 20,
  name: 'Inter-Faculty Championship',
  description: null,
  sport_type_id: 1,
  bracket_format: 'single_elimination',
  scope_type: 'university',
  organizing_faculty_id: null,
  organizing_department_id: null,
  requested_by_user_id: 9,
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
};

const baseMatch: MatchRow = {
  match_id: 30,
  tournament_id: 20,
  bracket_node_id: null,
  next_match_id: null,
  loser_next_match_id: null,
  round_number: 1,
  team_a_id: 10,
  team_b_id: 11,
  scheduled_time: null,
  scheduled_end_time: null,
  venue: null,
  checkin_open_at: null,
  match_status: 'scheduled',
  mode: 'onsite',
  livestream_url: null,
  created_at: new Date(),
  updated_at: null,
};

const teamA: TeamRow = {
  team_id: 10,
  name: 'Team A',
  sport_type_id: 1,
  leader_id: 100,
  readiness_status: 'Ready',
  official_status: 'Official',
  created_at: new Date(),
  updated_at: null,
  last_competed_at: null,
  deleted_at: null,
  deleted_reason: null,
};

const teamB: TeamRow = {
  ...teamA,
  team_id: 11,
  name: 'Team B',
  leader_id: 200,
};

const baseMatchResult: MatchResultRow = {
  match_result_id: 50,
  match_id: 30,
  winner_team_id: 10,
  score_data: { a: 2, b: 1 },
  submitted_by_user_id: 200,
  submitted_role: 'team_leader',
  match_result_status: 'submitted',
  dispute_reason: null,
  dispute_raised_by: null,
  dispute_raised_at: null,
  dispute_resolved_by: null,
  dispute_resolution: null,
  dispute_resolved_at: null,
  verified_by_user_id: null,
  verified_at: null,
  amended_by_user_id: null,
  amend_reason: null,
  amended_at: null,
  created_at: new Date(),
};

const baseTournamentReferee: TournamentRefereeRow = {
  tournament_referee_id: 60,
  tournament_id: 20,
  user_id: 5,
  invited_by: 9,
  invitation_status: 'accepted',
  is_external: 0,
  external_approval_status: 'not_required',
  external_verification_docs: null,
  approved_by: null,
  approved_at: null,
  external_rejection_reason: null,
  created_at: new Date(),
  removed_at: null,
  removed_by: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isRefereeOfMatch', () => {
  it('returns false without checking assignments when the referee is not active', async () => {
    mockedFindLatestByTournamentAndUser.mockResolvedValue(baseTournamentReferee);
    mockedIsActiveReferee.mockReturnValue(false);

    const result = await isRefereeOfMatch(30, 5, 20);

    expect(result).toBe(false);
    expect(mockedFindByMatch).not.toHaveBeenCalled();
  });

  it('returns true when active and assigned to the match', async () => {
    mockedFindLatestByTournamentAndUser.mockResolvedValue(baseTournamentReferee);
    mockedIsActiveReferee.mockReturnValue(true);
    mockedFindByMatch.mockResolvedValue([{ user_id: 5 } as any]);

    const result = await isRefereeOfMatch(30, 5, 20);

    expect(result).toBe(true);
    expect(mockedFindByMatch).toHaveBeenCalledWith(30);
  });

  it('returns false when active but not assigned to this match', async () => {
    mockedFindLatestByTournamentAndUser.mockResolvedValue(baseTournamentReferee);
    mockedIsActiveReferee.mockReturnValue(true);
    mockedFindByMatch.mockResolvedValue([{ user_id: 999 } as any]);

    const result = await isRefereeOfMatch(30, 5, 20);

    expect(result).toBe(false);
  });
});

describe('isTeamLeaderOfMatch', () => {
  it('returns true when the caller leads team A', async () => {
    mockedCheckMatch.mockResolvedValue(baseMatch);
    mockedTeamFindById.mockImplementation(async (id: number) => (id === 10 ? teamA : teamB));

    const result = await isTeamLeaderOfMatch(30, 100);

    expect(result).toBe(true);
  });

  it('returns true when the caller leads team B', async () => {
    mockedCheckMatch.mockResolvedValue(baseMatch);
    mockedTeamFindById.mockImplementation(async (id: number) => (id === 10 ? teamA : teamB));

    const result = await isTeamLeaderOfMatch(30, 200);

    expect(result).toBe(true);
  });

  it('returns false when the caller leads neither team', async () => {
    mockedCheckMatch.mockResolvedValue(baseMatch);
    mockedTeamFindById.mockImplementation(async (id: number) => (id === 10 ? teamA : teamB));

    const result = await isTeamLeaderOfMatch(30, 999);

    expect(result).toBe(false);
  });

  it('returns false and skips lookups for null team slots', async () => {
    mockedCheckMatch.mockResolvedValue({ ...baseMatch, team_a_id: null, team_b_id: null });

    const result = await isTeamLeaderOfMatch(30, 100);

    expect(result).toBe(false);
    expect(mockedTeamFindById).not.toHaveBeenCalled();
  });

  it('propagates when checkMatch throws MATCH_NOT_FOUND', async () => {
    const notFound = new AppError(404, 'MATCH_NOT_FOUND', 'ไม่พบแมตช์นี้');
    mockedCheckMatch.mockRejectedValue(notFound);

    await expect(isTeamLeaderOfMatch(30, 100)).rejects.toBe(notFound);
  });
});

describe('isLeaderOfTeam', () => {
  it('returns true when the user leads the given team', async () => {
    mockedTeamFindById.mockResolvedValue(teamA);
    await expect(isLeaderOfTeam(10, 100)).resolves.toBe(true);
  });

  it('returns false when the user does not lead the given team', async () => {
    mockedTeamFindById.mockResolvedValue(teamA);
    await expect(isLeaderOfTeam(10, 999)).resolves.toBe(false);
  });

  it('throws if the team does not exist (non-null assertion on a null team)', async () => {
    mockedTeamFindById.mockResolvedValue(null);
    await expect(isLeaderOfTeam(10, 100)).rejects.toThrow();
  });
});

describe('isDisputeWindow', () => {
  it('is always open when the result has not been verified yet', async () => {
    const result = await isDisputeWindow(20, { ...baseMatchResult, verified_at: null });
    expect(result).toBe(true);
    expect(mockedFindTournamentById).not.toHaveBeenCalled();
  });

  it('is open while still inside dispute_window_hours', async () => {
    mockedFindTournamentById.mockResolvedValue({ ...baseTournament, dispute_window_hours: 24 });
    const verifiedAt = new Date(Date.now() - 1 * 3600 * 1000); // 1h ago, window is 24h
    const result = await isDisputeWindow(20, { ...baseMatchResult, verified_at: verifiedAt });
    expect(result).toBe(true);
  });

  it('is closed once past dispute_window_hours', async () => {
    mockedFindTournamentById.mockResolvedValue({ ...baseTournament, dispute_window_hours: 1 });
    const verifiedAt = new Date(Date.now() - 2 * 3600 * 1000); // 2h ago, window is 1h
    const result = await isDisputeWindow(20, { ...baseMatchResult, verified_at: verifiedAt });
    expect(result).toBe(false);
  });
});

describe('isRefereeSufficient', () => {
  it('returns false when the tournament cannot be found', async () => {
    mockedFindTournamentById.mockResolvedValue(null);
    const result = await isRefereeSufficient(baseMatch);
    expect(result).toBe(false);
    expect(mockedRefereesNeededPerMatch).not.toHaveBeenCalled();
  });

  it('returns false when accepted referees are below what the mode needs', async () => {
    mockedFindTournamentById.mockResolvedValue(baseTournament);
    mockedRefereesNeededPerMatch.mockResolvedValue((mode) => (mode === 'onsite' ? 2 : 1));
    mockedCountAcceptedByMatch.mockResolvedValue(1);

    const result = await isRefereeSufficient({ ...baseMatch, mode: 'onsite' });

    expect(result).toBe(false);
  });

  it('returns true when accepted referees meet what the mode needs', async () => {
    mockedFindTournamentById.mockResolvedValue(baseTournament);
    mockedRefereesNeededPerMatch.mockResolvedValue((mode) => (mode === 'onsite' ? 2 : 1));
    mockedCountAcceptedByMatch.mockResolvedValue(2);

    const result = await isRefereeSufficient({ ...baseMatch, mode: 'onsite' });

    expect(result).toBe(true);
  });
});

describe('requireCanSubmitResult middleware', () => {
  it('calls next with NO_TOKEN when req.user is missing', async () => {
    const req = makeReq({ id: '30' }, undefined);
    const next = vi.fn() as NextFunction;

    await requireCanSubmitResult(req, makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(401);
    expect(err.code).toBe('NO_TOKEN');
    expect(mockedParseId).not.toHaveBeenCalled();
  });

  it('parses the id with the 3-arg field-aware signature', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue(baseMatch);
    mockedFindmatchResultByMatchId.mockResolvedValue(null);
    mockedFindLatestByTournamentAndUser.mockResolvedValue(baseTournamentReferee);
    mockedIsActiveReferee.mockReturnValue(true);
    mockedFindByMatch.mockResolvedValue([{ user_id: 5 } as any]);

    await requireCanSubmitResult(makeReq({ id: '30' }, refereeUser), makeRes(), vi.fn() as NextFunction);

    expect(mockedParseId).toHaveBeenCalledWith('30', 'รหัสการแข่งขัน', 'id');
  });

  it('calls next with MATCH_TEAMS_INCOMPLETE when a team slot is empty', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue({ ...baseMatch, team_b_id: null });
    const next = vi.fn() as NextFunction;

    await requireCanSubmitResult(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(409);
    expect(err.code).toBe('MATCH_TEAMS_INCOMPLETE');
    expect(mockedFindmatchResultByMatchId).not.toHaveBeenCalled();
  });

  it('calls next with MATCH_RESULT_ALREADY_VERIFIED when an existing result is not submitted/rejected', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue(baseMatch);
    mockedFindmatchResultByMatchId.mockResolvedValue({ ...baseMatchResult, match_result_status: 'verified' });
    const next = vi.fn() as NextFunction;

    await requireCanSubmitResult(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(409);
    expect(err.code).toBe('MATCH_RESULT_ALREADY_VERIFIED');
  });

  it.each(['submitted', 'rejected'] as const)(
    'allows resubmission when the existing result status is %s',
    async (status) => {
      mockedParseId.mockReturnValue(30);
      mockedCheckMatch.mockResolvedValue({ ...baseMatch, mode: 'onsite' });
      mockedFindmatchResultByMatchId.mockResolvedValue({ ...baseMatchResult, match_result_status: status });
      mockedFindLatestByTournamentAndUser.mockResolvedValue(baseTournamentReferee);
      mockedIsActiveReferee.mockReturnValue(true);
      mockedFindByMatch.mockResolvedValue([{ user_id: 5 } as any]);
      const next = vi.fn() as NextFunction;

      await requireCanSubmitResult(makeReq({ id: '30' }, refereeUser), makeRes(), next);

      expect(next).toHaveBeenCalledWith();
    },
  );

  it('onsite: calls next with WRONG_SUBMITTER_ROLE when the caller is not the assigned referee', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue({ ...baseMatch, mode: 'onsite' });
    mockedFindmatchResultByMatchId.mockResolvedValue(null);
    mockedFindLatestByTournamentAndUser.mockResolvedValue(baseTournamentReferee);
    mockedIsActiveReferee.mockReturnValue(false);
    const req = makeReq({ id: '30' }, refereeUser);
    const next = vi.fn() as NextFunction;

    await requireCanSubmitResult(req, makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('WRONG_SUBMITTER_ROLE');
    expect((req as any).submitrole).toBeUndefined();
  });

  it('onsite: sets req.submitrole to "referee" and calls next() on success', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue({ ...baseMatch, mode: 'onsite' });
    mockedFindmatchResultByMatchId.mockResolvedValue(null);
    mockedFindLatestByTournamentAndUser.mockResolvedValue(baseTournamentReferee);
    mockedIsActiveReferee.mockReturnValue(true);
    mockedFindByMatch.mockResolvedValue([{ user_id: 5 } as any]);
    const req = makeReq({ id: '30' }, refereeUser);
    const next = vi.fn() as NextFunction;

    await requireCanSubmitResult(req, makeRes(), next);

    expect((req as any).submitrole).toBe('referee');
    expect(next).toHaveBeenCalledWith();
  });

  it('online: calls next with WRONG_SUBMITTER_ROLE when the caller is not a team leader', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue({ ...baseMatch, mode: 'online' });
    mockedFindmatchResultByMatchId.mockResolvedValue(null);
    mockedTeamFindById.mockImplementation(async (id: number) => (id === 10 ? teamA : teamB));
    const next = vi.fn() as NextFunction;

    await requireCanSubmitResult(makeReq({ id: '30' }, otherUser), makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('WRONG_SUBMITTER_ROLE');
  });

  it('online: sets req.submitrole to "team_leader" and calls next() on success', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue({ ...baseMatch, mode: 'online' });
    mockedFindmatchResultByMatchId.mockResolvedValue(null);
    mockedTeamFindById.mockImplementation(async (id: number) => (id === 10 ? teamA : teamB));
    const req = makeReq({ id: '30' }, makeUser({ user_id: 100 }));
    const next = vi.fn() as NextFunction;

    await requireCanSubmitResult(req, makeRes(), next);

    expect((req as any).submitrole).toBe('team_leader');
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with the error (does not reject) when checkMatch throws MATCH_NOT_FOUND', async () => {
    mockedParseId.mockReturnValue(30);
    const notFound = new AppError(404, 'MATCH_NOT_FOUND', 'ไม่พบแมตช์นี้');
    mockedCheckMatch.mockRejectedValue(notFound);
    const next = vi.fn() as NextFunction;

    await requireCanSubmitResult(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    expect(next).toHaveBeenCalledWith(notFound);
  });
});

describe('requireCanVerifyResult middleware', () => {
  it('calls next with NO_TOKEN when req.user is missing', async () => {
    const next = vi.fn() as NextFunction;
    await requireCanVerifyResult(makeReq({ id: '30' }, undefined), makeRes(), next);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(401);
    expect(err.code).toBe('NO_TOKEN');
  });

  it('calls next with MATCH_RESULT_ALREADY_VERIFIED when the result is not "submitted"', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue(baseMatch);
    mockedCheckMatchResult.mockResolvedValue({ ...baseMatchResult, match_result_status: 'verified' });
    const next = vi.fn() as NextFunction;

    await requireCanVerifyResult(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(409);
    expect(err.code).toBe('MATCH_RESULT_ALREADY_VERIFIED');
  });

  it('calls next with SAME_PERSON_CANNOT_VERIFY when the verifier submitted the result', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue(baseMatch);
    mockedCheckMatchResult.mockResolvedValue({ ...baseMatchResult, submitted_by_user_id: 5 });
    const next = vi.fn() as NextFunction;

    await requireCanVerifyResult(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('SAME_PERSON_CANNOT_VERIFY');
  });

  it('online: WRONG_SUBMITTER_ROLE when the verifier is not the assigned referee', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue({ ...baseMatch, mode: 'online' });
    mockedCheckMatchResult.mockResolvedValue(baseMatchResult); // submitted_by_user_id: 200
    mockedFindLatestByTournamentAndUser.mockResolvedValue(baseTournamentReferee);
    mockedIsActiveReferee.mockReturnValue(false);
    const next = vi.fn() as NextFunction;

    await requireCanVerifyResult(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('WRONG_SUBMITTER_ROLE');
  });

  it('online: attaches req.match/req.matchResult and calls next() for the assigned referee', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue({ ...baseMatch, mode: 'online' });
    mockedCheckMatchResult.mockResolvedValue(baseMatchResult);
    mockedFindLatestByTournamentAndUser.mockResolvedValue(baseTournamentReferee);
    mockedIsActiveReferee.mockReturnValue(true);
    mockedFindByMatch.mockResolvedValue([{ user_id: 5 } as any]);
    const req = makeReq({ id: '30' }, refereeUser);
    const next = vi.fn() as NextFunction;

    await requireCanVerifyResult(req, makeRes(), next);

    expect((req as any).match).toEqual({ ...baseMatch, mode: 'online' });
    expect((req as any).matchResult).toEqual(baseMatchResult);
    expect(next).toHaveBeenCalledWith();
  });

  it('onsite: WRONG_SUBMITTER_ROLE when the verifier does not lead the winning team', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue({ ...baseMatch, mode: 'onsite' });
    mockedCheckMatchResult.mockResolvedValue({ ...baseMatchResult, winner_team_id: 10 }); // led by 100
    mockedTeamFindById.mockResolvedValue(teamA);
    const next = vi.fn() as NextFunction;

    await requireCanVerifyResult(makeReq({ id: '30' }, otherUser), makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('WRONG_SUBMITTER_ROLE');
  });

  it('onsite: attaches req.match/req.matchResult and calls next() for the winning team leader', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue({ ...baseMatch, mode: 'onsite' });
    mockedCheckMatchResult.mockResolvedValue({ ...baseMatchResult, winner_team_id: 10, submitted_by_user_id: 200 });
    mockedTeamFindById.mockResolvedValue(teamA); // leader_id 100
    const req = makeReq({ id: '30' }, makeUser({ user_id: 100 }));
    const next = vi.fn() as NextFunction;

    await requireCanVerifyResult(req, makeRes(), next);

    expect((req as any).match).toEqual({ ...baseMatch, mode: 'onsite' });
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with the error (does not reject) when checkMatchResult throws', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue(baseMatch);
    const notFound = new AppError(404, 'MATCH_RESULT_NOT_FOUND', 'ยังไม่มีผลการแข่งขันที่ส่งไว้สำหรับแมตช์นี้');
    mockedCheckMatchResult.mockRejectedValue(notFound);
    const next = vi.fn() as NextFunction;

    await requireCanVerifyResult(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    expect(next).toHaveBeenCalledWith(notFound);
  });
});

describe('requireCanDisputeResult middleware', () => {
  it('calls next with NO_TOKEN when req.user is missing', async () => {
    const next = vi.fn() as NextFunction;
    await requireCanDisputeResult(makeReq({ id: '30' }, undefined), makeRes(), next);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(401);
    expect(err.code).toBe('NO_TOKEN');
  });

  it('calls next with DISPUTE_ALREADY_ACTIVE when a dispute is already open', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue(baseMatch);
    mockedCheckMatchResult.mockResolvedValue({ ...baseMatchResult, match_result_status: 'disputed' });
    const next = vi.fn() as NextFunction;

    await requireCanDisputeResult(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(409);
    expect(err.code).toBe('DISPUTE_ALREADY_ACTIVE');
  });

  it('calls next with RESULT_IS_WALKOVER for a walkover result', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue(baseMatch);
    mockedCheckMatchResult.mockResolvedValue({ ...baseMatchResult, match_result_status: 'walkover' });
    const next = vi.fn() as NextFunction;

    await requireCanDisputeResult(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.code).toBe('RESULT_IS_WALKOVER');
  });

  it('calls next with RESULT_REJECTED for an already-rejected result', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue(baseMatch);
    mockedCheckMatchResult.mockResolvedValue({ ...baseMatchResult, match_result_status: 'rejected' });
    const next = vi.fn() as NextFunction;

    await requireCanDisputeResult(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.code).toBe('RESULT_REJECTED');
  });

  it('calls next with DISPUTE_WINDOW_CLOSED once past dispute_window_hours', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue(baseMatch);
    const verifiedAt = new Date(Date.now() - 2 * 3600 * 1000);
    mockedCheckMatchResult.mockResolvedValue({
      ...baseMatchResult,
      match_result_status: 'verified',
      verified_at: verifiedAt,
    });
    mockedFindTournamentById.mockResolvedValue({ ...baseTournament, dispute_window_hours: 1 });
    const next = vi.fn() as NextFunction;

    await requireCanDisputeResult(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(409);
    expect(err.code).toBe('DISPUTE_WINDOW_CLOSED');
  });

  it('calls next with WRONG_SUBMITTER_ROLE when the caller is neither the referee nor a team leader', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue(baseMatch);
    mockedCheckMatchResult.mockResolvedValue({ ...baseMatchResult, match_result_status: 'verified', verified_at: null });
    mockedFindLatestByTournamentAndUser.mockResolvedValue(null);
    mockedIsActiveReferee.mockReturnValue(false);
    mockedTeamFindById.mockImplementation(async (id: number) => (id === 10 ? teamA : teamB));
    const next = vi.fn() as NextFunction;

    await requireCanDisputeResult(makeReq({ id: '30' }, otherUser), makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('WRONG_SUBMITTER_ROLE');
  });

  it('calls next() for the assigned referee within the dispute window', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue(baseMatch);
    mockedCheckMatchResult.mockResolvedValue({ ...baseMatchResult, match_result_status: 'verified', verified_at: null });
    mockedFindLatestByTournamentAndUser.mockResolvedValue(baseTournamentReferee);
    mockedIsActiveReferee.mockReturnValue(true);
    mockedFindByMatch.mockResolvedValue([{ user_id: 5 } as any]);
    const next = vi.fn() as NextFunction;

    await requireCanDisputeResult(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next() for a team leader involved in the match', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue(baseMatch);
    mockedCheckMatchResult.mockResolvedValue({ ...baseMatchResult, match_result_status: 'verified', verified_at: null });
    mockedFindLatestByTournamentAndUser.mockResolvedValue(null);
    mockedIsActiveReferee.mockReturnValue(false);
    mockedTeamFindById.mockImplementation(async (id: number) => (id === 10 ? teamA : teamB));
    const next = vi.fn() as NextFunction;

    await requireCanDisputeResult(makeReq({ id: '30' }, makeUser({ user_id: 100 })), makeRes(), next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireCanRecordStats middleware', () => {
  it('calls next with NO_TOKEN when req.user is missing', async () => {
    const next = vi.fn() as NextFunction;
    await requireCanRecordStats(makeReq({ id: '30' }, undefined), makeRes(), next);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(401);
    expect(err.code).toBe('NO_TOKEN');
  });

  it('onsite: calls next with INSUFFICIENT_REFEREES when accepted referees are below what is needed', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue({ ...baseMatch, mode: 'onsite' });
    mockedFindTournamentById.mockResolvedValue(baseTournament);
    mockedRefereesNeededPerMatch.mockResolvedValue((mode) => (mode === 'onsite' ? 2 : 1));
    mockedCountAcceptedByMatch.mockResolvedValue(1);
    const next = vi.fn() as NextFunction;

    await requireCanRecordStats(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(409);
    expect(err.code).toBe('INSUFFICIENT_REFEREES');
  });

  it('onsite: calls next with WRONG_SUBMITTER_ROLE when referees are sufficient but caller is not one', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue({ ...baseMatch, mode: 'onsite' });
    mockedFindTournamentById.mockResolvedValue(baseTournament);
    mockedRefereesNeededPerMatch.mockResolvedValue((mode) => (mode === 'onsite' ? 2 : 1));
    mockedCountAcceptedByMatch.mockResolvedValue(2);
    mockedFindLatestByTournamentAndUser.mockResolvedValue(baseTournamentReferee);
    mockedIsActiveReferee.mockReturnValue(false);
    const next = vi.fn() as NextFunction;

    await requireCanRecordStats(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('WRONG_SUBMITTER_ROLE');
  });

  it('onsite: calls next() when referees are sufficient and caller is the assigned referee', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue({ ...baseMatch, mode: 'onsite' });
    mockedFindTournamentById.mockResolvedValue(baseTournament);
    mockedRefereesNeededPerMatch.mockResolvedValue((mode) => (mode === 'onsite' ? 2 : 1));
    mockedCountAcceptedByMatch.mockResolvedValue(2);
    mockedFindLatestByTournamentAndUser.mockResolvedValue(baseTournamentReferee);
    mockedIsActiveReferee.mockReturnValue(true);
    mockedFindByMatch.mockResolvedValue([{ user_id: 5 } as any]);
    const next = vi.fn() as NextFunction;

    await requireCanRecordStats(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('online: skips the referee-sufficiency check entirely', async () => {
    mockedParseId.mockReturnValue(30);
    mockedCheckMatch.mockResolvedValue({ ...baseMatch, mode: 'online' });
    mockedFindLatestByTournamentAndUser.mockResolvedValue(baseTournamentReferee);
    mockedIsActiveReferee.mockReturnValue(false);
    const next = vi.fn() as NextFunction;

    await requireCanRecordStats(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    expect(mockedFindTournamentById).not.toHaveBeenCalled();
    expect(mockedCountAcceptedByMatch).not.toHaveBeenCalled();
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.code).toBe('WRONG_SUBMITTER_ROLE');
  });

  it('calls next with the error (does not reject) when checkMatch throws', async () => {
    mockedParseId.mockReturnValue(30);
    const notFound = new AppError(404, 'MATCH_NOT_FOUND', 'ไม่พบแมตช์นี้');
    mockedCheckMatch.mockRejectedValue(notFound);
    const next = vi.fn() as NextFunction;

    await requireCanRecordStats(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    expect(next).toHaveBeenCalledWith(notFound);
  });
});

describe('requireReferee middleware', () => {
  it('calls next with NO_TOKEN when req.user is missing', async () => {
    const next = vi.fn() as NextFunction;
    await requireReferee(makeReq({ id: '30' }, undefined), makeRes(), next);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(401);
    expect(err.code).toBe('NO_TOKEN');
    expect(mockedParseId).not.toHaveBeenCalled();
  });

  it('parses the id with the 2-arg signature and looks up the match directly (not via checkMatch)', async () => {
    mockedParseId.mockReturnValue(30);
    mockedMatchFindById.mockResolvedValue(baseMatch);
    mockedFindLatestByTournamentAndUser.mockResolvedValue(baseTournamentReferee);
    mockedIsActiveReferee.mockReturnValue(true);
    mockedFindByMatch.mockResolvedValue([{ user_id: 5 } as any]);

    await requireReferee(makeReq({ id: '30' }, refereeUser), makeRes(), vi.fn() as NextFunction);

    expect(mockedParseId).toHaveBeenCalledWith('30', 'รหัสการแข่งขัน');
    expect(mockedCheckMatch).not.toHaveBeenCalled();
  });

  it('calls next with MATCH_NOT_FOUND when the match does not exist', async () => {
    mockedParseId.mockReturnValue(30);
    mockedMatchFindById.mockResolvedValue(null);
    const next = vi.fn() as NextFunction;

    await requireReferee(makeReq({ id: '30' }, refereeUser), makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(404);
    expect(err.code).toBe('MATCH_NOT_FOUND');
  });

  it('calls next with NOT_REFEREE when the caller is not assigned to the match', async () => {
    mockedParseId.mockReturnValue(30);
    mockedMatchFindById.mockResolvedValue(baseMatch);
    mockedFindLatestByTournamentAndUser.mockResolvedValue(baseTournamentReferee);
    mockedIsActiveReferee.mockReturnValue(false);
    const req = makeReq({ id: '30' }, refereeUser);
    const next = vi.fn() as NextFunction;

    await requireReferee(req, makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('NOT_REFEREE');
    expect((req as any).match).toBeUndefined();
  });

  it('attaches req.match and calls next() for the assigned referee', async () => {
    mockedParseId.mockReturnValue(30);
    mockedMatchFindById.mockResolvedValue(baseMatch);
    mockedFindLatestByTournamentAndUser.mockResolvedValue(baseTournamentReferee);
    mockedIsActiveReferee.mockReturnValue(true);
    mockedFindByMatch.mockResolvedValue([{ user_id: 5 } as any]);
    const req = makeReq({ id: '30' }, refereeUser);
    const next = vi.fn() as NextFunction;

    await requireReferee(req, makeRes(), next);

    expect((req as any).match).toEqual(baseMatch);
    expect(next).toHaveBeenCalledWith();
  });
});
