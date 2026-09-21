import pool from '../config/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

// C6 — ตาราง tournament_feedback มีอยู่แล้ว (ตารางเดียวรองรับ comment / organizer_feedback / mvp_vote)
// UNIQUE (tournament_id, match_key, user_id, feedback_type) → คนละ 1 อันต่อทัวร์ต่อประเภท (match_key = 0 เมื่อไม่ผูกแมตช์)

export type FeedbackType = 'comment' | 'organizer_feedback' | 'mvp_vote';

export type FeedbackRow = {
    tournament_feedback_id: number;
    tournament_id: number;
    user_id: number;
    feedback_type: FeedbackType;
    content: string | null;
    rating: number | null;
    voted_for_user_id: number | null;
    match_id: number | null;
    is_reported: number;
    removed_at: Date | null;
    created_at: Date;
};

const FEEDBACK_COLS = `f.tournament_feedback_id, f.tournament_id, f.user_id, f.feedback_type, f.content, f.rating,
                       f.voted_for_user_id, f.match_id, f.is_reported, f.removed_at, f.created_at`;

// ---- ใครเป็นใครในทัวร์นี้ ----

/**
 * "คนที่เกี่ยวข้อง" (มติ C6 ข้อ 1): ผู้เล่นในรายชื่อลงแข่งของใบสมัครที่อนุมัติแล้ว · หัวหน้าทีมที่อนุมัติแล้ว · กรรมการที่ตอบรับแล้ว
 */
export async function isTournamentParticipant(tournamentId: number, userId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM application_players ap
         JOIN tournament_applications ta ON ta.tournament_application_id = ap.tournament_application_id
         WHERE ap.tournament_id = ? AND ap.user_id = ? AND ta.tournament_application_status = 'approved'
         UNION ALL
         SELECT 1 FROM tournament_applications ta JOIN teams t ON t.team_id = ta.team_id
         WHERE ta.tournament_id = ? AND t.leader_id = ? AND ta.tournament_application_status = 'approved'
         UNION ALL
         SELECT 1 FROM tournament_referees tr
         WHERE tr.tournament_id = ? AND tr.user_id = ? AND tr.invitation_status = 'accepted' AND tr.removed_at IS NULL
         LIMIT 1`,
        [tournamentId, userId, tournamentId, userId, tournamentId, userId]
    );
    return rows.length > 0;
}

/**
 * คนที่ "มีส่วนได้เสีย" กับผลโหวต MVP (มติ C6 ข้อ 4 — โหวตได้เฉพาะคนที่ไม่ได้ลงแข่ง)
 * ผู้เล่นในรายชื่อลงแข่ง · สมาชิกทีมที่อนุมัติแล้ว (กันคนในคลังโหวตให้เพื่อนร่วมทีม) · กรรมการของทัวร์ — ORG เช็คแยกใน service
 */
export async function isTournamentInsider(tournamentId: number, userId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM application_players ap
         JOIN tournament_applications ta ON ta.tournament_application_id = ap.tournament_application_id
         WHERE ap.tournament_id = ? AND ap.user_id = ? AND ta.tournament_application_status = 'approved'
         UNION ALL
         SELECT 1 FROM tournament_applications ta JOIN team_members tm ON tm.team_id = ta.team_id
         WHERE ta.tournament_id = ? AND tm.user_id = ? AND ta.tournament_application_status = 'approved'
         UNION ALL
         SELECT 1 FROM tournament_referees tr
         WHERE tr.tournament_id = ? AND tr.user_id = ? AND tr.invitation_status IN ('pending', 'accepted') AND tr.removed_at IS NULL
         LIMIT 1`,
        [tournamentId, userId, tournamentId, userId, tournamentId, userId]
    );
    return rows.length > 0;
}

export type MvpCandidateRow = {
    user_id: number;
    full_name: string;
    profile_image_key: string | null;
    team_id: number;
    team_name: string;
    votes: number;
};

/** ผู้มีสิทธิ์ถูกโหวต = ผู้เล่นในรายชื่อลงแข่งของใบสมัครที่อนุมัติแล้ว + นับคะแนนที่ยังไม่ถูกลบ · มากสุดก่อน */
export async function findMvpCandidates(tournamentId: number): Promise<MvpCandidateRow[]> {
    const [rows] = await pool.query<(MvpCandidateRow & RowDataPacket)[]>(
        `SELECT u.user_id, u.full_name, u.profile_image_key, t.team_id, t.name AS team_name,
                (SELECT COUNT(*) FROM tournament_feedback f
                  WHERE f.tournament_id = ap.tournament_id AND f.feedback_type = 'mvp_vote'
                    AND f.voted_for_user_id = u.user_id AND f.removed_at IS NULL) AS votes
         FROM application_players ap
         JOIN tournament_applications ta ON ta.tournament_application_id = ap.tournament_application_id
         JOIN teams t ON t.team_id = ta.team_id
         JOIN users u ON u.user_id = ap.user_id
         WHERE ap.tournament_id = ? AND ta.tournament_application_status = 'approved'
         ORDER BY votes DESC, u.full_name`,
        [tournamentId]
    );
    return rows;
}

// ---- อ่าน/เขียน feedback ----

/** แถวของคนนี้ในทัวร์นี้ (ไม่ผูกแมตช์) — รวมแถวที่แอดมินลบแล้ว เพื่อบอกได้ว่า "ถูกลบ" */
export async function findOwn(tournamentId: number, userId: number, type: FeedbackType): Promise<FeedbackRow | null> {
    const [rows] = await pool.query<(FeedbackRow & RowDataPacket)[]>(
        `SELECT ${FEEDBACK_COLS} FROM tournament_feedback f
         WHERE f.tournament_id = ? AND f.user_id = ? AND f.feedback_type = ? AND f.match_id IS NULL`,
        [tournamentId, userId, type]
    );
    return rows[0] ?? null;
}

/**
 * มติ C6 ข้อ 3 — ส่งซ้ำ = เขียนทับของเดิม (คนละ 1 อัน) ใช้ UNIQUE เดิมของตาราง
 * แก้เนื้อหาแล้วล้างธง report เพราะข้อความที่ถูก report ไม่ใช่ข้อความนี้แล้ว
 */
export async function upsertOrganizerFeedback(tournamentId: number, userId: number, rating: number, content: string | null): Promise<void> {
    await pool.query(
        `INSERT INTO tournament_feedback (tournament_id, user_id, feedback_type, rating, content)
         VALUES (?, ?, 'organizer_feedback', ?, ?)
         ON DUPLICATE KEY UPDATE rating = VALUES(rating), content = VALUES(content), is_reported = FALSE`,
        [tournamentId, userId, rating, content]
    );
}

export async function upsertMvpVote(tournamentId: number, userId: number, votedForUserId: number): Promise<void> {
    await pool.query(
        `INSERT INTO tournament_feedback (tournament_id, user_id, feedback_type, voted_for_user_id)
         VALUES (?, ?, 'mvp_vote', ?)
         ON DUPLICATE KEY UPDATE voted_for_user_id = VALUES(voted_for_user_id)`,
        [tournamentId, userId, votedForUserId]
    );
}

export type FeedbackSummaryRow = { average: number | null; count: number; r1: number; r2: number; r3: number; r4: number; r5: number };

/** ค่าเฉลี่ย/จำนวน/การกระจาย — ไม่นับที่แอดมินลบแล้ว */
export async function summarizeOrganizerFeedback(tournamentId: number): Promise<FeedbackSummaryRow> {
    const [rows] = await pool.query<(FeedbackSummaryRow & RowDataPacket)[]>(
        `SELECT AVG(rating) AS average, COUNT(*) AS count,
                SUM(rating = 1) AS r1, SUM(rating = 2) AS r2, SUM(rating = 3) AS r3, SUM(rating = 4) AS r4, SUM(rating = 5) AS r5
         FROM tournament_feedback
         WHERE tournament_id = ? AND feedback_type = 'organizer_feedback' AND removed_at IS NULL`,
        [tournamentId]
    );
    const r = rows[0]!;
    return {
        average: r.average === null ? null : Number(r.average), count: Number(r.count),
        r1: Number(r.r1 ?? 0), r2: Number(r.r2 ?? 0), r3: Number(r.r3 ?? 0), r4: Number(r.r4 ?? 0), r5: Number(r.r5 ?? 0),
    };
}

export type FeedbackListRow = FeedbackRow & { author_name: string };

export async function listOrganizerFeedback(tournamentId: number): Promise<FeedbackListRow[]> {
    const [rows] = await pool.query<(FeedbackListRow & RowDataPacket)[]>(
        `SELECT ${FEEDBACK_COLS}, u.full_name AS author_name
         FROM tournament_feedback f JOIN users u ON u.user_id = f.user_id
         WHERE f.tournament_id = ? AND f.feedback_type = 'organizer_feedback' AND f.removed_at IS NULL
         ORDER BY f.created_at DESC, f.tournament_feedback_id DESC`,
        [tournamentId]
    );
    return rows;
}

// ---- report / ลบ ----

export async function findById(feedbackId: number): Promise<FeedbackRow | null> {
    const [rows] = await pool.query<(FeedbackRow & RowDataPacket)[]>(
        `SELECT ${FEEDBACK_COLS} FROM tournament_feedback f WHERE f.tournament_feedback_id = ?`,
        [feedbackId]
    );
    return rows[0] ?? null;
}

export async function markReported(feedbackId: number): Promise<void> {
    await pool.query(`UPDATE tournament_feedback SET is_reported = TRUE WHERE tournament_feedback_id = ?`, [feedbackId]);
}

/** แอดมินลบ (soft delete) + audit ในทรานแซกชันเดียว — คืน false ถ้าถูกลบไปแล้ว */
export async function removeByAdmin(feedbackId: number, adminUserId: number, reason: string | null): Promise<boolean> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.query<ResultSetHeader>(
            `UPDATE tournament_feedback SET removed_at = NOW(), removed_by = ?
             WHERE tournament_feedback_id = ? AND removed_at IS NULL`,
            [adminUserId, feedbackId]
        );
        if (result.affectedRows === 0) {
            await conn.rollback();
            return false;
        }
        await conn.query(
            `INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id, details) VALUES (?, 'feedback_removed', 'tournament_feedback', ?, ?)`,
            [adminUserId, feedbackId, JSON.stringify({ reason })]
        );
        await conn.commit();
        return true;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}
