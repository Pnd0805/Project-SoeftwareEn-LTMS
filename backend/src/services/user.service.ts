import * as UserRepo from '../repositories/user.repo.js';
import * as TeamRepo from '../repositories/team.repo.js';
import * as StatRepo from '../repositories/playerStat.repo.js';
import * as FollowRepo from '../repositories/follow.repo.js';
import * as CareerRepo from '../repositories/career.repo.js';
import * as UserReportRepo from '../repositories/userReport.repo.js';
import * as AdminRepo from '../repositories/adminScope.repo.js';
import * as UploadService from './upload.service.js';

import { AppError } from '../utils/AppError.js';
import { checkUser } from '../utils/checkExist.js';

import { toPublicUserDto , toUserRef , toMeDto, toGetMyInvitation} from '../mappers/user.mapper.js';
import { toTeamRef } from '../mappers/team.mapper.js';
import { toUserStatsDto } from '../mappers/stat.mapper.js';
import { toCareerTournamentDto } from '../mappers/career.mapper.js';
import { toUserReportDto } from '../mappers/userReport.mapper.js';

import type { UpdateMeInput } from '../schemas/user.schema.js';
import type { UserRow } from '../types/db.js';

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

/**
 * FE-viewer-admin-scope-unknown — `GET /me` ต้องบอกสิทธิ์แอดมินของตัวผู้เรียกเอง
 * เป็นการอ่านเพิ่มหนึ่งแถวจากคีย์ที่มีอยู่แล้ว · คนทั่วไปได้ `adminScope: null`
 */
export async function getMe(user : UserRow){
    return toMeDto(user , await AdminRepo.findAdminByUserId(user.user_id));
}

export async function updateMe(userId : number , input : UpdateMeInput){
    // null = ล้างรูป ไม่ต้องตรวจ · string = ต้องเป็น key ที่ user นี้อัปโหลดเองจริง ไม่งั้นใครก็ใส่ key ของคนอื่นมาได้ (FE-avatar-and-team-logo-uploads)
    const previous = input.avatarUrl !== undefined ? await checkUser(userId) : null;
    if(input.avatarUrl !== undefined && input.avatarUrl !== null){
        await UploadService.validateAvatarKey(input.avatarUrl , userId);
    }

    await UserRepo.update(userId , input); //update users

    // ลบรูปเก่าแบบ best-effort หลัง save สำเร็จเท่านั้น (มติข้อ 6) — ไม่ลบถ้าไม่ได้เปลี่ยนรูป หรือรูปเดิม/ใหม่เป็น key เดียวกัน
    if(previous?.profile_image_key && previous.profile_image_key !== input.avatarUrl){
        await UploadService.deleteObjectBestEffort(previous.profile_image_key);
    }

    const user = await checkUser(userId);
    return toMeDto(user , await AdminRepo.findAdminByUserId(userId));
}

export async function getMyInvitation(userId : number){
    const userInvitation = await UserRepo.getMyInvitation(userId);
    return { items : userInvitation.map(toGetMyInvitation)};
}

// C2 — POST /users/:id/report — user ธรรมดายื่นคำร้องขอระงับ user/แอดมินคนอื่นได้ (ไม่ใช่แค่แอดมินสั่งระงับตรงๆ)
export async function fileUserReport(reporterId : number , targetUserId : number , reason : string , evidence : string[]){
    await checkUser(targetUserId);

    if(targetUserId === reporterId){
        throw new AppError(400 , "CANNOT_REPORT_SELF" , "ไม่สามารถแจ้งเรื่องเกี่ยวกับตัวเองได้");
    }

    // key ต้องเป็นของผู้แจ้งคนนี้เท่านั้น (กฎเดียวกับ dispute_evidence ใน matchResult/matchResultComplaint.service)
    // ถ้าไม่ตรวจ ใครก็ยื่นคำร้องแนบ key ของคนอื่นได้ แล้วคิวแอดมินจะเซ็น presigned URL ให้ไฟล์นั้นออกมา
    // ⇒ กลายเป็นช่องอ่านไฟล์ในถังผ่านคำร้องปลอม จึงต้องตรวจที่ขาเข้าคู่กับการเซ็นที่ขาออก
    if(evidence.some(key => !key.startsWith(`report_evidence/${reporterId}/`))){
        throw new AppError(400 , "VALIDATION_FAILED" , "ไฟล์หลักฐานไม่ใช่ไฟล์ที่คุณอัปโหลดไว้" ,
            { fields : { evidence : 'ต้องเป็นไฟล์ที่อัปโหลดด้วย purpose report_evidence ของบัญชีคุณเอง' } });
    }

    const reportId = await UserReportRepo.create(reporterId , targetUserId , reason , evidence);
    const report = await UserReportRepo.findByIdJoined(reportId);
    return toUserReportDto(report! , await UploadService.presignAll(report!.evidence));
}

