import jwt from 'jsonwebtoken';

/**
 * token ล็อกอินแบบเดียวกับ src/utils/token.ts → { sub, tv } เซ็นด้วย JWT_SECRET ของ .env.perf
 *
 * ★ ไม่ยิง /auth/login จริง: bcrypt ตั้งใจให้ช้า (~70 ms/ครั้ง) และ login มี rate limit
 *   ถ้าให้ผู้ใช้เสมือน 500 คนล็อกอินก่อน จะวัดได้แต่ bcrypt ไม่ใช่ API ที่ SRS ถาม
 * ★ tv = 0 — บัญชีที่ seed ไม่เคยเปลี่ยนรหัสผ่าน (users.token_version DEFAULT 0, migration 046)
 */
const cache = new Map<number, string>();
export function tokenFor(userId: number): string {
    let t = cache.get(userId);
    if (!t) {
        t = jwt.sign({ sub: String(userId), tv: 0 }, process.env['JWT_SECRET']!, { expiresIn: '1d' });
        cache.set(userId, t);
    }
    return t;
}
