import type { Request , Response , NextFunction } from 'express';
import * as TeamRepo from '../repositories/team.repo.js';
import { AppError } from '../utils/AppError.js';
import { parseId } from '../utils/parseId.js';

/**
 * 🔴 A3 (integration test เจอ 6 ต.ค. 2569) — ใช้ parseId ไม่ใช่ Number()
 *
 * เดิม `Number('abc')` = NaN แล้วส่งต่อเข้า SQL · mysql2 เขียน NaN ลงคิวรีเป็นคำเปล่า
 * ⇒ MySQL อ่านเป็นชื่อคอลัมน์ ⇒ "Unknown column 'NaN'" ⇒ 500 INTERNAL_ERROR
 * กระทบทุก route ที่ผ่านด่านนี้ (10 เส้น: แก้/ลบทีม · ลบสมาชิก · คำเชิญ · ขอเป็นทีมทางการ ·
 * อนุมัติ/ปฏิเสธคำขอเข้าทีม) · ไม่ใช่ช่องโหว่ (ไม่มีค่าจากผู้ใช้หลุดเข้า SQL) แต่ input ผิดต้องได้ 4xx
 * 🔴 unit test ของ controller เคยเชื่อว่าได้ 404 เพราะ repo ถูก mock — แก้คอมเมนต์นั้นแล้ว
 *
 * ★ ใช้รูปแบบเดียวกับ requireOrganizer ที่ใช้ parseId อยู่แล้ว ⇒ ได้ 400 VALIDATION_FAILED
 *   พร้อม fields.id บอก FE ว่าช่องไหนผิด (เหมือนด่านอื่นทั้งโปรเจกต์)
 */
export async function requireTeamLeader(req : Request , res : Response , next : NextFunction){
    if(!req.user){
        return next(new AppError(401 , "NO_TOKEN" , "กรุณาเข้าสู่ระบบก่อนใช้งาน"));
    }
    const teamId = parseId(req.params['id'] , 'รหัสทีม' , 'id');
    const team = await TeamRepo.findById(teamId);
    if(!team || team.deleted_at){
        return next(new AppError(404 , "TEAM_NOT_FOUND" , "ไม่พบทีมนี้" ));
    }

    if(team.leader_id !== req.user.user_id){
        return next(new AppError(403 , "NOT_TEAM_LEADER" , "คุณไม่ใช่หัวหน้าทีมนี้"));
    }

    req.team = team;
    next();
}
