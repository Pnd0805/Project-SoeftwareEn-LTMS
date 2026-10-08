import {env} from './env.js';

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/**
 * JWT_EXPIRES_IN รับได้ทั้งตัวเลขวินาที ('604800') และแบบมีหน่วย s/m/h/d ('30m', '12h', '7d')
 * แปลงเป็นวินาทีเสมอ เพราะ A02 ต้องตอบ expiresIn เป็นตัวเลขวินาที
 * ★ ค่าผิดรูปแบบให้พังตอนเปิดเซิร์ฟเวอร์ — เดิม Number('7d') = NaN แล้วไปพังตอน login ทุกครั้งแทน
 */
export function parseExpiresIn(raw: string): number {
    const match = /^(\d+)\s*([smhd])?$/.exec(raw.trim());
    if (!match || Number(match[1]) <= 0) {
        throw new Error(`JWT_EXPIRES_IN ไม่ถูกต้อง: "${raw}" — ใช้ตัวเลขวินาที (เช่น 604800) หรือมีหน่วย s/m/h/d (เช่น 7d)`);
    }
    return Number(match[1]) * UNIT_SECONDS[match[2] ?? 's']!;
}

export const authConfig = {
    secret : env.JWT_SECRET,
    expireIn : parseExpiresIn(env.JWT_EXPIRES_IN)
};
