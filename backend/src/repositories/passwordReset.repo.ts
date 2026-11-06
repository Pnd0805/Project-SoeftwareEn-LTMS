import type { RowDataPacket , ResultSetHeader } from 'mysql2';
import pool from '../config/db.js';
import type { PasswordResetTokenRow } from '../types/db.js';

export async function create(userId : number , tokenHash : string , expiresAt : Date) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(
        `INSERT INTO password_reset_tokens(user_id , token_hash , expires_at) VALUES(? , ? , ?)`,
        [userId , tokenHash , expiresAt]);
    return result.insertId;
}

// ใบที่ยังใช้ได้ของ user คนเดียว
export async function findActiveByUser(userId : number) : Promise<PasswordResetTokenRow[]>{
    const [ rows ] = await pool.query<(PasswordResetTokenRow & RowDataPacket)[]>(
        `SELECT * FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()`,
        [userId]);
    return rows;
}

/**
 * 🔴 bug hunt 30 ต.ค. 2569 ข้อ 7 — ค้นตรงด้วย hash ของ token (แทน findAllActive ที่กวาดทุกใบมา bcrypt ทีละใบ)
 *   เดิมทุกคำขอ reset-password เทียบ bcrypt กับลิงก์ทุกใบในระบบ ⇒ มีคนขอลิงก์ไว้เยอะ = เดาครั้งเดียวกิน CPU หลายร้อยรอบ
 *   token เป็นค่าสุ่ม 32 ไบต์อยู่แล้ว (เดาไม่ได้) ⇒ เก็บ SHA-256 พอ ไม่ต้องใช้ bcrypt ที่ออกแบบมาสำหรับรหัสผ่านที่คนตั้ง
 */
export async function findActiveByHash(tokenHash : string) : Promise<PasswordResetTokenRow | null>{
    const [ rows ] = await pool.query<(PasswordResetTokenRow & RowDataPacket)[]>(
        `SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1`,
        [tokenHash]);
    return rows[0] ?? null;
}

// ไม่มี created_at — token มีอายุคงที่ 1 ชม. เสมอ ⇒ แถวที่ "ยังไม่หมดอายุ" ตอนนี้ก็คือแถวที่ "ออกภายใน 1 ชม.ที่แล้ว"
// นับ used_at ด้วยโดยเจตนา (ไม่ใช่แค่ WHERE used_at IS NULL) เพราะ rate limit คือ "ขอกี่ครั้ง" ไม่ใช่ "เหลือกี่ใบที่ใช้ได้"
export async function countIssuedWithinLastHour(userId : number) : Promise<number>{
    const [ rows ] = await pool.query<({ cnt : number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS cnt FROM password_reset_tokens WHERE user_id = ? AND expires_at > NOW()`,
        [userId]);
    return rows[0]!.cnt;
}

// ออกใบใหม่ต้องล้างใบเก่าของคนนั้นทั้งหมดก่อน — ไม่ควรมีหลายใบใช้ได้พร้อมกัน
export async function invalidateAllForUser(userId : number) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(
        `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL`,
        [userId]);
    return result.affectedRows;
}

// ★ `used_at IS NULL` = จองใบนี้ — ยิง reset พร้อมกันสองครั้งด้วยลิงก์เดียว ต้องสำเร็จครั้งเดียว (คืน 0 = มีคนใช้ไปก่อนแล้ว)
export async function markUsed(tokenId : number) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(
        `UPDATE password_reset_tokens SET used_at = NOW() WHERE password_reset_token_id = ? AND used_at IS NULL`,
        [tokenId]);
    return result.affectedRows;
}
