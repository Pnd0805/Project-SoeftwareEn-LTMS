import type { Request , Response } from 'express';
import * as TeamService from '../services/team.service.js';
import { AppError } from '../utils/AppError.js';
import { parseId } from '../utils/parseId.js';

export async function createTeam(req : Request , res : Response){
    res.status(201).json(await TeamService.createTeam(req.body , req.user!.user_id));
}

export async function getMyTeam(req : Request , res : Response){
    res.status(200).json(await TeamService.getMyTeam(req.user!.user_id));
}

export async function getTeamById(req : Request , res : Response){
    res.status(200).json(await TeamService.getTeamById(Number(req.params['id'])));
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
    return res.status(200).json(await TeamService.getTeamMemberById(Number(req.params['id']) , req.user!.user_id));
}

export async function updateTeamMember(req : Request , res : Response){
    const teamId = parseId(req.params['id'] , 'รหัสทีม' , 'id');
    const userId = parseId(req.params['uid'], 'รหัสผู้ใช้' , 'uid');
    return res.status(200).json(await TeamService.updateMember(userId , teamId , req.body['position']));
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