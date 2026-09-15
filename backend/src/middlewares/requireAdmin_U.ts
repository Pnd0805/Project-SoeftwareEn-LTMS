import type { Request , Response , NextFunction } from "express";
import * as AdminRepo from '../repositories/adminScope.repo.js';
import { AppError } from "../utils/AppError.js";

export async function requireAdmin_U(req: Request , res: Response , next : NextFunction){
    const admin = await AdminRepo.findAdminByUserId(req.user!.user_id);
    if(!admin || admin.scope_type !== 'university_wide'){
        return next(new AppError(403 , "INSUFFICIENT_ADMIN_SCOPE" , "สิทธิ์ผู้ดูแลระบบของคุณไม่ครอบคลุมขอบเขตนี้"));
    }
    req.admin = admin;
    next();
}