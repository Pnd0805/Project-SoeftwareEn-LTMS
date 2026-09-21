import pool from '../config/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

// C7 — คอมเมนต์ใต้แมตช์ (migration 024) · ห้ามแก้เนื้อหา · ลบ = soft delete (removed_at, removed_by)

export type CommentRow = {
    match_comment_id: number;
    match_id: number;
    user_id: number;
    full_name: string;
    profile_image_key: string | null;
    content: string;
    is_reported: number;
    removed_at: Date | null;
    created_at: Date;
};

const COLS = `c.match_comment_id, c.match_id, c.user_id, u.full_name, u.profile_image_key,
              c.content, c.is_reported, c.removed_at, c.created_at`;

export async function insert(matchId: number, userId: number, content: string): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO match_comments (match_id, user_id, content) VALUES (?, ?, ?)`,
        [matchId, userId, content]
    );
    return result.insertId;
}

export async function findById(commentId: number): Promise<CommentRow | null> {
    const [rows] = await pool.query<(CommentRow & RowDataPacket)[]>(
        `SELECT ${COLS} FROM match_comments c JOIN users u ON u.user_id = c.user_id WHERE c.match_comment_id = ?`,
        [commentId]
    );
    return rows[0] ?? null;
}

/** คอมเมนต์ที่ยังไม่ถูกลบของแมตช์นี้ — ใหม่สุดก่อน */
export async function findByMatch(matchId: number, offset: number, pageSize: number): Promise<{ rows: CommentRow[]; totalItems: number }> {
    const [rows] = await pool.query<(CommentRow & RowDataPacket)[]>(
        `SELECT ${COLS} FROM match_comments c JOIN users u ON u.user_id = c.user_id
         WHERE c.match_id = ? AND c.removed_at IS NULL
         ORDER BY c.created_at DESC, c.match_comment_id DESC
         LIMIT ? OFFSET ?`,
        [matchId, pageSize, offset]
    );
    const [count] = await pool.query<({ cnt: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS cnt FROM match_comments WHERE match_id = ? AND removed_at IS NULL`,
        [matchId]
    );
    return { rows, totalItems: Number(count[0]?.cnt ?? 0) };
}

export async function markReported(commentId: number): Promise<void> {
    await pool.query(`UPDATE match_comments SET is_reported = TRUE WHERE match_comment_id = ?`, [commentId]);
}

/**
 * ลบ (soft delete) — คืน false ถ้าถูกลบไปแล้ว
 * แอดมินลบ → เขียน audit ในทรานแซกชันเดียวกัน · เจ้าของลบเองไม่ต้อง audit
 */
export async function remove(commentId: number, byUserId: number, audit: { reason: string | null } | null): Promise<boolean> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.query<ResultSetHeader>(
            `UPDATE match_comments SET removed_at = NOW(), removed_by = ? WHERE match_comment_id = ? AND removed_at IS NULL`,
            [byUserId, commentId]
        );
        if (result.affectedRows === 0) {
            await conn.rollback();
            return false;
        }
        if (audit) {
            await conn.query(
                `INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id, details) VALUES (?, 'comment_removed', 'match_comment', ?, ?)`,
                [byUserId, commentId, JSON.stringify({ reason: audit.reason })]
            );
        }
        await conn.commit();
        return true;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}
