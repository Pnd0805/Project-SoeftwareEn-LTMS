import type { RowDataPacket , ResultSetHeader } from 'mysql2';
import pool from '../config/db.js';
import type { EmailVerificationOtpRow } from '../types/db.js';

export async function create(userId : number , codeHash : string , expiresAt : Date) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(
        `INSERT INTO email_verification_otps(user_id , code_hash , expires_at) VALUES(? , ? , ?)`,
        [userId , codeHash , expiresAt]);
    return result.insertId;
}

// bcrypt hash ของเลขเดิมไม่ซ้ำกัน ⇒ WHERE code_hash = ? ตรงๆ ไม่ได้ ต้องดึงมา compare ที่ service
// ต่างจาก passwordReset.repo.findAllActive(): ที่นั่นรับแค่ token ดิบไม่รู้ว่าใคร ต้องกวาดทุกคน
// ที่นี่ผู้ใช้ส่งอีเมลมาด้วย ⇒ รู้ user_id ก่อน กวาดแค่ใบของคนเดียว (ปกติมีใบเดียวเพราะออกใหม่ล้างใบเก่า)
//
// `attempt_count < ?` อยู่ใน SQL ไม่ใช่ที่ service โดยเจตนา — ใบที่กรอกผิดครบโควตาต้อง "หาไม่เจอ"
// ตั้งแต่ชั้นฐาน ไม่ใช่ดึงมาแล้วค่อยเช็ค เพราะถ้าพลาดเช็คที่ service ด่านกันเดาจะหายไปเงียบๆ
export async function findActiveByUser(userId : number , maxAttempts : number) : Promise<EmailVerificationOtpRow[]>{
    const [ rows ] = await pool.query<(EmailVerificationOtpRow & RowDataPacket)[]>(
        `SELECT * FROM email_verification_otps
          WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW() AND attempt_count < ?`,
        [userId , maxAttempts]);
    return rows;
}

// นับจาก created_at ไม่ใช่ expires_at — TTL 10 นาทีแต่หน้าต่าง rate limit 1 ชม. ตัวเลขไม่เท่ากัน
// (passwordReset.repo ใช้ expires_at ได้เพราะที่นั่น TTL = หน้าต่าง = 1 ชม. พอดี)
// นับใบที่ใช้ไปแล้วและใบที่ตายแล้วด้วย เพราะ rate limit คือ "ขอกี่ครั้ง" ไม่ใช่ "เหลือกี่ใบที่ใช้ได้"
export async function countIssuedWithinLastHour(userId : number) : Promise<number>{
    const [ rows ] = await pool.query<({ cnt : number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS cnt FROM email_verification_otps
          WHERE user_id = ? AND created_at > NOW() - INTERVAL 1 HOUR`,
        [userId]);
    return rows[0]!.cnt;
}

// ออกใบใหม่ต้องล้างใบเก่าก่อน — ไม่ควรมีหลายใบใช้ได้พร้อมกัน (ถ้ามี ผู้ใช้จะกรอกใบเก่าแล้วผ่าน
// ทั้งที่เพิ่งกดขอใหม่ และตัวนับกันเดาก็กระจายไปหลายใบ ทำให้เดาได้มากกว่าโควตาที่ตั้งไว้)
export async function invalidateAllForUser(userId : number) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(
        `UPDATE email_verification_otps SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL`,
        [userId]);
    return result.affectedRows;
}

export async function markUsed(otpId : number) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(
        `UPDATE email_verification_otps SET used_at = NOW() WHERE email_verification_otp_id = ?`,
        [otpId]);
    return result.affectedRows;
}

// นับขึ้นที่ฐานด้วย `+ 1` ไม่ใช่อ่านค่ามาบวกในแอปแล้วเขียนกลับ — ยิงพร้อมกันหลายเส้นจะนับหายไป
export async function bumpAttempt(otpId : number) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(
        `UPDATE email_verification_otps SET attempt_count = attempt_count + 1
          WHERE email_verification_otp_id = ?`,
        [otpId]);
    return result.affectedRows;
}
