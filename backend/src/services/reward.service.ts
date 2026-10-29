import * as RewardRepo from '../repositories/reward.repo.js';
import { toRewardDto, toUserRewardDto } from '../mappers/reward.mapper.js';
import { checkUser } from '../utils/checkExist.js';
import { AppError } from '../utils/AppError.js';

export async function listRewards() {
    return { items: (await RewardRepo.listActiveRewards()).map(toRewardDto) };
}

export async function listPublicUserRewards(userId: number) {
    await checkUser(userId);
    return { items: (await RewardRepo.listUserRewards(userId, true)).map(toUserRewardDto) };
}

export async function listMyRewards(userId: number) {
    return { items: (await RewardRepo.listUserRewards(userId, false)).map(toUserRewardDto) };
}

export async function setMyRewardDisplayed(userId: number, rewardId: number, isDisplayed: boolean) {
    const updated = await RewardRepo.setDisplayed(userId, rewardId, isDisplayed);
    if (!updated) {
        throw new AppError(404, 'USER_REWARD_NOT_FOUND', 'ไม่พบรางวัลนี้ในบัญชีของคุณ');
    }
    return { rewardId, isDisplayed };
}

export async function redeemReward(userId: number, rewardId: number) {
    const reward = await RewardRepo.findActiveRewardById(rewardId);
    if (!reward) throw new AppError(404, 'REWARD_NOT_FOUND', 'ไม่พบรางวัลนี้');
    const price = reward.points_required;
    if (price === null || price <= 0 || reward.reward_type !== 'badge' || reward.criteria !== null) {
        throw new AppError(409, 'REWARD_NOT_PURCHASABLE', 'รางวัลนี้ไม่สามารถแลกด้วยแต้มได้');
    }
    if (await RewardRepo.ownsReward(userId, rewardId)) {
        throw new AppError(409, 'REWARD_ALREADY_OWNED', 'คุณมีรางวัลนี้อยู่แล้ว');
    }
    const result = await RewardRepo.redeemTx(userId, rewardId, price);
    switch (result.status) {
        case 'already_owned':
            throw new AppError(409, 'REWARD_ALREADY_OWNED', 'คุณมีรางวัลนี้อยู่แล้ว');
        case 'insufficient_points':
            throw new AppError(409, 'INSUFFICIENT_POINTS', 'แต้มของคุณไม่เพียงพอ', {
                pointsRequired: price, totalPoints: result.totalPoints
            });
        case 'redeemed':
            return { rewardId, pointsSpent: price, totalPoints: result.totalPoints };
    }
}

/**
 * Award primitive for future criteria evaluators. The concrete badge catalogue/rules are not
 * defined in SDS v2, so this intentionally does not invent automatic triggers.
 */
export async function grantReward(userId: number, rewardId: number) {
    await checkUser(userId);
    if (!(await RewardRepo.findActiveRewardById(rewardId))) {
        throw new AppError(404, 'REWARD_NOT_FOUND', 'ไม่พบรางวัลนี้');
    }
    const granted = await RewardRepo.grantReward(userId, rewardId);
    return { userId, rewardId, granted };
}
