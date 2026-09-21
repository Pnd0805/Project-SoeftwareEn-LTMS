import pool from '../config/db.js';
import type { RowDataPacket } from 'mysql2';

export type CareerRow = {
    tournament_id: number;
    tournament_name: string;
    sport_type_id: number;
    tournament_status: string;
    event_start_date: Date | string | null;
    champion_team_id: number | null;
    team_id: number;
    team_name: string;
    played: number;
    wins: number;
};

/**
 * C8 — ประวัติแข่งแยกตามทัวร์ (สาธารณะ · มติ OD-24)
 * นับเฉพาะทัวร์ที่คนนี้อยู่ในรายชื่อลงแข่งของใบสมัครที่ approved (ทีมที่ถอนตัว รายชื่อถูกลบไปแล้ว → ไม่ขึ้น)
 * played/wins นับจากใบผลล่าสุดของแมตช์ที่ verified เท่านั้น — walkover ไม่นับ เพราะไม่ได้ลงเล่นจริง
 * (กฎเดียวกับ player_profile_stats ที่ walkover ไม่แตะ)
 */
export async function findCareer(userId: number): Promise<CareerRow[]> {
    const [rows] = await pool.query<(CareerRow & RowDataPacket)[]>(
        `SELECT t.tournament_id, t.name AS tournament_name, t.sport_type_id, t.tournament_status,
                t.event_start_date, t.champion_team_id,
                tm.team_id, tm.name AS team_name,
                (SELECT COUNT(*) FROM matches m
                  JOIN match_results r ON r.match_result_id = (SELECT MAX(r2.match_result_id) FROM match_results r2 WHERE r2.match_id = m.match_id)
                  WHERE m.tournament_id = t.tournament_id AND ta.team_id IN (m.team_a_id, m.team_b_id)
                    AND r.match_result_status = 'verified') AS played,
                (SELECT COUNT(*) FROM matches m
                  JOIN match_results r ON r.match_result_id = (SELECT MAX(r2.match_result_id) FROM match_results r2 WHERE r2.match_id = m.match_id)
                  WHERE m.tournament_id = t.tournament_id AND ta.team_id IN (m.team_a_id, m.team_b_id)
                    AND r.match_result_status = 'verified' AND r.winner_team_id = ta.team_id) AS wins
         FROM application_players ap
         JOIN tournament_applications ta ON ta.tournament_application_id = ap.tournament_application_id
              AND ta.tournament_application_status = 'approved'
         JOIN tournaments t ON t.tournament_id = ta.tournament_id AND t.deleted_at IS NULL
         JOIN teams tm ON tm.team_id = ta.team_id
         WHERE ap.user_id = ?
         ORDER BY t.event_start_date DESC, t.tournament_id DESC`,
        [userId]
    );
    return rows;
}

/** MVP รวม = จำนวนโหวต MVP ที่ได้ทั้งหมด (C6 · ไม่นับที่แอดมินลบ) */
export async function countMvpVotesReceived(userId: number): Promise<number> {
    const [rows] = await pool.query<({ cnt: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS cnt FROM tournament_feedback
         WHERE feedback_type = 'mvp_vote' AND voted_for_user_id = ? AND removed_at IS NULL`,
        [userId]
    );
    return Number(rows[0]?.cnt ?? 0);
}
