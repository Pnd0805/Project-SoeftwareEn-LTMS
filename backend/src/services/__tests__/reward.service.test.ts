import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/reward.repo.js', () => ({
    listActiveRewards: vi.fn(),
    findActiveRewardById: vi.fn(),
    listUserRewards: vi.fn(),
    setDisplayed: vi.fn(),
    grantReward: vi.fn(),
    ownsReward: vi.fn(),
    redeemTx: vi.fn(),
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

describe('badge redemption', () => {
    const badge = {
        reward_id: 7, reward_type: 'badge', name: 'Badge', description: null,
        points_required: 30, criteria: null, icon_key: null, is_active: true,
        created_at: new Date(), updated_at: null,
    } satisfies RewardRepo.RewardRow;

    beforeEach(() => {
        repo.findActiveRewardById.mockResolvedValue(badge);
        repo.ownsReward.mockResolvedValue(false);
        repo.redeemTx.mockResolvedValue({ status: 'redeemed', totalPoints: 20 });
    });

    it('returns the charged price and committed balance', async () => {
        await expect(RewardService.redeemReward(1, 7)).resolves.toEqual({ rewardId: 7, pointsSpent: 30, totalPoints: 20 });
        expect(repo.redeemTx).toHaveBeenCalledWith(1, 7, 30);
    });

    it('rejects a missing or inactive reward before checking ownership', async () => {
        repo.findActiveRewardById.mockResolvedValue(null);
        await expect(RewardService.redeemReward(1, 7)).rejects.toMatchObject({ status: 404, code: 'REWARD_NOT_FOUND' });
        expect(repo.ownsReward).not.toHaveBeenCalled();
        expect(repo.redeemTx).not.toHaveBeenCalled();
    });

    it.each([
        { points_required: null }, { points_required: 0 }, { points_required: -10 },
        { criteria: { stat: 'wins', gte: 1 } }, { reward_type: 'achievement' as const },
    ])('does not sell an automatic or invalid reward %j', async (values) => {
        repo.findActiveRewardById.mockResolvedValue({ ...badge, ...values });
        await expect(RewardService.redeemReward(1, 7)).rejects.toMatchObject({ status: 409, code: 'REWARD_NOT_PURCHASABLE' });
        expect(repo.redeemTx).not.toHaveBeenCalled();
    });

    it('rejects ownership before spending', async () => {
        repo.ownsReward.mockResolvedValue(true);
        await expect(RewardService.redeemReward(1, 7)).rejects.toMatchObject({ status: 409, code: 'REWARD_ALREADY_OWNED' });
        expect(repo.redeemTx).not.toHaveBeenCalled();
    });

    it('maps a concurrent duplicate to the same ownership error', async () => {
        repo.redeemTx.mockResolvedValue({ status: 'already_owned' });
        await expect(RewardService.redeemReward(1, 7)).rejects.toMatchObject({ status: 409, code: 'REWARD_ALREADY_OWNED' });
    });

    it('returns the actual balance and price on insufficient points', async () => {
        repo.redeemTx.mockResolvedValue({ status: 'insufficient_points', totalPoints: 12 });
        await expect(RewardService.redeemReward(1, 7)).rejects.toMatchObject({
            status: 409, code: 'INSUFFICIENT_POINTS', extra: { pointsRequired: 30, totalPoints: 12 },
        });
    });
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
