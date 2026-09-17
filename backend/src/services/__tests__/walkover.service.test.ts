import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/walkover.repo.js', () => ({
  findOpenMatchesOfTeam: vi.fn(),
  hasInProgressMatch: vi.fn(),
  isTeamWithdrawn: vi.fn(() => Promise.resolve(false)),
  findTeamLeaderId: vi.fn(() => Promise.resolve(7)),
  findSportOfTournament: vi.fn(() => Promise.resolve({ sport_type_id: 1, min_members: 11, walkover_score: { winner: 3, loser: 0 } })),
  applyWalkover: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../repositories/match.repo.js', () => ({
  findById: vi.fn(),
}));

import * as Walkover from '../walkover.service.js';
import * as WalkoverRepo from '../../repositories/walkover.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import type { MatchRow } from '../../types/db.js';

function match(overrides: Partial<MatchRow> = {}): MatchRow {
  return {
    match_id: 1, tournament_id: 50, round_number: 1, team_a_id: 10, team_b_id: 11,
    match_status: 'scheduled', next_match_id: null, loser_next_match_id: null, mode: 'onsite',
    ...overrides,
  } as MatchRow;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(WalkoverRepo.isTeamWithdrawn).mockResolvedValue(false);
});

describe('processTeamWithdrawal (P08 after bracket)', () => {
  it('gives every open match with a known opponent to that opponent, with the sport walkover score', async () => {
    vi.mocked(WalkoverRepo.findOpenMatchesOfTeam)
      .mockResolvedValueOnce([match({ match_id: 1, team_a_id: 10, team_b_id: 11 })])
      .mockResolvedValueOnce([]);

    const result = await Walkover.processTeamWithdrawal(50, 10, 7);

    expect(WalkoverRepo.applyWalkover).toHaveBeenCalledWith(expect.objectContaining({
      winnerTeamId: 11, loserTeamId: 10, actorUserId: 7, actorRole: 'team_leader',
      scoreData: { '11': 3, '10': 0 }, winPoints: 3, reason: 'team_withdrawn',
    }));
    expect(result).toEqual([{ matchId: 1, winnerTeamId: 11, loserTeamId: 10 }]);
  });

  it('leaves a match whose opponent is not known yet (resolved later by resolveIfOpponentWithdrawn)', async () => {
    vi.mocked(WalkoverRepo.findOpenMatchesOfTeam).mockResolvedValue([match({ match_id: 2, team_a_id: 10, team_b_id: null })]);

    const result = await Walkover.processTeamWithdrawal(50, 10, 7);

    expect(WalkoverRepo.applyWalkover).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('chains through the loser bracket: the withdrawn team placed as loser is walked over again', async () => {
    // รอบแรก: แมตช์ 1 → walkover · ทีมที่ถอนถูกวางลงสายล่าง (แมตช์ 9) → รอบสอง walkover ต่อ
    vi.mocked(WalkoverRepo.findOpenMatchesOfTeam)
      .mockResolvedValueOnce([match({ match_id: 1, team_a_id: 10, team_b_id: 11, loser_next_match_id: 9 })])
      .mockResolvedValueOnce([match({ match_id: 9, team_a_id: 12, team_b_id: 10 })])
      .mockResolvedValueOnce([]);

    const result = await Walkover.processTeamWithdrawal(50, 10, 7);

    expect(result.map(r => [r.matchId, r.winnerTeamId])).toEqual([[1, 11], [9, 12]]);
  });

  it('skips a match whose opponent has also withdrawn (nobody to award) and does not loop forever', async () => {
    vi.mocked(WalkoverRepo.findOpenMatchesOfTeam).mockResolvedValue([match({ match_id: 4, team_a_id: 10, team_b_id: 13 })]);
    vi.mocked(WalkoverRepo.isTeamWithdrawn).mockResolvedValue(true);

    const result = await Walkover.processTeamWithdrawal(50, 10, 7);

    expect(WalkoverRepo.applyWalkover).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});

describe('resolveIfOpponentWithdrawn (hook after verify places teams)', () => {
  it('does nothing when the match is not full or already started', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ team_b_id: null }));
    expect(await Walkover.resolveIfOpponentWithdrawn(1)).toEqual([]);

    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ match_status: 'in_progress' }));
    expect(await Walkover.resolveIfOpponentWithdrawn(1)).toEqual([]);
    expect(await Walkover.resolveIfOpponentWithdrawn(null)).toEqual([]);
  });

  it('walks the match over when one side withdrew earlier', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ match_id: 5, team_a_id: 10, team_b_id: 11 }));
    vi.mocked(WalkoverRepo.isTeamWithdrawn).mockImplementation((_t, teamId) => Promise.resolve(teamId === 11));
    vi.mocked(WalkoverRepo.findOpenMatchesOfTeam)
      .mockResolvedValueOnce([match({ match_id: 5, team_a_id: 10, team_b_id: 11 })])
      .mockResolvedValueOnce([]);

    const result = await Walkover.resolveIfOpponentWithdrawn(5);

    expect(result).toEqual([{ matchId: 5, winnerTeamId: 10, loserTeamId: 11 }]);
    expect(WalkoverRepo.applyWalkover).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 7, actorRole: 'team_leader' }));
  });
});

describe('decideNoShow (M10)', () => {
  const m = match({ team_a_id: 10, team_b_id: 11 });

  it('returns null when both teams reach min_members', () => {
    expect(Walkover.decideNoShow(m, 11, 11, 11)).toBeNull();
  });

  it('awards the team that reached min_members when the other did not (10 of 11 loses)', () => {
    expect(Walkover.decideNoShow(m, 11, 10, 11)).toEqual({ winnerTeamId: 10, loserTeamId: 11 });
    expect(Walkover.decideNoShow(m, 0, 11, 11)).toEqual({ winnerTeamId: 11, loserTeamId: 10 });
  });

  it('reports both_short when neither team is ready', () => {
    expect(Walkover.decideNoShow(m, 10, 3, 11)).toBe('both_short');
  });
});
