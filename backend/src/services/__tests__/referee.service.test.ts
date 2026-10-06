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
  // ★ ต้อง mock ด้วย — ของจริง findAcceptedByUser เรียกตัวนี้ต่อ และ F14 เรียกตัวนี้ตรง ๆ
  //   ถ้าไม่มี เทสจะพังด้วย "No findAcceptedByUsers export" ไม่ใช่เงียบ ๆ ไปต่อฐานจริง
  findAcceptedByUsers: vi.fn().mockResolvedValue([]),
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
    email_verified: 0,
    token_version: 0,
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
    // crossTournamentWarnings — 🆕 6 ต.ค. (ทางเลือก ก) · 0 = แมตช์ที่แนบมาไม่ทับงานในทัวร์อื่น
    // ★ เป็นคำเตือนไม่ใช่ด่าน — ORG ยังเชิญได้ ด่านจริงอยู่ตอนกรรมการกดรับ
    // 🔴 isExternal: true แม้ body ส่ง false มา — 6 ต.ค. ระบบคิดจากโดเมนอีเมลเอง
    //   fixture ใช้ ref@example.com ซึ่งไม่ใช่ @ku.th ⇒ เป็นคนนอก · ดู describe ท้ายไฟล์
    expect(result).toEqual({ id: 99, userId: 8, invitationStatus: 'pending', isExternal: true, matchIds: [], crossTournamentWarnings: 0 });
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
    expect(result).toEqual({ id: 100, userId: 8, invitationStatus: 'pending', isExternal: true, matchIds: [], crossTournamentWarnings: 0 });
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
    // 🔴 6 ต.ค. — ตัวเลขสรุปนับจาก `status` ที่ toRefereeStatus ตัดสิน ไม่ใช่เขียนเงื่อนไขซ้ำ
    //   ⇒ stub ต้องมี status ด้วย (ของเดิมมีแค่ invitationStatus)
    mockedToTournamentRefereeDto
      .mockReturnValueOnce({ id: 1, invitationStatus: 'accepted', status: 'active' } as any)
      .mockReturnValueOnce({ id: 2, invitationStatus: 'pending', status: 'pending' } as any);

    const result = await refereeService.listTournamentReferees(20);

    expect(mockedRefRepo.findLatestPerUserByTournament).toHaveBeenCalledWith(20);
    expect(result).toEqual({
      items: [
        { id: 1, invitationStatus: 'accepted', status: 'active' },
        { id: 2, invitationStatus: 'pending', status: 'pending' },
      ],
      acceptedCount: 1,
      awaitingAdminCount: 0,
    });
  });

  it('returns acceptedCount 0 when none of the referees have accepted', async () => {
    const rows = [makeInvitation({ tournament_referee_id: 1 })];
    mockedRefRepo.findLatestPerUserByTournament.mockResolvedValue(rows as never);
    mockedToTournamentRefereeDto.mockReturnValue({ id: 1, invitationStatus: 'pending', status: 'pending' } as any);

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

  /**
   * 🔴 เทส "เส้นต่อ" ไม่ใช่เทสของตัวด่าน — ด่านเองมี describe ของตัวเองท้ายไฟล์แล้ว
   *   ข้อนี้พิสูจน์ว่า acceptRefereeInvitation **เรียกด่านนั้นจริง**
   *   ★ เขียนเพราะลอง mutation แล้วพบว่าถอดบรรทัดที่เรียกด่านออกจาก acceptRefereeInvitation
   *     เทสทั้ง 2953 ตัวยังเขียวหมด = ด่านถูกทดสอบแต่ "สายไฟ" ไม่ถูกทดสอบ
   *     ซึ่งเป็นแบบเดียวกับที่ mock ขาดคีย์แล้วเทสวัดสาขาผิด (fa9e2b9)
   */
  it('ทางเลือก ก — ปฏิเสธการตอบรับเมื่อแมตช์ที่เลือกทับกับงานในทัวร์อื่น', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ invitation_status: 'pending', is_external: 0 }));
    // ★ ใช้ ...Once ทั้งคู่โดยเจตนา — beforeEach ของไฟล์นี้ใช้ clearAllMocks ซึ่ง
    //   **ไม่ล้าง implementation** ⇒ mockResolvedValue จะรั่วไปทำให้เทสถัดไปเพี้ยน
    //   (เจอจริงตอนเขียนข้อนี้: declinedMatchIds ของเทสถัดไปกลายเป็น [1])
    vi.mocked(MatchRefRepo.findByTournamentReferees).mockResolvedValueOnce([
      { match_id: 1, scheduled_time: new Date('2026-11-01T11:00:00Z'), scheduled_end_time: new Date('2026-11-01T12:00:00Z') },
    ] as never);
    // งานที่เขารับไว้แล้วในทัวร์อื่น 10:00–11:30 ⇒ ทับกับ 11:00–12:00
    // ★ stub ที่ findAcceptedByUsers (ไม่ใช่ตัวเดี่ยว) เพราะ bookingsOfReferees เรียกตัวนี้
    //   ⇒ ถ้า stub ผิดตัว ค่าที่ queue ไว้จะไม่ถูกใช้ แล้วไปโผล่ในเทสถัดไปที่เรียกตัวเดี่ยว
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValueOnce([{
      match_referee_id: 1, tournament_referee_id: 5, user_id: 8,
      invitation_status: 'accepted', is_external: 0, external_approval_status: 'not_required', removed_at: null,
      match_id: 77, round_number: 1,
      scheduled_time: new Date('2026-11-01T10:00:00Z'), scheduled_end_time: new Date('2026-11-01T11:30:00Z'),
      venue: null, mode: 'onsite', match_status: 'scheduled',
      tournament_id: 999, tournament_name: 'ทัวร์อื่น', sport_type_id: 1,
      team_a_id: null, team_a_name: null, team_b_id: null, team_b_name: null,
    }] as never);

    await expect(refereeService.acceptRefereeInvitation(1, 8, { matchIds: [1] }))
      .rejects.toMatchObject({ status: 409, code: 'REFEREE_TIME_CONFLICT_CROSS_TOURNAMENT' });
    // 🔴 สำคัญกว่าตัว error: ต้องไม่เขียนลงฐานเลย
    expect(mockedRefRepo.accept).not.toHaveBeenCalled();
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

  /**
   * 🔴 บั๊กที่แก้ 6 ต.ค. 2569 — เดิม F14 จับกลุ่มด้วย `tournament_referee_id` (id ของแถวคำเชิญ)
   * ⇒ คนเดียวที่มีหลายแถว active ในทัวร์เดียวกัน ถูกมองเป็นกรรมการหลายคน และ **ไม่เทียบเวลากัน**
   * ⇒ เวลาทับกันแต่ coverage เงียบ · ORG ไม่เห็นอะไรเลย
   *
   * ★ เคสนี้เกิดจริงในฐาน dev (ทัวร์ 2 มี 9002 accepted ค้างสามแถว) — ดูคอมเมนต์ที่ inviteReferee
   *   และ GUIDE/11 §10.3 เขียนเจตนาไว้ว่าหา "REF ที่มี 2 แมตช์ทับกัน" ซึ่ง REF คือ **คน** ไม่ใช่แถว
   */
  it('จับกลุ่มด้วยคน ไม่ใช่แถวคำเชิญ — คนเดียวสองแถว active ในทัวร์เดียวกันต้องยังเจอว่าเวลาทับ', async () => {
    mockedSportTypeRepo.findStatDefinitionsBySportType.mockResolvedValue([]);
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([
      coverageRow({ match_id: 1, tournament_referee_id: 5, user_id: 70,
                    scheduled_time: new Date('2026-10-01T10:00:00Z'), scheduled_end_time: new Date('2026-10-01T11:30:00Z') }),
      // คนเดิม (user 70) แต่มาจากคำเชิญอีกแถว (tr 6) — เดิมโค้ดมองเป็นคนละคน ⇒ ไม่เทียบเวลา
      coverageRow({ match_id: 2, tournament_referee_id: 6, user_id: 70,
                    scheduled_time: new Date('2026-10-01T11:00:00Z'), scheduled_end_time: new Date('2026-10-01T12:00:00Z') }),
    ]);

    const result = await refereeService.getRefereeCoverage(20, 1);

    expect(result.conflicts).toEqual([{ tournamentRefereeId: 5, userId: 70, matchIds: [1, 2] }]);
  });

  /** คนละคนจริง ๆ เวลาทับกันได้ ไม่ใช่ conflict — กันการแก้เกินจนรายงานมั่ว */
  it('กรรมการสองคนคุมแมตช์ที่เวลาทับกัน ไม่ใช่ conflict', async () => {
    mockedSportTypeRepo.findStatDefinitionsBySportType.mockResolvedValue([]);
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([
      coverageRow({ match_id: 1, tournament_referee_id: 5, user_id: 70,
                    scheduled_time: new Date('2026-10-01T10:00:00Z'), scheduled_end_time: new Date('2026-10-01T11:30:00Z') }),
      coverageRow({ match_id: 2, tournament_referee_id: 6, user_id: 71,
                    scheduled_time: new Date('2026-10-01T11:00:00Z'), scheduled_end_time: new Date('2026-10-01T12:00:00Z') }),
    ]);

    const result = await refereeService.getRefereeCoverage(20, 1);

    expect(result.conflicts).toEqual([]);
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
      matchesTotal: 0, matchesCovered: 0, uncovered: [], conflicts: [], crossTournamentConflicts: [],
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
 * แก้ 1 ต.ค. 2569: เดิมทั้งสามที่เรียก findLatestByTournamentAndUser (ลบฟังก์ชันนั้นไปแล้ว 4 ต.ค.) แล้วถาม isActiveReferee กับแถวนั้นแถวเดียว
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

// ───────────────────────────── ด่านทับเวลา "ข้ามทัวร์" (ทางเลือก ก · 6 ต.ค. 2569) ─────────────────────────────

/**
 * 🔴 ช่องโหว่ที่ FE รายงาน 6 ต.ค. — ด่านตรวจเวลาซ้อนทุกจุดเดิมดูแค่แมตช์ **ในทัวร์เดียวกัน**
 *   ทัวร์ A เชิญคุม 10:00 · ทัวร์ B เชิญคุม 10:30 วันเดียวกัน ⇒ ผ่านทั้งตอนเชิญและตอนรับ
 *   และ F14 ของทั้งสองทัวร์ก็ไม่เห็น เพราะแต่ละอันดูแค่ทัวร์ตัวเอง
 *
 * ★ ด่านอยู่ที่ **ตอนกรรมการกดรับ** ไม่ใช่ตอน ORG เชิญ — ORG แก้ของทัวร์อื่นไม่ได้
 */
describe('assertNoCrossTournamentConflict (ทางเลือก ก)', () => {
  const T0 = new Date('2026-11-01T10:00:00Z');
  const T1 = new Date('2026-11-01T11:30:00Z');

  /** แถวจาก findAcceptedByUser — ต้องมีคอลัมน์ที่ isActiveReferee() ใช้ให้ครบ */
  const booked = (over: Record<string, unknown> = {}) => ({
    match_referee_id: 1, tournament_referee_id: 5, user_id: 8,
    invitation_status: 'accepted', is_external: 0, external_approval_status: 'not_required', removed_at: null,
    match_id: 77, round_number: 1, scheduled_time: T0, scheduled_end_time: T1,
    venue: null, mode: 'onsite', match_status: 'scheduled',
    tournament_id: 999, tournament_name: 'ทัวร์อื่น', sport_type_id: 1,
    team_a_id: null, team_a_name: null, team_b_id: null, team_b_name: null,
    ...over,
  }) as never;

  const incoming = (over: Record<string, unknown> = {}) => ({
    match_id: 1, scheduled_time: new Date('2026-11-01T11:00:00Z'),
    scheduled_end_time: new Date('2026-11-01T12:00:00Z'), ...over,
  }) as never;

  it('ทับกับงานในทัวร์อื่น ⇒ 409 และบอกชื่อทัวร์ที่ชน', async () => {
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([booked()]);

    const err: any = await refereeService.assertNoCrossTournamentConflict(8, [incoming()]).catch((e) => e);

    expect(err).toMatchObject({ status: 409, code: 'REFEREE_TIME_CONFLICT_CROSS_TOURNAMENT' });
    // ★ บอกชื่อทัวร์ได้ เพราะ error ไปถึง **เจ้าของตาราง** เท่านั้น ไม่ได้ไปถึง ORG คนอื่น
    expect(err.message).toContain('ทัวร์อื่น');
    expect(err.extra).toMatchObject({ matchId: 1, conflictsWith: { matchId: 77, tournamentId: 999 } });
  });

  it('ไม่ทับกัน ⇒ ผ่าน', async () => {
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([booked()]);

    await expect(refereeService.assertNoCrossTournamentConflict(8, [
      incoming({ scheduled_time: new Date('2026-11-01T11:30:00Z'), scheduled_end_time: new Date('2026-11-01T12:30:00Z') }),
    ])).resolves.toBeUndefined();
  });

  /** ชนกันแบบประชิด — จบ 11:30 แล้วเริ่ม 11:30 ไม่ใช่การทับ (ช่วงเป็น [เริ่ม, จบ) เหมือนทุกด่าน) */
  it('จบพอดีแล้วเริ่มทันที ไม่ใช่การทับ', async () => {
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([booked()]);

    await expect(refereeService.assertNoCrossTournamentConflict(8, [
      incoming({ scheduled_time: T1, scheduled_end_time: new Date('2026-11-01T13:00:00Z') }),
    ])).resolves.toBeUndefined();
  });

  /**
   * 🔴 แถวที่ไม่ active ต้องไม่นับ — ถ้านับ คนที่ถูกถอดไปแล้วจะรับงานใหม่ไม่ได้ตลอดไป
   *   เพราะงานเก่าที่เขาไม่ต้องไปคุมแล้ว ยังกันเขาอยู่
   */
  it('แถวกรรมการที่ถูกถอดแล้ว ไม่นับเป็นงานที่ถืออยู่', async () => {
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([booked({ removed_at: new Date() })]);

    await expect(refereeService.assertNoCrossTournamentConflict(8, [incoming()])).resolves.toBeUndefined();
  });

  it('คนนอกที่แอดมินยังไม่อนุมัติ ไม่นับเป็นงานที่ถืออยู่', async () => {
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([
      booked({ is_external: 1, external_approval_status: 'pending' }),
    ]);

    await expect(refereeService.assertNoCrossTournamentConflict(8, [incoming()])).resolves.toBeUndefined();
  });

  /** แมตช์ที่จบไปแล้วไม่มีใครต้องไปอยู่ที่นั้น ⇒ ไม่ใช่การทับ */
  it('แมตช์ที่จบแล้ว ไม่นับเป็นงานที่ถืออยู่', async () => {
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([booked({ match_status: 'completed' })]);

    await expect(refereeService.assertNoCrossTournamentConflict(8, [incoming()])).resolves.toBeUndefined();
  });

  /**
   * ★ แมตช์ที่เลยเวลาแต่ยัง `scheduled` **ยังนับ** — มันคือแมตช์ที่กำลังเริ่มช้า
   *   คนยังต้องอยู่ที่นั้น ⇒ ถ้าตัดด้วย "เวลาผ่านไปแล้ว" ด่านจะเปิดช่องให้รับงานทับได้
   */
  it('แมตช์ที่เลยเวลาแต่ยัง scheduled ยังนับเป็นงานที่ถืออยู่', async () => {
    const past0 = new Date(Date.now() - 60 * 60 * 1000);
    const past1 = new Date(Date.now() + 30 * 60 * 1000);
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([
      booked({ scheduled_time: past0, scheduled_end_time: past1, match_status: 'scheduled' }),
    ]);

    await expect(refereeService.assertNoCrossTournamentConflict(8, [
      incoming({ scheduled_time: new Date(Date.now()), scheduled_end_time: new Date(Date.now() + 60 * 60 * 1000) }),
    ])).rejects.toMatchObject({ code: 'REFEREE_TIME_CONFLICT_CROSS_TOURNAMENT' });
  });

  /** แมตช์ที่กำลังจะปล่อยไป (เคสแลกแมตช์) ไม่ใช่งานที่ยังถืออยู่ ⇒ ไม่ควรกันตัวเอง */
  it('แมตช์ที่อยู่ใน excludeMatchIds ไม่นับ', async () => {
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([booked()]);

    await expect(refereeService.assertNoCrossTournamentConflict(8, [incoming()], [77]))
      .resolves.toBeUndefined();
  });

  /** แมตช์เดียวกันที่อยู่ทั้งในชุดใหม่และในของที่ถือไว้ = แมตช์เดิม ไม่ใช่คู่ขัดแย้ง */
  it('แมตช์เดียวกันกับที่ถืออยู่แล้ว ไม่ใช่การทับกับตัวเอง', async () => {
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([booked({ match_id: 1 })]);

    await expect(refereeService.assertNoCrossTournamentConflict(8, [
      incoming({ match_id: 1, scheduled_time: T0, scheduled_end_time: T1 }),
    ])).resolves.toBeUndefined();
  });

  it('แมตช์ที่ยังไม่มีเวลา ⇒ ไม่ตรวจ (ด่าน MATCH_NOT_SCHEDULED จับไปแล้วก่อนหน้า)', async () => {
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([booked()]);

    await expect(refereeService.assertNoCrossTournamentConflict(8, [
      incoming({ scheduled_time: null, scheduled_end_time: null }),
    ])).resolves.toBeUndefined();
    // ไม่ควรเสียเวลาไปอ่านตารางเลยถ้าไม่มีอะไรให้เทียบ
    expect(MatchRefRepo.findAcceptedByUsers).not.toHaveBeenCalled();
  });
});

/**
 * 🆕 F14 ท่อนที่สอง — crossTournamentConflicts (FE ขอ 6 ต.ค. 2569)
 *
 * 🔴 ทำไมต้องมีทั้งที่มีด่านตอนกรรมการกดรับแล้ว:
 *   ด่านนั้นดักตอนกดรับ ⇒ ตอนนั้นเวลายังไม่ทับ
 *   แต่ M06 ปล่อยให้ ORG เลื่อนเวลาแมตช์ได้โดยไม่ดูกรรมการ (มติ Q6 — เตือน ไม่ block)
 *   ⇒ "เลื่อนแล้วเพิ่งทับ" ไม่มีใครรู้ · หน้านี้คือที่เดียวที่บอกได้
 */
describe('getRefereeCoverage — crossTournamentConflicts', () => {
  /** แมตช์ในทัวร์ 20 (ทัวร์ที่ ORG เปิดดู) ที่กรรมการ 70 ถืออยู่ */
  const here = (over: Record<string, unknown> = {}) => ({
    match_id: 1, round_number: 1,
    scheduled_time: new Date('2026-10-01T10:00:00Z'), scheduled_end_time: new Date('2026-10-01T11:30:00Z'),
    mode: 'onsite', tournament_referee_id: 5, user_id: 70,
    invitation_status: 'accepted', is_external: 0, external_approval_status: 'not_required', removed_at: null,
    ...over,
  }) as never;

  /** งานที่กรรมการ 70 ถืออยู่ — ค่าตั้งต้นอยู่ "ทัวร์อื่น" (999) */
  const held = (over: Record<string, unknown> = {}) => ({
    match_referee_id: 9, tournament_referee_id: 5, user_id: 70,
    invitation_status: 'accepted', is_external: 0, external_approval_status: 'not_required', removed_at: null,
    match_id: 77, round_number: 1,
    scheduled_time: new Date('2026-10-01T11:00:00Z'), scheduled_end_time: new Date('2026-10-01T12:00:00Z'),
    venue: null, mode: 'onsite', match_status: 'scheduled',
    tournament_id: 999, tournament_name: 'ทัวร์อื่น', sport_type_id: 1,
    team_a_id: null, team_a_name: null, team_b_id: null, team_b_name: null,
    ...over,
  }) as never;

  beforeEach(() => {
    mockedSportTypeRepo.findStatDefinitionsBySportType.mockResolvedValue([]);
  });

  it('ทับกับงานในทัวร์อื่น ⇒ บอก userId + matchId ของทัวร์นี้ + จำนวน', async () => {
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([here()]);
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([held()]);

    const result = await refereeService.getRefereeCoverage(20, 1);

    expect(result.crossTournamentConflicts).toEqual([{ userId: 70, matchId: 1, conflictCount: 1 }]);
  });

  /**
   * 🔴 ข้อสำคัญเรื่องความเป็นส่วนตัว — ห้ามมีชื่อทัวร์หรือรหัสแมตช์ของทัวร์อื่นหลุดออกไป
   *   ตารางงานของกรรมการในทัวร์อื่นไม่ใช่ข้อมูลของ ORG คนนี้ (กฎเดียวกับตอนเชิญ)
   */
  it('ไม่หลุดชื่อทัวร์อื่นหรือรหัสแมตช์ของทัวร์อื่นออกไปเลย', async () => {
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([here()]);
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([held()]);

    const result = await refereeService.getRefereeCoverage(20, 1);

    const dumped = JSON.stringify(result);
    expect(dumped).not.toContain('ทัวร์อื่น');
    expect(dumped).not.toContain('77');
    expect(dumped).not.toContain('999');
  });

  /** ★ ทับกันเองในทัวร์นี้ รายงานที่ conflicts อยู่แล้ว ⇒ ต้องไม่นับซ้ำที่นี่ */
  it('งานที่อยู่ในทัวร์เดียวกันนี้ ไม่นับเป็นการทับข้ามทัวร์', async () => {
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([here()]);
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([held({ tournament_id: 20 })]);

    const result = await refereeService.getRefereeCoverage(20, 1);

    expect(result.crossTournamentConflicts).toEqual([]);
  });

  it('เวลาไม่ทับ ⇒ ไม่รายงาน', async () => {
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([here()]);
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([held({
      scheduled_time: new Date('2026-10-01T13:00:00Z'), scheduled_end_time: new Date('2026-10-01T14:00:00Z'),
    })]);

    const result = await refereeService.getRefereeCoverage(20, 1);

    expect(result.crossTournamentConflicts).toEqual([]);
  });

  it('ทับหลายแมตช์ ⇒ conflictCount เป็นจำนวนแมตช์ ไม่ใช่จำนวนทัวร์', async () => {
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([here()]);
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([
      held({ match_id: 77 }),
      held({ match_id: 78, tournament_id: 998, tournament_name: 'ทัวร์ที่สาม' }),
    ]);

    const result = await refereeService.getRefereeCoverage(20, 1);

    expect(result.crossTournamentConflicts).toEqual([{ userId: 70, matchId: 1, conflictCount: 2 }]);
  });

  /** ★ ใช้กฎ "งานที่ถืออยู่" ชุดเดียวกับด่านตอนกดรับ — ถูกถอด/จบแล้ว/ไม่มีเวลา ไม่นับ */
  it.each([
    ['ถูกถอดจากทัวร์นั้นแล้ว', { removed_at: new Date() }],
    ['แมตช์จบแล้ว',            { match_status: 'completed' }],
    ['แข่งจบรอผล',             { match_status: 'finished' }],
    ['คนนอกที่แอดมินยังไม่อนุมัติ', { is_external: 1, external_approval_status: 'pending' }],
    ['ยังไม่มีเวลาจบ',          { scheduled_end_time: null }],
  ])('งานที่ %s ไม่นับเป็นการทับ', async (_name, over) => {
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([here()]);
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([held(over)]);

    const result = await refereeService.getRefereeCoverage(20, 1);

    expect(result.crossTournamentConflicts).toEqual([]);
  });

  /**
   * ★ แมตช์ของทัวร์นี้ที่ยังไม่ได้ตั้งเวลา เทียบไม่ได้ ⇒ ข้าม ไม่ใช่รายงานว่าไม่ทับ
   *   (ไม่ควร throw เพราะหน้า coverage ต้องเปิดดูได้แม้ตารางยังไม่เสร็จ)
   */
  it('แมตช์ของทัวร์นี้ที่ยังไม่มีเวลา ถูกข้ามไปเฉย ๆ', async () => {
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([here({ scheduled_time: null, scheduled_end_time: null })]);
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([held()]);

    const result = await refereeService.getRefereeCoverage(20, 1);

    expect(result.crossTournamentConflicts).toEqual([]);
  });

  /**
   * 🔴 ไม่มีกรรมการเลย ⇒ ต้องไม่ยิงคิวรีด้วย userIds ว่าง
   *   `IN ()` เป็น SQL ที่ MySQL ไม่ยอมรับ ⇒ ถ้าหลุดไปจะพังทั้งหน้า ไม่ใช่คืนค่าว่าง
   */
  it('ทัวร์ที่ยังไม่มีกรรมการ active เลย ⇒ ไม่ยิงคิวรีงานที่ถืออยู่', async () => {
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([
      here({ tournament_referee_id: null, user_id: null }),
    ]);

    const result = await refereeService.getRefereeCoverage(20, 1);

    expect(result.crossTournamentConflicts).toEqual([]);
    expect(MatchRefRepo.findAcceptedByUsers).toHaveBeenCalledWith([]);
  });

  it('กรรมการหลายคน ⇒ ถามฐานครั้งเดียว ไม่ใช่วนถามทีละคน', async () => {
    mockedMatchRepo.findRefereeCoverage.mockResolvedValue([
      here(),
      here({ match_id: 2, tournament_referee_id: 6, user_id: 71 }),
    ]);
    vi.mocked(MatchRefRepo.findAcceptedByUsers).mockResolvedValue([held()]);

    await refereeService.getRefereeCoverage(20, 1);

    expect(MatchRefRepo.findAcceptedByUsers).toHaveBeenCalledTimes(1);
    expect(MatchRefRepo.findAcceptedByUsers).toHaveBeenCalledWith([70, 71]);
  });
});

/**
 * 🆕 มติ 6 ต.ค. 2569 — "คนนี้เป็นคนนอกไหม" คิดจากโดเมนอีเมล ไม่เชื่อ checkbox ของ ORG
 *
 * 🔴 ช่องที่ปิด: เดิม `isExternal` มาจาก request body ตรง ๆ และระบบไม่มีข้อมูลใดเลย
 *   ให้ตรวจสอบ (users.user_type hardcode 'student' ทุกคน · ไม่มีใครเขียน 'external' ได้)
 *   ⇒ ขั้นตอนยืนยันตัวตนกรรมการภายนอกทั้งเส้น (ส่งเอกสาร → แอดมินตรวจ → 4 ด่านที่กัน
 *     คนที่ยังไม่ผ่าน) ถูกข้ามได้ด้วยการ **ไม่ติ๊กช่องเดียว**
 *   และ ORG มีแรงจูงใจให้ไม่ติ๊ก เพราะติ๊กแล้วกรรมการต้องรอแอดมินก่อนคุมแมตช์ได้
 *
 * ★ ยังรับฟิลด์เดิมจาก body (ไม่ breaking) แต่ไม่ใช้ตัดสิน — ค่าที่คืนไปคือค่าจริงที่คิดได้
 *
 * 🔴 มติ 7 ต.ค. 2569 — **ไม่** เปลี่ยนไปอ่าน users.user_type (เหตุผลเต็มอยู่หัว inviteReferee)
 *   ระบบสมัครเขียนคอลัมน์นั้นให้แล้วจริง แต่ไม่มีใครแก้คอลัมน์นั้นได้หลังสมัคร และอีเมลก็เปลี่ยนไม่ได้
 *   ⇒ สองทางให้คำตอบเดียวกันเสมอ · สลับแล้วไม่ได้อะไรเพิ่ม
 *   จะสลับเมื่อมีทางแก้ "ชนิดผู้ใช้" ได้จริง (เช่น ปุ่มของแอดมิน) แล้วคอลัมน์จะมีความหมาย
 */
describe('inviteReferee — คนนอกคิดจากอีเมล ไม่ใช่จาก body', () => {
  beforeEach(() => {
    mockedRefRepo.findActiveByTournamentAndUser.mockResolvedValue([]);
    mockedRefRepo.create.mockResolvedValue(99);
  });

  it('อีเมล @ku.th = คนใน แม้ ORG ติ๊กว่าเป็นคนนอก', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser({ email: 'somchai.j@ku.th' }));

    const result = await refereeService.inviteReferee(20, 5, makeInviteInput({ isExternal: true }));

    expect(mockedRefRepo.create).toHaveBeenCalledWith(expect.objectContaining({ isExternal: false }));
    expect(result).toMatchObject({ isExternal: false });
  });

  it('อีเมลโดเมนอื่น = คนนอก แม้ ORG ไม่ติ๊ก', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser({ email: 'somchai@gmail.com' }));

    const result = await refereeService.inviteReferee(20, 5, makeInviteInput({ isExternal: false }));

    expect(mockedRefRepo.create).toHaveBeenCalledWith(expect.objectContaining({ isExternal: true }));
    expect(result).toMatchObject({ isExternal: true });
  });

  /**
   * 🔴 โดเมนต้องตรงทั้งก้อน — เทียบแบบ endsWith จะทำให้ปลอมเป็นคนในได้ง่ายมาก
   *   จดโดเมน fake-ku.th แล้วสมัคร = กลายเป็นคนในทันที
   */
  it.each([
    ['โดเมนที่ลงท้ายคล้ายกัน', 'a@fake-ku.th'],
    ['โดเมนที่มีคำว่า ku.th อยู่ข้างใน', 'a@ku.th.evil.com'],
    ['subdomain ที่ไม่ใช่ ku.th', 'a@mail.ku.th.co'],
  ])('%s = คนนอก', async (_name, email) => {
    mockedUserRepo.findById.mockResolvedValue(makeUser({ email }));

    const result = await refereeService.inviteReferee(20, 5, makeInviteInput({ isExternal: false }));

    expect(result).toMatchObject({ isExternal: true });
  });

  it('ตัวพิมพ์ใหญ่ในโดเมนยังเป็นคนใน', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser({ email: 'Somchai@KU.TH' }));

    const result = await refereeService.inviteReferee(20, 5, makeInviteInput({ isExternal: true }));

    expect(result).toMatchObject({ isExternal: false });
  });

  /**
   * 🔴 เทส "มีฟัน" ของมติ 7 ต.ค. — ค่ามาจาก **อีเมล** ไม่ใช่จาก users.user_type
   *
   * ตั้งค่าสองตัวให้ขัดกันโดยเจตนา: user_type บอกว่าเป็นคนใน · อีเมลบอกว่าเป็นคนนอก
   * ⇒ ถ้าใครเปลี่ยน inviteReferee ไปอ่านคอลัมน์ user_type เทสสองข้อนี้จะแดงทันที
   *
   * 🙋 ถึงคนที่มาเจอเทสนี้แดง — **อย่าแก้เทสให้เขียว** ให้อ่านเหตุผลก่อน
   *   มติคือยังไม่สลับ เพราะไม่มีใครแก้ users.user_type ได้หลังสมัคร (ไม่มี endpoint เลย)
   *   และอีเมลก็เปลี่ยนไม่ได้ ⇒ สองทางให้คำตอบเดียวกัน สลับแล้วไม่ได้อะไรเพิ่ม
   *   ถ้าจะสลับจริง ต้องมี 2 อย่างก่อน:
   *     ① ทางแก้ชนิดผู้ใช้ (ปุ่มของแอดมิน) ไม่งั้นคอลัมน์ไม่มีความหมายกว่าอีเมล
   *     ② ย้อนอัปเดตแถวที่สร้างก่อน 6 ต.ค. 2569 (เป็น 'student' ทั้งหมด รวมคนที่ใช้อีเมลนอก)
   *   แล้วค่อยกลับมาแก้เทสนี้พร้อมอธิบายว่าทำครบแล้ว
   */
  it.each([
    ['user_type student แต่อีเมล gmail ⇒ คนนอก', 'student' as const, 'nok@gmail.com', true],
    ['user_type external แต่อีเมล ku.th ⇒ คนใน', 'external' as const, 'nai@ku.th', false],
  ])('%s', async (_name, userType, email, expected) => {
    mockedUserRepo.findById.mockResolvedValue(makeUser({ user_type: userType, email }));

    const result = await refereeService.inviteReferee(20, 5, makeInviteInput());

    expect(mockedRefRepo.create).toHaveBeenCalledWith(expect.objectContaining({ isExternal: expected }));
    expect(result).toMatchObject({ isExternal: expected });
  });
});

/**
 * 🔴 ตัวเลขสรุปของ F02 (แก้ 6 ต.ค. 2569) — "รอแอดมินตรวจ" ต้องไม่รวมคนที่แอดมินปฏิเสธแล้ว
 *
 * สูตรเดิม awaitingAdminCount = (ตอบรับทั้งหมด) − (พร้อมทำงาน)
 *   ⇒ คนที่ถูกปฏิเสธก็ "ตอบรับแล้วและไม่พร้อมทำงาน" ⇒ ถูกนับเป็นรอแอดมินด้วย
 *   ⇒ ผู้จัดเห็น "รอแอดมินตรวจ 1 คน" ค้างตลอดไป แล้วรอสิ่งที่ไม่เกิด
 *     ไม่ไปหากรรมการคนใหม่ (พิสูจน์บนฐานจำลองแล้ว: หลังปฏิเสธ 0 → 1)
 * ★ ข้อมูลที่ถูกมีอยู่ใน items[].status แล้ว — ผิดแค่ตัวเลขสรุป
 */
describe('listTournamentReferees — ตัวเลขสรุปต้องตรงกับ status', () => {
  const dto = (id: number, status: string) => ({ id, status }) as never;

  const setup = (statuses: string[]) => {
    mockedRefRepo.findLatestPerUserByTournament.mockResolvedValue(
      statuses.map((_, i) => makeInvitation({ tournament_referee_id: i + 1 })) as never);
    mockedToTournamentRefereeDto.mockReset();
    for(const [i, st] of statuses.entries()) mockedToTournamentRefereeDto.mockReturnValueOnce(dto(i + 1, st));
  };

  it('คนที่แอดมินปฏิเสธ ไม่ถูกนับเป็น "รอแอดมิน"', async () => {
    setup(['active', 'rejected_by_admin']);

    const result = await refereeService.listTournamentReferees(20);

    expect(result.acceptedCount).toBe(1);
    expect(result.awaitingAdminCount).toBe(0);
  });

  it('คนที่รอแอดมินจริง ถูกนับ', async () => {
    setup(['active', 'pending_admin', 'pending_admin']);

    const result = await refereeService.listTournamentReferees(20);

    expect(result.acceptedCount).toBe(1);
    expect(result.awaitingAdminCount).toBe(2);
  });

  /** ★ สถานะอื่นไม่เข้าทั้งสองช่อง — รอตอบคำเชิญ / ปฏิเสธเอง / ถูกถอด */
  it.each(['pending', 'declined', 'removed'])('สถานะ %s ไม่เข้าทั้งสองตัวเลข', async (st) => {
    setup(['active', st]);

    const result = await refereeService.listTournamentReferees(20);

    expect(result.acceptedCount).toBe(1);
    expect(result.awaitingAdminCount).toBe(0);
  });

  it('ไม่มีใครเลย = 0 ทั้งคู่', async () => {
    setup([]);

    const result = await refereeService.listTournamentReferees(20);

    expect(result).toMatchObject({ acceptedCount: 0, awaitingAdminCount: 0 });
  });
});
