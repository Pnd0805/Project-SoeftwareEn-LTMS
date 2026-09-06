import * as TeamRepo from '../repositories/team.repo.js';
import * as SportRepo from '../repositories/sportType.repo.js';
import * as UserRepo from '../repositories/user.repo.js';

import type { TeamInput, updateTeamInput } from '../schemas/team.schema.js';

import { toCreateTeam , toMyTeam, toTeamDto} from '../mappers/team.mapper.js';
import type { MyTeam } from '../mappers/team.mapper.js';
import { toUserRef } from '../mappers/user.mapper.js';

import { AppError } from '../utils/AppError.js';
import { checkTeam } from '../utils/checkExist.js';
import type { ResultSetHeader } from 'mysql2';

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