import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));

import * as RewardRepo from '../reward.repo.js';

beforeEach(() => vi.clearAllMocks());

describe('reward.repo', () => {
    it('only exposes active rewards', async () => {
        mocks.query.mockResolvedValueOnce([[], []]);
        await RewardRepo.listActiveRewards();
        expect(mocks.query.mock.calls[0]?.[0]).toContain('is_active = TRUE');
    });

    it('filters public user rewards to displayed active rewards', async () => {
        mocks.query.mockResolvedValueOnce([[], []]);
        await RewardRepo.listUserRewards(8, true);
        const [sql, values] = mocks.query.mock.calls[0]!;
        expect(sql).toContain('r.is_active = TRUE');
        expect(sql).toContain('ur.is_displayed = TRUE');
        expect(values).toEqual([8]);
    });

    it('uses INSERT IGNORE so awarding is idempotent', async () => {
        mocks.query.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
        await expect(RewardRepo.grantReward(2, 5)).resolves.toBe(false);
        expect(mocks.query.mock.calls[0]?.[0]).toContain('INSERT IGNORE INTO user_rewards');
        expect(mocks.query.mock.calls[0]?.[1]).toEqual([2, 5]);
    });
});
