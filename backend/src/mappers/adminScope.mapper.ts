import type { TeamAdminRequestRow , TeamRow , UserRow } from "../types/db.js";
import { toTeamRef } from './team.mapper.js';
import type { TeamRef } from "./team.mapper.js";
import type { UserRefDto } from "./user.mapper.js";
import type { getAdminScope } from "../repositories/adminScope.repo.js";
import { toPublicImageUrl } from "../utils/imageUrl.js";

// C2 — GET /admin/scopes
export type getAdminScopeDto = {
    id : number,
    user : UserRefDto,
    scopeType : 'faculty' | 'university_wide' | 'root',
    facultyId : number | null,
    createdAt : string
};

export function toAdminScopeDto(row : getAdminScope) : getAdminScopeDto{
    return {
        id : row.admin_scope_id,
        user : { id : row.user_id , fullName : row.full_name , avatarUrl : toPublicImageUrl(row.profile_image_key) },
        scopeType : row.scope_type,
        facultyId : row.faculty_id,
        createdAt : row.created_at.toISOString()
    };
}


export type getOfficialRequest = Pick<TeamAdminRequestRow, 'team_admin_request_id' | 'team_admin_request_status' | 'requested_at' | 'supporting_docs'> &
                                  Pick<TeamRow, 'team_id' | 'name' | 'sport_type_id' | 'logo_key'> &
                                  Pick<UserRow, 'user_id' | 'full_name' | 'profile_image_key'>;

export type getOfficialRequestDto = {
    id : number,
    team : TeamRef,
    requestedBy : UserRefDto,
    status : 'pending' | 'approved' | 'rejected',
    /**
     * เอกสารประกอบที่หัวหน้าทีมยื่นมา — presigned URL เสมอ ไม่ส่ง S3 key ดิบ (pattern เดียวกับหลักฐานการค้านผล)
     *
     * เดิมคอลัมน์นี้ถูกเขียนลงฐานตอนยื่น (บังคับกรอกด้วย) แต่คิวของแอดมินไม่เคย SELECT มาเลย
     * แอดมินจึงกดอนุมัติ/ปฏิเสธ "ทีม Official" โดยไม่มีทางเห็นเอกสารที่เป็นเหตุผลทั้งหมดของคำขอ (แก้ 27 ก.ย.)
     */
    supportingDocs : string[],
    createdAt : string
}                                


export function toGetOfficialRequest(rows : getOfficialRequest , supportingDocs : string[] = []):getOfficialRequestDto{
    // OD-61 — ใช้ toTeamRef ไม่ประกอบ object เองอีก เพื่อให้ logoUrl มาจากที่เดียวกับที่อื่น
    const team: TeamRef = toTeamRef(rows);
    const user: UserRefDto = { id : rows.user_id , fullName : rows.full_name , avatarUrl : toPublicImageUrl(rows.profile_image_key)};
    return{
        id : rows.team_admin_request_id,
        team : team,
        requestedBy : user,
        status : rows.team_admin_request_status,
        supportingDocs,
        createdAt : rows.requested_at.toISOString()
    };
};



export type requestApproveDto = {
    teamId : number,
    officialStatus : 'Unofficial' | 'Official'
};

export function toRequestApproveDto(rows : Pick<TeamRow , 'team_id' | 'official_status'>) : requestApproveDto{
    return {
        teamId : rows.team_id,
        officialStatus : rows.official_status
    }
}

// C3 — ลิสต์คำขอโอนหัวหน้าทีมที่รออนุมัติ
export type getTransferRequest = Pick<TeamAdminRequestRow, 'team_admin_request_id' | 'team_admin_request_status' | 'requested_at'> &
                                  Pick<TeamRow, 'team_id' | 'name' | 'sport_type_id' | 'logo_key'> &
                                  {
                                      current_leader_id : number, current_leader_full_name : string, current_leader_profile_image_key : string | null,
                                      proposed_leader_id : number, proposed_leader_full_name : string, proposed_leader_profile_image_key : string | null
                                  };

export type getTransferRequestDto = {
    id : number,
    team : TeamRef,
    currentLeader : UserRefDto,
    proposedLeader : UserRefDto,
    status : 'pending' | 'approved' | 'rejected',
    createdAt : string
}

export function toGetTransferRequest(rows : getTransferRequest) : getTransferRequestDto{
    const team: TeamRef = toTeamRef(rows);
    const currentLeader: UserRefDto = { id : rows.current_leader_id , fullName : rows.current_leader_full_name , avatarUrl : toPublicImageUrl(rows.current_leader_profile_image_key)};
    const proposedLeader: UserRefDto = { id : rows.proposed_leader_id , fullName : rows.proposed_leader_full_name , avatarUrl : toPublicImageUrl(rows.proposed_leader_profile_image_key)};
    return {
        id : rows.team_admin_request_id,
        team : team,
        currentLeader : currentLeader,
        proposedLeader : proposedLeader,
        status : rows.team_admin_request_status,
        createdAt : rows.requested_at.toISOString()
    };
}

export type requestRejectDto = {
    status : 'pending' | 'approved' | 'rejected',
    reason : string | null
}
export function toRequestRejectDto(rows : Pick<TeamAdminRequestRow , 'team_admin_request_status' | 'rejection_reason'>) : requestRejectDto{
    return {
        status : rows.team_admin_request_status,
        reason : rows.rejection_reason
    }
}