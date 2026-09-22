import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));

import { findProfileTotals } from '../playerStat.repo.js';

beforeEach(() => vi.clearAllMocks());

describe('findProfileTotals', () => {
  it('reads pickem points, active MVP votes and follower count in one query', async () => {
    mocks.query.mockResolvedValueOnce([[{
      mvp_votes: 3,
      pickem_points: 40,
      follower_count: 7,
    }], []]);

    await expect(findProfileTotals(5)).resolves.toEqual({
      mvp_votes: 3,
      pickem_points: 40,
      follower_count: 7,
    });

    const [sql, values] = mocks.query.mock.calls[0]!;
    expect(sql).toContain('u.total_points AS pickem_points');
    expect(sql).toContain("tf.feedback_type = 'mvp_vote'");
    expect(sql).toContain('tf.removed_at IS NULL');
    expect(sql).toContain('FROM follows f');
    expect(values).toEqual([5]);
  });
});
