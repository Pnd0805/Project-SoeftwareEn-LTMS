import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { findTournamentById } from '../repositories/tournament.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** เส้นทางที่ยังใช้ได้หลังปิดทัวร์ (ประกาศปิดงาน) */
const ALLOWED_AFTER_COMPLETE = [/^\/announcements/];

/**
 * Tournament lifecycle guard mounted before child routers.
 * - completed: block writes (except announcements)
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
