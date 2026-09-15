import type { TournamentRow } from '../types/db.js';
import type { UserRefDto } from './user.mapper.js';

function toIso(value: Date | string | null): string | null {
    if (value === null) return null;
    return value instanceof Date ? value.toISOString() : value;
}

export type TournamentListDto = {
    id: number;
    name: string;
    sportTypeId: number;
    eventStartDate: string;
    eventEndDate: string | null;
    registrationOpen: boolean;
    venue: string | null;
    organizingFacultyId: number | null;
};

export function toTournamentListDto(row: Pick<TournamentRow, 'tournament_id' | 'name' | 'sport_type_id' | 'event_start_date' | 'event_end_date' | 'registration_open' | 'venue' | 'organizing_faculty_id'>): TournamentListDto {
    return {
        id: row.tournament_id,
        name: row.name,
        sportTypeId: row.sport_type_id,
        eventStartDate: row.event_start_date,
        eventEndDate: row.event_end_date,
        registrationOpen: Boolean(row.registration_open),
        venue: row.venue,
        organizingFacultyId: row.organizing_faculty_id
    };
}

export type TournamentDetailDto = {
    id: number;
    name: string;
    description: string | null;
    sportTypeId: number;
    bracketFormat: TournamentRow['bracket_format'];
    scopeType: TournamentRow['scope_type'];
    organizingFacultyId: number | null;
    organizingDepartmentId: number | null;
    status: TournamentRow['tournament_status'];
    registrationOpen: boolean;
    registrationStart: string | null;
    registrationEnd: string | null;
    eventStartDate: string;
    eventEndDate: string | null;
    maxTeams: number;
    minTeams: number;
    venue: string | null;
    genderRequirement: TournamentRow['gender_requirement'];
    minAge: number | null;
    maxAge: number | null;
    organizer: UserRefDto;
    approvedTeamCount: number;
};

export function toTournamentDetailDto(row: TournamentRow, organizer: UserRefDto, approvedTeamCount: number): TournamentDetailDto {
    return {
        id: row.tournament_id,
        name: row.name,
        description: row.description,
        sportTypeId: row.sport_type_id,
        bracketFormat: row.bracket_format,
        scopeType: row.scope_type,
        organizingFacultyId: row.organizing_faculty_id,
        organizingDepartmentId: row.organizing_department_id,
        status: row.tournament_status,
        registrationOpen: Boolean(row.registration_open),
        registrationStart: toIso(row.registration_start),
        registrationEnd: toIso(row.registration_end),
        eventStartDate: row.event_start_date,
        eventEndDate: row.event_end_date,
        maxTeams: row.max_teams,
        minTeams: row.min_teams,
        venue: row.venue,
        genderRequirement: row.gender_requirement,
        minAge: row.min_age,
        maxAge: row.max_age,
        organizer,
        approvedTeamCount
    };
}
