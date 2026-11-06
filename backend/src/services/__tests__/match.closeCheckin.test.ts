import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/match.repo.js', () => ({
  findMatchById: vi.fn(),
  countCheckins: vi.fn(() => Promise.resolve(0)),
}));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn() }));
vi.mock('../../middlewares/requireReferee.js', () => ({ isRefereeOfMatch: vi.fn(() => Promise.resolve(false)) }));
vi.mock('../walkover.service.js', () => ({ closeCheckin: vi.fn(() => Promise.resolve(true)) }));
vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(), notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));
vi.mock('../../repositories/walkover.repo.js', () => ({}));
vi.mock('../referee.service.js', () => ({ listMyRefereeMatches: vi.fn() }));
vi.mock('../../repositories/matchReferee.repo.js', () => ({}));
vi.mock('../../repositories/team.repo.js', () => ({}));
vi.mock('../../repositories/application.repo.js', () => ({}));
vi.mock('../../mappers/match.mapper.js', () => ({ toMatchDetailDto: vi.fn(), toMyMatchDto: vi.fn(), toCheckinDto: vi.fn(), toCheckinStatusApi: vi.fn(), toLineupDto: vi.fn() }));
vi.mock('../../utils/uploadKey.js', () => ({ buildCheckinPhotoKey: vi.fn() }));
vi.mock('../upload.service.js', () => ({ presignPut: vi.fn(), presignGet: vi.fn() }));

import * as MatchService from '../match.service.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as Walkover from '../walkover.service.js';
import { isRefereeOfMatch } from '../../middlewares/requireReferee.js';

const ORG = 9003;
const REFEREE = 9002;
const STRANGER = 12345;
const match = (o: Record<string, unknown> = {}) =>
  ({ match_id: 1, tournament_id: 50, match_status: 'checkin_open', ...o }) as never;

async function errOf(p: Promise<unknown>) {
  return p.then(() => null, (e: unknown) => e as { status: number; code: string; extra?: Record<string, unknown> });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
  vi.mocked(MatchRepo.countCheckins).mockReset().mockResolvedValue(0);
  vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ requested_by_user_id: ORG, tournament_status: 'public' } as never);
  vi.mocked(isRefereeOfMatch).mockReset().mockResolvedValue(false);
  vi.mocked(Walkover.closeCheckin).mockReset().mockResolvedValue(true);
});

/**
 * M18 (มติ 27 ก.ย.) — ปิดเช็คอินคือการ "ถอน M09 กลับ" ไม่ใช่ขั้นถัดไป และมันลบเช็คอินทุกแถวทิ้ง
 * กรรมการจึงปิดได้เฉพาะตอนที่ยังไม่มีอะไรให้ทำลาย — ได้สิทธิ์ถอนความพลาดของตัวเอง
 * (เปิดผิดแมตช์ตอนคอร์ตติดกัน) โดยไม่ได้อำนาจล้างงานของผู้เล่นคนอื่น
 */
describe('closeCheckinMatch (M18)', () => {
  it('the organizer can close it even after players have checked in', async () => {
    vi.mocked(MatchRepo.countCheckins).mockResolvedValue(10);

    await expect(MatchService.closeCheckinMatch(1, ORG)).resolves.toEqual({
      id: 1, status: 'scheduled', checkinOpenAt: null,
    });
    expect(Walkover.closeCheckin).toHaveBeenCalledWith(1, ORG);
    // ผู้จัดไม่ต้องผ่านด่านนับ — ถามหรือไม่ถามก็ปิดได้อยู่ดี
  });

  it('the referee of the match can close it while nothing has been checked in', async () => {
    vi.mocked(isRefereeOfMatch).mockResolvedValue(true);

    await expect(MatchService.closeCheckinMatch(1, REFEREE)).resolves.toMatchObject({ status: 'scheduled' });
    expect(MatchRepo.countCheckins).toHaveBeenCalledWith(1);
    expect(Walkover.closeCheckin).toHaveBeenCalledWith(1, REFEREE);
  });

  // ปุ่มนี้ลบ match_checkins ทุกแถว การให้กรรมการล้างงานของผู้เล่น 10 คนไม่ใช่ "ถอนความพลาดของตัวเอง"
  it('refuses the referee once even one player has checked in, and says how many', async () => {
    vi.mocked(isRefereeOfMatch).mockResolvedValue(true);
    vi.mocked(MatchRepo.countCheckins).mockResolvedValue(1);

    const err = await errOf(MatchService.closeCheckinMatch(1, REFEREE));
    expect(err).toMatchObject({ status: 409, code: 'CHECKIN_NOT_EMPTY' });
    expect(err?.extra).toEqual({ checkins: 1 });
    expect(Walkover.closeCheckin).not.toHaveBeenCalled();
  });

  it('403 for a tournament referee who is not on this match, and for a stranger', async () => {
    expect(await errOf(MatchService.closeCheckinMatch(1, REFEREE))).toMatchObject({ status: 403, code: 'NOT_MATCH_PARTICIPANT' });
    expect(await errOf(MatchService.closeCheckinMatch(1, STRANGER))).toMatchObject({ status: 403, code: 'NOT_MATCH_PARTICIPANT' });
    expect(Walkover.closeCheckin).not.toHaveBeenCalled();
  });

  it('404 for a match that does not exist', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(null as never);
    expect(await errOf(MatchService.closeCheckinMatch(1, ORG))).toMatchObject({ status: 404, code: 'MATCH_NOT_FOUND' });
  });

  it('409 when the match is no longer open for check-in', async () => {
    vi.mocked(Walkover.closeCheckin).mockResolvedValue(false);
    expect(await errOf(MatchService.closeCheckinMatch(1, ORG))).toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
  });

  // ผู้ยื่นคำขอที่ทัวร์ยังไม่อนุมัติยังไม่ถือเป็นผู้จัด (findMatchRoles) — ต้องไม่หลุดผ่านด่าน
  it('refuses the requester of a tournament that is still pending approval', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ requested_by_user_id: ORG, tournament_status: 'pending_approval' } as never);
    expect(await errOf(MatchService.closeCheckinMatch(1, ORG))).toMatchObject({ status: 403, code: 'NOT_MATCH_PARTICIPANT' });
  });
});
