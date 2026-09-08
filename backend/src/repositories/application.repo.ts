import pool from '../config/db.js';
import type { TeamRow } from '../types/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function findApprovedTeamsByTournament(tournamentId: number): Promise<Pick<TeamRow , "team_id" | "name" | "sport_type_id">[]> {
    const [rows] = await pool.query<(TeamRow & RowDataPacket)[]>(
        `SELECT t.team_id, t.name, t.sport_type_id
         FROM tournament_applications ta
         JOIN teams t ON ta.team_id = t.team_id
         WHERE ta.tournament_id = ? AND ta.tournament_application_status = 'approved'`,
        [tournamentId]
    );
    return rows;
}

export type LeaderApplicationRow = {
    tournament_application_id: number;
    tournament_application_status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'withdrawn';
    rejection_reason: string | null;
    applied_at: Date;
    tournament_id: number;
    tournament_name: string;
    team_id: number;
    team_name: string;
    sport_type_id: number;
};

export async function findApplicationsByLeader(userId: number): Promise<Pick<LeaderApplicationRow    , "tournament_application_id" | "tournament_application_status" | "rejection_reason"
| "applied_at" | "tournament_id" | "tournament_name" | "team_id" | "team_name" | "sport_type_id">[]> {
    const [rows] = await pool.query<(LeaderApplicationRow    & RowDataPacket)[]>(
        `SELECT 
            ta.tournament_application_id, ta.tournament_application_status, ta.rejection_reason, ta.applied_at,
            t.tournament_id, t.name AS tournament_name,
            tm.team_id, tm.name AS team_name, tm.sport_type_id
         FROM tournament_applications ta
         JOIN tournaments t ON ta.tournament_id = t.tournament_id
         JOIN teams tm ON ta.team_id = tm.team_id
         WHERE tm.leader_id = ?`,
        [userId]
    );
    return rows;
}

export type OrganizerApplicationRow = {
    tournament_application_id: number;
    tournament_application_status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'withdrawn';
    hard_filter_passed: number | null;
    soft_filter_documents: string[] | null;
    applied_at: Date;
    team_id: number;
    team_name: string;
    sport_type_id: number;
};

export async function findApplicationsByTournament(tournamentId: number): Promise<OrganizerApplicationRow[]> {
    const [rows] = await pool.query<(OrganizerApplicationRow & RowDataPacket)[]>(
        `SELECT 
            ta.tournament_application_id, ta.tournament_application_status, ta.hard_filter_passed, 
            ta.soft_filter_documents, ta.applied_at,
            tm.team_id, tm.name AS team_name, tm.sport_type_id
         FROM tournament_applications ta
         JOIN teams tm ON ta.team_id = tm.team_id
         WHERE ta.tournament_id = ?`,
        [tournamentId]
    );
    return rows;
}

export type ApplicationDetailRow = {
    tournament_application_id: number;
    tournament_application_status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'withdrawn';
    hard_filter_details: unknown;
    soft_filter_documents: string[] | null;
    tournament_id: number;
    tournament_requested_by_user_id: number;
    tournament_status: 'pending_approval' | 'rejected' | 'private' | 'public' | 'completed' | 'auto_deleted';
    team_id: number;
    team_name: string;
    sport_type_id: number;
    team_leader_id: number;
};

export async function findApplicationById(id: number): Promise<ApplicationDetailRow | null> {
    const [rows] = await pool.query<(ApplicationDetailRow & RowDataPacket)[]>(
        `SELECT 
            ta.tournament_application_id, ta.tournament_application_status, 
            ta.hard_filter_details, ta.soft_filter_documents,
            t.tournament_id, t.requested_by_user_id AS tournament_requested_by_user_id, t.tournament_status,
            tm.team_id, tm.name AS team_name, tm.sport_type_id, tm.leader_id AS team_leader_id
         FROM tournament_applications ta
         JOIN tournaments t ON ta.tournament_id = t.tournament_id
         JOIN teams tm ON ta.team_id = tm.team_id
         WHERE ta.tournament_application_id = ?`,
        [id]
    );
    const app = rows[0];
    return app ?? null;
}

export async function updateApplicationStatus(id: number, status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'withdrawn'): Promise<void> {
    await pool.query(
        "UPDATE tournament_applications SET tournament_application_status = ? WHERE tournament_application_id = ?",
        [status, id]
    );
}

export async function rejectApplicationInDb(id: number, reason: string): Promise<void> {
    await pool.query(
        "UPDATE tournament_applications SET tournament_application_status = 'rejected', rejection_reason = ? WHERE tournament_application_id = ?",
        [reason, id]
    );
}

export type TeamForApplyRow = {
    team_id: number;
    leader_id: number;
    readiness_status: 'Forming' | 'Ready';
};

export async function findTeamForApply(teamId: number): Promise<TeamForApplyRow | null> {
    const [rows] = await pool.query<(TeamForApplyRow & RowDataPacket)[]>(
        "SELECT team_id, leader_id, readiness_status FROM teams WHERE team_id = ? AND deleted_at IS NULL",
        [teamId]
    );
    const team = rows[0];
    return team ?? null;
}

export type TeamMemberForFilterRow = {
    user_id: number;
    full_name: string;
    gender: 'male' | 'female' | 'other';
    birth_date: string;
    year: number | null;
    faculty_id: number | null;
};

export async function findTeamMembersForFilter(teamId: number): Promise<TeamMemberForFilterRow[]> {
    const [rows] = await pool.query<(TeamMemberForFilterRow & RowDataPacket)[]>(
        `SELECT u.user_id, u.full_name, u.gender, u.birth_date, u.year, u.faculty_id
         FROM team_members tm
         JOIN users u ON tm.user_id = u.user_id
         WHERE tm.team_id = ?`,
        [teamId]
    );
    return rows;
}

export type EligibilityRuleRow = {
    rule_type: 'year' | 'faculty';
    rule_value: number;
};

export async function findEligibilityRules(tournamentId: number): Promise<EligibilityRuleRow[]> {
    const [rows] = await pool.query<(EligibilityRuleRow & RowDataPacket)[]>(
        "SELECT rule_type, rule_value FROM tournament_eligibility_rules WHERE tournament_id = ?",
        [tournamentId]
    );
    return rows;
}

export async function findExistingApplication(tournamentId: number, teamId: number): Promise<{ tournament_application_id: number } | null> {
    const [rows] = await pool.query<({ tournament_application_id: number } & RowDataPacket)[]>(
        "SELECT tournament_application_id FROM tournament_applications WHERE tournament_id = ? AND team_id = ?",
        [tournamentId, teamId]
    );
    const app = rows[0];
    return app ?? null;
}

export async function insertApplication(
    tournamentId: number,
    teamId: number,
    hardFilterDetails: unknown
): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO tournament_applications
            (tournament_id, team_id, tournament_application_status, hard_filter_passed, hard_filter_details)
         VALUES (?, ?, 'pending', TRUE, ?)`,
        [tournamentId, teamId, JSON.stringify(hardFilterDetails)]
    );
    return result.insertId;
}