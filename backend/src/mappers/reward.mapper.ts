import type { RewardRow, UserRewardRow } from '../repositories/reward.repo.js';

export type RewardDto = {
    id: number;
    type: RewardRow['reward_type'];
    name: string;
    description: string | null;
    pointsRequired: number | null;
    criteria: unknown | null;
    iconKey: string | null;
};

export type UserRewardDto = RewardDto & {
    earnedAt: string;
    isDisplayed: boolean;
};

export function toRewardDto(row: RewardRow): RewardDto {
    return {
        id: row.reward_id,
        type: row.reward_type,
        name: row.name,
        description: row.description,
        pointsRequired: row.points_required,
        criteria: row.criteria,
        iconKey: row.icon_key,
    };
}

export function toUserRewardDto(row: UserRewardRow): UserRewardDto {
    return {
        ...toRewardDto(row),
        earnedAt: row.earned_at.toISOString(),
        isDisplayed: Boolean(row.is_displayed),
    };
}
