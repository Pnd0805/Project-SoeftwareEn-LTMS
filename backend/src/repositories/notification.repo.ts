import pool from '../config/db.js';
import type { ResultSetHeader } from 'mysql2';

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
