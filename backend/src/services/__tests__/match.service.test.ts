import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(),
  notifyUsers: vi.fn(),
  notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(),
  notifyTournamentReferees: vi.fn(),
  notifyMatchResultParties: vi.fn(),
}));

vi.mock('../../repositories/match.repo.js', () => ({
  findMatchById: vi.fn(),
  findById: vi.fn(),
  findConflictingMatch: vi.fn(),
  findPredecessors: vi.fn(() => Promise.resolve([])),
  findUnresolvedPredecessors: vi.fn(() => Promise.resolve([])),
  updateMatchSchedule: vi.fn(),
  openMatchCheckin: vi.fn(),
  findCheckinById: vi.fn(),
  verifyCheckin: vi.fn(),
  rejectCheckin: vi.fn(),
  findCheckinsByMatch: vi.fn(),
  findCheckinByMatchAndUser: vi.fn(),
  isRegisteredPlayerOfMatch: vi.fn(),
  insertCheckin: vi.fn(),
  reCheckin: vi.fn(),
  updateRoomCode: vi.fn(() => Promise.resolve(true)),
  findMatchesOfPlayer: vi.fn(() => Promise.resolve([])),
  findLineupsByMatch: vi.fn(),
}));
// autoVerifyDue แตะฐานข้อมูลจริง — mock ไว้ให้เทสนี้เป็น unit test ล้วน (มีเทสของมันเองแยกต่างหาก)
vi.mock('../matchResult.service.js', () => ({ autoVerifyDue: vi.fn(() => Promise.resolve([])) }));
vi.mock('../referee.service.js', () => ({
  listMyRefereeMatches: vi.fn(() => Promise.resolve({ items: [] })),
}));

vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(),
}));

vi.mock('../../middlewares/requireReferee.js', () => ({
  isRefereeOfMatch: vi.fn(),
  // BE-16 — ค่าเริ่มต้น "กรรมการครบ" เพื่อให้เทสเก่าที่ไม่ได้พูดเรื่องกรรมการยังทดสอบเรื่องของตัวเอง
  isRefereeSufficient: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../upload.service.js', () => ({
  getPresignedDownloadUrl: vi.fn((key: string) => Promise.resolve(`https://s3/${key}?signed`)),
}));

vi.mock('../../mappers/match.mapper.js', () => ({
  toMatchDetailDto: vi.fn((row: unknown) => row),
  toMatchListItemDto: vi.fn(),
  toCheckinListItemDto: vi.fn((row: Record<string, unknown>, documentUrl: string | null) => ({ id: row['match_checkin_id'], documentUrl })),
  toCheckinStatusApi: vi.fn((s: string) => s),
  toLineupPlayerDto: vi.fn((row: Record<string, unknown>) => ({ userId: row['user_id'], checkinStatus: row['match_checkin_status'] })),
}));

vi.mock('../../utils/checkinQr.js', () => ({
  signCheckinQr: vi.fn(() => ({ qrPayload: 'qr', expiresAt: new Date(0) })),
  verifyCheckinQr: vi.fn(),
}));
// 🔴 OD-58 (4 ต.ค.) — canSeeUnfinishedResult() ถาม AdminRepo ด้วยแล้ว (แอดมินที่ถึงคิวตัดสินต้องอ่านได้)
// ถ้าไม่ mock ที่นี่ เทสจะไปต่อฐานจริง แล้ว "ผ่าน" เฉพาะตอนที่เครื่องมี MySQL รันอยู่
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn(() => Promise.resolve(null)) }));

import * as matchService from '../match.service.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import { isRefereeOfMatch, isRefereeSufficient } from '../../middlewares/requireReferee.js';
import { getPresignedDownloadUrl } from '../upload.service.js';
import { AppError } from '../../utils/AppError.js';
import * as NotificationService from '../notification.service.js';

const START = '2026-10-01T10:00:00.000Z';
const END = '2026-10-01T11:30:00.000Z';

function match(overrides: Record<string, unknown> = {}) {
  return { match_id: 1, tournament_id: 50, team_a_id: 11, team_b_id: 12, match_status: 'scheduled', mode: 'onsite', checkin_open_at: null, next_match_id: null, ...overrides } as never;
}

function checkin(overrides: Record<string, unknown> = {}) {
  return { match_checkin_id: 7, match_id: 1, match_checkin_status: 'pending', ...overrides } as never;
}

const organizerTournament = { requested_by_user_id: 9003, tournament_status: 'public' } as never;

async function expectAppError(promise: Promise<unknown>, status: number, code: string) {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
  expect((err as AppError).code).toBe(code);
  return err as AppError;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(TournamentRepo.findTournamentById).mockReset();   // clearAllMocks ไม่ล้าง mockResolvedValue
  vi.mocked(MatchRepo.findPredecessors).mockResolvedValue([]);
});

describe('scheduleMatch (M06)', () => {
  it('saves start, end and venue when the match is scheduled and nothing overlaps', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
    vi.mocked(MatchRepo.findConflictingMatch).mockResolvedValue(null);

    await matchService.scheduleMatch(1, { scheduledTime: START, scheduledEndTime: END, venue: 'สนาม A' });

    expect(MatchRepo.findConflictingMatch).toHaveBeenCalledWith(1, new Date(START), new Date(END), 'สนาม A', 11, 12);
    expect(MatchRepo.updateMatchSchedule).toHaveBeenCalledWith(1, new Date(START), new Date(END), 'สนาม A');
    // C1-ข — แจ้งผู้เล่นในรายชื่อ + กรรมการ
    expect(NotificationService.notifyMatchAudience).toHaveBeenCalledWith(1, expect.objectContaining({
      type: 'match_scheduled', relatedEntityType: 'match', relatedEntityId: 1,
      message: expect.stringContaining('สนาม A'),
    }));
  });

  it('re-saving the same time and venue does not notify anyone', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ scheduled_time: new Date(START), scheduled_end_time: new Date(END), venue: 'สนาม A' }));
    vi.mocked(MatchRepo.findConflictingMatch).mockResolvedValue(null);
    await matchService.scheduleMatch(1, { scheduledTime: START, scheduledEndTime: END, venue: 'สนาม A' });
    expect(NotificationService.notifyMatchAudience).not.toHaveBeenCalled();
  });

  it('venue-only change is announced as a venue change, not a reschedule', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ scheduled_time: new Date(START), scheduled_end_time: new Date(END), venue: 'สนาม A' }));
    vi.mocked(MatchRepo.findConflictingMatch).mockResolvedValue(null);
    await matchService.scheduleMatch(1, { venue: 'สนาม B' });
    expect(NotificationService.notifyMatchAudience).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'แมตช์เปลี่ยนสนาม' }));
  });

  it('does not notify anyone when the schedule is refused', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
    vi.mocked(MatchRepo.findConflictingMatch).mockResolvedValue({ match_id: 99 });

    await matchService.scheduleMatch(1, { scheduledTime: START, scheduledEndTime: END, venue: 'สนาม A' }).catch(() => undefined);

    expect(NotificationService.notifyMatchAudience).not.toHaveBeenCalled();
  });

  it('returns 409 SCHEDULE_CONFLICT with conflictingMatchId when a team or venue overlaps', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
    vi.mocked(MatchRepo.findConflictingMatch).mockResolvedValue({ match_id: 99 });

    const err = await expectAppError(matchService.scheduleMatch(1, { scheduledTime: START, scheduledEndTime: END, venue: 'สนาม A' }), 409, 'SCHEDULE_CONFLICT');
    expect(err.extra).toEqual({ conflictingMatchId: 99 });
    expect(MatchRepo.updateMatchSchedule).not.toHaveBeenCalled();
  });

  it('B9: venue-only update keeps the existing start/end', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ scheduled_time: new Date(START), scheduled_end_time: new Date(END), venue: 'สนาม A' }));
    vi.mocked(MatchRepo.findConflictingMatch).mockResolvedValue(null);

    await matchService.scheduleMatch(1, { venue: 'สนาม B' });

    expect(MatchRepo.updateMatchSchedule).toHaveBeenCalledWith(1, new Date(START), new Date(END), 'สนาม B');
  });

  it('B9: first-time schedule with only a venue → 400 SCHEDULE_INCOMPLETE listing the missing fields', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ scheduled_time: null, scheduled_end_time: null, venue: null }));

    const err = await expectAppError(matchService.scheduleMatch(1, { venue: 'สนาม B' }), 400, 'SCHEDULE_INCOMPLETE');
    expect(err.extra).toEqual({ missing: ['scheduledTime', 'scheduledEndTime'] });
    expect(MatchRepo.updateMatchSchedule).not.toHaveBeenCalled();
  });

  it('B9: moving only the start past the stored end → 400', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ scheduled_time: new Date(START), scheduled_end_time: new Date(END), venue: 'สนาม A' }));

    await expectAppError(matchService.scheduleMatch(1, { scheduledTime: '2026-10-01T23:00:00.000Z' }), 400, 'VALIDATION_FAILED');
  });

  it.each(['checkin_open', 'in_progress', 'completed'])('refuses to reschedule a %s match with MATCH_NOT_CHANGEABLE', async (status) => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: status }));

    await expectAppError(matchService.scheduleMatch(1, { scheduledTime: START, scheduledEndTime: END, venue: 'สนาม A' }), 409, 'MATCH_NOT_CHANGEABLE');
    expect(MatchRepo.findConflictingMatch).not.toHaveBeenCalled();
    expect(MatchRepo.updateMatchSchedule).not.toHaveBeenCalled();
  });

  // กฎเพิ่มจาก BE_KN (GUIDE/11 §4.1) — ในวันทัวร์ + ไม่พังลำดับสาย
  it('returns 409 OUTSIDE_TOURNAMENT_DATES when the slot falls outside the tournament days', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ event_start_date: '2026-10-03', event_end_date: '2026-10-04' } as never);

    const err = await expectAppError(matchService.scheduleMatch(1, { scheduledTime: START, scheduledEndTime: END, venue: 'สนาม A' }), 409, 'OUTSIDE_TOURNAMENT_DATES');
    expect(err.extra).toEqual({ eventStartDate: '2026-10-03', eventEndDate: '2026-10-04' });
    expect(MatchRepo.updateMatchSchedule).not.toHaveBeenCalled();
  });

  it('returns 409 SCHEDULE_BREAKS_BRACKET when a previous-round match ends after the new start', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
    vi.mocked(MatchRepo.findConflictingMatch).mockResolvedValue(null);
    vi.mocked(MatchRepo.findPredecessors).mockResolvedValue([
      { match_id: 3, scheduled_time: new Date('2026-10-01T09:00:00.000Z'), scheduled_end_time: new Date('2026-10-01T10:30:00.000Z') },
    ]);

    const err = await expectAppError(matchService.scheduleMatch(1, { scheduledTime: START, scheduledEndTime: END, venue: 'สนาม A' }), 409, 'SCHEDULE_BREAKS_BRACKET');
    expect(err.extra).toEqual({ blockingMatchId: 3 });
  });

  it('returns 409 SCHEDULE_BREAKS_BRACKET when the next-round match starts before the new end', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ next_match_id: 8 }));
    vi.mocked(MatchRepo.findConflictingMatch).mockResolvedValue(null);
    vi.mocked(MatchRepo.findById).mockResolvedValue({ match_id: 8, scheduled_time: new Date('2026-10-01T11:00:00.000Z') } as never);

    const err = await expectAppError(matchService.scheduleMatch(1, { scheduledTime: START, scheduledEndTime: END, venue: 'สนาม A' }), 409, 'SCHEDULE_BREAKS_BRACKET');
    expect(err.extra).toEqual({ blockingMatchId: 8 });
  });
});

describe('openCheckinMatch (M09)', () => {
  const ORG = 9003;         // = organizerTournament.requested_by_user_id
  const REF = 9002;
  // แมตช์ที่ตารางครบ — ด่าน fixture (มติ 27 ก.ย.) กันแมตช์ที่ยังไม่มีเวลา/สนามไว้ก่อนทุกด่านอื่น
  const scheduled = (o: Record<string, unknown> = {}) =>
    match({ scheduled_time: new Date(START), scheduled_end_time: new Date(END), venue: 'สนาม A', ...o });
  /**
   * 🔴 ตรึงเวลาเมื่อ 7 ต.ค. 2569 (BE-04) — เพิ่มด่าน "เปิดเช็คอินได้เฉพาะใกล้เวลานัด"
   *   เทสชุดนี้ใช้เวลานัดคงที่ (START = 2026-10-01) ซึ่งเป็นอดีตไปแล้วตอนรันจริง
   *   ⇒ ถ้าไม่ตรึงเวลา ทุกเทสในบล็อกนี้จะได้ TOO_LATE_FOR_MATCH แทนเรื่องที่มันทดสอบ
   * ★ 09:45 = 15 นาทีก่อนเวลานัด ⇒ อยู่ในหน้าต่าง 60 นาที และเป็นเวลากลาง ๆ ที่ไม่ติดขอบ
   *   (เคสขอบมีเทสของตัวเองข้างล่าง)
   */
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T09:45:00.000Z'));
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(organizerTournament);
    vi.mocked(isRefereeOfMatch).mockReset().mockResolvedValue(false);
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(scheduled());
    // BE-16 — ด่านกรรมการอ่านแถวเต็มผ่าน findById · ค่าเริ่มต้น = ครบ (ดู mock ของ isRefereeSufficient)
    vi.mocked(MatchRepo.findById).mockResolvedValue(scheduled() as never);
    vi.mocked(isRefereeSufficient).mockReset().mockResolvedValue(true);
  });
  afterEach(() => { vi.useRealTimers(); });

  /**
   * 🆕 BE-16 (7 ต.ค. 2569 · มติ ④) — เปิดเช็คอินได้ทั้งที่แมตช์ยังไม่มีกรรมการ → ล็อกตาย
   *
   * เส้นทางที่ QA เดิน: เปิดเช็คอิน 200 → กรรมการกดรับ 409 REQUEST_NO_LONGER_VALID
   * → ส่งคำขอใหม่ 409 MATCH_NOT_CHANGEABLE → กดเริ่ม 409 INSUFFICIENT_REFEREES
   * ⇒ ปิดที่ทางเข้า ไม่ผ่อนด่านเปลี่ยนกรรมการ (มติ: ถึงช่วงเช็คอินกรรมการควรอยู่หน้างานแล้ว)
   */
  it('กรรมการยังไม่ครบ → 409 INSUFFICIENT_REFEREES · ไม่เปิด ไม่แจ้งเตือน', async () => {
    vi.mocked(isRefereeSufficient).mockResolvedValue(false);

    await expectAppError(matchService.openCheckinMatch(1, ORG), 409, 'INSUFFICIENT_REFEREES');
    expect(MatchRepo.openMatchCheckin).not.toHaveBeenCalled();
    // ★ แจ้งเตือนเรียกคืนไม่ได้ — ผู้เล่นต้องไม่ได้ข่าวของแมตช์ที่ยังเริ่มไม่ได้
    expect(NotificationService.notifyMatchAudience).not.toHaveBeenCalled();
  });

  /** ★ กรรมการของแมตช์ก็เปิดเช็คอินได้ (มติ 27 ก.ย.) ⇒ ด่านนี้ต้องใช้กับเขาด้วย ไม่ใช่แค่ผู้จัด */
  it('กรรมการเปิดเอง แต่กรรมการยังไม่ครบ → 409 เหมือนกัน', async () => {
    vi.mocked(isRefereeOfMatch).mockResolvedValue(true);
    vi.mocked(isRefereeSufficient).mockResolvedValue(false);

    await expectAppError(matchService.openCheckinMatch(1, REF), 409, 'INSUFFICIENT_REFEREES');
  });

  /**
   * FE-open-checkin-has-no-fixture-gate — แมตช์ที่ `createBracket` สร้างมาไม่มีเวลาและสนาม
   * และไม่มีจุดไหนบังคับให้ผู้จัดกรอก · เดิมเปิดเช็คอินได้เลย แล้วพอพ้น `scheduled` ก็แก้ย้อนไม่ได้อีก
   * เกิดขึ้นจริงในฐาน dev: แมตช์ 10/11/12 `completed` โดยเวลาและสนามเป็น NULL
   */
  it('409 SCHEDULE_INCOMPLETE listing exactly what is missing, before anything else happens', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ scheduled_time: null, scheduled_end_time: null, venue: null }));

    const err = await expectAppError(matchService.openCheckinMatch(1, ORG), 409, 'SCHEDULE_INCOMPLETE');
    expect(err.extra).toEqual({ missing: ['scheduledTime', 'scheduledEndTime', 'venue'] });
    expect(MatchRepo.openMatchCheckin).not.toHaveBeenCalled();
    // แจ้งเตือนเรียกคืนไม่ได้ — ผู้เล่นต้องไม่ได้ "เปิดเช็คอินแล้ว" ของแมตช์ที่ไม่มีเวลา
    expect(NotificationService.notifyMatchAudience).not.toHaveBeenCalled();
  });

  // ด่านนี้ใช้กับกรรมการด้วย ไม่ใช่แค่ผู้จัด (สิทธิ์ตรวจก่อน ตารางตรวจหลัง)
  it('409 SCHEDULE_INCOMPLETE naming only the one field that is missing', async () => {
    vi.mocked(isRefereeOfMatch).mockResolvedValue(true);
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(scheduled({ venue: null }));

    const err = await expectAppError(matchService.openCheckinMatch(1, REF), 409, 'SCHEDULE_INCOMPLETE');
    expect(err.extra).toEqual({ missing: ['venue'] });
  });

  it('returns INVALID_STATUS_TRANSITION when the match is no longer scheduled', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(scheduled({ match_status: 'in_progress' }));
    vi.mocked(MatchRepo.openMatchCheckin).mockResolvedValue(false);

    await expectAppError(matchService.openCheckinMatch(1, ORG), 409, 'INVALID_STATUS_TRANSITION');
  });

  it('opens check-in for a scheduled match', async () => {
    vi.mocked(MatchRepo.openMatchCheckin).mockResolvedValue(true);

    await expect(matchService.openCheckinMatch(1, ORG)).resolves.toMatchObject({ id: 1, status: 'checkin_open' });
    expect(NotificationService.notifyMatchAudience).toHaveBeenCalledWith(1, expect.objectContaining({ type: 'checkin_opened' }));
  });

  /**
   * มติ 27 ก.ย. — กรรมการของแมตช์เปิดเช็คอินได้ด้วย
   * `checkin_open` เป็นทางออกทางเดียวของ `scheduled` ถ้าผู้จัดติดอยู่อีกสนามก็ไม่มีอะไรเกิดขึ้นได้เลย
   * ทั้งที่กรรมการยืนอยู่หน้าโต๊ะและคุมทุกอย่างข้างในหน้าต่างนี้อยู่แล้ว
   */
  it('lets the referee of this match open it too', async () => {
    vi.mocked(MatchRepo.openMatchCheckin).mockResolvedValue(true);
    vi.mocked(isRefereeOfMatch).mockResolvedValue(true);

    await expect(matchService.openCheckinMatch(1, REF)).resolves.toMatchObject({ status: 'checkin_open' });
    expect(isRefereeOfMatch).toHaveBeenCalledWith(1, REF, 50);
  });

  it('403 for a referee of the tournament who is not on this match, and for anyone else', async () => {
    await expectAppError(matchService.openCheckinMatch(1, REF), 403, 'NOT_MATCH_PARTICIPANT');
    await expectAppError(matchService.openCheckinMatch(1, 12345), 403, 'NOT_MATCH_PARTICIPANT');
    expect(MatchRepo.openMatchCheckin).not.toHaveBeenCalled();
  });

  // ข้อ 1 (มติ 25-26 ก.ย.) — ห้ามเปิดเช็คอินทับแมตช์ต้นทางที่ยังไม่สรุป และต้องบอกว่าติดแมตช์ไหน
  it('409 MATCH_TEAMS_INCOMPLETE naming the upstream matches that are still open', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(scheduled({ team_b_id: null }));
    vi.mocked(MatchRepo.findUnresolvedPredecessors).mockResolvedValue([
      { match_id: 12, match_status: 'in_progress' }, { match_id: 13, match_status: 'result_rejected' },
    ] as never);

    const err = await expectAppError(matchService.openCheckinMatch(1, ORG), 409, 'MATCH_TEAMS_INCOMPLETE');
    expect(err.extra).toEqual({ blockedBy: [
      { matchId: 12, status: 'in_progress', reason: 'กำลังแข่งอยู่ ยังไม่มีการส่งผล' },
      { matchId: 13, status: 'result_rejected', reason: 'ผลถูกยกเลิก รอส่งผลใหม่' },
    ] });
    expect(MatchRepo.openMatchCheckin).not.toHaveBeenCalled();
  });

  it('409 PREDECESSOR_DISPUTED when both teams are in but an upstream match is disputed', async () => {
    vi.mocked(MatchRepo.findUnresolvedPredecessors).mockResolvedValue([{ match_id: 12, match_status: 'disputed' }] as never);

    const err = await expectAppError(matchService.openCheckinMatch(1, ORG), 409, 'PREDECESSOR_DISPUTED');
    expect(err.extra).toEqual({ blockedBy: [{ matchId: 12, status: 'disputed', reason: 'มีข้อโต้แย้งรอผู้จัดตัดสิน' }] });
    expect(MatchRepo.openMatchCheckin).not.toHaveBeenCalled();
  });

  it('an upstream match that is merely unfinished does not block a match whose teams are already set', async () => {
    vi.mocked(MatchRepo.findUnresolvedPredecessors).mockResolvedValue([{ match_id: 12, match_status: 'in_progress' }] as never);
    vi.mocked(MatchRepo.openMatchCheckin).mockResolvedValue(true);

    await expect(matchService.openCheckinMatch(1, ORG)).resolves.toMatchObject({ status: 'checkin_open' });
  });
});

describe('verifyCheckin / rejectCheckin (M14/M15)', () => {
  it.each(['checkin_open', 'in_progress'])('verifies a pending photo check-in while the match is %s', async (status) => {
    vi.mocked(MatchRepo.findCheckinById).mockResolvedValue(checkin());
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: status }));
    vi.mocked(MatchRepo.verifyCheckin).mockResolvedValue(true);

    await expect(matchService.verifyCheckin(7, 1, 9002)).resolves.toEqual({ id: 7, status: 'verified' });
  });

  it.each(['scheduled', 'completed', 'disputed', 'result_rejected'])('refuses to decide a check-in while the match is %s', async (status) => {
    vi.mocked(MatchRepo.findCheckinById).mockResolvedValue(checkin());
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: status }));

    await expectAppError(matchService.verifyCheckin(7, 1, 9002), 409, 'MATCH_NOT_CHANGEABLE');
    await expectAppError(matchService.rejectCheckin(7, 1, 9002, 'รูปไม่ชัด'), 409, 'MATCH_NOT_CHANGEABLE');
    expect(MatchRepo.verifyCheckin).not.toHaveBeenCalled();
    expect(MatchRepo.rejectCheckin).not.toHaveBeenCalled();
  });

  it.each(['success', 'exception'])('refuses to verify a %s check-in with ALREADY_DECIDED', async (status) => {
    vi.mocked(MatchRepo.findCheckinById).mockResolvedValue(checkin({ match_checkin_status: status }));
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: 'checkin_open' }));

    await expectAppError(matchService.verifyCheckin(7, 1, 9002), 409, 'ALREADY_DECIDED');
    expect(MatchRepo.verifyCheckin).not.toHaveBeenCalled();
  });

  it('verify / reject of a rejected check-in → ALREADY_REJECTED', async () => {
    vi.mocked(MatchRepo.findCheckinById).mockResolvedValue(checkin({ match_checkin_status: 'rejected' }));
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: 'checkin_open' }));

    await expectAppError(matchService.verifyCheckin(7, 1, 9002), 409, 'ALREADY_REJECTED');
    await expectAppError(matchService.rejectCheckin(7, 1, 9002, 'x'), 409, 'ALREADY_REJECTED');
    expect(MatchRepo.rejectCheckin).not.toHaveBeenCalled();
  });

  // มติ 21 ก.ย. (FE-check-has-gone-through): QR/manual ไม่มีใครตรวจก่อน กรรมการเพิกถอนทีหลังได้
  it.each([
    ['success', 'checkin_open'], ['exception', 'checkin_open'], ['success', 'in_progress'], ['exception', 'in_progress'],
  ])('revokes a %s check-in while the match is %s', async (status, matchStatus) => {
    vi.mocked(MatchRepo.findCheckinById).mockResolvedValue(checkin({ match_checkin_status: status }));
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: matchStatus }));
    vi.mocked(MatchRepo.rejectCheckin).mockResolvedValue(true);

    await expect(matchService.rejectCheckin(7, 1, 9002, 'คนสแกนไม่ใช่เจ้าของบัญชี')).resolves.toEqual({ id: 7, status: 'rejected', reason: 'คนสแกนไม่ใช่เจ้าของบัญชี' });
    expect(MatchRepo.rejectCheckin).toHaveBeenCalledWith(7, 9002, 'คนสแกนไม่ใช่เจ้าของบัญชี');
  });

  it('returns ALREADY_REJECTED when another referee rejected in the meantime', async () => {
    vi.mocked(MatchRepo.findCheckinById).mockResolvedValue(checkin());
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: 'checkin_open' }));
    vi.mocked(MatchRepo.rejectCheckin).mockResolvedValue(false);

    await expectAppError(matchService.rejectCheckin(7, 1, 9002, 'รูปไม่ชัด'), 409, 'ALREADY_REJECTED');
  });

  it('returns CHECKIN_NOT_FOUND when the check-in belongs to another match', async () => {
    vi.mocked(MatchRepo.findCheckinById).mockResolvedValue(checkin({ match_id: 2 }));

    await expectAppError(matchService.verifyCheckin(7, 1, 9002), 404, 'CHECKIN_NOT_FOUND');
  });
});

describe('getCheckinQr (M11)', () => {
  it('lets a referee assigned to this match get the QR while check-in is open', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: 'checkin_open' }));
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(organizerTournament);
    vi.mocked(isRefereeOfMatch).mockResolvedValue(true);

    await expect(matchService.getCheckinQr(1, 9002)).resolves.toMatchObject({ qrPayload: 'qr' });
    expect(isRefereeOfMatch).toHaveBeenCalledWith(1, 9002, 50);
  });

  it('refuses a tournament referee who is not assigned to this match', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: 'checkin_open' }));
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(organizerTournament);
    vi.mocked(isRefereeOfMatch).mockResolvedValue(false);

    await expectAppError(matchService.getCheckinQr(1, 9002), 403, 'NOT_ORGANIZER_OR_REFEREE');
  });

  it.each(['scheduled', 'in_progress', 'completed'])('refuses to issue a QR while the match is %s', async (status) => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: status }));
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(organizerTournament);
    vi.mocked(isRefereeOfMatch).mockResolvedValue(false);

    await expectAppError(matchService.getCheckinQr(1, 9003), 409, 'CHECKIN_NOT_OPEN');
  });
});

describe('getMatchLineups (M19) — รายชื่อผู้เล่นที่ลงแข่งของทั้งสองทีม', () => {
  it('splits the registered players by team and keeps their check-in status', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue({ match_id: 1, team_a_id: 11, team_b_id: 12, tournament_id: 20 } as never);
    vi.mocked(MatchRepo.findLineupsByMatch).mockResolvedValue([
      { team_id: 11, user_id: 101, match_checkin_status: 'success' },
      { team_id: 11, user_id: 102, match_checkin_status: null },
      { team_id: 12, user_id: 201, match_checkin_status: 'pending' },
    ] as never);

    const result = await matchService.getMatchLineups(1);

    expect(result).toEqual({
      matchId: 1,
      teamA: { teamId: 11, withdrawn: false, players: [{ userId: 101, checkinStatus: 'success' }, { userId: 102, checkinStatus: null }] },
      teamB: { teamId: 12, withdrawn: false, players: [{ userId: 201, checkinStatus: 'pending' }] },
    });
  });

  // มติ 26 ก.ย. — ทีมที่ถอนตัวหลังแมตช์นี้แข่งไปแล้ว รายชื่อต้องไม่หาย แค่ติดป้ายบอก
  it('keeps the roster of a team that withdrew after this match was played, flagged as withdrawn', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue({ match_id: 1, team_a_id: 11, team_b_id: 12, tournament_id: 20 } as never);
    vi.mocked(MatchRepo.findLineupsByMatch).mockResolvedValue([
      { team_id: 11, user_id: 101, match_checkin_status: 'success', application_status: 'withdrawn' },
      { team_id: 12, user_id: 201, match_checkin_status: 'success', application_status: 'approved' },
    ] as never);

    const result = await matchService.getMatchLineups(1);

    expect(result.teamA).toMatchObject({ teamId: 11, withdrawn: true });
    expect(result.teamA!.players).toHaveLength(1);
    expect(result.teamB).toMatchObject({ teamId: 12, withdrawn: false });
  });

  it('returns null for a side that has no team yet (waiting for the previous round)', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue({ match_id: 2, team_a_id: 11, team_b_id: null, tournament_id: 20 } as never);
    vi.mocked(MatchRepo.findLineupsByMatch).mockResolvedValue([] as never);

    const result = await matchService.getMatchLineups(2);

    expect(result.teamA).toEqual({ teamId: 11, withdrawn: false, players: [] });
    expect(result.teamB).toBeNull();
  });

  it('returns MATCH_NOT_FOUND for an unknown match', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(null);

    await expect(matchService.getMatchLineups(999)).rejects.toMatchObject({ status: 404, code: 'MATCH_NOT_FOUND' });
    expect(MatchRepo.findLineupsByMatch).not.toHaveBeenCalled();
  });
});

describe('getMatchCheckins (M13) — document photos for the match referee only', () => {
  const rows = [
    { match_checkin_id: 1, method: 'qr_onsite', document_s3_key: null },
    { match_checkin_id: 2, method: 'photo_online', document_s3_key: 'checkin_document/1/a.jpg' },
  ] as never;

  it('gives the referee of the match a presigned URL for photo check-ins only', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(organizerTournament);
    vi.mocked(isRefereeOfMatch).mockResolvedValue(true);
    vi.mocked(MatchRepo.findCheckinsByMatch).mockResolvedValue(rows);

    const result = await matchService.getMatchCheckins(1, 9002);

    expect(result.items).toEqual([
      { id: 1, documentUrl: null },
      { id: 2, documentUrl: 'https://s3/checkin_document/1/a.jpg?signed' },
    ]);
    expect(getPresignedDownloadUrl).toHaveBeenCalledTimes(1);
  });

  it('lets the organizer see the list but never the photo URL (PDPA)', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(organizerTournament);
    vi.mocked(isRefereeOfMatch).mockResolvedValue(false);
    vi.mocked(MatchRepo.findCheckinsByMatch).mockResolvedValue(rows);

    const result = await matchService.getMatchCheckins(1, 9003);

    expect(result.items).toEqual([{ id: 1, documentUrl: null }, { id: 2, documentUrl: null }]);
    expect(getPresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('refuses someone who is neither organizer nor referee of the match', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(organizerTournament);
    vi.mocked(isRefereeOfMatch).mockResolvedValue(false);

    await expectAppError(matchService.getMatchCheckins(1, 9004), 403, 'NOT_ORGANIZER_OR_REFEREE');
  });
});

describe('submitCheckin (M12)', () => {
  const qrInput = { method: 'qr_onsite', qrPayload: 'qr' } as never;

  it.each(['scheduled', 'in_progress', 'completed'])('refuses a new check-in while the match is %s', async (status) => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: status }));
    vi.mocked(MatchRepo.findCheckinByMatchAndUser).mockResolvedValue(null);

    await expectAppError(matchService.submitCheckin(1, 9001, qrInput), 409, 'CHECKIN_NOT_OPEN');
    expect(MatchRepo.insertCheckin).not.toHaveBeenCalled();
  });

  it('still returns the existing check-in (idempotent) after the match has started', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: 'in_progress' }));
    vi.mocked(MatchRepo.findCheckinByMatchAndUser).mockResolvedValue({ match_checkin_id: 5, match_checkin_status: 'success', checked_in_at: new Date(0) } as never);

    await expect(matchService.submitCheckin(1, 9001, qrInput)).resolves.toMatchObject({ isNew: false, data: { id: 5 } });
  });

  it('creates a check-in while check-in is open and the user is in the roster', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: 'checkin_open' }));
    vi.mocked(MatchRepo.findCheckinByMatchAndUser).mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ match_checkin_id: 6, match_checkin_status: 'success', checked_in_at: new Date(0) } as never);
    vi.mocked(MatchRepo.isRegisteredPlayerOfMatch).mockResolvedValue(true);
    vi.mocked(MatchRepo.insertCheckin).mockResolvedValue({ match_checkin_id: 6, match_checkin_status: 'success', checked_in_at: new Date(0) } as never);

    await expect(matchService.submitCheckin(1, 9001, qrInput)).resolves.toMatchObject({ isNew: true, data: { id: 6 } });
    expect(MatchRepo.reCheckin).not.toHaveBeenCalled();
  });

  // มติ 21 ก.ย. 2-ข: ถูก reject แล้วเช็คอินใหม่ได้ (ทับแถวเดิม) — ต้องผ่านเงื่อนไข checkin_open + roster เหมือนเช็คอินครั้งแรก
  it('a rejected check-in is replaced by a fresh one while check-in is open', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: 'checkin_open' }));
    vi.mocked(MatchRepo.findCheckinByMatchAndUser).mockResolvedValueOnce({ match_checkin_id: 5, match_checkin_status: 'rejected' } as never)
      .mockResolvedValueOnce({ match_checkin_id: 5, match_checkin_status: 'success', checked_in_at: new Date(1) } as never);
    vi.mocked(MatchRepo.isRegisteredPlayerOfMatch).mockResolvedValue(true);
    vi.mocked(MatchRepo.reCheckin).mockResolvedValue(true);

    await expect(matchService.submitCheckin(1, 9001, qrInput)).resolves.toMatchObject({ isNew: true, data: { id: 5 } });
    expect(MatchRepo.reCheckin).toHaveBeenCalledWith(5, expect.objectContaining({ method: 'qr_onsite', status: 'success' }));
    expect(MatchRepo.insertCheckin).not.toHaveBeenCalled();
  });

  // QA 21 ก.ย.: วิธีเช็คอินต้องตรงโหมดแมตช์
  it.each([
    ['onsite', { method: 'photo_online', documentType: 'student_id', documentS3Key: 'k' }, 'qr_onsite'],
    ['online', { method: 'qr_onsite', qrPayload: 'qr' }, 'photo_online'],
  ])('%s match refuses the other mode\'s method with CHECKIN_METHOD_MISMATCH', async (mode, input, expectedMethod) => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: 'checkin_open', mode }));
    vi.mocked(MatchRepo.findCheckinByMatchAndUser).mockResolvedValue(null);

    await expect(matchService.submitCheckin(1, 9001, input as never)).rejects.toMatchObject({ status: 400, code: 'CHECKIN_METHOD_MISMATCH', extra: { mode, expectedMethod } });
    expect(MatchRepo.isRegisteredPlayerOfMatch).not.toHaveBeenCalled();
    expect(MatchRepo.insertCheckin).not.toHaveBeenCalled();
  });

  it('online match accepts a photo check-in as pending', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: 'checkin_open', mode: 'online' }));
    vi.mocked(MatchRepo.findCheckinByMatchAndUser).mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ match_checkin_id: 8, match_checkin_status: 'pending', checked_in_at: new Date(0) } as never);
    vi.mocked(MatchRepo.isRegisteredPlayerOfMatch).mockResolvedValue(true);
    vi.mocked(MatchRepo.insertCheckin).mockResolvedValue({ match_checkin_id: 8 } as never);

    await expect(matchService.submitCheckin(1, 9001, { method: 'photo_online', documentType: 'student_id', documentS3Key: 'k' } as never)).resolves.toMatchObject({ isNew: true, data: { id: 8 } });
    expect(MatchRepo.insertCheckin).toHaveBeenCalledWith(expect.objectContaining({ method: 'photo_online', status: 'pending', documentS3Key: 'k' }));
  });

  it('a rejected check-in cannot be redone once the match has started', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: 'in_progress' }));
    vi.mocked(MatchRepo.findCheckinByMatchAndUser).mockResolvedValue({ match_checkin_id: 5, match_checkin_status: 'rejected' } as never);

    await expectAppError(matchService.submitCheckin(1, 9001, qrInput), 409, 'CHECKIN_NOT_OPEN');
    expect(MatchRepo.reCheckin).not.toHaveBeenCalled();
  });
});

describe('room code (B8)', () => {
  it('organizer sets the code on an online match', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ mode: 'online', tournament_id: 50 }));
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 50, requested_by_user_id: 7 } as never);
    await expect(matchService.setRoomCode(1, 7, 'ROV-1234')).resolves.toEqual({ matchId: 1, roomCode: 'ROV-1234' });
    expect(MatchRepo.updateRoomCode).toHaveBeenCalledWith(1, 'ROV-1234');
  });
  it('match referee may set it; anyone else gets 403 NOT_MATCH_STAFF', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ mode: 'online', tournament_id: 50 }));
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 50, requested_by_user_id: 7 } as never);
    vi.mocked(isRefereeOfMatch).mockResolvedValueOnce(true);
    await expect(matchService.setRoomCode(1, 8, 'X')).resolves.toBeTruthy();
    vi.mocked(isRefereeOfMatch).mockResolvedValueOnce(false);
    await expectAppError(matchService.setRoomCode(1, 9, 'X'), 403, 'NOT_MATCH_STAFF');
  });
  it('409 MATCH_NOT_ONLINE for an on-site match', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ mode: 'onsite' }));
    await expectAppError(matchService.setRoomCode(1, 7, 'X'), 409, 'MATCH_NOT_ONLINE');
  });
});

describe('listMyMatches (/me/matches)', () => {
  it('merges unfinished player and referee matches, sorted by time, with role on each row', async () => {
    vi.mocked(MatchRepo.findMatchesOfPlayer).mockResolvedValue([
      { match_id: 5, round_number: 1, scheduled_time: new Date('2026-10-02T10:00:00Z'), scheduled_end_time: null, venue: null, mode: 'onsite', match_status: 'scheduled',
        tournament_id: 50, tournament_name: 'T', sport_type_id: 1, team_a_id: 11, team_a_name: 'A', team_b_id: 12, team_b_name: 'B', my_team_id: 11 },
    ]);
    const { listMyRefereeMatches } = await import('../referee.service.js');
    vi.mocked(listMyRefereeMatches).mockResolvedValue({ items: [
      { id: 6, tournament: { id: 51, name: 'U', sportTypeId: 2 }, round: 1, teamA: null, teamB: null, scheduledTime: new Date('2026-10-01T10:00:00Z'), scheduledEndTime: null, venue: null, mode: 'online', status: 'completed' },
    ] });
    const out = await matchService.listMyMatches(7, {});
    expect(out.items.map(m => [m.id, m.role])).toEqual([[5, 'player']]);   // completed referee match 6 is history, not "my matches"
    expect(out.items[0]).toMatchObject({ myTeamId: 11 });
    expect((await matchService.listMyMatches(7, { role: 'referee' })).items).toEqual([]);
  });
});

/**
 * 🆕 ธงเวลาทับของตัวเอง ข้ามทุกทัวร์ (มติ 6 ต.ค. 2569 · ทางเลือก ก)
 *
 * 🔴 ช่องโหว่ที่ปิด: ตอน ORG จัดตาราง findConflictingMatch ตรวจทีมกับสนามข้ามทัวร์
 *   แต่ไม่ตรวจ "คน" ⇒ คนเดียวอยู่หลายทีมได้ (team_members UNIQUE แค่ team_id+user_id)
 *   ⇒ ORG สองคนที่ไม่รู้จักกันจัดแมตช์เวลาเดียวกันให้คนเดียวกันได้ ไม่มีใครรู้จนถึงวันแข่ง
 * ★ เป็นคำเตือนไม่ใช่การบล็อก เพราะผู้เล่นไม่มีประตู "กดรับ" และการเตือน ORG
 *   เท่ากับเปิดข้อมูลทัวร์อื่นของคนอื่น ⇒ ที่ถูกคือหน้าของเจ้าตัว
 */
describe('listMyMatches — ธงเวลาทับของตัวเอง (conflictingMatchIds)', () => {
  /** ผู้เล่น: ช่วงเวลาเป็น Date ทั้งคู่ (ฝั่ง repo คืน Date) */
  const playerRow = (id: number, start: string, end: string | null, o: Record<string, unknown> = {}) => ({
    match_id: id, round_number: 1, scheduled_time: new Date(start), scheduled_end_time: end === null ? null : new Date(end),
    venue: null, mode: 'onsite', match_status: 'scheduled',
    tournament_id: 50, tournament_name: 'T', sport_type_id: 1,
    team_a_id: 11, team_a_name: 'A', team_b_id: 12, team_b_name: 'B', my_team_id: 11, ...o,
  });
  const refItem = (id: number, start: string, end: string, o: Record<string, unknown> = {}) => ({
    id, tournament: { id: 51, name: 'U', sportTypeId: 2 }, round: 1, teamA: null, teamB: null,
    scheduledTime: new Date(start), scheduledEndTime: new Date(end),
    venue: null, mode: 'online', status: 'scheduled', ...o,
  });

  async function run(players: unknown[], referees: unknown[] = []) {
    vi.mocked(MatchRepo.findMatchesOfPlayer).mockResolvedValue(players as never);
    const { listMyRefereeMatches } = await import('../referee.service.js');
    vi.mocked(listMyRefereeMatches).mockResolvedValue({ items: referees } as never);
    const out = await matchService.listMyMatches(7, {});
    return new Map(out.items.map(m => [m.id, (m as { conflictingMatchIds: number[] }).conflictingMatchIds]));
  }

  it('ลงแข่งสองทัวร์เวลาทับกัน = ติดธงชี้หากันทั้งสองฝั่ง', async () => {
    const got = await run([
      playerRow(1, '2026-10-10T03:00:00Z', '2026-10-10T04:30:00Z'),
      playerRow(2, '2026-10-10T04:00:00Z', '2026-10-10T05:00:00Z', { tournament_id: 60, tournament_name: 'T2', team_a_id: 21, my_team_id: 21 }),
    ]);

    expect(got.get(1)).toEqual([2]);
    expect(got.get(2)).toEqual([1]);
  });

  it('เวลาไม่ทับ = ไม่ติดธง', async () => {
    const got = await run([
      playerRow(1, '2026-10-10T03:00:00Z', '2026-10-10T04:00:00Z'),
      playerRow(2, '2026-10-10T06:00:00Z', '2026-10-10T07:00:00Z'),
    ]);

    expect(got.get(1)).toEqual([]);
    expect(got.get(2)).toEqual([]);
  });

  /**
   * ★ ติดกันพอดีไม่ใช่การทับ — จบ 11:00 แล้วเริ่ม 11:00 ไปต่อได้
   *   ถ้านับเป็นทับ ตารางที่จัดชนกันพอดี (เรื่องปกติในทัวร์) จะขึ้นเตือนทั้งวัน
   */
  it('จบพอดีแล้วเริ่มต่อ = ไม่ใช่การทับ', async () => {
    const got = await run([
      playerRow(1, '2026-10-10T03:00:00Z', '2026-10-10T04:00:00Z'),
      playerRow(2, '2026-10-10T04:00:00Z', '2026-10-10T05:00:00Z'),
    ]);

    expect(got.get(1)).toEqual([]);
  });

  /** ★ ข้อจำกัดจริงคือ "ร่างกายเดียวอยู่สองที่พร้อมกันไม่ได้" ⇒ ข้ามบทบาทด้วย */
  it('ลงแข่งทัวร์หนึ่ง ทับกับงานกรรมการอีกทัวร์ = ติดธงข้ามบทบาท', async () => {
    const got = await run(
      [playerRow(1, '2026-10-10T03:00:00Z', '2026-10-10T04:30:00Z')],
      [refItem(9, '2026-10-10T04:00:00Z', '2026-10-10T05:00:00Z')]);

    expect(got.get(1)).toEqual([9]);
    expect(got.get(9)).toEqual([1]);
  });

  it('ยังไม่มีเวลาเริ่ม/จบ = ไม่ติดธง (เทียบไม่ได้ ไม่ใช่ไม่ทับ)', async () => {
    const got = await run([
      playerRow(1, '2026-10-10T03:00:00Z', null),
      playerRow(2, '2026-10-10T03:30:00Z', '2026-10-10T04:00:00Z'),
    ]);

    expect(got.get(1)).toEqual([]);
    expect(got.get(2)).toEqual([]);
  });

  /**
   * 🔴 แข่งจบแล้วรอผล (finished) ไม่ใช่คู่ขัดแย้ง — เจ้าตัวไม่ต้องไปอยู่ที่นั้นอีก
   *   แต่ยังอยู่ในลิสต์ เพราะลิสต์ตัดแค่ completed ตามมติ 20 ก.ย. (คนละเรื่องกัน)
   */
  it('แมตช์ที่แข่งจบแล้วรอผล ไม่นับเป็นคู่ขัดแย้ง แต่ยังอยู่ในลิสต์', async () => {
    const got = await run([
      playerRow(1, '2026-10-10T03:00:00Z', '2026-10-10T04:30:00Z'),
      playerRow(2, '2026-10-10T04:00:00Z', '2026-10-10T05:00:00Z', { match_status: 'finished' }),
    ]);

    expect(got.has(2)).toBe(true);
    expect(got.get(1)).toEqual([]);
    expect(got.get(2)).toEqual([]);
  });

  /**
   * ★ แมตช์ที่เลยเวลาแล้วแต่ยัง scheduled = อาจกำลังเริ่มช้า ⇒ ยังต้องไป ⇒ ยังนับเป็นการทับ
   *   (เหตุผลเดียวกับ bookingsOfReferee ของด่านกรรมการ — ไม่ตัดด้วย "เวลาผ่านไปแล้ว")
   */
  it('แมตช์ในอดีตที่ยัง scheduled ยังนับเป็นการทับ', async () => {
    const got = await run([
      playerRow(1, '2020-01-01T03:00:00Z', '2020-01-01T04:30:00Z'),
      playerRow(2, '2020-01-01T04:00:00Z', '2020-01-01T05:00:00Z'),
    ]);

    expect(got.get(1)).toEqual([2]);
  });

  it('ทับสามแมตช์พร้อมกัน = คืนครบทุกตัว ไม่ใช่ตัวแรกตัวเดียว', async () => {
    const got = await run([
      playerRow(1, '2026-10-10T03:00:00Z', '2026-10-10T06:00:00Z'),
      playerRow(2, '2026-10-10T04:00:00Z', '2026-10-10T05:00:00Z'),
      playerRow(3, '2026-10-10T05:30:00Z', '2026-10-10T07:00:00Z'),
    ]);

    expect(got.get(1)).toEqual([2, 3]);
  });

  /**
   * 🔴 ?role=player ต้องไม่ทำให้ธงหายไป... แต่ต้องรู้ด้วยว่ามันเปลี่ยนความหมาย:
   *   ธงคำนวณจาก "ลิสต์ที่กรองแล้ว" ⇒ กรองเฉพาะผู้เล่น จะไม่เห็นว่าทับกับงานกรรมการ
   *   ★ ตั้งใจให้เป็นแบบนี้ — ธงอธิบายสิ่งที่ผู้ใช้เห็นอยู่บนจอ ไม่ใช่สิ่งที่ถูกซ่อนไป
   *     ถ้าอยากเห็นภาพรวมทั้งหมด ต้องเรียกแบบไม่กรอง (ซึ่งเป็นค่าตั้งต้นของหน้านั้น)
   */
  it('?role=player: ธงคิดจากลิสต์ที่กรองแล้ว ⇒ ไม่เห็นการทับกับงานกรรมการ', async () => {
    vi.mocked(MatchRepo.findMatchesOfPlayer).mockResolvedValue([
      playerRow(1, '2026-10-10T03:00:00Z', '2026-10-10T04:30:00Z')] as never);
    const { listMyRefereeMatches } = await import('../referee.service.js');
    vi.mocked(listMyRefereeMatches).mockResolvedValue(
      { items: [refItem(9, '2026-10-10T04:00:00Z', '2026-10-10T05:00:00Z')] } as never);

    const out = await matchService.listMyMatches(7, { role: 'player' });

    expect(out.items.map(m => m.id)).toEqual([1]);
    expect((out.items[0] as { conflictingMatchIds: number[] }).conflictingMatchIds).toEqual([]);
  });
});

/**
 * 🆕 BE-04 (แก้ 7 ต.ค. 2569 · มติ ③ ก) — เปิดเช็คอิน/เริ่มแข่งได้เฉพาะใกล้เวลานัด
 *
 * QA: ตั้งแมตช์วันที่ 27 ต.ค. แล้ววันที่ 6 ต.ค. เปิดเช็คอิน + ให้ทีมเดียวเช็คอินครบ + กดเริ่ม
 * ⇒ ทีมที่ยังไม่มา **แพ้บายล่วงหน้า 3 สัปดาห์** และผลชนะบายโต้แย้งไม่ได้ (RESULT_IS_WALKOVER)
 *   ความเสียหายถาวร และเกิดได้โดยไม่มีใครทำผิดอะไรเลย
 *
 * ★ ทุกเทสในบล็อกนี้ตรึงเวลา — ด่านนี้เทียบกับ `Date.now()` ถ้าไม่ตรึง เทสจะพลิกตามวันที่รัน
 */
describe('หน้าต่างเวลาของแมตช์ (BE-04)', () => {
  const ORG = 9003;
  const SCHEDULED = '2026-10-01T10:00:00.000Z';
  const scheduledMatch = (o: Record<string, unknown> = {}) =>
    match({ scheduled_time: new Date(SCHEDULED), scheduled_end_time: new Date('2026-10-01T11:30:00.000Z'), venue: 'สนาม A', ...o });

  const at = (iso: string) => { vi.useFakeTimers(); vi.setSystemTime(new Date(iso)); };
  afterEach(() => { vi.useRealTimers(); });

  beforeEach(() => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(organizerTournament);
    vi.mocked(isRefereeOfMatch).mockReset().mockResolvedValue(false);
  });

  describe('เปิดเช็คอิน', () => {
    beforeEach(() => {
      vi.mocked(MatchRepo.findMatchById).mockResolvedValue(scheduledMatch());
      // BE-16 — ด่านกรรมการอยู่หลังด่านเวลา เคสที่ "เปิดได้" จึงต้องผ่านด่านนี้ด้วย
      vi.mocked(MatchRepo.findById).mockResolvedValue(scheduledMatch() as never);
      vi.mocked(isRefereeSufficient).mockReset().mockResolvedValue(true);
    });

    it('ก่อนเวลานัด 3 สัปดาห์ → 409 TOO_EARLY_FOR_MATCH และไม่แจ้งเตือนใคร', async () => {
      at('2026-09-10T10:00:00.000Z');

      const err = await expectAppError(matchService.openCheckinMatch(1, ORG), 409, 'TOO_EARLY_FOR_MATCH');
      expect(err.extra).toMatchObject({ scheduledTime: SCHEDULED });
      expect(MatchRepo.openMatchCheckin).not.toHaveBeenCalled();
      // ★ แจ้งเตือนเรียกคืนไม่ได้ — ผู้เล่นต้องไม่ได้ "เปิดเช็คอินแล้ว" ของแมตช์ที่ยังไม่ถึงเวลา
      expect(NotificationService.notifyMatchAudience).not.toHaveBeenCalled();
    });

    /** ★ เคสขอบ: 60 นาทีก่อนเวลานัดเป๊ะ ต้องเปิดได้ (ไม่ใช่ off-by-one) */
    it('60 นาทีก่อนเวลานัดเป๊ะ → เปิดได้', async () => {
      at('2026-10-01T09:00:00.000Z');

      await expect(matchService.openCheckinMatch(1, ORG)).resolves.toBeDefined();
    });

    it('61 นาทีก่อนเวลานัด → ยังไม่ได้', async () => {
      at('2026-10-01T08:59:00.000Z');

      await expectAppError(matchService.openCheckinMatch(1, ORG), 409, 'TOO_EARLY_FOR_MATCH');
    });

    /**
     * ★ มีขอบบนด้วย — เลยเวลานัดไปนานแล้วต้องให้ผู้จัดนัดใหม่ ไม่ใช่เปิดเช็คอินย้อนหลัง
     *   แต่ขอบบนต้องไม่แคบ (60 นาที) เพราะแมตช์จริงเริ่มสายได้ ถ้าปิดประตูตอนถึงเวลานัดเป๊ะ
     *   แมตช์ที่ยังไม่เปิดเช็คอินจะเดินต่อไม่ได้เลย — เป็นจุดค้างแบบเดียวกับ BE-16
     */
    it('เลยเวลานัดเกิน 60 นาที → 409 TOO_LATE_FOR_MATCH', async () => {
      at('2026-10-01T11:01:00.000Z');

      await expectAppError(matchService.openCheckinMatch(1, ORG), 409, 'TOO_LATE_FOR_MATCH');
    });

    it('เลยเวลานัดแต่ยังไม่ถึง 60 นาที → ยังเปิดได้ (แมตช์เริ่มสายได้)', async () => {
      at('2026-10-01T10:30:00.000Z');

      await expect(matchService.openCheckinMatch(1, ORG)).resolves.toBeDefined();
    });

    /** ★ แมตช์ที่ยังไม่มีเวลานัด ต้องตกที่ SCHEDULE_INCOMPLETE เหมือนเดิม ไม่ใช่ด่านใหม่ */
    it('ไม่มีเวลานัด → ยังเป็น SCHEDULE_INCOMPLETE ตามเดิม', async () => {
      at('2026-10-01T09:45:00.000Z');
      vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ scheduled_time: null, scheduled_end_time: null, venue: null }));

      await expectAppError(matchService.openCheckinMatch(1, ORG), 409, 'SCHEDULE_INCOMPLETE');
    });
  });

  describe('เริ่มแข่ง', () => {
    beforeEach(() => {
      vi.mocked(MatchRepo.findMatchById).mockResolvedValue(scheduledMatch({ match_status: 'checkin_open' }));
    });

    it('กดเริ่มก่อนเวลานัด 3 สัปดาห์ → 409 TOO_EARLY_FOR_MATCH และไม่มีใครแพ้บาย', async () => {
      at('2026-09-10T10:00:00.000Z');

      await expectAppError(matchService.startMatch(1, ORG), 409, 'TOO_EARLY_FOR_MATCH');
      // ★ หัวใจของบั๊กนี้: ต้องหยุด**ก่อน**ถึงการตัดสินไม่มาตามนัด (decideNoShow)
      //   ด่านเวลาอยู่ก่อน MatchRepo.findById ⇒ ถ้า findById ถูกเรียก แปลว่าด่านไม่ทำงาน
      expect(MatchRepo.findById).not.toHaveBeenCalled();
    });

    it('ก่อนเวลานัด 15 นาทีเป๊ะ → เริ่มได้ (ไม่ติดด่านเวลา)', async () => {
      at('2026-10-01T09:45:00.000Z');

      await expect(matchService.startMatch(1, ORG)).rejects.not.toMatchObject({ code: 'TOO_EARLY_FOR_MATCH' });
    });

    /** ★ ไม่มีขอบบน — แมตช์ที่เริ่มสายต้องเริ่มได้เสมอ ไม่งั้นค้างและไม่มีทางจบ */
    it('เลยเวลานัดไปหลายชั่วโมง → ไม่ติดด่านเวลา', async () => {
      at('2026-10-01T18:00:00.000Z');

      await expect(matchService.startMatch(1, ORG)).rejects.not.toMatchObject({ code: 'TOO_LATE_FOR_MATCH' });
    });
  });
});
