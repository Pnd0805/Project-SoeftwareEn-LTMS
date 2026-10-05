import pool from '../config/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { pickemScoreFor } from '../utils/pickemScore.js';
import { toleranceFor } from '../utils/matchFormat.js';
import type { PickemTolerance, PickemTier } from '../utils/pickemScore.js';
import type { SportTypeRow , MatchRow } from '../types/db.js';

// C7 — Pick'em (ตาราง pickem_predictions เดิม · UNIQUE (user_id, match_id) = คนละ 1 การทายต่อแมตช์)
//   points_earned: NULL = ยังไม่ตัดสิน (หรือแมตช์จบแบบไม่มีผลยืนยัน = void) · > 0 = ทายฝั่งถูก · 0 = ทายฝั่งผิด
//
// ★ OD-56 (4 ต.ค.) — ทายเป็นสกอร์ (migration 038) และคิดแต้ม 3 ชั้นแบบ "ยึดฝั่งที่แย่กว่า" (migration 040)
//   ตัวเลขอยู่ที่ `config/scoring.ts` (PICKEM_TIER_POINTS) · สูตรอยู่ที่ `utils/pickemScore.ts`
//
//   กฎที่ต้องไม่ลืม: **ทายฝั่งผิด = 0 เสมอ ไม่ว่าสกอร์จะใกล้แค่ไหน** (มติข้อ ②)
//   ⇒ `points_earned > 0` จึงแปลว่า "ทายฝั่งถูก" ได้ตรง ๆ
//      E28/E29 ที่นับ `SUM(points_earned > 0) AS correct` และ pickStatus() จึงยังพูดความจริง
//      🔴 **ถ้าวันหนึ่งให้ฝั่งผิดได้แต้มด้วย ต้องกลับไปแก้สองที่นั้นพร้อมกัน** ไม่งั้น
//         ช่อง "ทายถูก" กับสถานะ won/lost จะโกหกเงียบ ๆ โดยไม่มีเทสไหนแดง

export type PredictionRow = {
    pickem_prediction_id: number;
    user_id: number;
    match_id: number;
    predicted_winner_team_id: number;
    /** OD-56 · NULL = แถวที่ทายไว้ก่อน migration 038 (ทายแค่ฝั่ง ไม่มีสกอร์ให้เทียบ) */
    predicted_score_data: Record<string, number> | null;
    points_earned: number | null;
    /** OD-65 — ชั้นของใบนี้ · NULL = ยังไม่ตัดสิน (ชุดเดียวกับ points_earned IS NULL เสมอ) */
    tier: PickemTier | null;
    created_at: Date;
};

/** คนที่ทายแมตช์ในทัวร์นี้ไว้ — อ่านก่อนจับสายใหม่ (การทายถูกลบไปพร้อมแมตช์) เพื่อแจ้งให้ทายใหม่ */
export async function findPickerIdsTx(conn: PoolConnection, tournamentId: number): Promise<number[]> {
    const [rows] = await conn.query<({ user_id: number } & RowDataPacket)[]>(
        `SELECT DISTINCT p.user_id FROM pickem_predictions p JOIN matches m ON m.match_id = p.match_id WHERE m.tournament_id = ?`,
        [tournamentId]
    );
    return rows.map(r => r.user_id);
}

/**
 * ทาย/เปลี่ยนการทาย (ก่อน cutoff เท่านั้น — service ตรวจแล้ว) · กันเขียนทับแถวที่ตัดสินแล้ว
 *
 * ★ `teamId` ที่รับมาคือผลการอนุมานจากสกอร์ (service คำนวณ) ไม่ใช่ค่าที่ผู้ใช้ส่งมาตรง ๆ
 * ★ ทั้งสองคอลัมน์ต้องอัปเดตด้วยเงื่อนไข `points_earned IS NULL` **ชุดเดียวกัน**
 *   ถ้าอันหนึ่งมีเงื่อนไขอีกอันไม่มี จะได้แถวที่ผู้ชนะกับสกอร์ไม่ตรงกัน ซึ่งแย่กว่าเขียนทับทั้งคู่
 */
export async function upsert(userId: number, matchId: number, teamId: number,
                             scoreData: Record<string, number>): Promise<void> {
    await pool.query(
        `INSERT INTO pickem_predictions (user_id, match_id, predicted_winner_team_id, predicted_score_data)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            predicted_winner_team_id = IF(points_earned IS NULL, VALUES(predicted_winner_team_id), predicted_winner_team_id),
            predicted_score_data     = IF(points_earned IS NULL, VALUES(predicted_score_data),     predicted_score_data)`,
        [userId, matchId, teamId, JSON.stringify(scoreData)]
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
export async function settleTx(conn: PoolConnection, matchId: number, winnerTeamId: number,
                               actualScore: Record<string, number> | null, sportTypeId: number): Promise<void> {
    // เส้น tolerance — อ่านในทรานแซกชันเดียวกัน ไม่ส่งมาจากข้างนอกเพื่อให้คนเรียกไม่ต้องรู้เรื่องนี้
    //
    // 🆕 BO-N (มติ 5 ต.ค.) — มีสองแหล่ง และ `matches.best_of` ชนะเสมอเมื่อมีค่า:
    //   best_of มีค่า  → เส้นมาจาก **รูปแบบ** (BO7 ได้ชั้นกลาง (0,1) · ที่เหลือ (0,0))
    //   best_of null   → เส้นมาจาก **กีฬา** ตามเดิม (ฟุตบอล (0,1) · บาสเกตบอล (5,10))
    //
    // ★ ทำไมเส้นต้องมาจากรูปแบบไม่ใช่กีฬา: คอลัมน์ใน sport_types เก็บค่าเดียวต่อกีฬา
    //   แต่ทัวร์เดียวมีได้หลายรูปแบบ (กลุ่ม BO3 ชิง BO7) ⇒ ค่าเดียวตอบสองรูปแบบไม่ได้
    //   ⇒ ถ้าอ่านจากกีฬาต่อไป แมตช์ BO7 จะถูกตัดสินด้วยเส้น (0,0) แล้วไม่มีใครได้ชั้นกลางเลย
    //     โดยไม่มี error ให้เห็น
    const [cfgRows] = await conn.query<(Pick<SportTypeRow, 'pickem_tolerance_exact' | 'pickem_tolerance_close'>
                                        & Pick<MatchRow, 'best_of'> & RowDataPacket)[]>(
        `SELECT s.pickem_tolerance_exact, s.pickem_tolerance_close, m.best_of
           FROM matches m JOIN sport_types s ON s.sport_type_id = ?
          WHERE m.match_id = ?`,
        [sportTypeId, matchId]
    );
    // แถวหาย (ไม่ควรเกิด — FK บังคับ) → ถือว่าต้องเป๊ะ ไม่ใช่แจกโบนัสฟรี
    const tolerance: PickemTolerance = toleranceFor(cfgRows[0]?.best_of ?? null, {
        exact: cfgRows[0]?.pickem_tolerance_exact ?? 0,
        close: cfgRows[0]?.pickem_tolerance_close ?? 0,
    });

    // ★ ต้องอ่านแถวที่ยังไม่ตัดสิน "ก่อน" เขียน — จับกลุ่มตามแต้มแล้วค่อยอัปเดตทีละกลุ่ม
    //   ถ้าเขียน points_earned ก่อนแล้วมาบวก users.total_points ทีหลัง จะแยกไม่ออกว่า
    //   แถวไหนเพิ่งตัดสินในรอบนี้กับแถวที่ตัดสินไปแล้วรอบก่อน แล้วอาจบวกซ้ำ
    const [rows] = await conn.query<(Pick<PredictionRow, 'pickem_prediction_id' | 'predicted_winner_team_id' | 'predicted_score_data'> & RowDataPacket)[]>(
        `SELECT pickem_prediction_id, predicted_winner_team_id, predicted_score_data
           FROM pickem_predictions WHERE match_id = ? AND points_earned IS NULL`,
        [matchId]
    );
    if (rows.length === 0) return;

    // ชั้นมีได้แค่ 4 ค่า ⇒ จับกลุ่มแล้วยิงไม่เกิน 4 รอบ ไม่ใช่ยิงต่อคน
    //
    // ★ OD-65 — จับกลุ่มตาม **ชั้น** ไม่ใช่ตามแต้ม
    //   ถ้าจับตามแต้มแล้ววันหนึ่งสองชั้นมีแต้มเท่ากัน สองชั้นจะยุบรวมเป็นกลุ่มเดียว
    //   แล้วคอลัมน์ tier จะได้ค่าของชั้นใดชั้นหนึ่งแบบสุ่ม ⇒ จับตามชั้นปลอดภัยเสมอ
    const byTier = new Map<PickemTier, { points: number, ids: number[] }>();
    for (const row of rows) {
        const { points, tier } = pickemScoreFor(row.predicted_winner_team_id, row.predicted_score_data,
                                                winnerTeamId, actualScore, tolerance);
        const group = byTier.get(tier) ?? { points, ids: [] };
        group.ids.push(row.pickem_prediction_id);
        byTier.set(tier, group);
    }

    for (const [tier, { points, ids }] of byTier) {
        const marks = ids.map(() => '?').join(',');
        if (points > 0) {
            await conn.query<ResultSetHeader>(
                `UPDATE users u JOIN pickem_predictions p ON p.user_id = u.user_id
                    SET u.total_points = u.total_points + ?
                  WHERE p.pickem_prediction_id IN (${marks})`,
                [points, ...ids]
            );
        }
        // แต้มกับชั้นเขียนพร้อมกันคำสั่งเดียว ⇒ ไม่มีจังหวะที่สองคอลัมน์ไม่ตรงกัน
        await conn.query<ResultSetHeader>(
            `UPDATE pickem_predictions SET points_earned = ?, tier = ? WHERE pickem_prediction_id IN (${marks})`,
            [points, tier, ...ids]
        );
    }
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
        // OD-65 — ล้าง tier พร้อม points_earned · สองคอลัมน์นี้ต้อง NULL หรือไม่ NULL ไปด้วยกันเสมอ
        `UPDATE pickem_predictions SET points_earned = NULL, tier = NULL WHERE match_id = ?`,
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

export type MyStandingRow = { points: number; correct: number; settled: number; rank_no: number };

/**
 * แต้ม + อันดับของคนเดียวในทัวร์เดียว (E29) — คืน null เมื่อยังไม่มีการทายที่ตัดสินแล้วในทัวร์นี้
 *
 * ★ กฎการจัดอันดับต้องตรงกับ `findLeaderboard()` เป๊ะ ไม่งั้นสองหน้าจะบอกอันดับไม่เหมือนกัน
 *   ตารางอันดับเรียง `points DESC, correct DESC` แล้วขึ้นอันดับใหม่เมื่อ **points หรือ correct ต่างจากแถวก่อน**
 *   ⇒ อันดับของเรา = จำนวนคนที่ (แต้มมากกว่า) หรือ (แต้มเท่ากันแต่ทายถูกมากกว่า) + 1
 *   เขียนเป็นเงื่อนไขเดียวแบบนี้เพราะถ้าไปนับ "คนที่อยู่เหนือเรา" ด้วยการเรียงแล้วหาตำแหน่ง
 *   คนที่แต้มเท่ากันจะได้อันดับไม่เท่ากัน ซึ่งขัดกับ (1,1,3) ที่ตารางอันดับใช้
 *
 * ชื่อคอลัมน์เป็น `rank_no` ไม่ใช่ `rank` เพราะ `RANK` เป็น reserved word ของ MySQL 8
 */
export async function findMyStanding(tournamentId: number, userId: number): Promise<MyStandingRow | null> {
    const [rows] = await pool.query<(MyStandingRow & RowDataPacket)[]>(
        `WITH totals AS (
             SELECT p.user_id,
                    SUM(p.points_earned) AS points,
                    SUM(p.points_earned > 0) AS correct,
                    COUNT(*) AS settled
               FROM pickem_predictions p
               JOIN matches m ON m.match_id = p.match_id
              WHERE m.tournament_id = ? AND p.points_earned IS NOT NULL
              GROUP BY p.user_id
         )
         SELECT t.points, t.correct, t.settled,
                (SELECT COUNT(*) FROM totals o
                  WHERE o.points > t.points
                     OR (o.points = t.points AND o.correct > t.correct)) + 1 AS rank_no
           FROM totals t
          WHERE t.user_id = ?`,
        [tournamentId, userId]
    );
    const row = rows[0];
    return row === undefined ? null
        : { points: Number(row.points), correct: Number(row.correct),
            settled: Number(row.settled), rank_no: Number(row.rank_no) };
}

export async function findTotalPoints(userId: number): Promise<number> {
    const [rows] = await pool.query<({ total_points: number } & RowDataPacket)[]>(
        `SELECT total_points FROM users WHERE user_id = ?`, [userId]);
    return Number(rows[0]?.total_points ?? 0);
}
