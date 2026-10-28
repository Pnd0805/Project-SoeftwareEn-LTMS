import { randomUUID } from 'node:crypto';
import pool from '../config/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { EmailCategory, EmailPreferences } from '../config/emailNotification.js';

export async function readPreferences(userId: number): Promise<unknown | undefined> {
    const [rows] = await pool.query<(RowDataPacket & { email_notification_prefs: unknown })[]>(
        'SELECT email_notification_prefs FROM users WHERE user_id=?', [userId]);
    return rows[0]?.email_notification_prefs;
}

export async function savePreferences(userId: number, prefs: EmailPreferences): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
        'UPDATE users SET email_notification_prefs=?, updated_at=NOW() WHERE user_id=?',
        [JSON.stringify(prefs), userId]);
    return result.affectedRows > 0;
}

/**
 * A UNIQUE notification_id prevents duplicate queue records. Only verified
 * addresses are queued; the worker rechecks verification and preferences at send time.
 */
export async function enqueue(notificationId: number, userId: number, category: EmailCategory,
    mode: 'immediate' | 'digest', dueAt: string): Promise<void> {
    await pool.query(
        `INSERT IGNORE INTO email_notification_outbox
          (notification_id,user_id,category,delivery_mode,due_at)
         SELECT ?,u.user_id,?,?,? FROM users u
         WHERE u.user_id=? AND u.email_verified=1
           AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(u.email_notification_prefs, CONCAT('$.',?))), 'true') <> 'false'`,
        [notificationId, category, mode, dueAt, userId, category]);
}

export interface MailItem {
    email_notification_id: number;
    notification_id: number;
    user_id: number;
    category: EmailCategory;
    title: string;
    message: string;
    email: string;
    full_name: string;
    email_verified: number;
    email_notification_prefs: unknown;
    attempts: number;
}

export async function readyGroups(): Promise<Array<{ user_id: number; delivery_mode: 'immediate' | 'digest' }>> {
    const [rows] = await pool.query<(RowDataPacket & { user_id: number; delivery_mode: 'immediate' | 'digest' })[]>(
        `SELECT user_id,delivery_mode FROM email_notification_outbox
           WHERE (status='queued' AND due_at<=UTC_TIMESTAMP())
              OR (status='processing' AND locked_at < UTC_TIMESTAMP()-INTERVAL 5 MINUTE)
         GROUP BY user_id,delivery_mode ORDER BY MIN(due_at) LIMIT 20`);
    return rows;
}

/** Claim a bounded batch atomically so multiple server instances cannot send it simultaneously. */
export async function claim(userId: number, mode: 'immediate' | 'digest', limit = 50): Promise<MailItem[]> {
    const [candidates] = await pool.query<(RowDataPacket & { email_notification_id: number })[]>(
        `SELECT email_notification_id FROM email_notification_outbox
         WHERE user_id=? AND delivery_mode=? AND
           ((status='queued' AND due_at<=UTC_TIMESTAMP())
             OR (status='processing' AND locked_at < UTC_TIMESTAMP()-INTERVAL 5 MINUTE))
         ORDER BY email_notification_id LIMIT ?`, [userId, mode, limit]);
    const token = randomUUID();
    const claimed: number[] = [];
    for (const item of candidates) {
        const [r] = await pool.query<ResultSetHeader>(
            `UPDATE email_notification_outbox SET status='processing',claim_token=?,locked_at=UTC_TIMESTAMP()
             WHERE email_notification_id=? AND
              ((status='queued' AND due_at<=UTC_TIMESTAMP())
                OR (status='processing' AND locked_at < UTC_TIMESTAMP()-INTERVAL 5 MINUTE))`,
            [token, item.email_notification_id]);
        if (r.affectedRows > 0) claimed.push(item.email_notification_id);
    }
    if (claimed.length === 0) return [];
    const [rows] = await pool.query<(MailItem & RowDataPacket)[]>(
        `SELECT o.email_notification_id,o.notification_id,o.user_id,o.category,o.attempts,
                n.title,n.message,u.email,u.full_name,u.email_verified,u.email_notification_prefs
           FROM email_notification_outbox o
           JOIN notifications n ON n.notification_id=o.notification_id
           JOIN users u ON u.user_id=o.user_id
          WHERE o.claim_token=? AND o.email_notification_id IN (?)`,
        [token, claimed]);
    return rows;
}

export async function finish(ids: number[], status: 'sent' | 'skipped'): Promise<void> {
    if (!ids.length) return;
    await pool.query(
        `UPDATE email_notification_outbox
         SET status=?,claim_token=NULL,locked_at=NULL,sent_at=IF(?='sent',UTC_TIMESTAMP(),NULL),last_error=NULL
         WHERE email_notification_id IN (?) AND status='processing'`,
        [status, status, ids]);
}

export async function retry(items: MailItem[], error: unknown): Promise<void> {
    const message = String(error instanceof Error ? error.message : error).slice(0, 500);
    for (const item of items) {
        const count = item.attempts + 1;
        const delay = [60, 300, 900][Math.min(count - 1, 2)];
        await pool.query(
            `UPDATE email_notification_outbox SET attempts=?, status=?,last_error=?,
                  due_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND),locked_at=NULL,claim_token=NULL
             WHERE email_notification_id=? AND status='processing'`,
            [count, count >= 3 ? 'failed' : 'queued', message, delay, item.email_notification_id]);
    }
}
