import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { findTournamentById } from '../repositories/tournament.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** เส้นทางที่ยังใช้ได้หลังปิดทัวร์ (ประกาศปิดงาน · C6 ให้คะแนน/โหวต MVP ซึ่งเปิดหลังปิดทัวร์เท่านั้น · C7 คอมเมนต์ทัวร์) */
const ALLOWED_AFTER_COMPLETE = [/^\/announcements/, /^\/feedback\/?$/, /^\/mvp-votes\/?$/, /^\/comments(\/(me|\d+))?\/?$/];   // Express ไม่ strict — '/feedback/' ก็เข้า route เดียวกัน
/**
 * เส้นทางที่ยังใช้ได้หลังยกเลิกทัวร์ (migration 053 · มติ 28 ต.ค.) — ประกาศ · รีวิวผู้จัด (7 วัน — feedback.service) · ความเห็น
 * ★ ไม่มี mvp-votes — MVP เป็นรางวัลของทัวร์ที่แข่งจบ ทัวร์ที่ถูกยกเลิกไม่มีการโหวต
 */
const ALLOWED_AFTER_CANCEL = [/^\/announcements/, /^\/feedback\/?$/, /^\/comments(\/(me|\d+))?\/?$/];

/**
 * Tournament lifecycle guard mounted before child routers.
 * - completed: block writes (except announcements)
 * - cancelled: block writes (except announcements · feedback · comments) — "แช่แข็ง" ทุกอย่างไว้เป็นประวัติ
 * - soft-deleted: hide `/tournaments/:id/*` and `/matches/:id/*` behind 404
 * Direct `GET /tournaments/:id` is left to the tournament route itself to avoid a duplicate lookup.
 */
export async function lockCompletedTournament(req : Request, res : Response, next : NextFunction){
    try{
        const id = Number(req.params['id']);
        if(!Number.isInteger(id) || id <= 0) return next();

        let tournamentId = id;
        let matchRoute = false;
        if(req.baseUrl.endsWith(`/matches/${id}`)){
            matchRoute = true;
            const match = await MatchRepo.findById(id);
            if(!match) return next();
            tournamentId = match.tournament_id;
        }

        if(!WRITE.has(req.method) && !matchRoute && req.path === '/') return next();

        const tournament = await findTournamentById(tournamentId);
        if(!tournament){
            return next(new AppError(
                404,
                matchRoute ? 'MATCH_NOT_FOUND' : 'TOURNAMENT_NOT_FOUND',
                matchRoute ? 'ไม่พบแมตช์นี้' : 'ไม่พบทัวร์นาเมนต์นี้'
            ));
        }

        if(!WRITE.has(req.method)) return next();

        if(tournament.tournament_status === 'cancelled'){
            if(ALLOWED_AFTER_CANCEL.some(re => re.test(req.path))) return next();
            return next(new AppError(409, 'TOURNAMENT_CANCELLED', 'ทัวร์นาเมนต์นี้ถูกยกเลิกแล้ว แก้ไขอะไรไม่ได้อีก',
                                     { tournamentId, cancelledAt : tournament.cancelled_at }));
        }
        if(ALLOWED_AFTER_COMPLETE.some(re => re.test(req.path))) return next();

        if(tournament.tournament_status === 'completed'){
            return next(new AppError(409, 'TOURNAMENT_COMPLETED', 'ทัวร์นาเมนต์นี้ปิดการแข่งขันแล้ว แก้ไขอะไรไม่ได้อีก',
                                     { tournamentId, completedAt : tournament.completed_at }));
        }
        next();
    }catch(err){
        next(err);
    }
}
