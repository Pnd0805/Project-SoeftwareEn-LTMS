import { toUserRef } from './user.mapper.js';
import type { TeamJoinRequestRow } from '../types/db.js';
import type { JoinRequestWithUser, JoinRequestWithTeam } from '../repositories/joinRequest.repo.js';
import type { TeamRow , TeamMemberRow, TeamInvitationRow, TeamAdminRequestRow } from "../types/db.js";
import type { UserRefDto } from "./user.mapper.js";
import type { UserRow } from "../types/db.js";
import type { getInvitation } from "../repositories/team.repo.js";
export type TeamRef = {
    id : number,
    name : string,
    sportTypeId : number
}; 

export function toTeamRef(row: Pick<TeamRow , 'team_id' | 'name' | 'sport_type_id'>): TeamRef{
    return {
        id : row.team_id,
        name : row.name,
        sportTypeId : row.sport_type_id
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
    role : 'leader' | 'member';
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
        role : role
    }
}

export type TeamDto = {
    id : number,
    name : string,
    sportTypeId : number,
    readinessStatus : 'Forming' | 'Ready' | 'Inactive',
    officialStatus : 'Unofficial' | 'Official',
    visibility : 'private' | 'public',   // public = ขอเข้าร่วมได้ (T20) · มติ 20 ก.ย.
    leader : UserRefDto,
    memberCount : number,
    maxMembers : number | null,          // sport_types.max_members — หน้าค้นหาแสดง "X/max" (มติ 20 ก.ย.)
    createdAt : string
}

export function toTeamDto(row : Pick<TeamRow , 'team_id' | 'name' | 'sport_type_id' | 'readiness_status' | 'official_status' | 'visibility' | 'created_at' | 'deleted_at'>
                        , member : number , leader : UserRefDto , maxMembers : number | null = null) : TeamDto {

    const status = row.deleted_at !== null ? 'Inactive' : row.readiness_status;
    return {
        id : row.team_id,
        name : row.name,
        sportTypeId : row.sport_type_id,
        readinessStatus : status,
        officialStatus : row.official_status,
        visibility : row.visibility,
        leader : leader,
        memberCount : member,
        maxMembers,
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
    position : 'starter' | 'substitute',
    joinedAt : string
}

export type TeamMemberWithUserRef = Pick<TeamMemberRow , 'position' | 'joined_at'> 
                                   & Pick<UserRow , 'user_id' | 'full_name' | 'profile_image_key'>;

export function toTeamMemberDto(rows : TeamMemberWithUserRef ) : TeamMemberDto{
    return{
        userId : rows.user_id,
        fullName : rows.full_name,
        avatarUrl : rows.profile_image_key,
        position : rows.position,
        joinedAt : rows.joined_at.toISOString()
    }
}

export function toUpdateMember(rows : Pick<TeamMemberRow , 'user_id' | 'position'>) : { userId : number , position : 'starter' | 'substitute'}{
    return {
        userId : rows.user_id,
        position : rows.position
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
    const user:UserRefDto = {id : rows.user_id , fullName : rows.full_name , avatarUrl : rows.profile_image_key};
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