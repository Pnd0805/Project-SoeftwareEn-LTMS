import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { parseId } from '../utils/parseId.js';
import { findTournamentById } from '../repositories/tournament.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import { checkAnnouncement } from '../utils/checkExist.js';
import * as AdminRepo from '../repositories/adminScope.repo.js';
import * as MatchResRepo from '../repositories/matchResult.repo.js';
import { ORG_RESOLVE_HOURS } from '../config/scoring.js';
import type { TournamentRow } from '../types/db.js';

/** ทัวร์ที่ยังไม่ถูกอนุมัติ/ถูกปฏิเสธ ยังไม่มีผู้จัดการแข่งขันที่ทำอะไรได้ */
export function isOrganizerOf(tournament : TournamentRow, userId : number): boolean {
    const isOwner = tournament.requested_by_user_id === userId;
    const isValidStatus = tournament.tournament_status !== 'pending_approval'
                       && tournament.tournament_status !== 'rejected';
    return isOwner && isValidStatus;
}

/**
 * ผู้ยื่นคำขอจัดทัวร์ — เห็น/แก้ของตัวเองได้ตั้งแต่ยัง pending_approval (FE-c17b 20 ก.ย.)
 * ใช้เฉพาะ route ที่มีเหตุผลก่อนอนุมัติ (C17b) · route จัดการทัวร์อื่น ๆ ยังใช้ isOrganizerOf
 */
export function isRequesterOf(tournament : TournamentRow, userId : number): boolean {
    return tournament.requested_by_user_id === userId && tournament.tournament_status !== 'auto_deleted';
}

export async function requireRequester(req : Request, res : Response, next : NextFunction){
    if(!req.user){
        return next(new AppError(401, 'NO_TOKEN', 'กรุณาเข้าสู่ระบบก่อนใช้งาน'));
    }

    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');

    const tournament = await findTournamentById(tournamentId);
    if(!tournament){
        return next(new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้'));
    }

    if(!isRequesterOf(tournament, req.user.user_id)){
        return next(new AppError(403, 'NOT_ORGANIZER', 'คุณไม่ใช่ผู้ยื่นคำขอจัดทัวร์นาเมนต์นี้'));
    }

    req.tournament = tournament;
    next();
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

export async function requireOrganizerOfAnnouncement(req : Request, res : Response, next : NextFunction){
    try{
        if(!req.user){
            return next(new AppError(401, 'NO_TOKEN', 'กรุณาเข้าสู่ระบบก่อนใช้งาน'));
        }

        const announcementId = parseId(req.params['id'], 'รหัสประกาศ');
        const announcement = await checkAnnouncement(announcementId);

        const tournament = await findTournamentById(announcement.tournament_id);
        if(!tournament){
            return next(new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้'));
        }

        if(!isOrganizerOf(tournament, req.user.user_id)){
            return next(new AppError(403, 'NOT_ORGANIZER', 'คุณไม่ใช่ผู้จัดการแข่งขันของทัวร์นาเมนต์นี้'));
        }

        req.announcement = announcement;
        req.tournament = tournament;
        next();

    }catch(err){
        next(err);
    }
}

/**
 * OD-26 ข้อ 10 (มติ 26 ก.ย.) — ใครตัดสินข้อโต้แย้งได้
 *   ผู้จัดของแมตช์นั้น : ได้เสมอ
 *   แอดมินมหาวิทยาลัย : ได้เมื่อผู้จัดเงียบเกิน ORG_RESOLVE_HOURS นับจากเวลาที่ยื่นค้าน
 *
 * เป็นการ "เพิ่มคนที่กดได้" ไม่ใช่โอนอำนาจ — ผู้จัดยังกดได้ตลอด ใครถึงก่อนได้ก่อน
 * จำเป็นเพราะรอบชิงและ round robin ไม่มีแมตช์ถัดไปให้บล็อก แรงกดดันจึงไปไม่ถึงผู้จัดที่หายไป
 * ถ้าไม่มีใครปลดล็อก ทัวร์จะปิดไม่ได้ตลอดกาล พ่วงด้วยโหวต MVP ไม่เปิด รีวิวไม่ปิด และไม่มีแชมป์
 */
export async function requireCanResolveDispute(req : Request, res : Response, next : NextFunction){
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

    if(isOrganizerOf(tournament, req.user.user_id)){
        req.match = match;
        req.tournament = tournament;
        return next();
    }

    const admin = await AdminRepo.findAdminByUserId(req.user.user_id);
    if(!admin || admin.scope_type !== 'university_wide'){
        return next(new AppError(403, 'NOT_ORGANIZER', 'คุณไม่ใช่ผู้จัดการแข่งขันของทัวร์นาเมนต์นี้'));
    }

    const result = await MatchResRepo.findmatchResultByMatchId(matchId);
    const raisedAt = result?.dispute_raised_at ?? null;
    if(raisedAt === null){
        return next(new AppError(409, 'NO_ACTIVE_DISPUTE', 'แมตช์นี้ไม่มีข้อโต้แย้งที่รอตัดสิน'));
    }
    const openAt = new Date(raisedAt.getTime() + ORG_RESOLVE_HOURS * 3600 * 1000);
    if(Date.now() < openAt.getTime()){
        return next(new AppError(403, 'ORGANIZER_STILL_HAS_TIME',
            `ผู้จัดยังมีเวลาตัดสินถึง ${openAt.toISOString()} — แอดมินเข้ามาตัดสินแทนได้หลังจากนั้น`,
            { availableAt : openAt.toISOString() }));
    }

    req.match = match;
    req.tournament = tournament;
    next();
}

