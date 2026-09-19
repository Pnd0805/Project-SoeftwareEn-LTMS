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

type LeaderApplicationListRow = Pick<LeaderApplicationRow, "tournament_application_id" | "tournament_application_status" | "rejection_reason"
| "applied_at" | "tournament_id" | "tournament_name" | "team_id" | "team_name" | "sport_type_id">;

export async function findApplicationsByLeader(
    userId: number,
    offset: number,
    pageSize: number
): Promise<{ rows: LeaderApplicationListRow[]; totalItems: number }> {
    const [rows] = await pool.query<(LeaderApplicationListRow & RowDataPacket)[]>(
        `SELECT
            ta.tournament_application_id, ta.tournament_application_status, ta.rejection_reason, ta.applied_at,
            t.tournament_id, t.name AS tournament_name,
            tm.team_id, tm.name AS team_name, tm.sport_type_id
         FROM tournament_applications ta
         JOIN tournaments t ON ta.tournament_id = t.tournament_id
         JOIN teams tm ON ta.team_id = tm.team_id
         WHERE tm.leader_id = ?
         ORDER BY ta.tournament_application_id
         LIMIT ? OFFSET ?`,
        [userId, pageSize, offset]
    );
    const [countRows] = await pool.query<({ totalItems: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS totalItems
         FROM tournament_applications ta
         JOIN teams tm ON ta.team_id = tm.team_id
         WHERE tm.leader_id = ?`,
        [userId]
    );
    return { rows, totalItems: countRows[0]?.totalItems ?? 0 };
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

export async function findApplicationsByTournament(
    tournamentId: number,
    offset: number,
    pageSize: number
): Promise<{ rows: OrganizerApplicationRow[]; totalItems: number }> {
    const [rows] = await pool.query<(OrganizerApplicationRow & RowDataPacket)[]>(
        `SELECT
            ta.tournament_application_id, ta.tournament_application_status, ta.hard_filter_passed,
            ta.soft_filter_documents, ta.applied_at,
            tm.team_id, tm.name AS team_name, tm.sport_type_id
         FROM tournament_applications ta
         JOIN teams tm ON ta.team_id = tm.team_id
         WHERE ta.tournament_id = ?
         ORDER BY ta.tournament_application_id
         LIMIT ? OFFSET ?`,
        [tournamentId, pageSize, offset]
    );
    const [countRows] = await pool.query<({ totalItems: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS totalItems FROM tournament_applications WHERE tournament_id = ?`,
        [tournamentId]
    );
    return { rows, totalItems: countRows[0]?.totalItems ?? 0 };
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
    sport_type_id: number;
    readiness_status: 'Forming' | 'Ready';
};

export async function findTeamForApply(teamId: number): Promise<TeamForApplyRow | null> {
    const [rows] = await pool.query<(TeamForApplyRow & RowDataPacket)[]>(
        "SELECT team_id, leader_id, sport_type_id, readiness_status FROM teams WHERE team_id = ? AND deleted_at IS NULL",
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

/**
 * Conflict of interest (มติ 18 ก.ย. 2569): สมาชิกทีมที่จะสมัคร ห้ามเป็นกรรมการของทัวร์นี้ (คำเชิญ pending/accepted ที่ยังไม่ถูกถอด)
 * — ORG เช็คแยกใน service จาก tournament.requested_by_user_id
 */
export async function findRefereesAmongUsers(tournamentId: number, userIds: number[]): Promise<number[]> {
    if (userIds.length === 0) return [];
    const [rows] = await pool.query<({ user_id: number } & RowDataPacket)[]>(
        `SELECT DISTINCT tr.user_id
         FROM tournament_referees tr
         WHERE tr.tournament_id = ? AND tr.user_id IN (?) AND tr.removed_at IS NULL
           AND tr.invitation_status IN ('pending', 'accepted')
           AND tr.tournament_referee_id = (
               SELECT MAX(t2.tournament_referee_id) FROM tournament_referees t2
               WHERE t2.tournament_id = tr.tournament_id AND t2.user_id = tr.user_id)`,
        [tournamentId, userIds]
    );
    return rows.map(r => r.user_id);
}

/**
 * ประตูที่ 3 ของ CoI (T09/T13): คนนี้จะเข้าทีมที่สมัครทัวร์ (pending/approved) ที่ตัวเองเป็น ORG หรือกรรมการ (pending/accepted) อยู่ไหม
 * คืนทัวร์แรกที่ชน (null = เข้าได้)
 */
export async function findTeamTournamentConflictForUser(teamId: number, userId: number)
    : Promise<{ tournament_id: number; name: string; role: 'organizer' | 'referee' } | null> {
    const [rows] = await pool.query<({ tournament_id: number; name: string; role: 'organizer' | 'referee' } & RowDataPacket)[]>(
        `SELECT t.tournament_id, t.name,
                CASE WHEN t.requested_by_user_id = ? THEN 'organizer' ELSE 'referee' END AS role
         FROM tournament_applications a
         JOIN tournaments t ON t.tournament_id = a.tournament_id
         WHERE a.team_id = ? AND a.tournament_application_status IN ('pending', 'approved')
           AND (t.requested_by_user_id = ?
                OR EXISTS (SELECT 1 FROM tournament_referees tr
                           WHERE tr.tournament_id = t.tournament_id AND tr.user_id = ? AND tr.removed_at IS NULL
                             AND tr.invitation_status IN ('pending', 'accepted')
                             AND tr.tournament_referee_id = (
                                 SELECT MAX(t2.tournament_referee_id) FROM tournament_referees t2
                                 WHERE t2.tournament_id = tr.tournament_id AND t2.user_id = tr.user_id)))
         LIMIT 1`,
        [userId, teamId, userId, userId]
    );
    return rows[0] ?? null;
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

// ---- รายชื่อผู้เล่นที่ส่งลงแข่ง (application_players, migration 014) ----

export type PlayerConflictRow = {
    user_id: number;
    full_name: string;
    team_id: number;
    team_name: string;
};

/** คนที่มีชื่อลงแข่งทัวร์นี้กับทีมอื่นอยู่แล้ว (ใบสมัครที่ยังมีชีวิต — ใบที่ตายแล้วถูกลบแถวทิ้ง) */
export async function findPlayerConflicts(tournamentId: number, userIds: number[]): Promise<PlayerConflictRow[]> {
    if (userIds.length === 0) return [];
    const [rows] = await pool.query<(PlayerConflictRow & RowDataPacket)[]>(
        `SELECT ap.user_id, u.full_name, tm.team_id, tm.name AS team_name
         FROM application_players ap
         JOIN tournament_applications ta ON ta.tournament_application_id = ap.tournament_application_id
         JOIN teams tm ON tm.team_id = ta.team_id
         JOIN users u ON u.user_id = ap.user_id
         WHERE ap.tournament_id = ? AND ap.user_id IN (?)`,
        [tournamentId, userIds]
    );
    return rows;
}

/**
 * P01 — ใบสมัคร + รายชื่อผู้เล่น ต้องเกิดพร้อมกันหรือไม่เกิดเลย
 * คืน null = ชน uq_tournament_player (มีคนถูกส่งลงทัวร์นี้กับทีมอื่นไปแล้ว) → service ไปหาว่าใครชนด้วย findPlayerConflicts
 */
export async function insertApplicationWithPlayers(
    tournamentId: number,
    teamId: number,
    hardFilterDetails: unknown,
    playerIds: number[]
): Promise<number | null> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.query<ResultSetHeader>(
            `INSERT INTO tournament_applications
                (tournament_id, team_id, tournament_application_status, hard_filter_passed, hard_filter_details)
             VALUES (?, ?, 'pending', TRUE, ?)`,
            [tournamentId, teamId, JSON.stringify(hardFilterDetails)]
        );
        const applicationId = result.insertId;

        await conn.query<ResultSetHeader>(
            `INSERT INTO application_players (tournament_application_id, tournament_id, user_id) VALUES ?`,
            [playerIds.map(userId => [applicationId, tournamentId, userId])]
        );

        await conn.commit();
        return applicationId;
    } catch (err) {
        await conn.rollback();
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') return null;
        throw err;
    } finally {
        conn.release();
    }
}

export type ApplicationPlayerRow = {
    user_id: number;
    full_name: string;
    profile_image_key: string | null;
};

export async function findPlayersByApplication(applicationId: number): Promise<ApplicationPlayerRow[]> {
    const [rows] = await pool.query<(ApplicationPlayerRow & RowDataPacket)[]>(
        `SELECT u.user_id, u.full_name, u.profile_image_key
         FROM application_players ap
         JOIN users u ON u.user_id = ap.user_id
         WHERE ap.tournament_application_id = ?
         ORDER BY u.full_name`,
        [applicationId]
    );
    return rows;
}

/** ใบสมัครตาย (cancel/reject/withdraw) → ปลดล็อกผู้เล่นให้ไปอยู่ทีมอื่นในทัวร์เดียวกันได้ */
export async function deletePlayersByApplication(applicationId: number): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM application_players WHERE tournament_application_id = ?`,
        [applicationId]
    );
    return result.affectedRows;
}

export type LiveSquadRow = {
    tournament_application_id: number;
    tournament_id: number;
    tournament_name: string;
    match_count: number;      // > 0 = สร้างสายแล้ว → ล็อกรายชื่อ ถอนทีมก่อนถึงจะเอาคนออกได้
    squad_size: number;
};

/**
 * ทัวร์ที่ "ยังมีชีวิต" (pending/approved) ซึ่งทีมนี้ส่งคนนี้ลงแข่งไว้
 * ใช้ตอนหัวหน้าทีมจะเอาคนออกจากทีม (มติ 19 ก.ย. 2569) — userId = undefined คือดูทั้งทีม (ตอนลบทีม)
 */
export async function findLiveSquadsOfTeam(teamId: number, userId?: number): Promise<LiveSquadRow[]> {
    const [rows] = await pool.query<(LiveSquadRow & RowDataPacket)[]>(
        `SELECT ta.tournament_application_id, ta.tournament_id, t.name AS tournament_name,
                (SELECT COUNT(*) FROM matches m WHERE m.tournament_id = ta.tournament_id) AS match_count,
                (SELECT COUNT(*) FROM application_players p
                  WHERE p.tournament_application_id = ta.tournament_application_id) AS squad_size
         FROM tournament_applications ta
         JOIN tournaments t ON t.tournament_id = ta.tournament_id
         WHERE ta.team_id = ? AND ta.tournament_application_status IN ('pending', 'approved')
           AND (? IS NULL OR EXISTS (SELECT 1 FROM application_players ap
                                      WHERE ap.tournament_application_id = ta.tournament_application_id
                                        AND ap.user_id = ?))`,
        [teamId, userId ?? null, userId ?? null]
    );
    return rows;
}

/** คนออกจากทีม → ตัดชื่อออกจากรายชื่อที่ส่งลงแข่งของใบสมัครที่ยังมีชีวิต */
export async function deletePlayerFromLiveSquads(teamId: number, userId: number): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
        `DELETE ap FROM application_players ap
         JOIN tournament_applications ta ON ta.tournament_application_id = ap.tournament_application_id
         WHERE ta.team_id = ? AND ap.user_id = ? AND ta.tournament_application_status IN ('pending', 'approved')`,
        [teamId, userId]
    );
    return result.affectedRows;
}

/** ลบทีม → ปลดล็อกผู้เล่นทุกคนของทีมนั้นในทุกใบสมัครที่ยังมีชีวิต */
export async function deleteAllPlayersOfTeamSquads(teamId: number): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
        `DELETE ap FROM application_players ap
         JOIN tournament_applications ta ON ta.tournament_application_id = ap.tournament_application_id
         WHERE ta.team_id = ? AND ta.tournament_application_status IN ('pending', 'approved')`,
        [teamId]
    );
    return result.affectedRows;
}