import type { MatchDetailRow, MatchListRow } from '../repositories/match.repo.js';

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