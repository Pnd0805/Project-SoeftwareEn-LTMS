import type { Request, Response, NextFunction } from 'express';   // ① type ของ 3 พารามิเตอร์
import { AppError } from '../utils/AppError.js';                  // ② ไว้ throw error
import { parseId } from '../utils/parseId.js';                    // ③ แปลง :id → number
import * as TournamentRepo from '../repositories/tournament.repo.js';  // ④ ดึงทัวร์มาเช็ค
import * as MatchRepo from '../repositories/match.repo.js';            // ⑤ เฉพาะตัวที่ 2

export async function requireOrganizer(req : Request, res : Response, next : NextFunction){
    if(!req.user){
        return next(new AppError(401, 'NO_TOKEN', 'กรุณาเข้าสู่ระบบก่อนใช้งาน'));
    }

    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');

    const tournament = await TournamentRepo.findById(tournamentId);
    if(!tournament){
        return next(new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้'));
    }

    if(tournament.requested_by_user_id !== req.user.user_id){
        return next(new AppError(403, 'NOT_ORGANIZER', 'คุณไม่ใช่ผู้จัดการแข่งขันของทัวร์นาเมนต์นี้'));
    }

    req.tournament = tournament;
    next();
}

export async function requireOrganizerOfMatch(req : Request, res : Response, next : NextFunction){
    if(!req.user){
        return next(new AppError(401, 'NO_TOKEN', 'กรุณาเข้าสู่ระบบก่อนใช้งาน'));
    }

    const matchId = parseId(req.params['id'], 'รหัสแมตช์');

    const match = await MatchRepo.findById(matchId);
    if(!match){
        return next(new AppError(404, 'MATCH_NOT_FOUND', 'ไม่พบแมตช์นี้'));
    }

    const tournament = await TournamentRepo.findById(match.tournament_id);
    if(!tournament){
        return next(new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้'));
    }

    if(tournament.requested_by_user_id !== req.user.user_id){
        return next(new AppError(403, 'NOT_ORGANIZER', 'คุณไม่ใช่ผู้จัดการแข่งขันของทัวร์นาเมนต์นี้'));
    }

    req.match = match;
    req.tournament = tournament;
    next();
}