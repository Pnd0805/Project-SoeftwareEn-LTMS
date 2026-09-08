import * as RefRepo from '../repositories/tournamentReferee.repo.js';
import * as UserRepo from '../repositories/user.repo.js';
import { AppError } from '../utils/AppError.js';
import type { InviteRefereeInput } from '../schemas/referee.schema.js';
import { toTournamentRefereeDto } from '../mappers/referee.mapper.js';
import { toMyRefereeInvitationDto } from '../mappers/referee.mapper.js';

export async function inviteReferee(tournamentId : number, invitedBy : number, input : InviteRefereeInput){
    // 1. คนที่ถูกเชิญมีตัวตนจริงไหม
    const user = await UserRepo.findById(input.userId);
    if(!user){
        throw new AppError(404, 'USER_NOT_FOUND', 'ไม่พบผู้ใช้นี้ในระบบ');
    }

    // 2. กันเชิญทับสถานะเดิม 
    const latest = await RefRepo.findLatestByTournamentAndUser(tournamentId, input.userId);
    if(latest && latest.removed_at === null){
        if(latest.invitation_status === 'pending'){
            throw new AppError(409, 'REFEREE_INVITATION_PENDING', 'ผู้ใช้นี้มีคำเชิญที่ยังไม่ได้ตอบอยู่แล้ว');
        }
        if(latest.invitation_status === 'accepted'){
            throw new AppError(409, 'REFEREE_ALREADY_ACCEPTED', 'ผู้ใช้นี้เป็นกรรมการของทัวร์นาเมนต์นี้อยู่แล้ว');
        }
    }

    // 3. เขียน
    const newId = await RefRepo.create({
        tournamentId, userId : input.userId, invitedBy, isExternal : input.isExternal
    });

    return { id : newId, userId : input.userId, invitationStatus : 'pending', isExternal : input.isExternal };
}

export async function listTournamentReferees(tournamentId : number){
    const rows = await RefRepo.findLatestPerUserByTournament(tournamentId);
    const items = rows.map(toTournamentRefereeDto);
    const acceptedCount = items.filter(i => i.invitationStatus === 'accepted').length;
    return { items, acceptedCount };
}

export async function listMyRefereeInvitations(userId : number){
    const rows = await RefRepo.findPendingInvitationsByUser(userId);
    return { items : rows.map(toMyRefereeInvitationDto) };
}

export async function acceptRefereeInvitation(invitationId : number, userId : number){
    const invitation = await RefRepo.findById(invitationId);

    // ★ ไม่มีจริง / ถูกถอดแล้ว / ไม่ใช่ของเรา → 404 เหมือนกันหมด
    if(!invitation || invitation.removed_at !== null || invitation.user_id !== userId){
        throw new AppError(404, 'INVITATION_NOT_FOUND', 'ไม่พบคำเชิญนี้');
    }

    if(invitation.invitation_status !== 'pending'){
        throw new AppError(409, 'INVITATION_ALREADY_ANSWERED', 'คำเชิญนี้ถูกตอบไปแล้ว');
    }

    const updated = await RefRepo.accept(invitationId);
    if(!updated){
        throw new AppError(409, 'INVITATION_ALREADY_ANSWERED', 'คำเชิญนี้ถูกตอบไปแล้ว');
    }

    return {
        id : invitationId,
        invitationStatus : 'accepted',
        requiresAdminApproval : invitation.is_external === 1
    };
}

export async function declineRefereeInvitation(invitationId : number, userId : number){
    const invitation = await RefRepo.findById(invitationId);

    if(!invitation || invitation.removed_at !== null || invitation.user_id !== userId){
        throw new AppError(404, 'INVITATION_NOT_FOUND', 'ไม่พบคำเชิญนี้');
    }

    if(invitation.invitation_status !== 'pending'){
        throw new AppError(409, 'INVITATION_ALREADY_ANSWERED', 'คำเชิญนี้ถูกตอบไปแล้ว');
    }

    const updated = await RefRepo.decline(invitationId);
    if(!updated){
        throw new AppError(409, 'INVITATION_ALREADY_ANSWERED', 'คำเชิญนี้ถูกตอบไปแล้ว');
    }
}