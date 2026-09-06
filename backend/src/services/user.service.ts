import * as UserRepo from '../repositories/user.repo.js';
import * as TeamRepo from '../repositories/team.repo.js';
import * as StatRepo from '../repositories/playerStat.repo.js';

import { AppError } from '../utils/AppError.js';
import { checkUser } from '../utils/checkExist.js';

import { toPublicUserDto , toUserRef , toMeDto} from '../mappers/user.mapper.js';
import { toTeamRef } from '../mappers/team.mapper.js';
import { toUserStatsDto } from '../mappers/stat.mapper.js';

import type { UpdateMeInput } from '../schemas/user.schema.js';

export async function getUserById(userId : number){
    const user = await checkUser(userId);
    const TeamRows = await TeamRepo.findTeamsByUser(userId);  
    const TeamRefs = TeamRows.map(toTeamRef);
    return toPublicUserDto(user , TeamRefs);
};


export async function getUserStats(userId : number){
    const user = await checkUser(userId)
    const userStat = await StatRepo.findStatsByUser(userId);
    return toUserStatsDto(userId , userStat);
}

export async function searchUsers(userName : string){
    if(userName.length < 3){
        throw new AppError(400 , "QUERY_TOO_SHORT" , "กรุณาพิมพ์อย่างน้อย 3 ตัวอักษร");
    }
    const matchName = await UserRepo.searchByName(userName);
    const data = matchName.map(toUserRef);
    return { items : data};
}

export async function updateMe(userId : number , input : UpdateMeInput){
    await UserRepo.update(userId , input); //update users
    const user = await checkUser(userId);
    return toMeDto(user);
}