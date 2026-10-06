import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { authConfig } from '../config/auth.js';
import { AppError } from './AppError.js';

type ExpiresIn = NonNullable<SignOptions['expiresIn']>;   // ← เพิ่มบรรทัดนี้

/**
 * B1 (มติ 6 ต.ค. 2569 ทางเลือก ข) — บัตรพก `tv` = เลขรุ่นของบัญชีตอนที่ออกบัตร
 *   เปลี่ยนรหัสผ่าน → users.token_version บวก 1 ⇒ บัตรที่พกเลขเก่าใช้ไม่ได้ทันทีทุกใบ
 *   การเทียบอยู่ที่ requireAuth/optionalAuth (ที่นั่นอ่านแถว users อยู่แล้ว ไม่มีคิวรีเพิ่ม)
 * ★ `tv` เป็นเรื่องภายในบัตร ไม่ใช่สัญญากับ FE — FE ไม่ต้องรู้จักและไม่ต้องแก้อะไร
 */
export function signToken(userId: number, tokenVersion: number): string {
  return jwt.sign(
    { sub: String(userId), tv: tokenVersion },
    authConfig.secret,
    { expiresIn: authConfig.expireIn as ExpiresIn }
  );
}

export function verifyToken(token: string): { sub: string; tv: number } {
  try{
    const payload = jwt.verify(token, authConfig.secret);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw new AppError(401, 'TOKEN_EXPIRED', 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }
    // บัตรที่ออกก่อน migration 046 ไม่มีช่องนี้ → ถือเป็นรุ่น 0 ซึ่งตรงกับ DEFAULT 0 ของทุกบัญชีเดิม
    // ⇒ deploy แล้วไม่มีใครถูกเตะออกจากระบบ (ตั้งใจ)
    return { sub: payload.sub, tv: typeof payload['tv'] === 'number' ? payload['tv'] : 0 };

  } catch(err){
    throw new AppError(401 , "TOKEN_EXPIRED" , "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }
}