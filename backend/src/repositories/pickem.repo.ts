import pool from '../config/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';

// C7 — Pick'em (ตาราง pickem_predictions เดิม · UNIQUE (user_id, match_id) = คนละ 1 การทายต่อแมตช์)
//   points_earned: NULL = ยังไม่ตัดสิน (หรือแมตช์จบแบบไม่มีผลยืนยัน = void) · 10 = ทายถูก · 0 = ทายผิด
export const PICKEM_POINTS = 10;

export type PredictionRow = {
    pickem_prediction_id: number;
    user_id: number;
    match_id: number;
    predicted_winner_team_id: number;
    points_earned: number | null;
    created_at: Date;
};

/** ทาย/เปลี่ยนการทาย (ก่อน cutoff เท่านั้น — service ตรวจแล้ว) · กันเขียนทับแถวที่ตัดสินแล้ว */
export async function upsert(userId: number, matchId: number, teamId: number): Promise<void> {
    await pool.query(
        `INSERT INTO pickem_predictions (user_id, match_id, predicted_winner_team_id) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE predicted_winner_team_id = IF(points_earned IS NULL, VALUES(predicted_winner_team_id), predicted_winner_team_id)`,
        [userId, matchId, teamId]
    );
}

export async function remove(userId: number, matchId: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM pickem_predictions WHERE user_id = ? AND match_id = ? AND points_earned IS NULL`,
        [userId, matchId]
    );
    return result.affectedRows > 0;
}

export async function findMine(userId: number, matchId: number): Promise<PredictionRow | null> {
    const [rows] = await pool.query<(PredictionRow & RowDataPacket)[]>(
        `SELECT * FROM pickem_predictions WHERE user_id = ? AND match_id = ?`,
        [userId, matchId]
    );
    return rows[0] ?? null;
}

/** จำนวนคนทายแต่ละทีม */
export async function countByTeam(matchId: number): Promise<{ team_id: number; picks: number }[]> {
    const [rows] = await pool.query<({ team_id: number; picks: number } & RowDataPacket)[]>(
        `SELECT predicted_winner_team_id AS team_id, COUNT(*) AS picks FROM pickem_predictions WHERE match_id = ? GROUP BY predicted_winner_team_id`,
        [matchId]
    );
    return rows.map(r => ({ team_id: r.team_id, picks: Number(r.picks) }));
}

// ───────── ตัดสินแต้ม — เรียกจากใน applyOutcomeTx / undoOutcomeTx (ทรานแซกชันเดียวกับผลการแข่ง) ─────────

/**
 * ผลถูกยืนยัน (S02 verify / S04 uphold ก่อน verify / S04 amend) → ให้แต้มคนทายถูก + บวก users.total_points
 * ตัดสินเฉพาะแถวที่ยังไม่ตัดสิน (points_earned IS NULL) → เรียกซ้ำก็ไม่บวกซ้ำ
 */
export async function settleTx(conn: PoolConnection, matchId: number, winnerTeamId: number): Promise<void> {
    await conn.query<ResultSetHeader>(
        `UPDATE users u JOIN pickem_predictions p ON p.user_id = u.user_id
         SET u.total_points = u.total_points + ?
         WHERE p.match_id = ? AND p.points_earned IS NULL AND p.predicted_winner_team_id = ?`,
        [PICKEM_POINTS, matchId, winnerTeamId]
    );
    await conn.query<ResultSetHeader>(
        `UPDATE pickem_predictions SET points_earned = IF(predicted_winner_team_id = ?, ?, 0)
         WHERE match_id = ? AND points_earned IS NULL`,
        [winnerTeamId, PICKEM_POINTS, matchId]
    );
}

/** ผลที่ยืนยันแล้วถูกถอน (S04 reject / amend เปลี่ยนผู้ชนะ) → คืนแต้มทั้งหมดของแมตช์นี้ กลับเป็นยังไม่ตัดสิน */
export async function unsettleTx(conn: PoolConnection, matchId: number): Promise<void> {
    await conn.query<ResultSetHeader>(
        `UPDATE users u JOIN pickem_predictions p ON p.user_id = u.user_id
         SET u.total_points = GREATEST(u.total_points - p.points_earned, 0)
         WHERE p.match_id = ? AND p.points_earned > 0`,
        [matchId]
    );
    await conn.query<ResultSetHeader>(
        `UPDATE pickem_predictions SET points_earned = NULL WHERE match_id = ?`,
        [matchId]
    );
}

// ───────── ประวัติ / อันดับ ─────────

export type MyPickRow = PredictionRow & {
    tournament_id: number;
    tournament_name: string;
    match_status: string;
    team_a_id: number | null;
    team_a_name: string | null;
    team_b_id: number | null;
    team_b_name: string | null;
    predicted_team_name: string;
    scheduled_time: Date | null;
};

export async function findHistory(userId: number): Promise<MyPickRow[]> {
    const [rows] = await pool.query<(MyPickRow & RowDataPacket)[]>(
        `SELECT p.*, m.tournament_id, t.name AS tournament_name, m.match_status, m.scheduled_time,
                m.team_a_id, ta.name AS team_a_name, m.team_b_id, tb.name AS team_b_name, pt.name AS predicted_team_name
         FROM pickem_predictions p
         JOIN matches m ON m.match_id = p.match_id
         JOIN tournaments t ON t.tournament_id = m.tournament_id
         LEFT JOIN teams ta ON ta.team_id = m.team_a_id
         LEFT JOIN teams tb ON tb.team_id = m.team_b_id
         JOIN teams pt ON pt.team_id = p.predicted_winner_team_id
         WHERE p.user_id = ?
         ORDER BY p.created_at DESC, p.pickem_prediction_id DESC`,
        [userId]
    );
    return rows;
}

export type LeaderboardRow = { user_id: number; full_name: string; profile_image_key: string | null; points: number; correct: number; settled: number };

/** อันดับในทัวร์ = แต้มจากแมตช์ของทัวร์นี้ที่ตัดสินแล้ว (มากสุดก่อน · เท่ากัน → ทายถูกมากกว่า → ชื่อ) */
export async function findLeaderboard(tournamentId: number): Promise<LeaderboardRow[]> {
    const [rows] = await pool.query<(LeaderboardRow & RowDataPacket)[]>(
        `SELECT u.user_id, u.full_name, u.profile_image_key,
                SUM(p.points_earned) AS points, SUM(p.points_earned > 0) AS correct, COUNT(*) AS settled
         FROM pickem_predictions p
         JOIN matches m ON m.match_id = p.match_id
         JOIN users u ON u.user_id = p.user_id
         WHERE m.tournament_id = ? AND p.points_earned IS NOT NULL
         GROUP BY u.user_id, u.full_name, u.profile_image_key
         ORDER BY points DESC, correct DESC, u.full_name`,
        [tournamentId]
    );
    return rows.map(r => ({ ...r, points: Number(r.points), correct: Number(r.correct), settled: Number(r.settled) }));
}

export async function findTotalPoints(userId: number): Promise<number> {
    const [rows] = await pool.query<({ total_points: number } & RowDataPacket)[]>(
        `SELECT total_points FROM users WHERE user_id = ?`, [userId]);
    return Number(rows[0]?.total_points ?? 0);
}
