import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/matchResult.repo.js', () => ({
  findmatchResultByMatchId: vi.fn(),
  upholdMatchResult: vi.fn(() => Promise.resolve()),
  rejectMatchResult: vi.fn(() => Promise.resolve()),
  amendMatchResult: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(() => Promise.resolve({ tournament_id: 50, sport_type_id: 1 })),
}));
vi.mock('../walkover.service.js', () => ({ resolveIfOpponentWithdrawn: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../middlewares/requireReferee.js', () => ({ isRefereeOfMatch: vi.fn(), isTeamLeaderOfMatch: vi.fn() }));

import * as Service from '../matchResult.service.js';
import * as Repo from '../../repositories/matchResult.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as Walkover from '../walkover.service.js';
import type { MatchRow } from '../../types/db.js';

const match = (o: Partial<MatchRow> = {}) => ({
  match_id: 1, tournament_id: 50, team_a_id: 10, team_b_id: 11, next_match_id: 9, loser_next_match_id: null, match_status: 'disputed', ...o,
}) as MatchRow;
const disputed = { match_result_id: 100, match_id: 1, winner_team_id: 10, match_result_status: 'disputed', verified_at: new Date('2026-09-20T00:00:00Z') } as never;
const disputedBeforeVerify = { ...(disputed as object), verified_at: null } as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(Repo.findmatchResultByMatchId).mockResolvedValue(disputed);
  vi.mocked(MatchRepo.findById).mockImplementation(async id => id === 1 ? match() : match({ match_id: id, match_status: 'scheduled' }));
});

describe('resolveMatchResult (S04, B4)', () => {
  it('409 NO_ACTIVE_DISPUTE when the result is not disputed', async () => {
    vi.mocked(Repo.findmatchResultByMatchId).mockResolvedValue({ ...disputed, match_result_status: 'verified' } as never);
    await expect(Service.resolveMatchResult(1, { resolution: 'reject', resolutionNote: 'x' }, 7))
      .rejects.toMatchObject({ status: 409, code: 'NO_ACTIVE_DISPUTE' });
  });

  it('uphold closes the dispute without touching bracket/standings', async () => {
    const out = await Service.resolveMatchResult(1, { resolution: 'uphold', resolutionNote: 'ok' }, 7);
    expect(Repo.upholdMatchResult).toHaveBeenCalledWith(100, expect.objectContaining({ match_id: 1 }), 7, 'ok', null);
    expect(out).toEqual({ matchId: 1, status: 'verified', isAmended: false });
  });

  it('reject rolls the verified outcome back and leaves the match result_rejected', async () => {
    const out = await Service.resolveMatchResult(1, { resolution: 'reject', resolutionNote: 'wrong' }, 7);
    expect(Repo.rejectMatchResult).toHaveBeenCalledWith(100, expect.objectContaining({ match_id: 1 }), 10, 1, 3, 7, 'wrong', true);
    expect(out).toEqual({ matchId: 1, status: 'rejected', isAmended: false });
  });

  it('409 NEXT_MATCH_STARTED when the next round already opened check-in (cannot pull the team back)', async () => {
    vi.mocked(MatchRepo.findById).mockImplementation(async id => id === 1 ? match() : match({ match_id: 9, match_status: 'checkin_open' }));
    await expect(Service.resolveMatchResult(1, { resolution: 'reject', resolutionNote: 'x' }, 7))
      .rejects.toMatchObject({ status: 409, code: 'NEXT_MATCH_STARTED', extra: { nextMatchId: 9 } });
    expect(Repo.rejectMatchResult).not.toHaveBeenCalled();
  });

  it('amend with a new winner rewrites the result and re-checks withdrawn opponents in the next round', async () => {
    const out = await Service.resolveMatchResult(1, { resolution: 'amend', resolutionNote: 'swap', winnerTeamId: 11, scoreData: { '11': 2, '10': 1 } }, 7);
    expect(Repo.amendMatchResult).toHaveBeenCalledWith(100, expect.objectContaining({ match_id: 1 }), 10, 11, { '11': 2, '10': 1 }, 1, 3, 7, 'swap', true);
    expect(Walkover.resolveIfOpponentWithdrawn).toHaveBeenCalledWith(9);
    expect(out).toEqual({ matchId: 1, status: 'verified', isAmended: true });
  });

  it('amend with the same winner (score fix only) does not re-run the bracket hook', async () => {
    await Service.resolveMatchResult(1, { resolution: 'amend', resolutionNote: 'typo', winnerTeamId: 10, scoreData: { '10': 3, '11': 1 } }, 7);
    expect(Walkover.resolveIfOpponentWithdrawn).not.toHaveBeenCalled();
  });

  it('amend rejects a winnerTeamId that is not in the match', async () => {
    await expect(Service.resolveMatchResult(1, { resolution: 'amend', resolutionNote: 'x', winnerTeamId: 99, scoreData: {} }, 7))
      .rejects.toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(Repo.amendMatchResult).not.toHaveBeenCalled();
  });
});

describe('resolveMatchResult — dispute raised BEFORE verify (BR-14 first window)', () => {
  beforeEach(() => vi.mocked(Repo.findmatchResultByMatchId).mockResolvedValue(disputedBeforeVerify));

  it('uphold applies the outcome (acts as the missing verify) and runs the withdrawn-opponent hook', async () => {
    await Service.resolveMatchResult(1, { resolution: 'uphold', resolutionNote: 'ok' }, 7);
    expect(Repo.upholdMatchResult).toHaveBeenCalledWith(100, expect.objectContaining({ match_id: 1 }), 7, 'ok', { winnerId: 10, sportId: 1, point: 3 });
    expect(Walkover.resolveIfOpponentWithdrawn).toHaveBeenCalledWith(9);
  });

  it('reject does not try to undo anything and skips the next-match check', async () => {
    vi.mocked(MatchRepo.findById).mockImplementation(async id => id === 1 ? match() : match({ match_id: 9, match_status: 'in_progress' }));
    await Service.resolveMatchResult(1, { resolution: 'reject', resolutionNote: 'x' }, 7);
    expect(Repo.rejectMatchResult).toHaveBeenCalledWith(100, expect.anything(), 10, 1, 3, 7, 'x', false);
  });

  it('amend with the same winner still applies the outcome (nothing was applied yet)', async () => {
    await Service.resolveMatchResult(1, { resolution: 'amend', resolutionNote: 'fix', winnerTeamId: 10, scoreData: { '10': 2, '11': 1 } }, 7);
    expect(Repo.amendMatchResult).toHaveBeenCalledWith(100, expect.anything(), 10, 10, { '10': 2, '11': 1 }, 1, 3, 7, 'fix', false);
    expect(Walkover.resolveIfOpponentWithdrawn).toHaveBeenCalledWith(9);
  });
});

describe('ensureScoreData (FE-nothing-validates-keys-scoredata)', () => {
  const m = match({ team_a_id: 10, team_b_id: 11 });
  it.each([
    ['prototype a/b keys', 10, { a: 1, b: 0 }],
    ['empty', 10, {}],
    ['one team missing', 10, { '10': 2 }],
    ['foreign team id', 10, { '10': 2, '999999': 0 }],
    ['extra key', 10, { '10': 2, '11': 0, '12': 0 }],
    ['winner not in match', 99, { '10': 2, '11': 0 }],
    ['winner has lower score', 11, { '10': 2, '11': 0 }],
    ['draw (not supported yet)', 10, { '10': 2, '11': 2 }],
  ])('rejects %s with 400', (_n, winner, score) => {
    expect(() => Service.ensureScoreData(m, winner, score as Record<string, number>)).toThrowError(expect.objectContaining({ status: 400, code: 'VALIDATION_FAILED' }));
  });

  it('accepts exactly the two team ids with the winner ahead', () => {
    expect(() => Service.ensureScoreData(m, 11, { '10': 1, '11': 3 })).not.toThrow();
  });
});
