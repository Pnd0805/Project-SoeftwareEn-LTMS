import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/match.repo.js', () => ({
  findMatchById: vi.fn(),
  markMatchFinished: vi.fn(() => Promise.resolve(true)),
  abandonMatch: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn() }));
vi.mock('../../middlewares/requireReferee.js', () => ({ isRefereeOfMatch: vi.fn(() => Promise.resolve(false)) }));
vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(), notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));
vi.mock('../../repositories/walkover.repo.js', () => ({}));
vi.mock('../walkover.service.js', () => ({}));
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
import * as NotificationService from '../notification.service.js';
import { isRefereeOfMatch } from '../../middlewares/requireReferee.js';

const ORG = 9003;
const REFEREE = 9002;
const END = new Date('2026-09-26T12:34:00Z');
const match = (o: Record<string, unknown> = {}) =>
  ({ match_id: 1, tournament_id: 50, match_status: 'in_progress', actual_end_time: null, ...o }) as never;

async function errOf(p: Promise<unknown>) {
  return p.then(() => null, (e: unknown) => e as { status: number; code: string; extra?: Record<string, unknown> });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
  vi.mocked(MatchRepo.markMatchFinished).mockResolvedValue(true);
  vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ requested_by_user_id: ORG, tournament_status: 'public' } as never);
  vi.mocked(isRefereeOfMatch).mockResolvedValue(false);
});

/**
 * OD-26 ข้อ 4 (มติ 26 ก.ย.) — ขั้น "จบการแข่งขัน" เป็นที่มาของเวลาจบจริง
 * ซึ่งเป็นฐานของทุกกฎที่นับเวลาหลังแมตช์จบ · Q4b: กรรมการหรือผู้จัดกดก็ได้
 */
describe('finishMatch (in_progress → finished)', () => {
  it('the match referee can finish it and gets the real end time back', async () => {
    vi.mocked(isRefereeOfMatch).mockResolvedValue(true);
    vi.mocked(MatchRepo.findMatchById).mockResolvedValueOnce(match()).mockResolvedValueOnce(match({ match_status: 'finished', actual_end_time: END }));

    await expect(MatchService.finishMatch(1, REFEREE)).resolves.toEqual({
      id: 1, status: 'finished', actualEndTime: '2026-09-26T12:34:00.000Z',
    });
    expect(MatchRepo.markMatchFinished).toHaveBeenCalledWith(1);
    expect(NotificationService.notifyMatchAudience).toHaveBeenCalledWith(1, expect.objectContaining({ type: 'match_finished' }));
  });

  // ผู้จัดกดแทนได้คือสิ่งที่ทำให้การ "บังคับกดจบ" ไม่กลายเป็นจุดค้างใหม่เมื่อกรรมการหายไป
  it('the organizer can finish it too', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValueOnce(match()).mockResolvedValueOnce(match({ actual_end_time: END }));
    await expect(MatchService.finishMatch(1, ORG)).resolves.toMatchObject({ status: 'finished' });
  });

  it('403 for anyone else', async () => {
    expect(await errOf(MatchService.finishMatch(1, 12345))).toMatchObject({ status: 403, code: 'NOT_MATCH_PARTICIPANT' });
    expect(MatchRepo.markMatchFinished).not.toHaveBeenCalled();
  });

  it.each(['scheduled', 'checkin_open', 'finished', 'completed', 'disputed'])('409 when the match is %s', async (status) => {
    vi.mocked(isRefereeOfMatch).mockResolvedValue(true);
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: status }));

    const err = await errOf(MatchService.finishMatch(1, REFEREE));
    expect(err).toMatchObject({ status: 409, code: 'MATCH_NOT_IN_PROGRESS' });
    expect(err!.extra).toEqual({ status });
    expect(MatchRepo.markMatchFinished).not.toHaveBeenCalled();
  });

  it('409 when two people press it at the same moment', async () => {
    vi.mocked(isRefereeOfMatch).mockResolvedValue(true);
    vi.mocked(MatchRepo.markMatchFinished).mockResolvedValue(false);   // อีกคนกดไปก่อนแล้ว
    expect(await errOf(MatchService.finishMatch(1, REFEREE))).toMatchObject({ status: 409, code: 'MATCH_NOT_IN_PROGRESS' });
    expect(NotificationService.notifyMatchAudience).not.toHaveBeenCalled();
  });

  it('404 when the match does not exist', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(null);
    expect(await errOf(MatchService.finishMatch(1, REFEREE))).toMatchObject({ status: 404, code: 'MATCH_NOT_FOUND' });
  });
});

/**
 * M10c (มติ 27 ก.ย.) — ฝนตกกลางแมตช์ ไฟดับ คนเจ็บหนัก
 * เดิม in_progress ออกได้ทางเดียวคือ "มีคนส่งผล" แต่เคสนี้ไม่มีผลให้ส่ง แมตช์จึงค้างถาวร
 */
describe('abandonMatch (in_progress → scheduled)', () => {
  it('sends the match back to scheduled so the organizer can re-date it, and tells everyone why', async () => {
    vi.mocked(isRefereeOfMatch).mockResolvedValue(true);

    await expect(MatchService.abandonMatch(1, REFEREE, 'ฝนตกหนัก สนามใช้ไม่ได้')).resolves.toEqual({
      id: 1, status: 'scheduled', checkinOpenAt: null,
    });
    expect(MatchRepo.abandonMatch).toHaveBeenCalledWith(1, REFEREE, 'ฝนตกหนัก สนามใช้ไม่ได้');
    expect(NotificationService.notifyMatchAudience).toHaveBeenCalledWith(1, expect.objectContaining({ type: 'match_abandoned' }));
  });

  it('the organizer can call it off too', async () => {
    await expect(MatchService.abandonMatch(1, ORG, 'ไฟดับทั้งอาคาร')).resolves.toMatchObject({ status: 'scheduled' });
  });

  it('403 for anyone else', async () => {
    expect(await errOf(MatchService.abandonMatch(1, 12345, 'x'))).toMatchObject({ status: 403, code: 'NOT_MATCH_PARTICIPANT' });
    expect(MatchRepo.abandonMatch).not.toHaveBeenCalled();
  });

  it.each(['scheduled', 'checkin_open', 'finished', 'completed'])('409 when the match is %s', async (status) => {
    vi.mocked(isRefereeOfMatch).mockResolvedValue(true);
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: status }));
    expect(await errOf(MatchService.abandonMatch(1, REFEREE, 'x'))).toMatchObject({ status: 409, code: 'MATCH_NOT_IN_PROGRESS' });
  });

  it('409 when someone else got there first', async () => {
    vi.mocked(isRefereeOfMatch).mockResolvedValue(true);
    vi.mocked(MatchRepo.abandonMatch).mockResolvedValue(false);
    expect(await errOf(MatchService.abandonMatch(1, REFEREE, 'x'))).toMatchObject({ status: 409, code: 'MATCH_NOT_IN_PROGRESS' });
    expect(NotificationService.notifyMatchAudience).not.toHaveBeenCalled();
  });
});

