import type { Request , Response } from 'express';
import * as TeamService from '../services/team.service.js';
import { AppError } from '../utils/AppError.js';

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