import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { findTournamentById } from '../repositories/tournament.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** เส้นทางที่ยังใช้ได้หลังปิดทัวร์ (ประกาศปิดงาน · C6 ให้คะแนน/โหวต MVP ซึ่งเปิดหลังปิดทัวร์เท่านั้น) */
const ALLOWED_AFTER_COMPLETE = [/^\/announcements/, /^\/feedback$/, /^\/mvp-votes$/];

/**
 * B1 (มติ 21 ก.ย. 2-ค) — ทัวร์ที่ `completed` แล้วห้ามเขียนอะไรอีก (นัดหมาย/ผล/โต้แย้ง/เช็คอิน/กรรมการ/สมัคร)
 * mount ที่ /tournaments/:id และ /matches/:id ใน routes/index.ts ก่อน router ย่อย — ไม่ต้องแปะทีละ route
 * ไม่รู้จัก id / ไม่พบ → ปล่อยผ่านให้ route จริงตอบ 400/404 ตามเดิม
 */
export async function lockCompletedTournament(req : Request, res : Response, next : NextFunction){
    try{
        if(!WRITE.has(req.method)) return next();
        if(ALLOWED_AFTER_COMPLETE.some(re => re.test(req.path))) return next();
        const id = Number(req.params['id']);
        if(!Number.isInteger(id) || id <= 0) return next();

        let tournamentId = id;
        if(req.baseUrl.endsWith(`/matches/${id}`)){
            const match = await MatchRepo.findById(id);
            if(!match) return next();
            tournamentId = match.tournament_id;
        }
        const tournament = await findTournamentById(tournamentId);
        if(tournament?.tournament_status === 'completed'){
            return next(new AppError(409, 'TOURNAMENT_COMPLETED', 'ทัวร์นาเมนต์นี้ปิดการแข่งขันแล้ว แก้ไขอะไรไม่ได้อีก',
                                     { tournamentId, completedAt : tournament.completed_at }));
        }
        next();
    }catch(err){
        next(err);
    }
}
