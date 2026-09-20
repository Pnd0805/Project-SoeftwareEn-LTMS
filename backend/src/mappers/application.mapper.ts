import type { LeaderApplicationRow } from '../repositories/application.repo.js';
import type { OrganizerApplicationRow } from '../repositories/application.repo.js';
import type { ApplicationDetailRow } from '../repositories/application.repo.js';
import type { ApplicationPlayerRow } from '../repositories/application.repo.js';

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
        softFilterDocuments: row.soft_filter_documents ?? [], // สเปกไม่รับ null ต้องเป็น array เสมอ (ว่างได้)
        appliedAt: row.applied_at
    }
}

export type HardFilterDetailItem = {
    userId: number;
    fullName: string;
    passed: boolean;
    reason?: 'gender' | 'age' | 'year' | 'faculty';
};

export type ApplicationPlayerDto = {
    userId: number;
    fullName: string;
    avatarUrl: string | null;
};

export function toApplicationPlayerDto(row: ApplicationPlayerRow): ApplicationPlayerDto {
    return { userId: row.user_id, fullName: row.full_name, avatarUrl: row.profile_image_key };
}

export function toApplicationDetailDto(row: ApplicationDetailRow, softFilterDocumentUrls: string[], players: ApplicationPlayerRow[]) {
    return {
        id: row.tournament_application_id,
        tournamentId: row.tournament_id,
        team: { id: row.team_id, name: row.team_name, sportTypeId: row.sport_type_id },
        status: row.tournament_application_status,
        hardFilterDetails: (row.hard_filter_details ?? []) as HardFilterDetailItem[],
        softFilterDocuments: softFilterDocumentUrls,
        // รายชื่อผู้เล่นที่ทีมส่งลงแข่ง (ว่างได้ถ้าใบสมัครตายแล้ว — ปลดล็อกผู้เล่นไปทีมอื่น)
        players: players.map(toApplicationPlayerDto),
    };
}