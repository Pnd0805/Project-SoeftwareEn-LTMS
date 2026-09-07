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
}));

vi.mock('../../mappers/user.mapper.js', () => ({
  toUserRef: vi.fn(),
}));

vi.mock('../../utils/checkExist.js', () => ({
  checkTeam: vi.fn(),
}));

import * as teamService from '../team.service.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import * as SportRepo from '../../repositories/sportType.repo.js';
import * as UserRepo from '../../repositories/user.repo.js';
import { toCreateTeam, toMyTeam, toTeamDto } from '../../mappers/team.mapper.js';
import { toUserRef } from '../../mappers/user.mapper.js';
import { checkTeam } from '../../utils/checkExist.js';
import { AppError } from '../../utils/AppError.js';

const mockedTeamRepo = vi.mocked(TeamRepo);
const mockedSportRepo = vi.mocked(SportRepo);
const mockedUserRepo = vi.mocked(UserRepo);
const mockedToCreateTeam = vi.mocked(toCreateTeam);
const mockedToMyTeam = vi.mocked(toMyTeam);
const mockedToTeamDto = vi.mocked(toTeamDto);
const mockedToUserRef = vi.mocked(toUserRef);
const mockedCheckTeam = vi.mocked(checkTeam);

const baseTeamRow = {
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

const teamInput = { name: 'New Team', sportTypeId: 1 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTeam', () => {
  it('creates a team when sport exists, name is free, and quota is not exceeded', async () => {
    mockedSportRepo.findSportTypeById.mockResolvedValue({ sport_type_id: 1, name: 'Football' });
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
    mockedSportRepo.findSportTypeById.mockResolvedValue({ sport_type_id: 1, name: 'Football' });
    mockedTeamRepo.findByNameAndSport.mockResolvedValue(baseTeamRow);

    await expect(teamService.createTeam(teamInput, 5)).rejects.toMatchObject({
      status: 409,
      code: 'TEAM_NAME_TAKEN',
    });
    expect(mockedTeamRepo.countUnofficialTeamsByUser).not.toHaveBeenCalled();
  });

  it('throws TEAM_QUOTA_EXCEEDED when the leader already has 5 unofficial teams', async () => {
    mockedSportRepo.findSportTypeById.mockResolvedValue({ sport_type_id: 1, name: 'Football' });
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
    mockedUserRepo.findById.mockResolvedValue({ user_id: 5, full_name: 'Leader' });
    mockedToUserRef.mockReturnValue({ id: 5, fullName: 'Leader' } as any);
    mockedToTeamDto.mockReturnValue({ id: 10 } as any);

    const result = await teamService.getTeamById(10);

    expect(mockedUserRepo.findById).toHaveBeenCalledWith(5);
    expect(mockedToTeamDto).toHaveBeenCalledWith(baseTeamRow, 4, { id: 5, fullName: 'Leader' });
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
    mockedUserRepo.findById.mockResolvedValue({ user_id: 5 });
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
    mockedUserRepo.findById.mockResolvedValue({ user_id: 5 });
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
    mockedUserRepo.findById.mockResolvedValue({ user_id: 5 });
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
