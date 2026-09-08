import * as UserRepo from '../repositories/user.repo.js'
import * as TeamRepo from '../repositories/team.repo.js';
import { AppError } from './AppError.js';

export async function checkUser(userId : number){
    const user = await UserRepo.findById(userId);
    if(!user){
        throw new AppError(404 , "USER_NOT_FOUND" , "ไม่พบผู้ใช้นี้ในระบบ");
    }
    return user
}

export async function checkTeam(teamId : number){
    const team = await TeamRepo.findById(teamId);
    if(!team){
        throw new AppError(404 , "TEAM_NOT_FOUND" , "ไม่พบทีมนี้ในระบบ");
    }
    return team;
}