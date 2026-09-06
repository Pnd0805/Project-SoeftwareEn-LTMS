import type { Request , Response , NextFunction } from 'express';
import * as TeamRepo from '../repositories/team.repo.js';
import { AppError } from '../utils/AppError.js';

export async function requireTeamLeader(req : Request , res : Response , next : NextFunction){
    const teamId = req.params['id'];
    const team = await TeamRepo.findById(Number(teamId));
    if(!team){
        return next(new AppError(404 , "TEAM_NOT_FOUND" , "ไม่พบทีมนี้" ));
    }

    if(team.leader_id !== req.user!.user_id){
        return next(new AppError(403 , "NOT_TEAM_LEADER" , "คุณไม่ใช่หัวหน้าทีมนี้"));
    }

    req.team = team;
    next();
}