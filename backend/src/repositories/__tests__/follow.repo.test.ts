import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));

import * as FollowRepo from '../follow.repo.js';

beforeEach(() => vi.clearAllMocks());

describe('follow.repo', () => {
  it('uses INSERT IGNORE so follow is idempotent', async () => {
    mocks.query.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    await FollowRepo.followUser(1, 2);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT IGNORE INTO follows'),
      [1, 2],
    );
  });

  it('deletes the exact follower/followed pair', async () => {
    mocks.query.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    await FollowRepo.unfollowUser(1, 2);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM follows'),
      [1, 2],
    );
  });

  it('counts and checks follows without loading user private data', async () => {
    mocks.query
      .mockResolvedValueOnce([[{ count: 4 }], []])
      .mockResolvedValueOnce([[{ one: 1 }], []]);

    await expect(FollowRepo.countFollowers(2)).resolves.toBe(4);
    await expect(FollowRepo.isFollowing(1, 2)).resolves.toBe(true);
  });
});
