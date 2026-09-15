import type { UserRefDto } from './user.mapper.js';
import { toUserRef } from './user.mapper.js';
import type { TournamentRefereeListRow } from '../repositories/tournamentReferee.repo.js';
import type { MyRefereeInvitationRow } from '../repositories/tournamentReferee.repo.js';

export type TournamentRefereeDto = {
    id : number,
    user : UserRefDto,
    invitationStatus : 'pending' | 'accepted' | 'rejected',
    isExternal : boolean,
    externalApprovalStatus : 'not_required' | 'pending' | 'approved' | 'rejected'
};

export function toTournamentRefereeDto(row : TournamentRefereeListRow): TournamentRefereeDto {
    return {
        id : row.tournament_referee_id,
        user : toUserRef(row),
        invitationStatus : row.invitation_status,
        isExternal : row.is_external === 1,
        externalApprovalStatus : row.external_approval_status
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