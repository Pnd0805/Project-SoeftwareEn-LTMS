import type { LeaderApplicationRow } from '../repositories/application.repo.js';
import type { OrganizerApplicationRow } from '../repositories/application.repo.js';
import type { ApplicationDetailRow } from '../repositories/application.repo.js';

export function toMyApplicationDto(row: LeaderApplicationRow) {
    return {
        id: row.tournament_application_id,
        tournament: { id: row.tournament_id , name: row.tournament_name },
        team: { id: row.team_id , name: row.team_name , sportTypeId: row.sport_type_id },
        status: row.tournament_application_status,
        rejectionReason: row.rejection_reason,
        appliedAt: row.applied_at,
    };
}

export function toOrganizerApplicationDto(row: OrganizerApplicationRow) {
    return {
        id: row.tournament_application_id, 
        team: { id: row.team_id , name: row.team_name , sportTypeId: row.sport_type_id }, 
        status: row.tournament_application_status, 
        hardFilterPassed: !!row.hard_filter_passed, 
        softFilterDocuments: row.soft_filter_documents, 
        appliedAt: row.applied_at
    }
}

export function toApplicationDetailDto(row: ApplicationDetailRow) {
    return {
        id: row.tournament_application_id,
        tournamentId: row.tournament_id,
        team: { id: row.team_id, name: row.team_name, sportTypeId: row.sport_type_id },
        status: row.tournament_application_status,
        hardFilterDetails: row.hard_filter_details,
        softFilterDocuments: row.soft_filter_documents,
    };
}