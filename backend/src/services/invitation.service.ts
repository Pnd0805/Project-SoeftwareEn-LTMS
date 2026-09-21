import * as InviteRepo from '../repositories/invitation.repo.js';
import * as TeamRepo from '../repositories/team.repo.js';
import * as SportRepo from '../repositories/sportType.repo.js';
import * as ApplicationRepo from '../repositories/application.repo.js';
import * as UserRepo from '../repositories/user.repo.js';
import * as NotificationService from './notification.service.js';

import { AppError } from '../utils/AppError.js';
import { checkTeam } from '../utils/checkExist.js';

export async function acceptInvitation(invitedId : number , userId : number){
    const invitation = await TeamRepo.findInvitationsById(invitedId);
    if(!invitation){
        throw new AppError(404 , "INVITATION_NOT_FOUND" , "ไม่พบคําเชิญนี้");
    }

    if(invitation['invited_user_id'] !== userId){
        throw new AppError(403 , "FORBIDDEN" , "คุณไม่มีสิทธิ์ทํารายการนี้");
    }

    if(invitation.expires_at.getTime() < Date.now()){
        throw new AppError(410 , "INVITATION_EXPIRED" , "คําเชิญนี้หมดอายุแล้ว");
    }

    if(invitation.team_invitation_status !== 'pending'){
        throw new AppError(409 , 'INVITATION_ALREADY_ANSWERED' , 'คําเชิญนี้ถูกตอบรับ/ปฏิเสธไปแล้ว ยกเลิกไม่ได้');
    }

    const countUnofficialTeam = await TeamRepo.countUnofficialTeamsByUser(userId); 
    if(countUnofficialTeam >= 5){
        throw new AppError(422 , "TEAM_QUOTA_EXCEEDED" , "คุณมีทีม Unofficial ครบ 5 ทีมแล้ว");
    }


    // ทีม = คลังผู้เล่น (มติ 19 ก.ย.): รับเข้าคลังได้เสมอ ไม่ล็อก ไม่มีเพดาน (Q2-ค/Q3-ก 20 ก.ย.) — ใครลงแข่งตัดสินที่ P01

    // Conflict of interest (มติ 18 ก.ย. 2569, GUIDE/10 F-19): ระหว่างเชิญ→กดรับ ทีมอาจสมัครทัวร์ที่คนนี้เป็น ORG/กรรมการไปแล้ว
    // คำเชิญคงเป็น pending ไว้ (ไม่ลบ) — รับไม่ได้จนกว่าจะพ้นบทบาทหรือทีมถอนจากทัวร์นั้น
    const conflict = await ApplicationRepo.findTeamTournamentConflictForUser(invitation['team_id'] , userId);
    if(conflict){
        throw new AppError(409 , "TEAM_CONFLICT_OF_INTEREST" ,
            `คุณเป็น${conflict.role === 'organizer' ? 'ผู้จัด' : 'กรรมการ'}ของทัวร์นาเมนต์ "${conflict.name}" ที่ทีมนี้สมัครอยู่ เข้าร่วมทีมไม่ได้` ,
            { tournamentId : conflict.tournament_id , role : conflict.role });
    }

    await InviteRepo.createAcceptInvite(invitedId, invitation['team_id'], userId)

    const team = await TeamRepo.findById(invitation['team_id']);
    if(!team){
        throw new AppError(404 , "TEAM_NOT_FOUND" , 'ไม่พบทีมนี้');
    }
    const invitee = await UserRepo.findById(userId);
    await NotificationService.notify({
        userId : team.leader_id , type : 'team_invite_answered' ,
        title : 'มีคนตอบรับคำเชิญเข้าทีม' ,
        message : `${invitee?.full_name ?? 'ผู้ใช้'} ตอบรับคำเชิญเข้าทีม "${team.name}" แล้ว` ,
        relatedEntityType : 'team' , relatedEntityId : team.team_id ,
    });
    return { teamId : team['team_id'] , teamReadinessStatus : team['readiness_status']};
}


export async function rejectInvitation(invitedId : number , userId : number){
    const invitation = await TeamRepo.findInvitationsById(invitedId);
    if(!invitation){
        throw new AppError(404 , "INVITATION_NOT_FOUND" , "ไม่พบคําเชิญนี้");
    }
    if(invitation['invited_user_id'] !== userId){
        throw new AppError(403 , "FORBIDDEN" , "คุณไม่มีสิทธิ์ทํารายการนี้");
    }
    if(invitation.team_invitation_status !== 'pending'){
        throw new AppError(409 , 'INVITATION_ALREADY_ANSWERED' , 'คําเชิญนี้ถูกตอบรับ/ปฏิเสธไปแล้ว ยกเลิกไม่ได้');
    }
    await InviteRepo.createRejectInvite(invitedId , userId);
    const team = await TeamRepo.findById(invitation['team_id']);
    if(team){
        const invitee = await UserRepo.findById(userId);
        await NotificationService.notify({
            userId : team.leader_id , type : 'team_invite_answered' ,
            title : 'คำเชิญเข้าทีมถูกปฏิเสธ' ,
            message : `${invitee?.full_name ?? 'ผู้ใช้'} ปฏิเสธคำเชิญเข้าทีม "${team.name}"` ,
            relatedEntityType : 'team' , relatedEntityId : team.team_id ,
        });
    }
    return;
}