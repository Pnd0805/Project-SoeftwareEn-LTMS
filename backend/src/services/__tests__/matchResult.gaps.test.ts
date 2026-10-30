import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StandingRow } from '../../repositories/matchResult.repo.js';

/**
 * matchResult.service — paths the other matchResult.*.test.ts files don't reach:
 *   createSubmitMatchRes · getChampion · getDashboard · ensureScoreData edge cases ·
 *   organizerDecideMatch guards · autoVerifyDue skips · getVerifiedResult / getDispute 404s ·
 *   updatePlayerStat · getPlayerMatchStat · updateLivestream · getStandings provisional flag
 */

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(), notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(), notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
  notifyMatchFollowers: vi.fn(),
}));
vi.mock('../upload.service.js', () => ({ getPresignedDownloadUrl: vi.fn((k: string) => Promise.resolve(`https://s3/${k}`)) }));
vi.mock('../../utils/imageUrl.js', () => ({ toPublicImageUrl: (k: string | null) => (k === null ? null : `https://cdn.test/${k}`) }));
vi.mock('../../repositories/matchResult.repo.js', () => ({
  submitMatchResult: vi.fn(), findById: vi.fn(), findmatchResultByMatchId: vi.fn(), verifyMatchResult: vi.fn(),
  organizerDecideMatch: vi.fn(), findResultWithSubmitter: vi.fn(), findDisputeByMatchId: vi.fn(),
  findStandings: vi.fn(), findFinalMatchResult: vi.fn(), countApprovedTeams: vi.fn(), countApprovedPlayers: vi.fn(),
  countMatches: vi.fn(), recordPlayerStat: vi.fn(), allPlayerInMatch: vi.fn(), showPlayerStat: vi.fn(),
  overrideResultByReferee: vi.fn(),
}));
vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn(), updateLivestreamUrl: vi.fn() }));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn(), findUnfinishedMatchIds: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../repositories/team.repo.js', () => ({ findById: vi.fn(), findTeamIdOfUserInMatch: vi.fn() }));
vi.mock('../../repositories/sportType.repo.js', () => ({ findStatDefinitionsBySportType: vi.fn() }));
vi.mock('../../repositories/bracketNode.repo.js', () => ({ findSettledNodesByTournament: vi.fn(() => Promise.resolve([])) }));
vi.mock('../walkover.service.js', () => ({ resolveIfOpponentWithdrawn: vi.fn() }));
vi.mock('../../middlewares/requireReferee.js', () => ({ isRefereeOfMatch: vi.fn(() => Promise.resolve(false)), isTeamLeaderOfMatch: vi.fn(() => Promise.resolve(false)) }));
vi.mock('../../utils/checkExist.js', () => ({ checkMatch: vi.fn(), checkTournament: vi.fn(), checkTeam: vi.fn() }));
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn(() => Promise.resolve(null)) }));

import * as Service from '../matchResult.service.js';
import * as Repo from '../../repositories/matchResult.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import * as SportTypeRepo from '../../repositories/sportType.repo.js';
import * as Walkover from '../walkover.service.js';
import * as NotificationService from '../notification.service.js';
import { checkMatch, checkTournament, checkTeam } from '../../utils/checkExist.js';
import type { MatchRow } from '../../types/db.js';

const HOUR = 3600 * 1000;

const match = (o: Partial<MatchRow> = {}) => ({
  match_id: 7, tournament_id: 50, team_a_id: 11, team_b_id: 12, best_of: null, mode: 'online',
  match_status: 'finished', next_match_id: null, loser_next_match_id: null, scheduled_time: null,
  actual_end_time: null, ...o,
}) as MatchRow;

const team = (id: number) => ({ team_id: id, name: `ทีม ${id}`, sport_type_id: 1, logo_key: null }) as never;
const standing = (team_id: number, points: number, gf = 0, ga = 0): StandingRow =>
  ({ team_id, name: 'T' + team_id, sport_type_id: 1, logo_key: null, played: 3, won: points / 3, lost: 3 - points / 3, points, goals_for: gf, goals_against: ga });

async function rejected(p: Promise<unknown>) {
  return p.then(() => { throw new Error('expected rejection'); }, (e) => e);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkMatch).mockResolvedValue(match());
});

// ───────────────────────── ensureScoreData ─────────────────────────

describe('ensureScoreData — edge cases', () => {
  it.each([
    ['a missing team key', { '11': 2 }],
    ['an extra key', { '11': 2, '12': 1, '13': 0 }],
    ['a key from another match', { '11': 2, '99': 1 }],
  ])('400 VALIDATION_FAILED for %s, listing the expected keys', (_l, scoreData) => {
    expect(() => Service.ensureScoreData(match(), 11, scoreData)).toThrow(
      expect.objectContaining({ status: 400, code: 'VALIDATION_FAILED', extra: expect.objectContaining({ expectedKeys: ['11', '12'] }) }),
    );
  });

  it('400 when the winner is not one of the two teams', () => {
    expect(() => Service.ensureScoreData(match(), 99, { '11': 2, '12': 1 }))
      .toThrow(expect.objectContaining({ extra: { fields: { winnerTeamId: expect.any(String) } } }));
  });

  it.each([[{ '11': 1, '12': 1 }, 'a draw'], [{ '11': 0, '12': 3 }, 'the winner scoring less']])('400 for %j (%s)', (scoreData) => {
    expect(() => Service.ensureScoreData(match(), 11, scoreData)).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
  });

  it('works when team B is the winner', () => {
    expect(() => Service.ensureScoreData(match(), 12, { '11': 0, '12': 3 })).not.toThrow();
  });

  it('best-of match: 400 SCORE_NOT_IN_MATCH_FORMAT for an impossible series score, listing valid scores', () => {
    const err = (() => { try { Service.ensureScoreData(match({ best_of: 3 } as never), 11, { '11': 3, '12': 0 }); } catch (e) { return e; } })();
    expect(err).toMatchObject({ status: 400, code: 'SCORE_NOT_IN_MATCH_FORMAT', extra: { bestOf: 3, possibleScores: expect.any(Array) } });
  });

  it('best-of match: a valid series score passes', () => {
    expect(() => Service.ensureScoreData(match({ best_of: 3 } as never), 11, { '11': 2, '12': 1 })).not.toThrow();
  });

  it('no best_of: any winning score passes (e.g. a football score)', () => {
    expect(() => Service.ensureScoreData(match(), 11, { '11': 7, '12': 3 })).not.toThrow();
  });
});

// ───────────────────────── createSubmitMatchRes ─────────────────────────

describe('createSubmitMatchRes', () => {
  it('validates, stores, notifies everyone but the submitter, and returns the stored row', async () => {
    vi.mocked(Repo.submitMatchResult).mockResolvedValue(900 as never);
    vi.mocked(Repo.findById).mockResolvedValue({ match_result_id: 900, match_id: 7, match_result_status: 'submitted', submitted_by_user_id: 3 } as never);

    const result = await Service.createSubmitMatchRes(7, 11, { '11': 2, '12': 1 }, 3, 'referee');

    expect(Repo.submitMatchResult).toHaveBeenCalledWith(7, 11, { '11': 2, '12': 1 }, 3, 'referee');
    expect(Repo.findById).toHaveBeenCalledWith(900);
    expect(NotificationService.notifyMatchResultParties).toHaveBeenCalledWith(7,
      expect.objectContaining({ type: 'result_submitted', relatedEntityId: 7 }), { exceptUserId: 3 });
    expect(result).toEqual({ id: 900, matchId: 7, status: 'submitted', submittedBy: 3 });
  });

  it('rejects bad score data before writing anything', async () => {
    expect(await rejected(Service.createSubmitMatchRes(7, 11, { '11': 1, '12': 1 }, 3, 'team_leader'))).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(Repo.submitMatchResult).not.toHaveBeenCalled();
    expect(NotificationService.notifyMatchResultParties).not.toHaveBeenCalled();
  });

  it('propagates checkMatch failure (unknown match)', async () => {
    const err = Object.assign(new Error('x'), { status: 404 });
    vi.mocked(checkMatch).mockRejectedValueOnce(err);
    expect(await rejected(Service.createSubmitMatchRes(7, 11, { '11': 2, '12': 1 }, 3, 'referee'))).toBe(err);
  });
});

// ───────────────────────── organizerDecideMatch guards ─────────────────────────

describe('organizerDecideMatch — guards not covered elsewhere', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const finishedLongAgo = () => match({ actual_end_time: new Date(Date.now() - 25 * HOUR) } as never);

  it('404 MATCH_NOT_FOUND for an unknown match', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValueOnce(null as never);
    expect(await rejected(Service.organizerDecideMatch(7, 1, { outcome: 'double_forfeit', reason: 'x' } as never)))
      .toMatchObject({ status: 404, code: 'MATCH_NOT_FOUND' });
  });

  it('409 MATCH_NOT_FINISHED when the status changed between the check and the write', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValueOnce(finishedLongAgo() as never);
    vi.mocked(Repo.findmatchResultByMatchId).mockResolvedValueOnce(null as never);
    vi.mocked(Repo.organizerDecideMatch).mockResolvedValueOnce(false as never);

    expect(await rejected(Service.organizerDecideMatch(7, 1, { outcome: 'double_forfeit', reason: 'ไม่มีใครส่งผล' } as never)))
      .toMatchObject({ status: 409, code: 'MATCH_NOT_FINISHED' });
    expect(Walkover.resolveIfOpponentWithdrawn).not.toHaveBeenCalled();
    expect(NotificationService.notifyMatchResultParties).not.toHaveBeenCalled();
  });

  it('a previously rejected result does not block the organizer', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValueOnce(finishedLongAgo() as never);
    vi.mocked(Repo.findmatchResultByMatchId).mockResolvedValueOnce({ match_result_status: 'rejected' } as never);
    vi.mocked(Repo.organizerDecideMatch).mockResolvedValueOnce(true as never);

    await expect(Service.organizerDecideMatch(7, 1, { outcome: 'result', winnerTeamId: 11, scoreData: { '11': 2, '12': 0 }, reason: 'x' } as never))
      .resolves.toEqual({ matchId: 7, outcome: 'result', decidedBy: 'organizer' });
    expect(Repo.organizerDecideMatch).toHaveBeenCalledWith(expect.anything(), 1, 'x', expect.any(Number),
      { kind: 'result', winnerId: 11, score: { '11': 2, '12': 0 } });
  });
});

// ───────────────────────── autoVerifyDue skips ─────────────────────────

describe('autoVerifyDue — skips', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const submitted = (o: Record<string, unknown> = {}) => ({
    match_result_id: 900, match_result_status: 'submitted', submitted_role: 'referee',
    submitted_at: new Date(Date.now() - 25 * HOUR), ...o,
  });

  it('skips a match that no longer exists', async () => {
    vi.mocked(Repo.findmatchResultByMatchId).mockResolvedValueOnce(submitted() as never);
    vi.mocked(MatchRepo.findById).mockResolvedValueOnce(null as never);

    await expect(Service.autoVerifyDue([7])).resolves.toEqual([]);
    expect(Repo.verifyMatchResult).not.toHaveBeenCalled();
  });

  it.each([
    ['no result', null],
    ['a team-leader submission', submitted({ submitted_role: 'team_leader' })],
    ['an already verified result', submitted({ match_result_status: 'verified' })],
    ['no submitted_at', submitted({ submitted_at: null })],
  ])('skips %s', async (_l, res) => {
    vi.mocked(Repo.findmatchResultByMatchId).mockResolvedValueOnce(res as never);
    await expect(Service.autoVerifyDue([7])).resolves.toEqual([]);
    expect(MatchRepo.findById).not.toHaveBeenCalled();
  });

  it('a next match without a scheduled time does not pull the deadline forward', async () => {
    vi.mocked(Repo.findmatchResultByMatchId).mockResolvedValueOnce(submitted({ submitted_at: new Date(Date.now() - 23 * HOUR) }) as never);
    vi.mocked(MatchRepo.findById)
      .mockResolvedValueOnce(match({ next_match_id: 8 }) as never)
      .mockResolvedValueOnce(match({ match_id: 8, scheduled_time: null }) as never);

    await expect(Service.autoVerifyDue([7])).resolves.toEqual([]);   // still inside the 24 h cap
  });

  it('verifies once past the 24 h cap, resolves walkovers for both next matches, and notifies', async () => {
    vi.mocked(Repo.findmatchResultByMatchId).mockResolvedValueOnce(submitted() as never);
    vi.mocked(MatchRepo.findById).mockResolvedValueOnce(match({ next_match_id: null, loser_next_match_id: null }) as never);

    await expect(Service.autoVerifyDue([7])).resolves.toEqual([7]);
    expect(Repo.verifyMatchResult).toHaveBeenCalledWith(900, 7, null, expect.any(Number));
    expect(Walkover.resolveIfOpponentWithdrawn).toHaveBeenCalledTimes(2);
    expect(NotificationService.notifyMatchFollowers).toHaveBeenCalledWith(7, expect.objectContaining({ type: 'followed_player_result_verified' }), { excludeAudience: false });
  });
});

// ───────────────────────── reads: 404s ─────────────────────────

describe('getVerifiedResult / getDispute — not found', () => {
  it('getVerifiedResult: 404 when the match has no result row', async () => {
    vi.mocked(Repo.findResultWithSubmitter).mockResolvedValueOnce(null as never);
    expect(await rejected(Service.getVerifiedResult(7, 3))).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('getVerifiedResult: an unfinished result is hidden (404) from anonymous viewers', async () => {
    vi.mocked(Repo.findResultWithSubmitter).mockResolvedValueOnce({ match_id: 7, match_result_status: 'submitted' } as never);
    expect(await rejected(Service.getVerifiedResult(7))).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it.each([['no row', null], ['a row that was never disputed', { dispute_raised_at: null }]])(
    'getDispute: 404 NO_ACTIVE_DISPUTE for %s, before any permission check', async (_l, row) => {
      vi.mocked(Repo.findDisputeByMatchId).mockResolvedValueOnce(row as never);
      expect(await rejected(Service.getDispute(7, 3))).toMatchObject({ status: 404, code: 'NO_ACTIVE_DISPUTE' });
      expect(checkMatch).not.toHaveBeenCalled();
    });
});

// ───────────────────────── getChampion ─────────────────────────

describe('getChampion', () => {
  const tour = (o: Record<string, unknown> = {}) => ({
    tournament_id: 50, tournament_status: 'completed', bracket_format: 'single_elimination',
    champion_team_id: null, completed_at: new Date('2026-10-20T10:00:00Z'), event_end_date: '2026-10-20', ...o,
  }) as never;

  it('404 NOT_FOUND while the tournament is not completed', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce(tour({ tournament_status: 'public' }));
    expect(await rejected(Service.getChampion(50))).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(Repo.findFinalMatchResult).not.toHaveBeenCalled();
  });

  it('elimination: champion and runner-up from the final, with its score', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce(tour());
    vi.mocked(Repo.findFinalMatchResult).mockResolvedValueOnce(
      { match_result_status: 'verified', winner_team_id: 11, team_a_id: 11, team_b_id: 12, score_data: { '11': 3, '12': 1 } } as never);
    vi.mocked(checkTeam).mockResolvedValueOnce(team(11));
    vi.mocked(TeamRepo.findById).mockResolvedValueOnce(team(12));

    await expect(Service.getChampion(50)).resolves.toEqual({
      championTeam: { id: 11, name: 'ทีม 11', sportTypeId: 1, logoUrl: null },
      runnerUpTeam: { id: 12, name: 'ทีม 12', sportTypeId: 1, logoUrl: null },
      summary: { finalScore: { '11': 3, '12': 1 }, isWalkover: false, completedAt: '2026-10-20T10:00:00.000Z' },
    });
  });

  it('elimination: the runner-up is team A when team B won', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce(tour());
    vi.mocked(Repo.findFinalMatchResult).mockResolvedValueOnce(
      { match_result_status: 'verified', winner_team_id: 12, team_a_id: 11, team_b_id: 12, score_data: null } as never);
    vi.mocked(checkTeam).mockResolvedValueOnce(team(12));
    vi.mocked(TeamRepo.findById).mockResolvedValueOnce(team(11));

    const dto = await Service.getChampion(50);
    expect(TeamRepo.findById).toHaveBeenCalledWith(11);
    expect(dto.runnerUpTeam?.id).toBe(11);
  });

  it('elimination: the stored champion_team_id wins over the final\'s winner (e.g. after an amendment)', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce(tour({ champion_team_id: 12 }));
    vi.mocked(Repo.findFinalMatchResult).mockResolvedValueOnce(
      { match_result_status: 'verified', winner_team_id: 11, team_a_id: 11, team_b_id: 12, score_data: null } as never);
    vi.mocked(checkTeam).mockResolvedValueOnce(team(12));
    vi.mocked(TeamRepo.findById).mockResolvedValueOnce(team(11));

    await Service.getChampion(50);
    expect(checkTeam).toHaveBeenCalledWith(12);
  });

  it('elimination: a walkover final is flagged; a missing opponent gives no runner-up', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce(tour());
    vi.mocked(Repo.findFinalMatchResult).mockResolvedValueOnce(
      { match_result_status: 'walkover', winner_team_id: 11, team_a_id: 11, team_b_id: null, score_data: null } as never);
    vi.mocked(checkTeam).mockResolvedValueOnce(team(11));

    const dto = await Service.getChampion(50);
    expect(dto.summary.isWalkover).toBe(true);
    expect(dto.runnerUpTeam).toBeNull();
    expect(TeamRepo.findById).not.toHaveBeenCalled();
  });

  it('elimination: a runner-up team that was deleted comes back as null', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce(tour());
    vi.mocked(Repo.findFinalMatchResult).mockResolvedValueOnce(
      { match_result_status: 'verified', winner_team_id: 11, team_a_id: 11, team_b_id: 12, score_data: null } as never);
    vi.mocked(checkTeam).mockResolvedValueOnce(team(11));
    vi.mocked(TeamRepo.findById).mockResolvedValueOnce(null as never);

    expect((await Service.getChampion(50)).runnerUpTeam).toBeNull();
  });

  it('elimination: no champion at all (double forfeit in the final) → both teams null', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce(tour());
    vi.mocked(Repo.findFinalMatchResult).mockResolvedValueOnce(
      { match_result_status: 'verified', winner_team_id: null, team_a_id: 11, team_b_id: 12, score_data: null } as never);

    await expect(Service.getChampion(50)).resolves.toMatchObject({ championTeam: null, runnerUpTeam: null });
    expect(checkTeam).not.toHaveBeenCalled();
  });

  it('elimination: 404 when the final match cannot be found', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce(tour());
    vi.mocked(Repo.findFinalMatchResult).mockResolvedValueOnce(null as never);
    expect(await rejected(Service.getChampion(50))).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('falls back to event_end_date when completed_at is missing', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce(tour({ completed_at: null }));
    vi.mocked(Repo.findFinalMatchResult).mockResolvedValueOnce(
      { match_result_status: 'verified', winner_team_id: null, team_a_id: 11, team_b_id: 12, score_data: null } as never);

    expect((await Service.getChampion(50)).summary.completedAt).toBe('2026-10-20');
  });

  it('round robin: champion is the stored team, runner-up is the best other team on the table', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce(tour({ bracket_format: 'round_robin', champion_team_id: 2 }));
    vi.mocked(Repo.findStandings).mockResolvedValueOnce([standing(2, 9, 6, 1), standing(1, 6, 4, 3), standing(3, 0)]);

    const dto = await Service.getChampion(50);

    expect(dto.championTeam?.id).toBe(2);
    expect(dto.runnerUpTeam?.id).toBe(1);
    expect(dto.summary).toEqual({ finalScore: null, isWalkover: false, completedAt: '2026-10-20T10:00:00.000Z' });
    expect(Repo.findFinalMatchResult).not.toHaveBeenCalled();
  });

  it('round robin: a champion lower on the table still gets the top team as runner-up', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce(tour({ bracket_format: 'round_robin', champion_team_id: 1 }));
    vi.mocked(Repo.findStandings).mockResolvedValueOnce([standing(2, 9), standing(1, 6), standing(3, 0)]);

    const dto = await Service.getChampion(50);
    expect(dto.championTeam?.id).toBe(1);
    expect(dto.runnerUpTeam?.id).toBe(2);
  });

  it('round robin: no stored champion (tie at the top) → no champion and no runner-up', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce(tour({ bracket_format: 'round_robin', champion_team_id: null }));
    vi.mocked(Repo.findStandings).mockResolvedValueOnce([standing(1, 6), standing(2, 6)]);

    await expect(Service.getChampion(50)).resolves.toMatchObject({ championTeam: null, runnerUpTeam: null });
  });

  it('round robin: a stored champion missing from the table → null', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce(tour({ bracket_format: 'round_robin', champion_team_id: 99 }));
    vi.mocked(Repo.findStandings).mockResolvedValueOnce([standing(1, 6)]);

    await expect(Service.getChampion(50)).resolves.toMatchObject({ championTeam: null, runnerUpTeam: null });
  });

  it('round robin: a one-team table has a champion but no runner-up', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce(tour({ bracket_format: 'round_robin', champion_team_id: 1 }));
    vi.mocked(Repo.findStandings).mockResolvedValueOnce([standing(1, 6)]);

    await expect(Service.getChampion(50)).resolves.toMatchObject({ championTeam: { id: 1 }, runnerUpTeam: null });
  });
});

describe('resolveChampionTeamId — empty table', () => {
  it('round robin with no standings → null', async () => {
    vi.mocked(Repo.findStandings).mockResolvedValueOnce([]);
    await expect(Service.resolveChampionTeamId({ tournament_id: 50, bracket_format: 'round_robin' } as never)).resolves.toBeNull();
  });

  it('elimination with no final row → null', async () => {
    vi.mocked(Repo.findFinalMatchResult).mockResolvedValueOnce(null as never);
    await expect(Service.resolveChampionTeamId({ tournament_id: 50, bracket_format: 'single_elimination' } as never)).resolves.toBeNull();
  });
});

// ───────────────────────── getDashboard ─────────────────────────

describe('getDashboard', () => {
  it('returns team, player and match counts for the tournament', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce({ tournament_id: 50 } as never);
    vi.mocked(Repo.countApprovedTeams).mockResolvedValueOnce(8 as never);
    vi.mocked(Repo.countApprovedPlayers).mockResolvedValueOnce(64 as never);
    vi.mocked(Repo.countMatches).mockResolvedValueOnce({ matchCount: 7, matchesCompleted: 3 } as never);

    await expect(Service.getDashboard(50)).resolves.toEqual({ teamCount: 8, playerCount: 64, matchCount: 7, matchesCompleted: 3 });
    expect(Repo.countApprovedTeams).toHaveBeenCalledWith(50);
    expect(Repo.countApprovedPlayers).toHaveBeenCalledWith(50);
    expect(Repo.countMatches).toHaveBeenCalledWith(50);
  });

  it('propagates checkTournament failure without counting', async () => {
    const err = Object.assign(new Error('x'), { status: 404 });
    vi.mocked(checkTournament).mockRejectedValueOnce(err);

    expect(await rejected(Service.getDashboard(50))).toBe(err);
    expect(Repo.countApprovedTeams).not.toHaveBeenCalled();
  });
});

// ───────────────────────── player stats ─────────────────────────

describe('updatePlayerStat', () => {
  beforeEach(() => {
    vi.mocked(checkTournament).mockResolvedValue({ tournament_id: 50, sport_type_id: 1 } as never);
    vi.mocked(SportTypeRepo.findStatDefinitionsBySportType).mockResolvedValue(
      [{ sport_stat_definition_id: 1 }, { sport_stat_definition_id: 2 }] as never);
  });

  it('records each player under their own team and counts every value', async () => {
    vi.mocked(TeamRepo.findTeamIdOfUserInMatch)
      .mockResolvedValueOnce({ teamId: 11 } as never)
      .mockResolvedValueOnce({ teamId: 12 } as never);

    const result = await Service.updatePlayerStat(7, 3, [
      { userId: 100, values: [{ statDefinitionId: 1, value: 2 }, { statDefinitionId: 2, value: 1 }] },
      { userId: 200, values: [{ statDefinitionId: 1, value: 0 }] },
    ]);

    expect(result).toEqual({ matchId: 7, recordedCount: 3 });
    expect(Repo.recordPlayerStat).toHaveBeenNthCalledWith(1, 7, 100, 11, 3, expect.any(Array));
    expect(Repo.recordPlayerStat).toHaveBeenNthCalledWith(2, 7, 200, 12, 3, [{ statDefinitionId: 1, value: 0 }]);
  });

  it('400 UNKNOWN_STAT_DEFINITION for a stat of another sport, before writing anything', async () => {
    expect(await rejected(Service.updatePlayerStat(7, 3, [{ userId: 100, values: [{ statDefinitionId: 99, value: 1 }] }])))
      .toMatchObject({ status: 400, code: 'UNKNOWN_STAT_DEFINITION' });
    expect(TeamRepo.findTeamIdOfUserInMatch).not.toHaveBeenCalled();
    expect(Repo.recordPlayerStat).not.toHaveBeenCalled();
  });

  it('404 USER_NOT_IN_MATCH if any player is not in the match — nothing is recorded, not even earlier players', async () => {
    vi.mocked(TeamRepo.findTeamIdOfUserInMatch)
      .mockResolvedValueOnce({ teamId: 11 } as never)
      .mockResolvedValueOnce(null as never);

    expect(await rejected(Service.updatePlayerStat(7, 3, [
      { userId: 100, values: [{ statDefinitionId: 1, value: 1 }] },
      { userId: 999, values: [{ statDefinitionId: 1, value: 1 }] },
    ]))).toMatchObject({ status: 404, code: 'USER_NOT_IN_MATCH' });
    expect(Repo.recordPlayerStat).not.toHaveBeenCalled();
  });

  it('an empty list records nothing', async () => {
    await expect(Service.updatePlayerStat(7, 3, [])).resolves.toEqual({ matchId: 7, recordedCount: 0 });
  });
});

describe('getPlayerMatchStat', () => {
  it('returns one entry per player in the match', async () => {
    vi.mocked(Repo.allPlayerInMatch).mockResolvedValueOnce([{ userId: 100, fullName: 'ก' }, { userId: 200, fullName: 'ข' }] as never);
    vi.mocked(Repo.showPlayerStat).mockResolvedValue([] as never);

    const { items } = await Service.getPlayerMatchStat(7);

    expect(items).toHaveLength(2);
    expect(Repo.showPlayerStat).toHaveBeenNthCalledWith(1, 7, 100);
    expect(Repo.showPlayerStat).toHaveBeenNthCalledWith(2, 7, 200);
  });

  it('no players → empty list', async () => {
    vi.mocked(Repo.allPlayerInMatch).mockResolvedValueOnce([] as never);
    await expect(Service.getPlayerMatchStat(7)).resolves.toEqual({ items: [] });
  });
});

// ───────────────────────── livestream ─────────────────────────

describe('updateLivestream', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'youtube.com/watch?v=abc_DEF-123',
  ])('accepts %s', async (url) => {
    await expect(Service.updateLivestream(7, url)).resolves.toEqual({ matchId: 7, youtubeUrl: url });
    expect(MatchRepo.updateLivestreamUrl).toHaveBeenCalledWith(7, url);
  });

  it('null clears the link', async () => {
    await expect(Service.updateLivestream(7, null)).resolves.toEqual({ matchId: 7, youtubeUrl: null });
    expect(MatchRepo.updateLivestreamUrl).toHaveBeenCalledWith(7, null);
  });

  it.each([
    'https://vimeo.com/123',
    'https://www.youtube.com/channel/abc',
    'javascript:alert(1)',
    '',
  ])('400 INVALID_YOUTUBE_URL for %j', async (url) => {
    expect(await rejected(Service.updateLivestream(7, url))).toMatchObject({ status: 400, code: 'INVALID_YOUTUBE_URL' });
    expect(MatchRepo.updateLivestreamUrl).not.toHaveBeenCalled();
  });

  // Characterization: the pattern is anchored only at the start, so anything may follow a valid prefix.
  // Harmless while the URL is only shown as a link, but worth knowing if it is ever embedded.
  it('characterization: accepts trailing text after a valid YouTube prefix', async () => {
    await expect(Service.updateLivestream(7, 'https://youtu.be/abc"><script>')).resolves.toMatchObject({ matchId: 7 });
  });
});

// ───────────────────────── standings ─────────────────────────

describe('getStandings — provisional flag', () => {
  it('is provisional while any match is unfinished, and lists those matches', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce({ tournament_id: 50, bracket_format: 'round_robin' } as never);
    vi.mocked(Repo.findStandings).mockResolvedValueOnce([standing(1, 6), standing(2, 3)]);
    vi.mocked(TournamentRepo.findUnfinishedMatchIds).mockResolvedValueOnce([{ match_id: 9, match_status: 'scheduled' }] as never);

    const result = await Service.getStandings(50);

    expect(result.isProvisional).toBe(true);
    expect(result.pendingMatches).toEqual([{ id: 9, status: 'scheduled' }]);
    expect(result.items.map(i => i.rank)).toEqual([1, 2]);
  });

  it('is final when every match is done', async () => {
    vi.mocked(checkTournament).mockResolvedValueOnce({ tournament_id: 50, bracket_format: 'round_robin' } as never);
    vi.mocked(Repo.findStandings).mockResolvedValueOnce([]);

    await expect(Service.getStandings(50)).resolves.toEqual({ items: [], isProvisional: false, pendingMatches: [] });
  });
});

// ───────────────────────── remaining branches ─────────────────────────

describe('overrideMatchResult — no earlier result', () => {
  it('records an empty "before" snapshot when the match had no result yet', async () => {
    vi.mocked(Repo.findmatchResultByMatchId)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ match_result_id: 900, match_id: 7, match_result_status: 'verified', submitted_by_user_id: 3 } as never);

    await Service.overrideMatchResult(7, { winnerTeamId: 11, scoreData: { '11': 2, '12': 0 }, reason: 'กรอกผิด' } as never, 3);

    expect(Repo.overrideResultByReferee).toHaveBeenCalledWith(expect.anything(), 11, { '11': 2, '12': 0 }, 3, 'กรอกผิด',
      { winnerTeamId: null, scoreData: null, submittedByUserId: null, submittedRole: null });
  });
});

describe('autoVerifyDue — next match scheduled far ahead', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('keeps the 24 h cap when the next match starts later than that', async () => {
    vi.mocked(Repo.findmatchResultByMatchId).mockResolvedValueOnce({
      match_result_id: 900, match_result_status: 'submitted', submitted_role: 'referee', submitted_at: new Date(Date.now() - 23 * HOUR),
    } as never);
    vi.mocked(MatchRepo.findById)
      .mockResolvedValueOnce(match({ next_match_id: 8 }) as never)
      .mockResolvedValueOnce(match({ match_id: 8, scheduled_time: new Date(Date.now() + 48 * HOUR) }) as never);

    await expect(Service.autoVerifyDue([7])).resolves.toEqual([]);
  });

  it('pulls the deadline forward to 15 min before an earlier next match', async () => {
    vi.mocked(Repo.findmatchResultByMatchId).mockResolvedValueOnce({
      match_result_id: 900, match_result_status: 'submitted', submitted_role: 'referee', submitted_at: new Date(Date.now() - 2 * HOUR),
    } as never);
    vi.mocked(MatchRepo.findById)
      .mockResolvedValueOnce(match({ next_match_id: 8 }) as never)
      .mockResolvedValueOnce(match({ match_id: 8, scheduled_time: new Date(Date.now() + 10 * 60 * 1000) }) as never);

    await expect(Service.autoVerifyDue([7])).resolves.toEqual([7]);
  });
});

describe('getVerifiedResult — dispute window fallbacks', () => {
  const verifiedRow = {
    match_id: 7, match_result_status: 'verified', verified_at: new Date('2026-10-10T00:00:00Z'), verified_by_user_id: 3,
    winner_team_id: 11, score_data: { '11': 2, '12': 0 }, amended_at: null, amend_reason: null, submitted_role: 'referee',
  };

  it('match row gone → not changeable, window defaults to 24 h', async () => {
    vi.mocked(Repo.findResultWithSubmitter).mockResolvedValueOnce(verifiedRow as never);
    vi.mocked(MatchRepo.findById).mockResolvedValueOnce(null as never);

    const result = await Service.getVerifiedResult(7);

    expect(result).toMatchObject({ resultChangeable: false, disputeClosesAt: '2026-10-11T00:00:00.000Z' });
  });

  it('tournament without dispute_window_hours → 24 h', async () => {
    vi.mocked(Repo.findResultWithSubmitter).mockResolvedValueOnce(verifiedRow as never);
    vi.mocked(MatchRepo.findById).mockResolvedValueOnce(match() as never);
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValueOnce({ tournament_id: 50, dispute_window_hours: null } as never);

    expect((await Service.getVerifiedResult(7)).disputeClosesAt).toBe('2026-10-11T00:00:00.000Z');
  });

  it('uses the tournament\'s own window when set', async () => {
    vi.mocked(Repo.findResultWithSubmitter).mockResolvedValueOnce(verifiedRow as never);
    vi.mocked(MatchRepo.findById).mockResolvedValueOnce(match() as never);
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValueOnce({ tournament_id: 50, dispute_window_hours: 48 } as never);

    expect((await Service.getVerifiedResult(7)).disputeClosesAt).toBe('2026-10-12T00:00:00.000Z');
  });
});

describe('getDispute — optional fields', () => {
  it('no evidence and a deleted raiser → empty evidence and raisedBy null', async () => {
    vi.mocked(Repo.findDisputeByMatchId).mockResolvedValueOnce({
      match_result_status: 'disputed', dispute_reason: 'x', dispute_raised_by: null, raised_by_name: null,
      dispute_raised_at: new Date('2026-10-10T00:00:00Z'), dispute_claimed_winner_team_id: null, dispute_claimed_score: null,
      dispute_evidence: null, dispute_resolution: null, dispute_resolved_at: null,
    } as never);
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValueOnce({ tournament_id: 50, requested_by_user_id: 3 } as never);

    await expect(Service.getDispute(7, 3)).resolves.toMatchObject({
      matchId: 7, evidence: [], raisedBy: null, raisedAt: '2026-10-10T00:00:00.000Z', resolvedAt: null,
    });
  });
});
