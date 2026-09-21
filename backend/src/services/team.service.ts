import * as TeamRepo from '../repositories/team.repo.js';
import * as SportRepo from '../repositories/sportType.repo.js';
import * as UserRepo from '../repositories/user.repo.js';
import * as ApplicationRepo from '../repositories/application.repo.js';
import * as NotificationRepo from '../repositories/notification.repo.js';

import type { TeamInput, updateTeamInput } from '../schemas/team.schema.js';

import { toCreateTeam , toMyTeam, toTeamDto, toCreateTeamInvitation, toGetAllInvitation, getTeamOfficialRequestDto, toTransferRequestDto } from '../mappers/team.mapper.js';
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
        items : rows.map(r => toTeamDto(r , r.member_count , toUserRef({ user_id : r.leader_id , full_name : r.leader_full_name , profile_image_key : r.leader_profile_image_key }) , r.max_members)),
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

    const sport = await SportRepo.findSportTypeById(team.sport_type_id);
    return toTeamDto(team, memberCount , toUserRef(leaderRef) , sport?.max_members ?? null);
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

    // ★ มติ 19 ก.ย. 2569 — ลบทีมหนีกลางทัวร์ไม่ได้ ไม่งั้นสายพังเพราะแมตช์ยังชี้มาที่ทีมนี้
    //   เงื่อนไขเดียวกับลบลูกทีม (T08, Q2-ค 20 ก.ย.): ล็อกตั้งแต่ใบสมัคร approved ไม่ต้องรอสร้างสาย
    //   (แก้ 21 ก.ย. — เดิมล็อกเฉพาะ match_count > 0 ทำให้ลบทั้งทีมได้ตอนที่ลบคนเดียวไม่ได้ และทีม approved หายไปจากทัวร์ทั้งที่ ORG นับไว้แล้ว)
    //   ต้องถอนทีมออกจากทัวร์นั้นก่อน (P08) ระบบจะจัดการชนะบายให้เองถ้าสร้างสายแล้ว
    const locked = (await ApplicationRepo.findLiveSquadsOfTeam(teamId)).filter(s => s.match_count > 0 || s.status === 'approved');
    if(locked.length > 0){
        throw new AppError(409 , "TEAM_LOCKED_IN_TOURNAMENT" ,
            "ทีมนี้อยู่ในทัวร์นาเมนต์ที่ผ่านการอนุมัติแล้ว ต้องถอนทีมออกจากทัวร์นั้นก่อนถึงจะลบทีมได้" ,
            { tournaments : locked.map(s => ({ tournamentId : s.tournament_id , name : s.tournament_name })) });
    }

    // เหลือแต่ใบสมัครที่ยัง pending → ปลดล็อกผู้เล่นทุกคน ไปอยู่ทีมอื่นในทัวร์เดียวกันได้
    await ApplicationRepo.deleteAllPlayersOfTeamSquads(teamId);

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

export async function deleteMember(userId : number , teamId : number , sportId : number){
    const user = await TeamRepo.isMemberOf(teamId, userId);
    if(!user){
        throw new AppError(404 , "USER_NOT_FOUND" , "ผู้ใช้ไม่อยู่ในทีมนี้");
    }

    // ★ มติ 19 ก.ย. 2569 + Q2-ค (20 ก.ย.) — คนที่ถูกส่งลงแข่งในทัวร์ที่ ORG อนุมัติแล้ว (หรือสร้างสายแล้ว) เอาออกจากทีมไม่ได้
    //   รายชื่อที่ผ่าน hard filter ต้องไม่เปลี่ยน · ต้องถอนทีมออกจากทัวร์นั้นก่อน (P08) ระบบจัดการชนะบายให้
    //   ใบสมัครยัง pending → เอาออกได้ (ตัดชื่อจากรายชื่อ แจ้งหัวหน้าถ้าเหลือไม่ถึง min) · คนในคลังที่ไม่ได้ลงแข่ง → อิสระ
    const squads = await ApplicationRepo.findLiveSquadsOfTeam(teamId , userId);
    const locked = squads.filter(s => s.match_count > 0 || s.status === 'approved');
    if(locked.length > 0){
        throw new AppError(409 , "MEMBER_LOCKED_IN_TOURNAMENT" ,
            "ผู้เล่นคนนี้ถูกส่งลงแข่งในทัวร์นาเมนต์ที่สร้างสายแล้ว ต้องถอนทีมออกจากทัวร์นั้นก่อน" ,
            { tournaments : locked.map(s => ({ tournamentId : s.tournament_id , name : s.tournament_name })) });
    }

    await TeamRepo.deleteMember(userId , teamId);
    // ยังไม่สร้างสาย → ตัดชื่อออกจากรายชื่อที่ส่งลงแข่งด้วย ผู้เล่นจะไปอยู่ทีมอื่นในทัวร์เดียวกันได้
    await ApplicationRepo.deletePlayerFromLiveSquads(teamId , userId);

    const sport_rule = await SportRepo.findSportTypeById(sportId);

    // ทัวร์ไหนที่รายชื่อเหลือไม่ถึงขั้นต่ำ ต้องแจ้งหัวหน้าทีม ไม่งั้นจะไปรู้ตัวเอาวันแข่ง
    const team = await TeamRepo.findById(teamId);
    for(const squad of squads){
        if(squad.squad_size - 1 >= sport_rule!.min_members) continue;
        await NotificationRepo.insertNotification({
            userId : team!.leader_id,
            type : 'squad_below_minimum',
            title : 'รายชื่อผู้เล่นไม่ครบขั้นต่ำ',
            message : `ทัวร์นาเมนต์ "${squad.tournament_name}" เหลือผู้เล่นที่ส่งลงแข่ง ${squad.squad_size - 1} คน ` +
                      `ต่ำกว่าขั้นต่ำ ${sport_rule!.min_members} คน — ถ้ายังอยู่ในช่วงรับสมัคร ให้ยกเลิกใบสมัครแล้วสมัครใหม่`,
            relatedEntityType : 'tournament',
            relatedEntityId : squad.tournament_id,
        });
    }

    const memberCount = await TeamRepo.countMemberByTeamId(teamId);
    if(memberCount < sport_rule!.min_members){
        await TeamRepo.updateStatus(teamId , 'Forming');
    }
    return;
}



//Invitation
export async function createInvitation(teamId : number , invitedUserId : number , invitedByUserId : number){
    await checkUser(invitedUserId);
    // ทีม = คลังผู้เล่น (มติ 19 ก.ย.) — เพิ่มคนเข้าคลังได้เสมอ ไม่มีเพดาน (Q3-ก) · เพดานจริงอยู่ที่ตอนส่งรายชื่อลงแข่ง P01

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

// C3 — โอนหัวหน้าทีม (T19)
export async function transferLeader(requesterId : number , teamId : number , newLeaderId : number){
    const team = await checkTeam(teamId);

    if(team.official_status !== 'Official'){
        throw new AppError(403 , "NOT_OFFICIAL_TEAM" , "การโอนย้ายสิทธิ์หัวหน้าทีมใช้ได้เฉพาะทีม Official");
    }

    const member = await TeamRepo.isMemberOf(teamId , newLeaderId);
    if(!member){
        throw new AppError(422 , "NOT_A_TEAM_MEMBER" , "ผู้ใช้ที่เลือกต้องเป็นสมาชิกของทีมนี้อยู่แล้ว");
    }

    const requestId = await TeamRepo.createTransferRequest(teamId , requesterId , newLeaderId);
    const transferReq = await TeamRepo.findTransferRequestById(requestId);
    return toTransferRequestDto(transferReq! , team.leader_id);
}