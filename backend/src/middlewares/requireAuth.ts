import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/token.js';
import { findById } from '../repositories/user.repo.js';
import { isCurrentlySuspended , suspendedError } from '../utils/suspension.js';

function readAccessToken(req: Request): string | null {
    const token = req.headers.authorization;
    if (!token) return null;
    const [bearer, accessToken] = token.split(' ');
    return bearer === 'Bearer' && accessToken ? accessToken : null;
}

async function loadUser(sub: string | number) {
    const user = await findById(Number(sub));
    if (!user) throw new AppError(401, 'USER_NOT_FOUND', 'ไม่พบผู้ใช้นี้ในระบบ');
    // ระงับแบบมีกำหนดพ้นเองตรงนี้ — ไม่มี job มาล้างธง คนที่หมดเวลาแล้วจึงผ่านด่านนี้ตั้งแต่ request ถัดไป
    if (isCurrentlySuspended(user)) throw suspendedError(user);
    return user;
}

// A2 (6 ต.ค. 2569) — optionalAuth ถูก mount ไว้ก่อนด่านมองเห็นทัวร์ใต้ /tournaments/:id และ /matches/:id
// ⇒ ถ้ามีคนโหลด user ไปแล้วในคำขอเดียวกัน ไม่ต้องอ่านฐานซ้ำ (token ผ่านแล้วแน่นอน ไม่งั้นจะไม่มี req.user)
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (req.user) return next();
    const token = req.headers.authorization;
    const accessToken = readAccessToken(req);
    if (!token || accessToken === null) {
        return next(new AppError(401, 'NO_TOKEN', 'กรุณาเข้าสู่ระบบก่อนใช้งาน'));
    }

    // Preserve the existing contract: token verification failures reject; user-state failures go to next().
    const { sub } = verifyToken(accessToken);
    try {
        req.user = await loadUser(sub);
        next();
    } catch (error) {
        next(error);
    }
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
    if (req.user) return next();
    if (!req.headers.authorization) return next();
    try {
        const accessToken = readAccessToken(req);
        if (accessToken === null) throw new AppError(401, 'NO_TOKEN', 'กรุณาเข้าสู่ระบบก่อนใช้งาน');
        const { sub } = verifyToken(accessToken);
        req.user = await loadUser(sub);
        next();
    } catch (error) {
        next(error);
    }
}
