import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { parseId } from '../utils/parseId.js';
import { findTournamentById } from '../repositories/tournament.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import * as AdminRepo from '../repositories/adminScope.repo.js';
import * as ComplaintRepo from '../repositories/matchResultComplaint.repo.js';
import { isOrganizerOf } from './requireOrganizer.js';
import { isRefereeOfMatch, isTeamLeaderOfMatch } from './requireReferee.js';

/**
 * OD-26 ข้อ 8 — ใครแตะเรื่องร้องเรียนผลแมตช์ได้
 *
 * เรื่องนี้พกหลักฐานและข้อกล่าวหาถึงตัวบุคคล จึงไม่เปิดสาธารณะ — อ่านได้เฉพาะคนที่เกี่ยวข้องจริง
 * ผู้จัด "แนบความเห็นได้" แต่ไม่มี route ไหนให้ผู้จัดปิดเรื่อง และคนตัดสินคือแอดมินมหาวิทยาลัย
 * เพราะผู้จัดอาจเป็นคู่กรณีเอง (หลัก "คนตัดสินต้องมีข้อมูลและไม่ใช่คู่กรณี")
 */

async function canReadComplaintsOfMatch(matchId : number , userId : number): Promise<boolean>{
    const match = await MatchRepo.findById(matchId);
    if(!match) return false;

    const tournament = await findTournamentById(match.tournament_id);
    if(tournament && isOrganizerOf(tournament , userId)) return true;

    const admin = await AdminRepo.findAdminByUserId(userId);
    if(admin) return true;

    return (await isTeamLeaderOfMatch(matchId , userId)) || (await isRefereeOfMatch(matchId , userId , match.tournament_id));
}

/** `GET /matches/:id/result/complaints` */
export async function requireComplaintReaderOfMatch(req : Request, res : Response, next : NextFunction){
    try{
        if(!req.user){
            return next(new AppError(401, 'NO_TOKEN', 'กรุณาเข้าสู่ระบบก่อนใช้งาน'));
        }
        const matchId = parseId(req.params['id'], 'รหัสแมตช์');
        const match = await MatchRepo.findById(matchId);
        if(!match){
            return next(new AppError(404, 'MATCH_NOT_FOUND', 'ไม่พบแมตช์นี้'));
        }
        if(!(await canReadComplaintsOfMatch(matchId , req.user.user_id))){
            return next(new AppError(403, 'NOT_COMPLAINT_PARTY', 'คุณไม่มีสิทธิ์อ่านเรื่องร้องเรียนของแมตช์นี้'));
        }
        req.match = match;
        next();
    }catch(err){
        next(err);
    }
}

/** `GET /match-result-complaints/:id` — สิทธิ์ชุดเดียวกัน แต่หาแมตช์จากตัวเรื่อง */
export async function requireComplaintReader(req : Request, res : Response, next : NextFunction){
    try{
        if(!req.user){
            return next(new AppError(401, 'NO_TOKEN', 'กรุณาเข้าสู่ระบบก่อนใช้งาน'));
        }
        const complaintId = parseId(req.params['id'], 'รหัสเรื่องร้องเรียน');
        const complaint = await ComplaintRepo.findById(complaintId);
        if(!complaint){
            return next(new AppError(404, 'COMPLAINT_NOT_FOUND', 'ไม่พบเรื่องร้องเรียนนี้'));
        }
        if(!(await canReadComplaintsOfMatch(complaint.match_id , req.user.user_id))){
            return next(new AppError(403, 'NOT_COMPLAINT_PARTY', 'คุณไม่มีสิทธิ์อ่านเรื่องร้องเรียนนี้'));
        }
        next();
    }catch(err){
        next(err);
    }
}

/**
 * `PUT /match-result-complaints/:id/statement` — ผู้จัดของทัวร์ที่แมตช์นั้นอยู่
 * route นี้อยู่นอก prefix ที่ lockCompletedTournament คุม จึงทำได้แม้ทัวร์ปิดแล้วตามมติ 26 ก.ย.
 */
export async function requireOrganizerOfComplaint(req : Request, res : Response, next : NextFunction){
    try{
        if(!req.user){
            return next(new AppError(401, 'NO_TOKEN', 'กรุณาเข้าสู่ระบบก่อนใช้งาน'));
        }
        const complaintId = parseId(req.params['id'], 'รหัสเรื่องร้องเรียน');
        const complaint = await ComplaintRepo.findById(complaintId);
        if(!complaint){
            return next(new AppError(404, 'COMPLAINT_NOT_FOUND', 'ไม่พบเรื่องร้องเรียนนี้'));
        }
        const tournament = await findTournamentById(complaint.tournament_id);
        if(!tournament){
            return next(new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้'));
        }
        if(!isOrganizerOf(tournament , req.user.user_id)){
            return next(new AppError(403, 'NOT_ORGANIZER', 'คุณไม่ใช่ผู้จัดการแข่งขันของทัวร์นาเมนต์นี้'));
        }
        req.tournament = tournament;
        next();
    }catch(err){
        next(err);
    }
}
