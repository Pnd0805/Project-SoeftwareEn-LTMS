import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(),
  notifyUsers: vi.fn(),
  notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(),
  notifyTournamentReferees: vi.fn(),
  notifyMatchResultParties: vi.fn(),
}));

vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(() => Promise.resolve({ tournament_id: 20, name: 'Cup' })),
}));

vi.mock('../../repositories/tournamentReferee.repo.js', () => ({
  findLatestByTournamentAndUser: vi.fn(),
  findActiveByTournamentAndUser: vi.fn(() => Promise.resolve([])),
  findApplyingTeamOfUser: vi.fn(() => Promise.resolve(null)),
  create: vi.fn(),
  findLatestPerUserByTournament: vi.fn(),
  findPendingInvitationsByUser: vi.fn(),
  findById: vi.fn(),
  accept: vi.fn(),
  decline: vi.fn(),
  findRecentApproval: vi.fn(),
  findOpenReview: vi.fn(),
  submitDocsForUser: vi.fn(),
  removeAllByUser: vi.fn(),
}));

// F04/F05 ดึงแมตช์ที่แนบมากับคำเชิญ — เทสชุดนี้ไม่ได้แนบแมตช์ จึงคืนว่างเสมอ
vi.mock('../../repositories/matchReferee.repo.js', () => ({
  findByTournamentReferees: vi.fn().mockResolvedValue([]),
  findAcceptedByUser: vi.fn().mockResolvedValue([]),
  findByMatch: vi.fn(),
  unassign: vi.fn(),
}));

vi.mock('../../repositories/match.repo.js', () => ({
  findByIdsInTournament: vi.fn().mockResolvedValue([]),
  findRefereeCoverage: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../repositories/sportType.repo.js', () => ({
  findStatDefinitionsBySportType: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../repositories/user.repo.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../mappers/referee.mapper.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../mappers/referee.mapper.js')>()),   // toRefereeStatus / toMatchRefereeDto / toMyRefereeMatchDto ของจริง (กฎสถานะ)
  toTournamentRefereeDto: vi.fn(),
  toMyRefereeInvitationDto: vi.fn(),
}));

import * as refereeService from '../referee.service.js';
import * as RefRepo from '../../repositories/tournamentReferee.repo.js';
import * as MatchRefRepo from '../../repositories/matchReferee.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as SportTypeRepo from '../../repositories/sportType.repo.js';
import * as UserRepo from '../../repositories/user.repo.js';
import * as NotificationService from '../notification.service.js';
import { toTournamentRefereeDto, toMyRefereeInvitationDto } from '../../mappers/referee.mapper.js';
import { AppError } from '../../utils/AppError.js';
import type { TournamentRefereeRow, UserRow } from '../../types/db.js';
import type { Schedulable } from '../referee.service.js';

const mockedRefRepo = vi.mocked(RefRepo);
const mockedMatchRepo = vi.mocked(MatchRepo);
const mockedSportTypeRepo = vi.mocked(SportTypeRepo);
const mockedUserRepo = vi.mocked(UserRepo);
const mockedToTournamentRefereeDto = vi.mocked(toTournamentRefereeDto);
const mockedToMyRefereeInvitationDto = vi.mocked(toMyRefereeInvitationDto);

// InviteRefereeInput = { userId, isExternal, matchIds } — matchIds ว่าง = เชิญเข้า pool
function makeInviteInput(overrides: Record<string, unknown> = {}) {
  return { userId: 8, isExternal: false, matchIds: [] as number[], ...overrides };
}

// AcceptInvitationInput = { matchIds, docs? }
const acceptNone = { matchIds: [] as number[] };

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    user_id: 8,
    full_name: 'Referee Candidate',
    email: 'ref@example.com',
    password_hash: 'hashed-password',
    gender: 'other',
    birth_date: '1990-01-01',
    user_type: 'staff',
    faculty_id: null,
    department_id: null,
    year: null,
    profile_image_key: null,
    contact_info: null,
    address: null,
    is_suspended: 0,
    suspended_reason: null,
    suspended_until: null,
    suspended_category: null,
    total_points: 0,
    notification_prefs: null, show_profile_stats: 1,
    profile_edit_log: null,
    created_at: new Date(),
    updated_at: null,
    ...overrides,
  };
}

function makeInvitation(overrides: Partial<TournamentRefereeRow> = {}): TournamentRefereeRow {
  return {
    tournament_referee_id: 1,
    tournament_id: 20,
    user_id: 8,
    invited_by: 5,
    invitation_status: 'pending',
    is_external: 0,
    external_approval_status: 'not_required',
    external_verification_docs: null,
    approved_by: null,
    approved_at: null,
    external_rejection_reason: null,
    created_at: new Date(),
    removed_at: null,
    removed_by: null,
    ...overrides,
  };
}

// InvitedMatchRow-ish fixture for match-attachment tests
function offeredMatch(overrides: Record<string, unknown> = {}) {
  return {
    match_referee_id: 1, tournament_referee_id: 1, assignment_status: 'pending',
    match_id: 1, round_number: 1, scheduled_time: new Date('2026-10-01T10:00:00Z'),
    scheduled_end_time: new Date('2026-10-01T11:00:00Z'), venue: 'A', mode: 'onsite', match_status: 'scheduled',
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('assertSchedulable', () => {
  const s = (matchId: number, start: string, end: string): Schedulable =>
    ({ match_id: matchId, scheduled_time: new Date(start), scheduled_end_time: new Date(end) });

  it('does nothing when the matches are empty or all non-overlapping', () => {
    expect(() => refereeService.assertSchedulable([])).not.toThrow();
    expect(() => refereeService.assertSchedulable([
      s(1, '2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z'),
      s(2, '2026-10-01T11:00:00Z', '2026-10-01T12:00:00Z'), // starts exactly when #1 ends — not a conflict
    ])).not.toThrow();
  });

  it('throws MATCH_NOT_SCHEDULED when any match is missing a start or end time', () => {
    expect(() => refereeService.assertSchedulable([
      { match_id: 1, scheduled_time: null, scheduled_end_time: new Date() },
    ])).toThrowError(expect.objectContaining({ status: 409, code: 'MATCH_NOT_SCHEDULED' }));
    expect(() => refereeService.assertSchedulable([
      { match_id: 1, scheduled_time: new Date(), scheduled_end_time: null },
    ])).toThrowError(expect.objectContaining({ status: 409, code: 'MATCH_NOT_SCHEDULED' }));
  });

  it('throws REFEREE_TIME_CONFLICT with both match ids when two matches overlap', () => {
    let err: AppError | undefined;
    try {
      refereeService.assertSchedulable([
        s(1, '2026-10-01T10:00:00Z', '2026-10-01T11:30:00Z'),
        s(2, '2026-10-01T11:00:00Z', '2026-10-01T12:00:00Z'), // starts before #1 ends
      ]);
    } catch (e) { err = e as AppError; }
    expect(err).toMatchObject({ status: 409, code: 'REFEREE_TIME_CONFLICT', extra: { matchIds: [1, 2] } });
  });

  it('sorts by time internally, so input order does not change which pair is reported', () => {
    let err: AppError | undefined;
    try {
      // given out of chronological order — match 2 first in the array, but it starts later
      refereeService.assertSchedulable([
        s(2, '2026-10-01T11:00:00Z', '2026-10-01T12:00:00Z'),
        s(1, '2026-10-01T10:00:00Z', '2026-10-01T11:30:00Z'),
      ]);
    } catch (e) { err = e as AppError; }
    expect(err?.extra).toEqual({ matchIds: [1, 2] }); // reported in chronological order, not input order
  });
});

describe('inviteReferee', () => {
  it('throws USER_NOT_FOUND when the invited user does not exist', async () => {
    mockedUserRepo.findById.mockResolvedValue(null);

    await expect(refereeService.inviteReferee(20, 5, makeInviteInput())).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(mockedRefRepo.findActiveByTournamentAndUser).not.toHaveBeenCalled();
  });

  // Conflict of interest (มติ 18 ก.ย. 2569)
  it('throws ORGANIZER_CANNOT_BE_REFEREE when the organizer invites themself', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser());

    await expect(refereeService.inviteReferee(20, 5, makeInviteInput({ userId: 5 }))).rejects.toMatchObject({
      status: 409, code: 'ORGANIZER_CANNOT_BE_REFEREE',
    });
    expect(mockedRefRepo.create).not.toHaveBeenCalled();
  });

  it('throws REFEREE_CONFLICT_OF_INTEREST when the user is on a team that applied to this tournament', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    vi.mocked(mockedRefRepo.findApplyingTeamOfUser).mockResolvedValueOnce({ team_id: 33, name: 'ทีมวิศวะ' });

    await expect(refereeService.inviteReferee(20, 5, makeInviteInput())).rejects.toMatchObject({
      status: 409, code: 'REFEREE_CONFLICT_OF_INTEREST', extra: { teamId: 33 },
    });
    expect(mockedRefRepo.create).not.toHaveBeenCalled();
  });

  it('throws REFEREE_INVITATION_PENDING when an active pending invitation already exists', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue(
      [makeInvitation({ invitation_status: 'pending', removed_at: null })],
    );

    await expect(refereeService.inviteReferee(20, 5, makeInviteInput())).rejects.toMatchObject({
      status: 409,
      code: 'REFEREE_INVITATION_PENDING',
    });
    expect(mockedRefRepo.create).not.toHaveBeenCalled();
  });

  it('throws REFEREE_ALREADY_ACCEPTED when the user is already an active referee', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue(
      [makeInvitation({ invitation_status: 'accepted', removed_at: null })],
    );

    await expect(refereeService.inviteReferee(20, 5, makeInviteInput())).rejects.toMatchObject({
      status: 409,
      code: 'REFEREE_ALREADY_ACCEPTED',
    });
    expect(mockedRefRepo.create).not.toHaveBeenCalled();
  });

  it('allows re-inviting when every prior invitation was already removed', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue([]);   // ถูกลบแล้วจึงไม่นับเป็น active
    mockedRefRepo.create.mockResolvedValue(99);

    const result = await refereeService.inviteReferee(20, 5, makeInviteInput());

    expect(mockedRefRepo.create).toHaveBeenCalled();
    expect(result).toEqual({ id: 99, userId: 8, invitationStatus: 'pending', isExternal: false, matchIds: [] });
  });

  it('allows re-inviting when the active accepted invitation was rejected by the admin (F-15)', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue(
      [makeInvitation({ invitation_status: 'accepted', is_external: 1, external_approval_status: 'rejected' })],
    );
    mockedRefRepo.create.mockResolvedValue(99);

    await expect(refereeService.inviteReferee(20, 5, makeInviteInput())).resolves.toBeDefined();
    expect(mockedRefRepo.create).toHaveBeenCalled();
  });

  it('allows re-inviting when the active invitation was declined by the invitee', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue(
      [makeInvitation({ invitation_status: 'rejected', removed_at: null })],
    );
    mockedRefRepo.create.mockResolvedValue(99);

    await expect(refereeService.inviteReferee(20, 5, makeInviteInput())).resolves.toBeDefined();
    expect(mockedRefRepo.create).toHaveBeenCalled();
  });

  /**
   * ★ บั๊กที่แก้ 1 ต.ค. 2569 — เดิมด่านนี้ดู "แถวล่าสุดตาม id" แถวเดียว
   * ตารางเป็น soft delete และ F-15 ตั้งใจให้มีแถว active ได้หลายแถว ⇒ แถวล่าสุดอาจเป็นแถวที่ถูกลบแล้ว
   * ขณะที่แถวเก่ายัง accepted อยู่ · ด่านจึงปล่อยผ่าน แล้วได้กรรมการ active ซ้ำคนในทัวร์เดียวกัน
   * เจอของจริงในฐาน dev: ทัวร์ 2 มี 9002 เป็น accepted ค้างพร้อมกันสามแถว
   */
  it('still refuses when an OLDER row is active even though the newest row was removed', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue(
      [makeInvitation({ invitation_status: 'accepted', removed_at: null })],
    );

    await expect(refereeService.inviteReferee(20, 5, makeInviteInput())).rejects.toMatchObject({
      status: 409, code: 'REFEREE_ALREADY_ACCEPTED',
    });
    expect(mockedRefRepo.create).not.toHaveBeenCalled();
  });

  // แถว rejected_by_admin ค้างอยู่ (F-15) + แถวที่ยัง accepted จริง ⇒ ต้องยังห้ามเชิญซ้ำ
  // ถ้าตัดสินจากแถวใดแถวเดียวจะตอบผิดได้ทั้งสองทาง
  it('refuses when an F-15 leftover sits beside a genuinely accepted row', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue([
      makeInvitation({ invitation_status: 'accepted', is_external: 1, external_approval_status: 'rejected' }),
      makeInvitation({ invitation_status: 'accepted', removed_at: null }),
    ]);

    await expect(refereeService.inviteReferee(20, 5, makeInviteInput())).rejects.toMatchObject({
      status: 409, code: 'REFEREE_ALREADY_ACCEPTED',
    });
  });

  // คำเชิญที่ยังไม่ตอบต้องชนะ ไม่ว่าจะอยู่แถวไหนในลิสต์
  it('reports the pending invitation even when it is not the newest active row', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue([
      makeInvitation({ invitation_status: 'pending', removed_at: null }),
      makeInvitation({ invitation_status: 'accepted', is_external: 1, external_approval_status: 'rejected' }),
    ]);

    await expect(refereeService.inviteReferee(20, 5, makeInviteInput())).rejects.toMatchObject({
      status: 409, code: 'REFEREE_INVITATION_PENDING',
    });
  });

  it('creates a new invitation with the correct payload when there is no prior invitation', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue([]);
    mockedRefRepo.create.mockResolvedValue(100);

    const result = await refereeService.inviteReferee(20, 5, makeInviteInput({ userId: 8, isExternal: true }));

    expect(mockedRefRepo.create).toHaveBeenCalledWith({
      tournamentId: 20,
      userId: 8,
      invitedBy: 5,
      isExternal: true,
      matchIds: [],
    });
    expect(result).toEqual({ id: 100, userId: 8, invitationStatus: 'pending', isExternal: true, matchIds: [] });
  });

  describe('with matches attached', () => {
    it('throws MATCH_NOT_FOUND when a matchId is not in this tournament', async () => {
      mockedUserRepo.findById.mockResolvedValue(makeUser());
      mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue([]);
      mockedMatchRepo.findByIdsInTournament.mockResolvedValue([{ match_id: 1, scheduled_time: new Date(), scheduled_end_time: new Date() }] as never);

      await expect(refereeService.inviteReferee(20, 5, makeInviteInput({ matchIds: [1, 2] }))).rejects.toMatchObject({
        status: 404, code: 'MATCH_NOT_FOUND',
      });
      expect(mockedRefRepo.create).not.toHaveBeenCalled();
    });

    it('propagates a schedule conflict between the attached matches', async () => {
      mockedUserRepo.findById.mockResolvedValue(makeUser());
      mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue([]);
      mockedMatchRepo.findByIdsInTournament.mockResolvedValue([
        { match_id: 1, scheduled_time: new Date('2026-10-01T10:00:00Z'), scheduled_end_time: new Date('2026-10-01T11:30:00Z') },
        { match_id: 2, scheduled_time: new Date('2026-10-01T11:00:00Z'), scheduled_end_time: new Date('2026-10-01T12:00:00Z') },
      ] as never);

      await expect(refereeService.inviteReferee(20, 5, makeInviteInput({ matchIds: [1, 2] }))).rejects.toMatchObject({
        status: 409, code: 'REFEREE_TIME_CONFLICT',
      });
      expect(mockedRefRepo.create).not.toHaveBeenCalled();
    });

    it('dedupes matchIds, creates the invitation with them attached, and mentions the count in the notification', async () => {
      mockedUserRepo.findById.mockResolvedValue(makeUser());
      mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue([]);
      mockedMatchRepo.findByIdsInTournament.mockResolvedValue([
        { match_id: 1, scheduled_time: new Date('2026-10-01T10:00:00Z'), scheduled_end_time: new Date('2026-10-01T11:00:00Z') },
        { match_id: 2, scheduled_time: new Date('2026-10-01T12:00:00Z'), scheduled_end_time: new Date('2026-10-01T13:00:00Z') },
      ] as never);
      mockedRefRepo.create.mockResolvedValue(100);

      const result = await refereeService.inviteReferee(20, 5, makeInviteInput({ matchIds: [1, 2, 1] }));

      expect(mockedMatchRepo.findByIdsInTournament).toHaveBeenCalledWith(20, [1, 2]);
      expect(mockedRefRepo.create).toHaveBeenCalledWith(expect.objectContaining({ matchIds: [1, 2] }));
      expect(result.matchIds).toEqual([1, 2]);
      expect(NotificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('(2 แมตช์)') }));
    });
  });
});

describe('listTournamentReferees', () => {
  it('returns mapped referees along with a count of accepted ones', async () => {
    const rows = [makeInvitation({ tournament_referee_id: 1 }), makeInvitation({ tournament_referee_id: 2 })];
    mockedRefRepo.findLatestPerUserByTournament.mockResolvedValue(rows as never);
    mockedToTournamentRefereeDto
      .mockReturnValueOnce({ id: 1, invitationStatus: 'accepted' } as any)
      .mockReturnValueOnce({ id: 2, invitationStatus: 'pending' } as any);

    const result = await refereeService.listTournamentReferees(20);

    expect(mockedRefRepo.findLatestPerUserByTournament).toHaveBeenCalledWith(20);
    expect(result).toEqual({
      items: [
        { id: 1, invitationStatus: 'accepted' },
        { id: 2, invitationStatus: 'pending' },
      ],
      acceptedCount: 1,
      awaitingAdminCount: 0,
    });
  });

  it('returns acceptedCount 0 when none of the referees have accepted', async () => {
    const rows = [makeInvitation({ tournament_referee_id: 1 })];
    mockedRefRepo.findLatestPerUserByTournament.mockResolvedValue(rows as never);
    mockedToTournamentRefereeDto.mockReturnValue({ id: 1, invitationStatus: 'pending' } as any);

    const result = await refereeService.listTournamentReferees(20);

    expect(result.acceptedCount).toBe(0);
  });

  it('returns an empty items array and acceptedCount 0 when there are no referees', async () => {
    mockedRefRepo.findLatestPerUserByTournament.mockResolvedValue([]);

    const result = await refereeService.listTournamentReferees(20);

    expect(result).toEqual({ items: [], acceptedCount: 0, awaitingAdminCount: 0 });
  });
});

describe('listMyRefereeInvitations', () => {
  it('returns every pending invitation for the user mapped to a DTO', async () => {
    const rows = [makeInvitation({ tournament_referee_id: 1 }), makeInvitation({ tournament_referee_id: 2 })];
    mockedRefRepo.findPendingInvitationsByUser.mockResolvedValue(rows as never);
    mockedToMyRefereeInvitationDto
      .mockReturnValueOnce({ id: 1 } as any)
      .mockReturnValueOnce({ id: 2 } as any);

    const result = await refereeService.listMyRefereeInvitations(8);

    expect(mockedRefRepo.findPendingInvitationsByUser).toHaveBeenCalledWith(8);
    expect(mockedToMyRefereeInvitationDto).toHaveBeenCalledWith(rows[0], []);
    expect(result).toEqual({ items: [{ id: 1 }, { id: 2 }] });
  });

  it('returns an empty items array when the user has no pending invitations', async () => {
    mockedRefRepo.findPendingInvitationsByUser.mockResolvedValue([]);

    const result = await refereeService.listMyRefereeInvitations(8);

    expect(result).toEqual({ items: [] });
  });
});

describe('acceptRefereeInvitation', () => {
  it('throws INVITATION_NOT_FOUND when the invitation does not exist', async () => {
    mockedRefRepo.findById.mockResolvedValue(null);

    await expect(refereeService.acceptRefereeInvitation(1, 8, acceptNone)).rejects.toMatchObject({
      status: 404,
      code: 'INVITATION_NOT_FOUND',
    });
  });

  it('throws INVITATION_NOT_FOUND when the invitation has been removed', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ removed_at: new Date() }));

    await expect(refereeService.acceptRefereeInvitation(1, 8, acceptNone)).rejects.toMatchObject({
      status: 404,
      code: 'INVITATION_NOT_FOUND',
    });
  });

  it('throws INVITATION_NOT_FOUND when the invitation belongs to a different user', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ user_id: 999 }));

    await expect(refereeService.acceptRefereeInvitation(1, 8, acceptNone)).rejects.toMatchObject({
      status: 404,
      code: 'INVITATION_NOT_FOUND',
    });
  });

  it('throws INVITATION_ALREADY_ANSWERED when the invitation is no longer pending', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ invitation_status: 'accepted' }));

    await expect(refereeService.acceptRefereeInvitation(1, 8, acceptNone)).rejects.toMatchObject({
      status: 409,
      code: 'INVITATION_ALREADY_ANSWERED',
    });
    expect(mockedRefRepo.accept).not.toHaveBeenCalled();
  });

  it('throws MATCH_NOT_IN_INVITATION when a chosen matchId was not offered', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ invitation_status: 'pending' }));
    vi.mocked(MatchRefRepo.findByTournamentReferees).mockResolvedValueOnce([offeredMatch({ match_id: 1 })]);

    await expect(refereeService.acceptRefereeInvitation(1, 8, { matchIds: [1, 99] })).rejects.toMatchObject({
      status: 400, code: 'MATCH_NOT_IN_INVITATION',
    });
    expect(mockedRefRepo.accept).not.toHaveBeenCalled();
  });

  it('propagates a schedule conflict when the chosen matches overlap', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ invitation_status: 'pending' }));
    vi.mocked(MatchRefRepo.findByTournamentReferees).mockResolvedValueOnce([
      offeredMatch({ match_id: 1, scheduled_time: new Date('2026-10-01T10:00:00Z'), scheduled_end_time: new Date('2026-10-01T11:30:00Z') }),
      offeredMatch({ match_id: 2, scheduled_time: new Date('2026-10-01T11:00:00Z'), scheduled_end_time: new Date('2026-10-01T12:00:00Z') }),
    ]);

    await expect(refereeService.acceptRefereeInvitation(1, 8, { matchIds: [1, 2] })).rejects.toMatchObject({
      status: 409, code: 'REFEREE_TIME_CONFLICT',
    });
    expect(mockedRefRepo.accept).not.toHaveBeenCalled();
  });

  it('accepting only some of the offered matches reports the rest as declined', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ invitation_status: 'pending', is_external: 0 }));
    vi.mocked(MatchRefRepo.findByTournamentReferees).mockResolvedValueOnce([
      offeredMatch({ match_id: 1, scheduled_time: new Date('2026-10-01T10:00:00Z'), scheduled_end_time: new Date('2026-10-01T11:00:00Z') }),
      offeredMatch({ match_id: 2, scheduled_time: new Date('2026-10-01T12:00:00Z'), scheduled_end_time: new Date('2026-10-01T13:00:00Z') }),
      offeredMatch({ match_id: 3, scheduled_time: new Date('2026-10-01T14:00:00Z'), scheduled_end_time: new Date('2026-10-01T15:00:00Z') }),
    ]);
    mockedRefRepo.accept.mockResolvedValue(true as any);

    const result = await refereeService.acceptRefereeInvitation(1, 8, { matchIds: [2] });

    expect(mockedRefRepo.accept).toHaveBeenCalledWith(1, [2], expect.objectContaining({ status: 'not_required' }));
    expect(result.acceptedMatchIds).toEqual([2]);
    expect(result.declinedMatchIds).toEqual([1, 3]);
  });

  it('throws INVITATION_ALREADY_ANSWERED when accept() fails a race with a concurrent response', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ invitation_status: 'pending' }));
    mockedRefRepo.accept.mockResolvedValue(false as any);

    await expect(refereeService.acceptRefereeInvitation(1, 8, acceptNone)).rejects.toMatchObject({
      status: 409,
      code: 'INVITATION_ALREADY_ANSWERED',
    });
  });

  it('accepts a pending invitation and flags admin approval for external referees', async () => {
    mockedRefRepo.findById.mockResolvedValue(
      makeInvitation({ invitation_status: 'pending', is_external: 1 }),
    );
    mockedRefRepo.findRecentApproval.mockResolvedValue(null);
    mockedRefRepo.findOpenReview.mockResolvedValue(null);
    mockedRefRepo.accept.mockResolvedValue(true as any);

    const result = await refereeService.acceptRefereeInvitation(1, 8, { matchIds: [], docs: ['id-card.jpg'] });

    expect(mockedRefRepo.accept).toHaveBeenCalledWith(1, [], {
      status: 'pending', approvedBy: null, approvedAt: null, docs: ['id-card.jpg'], reason: null,
    });
    expect(result).toEqual({
      id: 1, invitationStatus: 'accepted', requiresAdminApproval: true, docsRequired: false,
      acceptedMatchIds: [], declinedMatchIds: [],
    });
  });

  it('copies a prior approval (within 1 year) so the external referee skips admin review', async () => {
    mockedRefRepo.findById.mockResolvedValue(
      makeInvitation({ invitation_status: 'pending', is_external: 1 }),
    );
    const approvedAt = new Date('2026-01-01T00:00:00Z');
    mockedRefRepo.findRecentApproval.mockResolvedValue({ tournament_referee_id: 7, approved_by: 3, approved_at: approvedAt });
    mockedRefRepo.accept.mockResolvedValue(true as any);

    const result = await refereeService.acceptRefereeInvitation(1, 8, acceptNone);

    expect(mockedRefRepo.accept).toHaveBeenCalledWith(1, [], {
      status: 'approved', approvedBy: 3, approvedAt, docs: null, reason: null,
    });
    expect(result.requiresAdminApproval).toBe(false);
  });

  it('joins an open review (pending in another tournament) without asking for docs again', async () => {
    mockedRefRepo.findById.mockResolvedValue(
      makeInvitation({ invitation_status: 'pending', is_external: 1 }),
    );
    mockedRefRepo.findRecentApproval.mockResolvedValue(null);
    mockedRefRepo.findOpenReview.mockResolvedValue({
      tournament_referee_id: 5, external_approval_status: 'pending',
      external_verification_docs: ['id.jpg'], external_rejection_reason: null,
    });
    mockedRefRepo.accept.mockResolvedValue(true as any);

    const result = await refereeService.acceptRefereeInvitation(1, 8, acceptNone);

    expect(mockedRefRepo.accept).toHaveBeenCalledWith(1, [], {
      status: 'pending', approvedBy: null, approvedAt: null, docs: ['id.jpg'], reason: null,
    });
    expect(result.requiresAdminApproval).toBe(true);
    expect(result.docsRequired).toBe(false);
    expect(mockedRefRepo.submitDocsForUser).not.toHaveBeenCalled();
  });

  it('accepts a pending invitation without admin approval for internal referees', async () => {
    mockedRefRepo.findById.mockResolvedValue(
      makeInvitation({ invitation_status: 'pending', is_external: 0 }),
    );
    mockedRefRepo.accept.mockResolvedValue(true as any);

    const result = await refereeService.acceptRefereeInvitation(1, 8, acceptNone);

    expect(mockedRefRepo.findRecentApproval).not.toHaveBeenCalled();
    expect(mockedRefRepo.accept).toHaveBeenCalledWith(1, [], {
      status: 'not_required', approvedBy: null, approvedAt: null, docs: null, reason: null,
    });
    expect(result).toEqual({
      id: 1, invitationStatus: 'accepted', requiresAdminApproval: false, docsRequired: false,
      acceptedMatchIds: [], declinedMatchIds: [],
    });
  });
});

describe('declineRefereeInvitation', () => {
  it('throws INVITATION_NOT_FOUND when the invitation does not exist', async () => {
    mockedRefRepo.findById.mockResolvedValue(null);

    await expect(refereeService.declineRefereeInvitation(1, 8)).rejects.toMatchObject({
      status: 404,
      code: 'INVITATION_NOT_FOUND',
    });
  });

  it('throws INVITATION_NOT_FOUND when the invitation has been removed', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ removed_at: new Date() }));

    await expect(refereeService.declineRefereeInvitation(1, 8)).rejects.toMatchObject({
      status: 404,
      code: 'INVITATION_NOT_FOUND',
    });
  });

  it('throws INVITATION_NOT_FOUND when the invitation belongs to a different user', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ user_id: 999 }));

    await expect(refereeService.declineRefereeInvitation(1, 8)).rejects.toMatchObject({
      status: 404,
      code: 'INVITATION_NOT_FOUND',
    });
  });

  it('throws INVITATION_ALREADY_ANSWERED when the invitation is no longer pending', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ invitation_status: 'rejected' }));

    await expect(refereeService.declineRefereeInvitation(1, 8)).rejects.toMatchObject({
      status: 409,
      code: 'INVITATION_ALREADY_ANSWERED',
    });
    expect(mockedRefRepo.decline).not.toHaveBeenCalled();
  });

  it('throws INVITATION_ALREADY_ANSWERED when decline() fails a race with a concurrent response', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ invitation_status: 'pending' }));
    mockedRefRepo.decline.mockResolvedValue(false as any);

    await expect(refereeService.declineRefereeInvitation(1, 8)).rejects.toMatchObject({
      status: 409,
      code: 'INVITATION_ALREADY_ANSWERED',
    });
  });

  it('declines a pending invitation', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ invitation_status: 'pending' }));
    mockedRefRepo.decline.mockResolvedValue(true as any);

    const result = await refereeService.declineRefereeInvitation(1, 8);

    expect(mockedRefRepo.decline).toHaveBeenCalledWith(1);
    expect(result).toBeUndefined();
  });
});

describe('listMyRefereeMatches (B7)', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    match_referee_id: 1, tournament_referee_id: 5,
    invitation_status: 'accepted', is_external: 0, external_approval_status: 'not_required', removed_at: null,
    match_id: 10, round_number: 1, scheduled_time: null, scheduled_end_time: null, venue: null, mode: 'onsite', match_status: 'scheduled',
    tournament_id: 50, tournament_name: 'T', sport_type_id: 1,
    team_a_id: 11, team_a_name: 'A', team_b_id: null, team_b_name: null,
    ...over,
  }) as never;

  it('returns only matches where the referee is still active in that tournament', async () => {
    vi.mocked(MatchRefRepo.findAcceptedByUser).mockResolvedValueOnce([
      row(),
      row({ match_id: 11, removed_at: new Date() }),                                   // removed from tournament
      row({ match_id: 12, is_external: 1, external_approval_status: 'pending' }),      // external, admin not yet approved
    ]);
    const out = await refereeService.listMyRefereeMatches(7, {});
    expect(out.items.map(i => i.id)).toEqual([10]);
    expect(out.items[0]).toMatchObject({ tournament: { id: 50, name: 'T', sportTypeId: 1 }, teamA: { id: 11, name: 'A' }, teamB: null, status: 'scheduled' });
  });

  it('upcoming=true drops completed matches; status= filters exactly', async () => {
    vi.mocked(MatchRefRepo.findAcceptedByUser).mockResolvedValue([row(), row({ match_id: 13, match_status: 'completed' })]);
    expect((await refereeService.listMyRefereeMatches(7, { upcoming: true })).items.map(i => i.id)).toEqual([10]);
    expect((await refereeService.listMyRefereeMatches(7, { status: 'completed' })).items.map(i => i.id)).toEqual([13]);
  });
});

describe('listMatchReferees (F12)', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    match_referee_id: 1, tournament_referee_id: 5, assignment_status: 'accepted',
    invitation_status: 'accepted', is_external: 0, external_approval_status: 'not_required', removed_at: null,
    user_id: 70, full_name: 'สมชาย', profile_image_key: null,
    ...over,
  }) as never;

  it('maps only the active referees of the match', async () => {
    vi.mocked(MatchRefRepo.findByMatch).mockResolvedValue([
      row(),
      row({ tournament_referee_id: 6, user_id: 71, is_external: 1, external_approval_status: 'pending' }), // not yet admin-approved
      row({ tournament_referee_id: 7, user_id: 72, removed_at: new Date() }),                               // removed
    ]);

    const result = await refereeService.listMatchReferees(10);

    expect(result.items).toEqual([{ tournamentRefereeId: 5, referee: { id: 70, fullName: 'สมชาย', avatarUrl: null } }]);
  });

  it('returns an empty items array when nobody is assigned', async () => {
    vi.mocked(MatchRefRepo.findByMatch).mockResolvedValue([]);
    await expect(refereeService.listMatchReferees(10)).resolves.toEqual({ items: [] });
  });
});

describe('refereesNeededPerMatch (BR-11)', () => {
  it('on-site needs 2 when the sport records stats; online always needs 1', async () => {
    mockedSportTypeRepo.findStatDefinitionsBySportType.mockResolvedValue([{ sport_stat_definition_id: 1 } as never]);
    const needed = await refereeService.refereesNeededPerMatch(1);
    expect(needed('onsite')).toBe(2);
    expect(needed('online')).toBe(1);
  });

  it('on-site needs only 1 when the sport records no stats', async () => {
    mockedSportTypeRepo.findStatDefinitionsBySportType.mockResolvedValue([]);
    const needed = await refereeService.refereesNeededPerMatch(1);
    expect(needed('onsite')).toBe(1);
    expect(needed('online')).toBe(1);
  });
});

describe('getRefereeCoverage (BR-10)', () => {
  const coverageRow = (over: Record<string, unknown> = {}) => ({
    match_id: 1, round_number: 1, scheduled_time: new Date('2026-10-01T10:00:00Z'), scheduled_end_time: new Date('2026-10-01T11:00:00Z'),
    mode: 'onsite',
    tournament_referee_id: 5, user_id: 70,
    invitation_status: 'accepted', is_external: 0, external_approval_status: 'not_required', removed_at: null,
    ...over,
  }) as never;

  it('a match with enough active referees is covered', async () => {
    mockedSportTypeRepo.findStatDefinitionsBySportType.mockResolvedValue([]); // onsite need = 1
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([coverageRow()]);

    const result = await refereeService.getRefereeCoverage(20, 1);

    expect(result).toMatchObject({ matchesTotal: 1, matchesCovered: 1, uncovered: [] });
  });

  it('a match with nobody assigned at all is uncovered with assigned:0', async () => {
    mockedSportTypeRepo.findStatDefinitionsBySportType.mockResolvedValue([]);
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([
      coverageRow({ tournament_referee_id: null, user_id: null, invitation_status: null, is_external: null, external_approval_status: null }),
    ]);

    const result = await refereeService.getRefereeCoverage(20, 1);

    expect(result.uncovered).toEqual([{ matchId: 1, roundNumber: 1, scheduledTime: '2026-10-01T10:00:00.000Z', needed: 1, assigned: 0 }]);
  });

  it('a referee who is not yet admin-approved does not count toward "assigned"', async () => {
    mockedSportTypeRepo.findStatDefinitionsBySportType.mockResolvedValue([]);
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([
      coverageRow({ is_external: 1, external_approval_status: 'pending' }),
    ]);

    const result = await refereeService.getRefereeCoverage(20, 1);

    expect(result.uncovered).toEqual([expect.objectContaining({ matchId: 1, assigned: 0 })]);
  });

  it('a match needing 2 (stat-tracking on-site) with only 1 active referee is uncovered', async () => {
    mockedSportTypeRepo.findStatDefinitionsBySportType.mockResolvedValue([{ sport_stat_definition_id: 1 } as never]); // onsite need = 2
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([coverageRow()]);

    const result = await refereeService.getRefereeCoverage(20, 1);

    expect(result.uncovered).toEqual([{ matchId: 1, roundNumber: 1, scheduledTime: '2026-10-01T10:00:00.000Z', needed: 2, assigned: 1 }]);
  });

  it('flags a referee assigned to two overlapping matches as a conflict', async () => {
    mockedSportTypeRepo.findStatDefinitionsBySportType.mockResolvedValue([]);
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([
      coverageRow({ match_id: 1, scheduled_time: new Date('2026-10-01T10:00:00Z'), scheduled_end_time: new Date('2026-10-01T11:30:00Z') }),
      coverageRow({ match_id: 2, scheduled_time: new Date('2026-10-01T11:00:00Z'), scheduled_end_time: new Date('2026-10-01T12:00:00Z') }),
    ]);

    const result = await refereeService.getRefereeCoverage(20, 1);

    expect(result.conflicts).toEqual([{ tournamentRefereeId: 5, userId: 70, matchIds: [1, 2] }]);
  });

  it('does not report a conflict for two matches that do not overlap', async () => {
    mockedSportTypeRepo.findStatDefinitionsBySportType.mockResolvedValue([]);
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([
      coverageRow({ match_id: 1, scheduled_time: new Date('2026-10-01T10:00:00Z'), scheduled_end_time: new Date('2026-10-01T11:00:00Z') }),
      coverageRow({ match_id: 2, scheduled_time: new Date('2026-10-01T12:00:00Z'), scheduled_end_time: new Date('2026-10-01T13:00:00Z') }),
    ]);

    const result = await refereeService.getRefereeCoverage(20, 1);

    expect(result.conflicts).toEqual([]);
  });

  it('returns matchesTotal 0 and no uncovered/conflicts when the tournament has no matches', async () => {
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([]);
    await expect(refereeService.getRefereeCoverage(20, 1)).resolves.toEqual({
      matchesTotal: 0, matchesCovered: 0, uncovered: [], conflicts: [],
    });
  });
});

describe('แจ้งเตือนกรรมการถูกถอด (มติ 22 ก.ย. 2569)', () => {
  const tr = (over: Record<string, unknown> = {}) => ({
    tournament_referee_id: 5, tournament_id: 20, user_id: 70, invitation_status: 'accepted', removed_at: null, ...over,
  }) as never;
  const mr = (over: Record<string, unknown> = {}) => ({ match_referee_id: 1, tournament_referee_id: 5, assignment_status: 'accepted', match_id: 10, ...over }) as never;

  beforeEach(() => {
    vi.mocked(NotificationService.notify).mockClear();
    vi.mocked(MatchRefRepo.unassign).mockResolvedValue(true);
  });

  it('unassign from a match the referee accepted → tells that referee', async () => {
    vi.mocked(MatchRefRepo.findByTournamentReferees).mockResolvedValueOnce([mr()]);
    mockedRefRepo.findById.mockResolvedValueOnce(tr());

    await refereeService.unassignRefereeFromMatch(10, 5);

    expect(NotificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: 70, type: 'referee_removed', title: 'คุณถูกถอดจากกรรมการแมตช์', relatedEntityType: 'match', relatedEntityId: 10,
    }));
  });

  it('unassign a match that was only offered (pending) → different wording', async () => {
    vi.mocked(MatchRefRepo.findByTournamentReferees).mockResolvedValueOnce([mr({ assignment_status: 'pending' })]);
    mockedRefRepo.findById.mockResolvedValueOnce(tr({ invitation_status: 'pending' }));

    await refereeService.unassignRefereeFromMatch(10, 5);

    expect(NotificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'ผู้จัดถอนแมตช์ออกจากคำเชิญ' }));
  });

  it('unassign a match the referee declined → no notification', async () => {
    vi.mocked(MatchRefRepo.findByTournamentReferees).mockResolvedValueOnce([mr({ assignment_status: 'declined' })]);
    mockedRefRepo.findById.mockResolvedValueOnce(tr());

    await refereeService.unassignRefereeFromMatch(10, 5);

    expect(NotificationService.notify).not.toHaveBeenCalled();
  });

  it('unassign a pair that does not exist → 404 and no notification', async () => {
    vi.mocked(MatchRefRepo.unassign).mockResolvedValueOnce(false);
    mockedRefRepo.findById.mockResolvedValueOnce(tr());

    await expect(refereeService.unassignRefereeFromMatch(10, 5)).rejects.toMatchObject({ status: 404, code: 'REFEREE_NOT_ASSIGNED' });
    expect(NotificationService.notify).not.toHaveBeenCalled();
  });

  it('remove an accepted referee from the tournament → tells them with the tournament name', async () => {
    mockedRefRepo.findById.mockResolvedValueOnce(tr());

    await refereeService.removeTournamentReferee(20, 5, 7, 1);

    expect(NotificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: 70, type: 'referee_removed', title: 'คุณถูกถอดจากกรรมการทัวร์นาเมนต์', relatedEntityType: 'tournament', relatedEntityId: 20,
    }));
    expect(vi.mocked(NotificationService.notify).mock.calls[0]![0]).toMatchObject({ message: expect.stringContaining('"Cup"') });
  });

  it('cancel a pending invitation → "invitation cancelled" wording', async () => {
    mockedRefRepo.findById.mockResolvedValueOnce(tr({ invitation_status: 'pending' }));
    await refereeService.removeTournamentReferee(20, 5, 7, 1);
    expect(NotificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'คำเชิญเป็นกรรมการถูกยกเลิก' }));
  });

  it('remove someone who already rejected → no notification', async () => {
    mockedRefRepo.findById.mockResolvedValueOnce(tr({ invitation_status: 'rejected' }));
    await refereeService.removeTournamentReferee(20, 5, 7, 1);
    expect(NotificationService.notify).not.toHaveBeenCalled();
  });

  it.each([
    ['does not exist', null],
    ['belongs to a different tournament', { tournament_referee_id: 5, tournament_id: 999, user_id: 70, invitation_status: 'accepted', removed_at: null }],
    ['was already removed', { tournament_referee_id: 5, tournament_id: 20, user_id: 70, invitation_status: 'accepted', removed_at: new Date() }],
  ])('404 REFEREE_NOT_FOUND when the target %s', async (_label, target) => {
    mockedRefRepo.findById.mockResolvedValueOnce(target as never);

    await expect(refereeService.removeTournamentReferee(20, 5, 7, 1)).rejects.toMatchObject({ status: 404, code: 'REFEREE_NOT_FOUND' });
    expect(mockedRefRepo.removeAllByUser).not.toHaveBeenCalled();
  });

  it('reports uncoveredMatches from the post-removal coverage check', async () => {
    mockedRefRepo.findById.mockResolvedValueOnce(tr());
    mockedSportTypeRepo.findStatDefinitionsBySportType.mockResolvedValue([]);
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([
      { match_id: 30, round_number: 2, scheduled_time: null, scheduled_end_time: null, mode: 'onsite',
        tournament_referee_id: null, user_id: null, invitation_status: null, is_external: null, external_approval_status: null, removed_at: null } as never,
    ]);

    const result = await refereeService.removeTournamentReferee(20, 5, 7, 1);

    expect(result).toEqual({ removed: true, uncoveredMatches: [30] });
  });
});

/**
 * findActiveRefereeRow — ตัวที่ด่านสิทธิ์สามที่ใช้ร่วมกัน (requireReferee · refereeRequest · tournament)
 * แก้ 1 ต.ค. 2569: เดิมทั้งสามที่เรียก findLatestByTournamentAndUser แล้วถาม isActiveReferee กับแถวนั้นแถวเดียว
 */
describe('findActiveRefereeRow', () => {
  it('ไม่มีแถว active เลย → null', async () => {
    mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue([]);
    expect(await refereeService.findActiveRefereeRow(20, 8)).toBeNull();
  });

  /**
   * ★ บั๊กด้านสิทธิ์ที่แก้รอบนี้ — กรรมการนอกที่ถูกเชิญรอบสองแล้วแอดมินไม่อนุมัติ
   * จะมีแถว rejected_by_admin เป็นแถวล่าสุด ขณะที่แถวเก่า approved และยัง active อยู่
   * เดิมตอบว่า "ไม่ใช่กรรมการ" ⇒ คุมแมตช์ ส่งผล โอนแมตช์ และเปิดทัวร์ private ของตัวเองไม่ได้
   */
  it('มีแถว approved ที่ยัง active อยู่ → คืนแถวนั้น แม้แถวล่าสุดจะถูกแอดมินปฏิเสธ', async () => {
    mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue([
      makeInvitation({ tournament_referee_id: 24, invitation_status: 'accepted', is_external: 1,
                       external_approval_status: 'approved' }),
      makeInvitation({ tournament_referee_id: 25, invitation_status: 'accepted', is_external: 1,
                       external_approval_status: 'rejected' }),
    ]);

    const row = await refereeService.findActiveRefereeRow(20, 8);

    expect(row?.tournament_referee_id).toBe(24);
  });

  it('แถว active ทั้งหมดใช้งานไม่ได้ (pending / ถูกแอดมินปฏิเสธ) → null', async () => {
    mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue([
      makeInvitation({ tournament_referee_id: 30, invitation_status: 'pending' }),
      makeInvitation({ tournament_referee_id: 31, invitation_status: 'accepted', is_external: 1,
                       external_approval_status: 'rejected' }),
    ]);

    expect(await refereeService.findActiveRefereeRow(20, 8)).toBeNull();
  });

  // มีหลายแถวที่ใช้งานได้พร้อมกัน — ต้องคืนแถวเดิมทุกครั้ง ไม่ใช่สลับไปมาตามลำดับที่ฐานคืนมา
  it('เลือกแถว id น้อยสุดเมื่อใช้งานได้หลายแถว เพื่อให้ผลคาดเดาได้', async () => {
    mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue([
      makeInvitation({ tournament_referee_id: 40, invitation_status: 'accepted' }),
      makeInvitation({ tournament_referee_id: 41, invitation_status: 'accepted' }),
    ]);

    expect((await refereeService.findActiveRefereeRow(20, 8))?.tournament_referee_id).toBe(40);
  });
});
