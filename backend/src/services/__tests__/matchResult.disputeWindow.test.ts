import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(), notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));
vi.mock('../../repositories/matchResult.repo.js', () => ({ findmatchResultByMatchId: vi.fn(), findStandings: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn(), findUnfinishedMatchIds: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../repositories/team.repo.js', () => ({}));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../walkover.service.js', () => ({}));
vi.mock('../../middlewares/requireReferee.js', () => ({ isRefereeOfMatch: vi.fn(() => Promise.resolve(false)), isTeamLeaderOfMatch: vi.fn(() => Promise.resolve(false)) }));
vi.mock('../../utils/checkExist.js', () => ({ checkMatch: vi.fn(), checkTournament: vi.fn(), checkTeam: vi.fn() }));

import * as Service from '../matchResult.service.js';
import * as ResRepo from '../../repositories/matchResult.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';

const VERIFIED_AT = new Date('2026-09-26T10:00:00Z');
const result = (o: Record<string, unknown> = {}) => ({
  match_result_id: 1, match_id: 7, winner_team_id: 11, score_data: { 11: 3, 12: 1 },
  match_result_status: 'verified', verified_at: VERIFIED_AT, amended_at: null, amend_reason: null, ...o,
}) as never;
const match = (o: Record<string, unknown> = {}) =>
  ({ match_id: 7, tournament_id: 50, next_match_id: null, loser_next_match_id: null, ...o }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(MatchRepo.findById).mockResolvedValue(match());
  vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 50, dispute_window_hours: 24 } as never);
  // clearAllMocks ไม่ล้าง mockResolvedValue ของเทสต์ก่อน → ตั้งค่าเริ่มต้นใหม่ทุกครั้ง
  vi.mocked(TournamentRepo.findUnfinishedMatchIds).mockReset().mockResolvedValue([]);
});

/**
 * ข้อ 3 (มติ 25 ก.ย.) — เส้นตายการค้านต้องเป็นความจริง ไม่ใช่ 24 ชม.ลอย ๆ
 * และต้องบอกแยกว่า "ค้านแล้วแก้ผลได้จริงไหม" เพราะพ้นจุดนั้นไปแล้วกลายเป็นเรื่องร้องเรียน (ข้อ 8)
 */
describe('getVerifiedResult — dispute window', () => {
  it('verified result: closes dispute_window_hours after verification and is still changeable', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(result());
    await expect(Service.getVerifiedResult(7)).resolves.toMatchObject({
      disputeClosesAt: '2026-09-27T10:00:00.000Z', resultChangeable: true,
    });
  });

  it('follows the per-tournament window instead of assuming 24 hours', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 50, dispute_window_hours: 6 } as never);
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(result());
    await expect(Service.getVerifiedResult(7)).resolves.toMatchObject({ disputeClosesAt: '2026-09-26T16:00:00.000Z' });
  });

  it('resultChangeable turns false once the next match has left "scheduled"', async () => {
    vi.mocked(MatchRepo.findById)
      .mockResolvedValueOnce(match({ next_match_id: 8 }))
      .mockResolvedValueOnce(match({ match_id: 8, match_status: 'checkin_open' }));
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(result());
    await expect(Service.getVerifiedResult(7)).resolves.toMatchObject({ resultChangeable: false });
  });

  it('a walkover can never be disputed', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(result({ match_result_status: 'walkover' }));
    await expect(Service.getVerifiedResult(7)).resolves.toMatchObject({ disputeClosesAt: null, resultChangeable: false });
  });

  it('a submitted-but-unverified result has no deadline at all (BR-14 first window)', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(result({ match_result_status: 'submitted', verified_at: null }));
    vi.mocked(MatchRepo.findById).mockResolvedValue(match());
    await expect(Service.getVerifiedResult(7, 9001)).rejects.toBeTruthy();   // คนนอกยังไม่เห็นผลที่ยังไม่ verify
  });
});

// ข้อ 1 (มติ 26 ก.ย.) — round robin ทุกแมตช์ป้อนตารางเดียวกัน อันดับระหว่างทางจึงยังไม่เป็นทางการ
describe('getStandings — provisional flag', () => {
  it('flags the table while any match is unfinished and lists them', async () => {
    vi.mocked(TournamentRepo.findUnfinishedMatchIds).mockResolvedValue([
      { match_id: 12, match_status: 'disputed' }, { match_id: 15, match_status: 'in_progress' },
    ]);
    await expect(Service.getStandings(50)).resolves.toMatchObject({
      isProvisional: true,
      pendingMatches: [{ id: 12, status: 'disputed' }, { id: 15, status: 'in_progress' }],
    });
  });

  it('is final once nothing is left open', async () => {
    await expect(Service.getStandings(50)).resolves.toMatchObject({ isProvisional: false, pendingMatches: [] });
  });
});
