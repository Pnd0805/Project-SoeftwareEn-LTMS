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

/**
 * B1 (มติ 6 ต.ค. 2569 ทางเลือก ข) — บัตรที่พกเลขรุ่นไม่ตรงกับบัญชี ใช้ไม่ได้
 *   เปลี่ยนรหัสผ่าน → users.token_version บวก 1 ⇒ บัตรทุกใบที่ออกก่อนนั้นตายพร้อมกัน
 *   ⇒ คนที่แอบใช้บัญชีอยู่ถูกเตะออกทันที ซึ่งเป็นเหตุผลหลักที่คนเปลี่ยนรหัสผ่าน
 *
 * ★ ตอบ 401 TOKEN_EXPIRED ตัวเดิม ไม่ออกรหัสใหม่ — FE จัดการรหัสนี้อยู่แล้ว (พาไปหน้าล็อกอิน)
 *   และข้อความ "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" ตรงกับสิ่งที่เกิดขึ้นในมุมผู้ใช้
 *   🙋 ถ้า FE อยากขึ้นข้อความเฉพาะว่า "รหัสผ่านถูกเปลี่ยน" ค่อยเพิ่มรหัสแยกทีหลังได้
 * ★ ไม่มีคิวรีเพิ่ม — ฟังก์ชันนี้อ่านแถว users อยู่แล้วทุกคำขอ
 */
async function loadUser(sub: string | number, tokenVersion: number) {
    const user = await findById(Number(sub));
    if (!user) throw new AppError(401, 'USER_NOT_FOUND', 'ไม่พบผู้ใช้นี้ในระบบ');
    if (user.token_version !== tokenVersion) {
        throw new AppError(401, 'TOKEN_EXPIRED', 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }
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
    const { sub, tv } = verifyToken(accessToken);
    try {
        req.user = await loadUser(sub, tv);
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
        const { sub, tv } = verifyToken(accessToken);
        req.user = await loadUser(sub, tv);
        next();
    } catch (error) {
        next(error);
    }
}
