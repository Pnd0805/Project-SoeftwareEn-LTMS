import type { UserRefDto } from './user.mapper.js';
import { toUserRef } from './user.mapper.js';
import type { TournamentRefereeListRow , MyRefereeInvitationRow } from '../repositories/tournamentReferee.repo.js';
import type { MatchRefereeListRow } from '../repositories/matchReferee.repo.js';
import type { TournamentRefereeRow } from '../types/db.js';


export type RefereeStatus =
    'pending'            // รอ ref ตอบคำเชิญ
  | 'pending_admin'      // ★ ตอบรับแล้ว รอ admin ตรวจเอกสาร (คนนอกเท่านั้น)
  | 'active'             // ใช้งานได้จริง คุมแมตช์ได้
  | 'declined'           // ref ปฏิเสธเอง
  | 'rejected_by_admin'  // admin ไม่อนุมัติ
  | 'removed';           // ORG ถอด

export type RefereeStatusFields =
    Pick<TournamentRefereeRow, 'invitation_status' | 'is_external' | 'external_approval_status'>
    & { removed_at? : Date | null };

/**
 * นิยามเดียวของ "กรรมการอยู่สถานะไหน" ทั้งระบบ
 * services/referee.service.ts → isActiveReferee() เรียกฟังก์ชันนี้ ห้ามเขียนเงื่อนไขซ้ำที่อื่น
 * (กฎอยู่ฝั่ง mapper เพราะ service เรียก mapper ได้ แต่ mapper เรียก service ไม่ได้)
 */
export function toRefereeStatus(row : RefereeStatusFields): RefereeStatus {
    if(row.removed_at) return 'removed';
    if(row.invitation_status === 'rejected') return 'declined';
    if(row.invitation_status === 'pending')  return 'pending';

    if(row.is_external === 1){
        if(row.external_approval_status === 'pending')  return 'pending_admin';
        if(row.external_approval_status === 'rejected') return 'rejected_by_admin';
    }
    return 'active';
}

export type TournamentRefereeDto = {
    id : number,
    user : UserRefDto,
    invitationStatus : 'pending' | 'accepted' | 'rejected',
    isExternal : boolean,
    externalApprovalStatus : 'not_required' | 'pending' | 'approved' | 'rejected',
    status : RefereeStatus
};

export function toTournamentRefereeDto(row : TournamentRefereeListRow): TournamentRefereeDto {
    return {
        id : row.tournament_referee_id,
        user : toUserRef(row),
        invitationStatus : row.invitation_status,
        isExternal : row.is_external === 1,
        externalApprovalStatus : row.external_approval_status,
        status : toRefereeStatus(row)
    };
}

export type TournamentRefDto = {
    id : number,
    name : string,
    sportTypeId : number,
    eventStartDate : string
};

export type MyRefereeInvitationDto = {
    id : number,
    tournament : TournamentRefDto,
    isExternal : boolean,
    createdAt : string
};

export function toMyRefereeInvitationDto(row : MyRefereeInvitationRow): MyRefereeInvitationDto {
    return {
        id : row.tournament_referee_id,
        tournament : {
            id : row.tournament_id,
            name : row.name,
            sportTypeId : row.sport_type_id,
            eventStartDate : row.event_start_date
        },
        isExternal : row.is_external === 1,
        createdAt : row.created_at.toISOString()
    };
}

export type MatchRefereeDto = {
    tournamentRefereeId : number,
    referee : UserRefDto
};

export function toMatchRefereeDto(row : MatchRefereeListRow): MatchRefereeDto {
    return { tournamentRefereeId : row.tournament_referee_id, referee : toUserRef(row) };
}