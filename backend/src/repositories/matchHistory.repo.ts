import pool from '../config/db.js';
import type { RowDataPacket } from 'mysql2';
import type { MatchRow } from '../types/db.js';

export type MatchHistoryRow = {
    match_id: number;
    round_number: number | null;
    scheduled_time: Date | null;
    started_at: Date | null;
    actual_end_time: Date | null;
    venue: string | null;
    mode: MatchRow['mode'];
    tournament_id: number;
    tournament_name: string;
    sport_type_id: number;
    my_team_id: number;
    my_team_name: string;
    opponent_team_id: number | null;
    opponent_team_name: string | null;
    winner_team_id: number | null;
    score_data: Record<string, number> | null;
    verified_at: Date | null;
    /**
     * 1 = ใบสมัครของคนนี้ในทัวร์นี้ยัง `approved` · 0 = ใบถูก `withdrawn` ไปแล้ว
     * ส่งออก API ในชื่อ `withdrawn` (ตรงข้ามกัน) — FE ขอมาเพื่อติดป้าย "ทีมถอนตัวแล้ว" ต่อรายการ
     *
     * ★ อ่านจาก `ta` ตรง ๆ ได้ แม้ query นี้เป็น `SELECT DISTINCT` เพราะฐานบังคับไว้แล้วว่า
     *   `application_players` มี `UNIQUE (tournament_id, user_id)`
     *   ⇒ **หนึ่งคนอยู่ได้ใบเดียวต่อทัวร์** ⇒ `ta` ของแต่ละแถวมีได้ค่าเดียว ไม่มีทางทำให้แถวแตก
     *   (และ `tournament_applications` มี `UNIQUE (tournament_id, team_id)` ซ้ำอีกชั้น
     *    ⇒ ทีมเดียวก็มีใบเดียวต่อทัวร์ ⇒ "ถอนแล้วสมัครใหม่" ใช้แถวเดิม ไม่เกิดใบที่สอง)
     */
    has_approved: number;
};

export type MatchHistoryStatRow = {
    match_id: number;
    stat_key: string;
    stat_label_th: string;
    value_int: number | null;
};

/**
 * OD-47 — `tournamentId` กรองให้เหลือทัวร์เดียว (RW06 โปรไฟล์ในทัวร์) · ไม่ส่ง = ทุกทัวร์เหมือนเดิม (RW05)
 *
 * `includeWithdrawn` — นับใบที่ `withdrawn` ด้วย
 *
 * ★ 6 ต.ค. 2569 — **ไม่มีค่าเริ่มต้นแล้ว ต้องส่งทุกครั้ง** เหตุผลเดียวกับ career.repo
 *   FE ตอบข้อ ก ⇒ ทั้ง RW05 และ RW06 ส่ง true หมด ⇒ ค่าเริ่มต้น false ไม่มีใครใช้
 *   ปล่อยไว้แล้ววันหนึ่งจะมีคนได้ false มาเงียบ ๆ แล้วเลขไม่ตรงกับอีกสองหน้า
 *   กฎเดียวกับ career.repo และ M19 รายชื่อผู้เล่น ซึ่งแสดงคนของทีมที่ถอนตัวอยู่แล้ว (มติ 26 ก.ย.)
 */
export async function findVerifiedMatchHistoryByUser(userId: number, tournamentId: number | undefined,
                                                     includeWithdrawn: boolean): Promise<MatchHistoryRow[]> {
    const [rows] = await pool.query<(MatchHistoryRow & RowDataPacket)[]>(
        `SELECT DISTINCT
                m.match_id, m.round_number, m.scheduled_time, m.started_at, m.actual_end_time, m.venue, m.mode,
                t.tournament_id, t.name AS tournament_name, t.sport_type_id,
                ta.team_id AS my_team_id, my_team.name AS my_team_name,
                CASE WHEN m.team_a_id = ta.team_id THEN m.team_b_id ELSE m.team_a_id END AS opponent_team_id,
                CASE WHEN m.team_a_id = ta.team_id THEN team_b.name ELSE team_a.name END AS opponent_team_name,
                mr.winner_team_id, mr.score_data, mr.verified_at,
                CASE WHEN ta.tournament_application_status = 'approved' THEN 1 ELSE 0 END AS has_approved
           FROM application_players ap
           JOIN tournament_applications ta
             ON ta.tournament_application_id = ap.tournament_application_id
            AND (ta.tournament_application_status = 'approved'
                 OR (? = 1 AND ta.tournament_application_status = 'withdrawn'))
           JOIN matches m
             ON m.tournament_id = ta.tournament_id
            AND (m.team_a_id = ta.team_id OR m.team_b_id = ta.team_id)
           JOIN tournaments t ON t.tournament_id = m.tournament_id
           JOIN teams my_team ON my_team.team_id = ta.team_id
           LEFT JOIN teams team_a ON team_a.team_id = m.team_a_id
           LEFT JOIN teams team_b ON team_b.team_id = m.team_b_id
           JOIN match_results mr ON mr.match_id = m.match_id AND mr.match_result_status = 'verified'
           LEFT JOIN match_checkins ci
             ON ci.match_id = m.match_id AND ci.user_id = ap.user_id
            AND ci.match_checkin_status IN ('success', 'exception')
           LEFT JOIN player_match_stats pms
             ON pms.match_id = m.match_id AND pms.user_id = ap.user_id
          WHERE ap.user_id = ?
            AND t.deleted_at IS NULL
            AND (? IS NULL OR t.tournament_id = ?)
            AND (ci.match_checkin_id IS NOT NULL OR pms.player_match_stat_id IS NOT NULL)
          ORDER BY COALESCE(m.actual_end_time, mr.verified_at, m.scheduled_time) DESC, m.match_id DESC`,
        [includeWithdrawn ? 1 : 0, userId, tournamentId ?? null, tournamentId ?? null]
    );
    return rows;
}

export async function findStatsForUserMatches(userId: number, matchIds: number[]): Promise<MatchHistoryStatRow[]> {
    if (matchIds.length === 0) return [];
    const [rows] = await pool.query<(MatchHistoryStatRow & RowDataPacket)[]>(
        `SELECT pms.match_id, def.stat_key, def.stat_label_th, val.value_int
           FROM player_match_stats pms
           JOIN player_match_stat_values val ON val.player_match_stat_id = pms.player_match_stat_id
           JOIN sport_stat_definitions def ON def.sport_stat_definition_id = val.sport_stat_definition_id
          WHERE pms.user_id = ? AND pms.match_id IN (?)
          ORDER BY pms.match_id, def.display_order, def.sport_stat_definition_id`,
        [userId, matchIds]
    );
    return rows;
}
