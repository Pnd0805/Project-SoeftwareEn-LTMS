import * as UserRepo from '../repositories/user.repo.js';
import * as TeamRepo from '../repositories/team.repo.js';
import * as StatRepo from '../repositories/playerStat.repo.js';
import { AppError } from '../utils/AppError.js';

import { toPublicUserDto } from '../mappers/user.mapper.js';
import { toTeamRef } from '../mappers/team.mapper.js';
import { toUserStatsDto } from '../mappers/stat.mapper.js';

export async function getUserById(userId : number){
    const user = await UserRepo.findById(userId);
    if(!user){
        throw new AppError(404 , "USER_NOT_FOUND" , "ไม่พบผู้ใช้นี้ในระบบ");
    }

    const TeamRows = await TeamRepo.findTeamsByUser(userId);  
    const TeamRefs = TeamRows.map(toTeamRef);
    return toPublicUserDto(user , TeamRefs);
};


export async function getUserStats(userId : number){
    const user = await UserRepo.findById(userId);
    if(!user){
        throw new AppError(404 , "USER_NOT_FOUND" , "ไม่พบผู้ใช้นี้ในระบบ");
    }

    const userStat = await StatRepo.findStatsByUser(userId);
    return toUserStatsDto(userId , userStat);
}