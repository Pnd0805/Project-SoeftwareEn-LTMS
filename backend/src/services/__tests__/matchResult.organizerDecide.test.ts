import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(), notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));
vi.mock('../../repositories/matchResult.repo.js', () => ({
  findmatchResultByMatchId: vi.fn(() => Promise.resolve(null)),
  organizerDecideMatch: vi.fn(() => Promise.resolve(true)),
  findStandings: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn(), findUnfinishedMatchIds: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../repositories/team.repo.js', () => ({}));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../walkover.service.js', () => ({ resolveIfOpponentWithdrawn: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../middlewares/requireReferee.js', () => ({ isRefereeOfMatch: vi.fn(), isTeamLeaderOfMatch: vi.fn() }));
vi.mock('../../utils/checkExist.js', () => ({ checkMatch: vi.fn(), checkTournament: vi.fn(), checkTeam: vi.fn() }));
vi.mock('../upload.service.js', () => ({ getPresignedDownloadUrl: vi.fn() }));

import * as Service from '../matchResult.service.js';
import * as ResRepo from '../../repositories/matchResult.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as Walkover from '../walkover.service.js';
import { WIN_POINTS } from '../../config/scoring.js';

const ORG = 9003;
const NOW = new Date('2026-09-27T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600 * 1000);
const match = (o: Record<string, unknown> = {}) => ({
  match_id: 7, tournament_id: 50, team_a_id: 11, team_b_id: 12,
  match_status: 'finished', actual_end_time: hoursAgo(25), next_match_id: null, loser_next_match_id: null, ...o,
}) as never;

async function errOf(p: Promise<unknown>) {
  return p.then(() => null, (e: unknown) => e as { status: number; code: string; extra?: Record<string, unknown> });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(MatchRepo.findById).mockResolvedValue(match());
  vi.mocked(ResRepo.findmatchResultByMatchId).mockReset().mockResolvedValue(null);
  vi.mocked(ResRepo.organizerDecideMatch).mockResolvedValue(true);
});

/**
 * OD-26 ข้อ 6 ขั้นสุดท้าย — วันนี้แมตช์ที่ไม่มีใครส่งผลไม่มีทางออกใด ๆ ในระบบเลย
 * ทางนี้จึงเป็นวาล์วนิรภัย ไม่ใช่ทางเดินปกติ — ต้องพ้นกำหนดและต้องไม่มีผลอยู่ก่อน
 */
describe('organizerDecideMatch', () => {
  it('records the organizer result and settles the bracket', async () => {
    await expect(Service.organizerDecideMatch(7, ORG, {
      outcome: 'result', reason: 'กรรมการส่งคลิปมาทางไลน์', winnerTeamId: 11, scoreData: { 11: 3, 12: 1 },
    })).resolves.toEqual({ matchId: 7, outcome: 'result', decidedBy: 'organizer' });

    expect(ResRepo.organizerDecideMatch).toHaveBeenCalledWith(
      expect.objectContaining({ match_id: 7 }), ORG, 'กรรมการส่งคลิปมาทางไลน์', WIN_POINTS,
      { kind: 'result', winnerId: 11, score: { 11: 3, 12: 1 } });
  });

  it('records a double forfeit and lets the dead-slot logic walk the bracket', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ next_match_id: 8 }));
    await expect(Service.organizerDecideMatch(7, ORG, { outcome: 'double_forfeit', reason: 'ไม่มีใครส่งผลและติดต่อกรรมการไม่ได้' }))
      .resolves.toMatchObject({ outcome: 'double_forfeit' });
    expect(Walkover.resolveIfOpponentWithdrawn).toHaveBeenCalledWith(8);
  });

  it('409 before the deadline, and says when it opens', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ actual_end_time: hoursAgo(2) }));
    const err = await errOf(Service.organizerDecideMatch(7, ORG, { outcome: 'double_forfeit', reason: 'x' }));
    expect(err).toMatchObject({ status: 409, code: 'ESCALATION_NOT_OPEN' });
    expect(err!.extra!['availableAt']).toBe('2026-09-28T10:00:00.000Z');   // จบ 10:00 วันนี้ + 24 ชม.
  });

  // ยังไม่กดจบการแข่งขัน = ไม่มีเวลาจบจริง = นาฬิกายังไม่เริ่ม
  it('409 when the match was never finished', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ match_status: 'in_progress', actual_end_time: null }));
    expect(await errOf(Service.organizerDecideMatch(7, ORG, { outcome: 'double_forfeit', reason: 'x' })))
      .toMatchObject({ status: 409, code: 'MATCH_NOT_FINISHED' });
  });

  it.each(['submitted', 'verified', 'disputed', 'walkover'])('409 when a result already exists (%s)', async (status) => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue({ match_result_status: status } as never);
    expect(await errOf(Service.organizerDecideMatch(7, ORG, { outcome: 'double_forfeit', reason: 'x' })))
      .toMatchObject({ status: 409, code: 'MATCH_RESULT_EXISTS' });
  });

  // ผลที่ถูก ORG ถอนไปแล้ว ถือว่าไม่มีผลที่ใช้ได้ — ตัดสินแทนได้
  it('allows deciding when the previous result was rejected', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue({ match_result_status: 'rejected' } as never);
    await expect(Service.organizerDecideMatch(7, ORG, { outcome: 'double_forfeit', reason: 'x' })).resolves.toBeTruthy();
  });

  it('rejects a score that does not match the two teams', async () => {
    expect(await errOf(Service.organizerDecideMatch(7, ORG, {
      outcome: 'result', reason: 'x', winnerTeamId: 11, scoreData: { 11: 1, 99: 0 },
    }))).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(ResRepo.organizerDecideMatch).not.toHaveBeenCalled();
  });
});
