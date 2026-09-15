import type { TeamAdminRequestRow , TeamRow , UserRow } from "../types/db.js";
import type { TeamRef } from "./team.mapper.js";
import type { UserRefDto } from "./user.mapper.js";


export type getOfficialRequest = Pick<TeamAdminRequestRow, 'team_admin_request_id' | 'team_admin_request_status' | 'requested_at'> &
                                  Pick<TeamRow, 'team_id' | 'name' | 'sport_type_id'> &
                                  Pick<UserRow, 'user_id' | 'full_name' | 'profile_image_key'>;

export type getOfficialRequestDto = {
    id : number,
    team : TeamRef,
    requestedBy : UserRefDto,
    status : 'pending' | 'approved' | 'rejected',
    createdAt : string
}                                


export function toGetOfficialRequest(rows : getOfficialRequest):getOfficialRequestDto{
    const team: TeamRef = { id : rows.team_id , name : rows.name , sportTypeId : rows.sport_type_id};
    const user: UserRefDto = { id : rows.user_id , fullName : rows.full_name , avatarUrl : rows.profile_image_key};
    return{
        id : rows.team_admin_request_id,
        team : team,
        requestedBy : user,
        status : rows.team_admin_request_status,
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