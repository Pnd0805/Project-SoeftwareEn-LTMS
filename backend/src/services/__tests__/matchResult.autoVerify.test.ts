import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(), notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));
vi.mock('../../repositories/matchResult.repo.js', () => ({
  findmatchResultByMatchId: vi.fn(), verifyMatchResult: vi.fn(), findStandings: vi.fn(() => Promise.resolve([])),
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
import * as NotificationService from '../notification.service.js';
import { WIN_POINTS } from '../../config/scoring.js';

const NOW = new Date('2026-09-26T20:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600 * 1000);
const result = (o: Record<string, unknown> = {}) => ({
  match_result_id: 5, match_id: 7, winner_team_id: 11,
  match_result_status: 'submitted', submitted_role: 'referee', submitted_at: hoursAgo(25), ...o,
}) as never;
const match = (o: Record<string, unknown> = {}) =>
  ({ match_id: 7, tournament_id: 50, next_match_id: null, loser_next_match_id: null, scheduled_time: null, ...o }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(MatchRepo.findById).mockResolvedValue(match());
  vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(result());
});

/**
 * OD-26 ข้อ 7 (มติ 26 ก.ย.) — เงียบ = ยอมรับ แต่เฉพาะเมื่อผลมาจากคนกลาง
 * เส้นตาย = min(ก่อนแมตช์ถัดไปเริ่ม 15 นาที, 24 ชม.หลังส่งผล)
 */
describe('autoVerifyDue', () => {
  it('verifies a refereed result nobody touched for 24 hours, as the system (no user)', async () => {
    await expect(Service.autoVerifyDue([7])).resolves.toEqual([7]);
    expect(ResRepo.verifyMatchResult).toHaveBeenCalledWith(5, 7, null, WIN_POINTS);
    expect(NotificationService.notifyMatchResultParties).toHaveBeenCalledWith(7, expect.objectContaining({ type: 'result_auto_verified' }));
  });

  it('leaves it alone before the deadline', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(result({ submitted_at: hoursAgo(23) }));
    await expect(Service.autoVerifyDue([7])).resolves.toEqual([]);
    expect(ResRepo.verifyMatchResult).not.toHaveBeenCalled();
  });

  // ★ โหมด online หัวหน้าทีมเป็นคนส่ง = คู่กรณี ระบบต้องไม่รับรองคำอ้างที่ไม่มีคนกลางยืนยัน
  it('never touches a result a team leader submitted, however long it sits', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(result({ submitted_role: 'team_leader', submitted_at: hoursAgo(500) }));
    await expect(Service.autoVerifyDue([7])).resolves.toEqual([]);
    expect(ResRepo.verifyMatchResult).not.toHaveBeenCalled();
  });

  it.each(['disputed', 'verified', 'rejected', 'walkover'])('skips a result that is %s', async (status) => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(result({ match_result_status: status }));
    await expect(Service.autoVerifyDue([7])).resolves.toEqual([]);
  });

  // เส้นตายที่ใกล้กว่าชนะเสมอ — แมตช์ถัดไปใกล้เริ่มแล้ว ต้องยืนยันก่อนสายจะค้าง
  it('fires early when the next match is about to start, even well inside 24 hours', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(result({ submitted_at: hoursAgo(1) }));
    vi.mocked(MatchRepo.findById)
      .mockResolvedValueOnce(match({ next_match_id: 8 }))
      .mockResolvedValueOnce(match({ match_id: 8, scheduled_time: new Date(NOW.getTime() + 10 * 60 * 1000) }));   // อีก 10 นาที
    await expect(Service.autoVerifyDue([7])).resolves.toEqual([7]);
  });

  it('still waits when the next match is far away', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(result({ submitted_at: hoursAgo(1) }));
    vi.mocked(MatchRepo.findById)
      .mockResolvedValueOnce(match({ next_match_id: 8 }))
      .mockResolvedValueOnce(match({ match_id: 8, scheduled_time: new Date(NOW.getTime() + 3 * 3600 * 1000) }));
    await expect(Service.autoVerifyDue([7])).resolves.toEqual([]);
  });

  it('ignores matches with no result at all — that is the other ladder (item 6)', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(null);
    await expect(Service.autoVerifyDue([7])).resolves.toEqual([]);
  });
});
