import type { MatchDetailRow, MatchListRow, MatchCheckinListRow } from '../repositories/match.repo.js';
import type { BracketNodeListRow } from '../repositories/bracketNode.repo.js';

export type MatchListItemDto = {
    id: number;
    round: number | null;
    teamA: { id: number; name: string; sportTypeId: number } | null;
    teamB: { id: number; name: string; sportTypeId: number } | null;
    scheduledTime: Date | null;
    venue: string | null;
    status: string;
};

export function toMatchListItemDto(row: MatchListRow): MatchListItemDto {
    return {
        id: row.match_id,
        round: row.round_number,
        teamA: row.team_a_id !== null
            ? { id: row.team_a_id, name: row.team_a_name!, sportTypeId: row.team_a_sport_type_id! }
            : null,
        teamB: row.team_b_id !== null
            ? { id: row.team_b_id, name: row.team_b_name!, sportTypeId: row.team_b_sport_type_id! }
            : null,
        scheduledTime: row.scheduled_time,
        venue: row.venue,
        status: row.match_status,
    };
}

export type MatchDetailItemDto = { 
    id: number;
    tournamentId: number;
    round: number | null;
    teamA: { id: number; name: string; sportTypeId: number } | null;
    teamB: { id: number; name: string; sportTypeId: number } | null;
    scheduledTime: Date | null;
    venue: string | null;
    checkinOpenAt: Date | null; 
    status: string; 
    mode : 'onsite' | 'online',
    nextMatchId: number | null;
}

export function toMatchDetailDto(row: MatchDetailRow): MatchDetailItemDto {
    return {
        id: row.match_id,
        tournamentId: row.tournament_id,
        round: row.round_number,
        teamA: row.team_a_id !== null
            ? { id: row.team_a_id, name: row.team_a_name!, sportTypeId: row.team_a_sport_type_id! }
            : null,
        teamB: row.team_b_id !== null
            ? { id: row.team_b_id, name: row.team_b_name!, sportTypeId: row.team_b_sport_type_id! }
            : null,
        scheduledTime: row.scheduled_time,
        venue: row.venue,
        checkinOpenAt: row.checkin_open_at,
        status: row.match_status,
        mode: row.mode,
        nextMatchId: row.next_match_id
    };
}

export type CheckinListItemDto = {
    userId: number;
    fullName: string;
    method: 'qr_onsite' | 'photo_online' | 'manual_by_referee';
    status: 'success' | 'rejected' | 'exception';
    checkedInAt: Date;
};

export function toCheckinListItemDto(row: MatchCheckinListRow): CheckinListItemDto {
    return {
        userId: row.user_id,
        fullName: row.full_name,
        method: row.method,
        status: row.match_checkin_status,
        checkedInAt: row.checked_in_at,
    };
}

export type BracketNodeDto = {
    nodeId: number;
    bracketType: 'winners' | 'losers' | 'grand_final';
    round: number | null;
    matchNumber: number;
    teamA: { id: number; name: string; sportTypeId: number } | null;
    teamB: { id: number; name: string; sportTypeId: number } | null;
    matchId: number | null;
    matchStatus: string | null;
    advancesToNodeId: number | null;
};

export function toBracketNodeDto(row: BracketNodeListRow): BracketNodeDto {
    return {
        nodeId: row.bracket_node_id,
        bracketType: row.bracket_type,
        round: row.round,
        matchNumber: row.match_number,
        teamA: row.team_a_id !== null
            ? { id: row.team_a_id, name: row.team_a_name!, sportTypeId: row.team_a_sport_type_id! }
            : null,
        teamB: row.team_b_id !== null
            ? { id: row.team_b_id, name: row.team_b_name!, sportTypeId: row.team_b_sport_type_id! }
            : null,
        matchId: row.match_id,
        matchStatus: row.match_status,
        advancesToNodeId: row.advances_to_node_id,
    };
}