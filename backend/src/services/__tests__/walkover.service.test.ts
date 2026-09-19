import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/walkover.repo.js', () => ({
  findOpenMatchesOfTeam: vi.fn(),
  hasInProgressMatch: vi.fn(),
  isTeamWithdrawn: vi.fn(() => Promise.resolve(false)),
  findTeamLeaderId: vi.fn(() => Promise.resolve(7)),
  findSportOfTournament: vi.fn(() => Promise.resolve({ sport_type_id: 1, min_members: 11, walkover_score: { winner: 3, loser: 0 } })),
  applyWalkover: vi.fn(() => Promise.resolve()),
  hasUnfinishedPredecessor: vi.fn(() => Promise.resolve(true)),
  closeCheckin: vi.fn(() => Promise.resolve(true)),
  closeDeadMatch: vi.fn(() => Promise.resolve(true)),
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
  vi.mocked(WalkoverRepo.hasUnfinishedPredecessor).mockResolvedValue(true);
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

  it('both teams withdrawn → double forfeit (nobody advances, both lose) and the next match gets a dead-slot bye', async () => {
    vi.mocked(WalkoverRepo.findOpenMatchesOfTeam).mockResolvedValue([match({ match_id: 4, team_a_id: 10, team_b_id: 13, next_match_id: 9 })]);
    vi.mocked(WalkoverRepo.isTeamWithdrawn).mockResolvedValue(true);
    vi.mocked(WalkoverRepo.hasUnfinishedPredecessor).mockResolvedValue(false);
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ match_id: 9, team_a_id: 20, team_b_id: null }));

    const result = await Walkover.processTeamWithdrawal(50, 10, 7);

    expect(WalkoverRepo.applyWalkover).toHaveBeenNthCalledWith(1, expect.objectContaining({
      winnerTeamId: null, loserTeamId: null, forfeitedTeamIds: [10, 13], actorRole: 'team_leader', reason: 'both_withdrawn',
    }));
    expect(WalkoverRepo.applyWalkover).toHaveBeenNthCalledWith(2, expect.objectContaining({
      winnerTeamId: 20, loserTeamId: null, reason: 'dead_slot',
    }));
    expect(WalkoverRepo.applyWalkover).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      { matchId: 4, winnerTeamId: null, loserTeamId: null },
      { matchId: 9, winnerTeamId: 20, loserTeamId: null },
    ]);
  });
});

describe('resolveIfOpponentWithdrawn (hook after verify places teams)', () => {
  it('does nothing when the match is not full or already started', async () => {
    // ทีมเดียวแต่แมตช์ต้นทางยังไม่จบ → คู่ยังมาได้ ไม่ใช่ dead slot
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ team_b_id: null }));
    expect(await Walkover.resolveIfOpponentWithdrawn(1)).toEqual([]);
    expect(WalkoverRepo.applyWalkover).not.toHaveBeenCalled();

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

describe('dead slot / double forfeit (M17)', () => {
  it('advances the waiting team when every source match is finished and the other slot is still empty', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ match_id: 20, team_a_id: 10, team_b_id: null, next_match_id: null }));
    vi.mocked(WalkoverRepo.hasUnfinishedPredecessor).mockResolvedValue(false);

    const result = await Walkover.resolveIfOpponentWithdrawn(20);

    expect(result).toEqual([{ matchId: 20, winnerTeamId: 10, loserTeamId: null }]);
    expect(WalkoverRepo.applyWalkover).toHaveBeenCalledWith(expect.objectContaining({ winnerTeamId: 10, loserTeamId: null, reason: 'dead_slot', scoreData: null }));
  });

  it('applyOrganizerForfeit: one side short → walkover by organizer', async () => {
    const m = match({ team_a_id: 10, team_b_id: 11 });
    const out = await Walkover.applyOrganizerForfeit(m, 11, 4, 11, 99);

    expect(out?.kind).toBe('walkover');
    expect(WalkoverRepo.applyWalkover).toHaveBeenCalledWith(expect.objectContaining({ winnerTeamId: 10, loserTeamId: 11, actorUserId: 99, actorRole: 'organizer' }));
  });

  it('applyOrganizerForfeit: both short → double forfeit, nobody advances, both get a loss, next match gets a dead-slot bye', async () => {
    const m = match({ match_id: 1, team_a_id: 10, team_b_id: 11, next_match_id: 5 });
    // แมตช์ 5 มีทีม 12 รออยู่ และแมตช์ 1 (ต้นทาง) จบแล้ว → 12 บายผ่าน
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ match_id: 5, team_a_id: 12, team_b_id: null, next_match_id: null }));
    vi.mocked(WalkoverRepo.hasUnfinishedPredecessor).mockResolvedValue(false);

    const out = await Walkover.applyOrganizerForfeit(m, 3, 0, 11, 99);

    expect(out?.kind).toBe('double_forfeit');
    expect(WalkoverRepo.applyWalkover).toHaveBeenNthCalledWith(1, expect.objectContaining({
      winnerTeamId: null, loserTeamId: null, forfeitedTeamIds: [10, 11], reason: 'double_forfeit', actorRole: 'organizer',
    }));
    expect(out?.results).toEqual([
      { matchId: 1, winnerTeamId: null, loserTeamId: null },
      { matchId: 5, winnerTeamId: 12, loserTeamId: null },
    ]);
  });

  it('applyOrganizerForfeit: both teams present → null (referee should start the match instead)', async () => {
    expect(await Walkover.applyOrganizerForfeit(match(), 11, 11, 11, 99)).toBeNull();
    expect(WalkoverRepo.applyWalkover).not.toHaveBeenCalled();
  });
});

describe('dead match (both slots permanently empty)', () => {
  it('closes the match as completed without a result and lets the next round through', async () => {
    // แมตช์ 30 ว่างทั้งสองช่อง ต้นทางจบหมด → ปิด · แมตช์ 31 (ถัดไป) มีทีม 15 รออยู่ → บายผ่าน
    vi.mocked(MatchRepo.findById)
      .mockResolvedValueOnce(match({ match_id: 30, team_a_id: null, team_b_id: null, next_match_id: 31 }))
      .mockResolvedValueOnce(match({ match_id: 31, team_a_id: 15, team_b_id: null, next_match_id: null }));
    vi.mocked(WalkoverRepo.hasUnfinishedPredecessor).mockResolvedValue(false);

    const result = await Walkover.resolveIfOpponentWithdrawn(30);

    expect(WalkoverRepo.closeDeadMatch).toHaveBeenCalledWith(30, 0);
    expect(result).toEqual([
      { matchId: 30, winnerTeamId: null, loserTeamId: null },
      { matchId: 31, winnerTeamId: 15, loserTeamId: null },
    ]);
  });

  it('leaves an empty match alone while a source match is still unfinished', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ match_id: 30, team_a_id: null, team_b_id: null }));

    expect(await Walkover.resolveIfOpponentWithdrawn(30)).toEqual([]);
    expect(WalkoverRepo.closeDeadMatch).not.toHaveBeenCalled();
  });
});
