import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/user.repo.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../repositories/team.repo.js', () => ({
  findById: vi.fn(),
}));

import { checkUser, checkTeam } from '../checkExist.js';
import * as UserRepo from '../../repositories/user.repo.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import { AppError } from '../AppError.js';

const mockedUserRepo = vi.mocked(UserRepo);
const mockedTeamRepo = vi.mocked(TeamRepo);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkUser', () => {
  it('returns the user row when the user exists', async () => {
    const user = { user_id: 1, full_name: 'Test User' };
    mockedUserRepo.findById.mockResolvedValue(user as any);

    const result = await checkUser(1);

    expect(mockedUserRepo.findById).toHaveBeenCalledWith(1);
    expect(result).toBe(user);
  });

  it('throws USER_NOT_FOUND when the user does not exist', async () => {
    mockedUserRepo.findById.mockResolvedValue(null);

    await expect(checkUser(999)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
  });

  it('throws an AppError instance, not a plain Error', async () => {
    mockedUserRepo.findById.mockResolvedValue(null);

    const err = await checkUser(999).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('checkTeam', () => {
  it('returns the team row when the team exists', async () => {
    const team = { team_id: 10, name: 'Dream Team' };
    mockedTeamRepo.findById.mockResolvedValue(team as any);

    const result = await checkTeam(10);

    expect(mockedTeamRepo.findById).toHaveBeenCalledWith(10);
    expect(result).toBe(team);
  });

  it('throws TEAM_NOT_FOUND when the team does not exist', async () => {
    mockedTeamRepo.findById.mockResolvedValue(null);

    await expect(checkTeam(999)).rejects.toMatchObject({
      status: 404,
      code: 'TEAM_NOT_FOUND',
    });
  });

  it('does not treat a soft-deleted team (deleted_at set) as non-existent', async () => {
    // checkTeam only cares whether a row was found at all — the deleted_at
    // check is the caller's responsibility (see team.service.ts deleteTeam).
    const deletedTeam = { team_id: 10, name: 'Old Team', deleted_at: new Date() };
    mockedTeamRepo.findById.mockResolvedValue(deletedTeam as any);

    await expect(checkTeam(10)).resolves.toBe(deletedTeam);
  });
});
