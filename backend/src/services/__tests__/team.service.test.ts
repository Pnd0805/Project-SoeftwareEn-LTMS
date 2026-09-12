import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/team.repo.js', () => ({
  findById: vi.fn(),
  findTeamsByUser: vi.fn(),
  findByNameAndSport: vi.fn(),
  countUnofficialTeamsByUser: vi.fn(),
  createTeam: vi.fn(),
  countMemberByTeamId: vi.fn(),
  update: vi.fn(),
  deleteTeam: vi.fn(),
  isMemberOf: vi.fn(),
  findTeamMemberById: vi.fn(),
  updateMember: vi.fn(),
  deleteMember: vi.fn(),
  updateStatus: vi.fn(),
  createInvitation: vi.fn(),
  findInvitationsById: vi.fn(),
  findAllInvitationOfTeam: vi.fn(),
  findInvitationsByIdAndTeam: vi.fn(),
  deletePendingInvite: vi.fn(),
  createOfficialRequest: vi.fn(),
  findOfficialRequestById: vi.fn(),
}));

vi.mock('../../repositories/sportType.repo.js', () => ({
  findSportTypeById: vi.fn(),
}));

vi.mock('../../repositories/user.repo.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../mappers/team.mapper.js', () => ({
  toCreateTeam: vi.fn(),
  toMyTeam: vi.fn(),
  toTeamDto: vi.fn(),
  toTeamMemberDto: vi.fn(),
  toCreateTeamInvitation: vi.fn(),
  toUpdateMember: vi.fn(),
  toGetAllInvitation: vi.fn(),
  getTeamOfficialRequestDto: vi.fn(),
}));

vi.mock('../../mappers/user.mapper.js', () => ({
  toUserRef: vi.fn(),
}));

vi.mock('../../utils/checkExist.js', () => ({
  checkTeam: vi.fn(),
  checkUser: vi.fn(),
}));

import * as teamService from '../team.service.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import * as SportRepo from '../../repositories/sportType.repo.js';
import * as UserRepo from '../../repositories/user.repo.js';
import {
  toCreateTeam,
  toMyTeam,
  toTeamDto,
  toTeamMemberDto,
  toCreateTeamInvitation,
  toUpdateMember,
  toGetAllInvitation,
  getTeamOfficialRequestDto,
} from '../../mappers/team.mapper.js';
import { toUserRef } from '../../mappers/user.mapper.js';
import { checkTeam, checkUser } from '../../utils/checkExist.js';
import { AppError } from '../../utils/AppError.js';
import type {
  TeamRow,
  SportTypeRow,
  UserRow,
  TeamMemberRow,
  TeamInvitationRow,
  TeamAdminRequestRow,
} from '../../types/db.js';

const mockedTeamRepo = vi.mocked(TeamRepo);
const mockedSportRepo = vi.mocked(SportRepo);
const mockedUserRepo = vi.mocked(UserRepo);
const mockedToCreateTeam = vi.mocked(toCreateTeam);
const mockedToMyTeam = vi.mocked(toMyTeam);
const mockedToTeamDto = vi.mocked(toTeamDto);
const mockedToTeamMemberDto = vi.mocked(toTeamMemberDto);
const mockedToCreateTeamInvitation = vi.mocked(toCreateTeamInvitation);
const mockedToUpdateMember = vi.mocked(toUpdateMember);
const mockedToGetAllInvitation = vi.mocked(toGetAllInvitation);
const mockedGetTeamOfficialRequestDto = vi.mocked(getTeamOfficialRequestDto);
const mockedToUserRef = vi.mocked(toUserRef);
const mockedCheckTeam = vi.mocked(checkTeam);
const mockedCheckUser = vi.mocked(checkUser);

const baseTeamRow: TeamRow = {
  team_id: 10,
  name: 'Dream Team',
  sport_type_id: 1,
  leader_id: 5,
  readiness_status: 'Forming',
  official_status: 'Unofficial',
  created_at: new Date(),
  updated_at: null,
  last_competed_at: null,
  deleted_at: null,
  deleted_reason: null,
};

const baseSportType: SportTypeRow = {
  sport_type_id: 1,
  name: 'Football',
  min_members: 5,
  max_members: 11,
  default_mode: 'onsite',
};

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    user_id: 5,
    full_name: 'Leader User',
    email: 'leader@example.com',
    password_hash: 'hashed-password',
    gender: 'other',
    birth_date: '1998-01-01',
    user_type: 'student',
    faculty_id: 1,
    department_id: 1,
    year: 4,
    profile_image_key: null,
    contact_info: null,
    address: null,
    is_suspended: 0,
    suspended_reason: null,
    total_points: 0,
    notification_prefs: null,
    profile_edit_log: null,
    created_at: new Date(),
    updated_at: null,
    ...overrides,
  };
}

function makeTeamMember(overrides: Partial<TeamMemberRow> = {}): TeamMemberRow {
  return {
    team_member_id: 1,
    team_id: 10,
    user_id: 5,
    position: 'starter',
    joined_at: new Date(),
    ...overrides,
  };
}

const baseInvitation: TeamInvitationRow = {
  team_invitation_id: 55,
  team_id: 10,
  invited_user_id: 8,
  invited_by_user_id: 5,
  team_invitation_status: 'pending',
  created_at: new Date(),
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  responded_at: null,
};

const officialRequestRow: TeamAdminRequestRow = {
  team_admin_request_id: 77,
  team_id: 10,
  request_type: 'official_status',
  requested_by: 5,
  target_user_id: null,
  team_admin_request_status: 'pending',
  requested_at: new Date(),
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  supporting_docs: ['doc1.pdf'],
};

const teamInput = { name: 'New Team', sportTypeId: 1 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTeam', () => {
  it('creates a team when sport exists, name is free, and quota is not exceeded', async () => {
    mockedSportRepo.findSportTypeById.mockResolvedValue(baseSportType);
    mockedTeamRepo.findByNameAndSport.mockResolvedValue(null);
    mockedTeamRepo.countUnofficialTeamsByUser.mockResolvedValue(2);
    mockedTeamRepo.createTeam.mockResolvedValue(10);
    mockedTeamRepo.findById.mockResolvedValue(baseTeamRow);
    mockedToCreateTeam.mockReturnValue({ id: 10, name: 'New Team' });

    const result = await teamService.createTeam(teamInput, 5);

    expect(mockedTeamRepo.createTeam).toHaveBeenCalledWith(teamInput, 5);
    expect(mockedToCreateTeam).toHaveBeenCalledWith(baseTeamRow);
    expect(result).toEqual({ id: 10, name: 'New Team' });
  });

  it('throws VALIDATION_FAILED when the sport type does not exist', async () => {
    mockedSportRepo.findSportTypeById.mockResolvedValue(null);

    const err: any = await teamService.createTeam(teamInput, 5).catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_FAILED');
    expect(err.extra.fields).toHaveProperty('sportTypeId');
    expect(mockedTeamRepo.findByNameAndSport).not.toHaveBeenCalled();
  });

  it('throws TEAM_NAME_TAKEN when a team with the same name/sport exists', async () => {
    mockedSportRepo.findSportTypeById.mockResolvedValue(baseSportType);
    mockedTeamRepo.findByNameAndSport.mockResolvedValue(baseTeamRow);

    await expect(teamService.createTeam(teamInput, 5)).rejects.toMatchObject({
      status: 409,
      code: 'TEAM_NAME_TAKEN',
    });
    expect(mockedTeamRepo.countUnofficialTeamsByUser).not.toHaveBeenCalled();
  });

  it('throws TEAM_QUOTA_EXCEEDED when the leader already has 5 unofficial teams', async () => {
    mockedSportRepo.findSportTypeById.mockResolvedValue(baseSportType);
    mockedTeamRepo.findByNameAndSport.mockResolvedValue(null);
    mockedTeamRepo.countUnofficialTeamsByUser.mockResolvedValue(5);

    await expect(teamService.createTeam(teamInput, 5)).rejects.toMatchObject({
      status: 422,
      code: 'TEAM_QUOTA_EXCEEDED',
    });
    expect(mockedTeamRepo.createTeam).not.toHaveBeenCalled();
  });
});

describe('getMyTeam', () => {
  it('maps every team the user belongs to, including its member count', async () => {
    const teamA = { ...baseTeamRow, team_id: 1 };
    const teamB = { ...baseTeamRow, team_id: 2 };
    mockedTeamRepo.findTeamsByUser.mockResolvedValue([teamA, teamB]);
    mockedTeamRepo.countMemberByTeamId.mockResolvedValueOnce(3).mockResolvedValueOnce(7);
    mockedToMyTeam
      .mockReturnValueOnce({ id: 1, memberCount: 3 } as any)
      .mockReturnValueOnce({ id: 2, memberCount: 7 } as any);

    const result = await teamService.getMyTeam(99);

    expect(mockedToMyTeam).toHaveBeenNthCalledWith(1, teamA, 3, 99);
    expect(mockedToMyTeam).toHaveBeenNthCalledWith(2, teamB, 7, 99);
    expect(result).toEqual({ items: [{ id: 1, memberCount: 3 }, { id: 2, memberCount: 7 }] });
  });

  it('returns an empty items array when the user has no teams', async () => {
    mockedTeamRepo.findTeamsByUser.mockResolvedValue([]);

    const result = await teamService.getMyTeam(99);

    expect(result).toEqual({ items: [] });
    expect(mockedTeamRepo.countMemberByTeamId).not.toHaveBeenCalled();
  });
});

describe('getTeamById', () => {
  it('returns a team DTO when the team and its leader both exist', async () => {
    mockedCheckTeam.mockResolvedValue(baseTeamRow);
    mockedTeamRepo.countMemberByTeamId.mockResolvedValue(4);
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedToUserRef.mockReturnValue({ id: 5, fullName: 'Leader User' } as any);
    mockedToTeamDto.mockReturnValue({ id: 10 } as any);

    const result = await teamService.getTeamById(10);

    expect(mockedUserRepo.findById).toHaveBeenCalledWith(5);
    expect(mockedToTeamDto).toHaveBeenCalledWith(baseTeamRow, 4, { id: 5, fullName: 'Leader User' });
    expect(result).toEqual({ id: 10 });
  });

  it('throws USER_NOT_FOUND when the leader referenced by the team no longer exists', async () => {
    mockedCheckTeam.mockResolvedValue(baseTeamRow);
    mockedTeamRepo.countMemberByTeamId.mockResolvedValue(4);
    mockedUserRepo.findById.mockResolvedValue(null);

    await expect(teamService.getTeamById(10)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
  });
});

describe('updateTeam', () => {
  it('updates and returns the refreshed team when the new name is free', async () => {
    mockedTeamRepo.findByNameAndSport.mockResolvedValue(null);
    mockedTeamRepo.update.mockResolvedValue(1);
    mockedCheckTeam.mockResolvedValue(baseTeamRow);
    mockedTeamRepo.countMemberByTeamId.mockResolvedValue(4);
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedToUserRef.mockReturnValue({ id: 5 } as any);
    mockedToTeamDto.mockReturnValue({ id: 10, name: 'Renamed' } as any);

    const result = await teamService.updateTeam(10, 1, { name: 'Renamed' });

    expect(mockedTeamRepo.update).toHaveBeenCalledWith(10, { name: 'Renamed' });
    expect(result).toEqual({ id: 10, name: 'Renamed' });
  });

  it('allows renaming a team to its own current name (same team_id)', async () => {
    mockedTeamRepo.findByNameAndSport.mockResolvedValue(baseTeamRow); // team_id 10, same as target
    mockedTeamRepo.update.mockResolvedValue(1);
    mockedCheckTeam.mockResolvedValue(baseTeamRow);
    mockedTeamRepo.countMemberByTeamId.mockResolvedValue(4);
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedToUserRef.mockReturnValue({ id: 5 } as any);
    mockedToTeamDto.mockReturnValue({ id: 10 } as any);

    await expect(teamService.updateTeam(10, 1, { name: 'Dream Team' })).resolves.toBeDefined();
    expect(mockedTeamRepo.update).toHaveBeenCalled();
  });

  it('throws TEAM_NAME_TAKEN when renaming to a name used by a different team', async () => {
    mockedTeamRepo.findByNameAndSport.mockResolvedValue({ ...baseTeamRow, team_id: 999 });

    await expect(teamService.updateTeam(10, 1, { name: 'Taken Name' })).rejects.toMatchObject({
      status: 409,
      code: 'TEAM_NAME_TAKEN',
    });
    expect(mockedTeamRepo.update).not.toHaveBeenCalled();
  });

  it('skips the name-uniqueness check entirely when name is not part of the update', async () => {
    mockedTeamRepo.update.mockResolvedValue(1);
    mockedCheckTeam.mockResolvedValue(baseTeamRow);
    mockedTeamRepo.countMemberByTeamId.mockResolvedValue(4);
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedToUserRef.mockReturnValue({ id: 5 } as any);
    mockedToTeamDto.mockReturnValue({ id: 10 } as any);

    await teamService.updateTeam(10, 1, {});

    expect(mockedTeamRepo.findByNameAndSport).not.toHaveBeenCalled();
  });
});

describe('deleteTeam', () => {
  it('soft-deletes a team that is not already deleted', async () => {
    mockedCheckTeam.mockResolvedValue(baseTeamRow);
    mockedTeamRepo.deleteTeam.mockResolvedValue(1);

    const result = await teamService.deleteTeam(10);

    expect(mockedTeamRepo.deleteTeam).toHaveBeenCalledWith(10);
    expect(result).toBe(1);
  });

  it('throws TEAM_NOT_FOUND when the team is already soft-deleted', async () => {
    mockedCheckTeam.mockResolvedValue({ ...baseTeamRow, deleted_at: new Date() });

    await expect(teamService.deleteTeam(10)).rejects.toMatchObject({
      status: 404,
      code: 'TEAM_NOT_FOUND',
    });
    expect(mockedTeamRepo.deleteTeam).not.toHaveBeenCalled();
  });
});

describe('getTeamMemberById', () => {
  it('returns mapped members when the requesting user belongs to the team', async () => {
    mockedCheckTeam.mockResolvedValue(baseTeamRow);
    mockedTeamRepo.isMemberOf.mockResolvedValue(makeTeamMember());
    const memberRows = [makeTeamMember({ team_member_id: 1, user_id: 5 }), makeTeamMember({ team_member_id: 2, user_id: 6 })];
    mockedTeamRepo.findTeamMemberById.mockResolvedValue(memberRows);
    mockedToTeamMemberDto
      .mockReturnValueOnce({ id: 5 } as any)
      .mockReturnValueOnce({ id: 6 } as any);

    const result = await teamService.getTeamMemberById(10, 5);

    expect(mockedTeamRepo.isMemberOf).toHaveBeenCalledWith(10, 5);
    expect(mockedTeamRepo.findTeamMemberById).toHaveBeenCalledWith(10);
    expect(result).toEqual({ items: [{ id: 5 }, { id: 6 }] });
  });

  it('throws FORBIDDEN when the requesting user is not a member of the team', async () => {
    mockedCheckTeam.mockResolvedValue(baseTeamRow);
    mockedTeamRepo.isMemberOf.mockResolvedValue(null);

    await expect(teamService.getTeamMemberById(10, 5)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    expect(mockedTeamRepo.findTeamMemberById).not.toHaveBeenCalled();
  });
});

describe('updateMember', () => {
  it('updates the member position and returns the refreshed member DTO', async () => {
    mockedTeamRepo.isMemberOf
      .mockResolvedValueOnce(makeTeamMember({ position: 'substitute' }))
      .mockResolvedValueOnce(makeTeamMember({ position: 'starter' }));
    mockedTeamRepo.updateMember.mockResolvedValue(1);
    mockedToUpdateMember.mockReturnValue({ userId: 5, position: 'starter' } as any);

    const result = await teamService.updateMember(5, 10, 'starter');

    expect(mockedTeamRepo.updateMember).toHaveBeenCalledWith(5, 10, 'starter');
    expect(mockedTeamRepo.isMemberOf).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ userId: 5, position: 'starter' });
  });

  it('throws USER_NOT_FOUND when the user is not on the team', async () => {
    mockedTeamRepo.isMemberOf.mockResolvedValue(null);

    await expect(teamService.updateMember(5, 10, 'starter')).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(mockedTeamRepo.updateMember).not.toHaveBeenCalled();
  });
});

describe('deleteMember', () => {
  it('removes the member and leaves the status untouched when the team still meets the minimum', async () => {
    mockedTeamRepo.isMemberOf.mockResolvedValue(makeTeamMember());
    mockedTeamRepo.deleteMember.mockResolvedValue(1);
    mockedTeamRepo.countMemberByTeamId.mockResolvedValue(5);
    mockedSportRepo.findSportTypeById.mockResolvedValue({ ...baseSportType, min_members: 3 });

    await teamService.deleteMember(5, 10, 1);

    expect(mockedTeamRepo.deleteMember).toHaveBeenCalledWith(5, 10);
    expect(mockedTeamRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("reverts the team to 'Forming' when the remaining members drop below the sport's minimum", async () => {
    mockedTeamRepo.isMemberOf.mockResolvedValue(makeTeamMember());
    mockedTeamRepo.deleteMember.mockResolvedValue(1);
    mockedTeamRepo.countMemberByTeamId.mockResolvedValue(2);
    mockedSportRepo.findSportTypeById.mockResolvedValue({ ...baseSportType, min_members: 3 });

    await teamService.deleteMember(5, 10, 1);

    expect(mockedTeamRepo.updateStatus).toHaveBeenCalledWith(10, 'Forming');
  });

  it('throws USER_NOT_FOUND when the target user is not on the team', async () => {
    mockedTeamRepo.isMemberOf.mockResolvedValue(null);

    await expect(teamService.deleteMember(5, 10, 1)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(mockedTeamRepo.deleteMember).not.toHaveBeenCalled();
  });
});

describe('createInvitation', () => {
  it('creates and returns a mapped invitation when the invitee exists and is not already a member', async () => {
    mockedCheckUser.mockResolvedValue(makeUser({ user_id: 8 }));
    mockedTeamRepo.isMemberOf.mockResolvedValue(null);
    mockedTeamRepo.createInvitation.mockResolvedValue(55);
    mockedTeamRepo.findInvitationsById.mockResolvedValue(baseInvitation);
    mockedToCreateTeamInvitation.mockReturnValue({ id: 55 } as any);

    const result = await teamService.createInvitation(10, 8, 5);

    expect(mockedCheckUser).toHaveBeenCalledWith(8);
    expect(mockedTeamRepo.isMemberOf).toHaveBeenCalledWith(10, 8);
    expect(mockedTeamRepo.createInvitation).toHaveBeenCalledWith(10, 8, 5, expect.any(Date));
    expect(result).toEqual({ id: 55 });
  });

  it('throws ALREADY_MEMBER when the invitee is already on the team', async () => {
    mockedCheckUser.mockResolvedValue(makeUser({ user_id: 8 }));
    mockedTeamRepo.isMemberOf.mockResolvedValue(makeTeamMember({ user_id: 8 }));

    await expect(teamService.createInvitation(10, 8, 5)).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_MEMBER',
    });
    expect(mockedTeamRepo.createInvitation).not.toHaveBeenCalled();
  });

  it('propagates the error from checkUser without checking membership', async () => {
    const notFoundError = new AppError(404, 'USER_NOT_FOUND', 'x');
    mockedCheckUser.mockRejectedValue(notFoundError);

    await expect(teamService.createInvitation(10, 8, 5)).rejects.toBe(notFoundError);
    expect(mockedTeamRepo.isMemberOf).not.toHaveBeenCalled();
  });
});

describe('getAllInvitation', () => {
  it('returns every invitation for the team mapped to a DTO', async () => {
    mockedCheckTeam.mockResolvedValue(baseTeamRow);
    const rows = [baseInvitation, { ...baseInvitation, team_invitation_id: 56, invited_user_id: 9 }];
    mockedTeamRepo.findAllInvitationOfTeam.mockResolvedValue(rows);
    mockedToGetAllInvitation
      .mockReturnValueOnce({ id: 55 } as any)
      .mockReturnValueOnce({ id: 56 } as any);

    const result = await teamService.getAllInvitation(10);

    expect(mockedCheckTeam).toHaveBeenCalledWith(10);
    expect(mockedTeamRepo.findAllInvitationOfTeam).toHaveBeenCalledWith(10);
    expect(result).toEqual({ items: [{ id: 55 }, { id: 56 }] });
  });

  it('propagates the error from checkTeam without querying invitations', async () => {
    const notFoundError = new AppError(404, 'TEAM_NOT_FOUND', 'x');
    mockedCheckTeam.mockRejectedValue(notFoundError);

    await expect(teamService.getAllInvitation(10)).rejects.toBe(notFoundError);
    expect(mockedTeamRepo.findAllInvitationOfTeam).not.toHaveBeenCalled();
  });
});

describe('deletePendingInvite', () => {
  it('deletes a pending invitation', async () => {
    mockedCheckTeam.mockResolvedValue(baseTeamRow);
    mockedTeamRepo.findInvitationsByIdAndTeam.mockResolvedValue(baseInvitation);

    await teamService.deletePendingInvite(10, 55);

    expect(mockedTeamRepo.deletePendingInvite).toHaveBeenCalledWith(10, 55);
  });

  it('throws INVITATION_NOT_FOUND when there is no matching invitation', async () => {
    mockedCheckTeam.mockResolvedValue(baseTeamRow);
    mockedTeamRepo.findInvitationsByIdAndTeam.mockResolvedValue(null);

    await expect(teamService.deletePendingInvite(10, 55)).rejects.toMatchObject({
      status: 404,
      code: 'INVITATION_NOT_FOUND',
    });
    expect(mockedTeamRepo.deletePendingInvite).not.toHaveBeenCalled();
  });

  it('throws INVITATION_ALREADY_ANSWERED when the invitation is no longer pending', async () => {
    mockedCheckTeam.mockResolvedValue(baseTeamRow);
    mockedTeamRepo.findInvitationsByIdAndTeam.mockResolvedValue({
      ...baseInvitation,
      team_invitation_status: 'accepted',
      responded_at: new Date(),
    });

    await expect(teamService.deletePendingInvite(10, 55)).rejects.toMatchObject({
      status: 409,
      code: 'INVITATION_ALREADY_ANSWERED',
    });
    expect(mockedTeamRepo.deletePendingInvite).not.toHaveBeenCalled();
  });
});

describe('createOfficialRequest', () => {
  it('creates and returns a mapped official request when supporting docs are attached', async () => {
    mockedCheckTeam.mockResolvedValue(baseTeamRow);
    mockedTeamRepo.createOfficialRequest.mockResolvedValue(77);
    mockedTeamRepo.findOfficialRequestById.mockResolvedValue(officialRequestRow);
    mockedGetTeamOfficialRequestDto.mockReturnValue({ id: 77 } as any);

    const result = await teamService.createOfficialRequest(5, 10, ['doc1.pdf']);

    expect(mockedCheckTeam).toHaveBeenCalledWith(10);
    expect(mockedTeamRepo.createOfficialRequest).toHaveBeenCalledWith(10, 5, ['doc1.pdf']);
    expect(mockedGetTeamOfficialRequestDto).toHaveBeenCalledWith(officialRequestRow);
    expect(result).toEqual({ id: 77 });
  });

  it('throws OFFICIAL_DOCS_REQUIRED with a supportingDocs field when no docs are attached', async () => {
    mockedCheckTeam.mockResolvedValue(baseTeamRow);

    const err: any = await teamService.createOfficialRequest(5, 10, []).catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('OFFICIAL_DOCS_REQUIRED');
    expect(err.extra?.fields).toHaveProperty('supportingDocs');
    expect(mockedTeamRepo.createOfficialRequest).not.toHaveBeenCalled();
  });
});
