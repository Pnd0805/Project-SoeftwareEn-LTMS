import * as JoinRepo from '../repositories/joinRequest.repo.js';
import * as TeamRepo from '../repositories/team.repo.js';
import * as SportRepo from '../repositories/sportType.repo.js';
import * as ApplicationRepo from '../repositories/application.repo.js';
import { ensureRosterUnlocked } from './team.service.js';
import { AppError } from '../utils/AppError.js';
import { checkTeam } from '../utils/checkExist.js';
import { toJoinRequestDto, toMyJoinRequestDto } from '../mappers/team.mapper.js';
import type { TeamRow } from '../types/db.js';

/**
 * ขอเข้าร่วมทีมสาธารณะ — มติ 20 ก.ย. 2569 (ทางเลือก ข: หัวหน้าทีมอนุมัติ)
 * กฎการเข้าทีมชุดเดียวกับรับคำเชิญ (T13): roster lock (B6) · CoI · โควตา 5 ทีม Unofficial · ยังไม่เป็นสมาชิก
 * + ทีมต้อง public และไม่เต็ม (sport_types.max_members) — เช็คทั้งตอนขอ (T20) และตอนอนุมัติ (T22) เพราะเวลาผ่านไปสถานะเปลี่ยนได้
 */
async function ensureCanJoin(team : TeamRow , userId : number): Promise<void>{
    if(team.deleted_at !== null){
        throw new AppError(404 , 'TEAM_NOT_FOUND' , 'ไม่พบทีมนี้ในระบบ');
    }
    if(await TeamRepo.isMemberOf(team.team_id , userId)){
        throw new AppError(409 , 'ALREADY_MEMBER' , 'คุณอยู่ในทีมนี้แล้ว');
    }
    await ensureRosterUnlocked(team.team_id);

    const conflict = await ApplicationRepo.findTeamTournamentConflictForUser(team.team_id , userId);
    if(conflict){
        throw new AppError(409 , 'TEAM_CONFLICT_OF_INTEREST' ,
            `คุณเป็น${conflict.role === 'organizer' ? 'ผู้จัด' : 'กรรมการ'}ของทัวร์นาเมนต์ "${conflict.name}" ที่ทีมนี้สมัครอยู่ เข้าร่วมทีมไม่ได้` ,
            { tournamentId : conflict.tournament_id , role : conflict.role });
    }
    if(await TeamRepo.countUnofficialTeamsByUser(userId) >= 5){
        throw new AppError(422 , 'TEAM_QUOTA_EXCEEDED' , 'คุณมีทีม Unofficial ครบ 5 ทีมแล้ว');
    }
    const sport = await SportRepo.findSportTypeById(team.sport_type_id);
    const members = await TeamRepo.countMemberByTeamId(team.team_id);
    if(sport && members >= sport.max_members){
        throw new AppError(409 , 'TEAM_FULL' , `ทีมนี้มีสมาชิกครบ ${sport.max_members} คนแล้ว` , { maxMembers : sport.max_members });
    }
}

/** T20 — POST /teams/:id/join-requests */
export async function createJoinRequest(teamId : number , userId : number , message : string | undefined){
    const team = await checkTeam(teamId);
    if(team.visibility !== 'public'){
        throw new AppError(409 , 'TEAM_PRIVATE' , 'ทีมนี้เป็นทีมส่วนตัว เข้าร่วมได้เฉพาะเมื่อได้รับคำเชิญจากหัวหน้าทีม');
    }
    if(team.leader_id === userId){
        throw new AppError(409 , 'ALREADY_MEMBER' , 'คุณเป็นหัวหน้าทีมนี้อยู่แล้ว');
    }
    await ensureCanJoin(team , userId);
    if(await JoinRepo.findPendingByTeamAndUser(teamId , userId)){
        throw new AppError(409 , 'JOIN_REQUEST_PENDING' , 'คุณส่งคำขอเข้าร่วมทีมนี้ไปแล้ว รอหัวหน้าทีมตอบ');
    }
    const id = await JoinRepo.create(teamId , userId , message ?? null);
    return { id , teamId , status : 'pending' as const };
}

/** T21 — GET /teams/:id/join-requests (หัวหน้าทีม) */
export async function listJoinRequests(teamId : number){
    return { items : (await JoinRepo.findPendingByTeam(teamId)).map(toJoinRequestDto) };
}

async function getPendingRequestOfTeam(teamId : number , requestId : number){
    const request = await JoinRepo.findById(requestId);
    if(!request || request.team_id !== teamId){
        throw new AppError(404 , 'JOIN_REQUEST_NOT_FOUND' , 'ไม่พบคำขอเข้าร่วมทีมนี้');
    }
    if(request.team_join_request_status !== 'pending'){
        throw new AppError(409 , 'JOIN_REQUEST_ALREADY_ANSWERED' , 'คำขอนี้ถูกตอบไปแล้ว');
    }
    return request;
}

/** T22 — POST /teams/:id/join-requests/:rid/approve (หัวหน้าทีม) — เช็คกฎซ้ำ ณ ตอนอนุมัติ */
export async function approveJoinRequest(teamId : number , requestId : number , leaderUserId : number){
    const team = await checkTeam(teamId);
    const request = await getPendingRequestOfTeam(teamId , requestId);
    await ensureCanJoin(team , request.user_id);
    if(!(await JoinRepo.approve(requestId , teamId , request.user_id , leaderUserId))){
        throw new AppError(409 , 'JOIN_REQUEST_ALREADY_ANSWERED' , 'คำขอนี้ถูกตอบไปแล้ว');
    }
    const updated = (await TeamRepo.findById(teamId))!;
    return { id : requestId , userId : request.user_id , status : 'approved' as const , teamReadinessStatus : updated.readiness_status };
}

/** T23 — POST /teams/:id/join-requests/:rid/reject (หัวหน้าทีม) */
export async function rejectJoinRequest(teamId : number , requestId : number , leaderUserId : number , reason : string | undefined){
    await getPendingRequestOfTeam(teamId , requestId);
    if(!(await JoinRepo.settle(requestId , 'rejected' , leaderUserId , reason ?? null))){
        throw new AppError(409 , 'JOIN_REQUEST_ALREADY_ANSWERED' , 'คำขอนี้ถูกตอบไปแล้ว');
    }
    return { id : requestId , status : 'rejected' as const };
}

/** T24 — GET /me/join-requests */
export async function listMyJoinRequests(userId : number){
    return { items : (await JoinRepo.findByUser(userId)).map(toMyJoinRequestDto) };
}

/** T25 — DELETE /me/join-requests/:rid — ผู้ขอยกเลิกเอง */
export async function cancelJoinRequest(requestId : number , userId : number){
    const request = await JoinRepo.findById(requestId);
    if(!request || request.user_id !== userId){
        throw new AppError(404 , 'JOIN_REQUEST_NOT_FOUND' , 'ไม่พบคำขอเข้าร่วมทีมนี้');
    }
    if(request.team_join_request_status !== 'pending'){
        throw new AppError(409 , 'JOIN_REQUEST_ALREADY_ANSWERED' , 'คำขอนี้ถูกตอบไปแล้ว ยกเลิกไม่ได้');
    }
    await JoinRepo.settle(requestId , 'cancelled' , null , null);
}
