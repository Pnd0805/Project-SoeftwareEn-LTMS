import type { TeamRow , TeamMemberRow } from "../types/db.js";
import type { UserRefDto } from "./user.mapper.js";
import type { UserRow } from "../types/db.js";
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
    leader : UserRefDto,
    memberCount : number,
    createdAt : string
}

export function toTeamDto(row : Pick<TeamRow , 'team_id' | 'name' | 'sport_type_id' | 'readiness_status' | 'official_status' | 'created_at' | 'deleted_at'>
                        , member : number , leader : UserRefDto) : TeamDto {

    const status = row.deleted_at !== null ? 'Inactive' : row.readiness_status;
    return {
        id : row.team_id,
        name : row.name,
        sportTypeId : row.sport_type_id,
        readinessStatus : status,
        officialStatus : row.official_status,
        leader : leader,
        memberCount : member,
        createdAt : row.created_at.toISOString()
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