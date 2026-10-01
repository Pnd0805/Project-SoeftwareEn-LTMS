import pool from '../config/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export type RewardRow = {
    reward_id: number;
    reward_type: 'badge' | 'achievement';
    name: string;
    description: string | null;
    points_required: number | null;
    criteria: unknown | null;
    icon_key: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date | null;
};

export type UserRewardRow = RewardRow & {
    user_reward_id: number;
    user_id: number;
    earned_at: Date;
    is_displayed: boolean;
};

export async function listActiveRewards(): Promise<RewardRow[]> {
    const [rows] = await pool.query<(RewardRow & RowDataPacket)[]>(
        `SELECT * FROM rewards WHERE is_active = TRUE ORDER BY reward_type, reward_id`
    );
    return rows;
}

export async function findActiveRewardById(rewardId: number): Promise<RewardRow | null> {
    const [rows] = await pool.query<(RewardRow & RowDataPacket)[]>(
        `SELECT * FROM rewards WHERE reward_id = ? AND is_active = TRUE`,
        [rewardId]
    );
    return rows[0] ?? null;
}

export async function listUserRewards(userId: number, displayedOnly: boolean): Promise<UserRewardRow[]> {
    const [rows] = await pool.query<(UserRewardRow & RowDataPacket)[]>(
        `SELECT ur.user_reward_id, ur.user_id, ur.earned_at, ur.is_displayed,
                r.reward_id, r.reward_type, r.name, r.description, r.points_required,
                r.criteria, r.icon_key, r.is_active, r.created_at, r.updated_at
           FROM user_rewards ur
           JOIN rewards r ON r.reward_id = ur.reward_id
          WHERE ur.user_id = ? AND r.is_active = TRUE${displayedOnly ? ' AND ur.is_displayed = TRUE' : ''}
          ORDER BY ur.earned_at DESC, ur.user_reward_id DESC`,
        [userId]
    );
    return rows;
}

export async function setDisplayed(userId: number, rewardId: number, isDisplayed: boolean): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE user_rewards SET is_displayed = ? WHERE user_id = ? AND reward_id = ?`,
        [isDisplayed, userId, rewardId]
    );
    return result.affectedRows > 0;
}

/** Future auto-award hooks call this. UNIQUE(user_id,reward_id) makes granting idempotent. */
export async function grantReward(userId: number, rewardId: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT IGNORE INTO user_rewards (user_id, reward_id) VALUES (?, ?)`,
        [userId, rewardId]
    );
    return result.affectedRows > 0;
}
