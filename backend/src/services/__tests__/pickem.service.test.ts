import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../repositories/pickem.repo.js', () => ({
  PICKEM_POINTS: 10,
  upsert: vi.fn(),
  remove: vi.fn(),
  findMine: vi.fn(() => Promise.resolve(null)),
  countByTeam: vi.fn(() => Promise.resolve([])),
  findHistory: vi.fn(() => Promise.resolve([])),
  findLeaderboard: vi.fn(() => Promise.resolve({ rows: [] , totalItems: 0 })),
  findTotalPoints: vi.fn(() => Promise.resolve(0)),
  findMyStanding: vi.fn(() => Promise.resolve(null)),
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
  vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 20, requested_by_user_id: 7, tournament_status: 'public' } as never);
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

/**
 * OD-56 (4 ต.ค.) — ทายเป็น **สกอร์** ผู้ชนะมาจากการอนุมาน ไม่ได้รับมาจาก request
 * ทีมในแมตช์ตัวอย่าง: team_a = 11 · team_b = 12
 */
const WIN_11 = { '11': 2, '12': 1 };   // ทายว่า 11 ชนะ
const WIN_12 = { '11': 1, '12': 2 };   // ทายว่า 12 ชนะ

describe('resolvePredictedWinner — อนุมานผู้ชนะจากสกอร์', () => {
  it('ฝั่งที่แต้มมากกว่าคือผู้ชนะที่ทาย', () => {
    expect(Service.resolvePredictedWinner(match(), WIN_11)).toBe(11);
    expect(Service.resolvePredictedWinner(match(), WIN_12)).toBe(12);
  });

  it('ไม่สนลำดับ key — ผลเหมือนกันทั้งสองแบบ', () => {
    expect(Service.resolvePredictedWinner(match(), { '12': 1, '11': 2 })).toBe(11);
  });

  it('ชนะ 3-0 ก็อนุมานได้ (คะแนน 0 ถูกต้องตามกติกา)', () => {
    expect(Service.resolvePredictedWinner(match(), { '11': 3, '12': 0 })).toBe(11);
  });

  // ★ ระบบไม่รองรับผลเสมอ (ensureScoreData บังคับผู้ชนะต้องแต้มมากกว่า) ⇒ ทายเสมอก็อนุมานไม่ได้
  it('422 PICK_SCORE_TIE เมื่อทายคะแนนเท่ากัน', () => {
    expect(() => Service.resolvePredictedWinner(match(), { '11': 2, '12': 2 }))
      .toThrowError(expect.objectContaining({ status: 422, code: 'PICK_SCORE_TIE' }));
  });

  it.each([
    ['ขาดทีมหนึ่ง', { '11': 2 }],
    ['มีทีมที่ไม่ได้ลงแมตช์นี้', { '11': 2, '99': 1 }],
    ['มีสาม key', { '11': 2, '12': 1, '99': 0 }],
    ['ว่าง', {}],
  ])('422 PICK_TEAM_NOT_IN_MATCH เมื่อ key %s', (_label, score) => {
    expect(() => Service.resolvePredictedWinner(match(), score as Record<string, number>))
      .toThrowError(expect.objectContaining({ status: 422, code: 'PICK_TEAM_NOT_IN_MATCH' }));
  });
});

describe('predict', () => {
  it('ทายครั้งแรก → isNew · เก็บทั้งผู้ชนะที่อนุมานและสกอร์', async () => {
    await expect(Service.predict(1, 50, WIN_11)).resolves.toEqual({
      isNew: true, matchId: 1, teamId: 11, scoreData: WIN_11, changed: false,
    });
    expect(PickemRepo.upsert).toHaveBeenCalledWith(50, 1, 11, WIN_11);
  });

  // ★ คง teamId ไว้ใน response ทั้งที่ request ไม่ส่งมาแล้ว — FE (feat/1) ใช้ type เดิมอยู่
  it('response ยังมี teamId = ผู้ชนะที่อนุมานได้', async () => {
    await expect(Service.predict(1, 50, WIN_12)).resolves.toMatchObject({ teamId: 12 });
  });

  it('เปลี่ยนฝั่งที่ทาย → changed', async () => {
    vi.mocked(PickemRepo.findMine).mockResolvedValue({ predicted_winner_team_id: 12, predicted_score_data: WIN_12 } as never);
    await expect(Service.predict(1, 50, WIN_11)).resolves.toMatchObject({ isNew: false, changed: true });
  });

  /**
   * ★ ของเดิมดูแค่ผู้ชนะ ⇒ "2-1 → 5-0" จะรายงานว่าไม่มีอะไรเปลี่ยน
   *   ซึ่งผิดตั้งแต่มีสกอร์ เพราะโบนัสสกอร์เป็นคนละเรื่องกันคนละก้อน
   */
  it('ฝั่งเดิมแต่เปลี่ยนสกอร์ → ยังนับว่า changed', async () => {
    vi.mocked(PickemRepo.findMine).mockResolvedValue({ predicted_winner_team_id: 11, predicted_score_data: { '11': 2, '12': 1 } } as never);
    await expect(Service.predict(1, 50, { '11': 5, '12': 0 })).resolves.toMatchObject({ isNew: false, changed: true });
  });

  it('ส่งสกอร์เดิมเป๊ะ → changed: false', async () => {
    vi.mocked(PickemRepo.findMine).mockResolvedValue({ predicted_winner_team_id: 11, predicted_score_data: { '11': 2, '12': 1 } } as never);
    await expect(Service.predict(1, 50, WIN_11)).resolves.toMatchObject({ isNew: false, changed: false });
  });

  // แถวเก่าก่อน migration 038 ไม่มีสกอร์ ⇒ ส่งสกอร์มาครั้งแรกถือว่าเปลี่ยน
  it('แถวเก่าที่ไม่มีสกอร์ (predicted_score_data = null) → changed', async () => {
    vi.mocked(PickemRepo.findMine).mockResolvedValue({ predicted_winner_team_id: 11, predicted_score_data: null } as never);
    await expect(Service.predict(1, 50, WIN_11)).resolves.toMatchObject({ isNew: false, changed: true });
  });

  it('409 PICKEM_CLOSED after cutoff with the reason', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ match_status: 'checkin_open' }));
    expect(await errOf(Service.predict(1, 50, WIN_11))).toMatchObject({ status: 409, code: 'PICKEM_CLOSED', extra: { reason: 'checkin_open' } });
    expect(PickemRepo.upsert).not.toHaveBeenCalled();
  });

  it('409 PICKEM_TEAMS_NOT_SET while waiting for the previous round', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ team_a_id: null }));
    expect(await errOf(Service.predict(1, 50, WIN_12))).toMatchObject({ status: 409, code: 'PICKEM_TEAMS_NOT_SET' });
  });

  it('422 PICK_TEAM_NOT_IN_MATCH เมื่อ key ไม่ใช่สองทีมของแมตช์นี้', async () => {
    expect(await errOf(Service.predict(1, 50, { '99': 2, '11': 1 }))).toMatchObject({ status: 422, code: 'PICK_TEAM_NOT_IN_MATCH' });
    expect(PickemRepo.upsert).not.toHaveBeenCalled();
  });

  it('422 PICK_SCORE_TIE เมื่อทายเสมอ — ไม่เขียนลงฐาน', async () => {
    expect(await errOf(Service.predict(1, 50, { '11': 2, '12': 2 }))).toMatchObject({ status: 422, code: 'PICK_SCORE_TIE' });
    expect(PickemRepo.upsert).not.toHaveBeenCalled();
  });

  /**
   * ★ ลำดับด่าน: ปิดทาย/ทีมไม่ครบ ต้องมาก่อนเรื่องสกอร์
   *   คนที่ยิงตอนปิดแล้วควรรู้ว่า "ปิดแล้ว" ไม่ใช่ได้ 422 เรื่องสกอร์แล้วไปแก้ฟอร์มเสียเวลา
   */
  it('บอกว่าปิดทายแล้วก่อนบ่นเรื่องสกอร์', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ match_status: 'checkin_open' }));
    expect(await errOf(Service.predict(1, 50, { '11': 2, '12': 2 }))).toMatchObject({ code: 'PICKEM_CLOSED' });
  });

  it('403 PICKEM_CONFLICT for anyone inside the tournament', async () => {
    vi.mocked(FeedbackRepo.isTournamentInsider).mockResolvedValue(true);
    expect(await errOf(Service.predict(1, 50, WIN_11))).toMatchObject({ status: 403, code: 'PICKEM_CONFLICT' });
  });

  it('403 PICKEM_CONFLICT for the organizer', async () => {
    expect(await errOf(Service.predict(1, 7, WIN_11))).toMatchObject({ status: 403, code: 'PICKEM_CONFLICT' });
  });

  it('404 MATCH_NOT_FOUND', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(null);
    expect(await errOf(Service.predict(1, 50, WIN_11))).toMatchObject({ status: 404, code: 'MATCH_NOT_FOUND' });
  });
});


describe('ทัวร์ที่ไม่ได้เปิดเผยแพร่ (มติ 22 ก.ย.)', () => {
  it.each(['private', 'pending_approval', 'rejected', 'auto_deleted'])('%s tournament → 409 TOURNAMENT_NOT_PUBLIC on predict and cancel', async (status) => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 20, requested_by_user_id: 7, tournament_status: status } as never);
    expect(await errOf(Service.predict(1, 50, WIN_11))).toMatchObject({ status: 409, code: 'TOURNAMENT_NOT_PUBLIC' });
    expect(await errOf(Service.cancelPrediction(1, 50))).toMatchObject({ status: 409, code: 'TOURNAMENT_NOT_PUBLIC' });
    expect(PickemRepo.upsert).not.toHaveBeenCalled();
    expect(PickemRepo.remove).not.toHaveBeenCalled();
  });
  it('summary: closedReason tournament_not_public · canPredict false', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 20, requested_by_user_id: 7, tournament_status: 'private' } as never);
    expect(await Service.getSummary(1, 50)).toMatchObject({ isOpen: false, closedReason: 'tournament_not_public', canPredict: false });
  });
  it('the match reason wins when the match itself is already closed', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 20, requested_by_user_id: 7, tournament_status: 'completed' } as never);
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ match_status: 'completed' }));
    expect((await Service.getSummary(1)).closedReason).toBe('match_started');
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

/**
 * B3 ① + ② (มติ 8 ต.ค. 2569) — แบ่งหน้า + จำผลไว้ 5 วินาที
 *
 * ★ สองเรื่องที่เทสชุดนี้ตรึงไว้ และ **เทสเดิมจับไม่ได้**
 *   1. อันดับต้องมาจาก SQL (คิดจากคนทั้งทัวร์) ไม่ใช่จากลำดับแถวในหน้านั้น
 *      ของเดิม service นับเองจาก index ⇒ ถ้าปล่อยไว้ หน้า 2 จะเริ่มนับ 1 ใหม่แบบเงียบ ๆ
 *   2. แคชต้องไม่ข้ามหน้า/ข้ามทัวร์กัน และต้องหมดอายุจริง
 */
describe('leaderboard — แบ่งหน้า + แคช 5 วิ', () => {
  const lbRow = (o: Record<string, unknown> = {}) =>
    ({ user_id: 1, full_name: 'ก', profile_image_key: null, points: 20, correct: 2, settled: 2, rank_no: 1, ...o });
  const repoReturns = (rows: Record<string, unknown>[], totalItems: number) =>
    vi.mocked(PickemRepo.findLeaderboard).mockResolvedValue({ rows: rows as never, totalItems });

  beforeEach(() => {
    Service.clearLeaderboardCache();
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 20 } as never);
  });

  it('เสมอได้อันดับเดียวกัน (1,1,3) — ค่าที่ SQL จัดมาถูกส่งต่อตรง ๆ', async () => {
    repoReturns([lbRow({ user_id: 1, rank_no: 1 }), lbRow({ user_id: 2, rank_no: 1, settled: 3 }),
                 lbRow({ user_id: 3, rank_no: 3, points: 10, correct: 1, settled: 1 })], 3);
    const { items } = await Service.getLeaderboard(20);
    expect(items.map(i => i.rank)).toEqual([1, 1, 3]);
  });

  /** 🔴 เคสที่จับ "นับอันดับจาก index" ได้ — ถ้าใครเขียนกลับไปแบบเดิม หน้า 2 จะได้ 1,1,3 */
  it('หน้า 2 ต้องคงอันดับของทั้งทัวร์ ไม่เริ่มนับ 1 ใหม่', async () => {
    repoReturns([lbRow({ user_id: 21, rank_no: 21 }), lbRow({ user_id: 22, rank_no: 21 }),
                 lbRow({ user_id: 23, rank_no: 23 })], 45);
    const { items } = await Service.getLeaderboard(20 , 20 , 2 , 20);
    expect(items.map(i => i.rank)).toEqual([21, 21, 23]);
  });

  it('ส่ง pagination ตามสัญญากลางของโปรเจกต์', async () => {
    repoReturns([lbRow()], 45);
    const { pagination } = await Service.getLeaderboard(20 , 20 , 2 , 20);
    expect(pagination).toEqual({ page: 2, pageSize: 20, totalItems: 45, totalPages: 3 });
  });

  it('ส่ง offset/pageSize ลง repo ตรงตามที่รับมา', async () => {
    repoReturns([], 0);
    await Service.getLeaderboard(20 , 40 , 3 , 20);
    expect(PickemRepo.findLeaderboard).toHaveBeenCalledWith(20 , 40 , 20);
  });

  it('404 for an unknown tournament', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(null);
    expect(await errOf(Service.getLeaderboard(999))).toMatchObject({ status: 404 });
  });

  it('เปิดซ้ำหน้าเดิมภายใน 5 วิ → ไม่ยิงฐานซ้ำ', async () => {
    repoReturns([lbRow()], 1);
    const first = await Service.getLeaderboard(20);
    vi.advanceTimersByTime(4_999);
    const second = await Service.getLeaderboard(20);
    expect(PickemRepo.findLeaderboard).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('พ้น 5 วิ → ยิงฐานใหม่', async () => {
    repoReturns([lbRow()], 1);
    await Service.getLeaderboard(20);
    vi.advanceTimersByTime(5_000);
    await Service.getLeaderboard(20);
    expect(PickemRepo.findLeaderboard).toHaveBeenCalledTimes(2);
  });

  it('คนละหน้า / คนละขนาดหน้า / คนละทัวร์ → คนละแคช', async () => {
    repoReturns([lbRow()], 1);
    await Service.getLeaderboard(20 , 0 , 1 , 20);
    await Service.getLeaderboard(20 , 20 , 2 , 20);
    await Service.getLeaderboard(20 , 0 , 1 , 50);
    await Service.getLeaderboard(21 , 0 , 1 , 20);
    expect(PickemRepo.findLeaderboard).toHaveBeenCalledTimes(4);
  });

  /** ★ ด่านทัวร์ต้องทำงานทุกครั้ง แม้ตอนได้ของจากแคช — ไม่งั้นทัวร์ที่ถูกลบจะยังคืนตารางอันดับต่ออีก 5 วิ */
  it('ตอนได้ของจากแคช ยังต้องเช็คว่าทัวร์มีอยู่', async () => {
    repoReturns([lbRow()], 1);
    await Service.getLeaderboard(20);
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(null);
    expect(await errOf(Service.getLeaderboard(20))).toMatchObject({ status: 404 });
  });
});

/**
 * E29 — แต้ม + อันดับของตัวเองในทัวร์เดียว (OD-51)
 * มีเพราะ E28 คืนมาทั้งทัวร์และไม่มี pagination ⇒ FE ที่อยากโชว์แค่ของตัวเองต้องโหลดทั้งก้อน
 */
describe('getMyStanding — แต้ม/อันดับของตัวเองในทัวร์', () => {
  it('ทัวร์ไม่มีจริง → 404 (ไม่ใช่คืนศูนย์เงียบ ๆ)', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(null);
    const err = await errOf(Service.getMyStanding(999, 5));
    expect(err).toMatchObject({ status: 404, code: 'TOURNAMENT_NOT_FOUND' });
  });

  it('มีแต้มแล้ว → ส่งต่อตามที่ repo ให้มา และเปลี่ยนชื่อ rank_no เป็น rank', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 20 } as never);
    vi.mocked(PickemRepo.findMyStanding).mockResolvedValue({ points: 40, correct: 4, settled: 6, rank_no: 3 });

    expect(await Service.getMyStanding(20, 5))
      .toEqual({ tournamentId: 20, points: 40, correct: 4, settled: 6, rank: 3 });
  });

  /**
   * ★ ยังไม่มีการทายที่ตัดสินแล้ว → แต้มเป็น 0 แต่ **rank ต้องเป็น null**
   * ถ้าส่ง rank เป็นเลขอะไรไปด้วย จะกลายเป็นโกหกว่าอยู่อันดับท้ายตาราง ทั้งที่ไม่ได้อยู่ในตารางเลย
   * (E28 ก็ไม่มีคนนี้ในลิสต์ เพราะกรอง points_earned IS NOT NULL)
   */
  it('ยังไม่มีการทายที่ตัดสินแล้ว → แต้ม 0 แต่ rank เป็น null ไม่ใช่เลขท้ายตาราง', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 20 } as never);
    vi.mocked(PickemRepo.findMyStanding).mockResolvedValue(null);

    expect(await Service.getMyStanding(20, 5))
      .toEqual({ tournamentId: 20, points: 0, correct: 0, settled: 0, rank: null });
  });

  it('ส่ง tournamentId กับ userId ให้ repo ครบและไม่สลับกัน', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 20 } as never);
    await Service.getMyStanding(20, 777);
    expect(PickemRepo.findMyStanding).toHaveBeenCalledWith(20, 777);
  });
});
