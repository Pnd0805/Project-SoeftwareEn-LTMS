import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/user.repo.js', () => ({
  searchByName: vi.fn(),
  update: vi.fn(),
  getMyInvitation: vi.fn(),
}));

vi.mock('../../repositories/team.repo.js', () => ({
  findTeamsByUser: vi.fn(),
}));

vi.mock('../../repositories/playerStat.repo.js', () => ({
  findStatsByUser: vi.fn(),
  findProfileTotals: vi.fn(),
}));

vi.mock('../../repositories/follow.repo.js', () => ({
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
  isFollowing: vi.fn(),
  countFollowers: vi.fn(),
  findFollowers: vi.fn(),
  findFollowing: vi.fn(),
}));

vi.mock('../../repositories/career.repo.js', () => ({
  findCareerByUser: vi.fn(),
}));

vi.mock('../../repositories/adminScope.repo.js', () => ({
  findAdminByUserId: vi.fn(),
}));

vi.mock('../../repositories/userReport.repo.js', () => ({
  create: vi.fn(),
  findByIdJoined: vi.fn(),
}));

vi.mock('../../utils/checkExist.js', () => ({
  checkUser: vi.fn(),
}));

vi.mock('../../mappers/user.mapper.js', () => ({
  toPublicUserDto: vi.fn(),
  toUserRef: vi.fn(),
  toMeDto: vi.fn(),
  toGetMyInvitation: vi.fn(),
}));

vi.mock('../../mappers/team.mapper.js', () => ({
  toTeamRef: vi.fn(),
}));

vi.mock('../../mappers/stat.mapper.js', () => ({
  toUserStatsDto: vi.fn(),
  hiddenUserStatsDto: vi.fn((userId: number) => ({ userId, statsHidden: true })),
}));

vi.mock('../../mappers/career.mapper.js', () => ({
  toCareerTournamentDto: vi.fn(),
}));

vi.mock('../../mappers/userReport.mapper.js', () => ({
  toUserReportDto: vi.fn(),
}));

vi.mock('../upload.service.js', () => ({
  validateAvatarKey: vi.fn(),
  deleteObjectBestEffort: vi.fn(),
  presignAll: vi.fn(),
}));

import * as userService from '../user.service.js';
import * as UserRepo from '../../repositories/user.repo.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import * as StatRepo from '../../repositories/playerStat.repo.js';
import * as FollowRepo from '../../repositories/follow.repo.js';
import * as CareerRepo from '../../repositories/career.repo.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import * as UserReportRepo from '../../repositories/userReport.repo.js';
import { checkUser } from '../../utils/checkExist.js';
import { toPublicUserDto, toUserRef, toMeDto, toGetMyInvitation } from '../../mappers/user.mapper.js';
import { toTeamRef } from '../../mappers/team.mapper.js';
import { toUserStatsDto } from '../../mappers/stat.mapper.js';
import { toCareerTournamentDto } from '../../mappers/career.mapper.js';
import { toUserReportDto } from '../../mappers/userReport.mapper.js';
import * as UploadService from '../upload.service.js';
import { AppError } from '../../utils/AppError.js';
import type { UserRow, TeamRow, TeamInvitationRow } from '../../types/db.js';

const mockedUserRepo = vi.mocked(UserRepo);
const mockedTeamRepo = vi.mocked(TeamRepo);
const mockedStatRepo = vi.mocked(StatRepo);
const mockedFollowRepo = vi.mocked(FollowRepo);
const mockedCareerRepo = vi.mocked(CareerRepo);
const mockedAdminRepo = vi.mocked(AdminRepo);
const mockedUserReportRepo = vi.mocked(UserReportRepo);
const mockedCheckUser = vi.mocked(checkUser);
const mockedToPublicUserDto = vi.mocked(toPublicUserDto);
const mockedToUserRef = vi.mocked(toUserRef);
const mockedToMeDto = vi.mocked(toMeDto);
const mockedToGetMyInvitation = vi.mocked(toGetMyInvitation);
const mockedToTeamRef = vi.mocked(toTeamRef);
const mockedToUserStatsDto = vi.mocked(toUserStatsDto);
const mockedToCareerTournamentDto = vi.mocked(toCareerTournamentDto);
const mockedToUserReportDto = vi.mocked(toUserReportDto);
const mockedUploadService = vi.mocked(UploadService);

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    user_id: 1,
    full_name: 'Test User',
    email: 'test@example.com',
    password_hash: 'hashed-password',
    gender: 'other',
    birth_date: '2000-01-01',
    user_type: 'student',
    faculty_id: 1,
    department_id: 1,
    year: 2,
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

function makeTeam(overrides: Partial<TeamRow> = {}): TeamRow {
  return {
    team_id: 1,
    name: 'Team A',
    sport_type_id: 1,
    leader_id: 5,
    readiness_status: 'Forming',
    official_status: 'Unofficial',
    created_at: new Date(),
    updated_at: null,
    last_competed_at: null,
    deleted_at: null,
    deleted_reason: null,
    ...overrides,
  };
}

const baseUser = makeUser();
const teamRowA = makeTeam({ team_id: 1, name: 'Team A', sport_type_id: 1 });
const teamRowB = makeTeam({ team_id: 2, name: 'Team B', sport_type_id: 2 });

const baseInvitation: TeamInvitationRow = {
  team_invitation_id: 1,
  team_id: 1,
  invited_user_id: 1,
  invited_by_user_id: 5,
  team_invitation_status: 'pending',
  created_at: new Date(),
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  responded_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedFollowRepo.countFollowers.mockResolvedValue(0);
  mockedFollowRepo.isFollowing.mockResolvedValue(false);
  mockedFollowRepo.findFollowers.mockResolvedValue([]);
  mockedFollowRepo.findFollowing.mockResolvedValue([]);
  mockedCareerRepo.findCareerByUser.mockResolvedValue([]);
  mockedAdminRepo.findAdminByUserId.mockResolvedValue(null as any);
  mockedStatRepo.findProfileTotals.mockResolvedValue({ mvp_votes: 0, pickem_points: 0, follower_count: 0 });
});

describe('getUserById', () => {
  it('returns a public user DTO including mapped team refs', async () => {
    mockedCheckUser.mockResolvedValue(baseUser);
    mockedTeamRepo.findTeamsByUser.mockResolvedValue([teamRowA, teamRowB]);
    mockedToTeamRef
      .mockReturnValueOnce({ id: 1, name: 'Team A' } as any)
      .mockReturnValueOnce({ id: 2, name: 'Team B' } as any);
    mockedToPublicUserDto.mockReturnValue({ id: 1, teams: [] } as any);

    const result = await userService.getUserById(1);

    expect(mockedCheckUser).toHaveBeenCalledWith(1);
    expect(mockedTeamRepo.findTeamsByUser).toHaveBeenCalledWith(1);
    // .map(toTeamRef) invokes the callback as (item, index, array), so only
    // assert on the first argument each call actually cares about.
    expect(mockedToTeamRef.mock.calls[0]?.[0]).toEqual(teamRowA);
    expect(mockedToTeamRef.mock.calls[1]?.[0]).toEqual(teamRowB);
    expect(mockedToPublicUserDto).toHaveBeenCalledWith(baseUser, [
      { id: 1, name: 'Team A' },
      { id: 2, name: 'Team B' },
    ], 0, false, false);
    expect(result).toEqual({ id: 1, teams: [] });
  });

  it('propagates the error from checkUser without querying teams', async () => {
    const notFoundError = new AppError(404, 'USER_NOT_FOUND', 'x');
    mockedCheckUser.mockRejectedValue(notFoundError);

    await expect(userService.getUserById(999)).rejects.toBe(notFoundError);
    expect(mockedTeamRepo.findTeamsByUser).not.toHaveBeenCalled();
    expect(mockedToPublicUserDto).not.toHaveBeenCalled();
  });

  it('returns an empty team list when the user is on no teams', async () => {
    mockedCheckUser.mockResolvedValue(baseUser);
    mockedTeamRepo.findTeamsByUser.mockResolvedValue([]);
    mockedToPublicUserDto.mockReturnValue({ id: 1, teams: [] } as any);

    await userService.getUserById(1);

    expect(mockedToTeamRef).not.toHaveBeenCalled();
    expect(mockedToPublicUserDto).toHaveBeenCalledWith(baseUser, [], 0, false, false);
  });
});

describe('getUserStats', () => {
  it('returns stats for an existing user', async () => {
    mockedCheckUser.mockResolvedValue(baseUser);
    mockedStatRepo.findStatsByUser.mockResolvedValue([{ sport_type_id: 1, wins: 3 }] as any);
    mockedToUserStatsDto.mockReturnValue({ userId: 1, stats: [] } as any);

    const result = await userService.getUserStats(1);

    expect(mockedCheckUser).toHaveBeenCalledWith(1);
    expect(mockedStatRepo.findStatsByUser).toHaveBeenCalledWith(1);
    expect(mockedToUserStatsDto).toHaveBeenCalledWith(
      1,
      [{ sport_type_id: 1, wins: 3 }],
      { mvp_votes: 0, pickem_points: 0, follower_count: 0 },
    );
    expect(result).toEqual({ userId: 1, stats: [] });
  });

  /**
   * OD-46 — ด่านอยู่ที่ utils/profileStats (ที่เดียวกับ U06 และ R05)
   * ถามด่านก่อนค้น ไม่ใช่ค้นแล้วทิ้ง ⇒ โปรไฟล์ที่ปิดไว้ไม่กิน query สถิติเลย
   */
  describe('OD-46 — เจ้าของปิดการแสดงสถิติ', () => {
    beforeEach(() => {
      mockedCheckUser.mockResolvedValue(makeUser({ user_id: 1, show_profile_stats: 0 }));
      mockedAdminRepo.findAdminByUserId.mockResolvedValue(null);
    });

    it('คนอื่นได้ชุดที่ซ่อนไว้ และไม่ไปแตะ repo สถิติเลย', async () => {
      const result = await userService.getUserStats(1, 9999);

      expect(result).toEqual({ userId: 1, statsHidden: true });
      expect(mockedStatRepo.findStatsByUser).not.toHaveBeenCalled();
      expect(mockedStatRepo.findProfileTotals).not.toHaveBeenCalled();
      expect(mockedToUserStatsDto).not.toHaveBeenCalled();
    });

    it('คนที่ไม่ล็อกอินก็ไม่เห็น', async () => {
      await expect(userService.getUserStats(1)).resolves.toEqual({ userId: 1, statsHidden: true });
    });

    it('เจ้าตัวยังเห็นสถิติของตัวเอง', async () => {
      mockedStatRepo.findStatsByUser.mockResolvedValue([] as any);
      mockedToUserStatsDto.mockReturnValue({ userId: 1, statsHidden: false } as any);

      await expect(userService.getUserStats(1, 1)).resolves.toEqual({ userId: 1, statsHidden: false });
      expect(mockedStatRepo.findStatsByUser).toHaveBeenCalledWith(1);
    });

    it('แอดมินทะลุได้', async () => {
      mockedAdminRepo.findAdminByUserId.mockResolvedValue({ admin_scope_id: 1 } as any);
      mockedStatRepo.findStatsByUser.mockResolvedValue([] as any);
      mockedToUserStatsDto.mockReturnValue({ userId: 1, statsHidden: false } as any);

      await expect(userService.getUserStats(1, 9500)).resolves.toEqual({ userId: 1, statsHidden: false });
    });
  });

  it('propagates the error from checkUser without querying stats', async () => {
    const notFoundError = new AppError(404, 'USER_NOT_FOUND', 'x');
    mockedCheckUser.mockRejectedValue(notFoundError);

    await expect(userService.getUserStats(999)).rejects.toBe(notFoundError);
    expect(mockedStatRepo.findStatsByUser).not.toHaveBeenCalled();
  });
});

describe('C8 profile engagement', () => {
  it('adds followerCount and viewer-specific isFollowing to a public profile', async () => {
    mockedCheckUser.mockResolvedValue(baseUser);
    mockedTeamRepo.findTeamsByUser.mockResolvedValue([]);
    mockedFollowRepo.countFollowers.mockResolvedValue(12);
    mockedFollowRepo.isFollowing.mockResolvedValue(true);
    mockedToPublicUserDto.mockReturnValue({ id: 1, followerCount: 12, isFollowing: true } as any);

    await userService.getUserById(1, 99);

    expect(mockedFollowRepo.isFollowing).toHaveBeenCalledWith(99, 1);
    expect(mockedToPublicUserDto).toHaveBeenCalledWith(baseUser, [], 12, true, false);
  });

  it('returns MVP, Pickem and follower totals through stats', async () => {
    mockedCheckUser.mockResolvedValue(baseUser);
    mockedStatRepo.findStatsByUser.mockResolvedValue([]);
    mockedStatRepo.findProfileTotals.mockResolvedValue({
      mvp_votes: 7,
      pickem_points: 40,
      follower_count: 5,
    });
    mockedToUserStatsDto.mockReturnValue({ userId: 1 } as any);

    await userService.getUserStats(1);

    expect(mockedToUserStatsDto).toHaveBeenCalledWith(
      1,
      [],
      { mvp_votes: 7, pickem_points: 40, follower_count: 5 },
    );
  });

  it('follows another user idempotently and returns the new follower count', async () => {
    mockedCheckUser.mockResolvedValue(makeUser({ user_id: 2 }));
    mockedFollowRepo.countFollowers.mockResolvedValue(4);

    await expect(userService.followUser(1, 2)).resolves.toEqual({
      userId: 2,
      isFollowing: true,
      followerCount: 4,
    });

    expect(mockedFollowRepo.followUser).toHaveBeenCalledWith(1, 2);
  });

  it('blocks following yourself', async () => {
    await expect(userService.followUser(1, 1)).rejects.toMatchObject({
      status: 409,
      code: 'CANNOT_FOLLOW_SELF',
    });
    expect(mockedFollowRepo.followUser).not.toHaveBeenCalled();
  });

  it('unfollows another user idempotently', async () => {
    mockedCheckUser.mockResolvedValue(makeUser({ user_id: 2 }));
    mockedFollowRepo.countFollowers.mockResolvedValue(3);

    await expect(userService.unfollowUser(1, 2)).resolves.toEqual({
      userId: 2,
      isFollowing: false,
      followerCount: 3,
    });
    expect(mockedFollowRepo.unfollowUser).toHaveBeenCalledWith(1, 2);
  });

  it('maps follower and following lists to public user refs', async () => {
    mockedCheckUser.mockResolvedValue(baseUser);
    const row = {
      user_id: 2,
      full_name: 'Alice',
      profile_image_key: null,
      followed_at: new Date(),
    };
    mockedFollowRepo.findFollowers.mockResolvedValue([row]);
    mockedFollowRepo.findFollowing.mockResolvedValue([row]);
    mockedToUserRef.mockReturnValue({ id: 2, fullName: 'Alice', avatarUrl: null });

    await expect(userService.getFollowers(1)).resolves.toEqual({
      items: [{ id: 2, fullName: 'Alice', avatarUrl: null }],
      count: 1,
    });
    await expect(userService.getFollowing(1)).resolves.toEqual({
      items: [{ id: 2, fullName: 'Alice', avatarUrl: null }],
      count: 1,
    });
  });

  it('returns career by tournament from approved application history', async () => {
    mockedCheckUser.mockResolvedValue(baseUser);
    const row = {
      tournament_id: 10,
      tournament_name: 'KU Cup',
      sport_type_id: 1,
      tournament_status: 'completed' as const,
      team_id: 5,
      team_name: 'Blue',
      played: 3,
      wins: 2,
      losses: 1,
      champion: 1,
    };
    mockedCareerRepo.findCareerByUser.mockResolvedValue([row]);
    mockedToCareerTournamentDto.mockReturnValue({
      tournament: { id: 10, name: 'KU Cup', sportTypeId: 1, status: 'completed' },
      team: { id: 5, name: 'Blue' },
      played: 3,
      wins: 2,
      losses: 1,
      champion: true,
    });

    await expect(userService.getCareer(1)).resolves.toMatchObject({
      items: [{ played: 3, wins: 2, losses: 1, champion: true }],
      statsHidden: false,
    });
  });

  /** OD-46 — ผลงานทัวร์ผูกสวิตช์เดียวกับสถิติ · items เป็น null ไม่ใช่ [] (ดู utils/profileStats) */
  it('OD-46 — เจ้าของปิดสถิติ: career คืน items เป็น null และไม่แตะ repo', async () => {
    mockedCheckUser.mockResolvedValue(makeUser({ user_id: 1, show_profile_stats: 0 }));
    mockedAdminRepo.findAdminByUserId.mockResolvedValue(null);

    await expect(userService.getCareer(1, 9999)).resolves.toEqual({ items: null, statsHidden: true });
    expect(mockedCareerRepo.findCareerByUser).not.toHaveBeenCalled();
  });

  it('OD-46 — เจ้าตัวยังเห็น career ของตัวเอง', async () => {
    mockedCheckUser.mockResolvedValue(makeUser({ user_id: 1, show_profile_stats: 0 }));
    mockedCareerRepo.findCareerByUser.mockResolvedValue([]);

    await expect(userService.getCareer(1, 1)).resolves.toEqual({ items: [], statsHidden: false });
    expect(mockedCareerRepo.findCareerByUser).toHaveBeenCalledWith(1);
  });
});

describe('searchUsers', () => {
  it('throws QUERY_TOO_SHORT for queries under 3 characters', async () => {
    await expect(userService.searchUsers('ab')).rejects.toMatchObject({
      status: 400,
      code: 'QUERY_TOO_SHORT',
    });
    expect(mockedUserRepo.searchByName).not.toHaveBeenCalled();
  });

  it('rejects an empty query as too short', async () => {
    await expect(userService.searchUsers('')).rejects.toMatchObject({
      code: 'QUERY_TOO_SHORT',
    });
  });

  it('returns mapped results for a valid query', async () => {
    const rows = [
      makeUser({ user_id: 1, full_name: 'Alice' }),
      makeUser({ user_id: 2, full_name: 'Alicia' }),
    ];
    mockedUserRepo.searchByName.mockResolvedValue(rows);
    mockedToUserRef
      .mockReturnValueOnce({ id: 1, fullName: 'Alice' } as any)
      .mockReturnValueOnce({ id: 2, fullName: 'Alicia' } as any);

    const result = await userService.searchUsers('ali');

    expect(mockedUserRepo.searchByName).toHaveBeenCalledWith('ali');
    expect(result).toEqual({ items: [{ id: 1, fullName: 'Alice' }, { id: 2, fullName: 'Alicia' }] });
  });

  it('returns an empty items array when no users match', async () => {
    mockedUserRepo.searchByName.mockResolvedValue([]);

    const result = await userService.searchUsers('xyz');

    expect(result).toEqual({ items: [] });
  });

  it('accepts a query exactly 3 characters long (boundary case)', async () => {
    mockedUserRepo.searchByName.mockResolvedValue([]);

    await expect(userService.searchUsers('abc')).resolves.toEqual({ items: [] });
    expect(mockedUserRepo.searchByName).toHaveBeenCalledWith('abc');
  });
});

describe('updateMe', () => {
  it('updates the user then returns the refreshed "me" DTO', async () => {
    mockedUserRepo.update.mockResolvedValue(1);
    mockedCheckUser.mockResolvedValue(baseUser);
    mockedToMeDto.mockReturnValue({ id: 1, fullName: 'Test User' } as any);

    const input = { contactInfo: 'new-contact' } as any;
    const result = await userService.updateMe(1, input);

    expect(mockedUserRepo.update).toHaveBeenCalledWith(1, input);
    expect(mockedCheckUser).toHaveBeenCalledWith(1);
    expect(mockedAdminRepo.findAdminByUserId).toHaveBeenCalledWith(1);
    expect(mockedToMeDto).toHaveBeenCalledWith(baseUser, null);
    expect(result).toEqual({ id: 1, fullName: 'Test User' });
  });

  it('calls update before re-fetching the user (correct ordering)', async () => {
    const callOrder: string[] = [];
    mockedUserRepo.update.mockImplementation(async () => {
      callOrder.push('update');
      return 1;
    });
    mockedCheckUser.mockImplementation(async () => {
      callOrder.push('checkUser');
      return baseUser;
    });
    mockedToMeDto.mockReturnValue({} as any);

    await userService.updateMe(1, {} as any);

    expect(callOrder).toEqual(['update', 'checkUser']);
  });
});

describe('getMyInvitation', () => {
  it('returns every invitation for the user mapped to a DTO', async () => {
    const rows = [baseInvitation, { ...baseInvitation, team_invitation_id: 2, team_id: 2 }];
    mockedUserRepo.getMyInvitation.mockResolvedValue(rows);
    mockedToGetMyInvitation
      .mockReturnValueOnce({ id: 1 } as any)
      .mockReturnValueOnce({ id: 2 } as any);

    const result = await userService.getMyInvitation(1);

    expect(mockedUserRepo.getMyInvitation).toHaveBeenCalledWith(1);
    expect(mockedToGetMyInvitation.mock.calls[0]?.[0]).toEqual(rows[0]);
    expect(mockedToGetMyInvitation.mock.calls[1]?.[0]).toEqual(rows[1]);
    expect(result).toEqual({ items: [{ id: 1 }, { id: 2 }] });
  });

  it('returns an empty items array when the user has no invitations', async () => {
    mockedUserRepo.getMyInvitation.mockResolvedValue([]);

    const result = await userService.getMyInvitation(1);

    expect(result).toEqual({ items: [] });
    expect(mockedToGetMyInvitation).not.toHaveBeenCalled();
  });
});

describe('getMe', () => {
  it('passes the admin scope row into the me DTO', async () => {
    const scope = { user_id: 1, scope: 'faculty' } as any;
    mockedAdminRepo.findAdminByUserId.mockResolvedValue(scope);
    mockedToMeDto.mockReturnValue({ id: 1 } as any);

    const result = await userService.getMe(baseUser);

    expect(mockedAdminRepo.findAdminByUserId).toHaveBeenCalledWith(baseUser.user_id);
    expect(mockedToMeDto).toHaveBeenCalledWith(baseUser, scope);
    expect(result).toEqual({ id: 1 });
  });

  it('passes null for non-admin users', async () => {
    mockedToMeDto.mockReturnValue({ id: 1 } as any);

    await userService.getMe(baseUser);

    expect(mockedToMeDto).toHaveBeenCalledWith(baseUser, null);
  });
});

describe('fileUserReport', () => {
  it('creates a report and returns the mapped DTO', async () => {
    mockedCheckUser.mockResolvedValue(makeUser({ user_id: 2 }));
    mockedUserReportRepo.create.mockResolvedValue(10 as any);
    mockedUserReportRepo.findByIdJoined.mockResolvedValue({ id: 10, evidence: ['report_evidence/1/a.png'] } as any);
    mockedUploadService.presignAll.mockResolvedValue(['https://s3.test/a.png?sig=x']);
    mockedToUserReportDto.mockReturnValue({ id: 10 } as any);

    const result = await userService.fileUserReport(1, 2, 'spam', ['report_evidence/1/a.png']);

    expect(mockedCheckUser).toHaveBeenCalledWith(2);
    expect(mockedUserReportRepo.create).toHaveBeenCalledWith(1, 2, 'spam', ['report_evidence/1/a.png']);
    expect(mockedUserReportRepo.findByIdJoined).toHaveBeenCalledWith(10);
    expect(result).toEqual({ id: 10 });
  });

  /**
   * หลักฐานถูกส่งออกเป็น presigned URL แล้ว (แก้ 1 ต.ค. 2569) ⇒ ขาเข้าต้องกันด้วย
   * ไม่งั้นใครก็ยื่นคำร้องแนบ key ของคนอื่น แล้วให้ระบบเซ็นลิงก์ไฟล์นั้นออกมาให้
   * กฎเดียวกับ dispute_evidence ใน matchResult/matchResultComplaint.service
   */
  it('ปฏิเสธ key ที่ไม่ใช่ของผู้แจ้ง โดยไม่บันทึกคำร้อง', async () => {
    mockedCheckUser.mockResolvedValue(makeUser({ user_id: 2 }));

    await expect(userService.fileUserReport(1, 2, 'spam', ['report_evidence/99/a.png'])).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    expect(mockedUserReportRepo.create).not.toHaveBeenCalled();
  });

  it('ปฏิเสธ key ที่อัปไว้คนละ purpose แม้จะเป็นไฟล์ของตัวเอง', async () => {
    mockedCheckUser.mockResolvedValue(makeUser({ user_id: 2 }));

    await expect(userService.fileUserReport(1, 2, 'spam', ['avatar/1/a.png'])).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    expect(mockedUserReportRepo.create).not.toHaveBeenCalled();
  });

  it('แนบหลักฐานหลายไฟล์ ต้องเป็นของผู้แจ้งทุกไฟล์ ไม่ใช่แค่ไฟล์แรก', async () => {
    mockedCheckUser.mockResolvedValue(makeUser({ user_id: 2 }));

    await expect(userService.fileUserReport(1, 2, 'spam',
      ['report_evidence/1/a.png', 'report_evidence/99/b.png'])).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    expect(mockedUserReportRepo.create).not.toHaveBeenCalled();
  });

  it('ไม่แนบหลักฐานเลยก็ยื่นได้ ไม่ติดด่านตรวจ key', async () => {
    mockedCheckUser.mockResolvedValue(makeUser({ user_id: 2 }));
    mockedUserReportRepo.create.mockResolvedValue(11 as any);
    mockedUserReportRepo.findByIdJoined.mockResolvedValue({ id: 11, evidence: null } as any);
    mockedUploadService.presignAll.mockResolvedValue([]);
    mockedToUserReportDto.mockReturnValue({ id: 11 } as any);

    await expect(userService.fileUserReport(1, 2, 'spam', [])).resolves.toEqual({ id: 11 });
    expect(mockedUserReportRepo.create).toHaveBeenCalledWith(1, 2, 'spam', []);
  });

  it('blocks reporting yourself without creating a report', async () => {
    mockedCheckUser.mockResolvedValue(baseUser);

    await expect(userService.fileUserReport(1, 1, 'x', [])).rejects.toMatchObject({
      status: 400,
      code: 'CANNOT_REPORT_SELF',
    });
    expect(mockedUserReportRepo.create).not.toHaveBeenCalled();
  });

  it('propagates the error from checkUser without creating a report', async () => {
    const notFoundError = new AppError(404, 'USER_NOT_FOUND', 'x');
    mockedCheckUser.mockRejectedValue(notFoundError);

    await expect(userService.fileUserReport(1, 999, 'x', [])).rejects.toBe(notFoundError);
    expect(mockedUserReportRepo.create).not.toHaveBeenCalled();
  });
});
