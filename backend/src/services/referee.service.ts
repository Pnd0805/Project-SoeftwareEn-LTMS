import * as RefRepo from '../repositories/tournamentReferee.repo.js';
import * as UserRepo from '../repositories/user.repo.js';
import { AppError } from '../utils/AppError.js';
import type { InviteRefereeInput, AssignRefereeInput } from '../schemas/referee.schema.js';
import { toTournamentRefereeDto, toMyRefereeInvitationDto, toMatchRefereeDto } from '../mappers/referee.mapper.js';
import type { TournamentRefereeRow, TournamentRow } from '../types/db.js';
import * as MatchRefRepo from '../repositories/matchReferee.repo.js';
import { toUserRef } from '../mappers/user.mapper.js';
import { toRefereeStatus } from '../mappers/referee.mapper.js';
import type { RefereeStatusFields } from '../mappers/referee.mapper.js';

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

    // ตอบรับแล้วกี่คน — ตัวเลขที่แสดงบนหน้าจอ
    const acceptedCount = items.filter(i => i.invitationStatus === 'accepted').length;

    // ★ พร้อมปฏิบัติงานจริงกี่คน — กรรมการภายนอกที่ admin ยังไม่อนุมัติ ยังคุมแมตช์ไม่ได้
    //   BR-10 (C13 publish) ต้องเช็คตัวนี้ ไม่ใช่ acceptedCount — ดู GUIDE/07 ข้อ F-8
    const effectiveCount = items.filter(i =>
        i.invitationStatus === 'accepted'
        && (!i.isExternal || i.externalApprovalStatus === 'approved')).length;

    return { items, acceptedCount, effectiveCount };
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



export async function assignRefereeToMatch(matchId : number, tournamentId : number, input : AssignRefereeInput){
    const tr = await RefRepo.findById(input.tournamentRefereeId);

    // ★ ต้องเป็นกรรมการของ "ทัวร์เดียวกับแมตช์นี้" เท่านั้น
    if(!tr || tr.tournament_id !== tournamentId){
        throw new AppError(404, 'REFEREE_NOT_FOUND', 'ไม่พบกรรมการคนนี้ในทัวร์นาเมนต์นี้');
    }

    if(tr.invitation_status !== 'accepted' || tr.removed_at !== null){
        throw new AppError(409, 'REFEREE_NOT_ACCEPTED', 'กรรมการยังไม่ได้ตอบรับคำเชิญ');
    }

    if(!isActiveReferee(tr)){
        throw new AppError(409, 'REFEREE_EXTERNAL_APPROVAL_PENDING',
            'กรรมการภายนอกคนนี้รอผู้ดูแลระบบอนุมัติอยู่ ยังมอบหมายเข้าแมตช์ไม่ได้');
    }

    try {
        await MatchRefRepo.assign(matchId, input.tournamentRefereeId);
    } catch (err : unknown) {
        if(typeof err === 'object' && err !== null && (err as { code? : string }).code === 'ER_DUP_ENTRY'){
            throw new AppError(409, 'REFEREE_ALREADY_ASSIGNED', 'กรรมการคนนี้ถูกมอบหมายให้แมตช์นี้อยู่แล้ว');
        }
        throw err;
    }

    const user = await UserRepo.findById(tr.user_id);
    return {
        matchId,
        tournamentRefereeId : input.tournamentRefereeId,
        referee : user ? toUserRef(user) : null
    };
}

export async function listMatchReferees(matchId : number){
    const rows = await MatchRefRepo.findByMatch(matchId);
    return { items : rows.map(toMatchRefereeDto) };
}

export async function unassignRefereeFromMatch(matchId : number, tournamentRefereeId : number){
    const removed = await MatchRefRepo.unassign(matchId, tournamentRefereeId);
    if(!removed){
        throw new AppError(404, 'REFEREE_NOT_ASSIGNED', 'กรรมการคนนี้ไม่ได้ถูกมอบหมายให้แมตช์นี้');
    }
}

/** กรรมการขั้นต่ำที่ทัวร์นี้ต้องมี */
async function requiredRefereeCount(tournamentId : number): Promise<number> {
    // TODO(F-4a): เมื่อ sport_types มี match_duration_minutes แล้ว เปลี่ยนเป็น
    //   max(จำนวนแมตช์ที่เวลาทับกัน) × กรรมการต่อแมตช์ (BR-11 = 2 ถ้า on-site + บันทึกสถิติ)
    return 1;
}

export async function removeTournamentReferee(
        tournamentId : number, tournamentRefereeId : number,
        removedBy : number, tournamentStatus : TournamentRow['tournament_status']){

    const target = await RefRepo.findById(tournamentRefereeId);
    if(!target || target.tournament_id !== tournamentId || target.removed_at !== null){
        throw new AppError(404, 'REFEREE_NOT_FOUND', 'ไม่พบกรรมการคนนี้ในทัวร์นาเมนต์นี้');
    }

    // ★ เช็ค BR-10 เฉพาะทัวร์ที่เปิดสาธารณะแล้ว
    if(tournamentStatus === 'public'){
        const rows = await RefRepo.findLatestPerUserByTournament(tournamentId);
        const remaining = rows
            .filter(r => r.user_id !== target.user_id)
            .filter(isActiveReferee)
            .length;

        const required = await requiredRefereeCount(tournamentId);
        if(remaining < required){
            throw new AppError(409, 'WOULD_BREAK_REFEREE_MINIMUM',
                `ถอดไม่ได้ ทัวร์นาเมนต์ต้องมีกรรมการอย่างน้อย ${required} คนขณะเปิดสาธารณะ กรุณาปิดการเผยแพร่ก่อน`);
        }
    }

    await RefRepo.removeAllByUser(tournamentId, target.user_id, removedBy);
}

/** กรรมการคนนี้ใช้งานได้จริงหรือยัง — นิยามอยู่ที่ toRefereeStatus() ที่เดียว */
export function isActiveReferee(tr : RefereeStatusFields | null): boolean {
    if(!tr) return false;
    return toRefereeStatus(tr) === 'active';
}