import pool from '../config/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { parseCriteria, isStatCriteria } from '../config/rewardCriteria.js';

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

// ───────────────────────── OD-64 · ตัวแจกเหรียญ ─────────────────────────
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
 * ประเมินเหรียญสายสถิติของผู้เล่นทุกคนที่ลงแข่งในทัวร์นี้ — **แจกหรือริบ** (OD-64 · แก้ตาม OD-67)
 *
 * เรียกจาก 2 จุด:
 *   ① `completeTournament` — จังหวะปกติ · ต้องอยู่ **หลัง** การบวก `championships` ในทรานแซกชันเดียวกัน
 *      ไม่งั้นเหรียญแชมป์จะอ่านค่าก่อนบวกแล้วช้าไปหนึ่งทัวร์เสมอ
 *   ② `amendMatchResult` — จังหวะซ่อม · ดู ★ ข้างล่าง
 *
 * ★ **ทำไมต้องริบด้วย ทั้งที่แจกตอนปิดทัวร์แล้วน่าจะพอ** (OD-67)
 *   ปิดทัวร์ได้ต้องให้ทุกแมตช์ `completed` ก่อน ⇒ ตอนประเมิน สถิติเป็นค่าสุดท้ายแล้ว
 *   ⇒ การปฏิเสธผล/amend ที่เกิด *ก่อน* ปิดทัวร์ ไม่ทำให้เหรียญค้าง เพราะยังไม่เคยแจก
 *
 *   แต่ `POST /match-result-complaints/:id/decision` (S13e) **ตั้งใจให้ทำได้แม้ทัวร์ปิดแล้ว**
 *   (มติ: เรื่องที่ค้างต้องเดินต่อให้จบ — ดูหัวไฟล์ `matchResultComplaint.routes.ts`)
 *   และถ้า `remedy = 'amend_result'` มันเดินเส้น amend เดิมทั้งเส้น รวมถึงลด `player_profile_stats`
 *   ⇒ ผู้ชนะเดิมเหลือ 9 ชนะแต่ยังถือเหรียญ "ชนะ 10 แมตช์" · ผู้ชนะใหม่ครบเกณฑ์แต่ไม่มีใครแจก
 *      และจะไม่มีใครแจกตลอดไป เพราะทัวร์ปิดแล้ว ไม่มี hook อื่นเหลือ
 *
 * ★ เกณฑ์เช็คแบบ "มีกีฬาใดกีฬาหนึ่งถึงเกณฑ์" (`EXISTS` ไม่ล็อก `sport_type_id`)
 *   เหรียญเป็นของระดับบัญชี (UNIQUE `user_id, reward_id`) ไม่ใช่ของรายกีฬา
 *   ⇒ ถ้าริบโดยดูแค่กีฬาของทัวร์ที่กำลังประเมิน คนที่ได้เหรียญจากฟุตบอลจะถูกริบ
 *      ตอนจบทัวร์บาสเพราะสถิติบาสยังน้อย — ซึ่งผิด
 *   คำว่า "ในกีฬาเดียวกัน" ในคำอธิบายเหรียญยังจริง เพราะแต่ละแถวของ `player_profile_stats`
 *   คือกีฬาเดียว ⇒ `EXISTS (... >= gte)` = มีกีฬาหนึ่งที่ถึงเกณฑ์ด้วยตัวเอง
 *
 * ชื่อคอลัมน์มาจาก `criteria` ซึ่งแอดมินแก้ได้ จึงผ่าน allowlist ของ `parseCriteria` ก่อนต่อเป็น SQL
 */
export async function evaluateStatRewardsForTournamentTx(
    conn: PoolConnection, tournamentId: number
): Promise<{ granted: number; revoked: number }> {
    /** ผู้เล่นที่ทีมส่งลงแข่งในทัวร์นี้ — ขอบเขตของการประเมินรอบนี้ (ทั้งแจกและริบ) */
    const PLAYERS_OF_TOURNAMENT =
        `SELECT ap.user_id
           FROM application_players ap
           JOIN tournament_applications ta ON ta.tournament_application_id = ap.tournament_application_id
          WHERE ta.tournament_id = ? AND ta.tournament_application_status = 'approved'`;

    let granted = 0, revoked = 0;
    for (const reward of await listActiveRewardsTx(conn)) {
        const criteria = parseCriteria(reward.criteria);
        if (criteria === null || !isStatCriteria(criteria)) continue;   // เกณฑ์อ่านไม่ออก = ไม่แตะเหรียญของใคร

        /** "ผู้ใช้นี้มีกีฬาใดกีฬาหนึ่งถึงเกณฑ์" — รับชื่อคอลัมน์ฝั่ง user ที่จะเชื่อมเข้ามา */
        const qualifies = (userCol: string) =>
            `EXISTS (SELECT 1 FROM player_profile_stats s
                      WHERE s.user_id = ${userCol} AND s.\`${criteria.stat}\` >= ?)`;

        const [ins] = await conn.query<ResultSetHeader>(
            `INSERT IGNORE INTO user_rewards (user_id, reward_id)
             SELECT DISTINCT p.user_id, ?
               FROM (${PLAYERS_OF_TOURNAMENT}) p
              WHERE ${qualifies('p.user_id')}`,
            [reward.reward_id, tournamentId, criteria.gte]
        );
        granted += ins.affectedRows;

        // ริบ: เฉพาะคนในทัวร์นี้ที่ "ไม่ถึงเกณฑ์แล้ว" · คนนอกทัวร์นี้ไม่ถูกแตะ
        const [del] = await conn.query<ResultSetHeader>(
            `DELETE FROM user_rewards
              WHERE reward_id = ?
                AND user_id IN (${PLAYERS_OF_TOURNAMENT})
                AND NOT ${qualifies('user_rewards.user_id')}`,
            [reward.reward_id, tournamentId, criteria.gte]
        );
        revoked += del.affectedRows;
    }
    return { granted, revoked };
}

/**
 * ประเมินเหรียญสาย Pick'em ใหม่ให้ทุกคนที่ทายแมตช์นี้ — **แจกหรือริบ** (มติ OD-64)
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
              WHERE user_id IN (?) AND tier = ?
              GROUP BY user_id HAVING COUNT(*) >= ?`,
            [reward.reward_id, userIds, criteria.pickem, criteria.gte]
        );
        granted += ins.affectedRows;

        const [del] = await conn.query<ResultSetHeader>(
            `DELETE FROM user_rewards
              WHERE reward_id = ? AND user_id IN (?)
                AND user_id NOT IN (
                    SELECT user_id FROM pickem_predictions
                     WHERE user_id IN (?) AND tier = ?
                     GROUP BY user_id HAVING COUNT(*) >= ?
                )`,
            [reward.reward_id, userIds, userIds, criteria.pickem, criteria.gte]
        );
        revoked += del.affectedRows;
    }
    return { granted, revoked };
}
