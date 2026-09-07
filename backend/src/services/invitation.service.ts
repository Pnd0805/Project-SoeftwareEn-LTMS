import * as InviteRepo from '../repositories/invitation.repo.js';
import * as TeamRepo from '../repositories/team.repo.js';
import * as SportRepo from '../repositories/sportType.repo.js';

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


    await InviteRepo.createAcceptInvite(invitedId, invitation['team_id'], userId)

    const team = await TeamRepo.findById(invitation['team_id']);
    if(!team){
        throw new AppError(404 , "TEAM_NOT_FOUND" , 'ไม่พบทีมนี้');
    }
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
    return;
}