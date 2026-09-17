import type { Request , Response , NextFunction } from "express";
import * as RefereeRepo from '../repositories/tournamentReferee.repo.js';
import * as MatchRefereeRepo from '../repositories/matchReferee.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import * as TeamRepo from '../repositories/team.repo.js';
import * as TourRepo from '../repositories/tournament.repo.js';
import * as SportTypeRepo from '../repositories/sportType.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';

import { isActiveReferee, refereesNeededPerMatch } from "../services/referee.service.js";

import { checkMatch, checkMatchResult } from "../utils/checkExist.js";
import { parseId } from "../utils/parseId.js";
import { AppError } from "../utils/AppError.js";
import type { MatchResultRow, MatchRow } from "../types/db.js";

export async function isRefereeOfMatch(matchId: number, userId: number, tournamentId: number): Promise<boolean> {
    const ref = await RefereeRepo.findLatestByTournamentAndUser(tournamentId, userId);
    if (!isActiveReferee(ref)) return false;   // ★ ครึ่งที่เหลือ — ผ่านฟังก์ชันเดียว ไม่ต้องเช็คทีละ field

    const assignReferee = await MatchRefereeRepo.findByMatch(matchId);
    return assignReferee.some(r => r.user_id === userId); 
}

export async function isTeamLeaderOfMatch(matchId: number , userId : number):Promise<boolean>{
    const match = await checkMatch(matchId);

    if (match.team_a_id !== null) {
        const teamA = await TeamRepo.findById(match.team_a_id);
        if (teamA?.leader_id === userId) return true;
    }

    if (match.team_b_id !== null){
        const teamB = await TeamRepo.findById(match.team_b_id);
        if (teamB?.leader_id === userId) return true;
    }

    return false;
}

export async function isLeaderOfTeam(winnerTeamId : number , userId : number): Promise<boolean>{
    const team = await TeamRepo.findById(winnerTeamId);
    return team!.leader_id === userId ? true : false;
}

export async function isDisputeWindow(tourId : number , matchRes : MatchResultRow): Promise<boolean>{
    const tour = await TourRepo.findTournamentById(tourId);
    const deadline = new Date(matchRes!.verified_at!.getTime() + tour!.dispute_window_hours * 3600 * 1000)

    if( new Date() > deadline){
        return false
    }
    return true;
}

/** แมตช์นี้มีกรรมการ active ครบตามประเภทไหม — on-site+stat = 2, อื่น (รวม online) = 1 · กฎอยู่ที่ refereesNeededPerMatch */
export async function isRefereeSufficient(match : MatchRow) : Promise<boolean> {
    const tournament = await TournamentRepo.findTournamentById(match.tournament_id);
    if (!tournament) return false;

    const needed = await refereesNeededPerMatch(tournament.sport_type_id);
    const acceptedCount = await MatchRefereeRepo.countAcceptedByMatch(match.match_id);
    return acceptedCount >= needed(match.mode);
}




export async function requireCanSubmitResult(req : Request , res : Response , next : NextFunction){
    try{
        if(!req.user){
            return next(new AppError(401 , "NO_TOKEN" , "กรุณาเข้าสู่ระบบก่อนใช้งาน"));
        }

        const matchId = parseId(req.params['id'] , "รหัสการแข่งขัน" , "id");
        const match = await checkMatch(matchId);

        if(match.team_a_id === null || match.team_b_id === null){
            return next(new AppError(409, "MATCH_TEAMS_INCOMPLETE", "แมตช์นี้ยังไม่มีทีมครบทั้งสองฝั่ง ยังไม่สามารถส่งผลการแข่งขันได้"));
        }

        if (match.mode === 'onsite') {
            if (!(await isRefereeOfMatch(matchId, req.user.user_id, match.tournament_id))) {
                return next(new AppError(403, "WRONG_SUBMITTER_ROLE", "ตามโหมดการแข่งขันนี้ คุณไม่ใช่ผู้ที่ส่งผลได้")); 
            }
            req.submitrole = 'referee';

        } else if(match.mode === 'online') {
            if (!(await isTeamLeaderOfMatch(matchId, req.user.user_id))) {
                return next(new AppError(403, "WRONG_SUBMITTER_ROLE", "ตามโหมดการแข่งขันนี้ คุณไม่ใช่ผู้ที่ส่งผลได้"));
            }
            req.submitrole = 'team_leader';
        }

        next();

    }catch (err){
        next(err);
    }
}

export async function requireCanVerifyResult(req : Request , res : Response , next : NextFunction){
    try{
        if(!req.user){
            return next(new AppError(401 , "NO_TOKEN" , "กรุณาเข้าสู่ระบบก่อนใช้งาน"));
        }


        const matchId = parseId(req.params['id'] , "รหัสการแข่งขัน" , "id");

        const match = await checkMatch(matchId);
        const matchRes = await checkMatchResult(matchId);

        if(matchRes.match_result_status !== 'submitted'){
            return next(new AppError(409 , "MATCH_RESULT_ALREADY_VERIFIED" , "การแข่งขันถูก verify แล้ว"));
        }

        if(req.user.user_id ===  matchRes!.submitted_by_user_id){
            return next(new AppError(403 , "SAME_PERSON_CANNOT_VERIFY" , "ผู้ยืนยันต้องไม่ใช่คนเดียวกับผู้ส่งผล"));
        }

        if(match.mode === 'online'){
            if (!(await isRefereeOfMatch(matchId, req.user.user_id, match.tournament_id))) {
                return next(new AppError(403, "WRONG_SUBMITTER_ROLE", "ตามโหมดการแข่งขันนี้ คุณไม่ใช่ผู้ที่ส่งผลได้"));
            }
            req.match = match
            req.matchResult = matchRes!

        } else if(match.mode === 'onsite'){
            if(!(await isLeaderOfTeam(matchRes!.winner_team_id!, req.user.user_id))){
                return next(new AppError(403, "WRONG_SUBMITTER_ROLE", "ตามโหมดการแข่งขันนี้ คุณไม่ใช่ผู้ที่ส่งผลได้"));
            }
            req.match = match
            req.matchResult = matchRes!

        }

        next();

    }catch(err){
        next(err);
    }
}


export async function requireCanDisputeResult(req : Request , res : Response , next : NextFunction){
    try{
        if(!req.user){
            return next(new AppError(401 , "NO_TOKEN" , "กรุณาเข้าสู่ระบบก่อนใช้งาน"));
        }

        const matchId = parseId(req.params['id'] , "รหัสการแข่งขัน" , "id");
        const match = await checkMatch(matchId)
        const matchRes = await checkMatchResult(matchId);

        if(matchRes.match_result_status === 'disputed'){
            return next(new AppError(409 , "DISPUTE_ALREADY_ACTIVE" , "มีข้อโต้แย้งที่ยังไม่ได้ข้อยุติอยู่แล้ว"));
        }

        if(!(await isDisputeWindow(match!.tournament_id , matchRes))){
            return next(new AppError(409 , "DISPUTE_WINDOW_CLOSED" , "พ้นระยะเวลาที่เปิดให้โต้แย้งผลแล้ว"));
        }

        if (!(await isRefereeOfMatch(matchId, req.user.user_id, match.tournament_id)) && !(await isTeamLeaderOfMatch(matchId, req.user.user_id))) {
            return next(new AppError(403, "WRONG_SUBMITTER_ROLE", "ตามโหมดการแข่งขันนี้ คุณไม่ใช่ผู้ที่ส่งผลได้")); 
        }

        next();

    } catch(err){
        next(err);
    }
}

export async function requireCanRecordStats(req : Request , res : Response , next : NextFunction){
    try{
        if(!req.user){
            return next(new AppError(401 , "NO_TOKEN" , "กรุณาเข้าสู่ระบบก่อนใช้งาน"));
        }

        const matchId = parseId(req.params['id'] , "รหัสการแข่งขัน" , "id");
        const match = await checkMatch(matchId)

        if(match.mode === 'onsite'){
            if(!(await isRefereeSufficient(match))){
                return next(new AppError(409 , "INSUFFICIENT_REFEREES" , "ต้องมีกรรมการยืนยันแล้วอย่างน้อย 2 คนสําหรับการแข่งแบบ on-site ที่บันทึกสถิติ"));
            }
        }

        if (!(await isRefereeOfMatch(matchId , req.user.user_id , match.tournament_id))){
                        return next(new AppError(403, "WRONG_SUBMITTER_ROLE", "ตามโหมดการแข่งขันนี้ คุณไม่ใช่ผู้ที่ส่งผลได้")); 
        }

        next();
    }catch(err){
        next(err);
    }
}

/**
 * กรรมการของแมตช์ (ใช้กับ start / verify / reject check-in ใน match.routes)
 * = active ในทัวร์ (isActiveReferee) + รับมอบหมายแมตช์นี้แล้ว (match_referees accepted) — ผ่าน isRefereeOfMatch
 * ★ กฎเดียวกับ F12/S01-S03 (GUIDE/11) — กรรมการของทัวร์ที่ไม่ได้รับแมตช์นี้ ทำไม่ได้
 */
export async function requireReferee(req : Request, res : Response, next : NextFunction){
    if(!req.user){
        return next(new AppError(401, "NO_TOKEN", "กรุณาเข้าสู่ระบบก่อนใช้งาน"));
    }

    const matchId = parseId(req.params['id'], 'รหัสการแข่งขัน');
    const match = await MatchRepo.findById(matchId);
    if(!match){
        return next(new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้"));
    }

    if(!(await isRefereeOfMatch(matchId, req.user.user_id, match.tournament_id))){
        return next(new AppError(403, "NOT_REFEREE", "คุณไม่ได้เป็นกรรมการของแมตช์นี้"));
    }

    req.match = match;
    next();
}
