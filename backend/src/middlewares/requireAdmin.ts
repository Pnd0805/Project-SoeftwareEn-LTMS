import type { Request , Response , NextFunction } from "express";
import * as AdminRepo from '../repositories/adminScope.repo.js';
import { AppError } from "../utils/AppError.js";

// รับ admin ได้ทั้ง scope_type 'faculty' และ 'university_wide' — ต่างจาก requireAdmin_U ที่บังคับ university_wide เท่านั้น
// แต่ละ service เช็คเองว่า scope ที่มีทำ action นี้ได้แค่ไหน (C2 ข้อ 1/2)
export async function requireAdmin(req: Request , res: Response , next : NextFunction){
    const admin = await AdminRepo.findAdminByUserId(req.user!.user_id);
    if(!admin){
        return next(new AppError(403 , "INSUFFICIENT_ADMIN_SCOPE" , "สิทธิ์ผู้ดูแลระบบของคุณไม่ครอบคลุมขอบเขตนี้"));
    }
    req.admin = admin;
    next();
}
