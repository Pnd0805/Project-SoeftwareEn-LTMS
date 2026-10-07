import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/match.repo.js', () => ({
  findMatchById: vi.fn(),
  findById: vi.fn(),
  countSuccessfulCheckins: vi.fn(() => Promise.resolve(5)),
  markMatchStarted: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn() }));
vi.mock('../../repositories/walkover.repo.js', () => ({ findSportOfTournament: vi.fn(() => Promise.resolve({ min_members: 5 })) }));
vi.mock('../walkover.service.js', () => ({
  decideNoShow: vi.fn(() => null),
  applyNoShowWalkover: vi.fn(),
  closeCheckin: vi.fn(),
}));
vi.mock('../../middlewares/requireReferee.js', () => ({
  isRefereeOfMatch: vi.fn(() => Promise.resolve(true)),
  isRefereeSufficient: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(), notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));
vi.mock('../referee.service.js', () => ({ listMyRefereeMatches: vi.fn() }));
vi.mock('../../repositories/matchReferee.repo.js', () => ({}));
vi.mock('../../repositories/team.repo.js', () => ({}));
vi.mock('../../repositories/application.repo.js', () => ({}));
vi.mock('../../mappers/match.mapper.js', () => ({ toMatchDetailDto: vi.fn(), toMyMatchDto: vi.fn(), toCheckinDto: vi.fn(), toCheckinStatusApi: vi.fn(), toLineupDto: vi.fn() }));
vi.mock('../../utils/uploadKey.js', () => ({ buildCheckinPhotoKey: vi.fn() }));
vi.mock('../upload.service.js', () => ({ presignPut: vi.fn(), presignGet: vi.fn() }));

import * as MatchService from '../match.service.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as Walkover from '../walkover.service.js';
import { isRefereeSufficient } from '../../middlewares/requireReferee.js';

const REFEREE = 9002;
const START = new Date('2026-10-01T10:00:00Z');
const END = new Date('2026-10-01T11:30:00Z');

const match = (o: Record<string, unknown> = {}) => ({
  match_id: 1, tournament_id: 50, team_a_id: 11, team_b_id: 12, match_status: 'checkin_open',
  scheduled_time: START, scheduled_end_time: END, venue: 'สนาม A', ...o,
}) as never;

async function errOf(p: Promise<unknown>) {
  return p.then(() => null, (e: unknown) => e as { status: number; code: string; extra?: Record<string, unknown> });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
  vi.mocked(MatchRepo.findById).mockResolvedValue(match());
  vi.mocked(MatchRepo.markMatchStarted).mockResolvedValue(true);
  vi.mocked(MatchRepo.countSuccessfulCheckins).mockReset().mockResolvedValue(5);
  vi.mocked(isRefereeSufficient).mockReset().mockResolvedValue(true);
  vi.mocked(Walkover.decideNoShow).mockReset().mockReturnValue(null);
});

/**
 * FE-open-checkin-has-no-fixture-gate (มติ 27 ก.ย.) — ด่านที่ M10 เป็น "ตะแกรง"
 *
 * ด่านหลักอยู่ที่ M09 แต่มันกันได้แค่ทางเข้า · แมตช์ที่เปิดเช็คอินค้างไว้ตั้งแต่ก่อนกฎนี้มีผล
 * เลยด่านไปแล้วและยังกด start ได้ · เดิม startMatch มีด่าน 4 ชั้น (สถานะ · ทีมครบ · กรรมการครบ ·
 * เช็คอินถึงขั้นต่ำ) ไม่มีชั้นไหนดูเวลาหรือสนามเลย แมตช์จึงแข่งจนจบและปิดไปโดยไม่มีบันทึกว่า
 * แข่งเมื่อไรที่ไหน แล้วแก้ย้อนไม่ได้อีกเพราะ M06 รับแต่แมตช์ `scheduled`
 */
describe('startMatch — fixture gate (M10)', () => {
  it('starts a match that has a time and a venue', async () => {
    await expect(MatchService.startMatch(1, REFEREE)).resolves.toEqual({ id: 1, status: 'in_progress' });
  });

  it('409 MATCH_NOT_SCHEDULED listing every missing field', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ scheduled_time: null, scheduled_end_time: null, venue: null }));

    const err = await errOf(MatchService.startMatch(1, REFEREE));
    expect(err).toMatchObject({ status: 409, code: 'MATCH_NOT_SCHEDULED' });
    expect(err?.extra).toEqual({ missing: ['scheduledTime', 'scheduledEndTime', 'venue'] });
    expect(MatchRepo.markMatchStarted).not.toHaveBeenCalled();
  });

  it.each([
    ['scheduled_time', ['scheduledTime']],
    ['scheduled_end_time', ['scheduledEndTime']],
    ['venue', ['venue']],
  ])('409 when only %s is missing', async (field, missing) => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ [field]: null }));

    const err = await errOf(MatchService.startMatch(1, REFEREE));
    expect(err).toMatchObject({ code: 'MATCH_NOT_SCHEDULED' });
    expect(err?.extra).toEqual({ missing });
  });

  /**
   * ★ ลำดับสำคัญ: ด่านตารางต้องมาก่อนการตัดสินไม่มาตามนัด
   * ไม่งั้นทีมที่เช็คอินไม่ถึงขั้นต่ำจะถูกปรับแพ้บายในแมตช์ที่ไม่ควรเริ่มตั้งแต่ต้น — เสียสิทธิ์จากความผิดของผู้จัด
   */
  it('refuses before deciding a no-show, so nobody loses by walkover on a match that should not have started', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ venue: null }));
    vi.mocked(Walkover.decideNoShow).mockReturnValue({ winnerTeamId: 11, loserTeamId: 12 } as never);

    expect(await errOf(MatchService.startMatch(1, REFEREE))).toMatchObject({ code: 'MATCH_NOT_SCHEDULED' });
    expect(Walkover.decideNoShow).not.toHaveBeenCalled();
    expect(Walkover.applyNoShowWalkover).not.toHaveBeenCalled();
    expect(MatchRepo.countSuccessfulCheckins).not.toHaveBeenCalled();
  });

  // ด่านเดิมต้องยังทำงาน — ด่านใหม่ไม่ได้มาแทนอะไร
  it('still refuses a match that is not open for check-in, before looking at the fixture', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: 'scheduled', venue: null }));
    expect(await errOf(MatchService.startMatch(1, REFEREE))).toMatchObject({ code: 'CHECKIN_NOT_OPEN' });
  });

  it('still refuses when the match has no referees', async () => {
    vi.mocked(isRefereeSufficient).mockResolvedValue(false);
    expect(await errOf(MatchService.startMatch(1, REFEREE))).toMatchObject({ code: 'INSUFFICIENT_REFEREES' });
  });
});
