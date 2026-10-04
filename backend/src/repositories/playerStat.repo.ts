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
    /**
     * OD-60 (4 ต.ค. 2569) — **จำนวนครั้งที่ได้เป็น MVP** ไม่ใช่จำนวนโหวต
     *
     * ★ สองตัวเลขนี้วัดคนละอย่าง และเรียงอันดับกลับทางกันได้สนิท
     * ```
     * นาย ก  ทีมดังคนดู 100  ได้ 40/38/50 โหวต แต่เพื่อนร่วมทีมนำสองนัด
     *        ⇒ 128 โหวต · เป็น MVP 1 ครั้ง
     * นาย ข  ทีมเล็กคนดู 5   ได้ 4/3/5 โหวต และนำทุกนัด
     *        ⇒  12 โหวต · เป็น MVP 3 ครั้ง
     * ```
     * ยอดโหวตบวกตาม **จำนวนคนดู** ไม่ได้บวกตามฝีมือ ⇒ คนที่ลงทัวร์ใหญ่ชนะอัตโนมัติ
     * ⇒ ส่งทั้งคู่ ให้หน้าจอเลือกใช้ได้ถูกบริบท (มติ 4 ต.ค.)
     */
    mvp_times: number;
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
    const totals = rows[0] ?? { mvp_votes: 0, follower_count: 0 };
    return { ...totals, mvp_times: await countMvpTimes(userId) };
}

/**
 * OD-60 — จำนวนแมตช์ที่ user คนนี้ได้โหวตมากสุด (= ได้เป็น MVP ของแมตช์นั้น)
 *
 * ★ มติ ① **เสมอที่อันดับหนึ่ง = ได้ทั้งคู่** — `RANK()` ให้ `rnk = 1` กับทุกคนที่โหวตเท่ากัน
 *   ตรงกับกีฬาจริงที่มี co-MVP และไม่ต้องมีกฎตัดสินลับที่ผู้เล่นมองไม่เห็น
 *   (ทางเลือกที่ไม่เอา: "เสมอ = ไม่มีใครได้" ⇒ คนได้โหวตมากสุดแต่ไม่ได้ MVP = อธิบายยากกว่า)
 *
 * ★ มติ ② **นับเฉพาะแมตช์ที่ปิดโหวตแล้ว** — เงื่อนไขชุดเดียวกับ `mvp_votes` เป๊ะ
 *   เหตุผลเต็มอยู่ที่หัว `findProfileTotals` (endpoint สาธารณะ + ห้ามเปิดคะแนนสด)
 *   🔴 ถ้าแก้เงื่อนไขเวลาที่ใดที่หนึ่ง **ต้องแก้ทั้งสองที่** ไม่งั้นสองตัวเลขบนหน้าจอเดียวกัน
 *      จะนับจากชุดแมตช์ต่างกันโดยไม่มีใครรู้ (เช่น "MVP 3 ครั้ง · 2 โหวต")
 *
 * ★ มติ ③ **ผลแมตช์ถูกแก้/ยกทิ้งทีหลัง (S04) ไม่กระทบ** — โหวตคือความเห็นเรื่องการเล่น
 *   ไม่ใช่เรื่องผลแพ้ชนะ ⇒ ไม่มีเงื่อนไขเกี่ยวกับ `match_results` ในนี้เลยโดยเจตนา
 *
 * ⚠️ โหวตระดับทัวร์ของเก่า (`tf.match_id IS NULL` · ก่อน 26 ก.ย.) **ไม่นับ**
 *   เพราะ "เด่นสุดในแมตช์ไหน" ไม่มีความหมายเมื่อไม่มีแมตช์ · ของพวกนั้นยังนับใน `mvp_votes` ตามเดิม
 *
 * ★ `tf.match_id IN (...)` ไม่ได้เป็นแค่การกรอง — มันคือสิ่งที่ทำให้ไม่ต้องจัดอันดับ
 *   ทุกแมตช์ในระบบเพื่อตอบโปรไฟล์คนเดียว · จัดอันดับเฉพาะแมตช์ที่เขามีโหวตอยู่
 */
async function countMvpTimes(userId: number): Promise<number> {
    const [rows] = await pool.query<({ mvp_times: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS mvp_times FROM (
            SELECT tf.match_id, tf.voted_for_user_id,
                   RANK() OVER (PARTITION BY tf.match_id ORDER BY COUNT(*) DESC) AS rnk
              FROM tournament_feedback tf
              JOIN matches m ON m.match_id = tf.match_id
             WHERE tf.feedback_type = 'mvp_vote'
               AND tf.removed_at IS NULL
               AND m.actual_end_time IS NOT NULL
               AND m.actual_end_time <= DATE_SUB(NOW(), INTERVAL ? HOUR)
               AND tf.match_id IN (SELECT match_id FROM tournament_feedback
                                    WHERE voted_for_user_id = ? AND feedback_type = 'mvp_vote'
                                      AND removed_at IS NULL AND match_id IS NOT NULL)
             GROUP BY tf.match_id, tf.voted_for_user_id
         ) ranked
         WHERE ranked.voted_for_user_id = ? AND ranked.rnk = 1`,
        [MVP_VOTING_HOURS, userId, userId]
    );
    return Number(rows[0]?.mvp_times ?? 0);
}


export async function findPlayerMatchStatByMatchAndUserId(matchId : number , userId : number) : Promise<PlayerMatchStatRow | null>{
    const [ rows ] = await pool.query<(PlayerMatchStatRow & RowDataPacket)[]>(`SELECT * FROM player_match_stats WHERE match_id = ? AND user_id = ?`,[matchId , userId]);
    return rows[0] ?? null;
}