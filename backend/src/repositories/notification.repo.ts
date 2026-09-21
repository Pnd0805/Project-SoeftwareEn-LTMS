import pool from '../config/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export type NotificationInput = {
    userId: number;
    type: string;
    title: string;
    message: string;
    relatedEntityType?: string | null;
    relatedEntityId?: number | null;
};

/** ตาราง notifications มีอยู่ใน schema แล้ว (§8) — ระบบเป็นคนเขียนเท่านั้น ไม่มี endpoint ให้ผู้ใช้สร้าง */
export async function insertNotification(input: NotificationInput): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [input.userId, input.type, input.title, input.message, input.relatedEntityType ?? null, input.relatedEntityId ?? null]
    );
    return result.insertId;
}

// ---- C1-ก อ่านแจ้งเตือนของตัวเอง ----

export type NotificationRow = {
    notification_id: number;
    user_id: number;
    type: string;
    title: string;
    message: string;
    related_entity_type: string | null;
    related_entity_id: number | null;
    is_read: number;          // MySQL BOOLEAN = TINYINT(1) → mapper แปลงเป็น boolean
    created_at: Date;
};

/** ใหม่สุดก่อน · unreadOnly = true → เฉพาะที่ยังไม่อ่าน */
export async function findByUser(
    userId: number,
    unreadOnly: boolean,
    offset: number,
    pageSize: number
): Promise<{ rows: NotificationRow[]; totalItems: number }> {
    const where = unreadOnly ? 'user_id = ? AND is_read = FALSE' : 'user_id = ?';
    const [rows] = await pool.query<(NotificationRow & RowDataPacket)[]>(
        `SELECT notification_id, user_id, type, title, message, related_entity_type, related_entity_id, is_read, created_at
         FROM notifications
         WHERE ${where}
         ORDER BY created_at DESC, notification_id DESC
         LIMIT ? OFFSET ?`,
        [userId, pageSize, offset]
    );
    const [countRows] = await pool.query<({ totalItems: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS totalItems FROM notifications WHERE ${where}`,
        [userId]
    );
    return { rows, totalItems: countRows[0]?.totalItems ?? 0 };
}

export async function countUnread(userId: number): Promise<number> {
    const [rows] = await pool.query<({ cnt: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = FALSE`,
        [userId]
    );
    return rows[0]?.cnt ?? 0;
}

/** หาแจ้งเตือนของ "คนนี้" เท่านั้น — ของคนอื่นคืน null (service ตอบ 404 ไม่บอกว่ามีอยู่จริง) */
export async function findOwned(notificationId: number, userId: number): Promise<NotificationRow | null> {
    const [rows] = await pool.query<(NotificationRow & RowDataPacket)[]>(
        `SELECT notification_id, user_id, type, title, message, related_entity_type, related_entity_id, is_read, created_at
         FROM notifications WHERE notification_id = ? AND user_id = ?`,
        [notificationId, userId]
    );
    return rows[0] ?? null;
}

export async function markRead(notificationId: number, userId: number): Promise<void> {
    await pool.query(
        `UPDATE notifications SET is_read = TRUE WHERE notification_id = ? AND user_id = ?`,
        [notificationId, userId]
    );
}

export async function markAllRead(userId: number): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE`,
        [userId]
    );
    return result.affectedRows;
}

// ---- C1-ข ผู้รับของ event ระดับแมตช์ ----

/**
 * คนที่ควรรู้เรื่องแมตช์นี้: ผู้เล่นที่ทีมส่งลงแข่ง (application_players ของใบสมัคร approved ทั้งสองฝั่ง)
 * + กรรมการที่รับแมตช์นี้แล้ว (match_referees accepted, ยังไม่ถูกถอดออกจากทัวร์)
 */
export async function findMatchAudience(matchId: number): Promise<number[]> {
    const [rows] = await pool.query<({ user_id: number } & RowDataPacket)[]>(
        `SELECT ap.user_id
         FROM matches m
         JOIN tournament_applications ta ON ta.tournament_id = m.tournament_id
              AND ta.team_id IN (m.team_a_id, m.team_b_id)
              AND ta.tournament_application_status = 'approved'
         JOIN application_players ap ON ap.tournament_application_id = ta.tournament_application_id
         WHERE m.match_id = ?
         UNION
         SELECT tr.user_id
         FROM match_referees mr
         JOIN tournament_referees tr ON tr.tournament_referee_id = mr.tournament_referee_id
         WHERE mr.match_id = ? AND mr.assignment_status = 'accepted' AND tr.removed_at IS NULL`,
        [matchId, matchId]
    );
    return rows.map(r => r.user_id);
}
