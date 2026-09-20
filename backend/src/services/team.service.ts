import * as TeamRepo from '../repositories/team.repo.js';
import * as SportRepo from '../repositories/sportType.repo.js';
import * as UserRepo from '../repositories/user.repo.js';
import * as ApplicationRepo from '../repositories/application.repo.js';

import type { TeamInput, updateTeamInput } from '../schemas/team.schema.js';

import { toCreateTeam , toMyTeam, toTeamDto, toCreateTeamInvitation, toUpdateMember, toGetAllInvitation, getTeamOfficialRequestDto } from '../mappers/team.mapper.js';
import { toTeamMemberDto, type MyTeam } from '../mappers/team.mapper.js';
import { toUserRef } from '../mappers/user.mapper.js';
import { buildPagination } from '../utils/pagination.js';

import { AppError } from '../utils/AppError.js';
import { checkTeam, checkUser } from '../utils/checkExist.js';

export async function createTeam(input : TeamInput , leaderId : number){

    const sportExist = await SportRepo.findSportTypeById(input.sportTypeId);
    if(!sportExist){
        const fields = {sportTypeId : "ไม่พบกีฬานี้ในการแข่งขัน"}
        throw new AppError(400 , "VALIDATION_FAILED" , "ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบและกรอกใหม่" , { fields });
    }

    const nameExist = await TeamRepo.findByNameAndSport(input.name , input.sportTypeId);
    if(nameExist){
        throw new AppError(409 , "TEAM_NAME_TAKEN" , "มีทีมชื่อนี้ในประเภทกีฬานี้แล้ว");
    }

    const quota = await TeamRepo.countUnofficialTeamsByUser(leaderId);
    if(quota >= 5){
        throw new AppError(422 , "TEAM_QUOTA_EXCEEDED" , "คุณมีทีม Unofficial ครบ 5 ทีมแล้ว ");
    }

    const team_id = await TeamRepo.createTeam(input , leaderId);
    const data = await TeamRepo.findById(team_id);

    return toCreateTeam(data!);
}

export async function getMyTeam(userId : number){
    const data : MyTeam[] = [];
    const teams = await TeamRepo.findTeamsByUser(userId); //return TeamRow[]
    for(const team of teams){
        const teamId = team['team_id'];   //team_id of each team
        const memberCount = await TeamRepo.countMemberByTeamId(teamId);

        data.push(toMyTeam(team , memberCount , userId));
    };
    return { items : data };
}


/** T19 — GET /teams?q=&sportTypeId=&visibility= ค้นหาทีม (มติ 20 ก.ย.) — ทีมที่ลบ/Inactive ไม่โชว์ */
export async function searchTeams(filters : { q? : string | undefined; sportTypeId? : number | undefined; visibility? : 'private' | 'public' | undefined },
                                  offset : number , page : number , pageSize : number){
    const { rows , totalItems } = await TeamRepo.searchTeams(filters , offset , pageSize);
    return {
        items : rows.map(r => toTeamDto(r , r.member_count , toUserRef({ user_id : r.leader_id , full_name : r.leader_full_name , profile_image_key : r.leader_profile_image_key }))),
        pagination : buildPagination(page , pageSize , totalItems)
    };
}

export async function getTeamById(teamId : number){
    const team = await checkTeam(teamId);

    const memberCount = await TeamRepo.countMemberByTeamId(teamId);
    const leader_id = team['leader_id'];
    const leaderRef = await UserRepo.findById(leader_id);
    if(!leaderRef){
        throw new AppError(404 , 'USER_NOT_FOUND' , 'ไม่พบผู้ใช้ในระบบ');
    }

    return toTeamDto(team, memberCount , toUserRef(leaderRef));
}

export async function updateTeam(teamId : number , sportType:number , newTeam : updateTeamInput){
    if(newTeam.name){
        const nameExist = await TeamRepo.findByNameAndSport(newTeam.name , sportType);
        if(nameExist && nameExist.team_id !== teamId){
            throw new AppError(409 , 'TEAM_NAME_TAKEN' , 'มีทีมชื่อนี้ในประเภทกีฬานี้แล้ว ');
        }
    }

    await TeamRepo.update(teamId , newTeam);
    return await getTeamById(teamId);
};

export async function deleteTeam(teamId : number){
    const team = await checkTeam(teamId);

    if(team['deleted_at'] !== null){
        throw new AppError(404 , "TEAM_NOT_FOUND" , "ไม่พบทีมนี้ในระบบ");
    }


    return await TeamRepo.deleteTeam(teamId);
}



//Member
export async function getTeamMemberById(teamId :number , userId : number){
    const team = await checkTeam(teamId);

    // สมาชิกทีม หรือ ORG/กรรมการของทัวร์ที่ทีมนี้สมัคร (เช็คอินด้วยมือ M19 ต้องเห็นรายชื่อ — FE gaps 19 ก.ย.)
    const user = await TeamRepo.isMemberOf(team['team_id'] , userId);
    if(!user && !(await ApplicationRepo.isTournamentStaffOfTeam(team['team_id'] , userId))){
        throw new AppError(403 , "FORBIDDEN" , "คุณไม่มีสิทธิ์ทํารายการนี้ ");
    }
    const members = await TeamRepo.findTeamMemberById(team['team_id']);
    const data = members.map(toTeamMemberDto)
    return { items : data };
}

/** B6: ทีมที่อยู่ในทัวร์ (approved, ทัวร์ยังไม่จบ) แก้สมาชิกไม่ได้ — T07/T08/T09 และ T13 (invitation.service) เรียกตัวนี้ */
export async function ensureRosterUnlocked(teamId : number): Promise<void>{
    const locked = await ApplicationRepo.findLockingTournamentOfTeam(teamId);
    if(locked){
        throw new AppError(409 , "ROSTER_LOCKED" ,
            `ทีมนี้อยู่ในทัวร์นาเมนต์ "${locked.name}" แก้ไขสมาชิกไม่ได้ — ต้องถอนตัวจากทัวร์นาเมนต์ก่อน` ,
            { tournamentId : locked.tournament_id });
    }
}

export async function updateMember(userId : number , teamId : number , position : 'starter' | 'substitute'){
    await ensureRosterUnlocked(teamId);
    const user = await TeamRepo.isMemberOf(teamId, userId);
    if(!user){
        throw new AppError(404 , "USER_NOT_FOUND" , "ผู้ใช้ไม่อยู่ในทีมนี้");
    }
    await TeamRepo.updateMember(userId , teamId , position);

    const member = await TeamRepo.isMemberOf(teamId , userId);

    return toUpdateMember(member!);   
}

export async function deleteMember(userId : number , teamId : number , sportId : number){
    await ensureRosterUnlocked(teamId);
    const user = await TeamRepo.isMemberOf(teamId, userId);
    if(!user){
        throw new AppError(404 , "USER_NOT_FOUND" , "ผู้ใช้ไม่อยู่ในทีมนี้");
    }

    await TeamRepo.deleteMember(userId , teamId);
    const memberCount = await TeamRepo.countMemberByTeamId(teamId);
    const sport_rule = await SportRepo.findSportTypeById(sportId);
    if(memberCount < sport_rule!.min_members){
        await TeamRepo.updateStatus(teamId , 'Forming');
    }
    return;
}



//Invitation
export async function createInvitation(teamId : number , invitedUserId : number , invitedByUserId : number){
    await checkUser(invitedUserId);
    await ensureRosterUnlocked(teamId);

    const member = await TeamRepo.isMemberOf(teamId , invitedUserId);
    if(member){
        throw new AppError(409 , "ALREADY_MEMBER" , " ผู้ใช้นี้อยู่ในทีมแล้ว");
    }

    // Conflict of interest (มติ 18 ก.ย. 2569, GUIDE/10 F-19): ORG/กรรมการของทัวร์ที่ทีมนี้สมัครอยู่ เข้าทีมไม่ได้ — เช็คซ้ำอีกครั้งตอนกดรับ (T13)
    const conflict = await ApplicationRepo.findTeamTournamentConflictForUser(teamId , invitedUserId);
    if(conflict){
        throw new AppError(409 , "TEAM_CONFLICT_OF_INTEREST" ,
            `ผู้ใช้นี้เป็น${conflict.role === 'organizer' ? 'ผู้จัด' : 'กรรมการ'}ของทัวร์นาเมนต์ "${conflict.name}" ที่ทีมนี้สมัครอยู่ เชิญเข้าทีมไม่ได้` ,
            { tournamentId : conflict.tournament_id , role : conflict.role });
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 
    const invitedId = await TeamRepo.createInvitation(teamId , invitedUserId , invitedByUserId , expiresAt);

    const invitation = await TeamRepo.findInvitationsById(invitedId);
    return toCreateTeamInvitation(invitation!);
}


export async function getAllInvitation(teamId : number){
    await checkTeam(teamId);

    const allInvitations = await TeamRepo.findAllInvitationOfTeam(teamId);
    return { items : allInvitations.map(toGetAllInvitation) };
}


export async function deletePendingInvite(teamId : number , invitedId : number){
    await checkTeam(teamId);
    const invited = await TeamRepo.findInvitationsByIdAndTeam(teamId,invitedId);
    if(!invited){
        throw new AppError(404 , 'INVITATION_NOT_FOUND' , 'ไม่พบคําเชิญนี้');
    }
    if(invited.team_invitation_status !== 'pending'){
        throw new AppError(409 , 'INVITATION_ALREADY_ANSWERED' , 'คําเชิญนี้ถูกตอบรับ/ปฏิเสธไปแล้ว ยกเลิกไม่ได้');
    }

    await TeamRepo.deletePendingInvite(teamId , invitedId);
    return;
}

export async function createOfficialRequest(userId : number , teamId : number , docs : string[]){
    const team = await checkTeam(teamId);
    if(docs.length === 0){
        const fields = { supportingDocs : "กรุณายื่นเอกสารประกอบ"};
        throw new AppError(400 , "OFFICIAL_DOCS_REQUIRED" , "กรุณาแนบเอกสารประกอบคําร้อง" , { fields});
    }
    const requestId = await TeamRepo.createOfficialRequest(teamId ,userId ,docs);
    const OfficialReq = await TeamRepo.findOfficialRequestById(requestId);
    return getTeamOfficialRequestDto(OfficialReq!);
}