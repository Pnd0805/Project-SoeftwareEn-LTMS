import type { Request , Response } from 'express';
import * as TeamService from '../services/team.service.js';
import * as JoinRequestService from '../services/joinRequest.service.js';
import { searchTeamsQuerySchema } from '../schemas/team.schema.js';
import { parsePagination } from '../utils/pagination.js';
import { AppError } from '../utils/AppError.js';
import { parseId } from '../utils/parseId.js';

export async function createTeam(req : Request , res : Response){
    res.status(201).json(await TeamService.createTeam(req.body , req.user!.user_id));
}

export async function getMyTeam(req : Request , res : Response){
    res.status(200).json(await TeamService.getMyTeam(req.user!.user_id));
}

export async function searchTeams(req : Request , res : Response){
    const { newpage, newpageSize, offset } = parsePagination(req.query['page'], req.query['pageSize']);
    const parsed = searchTeamsQuerySchema.safeParse(req.query);
    if(!parsed.success){
        throw new AppError(400 , 'VALIDATION_FAILED' , 'พารามิเตอร์ค้นหาไม่ถูกต้อง');
    }
    res.status(200).json(await TeamService.searchTeams(parsed.data , offset , newpage , newpageSize));
}

// ---- Join requests (T20–T25)
export async function createJoinRequest(req : Request , res : Response){
    res.status(201).json(await JoinRequestService.createJoinRequest(parseId(req.params['id'], 'รหัสทีม') , req.user!.user_id , req.body.message));
}
export async function listJoinRequests(req : Request , res : Response){
    res.status(200).json(await JoinRequestService.listJoinRequests(parseId(req.params['id'], 'รหัสทีม')));
}
export async function approveJoinRequest(req : Request , res : Response){
    res.status(200).json(await JoinRequestService.approveJoinRequest(parseId(req.params['id'], 'รหัสทีม') , parseId(req.params['rid'], 'รหัสคำขอ') , req.user!.user_id));
}
export async function rejectJoinRequest(req : Request , res : Response){
    res.status(200).json(await JoinRequestService.rejectJoinRequest(parseId(req.params['id'], 'รหัสทีม') , parseId(req.params['rid'], 'รหัสคำขอ') , req.user!.user_id , req.body.reason));
}
export async function listMyJoinRequests(req : Request , res : Response){
    res.status(200).json(await JoinRequestService.listMyJoinRequests(req.user!.user_id));
}
export async function cancelJoinRequest(req : Request , res : Response){
    await JoinRequestService.cancelJoinRequest(parseId(req.params['rid'], 'รหัสคำขอ') , req.user!.user_id);
    res.status(204).send();
}

export async function getTeamById(req : Request , res : Response){
    res.status(200).json(await TeamService.getTeamById(parseId(req.params['id'], 'รหัสทีม')));
}

export async function updateTeamById(req : Request , res : Response){
    if(!req.team){ 
        throw new AppError(404 , "TEAM_NOT_FOUND" , "ไม่พบทีมนี้ในระบบ");
    }
    return res.status(200).json(await TeamService.updateTeam(req.team['team_id'] ,req.team.sport_type_id ,req.body));
}

export async function deleteTeamById(req : Request , res : Response){
    if(!req.team){ 
        throw new AppError(404 , "TEAM_NOT_FOUND" , "ไม่พบทีมนี้ในระบบ");
    }
    await TeamService.deleteTeam(req.team.team_id);
    return res.status(204).send();
}

//-- Member
export  async function getTeamMember(req : Request , res : Response){
    return res.status(200).json(await TeamService.getTeamMemberById(parseId(req.params['id'], 'รหัสทีม') , req.user!.user_id));
}


export async function deleteMember(req : Request , res : Response){
    const teamId = parseId(req.params['id'] , 'รหัสทีม' , 'id');
    const userId = parseId(req.params['uid'] , 'รหัสผู้ใช้' , 'uid');
    

    const leader = req.team!.leader_id;
    if(leader === userId ){
        throw new AppError(403 , "FORBIDDEN" , "คุณไม่มีสิทธิ์ทํารายการนี้")
    }


    await TeamService.deleteMember( userId , teamId , req.team!.sport_type_id);
    return res.status(204).send();
}



// Invitations
export async function createTeamInvitation(req : Request , res : Response){
    const teamId = parseId(req.params['id'] , 'รหัสทีม' , 'id');
    return res.status(201).json(await TeamService.createInvitation(teamId , req.body.invitedUserId , req.user!.user_id));
}

export async function getAllInvitation(req : Request , res : Response){
    const teamId = parseId(req.params['id'] , 'รหัสทีม' , 'id');
    return res.status(200).json(await TeamService.getAllInvitation(teamId));
};

export async function deletePendingInvite(req : Request , res : Response){
    const teamId = parseId(req.params['id'] , 'รหัสทีม' , 'id');
    const inviteId = parseId(req.params['iid'] , 'รหัสคำเชิญ' , 'iid');
    await TeamService.deletePendingInvite(teamId , inviteId);
    return res.status(204).send();
}


//TeamRequest
export async function createTeamOfficialRequest(req : Request , res: Response){
    const teamId = parseId(req.params['id'] , 'รหัสทีม' , 'id');
    return res.status(201).json(await TeamService.createOfficialRequest(req.user!.user_id , teamId , req.body.supportingDocs));
}