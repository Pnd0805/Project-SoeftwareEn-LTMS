import * as UserRepo from '../repositories/user.repo.js';
import * as TeamRepo from '../repositories/team.repo.js';
import * as StatRepo from '../repositories/playerStat.repo.js';
import * as FollowRepo from '../repositories/follow.repo.js';
import * as CareerRepo from '../repositories/career.repo.js';

import { AppError } from '../utils/AppError.js';
import { checkUser } from '../utils/checkExist.js';

import { toPublicUserDto , toUserRef , toMeDto, toGetMyInvitation} from '../mappers/user.mapper.js';
import { toTeamRef } from '../mappers/team.mapper.js';
import { toUserStatsDto } from '../mappers/stat.mapper.js';
import { toCareerTournamentDto } from '../mappers/career.mapper.js';

import type { UpdateMeInput } from '../schemas/user.schema.js';

export async function getUserById(userId: number, viewerUserId?: number) {
    const user = await checkUser(userId);
    const [teamRows, followerCount, isFollowing] = await Promise.all([
        TeamRepo.findTeamsByUser(userId),
        FollowRepo.countFollowers(userId),
        viewerUserId !== undefined && viewerUserId !== userId
            ? FollowRepo.isFollowing(viewerUserId, userId)
            : Promise.resolve(false),
    ]);
    return toPublicUserDto(user, teamRows.map(toTeamRef), followerCount, isFollowing);
};


export async function getUserStats(userId: number) {
    await checkUser(userId);
    const [userStat, totals] = await Promise.all([
        StatRepo.findStatsByUser(userId),
        StatRepo.findProfileTotals(userId),
    ]);
    return toUserStatsDto(userId, userStat, totals);
}


export async function followUser(followerUserId: number, followedUserId: number) {
    if (followerUserId === followedUserId) {
        throw new AppError(409, 'CANNOT_FOLLOW_SELF', 'ไม่สามารถติดตามตัวเองได้');
    }
    await checkUser(followedUserId);
    await FollowRepo.followUser(followerUserId, followedUserId);
    return {
        userId: followedUserId,
        isFollowing: true as const,
        followerCount: await FollowRepo.countFollowers(followedUserId),
    };
}

export async function unfollowUser(followerUserId: number, followedUserId: number) {
    if (followerUserId === followedUserId) {
        throw new AppError(409, 'CANNOT_FOLLOW_SELF', 'ไม่สามารถเลิกติดตามตัวเองได้');
    }
    await checkUser(followedUserId);
    await FollowRepo.unfollowUser(followerUserId, followedUserId);
    return {
        userId: followedUserId,
        isFollowing: false as const,
        followerCount: await FollowRepo.countFollowers(followedUserId),
    };
}

export async function getFollowers(userId: number) {
    await checkUser(userId);
    const rows = await FollowRepo.findFollowers(userId);
    return { items: rows.map(toUserRef), count: rows.length };
}

export async function getFollowing(userId: number) {
    await checkUser(userId);
    const rows = await FollowRepo.findFollowing(userId);
    return { items: rows.map(toUserRef), count: rows.length };
}

export async function getCareer(userId: number) {
    await checkUser(userId);
    const rows = await CareerRepo.findCareerByUser(userId);
    return { items: rows.map(toCareerTournamentDto) };
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

export async function getMyInvitation(userId : number){
    const userInvitation = await UserRepo.getMyInvitation(userId);
    return { items : userInvitation.map(toGetMyInvitation)};
} 

