import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(), notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));
// OD-59 — S05 อ่านผ่าน findResultWithSubmitter (query ที่ join ชื่อผู้ส่ง) ไม่ใช่ findmatchResultByMatchId
// ผูกเป็น fn ตัวเดียวกัน เพื่อให้ mockResolvedValue ที่เทสเดิมตั้งไว้ยังคุมทั้งสองทาง
vi.mock('../../repositories/matchResult.repo.js', () => {
  const findmatchResultByMatchId = vi.fn();
  return { findmatchResultByMatchId, findResultWithSubmitter: findmatchResultByMatchId,
           findStandings: vi.fn(() => Promise.resolve([])) };
});
vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn(), findUnfinishedMatchIds: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../repositories/team.repo.js', () => ({ findTeamIdOfUserInMatch: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../walkover.service.js', () => ({}));
vi.mock('../../middlewares/requireReferee.js', () => ({ isRefereeOfMatch: vi.fn(() => Promise.resolve(false)), isTeamLeaderOfMatch: vi.fn(() => Promise.resolve(false)) }));
vi.mock('../../utils/checkExist.js', () => ({ checkMatch: vi.fn(), checkTournament: vi.fn(), checkTeam: vi.fn() }));

import * as Service from '../matchResult.service.js';
import * as ResRepo from '../../repositories/matchResult.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import { isRefereeOfMatch, isTeamLeaderOfMatch } from '../../middlewares/requireReferee.js';
import { checkMatch } from '../../utils/checkExist.js';

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
  vi.mocked(checkMatch).mockResolvedValue(match());
  vi.mocked(isRefereeOfMatch).mockReset().mockResolvedValue(false);
  vi.mocked(isTeamLeaderOfMatch).mockReset().mockResolvedValue(false);
  vi.mocked(TeamRepo.findTeamIdOfUserInMatch).mockReset().mockResolvedValue(null);
});

/**
 * FE-dispute-resolution-not-returned (มติ 27 ก.ย. ทางเลือก ก) — 6 ฟิลด์ข้อโต้แย้งบน S05
 * ★ S05 เป็น endpoint สาธารณะเมื่อผลเป็น verified/walkover แต่ S03b กันข้อมูลชุดเดียวกันไว้ที่
 *   ORG / กรรมการของแมตช์ / หัวหน้า 2 ทีม — ด่านต้องเหมือนกัน ไม่งั้นปิดประตูหน้าเปิดหลังบ้าน
 */
describe('getVerifiedResult — ใครเห็น 6 ฟิลด์ข้อโต้แย้ง', () => {
  const KEYS = ['disputeReason', 'disputeRaisedBy', 'disputeRaisedAt',
                'disputeResolution', 'disputeResolvedBy', 'disputeResolvedAt'];
  const disputedRow = (o: Record<string, unknown> = {}) => result({
    dispute_reason: 'ส่งผู้เล่นนอกใบสมัครลงแข่ง', dispute_raised_by: 4001,
    dispute_raised_at: new Date('2026-09-26T12:00:00Z'),
    dispute_resolution: 'ตรวจแล้วรายชื่อถูกต้อง', dispute_resolved_by: 9003,
    dispute_resolved_at: new Date('2026-09-26T18:00:00Z'), ...o,
  });

  beforeEach(() => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(disputedRow());
  });

  it('คนไม่ล็อกอิน: ได้ผลแข่งครบเหมือนเดิม แต่ไม่มี 6 ฟิลด์นี้เลย', async () => {
    const dto = await Service.getVerifiedResult(7) as Record<string, unknown>;
    expect(dto).toMatchObject({ matchId: 7, winnerTeamId: 11, status: 'verified' });
    for (const key of KEYS) expect(dto).not.toHaveProperty(key);
    expect(JSON.stringify(dto)).not.toContain('ส่งผู้เล่นนอกใบสมัคร');
  });

  it('คนล็อกอินที่ไม่เกี่ยวข้อง: ก็ยังไม่เห็น', async () => {
    const dto = await Service.getVerifiedResult(7, 55555) as Record<string, unknown>;
    for (const key of KEYS) expect(dto).not.toHaveProperty(key);
  });

  it('ผู้จัดของทัวร์: เห็นครบ', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 50, dispute_window_hours: 24, requested_by_user_id: 9003 } as never);
    const dto = await Service.getVerifiedResult(7, 9003) as Record<string, unknown>;
    expect(dto).toMatchObject({ disputeReason: 'ส่งผู้เล่นนอกใบสมัครลงแข่ง', disputeRaisedBy: 4001, disputeResolvedBy: 9003 });
  });

  it('กรรมการของแมตช์: เห็นครบ', async () => {
    vi.mocked(isRefereeOfMatch).mockResolvedValue(true);
    const dto = await Service.getVerifiedResult(7, 9002) as Record<string, unknown>;
    expect(dto).toHaveProperty('disputeReason', 'ส่งผู้เล่นนอกใบสมัครลงแข่ง');
  });

  it('หัวหน้าทีมในแมตช์: เห็นครบ — migration 020 บังคับให้ผู้จัดเขียนก็เพื่อคนกลุ่มนี้', async () => {
    vi.mocked(isTeamLeaderOfMatch).mockResolvedValue(true);
    const dto = await Service.getVerifiedResult(7, 4001) as Record<string, unknown>;
    expect(dto).toHaveProperty('disputeResolution', 'ตรวจแล้วรายชื่อถูกต้อง');
  });

  /**
   * มติ 30 ก.ย. 2569 (FE-dispute-ruling-hidden-from-players) — สองชั้นไม่เท่ากันแล้ว
   * ผู้เล่นในรายชื่อลงแข่งได้คำวินิจฉัย แต่ไม่ได้ตัวคำค้านที่อาจกล่าวหาเพื่อนร่วมทีมตัวเอง
   */
  const RULING = ['disputeResolution', 'disputeResolvedBy', 'disputeResolvedAt'];
  const COMPLAINT = ['disputeReason', 'disputeRaisedBy', 'disputeRaisedAt'];

  it('ผู้เล่นในรายชื่อลงแข่ง: ได้คำวินิจฉัย ไม่ได้ตัวคำค้าน', async () => {
    vi.mocked(TeamRepo.findTeamIdOfUserInMatch).mockResolvedValue({ teamId: 11 });
    const dto = await Service.getVerifiedResult(7, 7777) as Record<string, unknown>;

    for (const key of RULING) expect(dto).toHaveProperty(key);
    expect(dto).toHaveProperty('disputeResolution', 'ตรวจแล้วรายชื่อถูกต้อง');
    for (const key of COMPLAINT) expect(dto).not.toHaveProperty(key);
    // ข้อความของคู่กรณีและตัวตนคนค้านต้องไม่หลุดออกไปกับคำวินิจฉัย
    expect(JSON.stringify(dto)).not.toContain('ส่งผู้เล่นนอกใบสมัคร');
    expect(JSON.stringify(dto)).not.toContain('4001');
  });

  it('ผู้จัด/กรรมการ/หัวหน้า ไม่ต้องถูกถามซ้ำว่าอยู่ในรายชื่อไหม', async () => {
    vi.mocked(isTeamLeaderOfMatch).mockResolvedValue(true);
    await Service.getVerifiedResult(7, 4001);
    expect(TeamRepo.findTeamIdOfUserInMatch).not.toHaveBeenCalled();
  });

  it('คนนอกที่ไม่ได้อยู่ในรายชื่อ: ไม่ได้แม้คำวินิจฉัย', async () => {
    const dto = await Service.getVerifiedResult(7, 55555) as Record<string, unknown>;
    for (const key of [...RULING, ...COMPLAINT]) expect(dto).not.toHaveProperty(key);
  });

  // ผลที่ยังไม่ final ผ่านด่าน canSeeUnfinishedResult มาแล้ว จึงต้องได้เห็นโดยไม่ถามซ้ำ
  it('ผลที่ยัง disputed: คนที่อ่านได้ (ผ่านด่านบนแล้ว) เห็นเรื่องที่ค้านด้วย', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(disputedRow({ match_result_status: 'disputed', verified_at: null }));
    vi.mocked(isTeamLeaderOfMatch).mockResolvedValue(true);
    const dto = await Service.getVerifiedResult(7, 4001) as Record<string, unknown>;
    expect(dto).toHaveProperty('disputeReason', 'ส่งผู้เล่นนอกใบสมัครลงแข่ง');
  });
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
