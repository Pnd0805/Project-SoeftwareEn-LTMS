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
        throw new AppError(404, 'USER_REWARD_NOT_FOUND', 'เนเธกเนเธเธเธฃเธฒเธเธงเธฑเธฅเธเธตเนเนเธเธเธฑเธเธเธตเธเธญเธเธเธธเธ“');
    }
    return { rewardId, isDisplayed };
}

/**
 * Award primitive for future criteria evaluators. The concrete badge catalogue/rules are not
 * defined in SDS v2, so this intentionally does not invent automatic triggers.
 */
export async function grantReward(userId: number, rewardId: number) {
    await checkUser(userId);
    if (!(await RewardRepo.findActiveRewardById(rewardId))) {
        throw new AppError(404, 'REWARD_NOT_FOUND', 'เนเธกเนเธเธเธฃเธฒเธเธงเธฑเธฅเธเธตเน');
    }
    const granted = await RewardRepo.grantReward(userId, rewardId);
    return { userId, rewardId, granted };
}
