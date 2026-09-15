import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { parseId } from '../utils/parseId.js';
import { findTournamentById } from '../repositories/tournament.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import type { TournamentRow } from '../types/db.js';

/** ทัวร์ที่ยังไม่ถูกอนุมัติ/ถูกปฏิเสธ ยังไม่มีผู้จัดการแข่งขันที่ทำอะไรได้ */
function isOrganizerOf(tournament : TournamentRow, userId : number): boolean {
    const isOwner = tournament.requested_by_user_id === userId;
    const isValidStatus = tournament.tournament_status !== 'pending_approval'
                       && tournament.tournament_status !== 'rejected';
    return isOwner && isValidStatus;
}

export async function requireOrganizer(req : Request, res : Response, next : NextFunction){
    if(!req.user){
        return next(new AppError(401, 'NO_TOKEN', 'กรุณาเข้าสู่ระบบก่อนใช้งาน'));
    }

    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');

    const tournament = await findTournamentById(tournamentId);
    if(!tournament){
        return next(new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้'));
    }

    if(!isOrganizerOf(tournament, req.user.user_id)){
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

    const tournament = await findTournamentById(match.tournament_id);
    if(!tournament){
        return next(new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้'));
    }

    if(!isOrganizerOf(tournament, req.user.user_id)){
        return next(new AppError(403, 'NOT_ORGANIZER', 'คุณไม่ใช่ผู้จัดการแข่งขันของทัวร์นาเมนต์นี้'));
    }

    req.match = match;
    req.tournament = tournament;
    next();
}
