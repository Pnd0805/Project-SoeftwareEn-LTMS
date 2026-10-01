import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/reward.repo.js', () => ({
    listActiveRewards: vi.fn(),
    findActiveRewardById: vi.fn(),
    listUserRewards: vi.fn(),
    setDisplayed: vi.fn(),
    grantReward: vi.fn(),
}));
vi.mock('../../utils/checkExist.js', () => ({ checkUser: vi.fn() }));

import * as RewardRepo from '../../repositories/reward.repo.js';
import { checkUser } from '../../utils/checkExist.js';
import * as RewardService from '../reward.service.js';

const repo = vi.mocked(RewardRepo);
const mockedCheckUser = vi.mocked(checkUser);

beforeEach(() => {
    vi.clearAllMocks();
    repo.listActiveRewards.mockResolvedValue([]);
    repo.listUserRewards.mockResolvedValue([]);
});

describe('reward.service', () => {
    it('public profile requests only displayed rewards after checking the user exists', async () => {
        mockedCheckUser.mockResolvedValue({} as any);
        await RewardService.listPublicUserRewards(4);
        expect(mockedCheckUser).toHaveBeenCalledWith(4);
        expect(repo.listUserRewards).toHaveBeenCalledWith(4, true);
    });

    it('owner sees displayed and hidden earned rewards', async () => {
        await RewardService.listMyRewards(4);
        expect(repo.listUserRewards).toHaveBeenCalledWith(4, false);
    });

    it('returns 404 when trying to display a reward the user has not earned', async () => {
        repo.setDisplayed.mockResolvedValue(false);
        await expect(RewardService.setMyRewardDisplayed(1, 99, true)).rejects.toMatchObject({
            status: 404,
            code: 'USER_REWARD_NOT_FOUND',
            message: 'ไม่พบรางวัลนี้ในบัญชีของคุณ',
        });
    });

    it('grants an active reward idempotently', async () => {
        mockedCheckUser.mockResolvedValue({} as any);
        repo.findActiveRewardById.mockResolvedValue({ reward_id: 5 } as any);
        repo.grantReward.mockResolvedValue(false);
        await expect(RewardService.grantReward(1, 5)).resolves.toEqual({ userId: 1, rewardId: 5, granted: false });
    });

    it('does not grant an inactive/missing reward', async () => {
        mockedCheckUser.mockResolvedValue({} as any);
        repo.findActiveRewardById.mockResolvedValue(null);
        await expect(RewardService.grantReward(1, 5)).rejects.toMatchObject({
            code: 'REWARD_NOT_FOUND',
            message: 'ไม่พบรางวัลนี้',
        });
        expect(repo.grantReward).not.toHaveBeenCalled();
    });
});
