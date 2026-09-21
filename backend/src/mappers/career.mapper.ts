import type { CareerTournamentRow } from '../repositories/career.repo.js';

export type CareerTournamentDto = {
    tournament: {
        id: number;
        name: string;
        sportTypeId: number;
        status: CareerTournamentRow['tournament_status'];
    };
    team: { id: number; name: string };
    played: number;
    wins: number;
    losses: number;
    champion: boolean;
};

export function toCareerTournamentDto(row: CareerTournamentRow): CareerTournamentDto {
    return {
        tournament: {
            id: row.tournament_id,
            name: row.tournament_name,
            sportTypeId: row.sport_type_id,
            status: row.tournament_status,
        },
        team: { id: row.team_id, name: row.team_name },
        played: Number(row.played),
        wins: Number(row.wins),
        losses: Number(row.losses),
        champion: Boolean(row.champion),
    };
}
