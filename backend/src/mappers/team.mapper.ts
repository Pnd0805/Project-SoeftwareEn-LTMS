import { toUserRef } from './user.mapper.js';
import { toPublicImageUrl } from '../utils/imageUrl.js';
import type { TeamJoinRequestRow } from '../types/db.js';
import type { JoinRequestWithUser, JoinRequestWithTeam } from '../repositories/joinRequest.repo.js';
import type { TeamRow , TeamMemberRow, TeamInvitationRow, TeamAdminRequestRow } from "../types/db.js";
import type { UserRefDto } from "./user.mapper.js";
import type { UserRow } from "../types/db.js";
import type { getInvitation } from "../repositories/team.repo.js";
export type TeamRef = {
    id : number,
    name : string,
    sportTypeId : number,
    /**
     * OD-61 (4 ต.ค. 2569) — โลโก้ทีม · `null` = ทีมนี้ยังไม่ได้อัปโลโก้
     *
     * ★ เดิมมีแต่ใน `TeamDto` (หน้ารายละเอียดทีม) ⇒ โลโก้อัปขึ้นได้และไฟล์อยู่ในถังจริง
     *   แต่แสดงได้ที่หน้าเดียวของทั้งระบบ · หน้าแชมป์ ตารางอันดับ คิวแอดมิน โปรไฟล์
     *   ไม่มีโลโก้เลยทั้งที่ข้อมูลมีอยู่แล้ว (FE แจ้งมา 1 ต.ค.)
     *
     * 🔴 **การเพิ่มฟิลด์นี้ใน type บังคับให้ทุกจุดที่สร้าง `TeamRef` ต้องส่ง `logo_key` มา**
     *   ซึ่งเป็นผลที่ต้องการ — ถ้า query ไหนลืม SELECT `t.logo_key` มา `tsc` จะแดงทันที
     *   ไม่ใช่ปล่อยให้ออกไปเป็น `null` เงียบ ๆ แล้ว FE เข้าใจว่า "ทีมนี้ไม่มีโลโก้"
     */
    logoUrl : string | null
};

export function toTeamRef(row: Pick<TeamRow , 'team_id' | 'name' | 'sport_type_id' | 'logo_key'>): TeamRef{
    return {
        id : row.team_id,
        name : row.name,
        sportTypeId : row.sport_type_id,
        logoUrl : toPublicImageUrl(row.logo_key)
    }
};

export type createTeamDto = {
    id : number,
    name : string,
    sportTypeId : number,
    readinessStatus : 'Forming' | 'Ready',
    leaderId : number
}

export function toCreateTeam(row : TeamRow) : createTeamDto{
    return {
        id : row.team_id,
        name : row.name,
        sportTypeId : row.sport_type_id,
        readinessStatus : row.readiness_status,
        leaderId : row.leader_id
    };
};

export type MyTeam = {
    id : number,
    name : string,
    sportTypeId : number,
    readinessStatus : 'Forming' | 'Ready' | 'Inactive',
    officialStatus : 'Unofficial' | 'Official',
    memberCount : number,
    role : 'leader' | 'member',
    /** OD-61 — โลโก้ทีม · `null` = ยังไม่ได้อัป · หน้า "ทีมของฉัน" ใช้ช่องนี้ */
    logoUrl : string | null
}

export function toMyTeam(row : TeamRow , mem_count : number , userId : number): MyTeam {
    const status = row.deleted_at !== null ? 'Inactive' : row.readiness_status;
    const role = row.leader_id === userId ? 'leader' : 'member';
    return {
        id : row.team_id,
        name : row.name,
        sportTypeId : row.sport_type_id,
        readinessStatus : status,
        officialStatus : row.official_status,
        memberCount : mem_count,
        role : role,
        logoUrl : toPublicImageUrl(row.logo_key)
    }
}

// เหตุผลที่ทีมถูกปิด (TM-07/OD-30) — เขียนลง deleted_reason มานานแล้วแต่ไม่มี mapper ไหนอ่านกลับเลย
// หัวหน้าทีมเห็นแค่ทีมหายไปเฉยๆ นึกว่าระบบพัง ทั้งที่ระบบลบให้เองเพราะกฎ TM-07 (14 วัน/6 เดือน)
const DELETED_REASON_LABELS : Record<NonNullable<TeamRow['deleted_reason']> , string> = {
    no_registration : 'ทีมถูกปิดอัตโนมัติ เนื่องจากไม่มีการยื่นสมัครทัวร์นาเมนต์ภายใน 14 วันหลังสร้างทีม',
    inactive_6_months : 'ทีมถูกปิดอัตโนมัติ เนื่องจากไม่มีการแข่งขันมานานเกิน 6 เดือน',
    leader_deleted : 'ทีมถูกลบโดยหัวหน้าทีม',
};

function toDeletedReasonLabel(reason : TeamRow['deleted_reason']) : string | null{
    return reason === null ? null : DELETED_REASON_LABELS[reason];
}

export type TeamDto = {
    id : number,
    name : string,
    logoUrl : string | null,
    sportTypeId : number,
    readinessStatus : 'Forming' | 'Ready' | 'Inactive',
    officialStatus : 'Unofficial' | 'Official',
    visibility : 'private' | 'public',   // public = ขอเข้าร่วมได้ (T20) · มติ 20 ก.ย.
    leader : UserRefDto,
    memberCount : number,
    maxMembers : number | null,          // sport_types.max_members — หน้าค้นหาแสดง "X/max" (มติ 20 ก.ย.)
    deletedReason : string | null,       // null = ทีมยังไม่ถูกลบ (TM-07/OD-30)
    createdAt : string
}

export function toTeamDto(row : Pick<TeamRow , 'team_id' | 'name' | 'logo_key' | 'sport_type_id' | 'readiness_status' | 'official_status' | 'visibility' | 'created_at' | 'deleted_at' | 'deleted_reason'>
                        , member : number , leader : UserRefDto , maxMembers : number | null = null) : TeamDto {

    const status = row.deleted_at !== null ? 'Inactive' : row.readiness_status;
    return {
        id : row.team_id,
        name : row.name,
        logoUrl : toPublicImageUrl(row.logo_key),
        sportTypeId : row.sport_type_id,
        readinessStatus : status,
        officialStatus : row.official_status,
        visibility : row.visibility,
        leader : leader,
        memberCount : member,
        maxMembers,
        deletedReason : toDeletedReasonLabel(row.deleted_reason),
        createdAt : row.created_at.toISOString()
    }
}

// ---- Join requests (T20–T25, migration 017)
export type JoinRequestDto = {
    id : number,
    user : UserRefDto,
    message : string | null,
    status : TeamJoinRequestRow['team_join_request_status'],
    createdAt : string
}

export function toJoinRequestDto(row : JoinRequestWithUser) : JoinRequestDto {
    return {
        id : row.team_join_request_id,
        user : toUserRef(row),
        message : row.message,
        status : row.team_join_request_status,
        createdAt : row.created_at.toISOString()
    }
}

export type MyJoinRequestDto = {
    id : number,
    team : { id : number, name : string, sportTypeId : number },
    message : string | null,
    status : TeamJoinRequestRow['team_join_request_status'],
    rejectReason : string | null,
    createdAt : string,
    respondedAt : string | null
}

export function toMyJoinRequestDto(row : JoinRequestWithTeam) : MyJoinRequestDto {
    return {
        id : row.team_join_request_id,
        team : { id : row.team_id, name : row.team_name, sportTypeId : row.sport_type_id },
        message : row.message,
        status : row.team_join_request_status,
        rejectReason : row.reject_reason,
        createdAt : row.created_at.toISOString(),
        respondedAt : row.responded_at?.toISOString() ?? null
    }
}

// ---- Member
export type TeamMemberDto = {
    userId : number,
    fullName : string,
    avatarUrl : string | null,
    joinedAt : string
}

export type TeamMemberWithUserRef = Pick<TeamMemberRow , 'joined_at'> 
                                   & Pick<UserRow , 'user_id' | 'full_name' | 'profile_image_key'>;

export function toTeamMemberDto(rows : TeamMemberWithUserRef ) : TeamMemberDto{
    return{
        userId : rows.user_id,
        fullName : rows.full_name,
        avatarUrl : toPublicImageUrl(rows.profile_image_key),
        joinedAt : rows.joined_at.toISOString()
    }
}


//Invitations
export type createInvitationDto = {
    id : number,
    invitedUserId : number,
    status : 'pending' | 'accepted' | 'rejected' | 'expired', 
    expiresAt : string
};

export function toCreateTeamInvitation(rows : TeamInvitationRow): createInvitationDto{
    return{
        id : rows.team_invitation_id,
        invitedUserId : rows.invited_user_id,
        status : rows.team_invitation_status,
        expiresAt : rows.expires_at.toISOString()
    };
};

export type getAllInvitation = {
    id : number,
    invitedUser : UserRefDto
    status : 'pending' | 'accepted' | 'rejected' | 'expired', 
    createdAt : string
};

export function toGetAllInvitation(rows : getInvitation) : getAllInvitation{
    const user:UserRefDto = {id : rows.user_id , fullName : rows.full_name , avatarUrl : toPublicImageUrl(rows.profile_image_key)};
    return {
        id : rows.team_invitation_id,
        invitedUser : user,
        status : rows.team_invitation_status,
        createdAt : rows.created_at.toISOString()
    };
};


////Team request
export type getTeamOfficialRequest = {
    id : number,
    status : 'pending' | 'approved' | 'rejected'
};

export function getTeamOfficialRequestDto(rows : TeamAdminRequestRow): getTeamOfficialRequest{
    return {
        id : rows.team_admin_request_id,
        status : rows.team_admin_request_status
    }
}

// C3 — โอนหัวหน้าทีม (T19)
export type transferRequestDto = {
    id : number,
    status : 'pending' | 'approved' | 'rejected',
    currentLeaderId : number,
    proposedLeaderId : number
};

export function toTransferRequestDto(row : TeamAdminRequestRow , currentLeaderId : number) : transferRequestDto{
    return {
        id : row.team_admin_request_id,
        status : row.team_admin_request_status,
        currentLeaderId : currentLeaderId,
        proposedLeaderId : row.target_user_id!
    }
}

export type OfficialMemberConflict = Pick<UserRow , 'user_id' | 'full_name' > & { conflictingTeamName : string }

export type OfficialMemberConflictDto = {
    userId : number,
    fullName : string,
    conflictingTeamName : string
}

export function toOfficialMemberConflictDto(rows : OfficialMemberConflict): OfficialMemberConflictDto{
    return { 
        userId : rows.user_id,
        fullName : rows.full_name,
        conflictingTeamName : rows.conflictingTeamName
    }
}