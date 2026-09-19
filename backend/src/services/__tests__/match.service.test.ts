import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/match.repo.js', () => ({
  findMatchById: vi.fn(),
  findById: vi.fn(),
  findConflictingMatch: vi.fn(),
  findPredecessors: vi.fn(() => Promise.resolve([])),
  updateMatchSchedule: vi.fn(),
  openMatchCheckin: vi.fn(),
  findCheckinById: vi.fn(),
  verifyCheckin: vi.fn(),
  rejectCheckin: vi.fn(),
  findCheckinsByMatch: vi.fn(),
  findCheckinByMatchAndUser: vi.fn(),
  isRegisteredPlayerOfMatch: vi.fn(),
  insertCheckin: vi.fn(),
  findLineupsByMatch: vi.fn(),
}));

vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(),
}));

vi.mock('../../middlewares/requireReferee.js', () => ({
  isRefereeOfMatch: vi.fn(),
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

import * as matchService from '../match.service.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import { isRefereeOfMatch } from '../../middlewares/requireReferee.js';
import { getPresignedDownloadUrl } from '../upload.service.js';
import { AppError } from '../../utils/AppError.js';

const START = '2026-10-01T10:00:00.000Z';
const END = '2026-10-01T11:30:00.000Z';

function match(overrides: Record<string, unknown> = {}) {
  return { match_id: 1, tournament_id: 50, team_a_id: 11, team_b_id: 12, match_status: 'scheduled', checkin_open_at: null, next_match_id: null, ...overrides } as never;
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

    await matchService.scheduleMatch(1, START, END, 'สนาม A');

    expect(MatchRepo.findConflictingMatch).toHaveBeenCalledWith(1, new Date(START), new Date(END), 'สนาม A', 11, 12);
    expect(MatchRepo.updateMatchSchedule).toHaveBeenCalledWith(1, new Date(START), new Date(END), 'สนาม A');
  });

  it('returns 409 SCHEDULE_CONFLICT with conflictingMatchId when a team or venue overlaps', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
    vi.mocked(MatchRepo.findConflictingMatch).mockResolvedValue({ match_id: 99 });

    const err = await expectAppError(matchService.scheduleMatch(1, START, END, 'สนาม A'), 409, 'SCHEDULE_CONFLICT');
    expect(err.extra).toEqual({ conflictingMatchId: 99 });
    expect(MatchRepo.updateMatchSchedule).not.toHaveBeenCalled();
  });

  it.each(['checkin_open', 'in_progress', 'completed'])('refuses to reschedule a %s match with MATCH_NOT_CHANGEABLE', async (status) => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: status }));

    await expectAppError(matchService.scheduleMatch(1, START, END, 'สนาม A'), 409, 'MATCH_NOT_CHANGEABLE');
    expect(MatchRepo.findConflictingMatch).not.toHaveBeenCalled();
    expect(MatchRepo.updateMatchSchedule).not.toHaveBeenCalled();
  });

  // กฎเพิ่มจาก BE_KN (GUIDE/11 §4.1) — ในวันทัวร์ + ไม่พังลำดับสาย
  it('returns 409 OUTSIDE_TOURNAMENT_DATES when the slot falls outside the tournament days', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ event_start_date: '2026-10-03', event_end_date: '2026-10-04' } as never);

    const err = await expectAppError(matchService.scheduleMatch(1, START, END, 'สนาม A'), 409, 'OUTSIDE_TOURNAMENT_DATES');
    expect(err.extra).toEqual({ eventStartDate: '2026-10-03', eventEndDate: '2026-10-04' });
    expect(MatchRepo.updateMatchSchedule).not.toHaveBeenCalled();
  });

  it('returns 409 SCHEDULE_BREAKS_BRACKET when a previous-round match ends after the new start', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
    vi.mocked(MatchRepo.findConflictingMatch).mockResolvedValue(null);
    vi.mocked(MatchRepo.findPredecessors).mockResolvedValue([
      { match_id: 3, scheduled_time: new Date('2026-10-01T09:00:00.000Z'), scheduled_end_time: new Date('2026-10-01T10:30:00.000Z') },
    ]);

    const err = await expectAppError(matchService.scheduleMatch(1, START, END, 'สนาม A'), 409, 'SCHEDULE_BREAKS_BRACKET');
    expect(err.extra).toEqual({ blockingMatchId: 3 });
  });

  it('returns 409 SCHEDULE_BREAKS_BRACKET when the next-round match starts before the new end', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ next_match_id: 8 }));
    vi.mocked(MatchRepo.findConflictingMatch).mockResolvedValue(null);
    vi.mocked(MatchRepo.findById).mockResolvedValue({ match_id: 8, scheduled_time: new Date('2026-10-01T11:00:00.000Z') } as never);

    const err = await expectAppError(matchService.scheduleMatch(1, START, END, 'สนาม A'), 409, 'SCHEDULE_BREAKS_BRACKET');
    expect(err.extra).toEqual({ blockingMatchId: 8 });
  });
});

describe('openCheckinMatch (M09)', () => {
  it('returns INVALID_STATUS_TRANSITION when the match is no longer scheduled', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: 'in_progress' }));
    vi.mocked(MatchRepo.openMatchCheckin).mockResolvedValue(false);

    await expectAppError(matchService.openCheckinMatch(1), 409, 'INVALID_STATUS_TRANSITION');
  });

  it('opens check-in for a scheduled match', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
    vi.mocked(MatchRepo.openMatchCheckin).mockResolvedValue(true);

    await expect(matchService.openCheckinMatch(1)).resolves.toMatchObject({ id: 1, status: 'checkin_open' });
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

  it.each(['success', 'rejected', 'exception'])('refuses to verify a %s check-in with ALREADY_DECIDED', async (status) => {
    vi.mocked(MatchRepo.findCheckinById).mockResolvedValue(checkin({ match_checkin_status: status }));
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: 'checkin_open' }));

    await expectAppError(matchService.verifyCheckin(7, 1, 9002), 409, 'ALREADY_DECIDED');
    expect(MatchRepo.verifyCheckin).not.toHaveBeenCalled();
  });

  it('returns ALREADY_DECIDED when another referee decided in the meantime', async () => {
    vi.mocked(MatchRepo.findCheckinById).mockResolvedValue(checkin());
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: 'checkin_open' }));
    vi.mocked(MatchRepo.rejectCheckin).mockResolvedValue(false);

    await expectAppError(matchService.rejectCheckin(7, 1, 9002, 'รูปไม่ชัด'), 409, 'ALREADY_DECIDED');
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
      teamA: { teamId: 11, players: [{ userId: 101, checkinStatus: 'success' }, { userId: 102, checkinStatus: null }] },
      teamB: { teamId: 12, players: [{ userId: 201, checkinStatus: 'pending' }] },
    });
  });

  it('returns null for a side that has no team yet (waiting for the previous round)', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue({ match_id: 2, team_a_id: 11, team_b_id: null, tournament_id: 20 } as never);
    vi.mocked(MatchRepo.findLineupsByMatch).mockResolvedValue([] as never);

    const result = await matchService.getMatchLineups(2);

    expect(result.teamA).toEqual({ teamId: 11, players: [] });
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
    vi.mocked(MatchRepo.findCheckinByMatchAndUser).mockResolvedValue(null);
    vi.mocked(MatchRepo.isRegisteredPlayerOfMatch).mockResolvedValue(true);
    vi.mocked(MatchRepo.insertCheckin).mockResolvedValue({ match_checkin_id: 6, match_checkin_status: 'success', checked_in_at: new Date(0) } as never);

    await expect(matchService.submitCheckin(1, 9001, qrInput)).resolves.toMatchObject({ isNew: true, data: { id: 6 } });
  });
});
