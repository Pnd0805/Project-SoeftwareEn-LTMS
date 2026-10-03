import type { RowDataPacket , ResultSetHeader } from 'mysql2';
import pool from '../config/db.js';
import type { PasswordResetTokenRow } from '../types/db.js';

export async function create(userId : number , tokenHash : string , expiresAt : Date) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(
        `INSERT INTO password_reset_tokens(user_id , token_hash , expires_at) VALUES(? , ? , ?)`,
        [userId , tokenHash , expiresAt]);
    return result.insertId;
}

// ไม่มี token_hash ซ้ำกันให้ WHERE ตรงๆ ได้ (bcrypt hash ต่างกันทุกครั้งแม้ plain เดียวกัน)
// ต้องดึงแถวที่ "ยังมีสิทธิ์ใช้ได้" ทั้งหมดมาก่อน แล้วค่อย verifyPassword ทีละแถวที่ service
export async function findActiveByUser(userId : number) : Promise<PasswordResetTokenRow[]>{
    const [ rows ] = await pool.query<(PasswordResetTokenRow & RowDataPacket)[]>(
        `SELECT * FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()`,
        [userId]);
    return rows;
}

// reset-password รับแค่ token ดิบ ไม่รู้ user_id มาก่อน — ต้องกวาดทุกคนที่ยังใช้ได้มา verifyPassword ทีละแถว
export async function findAllActive() : Promise<PasswordResetTokenRow[]>{
    const [ rows ] = await pool.query<(PasswordResetTokenRow & RowDataPacket)[]>(
        `SELECT * FROM password_reset_tokens WHERE used_at IS NULL AND expires_at > NOW()`);
    return rows;
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

export async function markUsed(tokenId : number) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(
        `UPDATE password_reset_tokens SET used_at = NOW() WHERE password_reset_token_id = ?`,
        [tokenId]);
    return result.affectedRows;
}
