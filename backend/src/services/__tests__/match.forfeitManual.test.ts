import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * M17 (ORG ตัดสินทีมไม่มาตามนัด) และ M19 (กรรมการเช็คอินแทนผู้เล่น)
 * สองฟังก์ชันนี้เดิม **ไม่มีเทสเลยทั้งคู่** — เจอจากการไล่ตรวจ 6 ต.ค. 2569
 * ว่า error code ตัวไหนใน production ไม่เคยถูกเทสเรียกให้เด้ง
 *
 * ครอบ: TEAMS_PRESENT · ALREADY_CHECKED_IN (ทั้งสองจุดที่โยน)
 */

vi.mock('../../repositories/match.repo.js', () => ({
  findMatchById: vi.fn(),
  findById: vi.fn(),
  countSuccessfulCheckins: vi.fn(() => Promise.resolve(0)),
  findCheckinByMatchAndUser: vi.fn(() => Promise.resolve(null)),
  isRegisteredPlayerOfMatch: vi.fn(() => Promise.resolve(true)),
  reCheckin: vi.fn(() => Promise.resolve(true)),
  insertCheckin: vi.fn(() => Promise.resolve(1)),
}));
vi.mock('../../repositories/walkover.repo.js', () => ({
  findSportOfTournament: vi.fn(() => Promise.resolve({ min_members: 5 })),
}));
vi.mock('../walkover.service.js', () => ({
  applyOrganizerForfeit: vi.fn(),
  closeCheckin: vi.fn(),
}));
// ★ mapper ตัวนี้ต้องคืนค่าจริง เพราะ manualCheckin เอาผลไปใส่ response และใส่ใน extra ของ 409
vi.mock('../../mappers/match.mapper.js', () => ({
  toMatchDetailDto: vi.fn(), toMyMatchDto: vi.fn(), toCheckinDto: vi.fn(),
  toCheckinStatusApi: (s: string) => (s === 'exception' ? 'success_manual' : s),
  toLineupDto: vi.fn(),
}));
vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(), notifyTeamMembers: vi.fn(),
  notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));
// โมดูลที่ match.service import ตอนโหลด แต่เส้นทางที่เทสนี้เดินไม่ได้ใช้
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn() }));
vi.mock('../../repositories/team.repo.js', () => ({}));
vi.mock('../../repositories/application.repo.js', () => ({}));
vi.mock('../../repositories/matchReferee.repo.js', () => ({}));
vi.mock('../referee.service.js', () => ({ listMyRefereeMatches: vi.fn() }));
vi.mock('../../middlewares/requireReferee.js', () => ({ isRefereeOfMatch: vi.fn() }));
vi.mock('../../utils/uploadKey.js', () => ({ buildCheckinPhotoKey: vi.fn() }));
vi.mock('../upload.service.js', () => ({ presignPut: vi.fn(), presignGet: vi.fn() }));

import * as MatchService from '../match.service.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as WalkoverRepo from '../../repositories/walkover.repo.js';
import * as Walkover from '../walkover.service.js';

const ORG = 9003;
const REFEREE = 9002;
const PLAYER = 55;

const match = (o: Record<string, unknown> = {}) =>
  ({ match_id: 1, tournament_id: 50, match_status: 'checkin_open',
     team_a_id: 10, team_b_id: 20, ...o }) as never;

async function errOf(p: Promise<unknown>) {
  return p.then(() => null, (e: unknown) => e as { status: number; code: string; extra?: Record<string, unknown> });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
  vi.mocked(MatchRepo.findById).mockResolvedValue(match());
  vi.mocked(MatchRepo.countSuccessfulCheckins).mockResolvedValue(0);
  vi.mocked(MatchRepo.findCheckinByMatchAndUser).mockResolvedValue(null);
  vi.mocked(MatchRepo.isRegisteredPlayerOfMatch).mockResolvedValue(true);
  vi.mocked(MatchRepo.reCheckin).mockResolvedValue(true);
  vi.mocked(WalkoverRepo.findSportOfTournament).mockResolvedValue({ min_members: 5 } as never);
});

/**
 * ★ TEAMS_PRESENT เป็นเส้นแบ่งอำนาจ ไม่ใช่ validation:
 *   ถ้าทั้งสองทีมมาครบ แมตช์นั้นต้อง "แข่ง" และคนตัดสินผลคือกรรมการ (M10)
 *   ORG ไม่มีสิทธิ์ชี้ผลแมตช์ที่แข่งได้
 * 🔴 ถ้าด่านนี้เงียบ ORG จะตัดสินแพ้ชนะแมตช์ที่ทุกคนพร้อมแข่งได้ โดยไม่ต้องมีกรรมการ
 *   = ช่องโหว่เรื่องอำนาจ ไม่ใช่แค่ error message หาย
 */
describe('forfeitMatch (M17) — TEAMS_PRESENT', () => {
  it('ทั้งสองทีมเช็คอินครบขั้นต่ำ = 409 ให้กรรมการเริ่มแข่งแทน', async () => {
    vi.mocked(MatchRepo.countSuccessfulCheckins).mockResolvedValue(5);
    // walkover.service คืน null = "ไม่มีฝ่ายไหนควรแพ้บาย"
    vi.mocked(Walkover.applyOrganizerForfeit).mockResolvedValue(null as never);

    const err = await errOf(MatchService.forfeitMatch(1, ORG));

    expect(err).toMatchObject({ status: 409, code: 'TEAMS_PRESENT' });
    // บอกตัวเลขที่ใช้ตัดสินกลับไปด้วย ไม่ใช่ปฏิเสธเปล่า ๆ — FE เอาไปแสดงได้ว่าใครมาเท่าไร
    expect(err!.extra).toMatchObject({ minMembers: 5, checkedIn: { 10: 5, 20: 5 } });
  });

  it('มีฝ่ายที่มาไม่ครบ = ตัดสินได้ และคืนผลที่ walkover ตัดสิน', async () => {
    vi.mocked(MatchRepo.countSuccessfulCheckins).mockResolvedValueOnce(5).mockResolvedValueOnce(1);
    vi.mocked(Walkover.applyOrganizerForfeit).mockResolvedValue(
      { kind: 'one_side', results: [{ teamId: 20, reason: 'no_show' }] } as never);

    const out = await MatchService.forfeitMatch(1, ORG);

    expect(out).toMatchObject({ id: 1, status: 'completed', kind: 'one_side', minMembers: 5 });
    expect(out.checkedIn).toEqual({ 10: 5, 20: 1 });
  });

  /**
   * ★ ขั้นต่ำมาจากกีฬาของทัวร์ ถ้าหาไม่เจอให้ fallback 1 ไม่ใช่ 0
   *   เพราะ 0 จะทำให้ "ไม่มีใครมาเลย" ผ่านเกณฑ์ ⇒ ตัดสินไม่มาตามนัดไม่ได้อีกเลย
   */
  it('ทัวร์ที่หากีฬาไม่เจอ ใช้ขั้นต่ำ 1 คน', async () => {
    vi.mocked(WalkoverRepo.findSportOfTournament).mockResolvedValue(null as never);
    vi.mocked(Walkover.applyOrganizerForfeit).mockResolvedValue(null as never);

    const err = await errOf(MatchService.forfeitMatch(1, ORG));

    expect(err!.extra).toMatchObject({ minMembers: 1 });
  });
});

/**
 * ★ ALREADY_CHECKED_IN โยนจาก สองจุด ในฟังก์ชันเดียว และคนละความหมาย:
 *   จุดแรก  = มีแถวเช็คอินที่ยังไม่ถูกปฏิเสธอยู่แล้ว ⇒ ปฏิเสธตรง ๆ
 *   จุดสอง  = แถวเดิมถูก reject ไปแล้ว เลยพยายามเช็คอินทับ แต่ทับไม่ได้
 *             (มีคนทับไปก่อนระหว่างนั้น) ⇒ เป็นการชิงแถวกัน ไม่ใช่เคสปกติ
 * 🔴 ถ้าเทสครอบแค่จุดแรก การแก้ reCheckin ให้คืน false เงียบ ๆ จะไม่มีอะไรฟ้อง
 *   แล้วกรรมการจะเห็นว่า "เช็คอินสำเร็จ" ทั้งที่ฐานไม่ได้เปลี่ยน
 */
describe('manualCheckin (M19) — ALREADY_CHECKED_IN', () => {
  it('ผู้เล่นเช็คอินไปแล้ว = 409 พร้อมบอกสถานะปัจจุบัน และไม่เขียนทับ', async () => {
    vi.mocked(MatchRepo.findCheckinByMatchAndUser).mockResolvedValue(
      { match_checkin_id: 7, match_checkin_status: 'success' } as never);

    const err = await errOf(MatchService.manualCheckin(1, REFEREE, { userId: PLAYER } as never));

    expect(err).toMatchObject({ status: 409, code: 'ALREADY_CHECKED_IN' });
    expect(err!.extra).toMatchObject({ status: 'success' });
    expect(MatchRepo.reCheckin).not.toHaveBeenCalled();
    expect(MatchRepo.insertCheckin).not.toHaveBeenCalled();
  });

  it('แถวเดิมถูกปฏิเสธไว้ = เช็คอินทับแถวเดิมได้ ไม่สร้างแถวใหม่ (มติ 21 ก.ย. 2-ข)', async () => {
    vi.mocked(MatchRepo.findCheckinByMatchAndUser)
      .mockResolvedValueOnce({ match_checkin_id: 7, match_checkin_status: 'rejected' } as never)
      .mockResolvedValueOnce({ match_checkin_id: 7, match_checkin_status: 'exception', note: null, checked_in_at: null } as never);

    const out = await MatchService.manualCheckin(1, REFEREE, { userId: PLAYER, note: 'เน็ตล่ม' } as never);

    expect(MatchRepo.reCheckin).toHaveBeenCalledWith(7, expect.objectContaining({
      method: 'manual_by_referee', status: 'exception', verifiedByRefereeId: REFEREE, note: 'เน็ตล่ม',
    }));
    expect(MatchRepo.insertCheckin).not.toHaveBeenCalled();
    expect(out).toMatchObject({ id: 7, userId: PLAYER, status: 'success_manual' });
  });

  it('ทับแถวเดิมไม่สำเร็จ (มีคนชิงไปก่อน) = 409 เหมือนกัน ไม่ตอบว่าสำเร็จ', async () => {
    vi.mocked(MatchRepo.findCheckinByMatchAndUser).mockResolvedValue(
      { match_checkin_id: 7, match_checkin_status: 'rejected' } as never);
    vi.mocked(MatchRepo.reCheckin).mockResolvedValue(false);

    const err = await errOf(MatchService.manualCheckin(1, REFEREE, { userId: PLAYER } as never));

    expect(err).toMatchObject({ status: 409, code: 'ALREADY_CHECKED_IN' });
    expect(MatchRepo.insertCheckin).not.toHaveBeenCalled();
  });

  it('ยังไม่มีแถวเช็คอิน = สร้างใหม่', async () => {
    vi.mocked(MatchRepo.findCheckinByMatchAndUser)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ match_checkin_id: 9, match_checkin_status: 'exception', note: null, checked_in_at: null } as never);

    await MatchService.manualCheckin(1, REFEREE, { userId: PLAYER } as never);

    expect(MatchRepo.insertCheckin).toHaveBeenCalledWith(expect.objectContaining({ matchId: 1, userId: PLAYER }));
    expect(MatchRepo.reCheckin).not.toHaveBeenCalled();
  });
});
