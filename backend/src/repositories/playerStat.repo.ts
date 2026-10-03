import pool from '../config/db.js';
import type { RowDataPacket } from 'mysql2';

import type { PlayerMatchStatRow, PlayerProfileStatRow , SportTypeRow } from '../types/db.js';
import { MVP_VOTING_HOURS } from '../config/scoring.js';

export type UserSportStatRow =
    Pick<PlayerProfileStatRow , 'sport_type_id' | 'matches_played' | 'wins' | 'losses' | 'championships'> 
    & { sport_name : SportTypeRow['name']};

export async function findStatsByUser(userId : number) : Promise<UserSportStatRow[]>{
    const [rows] = await pool.query<(UserSportStatRow & RowDataPacket)[]>(`SELECT 
        s.sport_type_id , s.matches_played , s.wins , s.losses , s.championships , st.name AS sport_name 
        FROM player_profile_stats s 
        JOIN sport_types st
        ON s.sport_type_id = st.sport_type_id
        WHERE s.user_id = ? ORDER BY st.sport_type_id` , [userId]);

    return rows;
}


/**
  * ★ ไม่มี `pickem_points` แล้ว (4 ต.ค. 2569) — เอาแต้ม Pick'em ออกจากโปรไฟล์สาธารณะ
  *   แต้มจากการ "ทายผล" ไม่ใช่ผลงานกีฬาของคนนั้น แต่เดิมมันนั่งปนอยู่ก้อนเดียวกับโหวต MVP
  *   และสถิติลงแข่ง ⇒ คนอ่านเข้าใจว่าเป็นตัวเลขวัดฝีมือการเล่น
  *   แต้มดูได้ที่ตารางอันดับในทัวร์ (E28) และที่ `GET /me/pickem` (E27) ของเจ้าตัว
  */
export type UserProfileTotalsRow = {
    mvp_votes: number;
    follower_count: number;
};

/**
 * ★ `mvp_votes` นับได้เฉพาะโหวตของแมตช์ที่ **ปิดโหวตแล้ว** (OD-23 ข้อ 10)
 *
 * `GET /users/:id/stats` เป็น endpoint สาธารณะไม่มี middleware เลย ถ้านับโหวตทุกแถวแบบไม่ดูเวลา
 * ใครก็ poll โปรไฟล์ของผู้เล่นทุก 10 วินาทีระหว่างหน้าต่างโหวต 24 ชม.แล้วเห็นเลขวิ่งได้ ทั้งที่
 * `GET /matches/:id/mvp-votes` ตั้งใจไม่ส่งจำนวนโหวตออกไปเลยเพื่อกันคนแห่โหวตตามคนที่นำอยู่ —
 * ปิดประตูหน้าแต่เปิดหลังบ้านไว้ กฎข้อนั้นก็ไม่มีผลอะไร
 *
 * `tf.match_id IS NULL` = โหวตระดับทัวร์ของเก่า (ก่อน 26 ก.ย.) ไม่มีหน้าต่างเวลา จึงนับได้ตามเดิม
 */
export async function findProfileTotals(userId: number): Promise<UserProfileTotalsRow> {
    const [rows] = await pool.query<(UserProfileTotalsRow & RowDataPacket)[]>(
        `SELECT
            (SELECT COUNT(*) FROM tournament_feedback tf
               LEFT JOIN matches m ON m.match_id = tf.match_id
             WHERE tf.voted_for_user_id = u.user_id
               AND tf.feedback_type = 'mvp_vote'
               AND tf.removed_at IS NULL
               AND (tf.match_id IS NULL
                    OR (m.actual_end_time IS NOT NULL
                        AND m.actual_end_time <= DATE_SUB(NOW(), INTERVAL ? HOUR)))) AS mvp_votes,
            (SELECT COUNT(*) FROM follows f
             WHERE f.followed_user_id = u.user_id) AS follower_count
         FROM users u
         WHERE u.user_id = ?`,
        [MVP_VOTING_HOURS, userId]
    );
    return rows[0] ?? { mvp_votes: 0, follower_count: 0 };
}


export async function findPlayerMatchStatByMatchAndUserId(matchId : number , userId : number) : Promise<PlayerMatchStatRow | null>{
    const [ rows ] = await pool.query<(PlayerMatchStatRow & RowDataPacket)[]>(`SELECT * FROM player_match_stats WHERE match_id = ? AND user_id = ?`,[matchId , userId]);
    return rows[0] ?? null;
}