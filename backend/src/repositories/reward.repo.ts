import pool from '../config/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { parseCriteria, isStatCriteria, SPOT_ON_POINTS } from '../config/rewardCriteria.js';

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

// ───────────────────────── OD-57 · ตัวแจกเหรียญ ─────────────────────────
// ทุกฟังก์ชันรับ `conn` เพราะต้องทำงานในทรานแซกชันของคนเรียก (ปิดทัวร์ / ตัดสินผลแมตช์)
// `grantReward` ตัวเดิมใช้ `pool` จึงเข้าทรานแซกชันไม่ได้ — คงไว้ให้คนที่เรียกนอก tx ใช้ต่อ

/** รายการเหรียญที่เปิดใช้ อ่านผ่าน conn เดียวกับคนเรียก (เห็นของที่เพิ่งเขียนใน tx ด้วย) */
export async function listActiveRewardsTx(conn: PoolConnection): Promise<RewardRow[]> {
    const [rows] = await conn.query<(RewardRow & RowDataPacket)[]>(
        `SELECT * FROM rewards WHERE is_active = TRUE ORDER BY reward_type, reward_id`
    );
    return rows;
}

/**
 * แจกเหรียญสายสถิติให้ผู้เล่นทุกคนที่ลงแข่งในทัวร์ที่เพิ่งปิด
 *
 * ★ ต้องเรียก **หลัง** อัปเดต `championships` ในทรานแซกชันเดียวกัน ไม่งั้นเหรียญแชมป์
 *   จะอ่านค่าก่อนบวกแล้วช้าไปหนึ่งทัวร์เสมอ
 *
 * ชื่อคอลัมน์มาจาก `criteria` ซึ่งแอดมินแก้ได้ จึงผ่าน allowlist ของ `parseCriteria` ก่อนต่อเป็น SQL
 * `INSERT IGNORE` + UNIQUE(user_id, reward_id) ทำให้เรียกซ้ำไม่ได้เหรียญซ้ำ
 */
export async function grantStatRewardsForTournamentTx(
    conn: PoolConnection, tournamentId: number, sportTypeId: number
): Promise<number> {
    let granted = 0;
    for (const reward of await listActiveRewardsTx(conn)) {
        const criteria = parseCriteria(reward.criteria);
        if (criteria === null || !isStatCriteria(criteria)) continue;   // เกณฑ์อ่านไม่ออก = ไม่แจกใคร

        const [result] = await conn.query<ResultSetHeader>(
            `INSERT IGNORE INTO user_rewards (user_id, reward_id)
             SELECT DISTINCT ap.user_id, ?
               FROM application_players ap
               JOIN tournament_applications ta ON ta.tournament_application_id = ap.tournament_application_id
               JOIN player_profile_stats s ON s.user_id = ap.user_id AND s.sport_type_id = ?
              WHERE ta.tournament_id = ? AND ta.tournament_application_status = 'approved'
                AND s.\`${criteria.stat}\` >= ?`,
            [reward.reward_id, sportTypeId, tournamentId, criteria.gte]
        );
        granted += result.affectedRows;
    }
    return granted;
}

/**
 * ประเมินเหรียญสาย Pick'em ใหม่ให้ทุกคนที่ทายแมตช์นี้ — **แจกหรือริบ** (มติ OD-57)
 *
 * ผลแมตช์ถอนได้ (`undoOutcomeTx` ล้าง `points_earned` กลับเป็น NULL) เหรียญจึงต้องถอนได้ด้วย
 * ไม่งั้นคนที่เคยทายแม่นจะถือเหรียญค้างทั้งที่เงื่อนไขไม่จริงแล้ว
 *
 * ★ ไม่ใช่แค่ DELETE ของแมตช์นี้ — ต้องนับใหม่ทั้งหมดว่ายังครบเกณฑ์ไหม
 *   เพราะเกณฑ์เป็นยอดรวมข้ามแมตช์ ถอนแมตช์เดียวอาจยังครบอยู่ก็ได้
 */
export async function evaluatePickemRewardsTx(
    conn: PoolConnection, matchId: number
): Promise<{ granted: number; revoked: number }> {
    const [pickers] = await conn.query<({ user_id: number } & RowDataPacket)[]>(
        `SELECT DISTINCT user_id FROM pickem_predictions WHERE match_id = ?`, [matchId]
    );
    const userIds = pickers.map(r => r.user_id);
    if (userIds.length === 0) return { granted: 0, revoked: 0 };

    let granted = 0, revoked = 0;
    for (const reward of await listActiveRewardsTx(conn)) {
        const criteria = parseCriteria(reward.criteria);
        if (criteria === null || isStatCriteria(criteria)) continue;

        const [ins] = await conn.query<ResultSetHeader>(
            `INSERT IGNORE INTO user_rewards (user_id, reward_id)
             SELECT user_id, ? FROM pickem_predictions
              WHERE user_id IN (?) AND points_earned = ?
              GROUP BY user_id HAVING COUNT(*) >= ?`,
            [reward.reward_id, userIds, SPOT_ON_POINTS, criteria.gte]
        );
        granted += ins.affectedRows;

        const [del] = await conn.query<ResultSetHeader>(
            `DELETE FROM user_rewards
              WHERE reward_id = ? AND user_id IN (?)
                AND user_id NOT IN (
                    SELECT user_id FROM pickem_predictions
                     WHERE user_id IN (?) AND points_earned = ?
                     GROUP BY user_id HAVING COUNT(*) >= ?
                )`,
            [reward.reward_id, userIds, userIds, SPOT_ON_POINTS, criteria.gte]
        );
        revoked += del.affectedRows;
    }
    return { granted, revoked };
}
