import type { Request , Response , NextFunction } from "express";
import * as AdminRepo from '../repositories/adminScope.repo.js';
import { AppError } from "../utils/AppError.js";

/**
 * OD-34 — ด่าน "อ่านได้" ของชั้นกำกับดูแล: root + university_wide (faculty ไม่ผ่าน)
 *
 * แยกจาก `requireAdmin_U` โดยเจตนา ไม่ใช่ความซ้ำซ้อน · `requireAdmin_U` เป็นด่าน **"กดได้"**
 * ของการอนุมัติทีม official, กรรมการภายนอก, การลบความเห็น และการวินิจฉัยเรื่องร้องเรียน
 * ถ้าเติม root เข้าไปในตัวนั้นเพื่อให้ root "เห็น" คิว root จะได้อำนาจ **กด** ทุกอย่างนั้นมาด้วย
 * ซึ่งขัดมติ OD-34 ตรง ๆ (root เป็นคนแต่งตั้งและคนตรวจ ไม่ใช่คนปฏิบัติงาน)
 *
 * ชุดสิทธิ์ตรงกับที่ `listAuditLogs` ใช้อยู่แล้ว — root กับ university_wide อ่าน audit ได้ทั้งคู่
 * ส่วนแอดมินคณะไม่ได้ เพราะ audit log ไม่มี faculty_id ผูกตรง ๆ ให้ scope ได้
 */
export async function requireAdminOversight(req: Request , res: Response , next : NextFunction){
    const admin = await AdminRepo.findAdminByUserId(req.user!.user_id);
    if(!admin || admin.scope_type === 'faculty'){
        return next(new AppError(403 , "INSUFFICIENT_ADMIN_SCOPE" , "สิทธิ์ผู้ดูแลระบบของคุณไม่ครอบคลุมขอบเขตนี้"));
    }
    req.admin = admin;
    next();
}
