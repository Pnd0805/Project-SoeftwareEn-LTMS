import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../repositories/pickem.repo.js', () => ({
  PICKEM_POINTS: 10,
  upsert: vi.fn(),
  remove: vi.fn(),
  findMine: vi.fn(() => Promise.resolve(null)),
  countByTeam: vi.fn(() => Promise.resolve([])),
  findHistory: vi.fn(() => Promise.resolve([])),
  findLeaderboard: vi.fn(() => Promise.resolve([])),
  findTotalPoints: vi.fn(() => Promise.resolve(0)),
}));
vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn() }));
vi.mock('../../repositories/feedback.repo.js', () => ({ isTournamentInsider: vi.fn(() => Promise.resolve(false)) }));

import * as Service from '../pickem.service.js';
import * as PickemRepo from '../../repositories/pickem.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as FeedbackRepo from '../../repositories/feedback.repo.js';

const NOW = new Date('2026-10-01T00:00:00Z');
function match(overrides: Record<string, unknown> = {}) {
  return { match_id: 1, tournament_id: 20, match_status: 'scheduled', scheduled_time: new Date('2026-10-02T00:00:00Z'),
           team_a_id: 11, team_b_id: 12, ...overrides } as never;
}
async function errOf(p: Promise<unknown>) {
  return p.then(() => null, (e: unknown) => e as { status: number; code: string; extra?: unknown });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(MatchRepo.findById).mockResolvedValue(match());
  vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 20, requested_by_user_id: 7 } as never);
  vi.mocked(FeedbackRepo.isTournamentInsider).mockResolvedValue(false);
  vi.mocked(PickemRepo.findMine).mockResolvedValue(null);
  vi.mocked(PickemRepo.countByTeam).mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe('cutoffReason — มติ: เปิดเช็คอิน หรือถึงเวลาแข่ง อย่างไหนถึงก่อน', () => {
  it('open while scheduled, before the start time, both teams known', () => {
    expect(Service.cutoffReason(match(), NOW)).toBeNull();
  });
  it('closed once check-in opens (even if the time has not come)', () => {
    expect(Service.cutoffReason(match({ match_status: 'checkin_open' }), NOW)).toBe('checkin_open');
  });
  it.each(['in_progress', 'completed', 'disputed', 'result_rejected'])('closed when the match is %s', (status) => {
    expect(Service.cutoffReason(match({ match_status: status }), NOW)).toBe('match_started');
  });
  it('closed when the start time has come even if nobody opened check-in', () => {
    expect(Service.cutoffReason(match({ scheduled_time: new Date('2026-09-30T23:59:59Z') }), NOW)).toBe('time_passed');
  });
  it('open when no time is set yet', () => {
    expect(Service.cutoffReason(match({ scheduled_time: null }), NOW)).toBeNull();
  });
  it('not yet open while a side is still waiting for the previous round', () => {
    expect(Service.cutoffReason(match({ team_b_id: null }), NOW)).toBe('teams_not_set');
  });
});

describe('predict', () => {
  it('first pick → isNew · upsert', async () => {
    await expect(Service.predict(1, 50, 11)).resolves.toEqual({ isNew: true, matchId: 1, teamId: 11, changed: false });
    expect(PickemRepo.upsert).toHaveBeenCalledWith(50, 1, 11);
  });
  it('changing to the other team before cutoff → changed', async () => {
    vi.mocked(PickemRepo.findMine).mockResolvedValue({ predicted_winner_team_id: 12 } as never);
    await expect(Service.predict(1, 50, 11)).resolves.toMatchObject({ isNew: false, changed: true });
  });
  it('409 PICKEM_CLOSED after cutoff with the reason', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ match_status: 'checkin_open' }));
    expect(await errOf(Service.predict(1, 50, 11))).toMatchObject({ status: 409, code: 'PICKEM_CLOSED', extra: { reason: 'checkin_open' } });
    expect(PickemRepo.upsert).not.toHaveBeenCalled();
  });
  it('409 PICKEM_TEAMS_NOT_SET while waiting for the previous round', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ team_a_id: null }));
    expect(await errOf(Service.predict(1, 50, 12))).toMatchObject({ status: 409, code: 'PICKEM_TEAMS_NOT_SET' });
  });
  it('422 PICK_TEAM_NOT_IN_MATCH', async () => {
    expect(await errOf(Service.predict(1, 50, 99))).toMatchObject({ status: 422, code: 'PICK_TEAM_NOT_IN_MATCH' });
  });
  it('403 PICKEM_CONFLICT for anyone inside the tournament', async () => {
    vi.mocked(FeedbackRepo.isTournamentInsider).mockResolvedValue(true);
    expect(await errOf(Service.predict(1, 50, 11))).toMatchObject({ status: 403, code: 'PICKEM_CONFLICT' });
  });
  it('403 PICKEM_CONFLICT for the organizer', async () => {
    expect(await errOf(Service.predict(1, 7, 11))).toMatchObject({ status: 403, code: 'PICKEM_CONFLICT' });
  });
  it('404 MATCH_NOT_FOUND', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(null);
    expect(await errOf(Service.predict(1, 50, 11))).toMatchObject({ status: 404, code: 'MATCH_NOT_FOUND' });
  });
});

describe('cancelPrediction', () => {
  it('removes before cutoff', async () => {
    await Service.cancelPrediction(1, 50);
    expect(PickemRepo.remove).toHaveBeenCalledWith(50, 1);
  });
  it('409 after cutoff', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ match_status: 'in_progress' }));
    expect(await errOf(Service.cancelPrediction(1, 50))).toMatchObject({ status: 409, code: 'PICKEM_CLOSED' });
  });
});

describe('pickStatus', () => {
  it.each([
    [null, 'scheduled', 'pending'], [null, 'result_rejected', 'pending'], [null, 'completed', 'void'],
    [10, 'completed', 'won'], [0, 'completed', 'lost'],
  ] as const)('points %s on a %s match → %s', (points, status, expected) => {
    expect(Service.pickStatus({ points_earned: points }, status)).toBe(expected);
  });
});

describe('getSummary', () => {
  it('counts and percentages per team + mine + canPredict', async () => {
    vi.mocked(PickemRepo.countByTeam).mockResolvedValue([{ team_id: 11, picks: 3 }, { team_id: 12, picks: 1 }]);
    vi.mocked(PickemRepo.findMine).mockResolvedValue({ predicted_winner_team_id: 11, points_earned: null } as never);

    const result = await Service.getSummary(1, 50);

    expect(result).toMatchObject({
      isOpen: true, closedReason: null, total: 4,
      teams: [{ teamId: 11, picks: 3, percent: 75 }, { teamId: 12, picks: 1, percent: 25 }],
      mine: { teamId: 11, pointsEarned: null, status: 'pending' }, canPredict: true,
    });
  });
  it('percentages always add up to 100 (5:3 would round to 63+38)', async () => {
    vi.mocked(PickemRepo.countByTeam).mockResolvedValue([{ team_id: 11, picks: 5 }, { team_id: 12, picks: 3 }]);
    const { teams } = await Service.getSummary(1);
    expect(teams[0]!.percent + teams[1]!.percent).toBe(100);
  });
  it('insiders see canPredict false', async () => {
    vi.mocked(FeedbackRepo.isTournamentInsider).mockResolvedValue(true);
    expect((await Service.getSummary(1, 50)).canPredict).toBe(false);
  });
  it('no picks → percent 0 · anonymous → mine null', async () => {
    const result = await Service.getSummary(1);
    expect(result.teams.every(t => t.percent === 0)).toBe(true);
    expect(result.mine).toBeNull();
    expect(result.canPredict).toBe(false);
  });
});

describe('leaderboard', () => {
  it('ties share a rank (1,1,3)', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 20 } as never);
    vi.mocked(PickemRepo.findLeaderboard).mockResolvedValue([
      { user_id: 1, full_name: 'ก', profile_image_key: null, points: 20, correct: 2, settled: 2 },
      { user_id: 2, full_name: 'ข', profile_image_key: null, points: 20, correct: 2, settled: 3 },
      { user_id: 3, full_name: 'ค', profile_image_key: null, points: 10, correct: 1, settled: 1 },
    ]);
    const { items } = await Service.getLeaderboard(20);
    expect(items.map(i => i.rank)).toEqual([1, 1, 3]);
  });
  it('404 for an unknown tournament', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(null);
    expect(await errOf(Service.getLeaderboard(999))).toMatchObject({ status: 404 });
  });
});
