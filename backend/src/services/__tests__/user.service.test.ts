import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/user.repo.js', () => ({
  searchByName: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../repositories/team.repo.js', () => ({
  findTeamsByUser: vi.fn(),
}));

vi.mock('../../repositories/playerStat.repo.js', () => ({
  findStatsByUser: vi.fn(),
}));

vi.mock('../../utils/checkExist.js', () => ({
  checkUser: vi.fn(),
}));

vi.mock('../../mappers/user.mapper.js', () => ({
  toPublicUserDto: vi.fn(),
  toUserRef: vi.fn(),
  toMeDto: vi.fn(),
}));

vi.mock('../../mappers/team.mapper.js', () => ({
  toTeamRef: vi.fn(),
}));

vi.mock('../../mappers/stat.mapper.js', () => ({
  toUserStatsDto: vi.fn(),
}));

import * as userService from '../user.service.js';
import * as UserRepo from '../../repositories/user.repo.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import * as StatRepo from '../../repositories/playerStat.repo.js';
import { checkUser } from '../../utils/checkExist.js';
import { toPublicUserDto, toUserRef, toMeDto } from '../../mappers/user.mapper.js';
import { toTeamRef } from '../../mappers/team.mapper.js';
import { toUserStatsDto } from '../../mappers/stat.mapper.js';
import { AppError } from '../../utils/AppError.js';

const mockedUserRepo = vi.mocked(UserRepo);
const mockedTeamRepo = vi.mocked(TeamRepo);
const mockedStatRepo = vi.mocked(StatRepo);
const mockedCheckUser = vi.mocked(checkUser);
const mockedToPublicUserDto = vi.mocked(toPublicUserDto);
const mockedToUserRef = vi.mocked(toUserRef);
const mockedToMeDto = vi.mocked(toMeDto);
const mockedToTeamRef = vi.mocked(toTeamRef);
const mockedToUserStatsDto = vi.mocked(toUserStatsDto);

const baseUser = { user_id: 1, full_name: 'Test User' };
const teamRowA = { team_id: 1, name: 'Team A', sport_type_id: 1 };
const teamRowB = { team_id: 2, name: 'Team B', sport_type_id: 2 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getUserById', () => {
  it('returns a public user DTO including mapped team refs', async () => {
    mockedCheckUser.mockResolvedValue(baseUser as any);
    mockedTeamRepo.findTeamsByUser.mockResolvedValue([teamRowA, teamRowB] as any);
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
    ]);
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
    mockedCheckUser.mockResolvedValue(baseUser as any);
    mockedTeamRepo.findTeamsByUser.mockResolvedValue([]);
    mockedToPublicUserDto.mockReturnValue({ id: 1, teams: [] } as any);

    await userService.getUserById(1);

    expect(mockedToTeamRef).not.toHaveBeenCalled();
    expect(mockedToPublicUserDto).toHaveBeenCalledWith(baseUser, []);
  });
});

describe('getUserStats', () => {
  it('returns stats for an existing user', async () => {
    mockedCheckUser.mockResolvedValue(baseUser as any);
    mockedStatRepo.findStatsByUser.mockResolvedValue([{ sport_type_id: 1, wins: 3 }] as any);
    mockedToUserStatsDto.mockReturnValue({ userId: 1, stats: [] } as any);

    const result = await userService.getUserStats(1);

    expect(mockedCheckUser).toHaveBeenCalledWith(1);
    expect(mockedStatRepo.findStatsByUser).toHaveBeenCalledWith(1);
    expect(mockedToUserStatsDto).toHaveBeenCalledWith(1, [{ sport_type_id: 1, wins: 3 }]);
    expect(result).toEqual({ userId: 1, stats: [] });
  });

  it('propagates the error from checkUser without querying stats', async () => {
    const notFoundError = new AppError(404, 'USER_NOT_FOUND', 'x');
    mockedCheckUser.mockRejectedValue(notFoundError);

    await expect(userService.getUserStats(999)).rejects.toBe(notFoundError);
    expect(mockedStatRepo.findStatsByUser).not.toHaveBeenCalled();
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
      { user_id: 1, full_name: 'Alice', profile_image_key: null },
      { user_id: 2, full_name: 'Alicia', profile_image_key: null },
    ];
    mockedUserRepo.searchByName.mockResolvedValue(rows as any);
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
    mockedCheckUser.mockResolvedValue(baseUser as any);
    mockedToMeDto.mockReturnValue({ id: 1, fullName: 'Test User' } as any);

    const input = { contactInfo: 'new-contact' } as any;
    const result = await userService.updateMe(1, input);

    expect(mockedUserRepo.update).toHaveBeenCalledWith(1, input);
    expect(mockedCheckUser).toHaveBeenCalledWith(1);
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
      return baseUser as any;
    });
    mockedToMeDto.mockReturnValue({} as any);

    await userService.updateMe(1, {} as any);

    expect(callOrder).toEqual(['update', 'checkUser']);
  });
});
