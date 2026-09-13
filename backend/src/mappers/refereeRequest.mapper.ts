import type { UserRefDto } from './user.mapper.js';
import { toUserRef } from './user.mapper.js';
import type { RefereeRequestListRow } from '../repositories/refereeChangeRequest.repo.js';
import type { RefereeRequestType, RefereeRequestSideStatus } from '../types/db.js';

export type RequestMatchDto = {
    id : number,
    roundNumber : number | null,
    scheduledTime : string | null,
    scheduledEndTime : string | null
};

export type RequestRefereeDto = {
    tournamentRefereeId : number,
    user : UserRefDto,
    /** ฝั่งนี้ต้องตอบไหม และตอบว่าอะไร */
    status : RefereeRequestSideStatus
};

export type RefereeRequestDto = {
    id : number,
    tournamentId : number,
    type : RefereeRequestType,
    requestedBy : number,
    refereeA : RequestRefereeDto,
    refereeB : RequestRefereeDto | null,
    matchA : RequestMatchDto,
    matchB : RequestMatchDto | null,
    status : RefereeRequestListRow['request_status'],
    createdAt : string,
    resolvedAt : string | null
};

export function toRefereeRequestDto(r : RefereeRequestListRow): RefereeRequestDto {
    return {
        id : r.request_id,
        tournamentId : r.tournament_id,
        type : r.request_type,
        requestedBy : r.requested_by,
        refereeA : {
            tournamentRefereeId : r.referee_a_id,
            user : toUserRef({ user_id : r.a_user_id, full_name : r.a_full_name, profile_image_key : r.a_profile_image_key }),
            status : r.a_status
        },
        refereeB : r.referee_b_id !== null && r.b_user_id !== null ? {
            tournamentRefereeId : r.referee_b_id,
            user : toUserRef({ user_id : r.b_user_id, full_name : r.b_full_name ?? '', profile_image_key : r.b_profile_image_key }),
            status : r.b_status
        } : null,
        matchA : {
            id : r.match_a_id, roundNumber : r.ma_round_number,
            scheduledTime : r.ma_scheduled_time?.toISOString() ?? null,
            scheduledEndTime : r.ma_scheduled_end_time?.toISOString() ?? null
        },
        matchB : r.match_b_id !== null ? {
            id : r.match_b_id, roundNumber : r.mb_round_number,
            scheduledTime : r.mb_scheduled_time?.toISOString() ?? null,
            scheduledEndTime : r.mb_scheduled_end_time?.toISOString() ?? null
        } : null,
        status : r.request_status,
        createdAt : r.created_at.toISOString(),
        resolvedAt : r.resolved_at?.toISOString() ?? null
    };
}
