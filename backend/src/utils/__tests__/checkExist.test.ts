import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/user.repo.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../repositories/team.repo.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../repositories/match.repo.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../repositories/matchResult.repo.js', () => ({
  findmatchResultByMatchId: vi.fn(),
}));

vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(),
}));

vi.mock('../../repositories/announcement.repo.js', () => ({
  findById: vi.fn(),
}));

import { checkUser, checkTeam, checkMatch, checkMatchResult, checkTournament, checkAnnouncement } from '../checkExist.js';
import * as UserRepo from '../../repositories/user.repo.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as MatchResRepo from '../../repositories/matchResult.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as AnnouncementRepo from '../../repositories/announcement.repo.js';
import { AppError } from '../AppError.js';

const mockedUserRepo = vi.mocked(UserRepo);
const mockedTeamRepo = vi.mocked(TeamRepo);
const mockedMatchRepo = vi.mocked(MatchRepo);
const mockedMatchResRepo = vi.mocked(MatchResRepo);
const mockedTournamentRepo = vi.mocked(TournamentRepo);
const mockedAnnouncementRepo = vi.mocked(AnnouncementRepo);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkUser', () => {
  it('returns the user row when the user exists', async () => {
    const user = { user_id: 1, full_name: 'Test User' };
    mockedUserRepo.findById.mockResolvedValue(user as any);

    const result = await checkUser(1);

    expect(mockedUserRepo.findById).toHaveBeenCalledWith(1);
    expect(result).toBe(user);
  });

  it('throws USER_NOT_FOUND when the user does not exist', async () => {
    mockedUserRepo.findById.mockResolvedValue(null);

    await expect(checkUser(999)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
  });

  it('throws an AppError instance, not a plain Error', async () => {
    mockedUserRepo.findById.mockResolvedValue(null);

    const err = await checkUser(999).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('checkTeam', () => {
  it('returns the team row when the team exists', async () => {
    const team = { team_id: 10, name: 'Dream Team' };
    mockedTeamRepo.findById.mockResolvedValue(team as any);

    const result = await checkTeam(10);

    expect(mockedTeamRepo.findById).toHaveBeenCalledWith(10);
    expect(result).toBe(team);
  });

  it('throws TEAM_NOT_FOUND when the team does not exist', async () => {
    mockedTeamRepo.findById.mockResolvedValue(null);

    await expect(checkTeam(999)).rejects.toMatchObject({
      status: 404,
      code: 'TEAM_NOT_FOUND',
    });
  });

  it('does not treat a soft-deleted team (deleted_at set) as non-existent', async () => {
    // checkTeam only cares whether a row was found at all — the deleted_at
    // check is the caller's responsibility (see team.service.ts deleteTeam).
    const deletedTeam = { team_id: 10, name: 'Old Team', deleted_at: new Date() };
    mockedTeamRepo.findById.mockResolvedValue(deletedTeam as any);

    await expect(checkTeam(10)).resolves.toBe(deletedTeam);
  });
});

describe('checkMatch', () => {
  it('returns the match row when the match exists', async () => {
    const match = { match_id: 30, tournament_id: 20, mode: 'onsite' };
    mockedMatchRepo.findById.mockResolvedValue(match as any);

    const result = await checkMatch(30);

    expect(mockedMatchRepo.findById).toHaveBeenCalledWith(30);
    expect(result).toBe(match);
  });

  it('throws MATCH_NOT_FOUND when the match does not exist', async () => {
    mockedMatchRepo.findById.mockResolvedValue(null);

    await expect(checkMatch(999)).rejects.toMatchObject({
      status: 404,
      code: 'MATCH_NOT_FOUND',
    });
  });

  it('throws an AppError instance, not a plain Error', async () => {
    mockedMatchRepo.findById.mockResolvedValue(null);

    const err = await checkMatch(999).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('checkMatchResult', () => {
  it('returns the match result row when it exists', async () => {
    const matchRes = { match_result_id: 50, match_id: 30, match_result_status: 'submitted' };
    mockedMatchResRepo.findmatchResultByMatchId.mockResolvedValue(matchRes as any);

    const result = await checkMatchResult(30);

    expect(mockedMatchResRepo.findmatchResultByMatchId).toHaveBeenCalledWith(30);
    expect(result).toBe(matchRes);
  });

  it('throws MATCH_RESULT_NOT_FOUND when no result has been submitted for the match', async () => {
    mockedMatchResRepo.findmatchResultByMatchId.mockResolvedValue(null);

    await expect(checkMatchResult(30)).rejects.toMatchObject({
      status: 404,
      code: 'MATCH_RESULT_NOT_FOUND',
    });
  });

  it('throws an AppError instance, not a plain Error', async () => {
    mockedMatchResRepo.findmatchResultByMatchId.mockResolvedValue(null);

    const err = await checkMatchResult(30).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('checkTournament', () => {
  it('returns the tournament row when it exists', async () => {
    const tournament = { tournament_id: 20, name: 'Inter-Faculty Championship' };
    mockedTournamentRepo.findTournamentById.mockResolvedValue(tournament as any);

    const result = await checkTournament(20);

    expect(mockedTournamentRepo.findTournamentById).toHaveBeenCalledWith(20);
    expect(result).toBe(tournament);
  });

  it('throws TOURNAMENT_NOT_FOUND when the tournament does not exist', async () => {
    mockedTournamentRepo.findTournamentById.mockResolvedValue(null);

    await expect(checkTournament(999)).rejects.toMatchObject({
      status: 404,
      code: 'TOURNAMENT_NOT_FOUND',
    });
  });

  it('throws an AppError instance, not a plain Error', async () => {
    mockedTournamentRepo.findTournamentById.mockResolvedValue(null);

    const err = await checkTournament(999).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('checkAnnouncement', () => {
  it('returns the announcement row when it exists', async () => {
    const announcement = { announcement_id: 40, tournament_id: 20, title: 'Schedule update' };
    mockedAnnouncementRepo.findById.mockResolvedValue(announcement as any);

    const result = await checkAnnouncement(40);

    expect(mockedAnnouncementRepo.findById).toHaveBeenCalledWith(40);
    expect(result).toBe(announcement);
  });

  it('throws ANNOUNCEMENT_NOT_FOUND when the announcement does not exist', async () => {
    mockedAnnouncementRepo.findById.mockResolvedValue(null);

    await expect(checkAnnouncement(999)).rejects.toMatchObject({
      status: 404,
      code: 'ANNOUNCEMENT_NOT_FOUND',
    });
  });

  it('throws an AppError instance, not a plain Error', async () => {
    mockedAnnouncementRepo.findById.mockResolvedValue(null);

    const err = await checkAnnouncement(999).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
  });
});
