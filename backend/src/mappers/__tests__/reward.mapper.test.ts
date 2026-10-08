import { describe, expect, it } from 'vitest';
import { toRewardDto, toUserRewardDto } from '../reward.mapper.js';

const base = {
    reward_id: 7,
    reward_type: 'badge' as const,
    name: 'Champion',
    description: 'Won a tournament',
    points_required: null,
    criteria: { type: 'championships', min: 1 },
    icon_key: 'reward_icon/champion.png',
    is_active: true,
    created_at: new Date('2026-09-01T00:00:00Z'),
    updated_at: null,
};

describe('reward.mapper', () => {
    it('maps reward metadata without exposing storage bookkeeping', () => {
        expect(toRewardDto(base)).toEqual({
            id: 7,
            type: 'badge',
            name: 'Champion',
            description: 'Won a tournament',
            pointsRequired: null,
            criteria: { type: 'championships', min: 1 },
            iconKey: 'reward_icon/champion.png',
        });
    });

    it('adds ownership/display metadata for earned rewards', () => {
        expect(toUserRewardDto({
            ...base,
            user_reward_id: 9,
            user_id: 3,
            earned_at: new Date('2026-09-20T10:00:00Z'),
            is_displayed: true,
        })).toMatchObject({
            id: 7,
            earnedAt: '2026-09-20T10:00:00.000Z',
            isDisplayed: true,
        });
    });
});
