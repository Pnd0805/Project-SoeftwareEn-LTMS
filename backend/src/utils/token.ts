import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { authConfig } from '../config/auth.js';
import { AppError } from './AppError.js';

type ExpiresIn = NonNullable<SignOptions['expiresIn']>;   // ← เพิ่มบรรทัดนี้

export function signToken(userId: number): string {
  return jwt.sign(
    { sub: String(userId) },
    authConfig.secret,
    { expiresIn: authConfig.expireIn as ExpiresIn }
  );
}

export function verifyToken(token: string): { sub: string } {
  try{
    const payload = jwt.verify(token, authConfig.secret);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw new AppError(401, 'TOKEN_EXPIRED', 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }
    return { sub: payload.sub };

  } catch(err){
    throw new AppError(401 , "TOKEN_EXPIRED" , "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }
}