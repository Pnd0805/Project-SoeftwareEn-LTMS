import pool from '../config/db.js';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { AdminScopeRow, TournamentRow, UserRow } from '../types/db.js';

export type CreateTournamentRecord = {
    name: string;
    sportTypeId: number;
    bracketFormat: NonNullable<TournamentRow['bracket_format']>;
    scopeType: Exclude<TournamentRow['scope_type'], 'university'>;
    organizingFacultyId: number;
    organizingDepartmentId: number | null;
    requestedByUserId: number;
    registrationStart: string;
    registrationEnd: string;
    eventStartDate: string;
    eventEndDate: string;
    maxTeams: number;
    minTeams: number;
    venue: string;
    genderRequirement: TournamentRow['gender_requirement'];
    minAge: number | null;
    maxAge: number | null;
};

export type TournamentRequestRow = Pick<TournamentRow, 'tournament_id' | 'name' | 'tournament_status' | 'rejection_reason' | 'created_at'>;

export type AdminTournamentRequestRow = Pick<TournamentRow, 'tournament_id' | 'name' | 'sport_type_id' | 'event_start_date' | 'created_at'> &
    Pick<UserRow, 'user_id' | 'full_name' | 'profile_image_key'>;

export type AmendmentRow = {
    tournament_amendment_request_id: number;
    tournament_id: number;
    requested_by: number;
    requested_changes: unknown;
    tournament_amendment_request_status: 'pending' | 'approved' | 'rejected';
    requested_at: Date;
    reviewed_by: number | null;
    reviewed_at: Date | null;
    rejection_reason: string | null;
    tournament_name: string;
    tournament_status: TournamentRow['tournament_status'];
    tournament_requested_by_user_id: number;
    tournament_organizing_faculty_id: number | null;
    tournament_event_start_date: string;
    tournament_event_end_date: string | null;
    tournament_registration_start: Date | null;
    tournament_registration_end: Date | null;
    tournament_min_teams: number;
    tournament_max_teams: number;
    tournament_gender_requirement: TournamentRow['gender_requirement'];
    tournament_min_age: number | null;
    tournament_max_age: number | null;
};

export type AdminAmendmentRow = Pick<AmendmentRow, 'tournament_amendment_request_id' | 'tournament_id' | 'requested_changes' | 'tournament_amendment_request_status' | 'requested_at' | 'tournament_name'> &
    Pick<UserRow, 'user_id' | 'full_name' | 'profile_image_key'>;

export async function findTournamentById(id: number): Promise<TournamentRow | null> {
    const [rows] = await pool.query<(TournamentRow & RowDataPacket)[]>(
        'SELECT * FROM tournaments WHERE tournament_id = ? AND deleted_at IS NULL',
        [id]
    );
    return rows[0] ?? null;
}

export async function insertTournament(data: CreateTournamentRecord): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO tournaments
            (name, description, sport_type_id, bracket_format, scope_type,
             organizing_faculty_id, organizing_department_id, requested_by_user_id,
             registration_start, registration_end, event_start_date, event_end_date,
             max_teams, min_teams, venue, gender_requirement, min_age, max_age,
             tournament_status, registration_open)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval', FALSE)`,
        [
            data.name,
            null,
            data.sportTypeId,
            data.bracketFormat,
            data.scopeType,
            data.organizingFacultyId,
            data.organizingDepartmentId,
            data.requestedByUserId,
            data.registrationStart,
            data.registrationEnd,
            data.eventStartDate,
            data.eventEndDate,
            data.maxTeams,
            data.minTeams,
            data.venue,
            data.genderRequirement,
            data.minAge,
            data.maxAge
        ]
    );
    return result.insertId;
}

export async function findMyTournamentRequests(userId: number, offset: number, pageSize: number): Promise<{ rows: TournamentRequestRow[]; totalItems: number }> {
    const [rows] = await pool.query<(TournamentRequestRow & RowDataPacket)[]>(
        `SELECT tournament_id, name, tournament_status, rejection_reason, created_at
         FROM tournaments
         WHERE requested_by_user_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [userId, pageSize, offset]
    );
    const [count] = await pool.query<({ totalItems: number } & RowDataPacket)[]>(
        'SELECT COUNT(*) AS totalItems FROM tournaments WHERE requested_by_user_id = ? AND deleted_at IS NULL',
        [userId]
    );
    return { rows, totalItems: Number(count[0]?.totalItems ?? 0) };
}

function adminScopeWhere(admin: AdminScopeRow): { clause: string; params: number[] } {
    if (admin.scope_type === 'university_wide') return { clause: '', params: [] };
    return { clause: ' AND t.organizing_faculty_id = ?', params: [admin.faculty_id as number] };
}

export async function findPendingTournamentRequests(admin: AdminScopeRow, offset: number, pageSize: number): Promise<{ rows: AdminTournamentRequestRow[]; totalItems: number }> {
    const scope = adminScopeWhere(admin);
    const [rows] = await pool.query<(AdminTournamentRequestRow & RowDataPacket)[]>(
        `SELECT t.tournament_id, t.name, t.sport_type_id, t.event_start_date, t.created_at,
                u.user_id, u.full_name, u.profile_image_key
         FROM tournaments t
         JOIN users u ON u.user_id = t.requested_by_user_id
         WHERE t.tournament_status = 'pending_approval' AND t.deleted_at IS NULL${scope.clause}
         ORDER BY t.created_at ASC LIMIT ? OFFSET ?`,
        [...scope.params, pageSize, offset]
    );
    const [count] = await pool.query<({ totalItems: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS totalItems
         FROM tournaments t
         WHERE t.tournament_status = 'pending_approval' AND t.deleted_at IS NULL${scope.clause}`,
        scope.params
    );
    return { rows, totalItems: Number(count[0]?.totalItems ?? 0) };
}

export type PublicTournamentFilters = {
    sportTypeId?: number | undefined;
    facultyId?: number | undefined;
    query?: string | undefined;
};

export async function findPublicTournaments(filters: PublicTournamentFilters, offset: number, pageSize: number): Promise<{ rows: TournamentRow[]; totalItems: number }> {
    const where = ["t.tournament_status = 'public'", 't.deleted_at IS NULL'];
    const params: Array<number | string> = [];
    if (filters.sportTypeId !== undefined) {
        where.push('t.sport_type_id = ?');
        params.push(filters.sportTypeId);
    }
    if (filters.facultyId !== undefined) {
        where.push('t.organizing_faculty_id = ?');
        params.push(filters.facultyId);
    }
    if (filters.query !== undefined) {
        where.push('t.name LIKE ?');
        params.push(`%${filters.query}%`);
    }
    const whereSql = where.join(' AND ');
    const [rows] = await pool.query<(TournamentRow & RowDataPacket)[]>(
        `SELECT t.* FROM tournaments t WHERE ${whereSql}
         ORDER BY t.event_start_date ASC, t.tournament_id DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
    );
    const [count] = await pool.query<({ totalItems: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS totalItems FROM tournaments t WHERE ${whereSql}`,
        params
    );
    return { rows, totalItems: Number(count[0]?.totalItems ?? 0) };
}

export async function countApprovedTeams(tournamentId: number): Promise<number> {
    const [rows] = await pool.query<({ total: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS total
         FROM tournament_applications
         WHERE tournament_id = ? AND tournament_application_status = 'approved'`,
        [tournamentId]
    );
    return Number(rows[0]?.total ?? 0);
}

export async function countApprovedTeamsInConnection(conn: PoolConnection, tournamentId: number): Promise<number> {
    const [rows] = await conn.query<({ total: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS total
         FROM tournament_applications
         WHERE tournament_id = ? AND tournament_application_status = 'approved'`,
        [tournamentId]
    );
    return Number(rows[0]?.total ?? 0);
}

export async function findTournamentOrganizer(tournamentId: number): Promise<Pick<UserRow, 'user_id' | 'full_name' | 'profile_image_key'> | null> {
    const [rows] = await pool.query<(Pick<UserRow, 'user_id' | 'full_name' | 'profile_image_key'> & RowDataPacket)[]>(
        `SELECT u.user_id, u.full_name, u.profile_image_key
         FROM users u JOIN tournaments t ON t.requested_by_user_id = u.user_id
         WHERE t.tournament_id = ? AND t.deleted_at IS NULL`,
        [tournamentId]
    );
    return rows[0] ?? null;
}

export async function updateTournamentGeneral(tournamentId: number, userId: number, changes: { venue?: string | undefined; description?: string | null | undefined }): Promise<boolean> {
    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    if (changes.venue !== undefined) {
        fields.push('venue = ?');
        values.push(changes.venue);
    }
    if (changes.description !== undefined) {
        fields.push('description = ?');
        values.push(changes.description);
    }
    if (fields.length === 0) return false;
    fields.push('updated_at = NOW()', 'updated_by = ?');
    values.push(userId, tournamentId);
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE tournaments SET ${fields.join(', ')} WHERE tournament_id = ? AND deleted_at IS NULL`,
        values
    );
    return result.affectedRows === 1;
}

export async function insertAmendmentRequest(tournamentId: number, userId: number, changes: Record<string, unknown>): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO tournament_amendment_requests
            (tournament_id, requested_by, requested_changes)
         VALUES (?, ?, ?)`,
        [tournamentId, userId, JSON.stringify(changes)]
    );
    return result.insertId;
}

export async function findAmendmentById(id: number): Promise<AmendmentRow | null> {
    const [rows] = await pool.query<(AmendmentRow & RowDataPacket)[]>(
        `SELECT ar.tournament_amendment_request_id, ar.tournament_id, ar.requested_by,
                ar.requested_changes, ar.tournament_amendment_request_status,
                ar.requested_at, ar.reviewed_by, ar.reviewed_at, ar.rejection_reason,
                t.name AS tournament_name, t.tournament_status,
                t.requested_by_user_id AS tournament_requested_by_user_id,
                t.organizing_faculty_id AS tournament_organizing_faculty_id,
                t.event_start_date AS tournament_event_start_date,
                t.event_end_date AS tournament_event_end_date,
                t.registration_start AS tournament_registration_start,
                t.registration_end AS tournament_registration_end,
                t.min_teams AS tournament_min_teams, t.max_teams AS tournament_max_teams,
                t.gender_requirement AS tournament_gender_requirement,
                t.min_age AS tournament_min_age, t.max_age AS tournament_max_age
         FROM tournament_amendment_requests ar
         JOIN tournaments t ON t.tournament_id = ar.tournament_id
         WHERE ar.tournament_amendment_request_id = ? AND t.deleted_at IS NULL`,
        [id]
    );
    return rows[0] ?? null;
}

export async function findPendingAmendments(admin: AdminScopeRow, offset: number, pageSize: number): Promise<{ rows: AdminAmendmentRow[]; totalItems: number }> {
    const scope = adminScopeWhere(admin);
    const [rows] = await pool.query<(AdminAmendmentRow & RowDataPacket)[]>(
        `SELECT ar.tournament_amendment_request_id, ar.tournament_id, ar.requested_changes,
                ar.tournament_amendment_request_status, ar.requested_at,
                t.name AS tournament_name,
                u.user_id, u.full_name, u.profile_image_key
         FROM tournament_amendment_requests ar
         JOIN tournaments t ON t.tournament_id = ar.tournament_id
         JOIN users u ON u.user_id = ar.requested_by
         WHERE ar.tournament_amendment_request_status = 'pending'
           AND t.deleted_at IS NULL${scope.clause}
         ORDER BY ar.requested_at ASC LIMIT ? OFFSET ?`,
        [...scope.params, pageSize, offset]
    );
    const [count] = await pool.query<({ totalItems: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS totalItems
         FROM tournament_amendment_requests ar
         JOIN tournaments t ON t.tournament_id = ar.tournament_id
         WHERE ar.tournament_amendment_request_status = 'pending'
           AND t.deleted_at IS NULL${scope.clause}`,
        scope.params
    );
    return { rows, totalItems: Number(count[0]?.totalItems ?? 0) };
}

async function insertAuditLog(conn: PoolConnection, userId: number, actionType: string, entityType: string, entityId: number, details?: unknown): Promise<void> {
    await conn.query(
        `INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, actionType, entityType, entityId, details === undefined ? null : JSON.stringify(details)]
    );
}

export async function approveTournament(tournamentId: number, adminId: number): Promise<boolean> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.query<ResultSetHeader>(
            `UPDATE tournaments
             SET tournament_status = 'private', approved_by = ?, approved_at = NOW(),
                 updated_at = NOW(), updated_by = ?
             WHERE tournament_id = ? AND tournament_status = 'pending_approval' AND deleted_at IS NULL`,
            [adminId, adminId, tournamentId]
        );
        if (result.affectedRows === 1) {
            await insertAuditLog(conn, adminId, 'tournament_approved', 'tournament', tournamentId);
        }
        await conn.commit();
        return result.affectedRows === 1;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

export async function rejectTournament(tournamentId: number, adminId: number, reason: string): Promise<boolean> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.query<ResultSetHeader>(
            `UPDATE tournaments
             SET tournament_status = 'rejected', rejection_reason = ?,
                 updated_at = NOW(), updated_by = ?
             WHERE tournament_id = ? AND tournament_status = 'pending_approval' AND deleted_at IS NULL`,
            [reason, adminId, tournamentId]
        );
        if (result.affectedRows === 1) {
            await insertAuditLog(conn, adminId, 'tournament_rejected', 'tournament', tournamentId, { reason });
        }
        await conn.commit();
        return result.affectedRows === 1;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

export type AmendmentDecision = 'capacity_conflict' | 'not_found' | 'already_decided' | 'ok';

const amendmentColumns: Record<string, string> = {
    registrationStart: 'registration_start',
    registrationEnd: 'registration_end',
    eventStartDate: 'event_start_date',
    eventEndDate: 'event_end_date',
    minTeams: 'min_teams',
    maxTeams: 'max_teams',
    genderRequirement: 'gender_requirement',
    minAge: 'min_age',
    maxAge: 'max_age'
};

export async function approveAmendment(amendmentId: number, adminId: number, changes: Record<string, unknown>): Promise<AmendmentDecision> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [amendments] = await conn.query<(Pick<AmendmentRow, 'tournament_amendment_request_id' | 'tournament_id' | 'tournament_amendment_request_status'> & { max_teams: number } & RowDataPacket)[]>(
            `SELECT ar.tournament_amendment_request_id, ar.tournament_id,
                    ar.tournament_amendment_request_status, t.max_teams
             FROM tournament_amendment_requests ar
             JOIN tournaments t ON t.tournament_id = ar.tournament_id
             WHERE ar.tournament_amendment_request_id = ? AND t.deleted_at IS NULL
             FOR UPDATE`,
            [amendmentId]
        );
        const amendment = amendments[0];
        if (!amendment) {
            await conn.rollback();
            return 'not_found';
        }
        if (amendment.tournament_amendment_request_status !== 'pending') {
            await conn.rollback();
            return 'already_decided';
        }

        const approvedTeams = await countApprovedTeamsInConnection(conn, amendment.tournament_id);
        if (typeof changes.maxTeams === 'number' && changes.maxTeams < approvedTeams) {
            await conn.rollback();
            return 'capacity_conflict';
        }

        const assignments: string[] = [];
        const values: unknown[] = [];
        for (const [key, column] of Object.entries(amendmentColumns)) {
            if (Object.prototype.hasOwnProperty.call(changes, key)) {
                assignments.push(`${column} = ?`);
                values.push(changes[key]);
            }
        }
        assignments.push('updated_at = NOW()', 'updated_by = ?');
        values.push(adminId, amendment.tournament_id);
        await conn.query(`UPDATE tournaments SET ${assignments.join(', ')} WHERE tournament_id = ?`, values);
        await conn.query(
            `UPDATE tournament_amendment_requests
             SET tournament_amendment_request_status = 'approved', reviewed_by = ?, reviewed_at = NOW()
             WHERE tournament_amendment_request_id = ?`,
            [adminId, amendmentId]
        );
        await insertAuditLog(conn, adminId, 'tournament_amendment_approved', 'tournament_amendment_request', amendmentId, { changes });
        await conn.commit();
        return 'ok';
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

export async function rejectAmendment(amendmentId: number, adminId: number, reason: string): Promise<AmendmentDecision> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.query<ResultSetHeader>(
            `UPDATE tournament_amendment_requests
             SET tournament_amendment_request_status = 'rejected', rejection_reason = ?,
                 reviewed_by = ?, reviewed_at = NOW()
             WHERE tournament_amendment_request_id = ? AND tournament_amendment_request_status = 'pending'`,
            [reason, adminId, amendmentId]
        );
        if (result.affectedRows !== 1) {
            const [exists] = await conn.query<RowDataPacket[]>(
                'SELECT tournament_amendment_request_id FROM tournament_amendment_requests WHERE tournament_amendment_request_id = ?',
                [amendmentId]
            );
            await conn.rollback();
            return exists.length === 0 ? 'not_found' : 'already_decided';
        }
        await insertAuditLog(conn, adminId, 'tournament_amendment_rejected', 'tournament_amendment_request', amendmentId, { reason });
        await conn.commit();
        return 'ok';
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

export type PublishDecision =
    | { status: 'not_found' | 'invalid_status' }
    | { status: 'referees_incomplete'; refereesAccepted: number }
    | { status: 'ok' };

export async function publishTournament(tournamentId: number, userId: number): Promise<PublishDecision> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [tournaments] = await conn.query<(Pick<TournamentRow, 'tournament_status'> & RowDataPacket)[]>(
            `SELECT tournament_status
             FROM tournaments
             WHERE tournament_id = ? AND deleted_at IS NULL
             FOR UPDATE`,
            [tournamentId]
        );
        const tournament = tournaments[0];
        if (!tournament) {
            await conn.rollback();
            return { status: 'not_found' };
        }
        if (tournament.tournament_status !== 'private') {
            await conn.rollback();
            return { status: 'invalid_status' };
        }

        const [referees] = await conn.query<({ total: number } & RowDataPacket)[]>(
            `SELECT COUNT(*) AS total
             FROM (
                 SELECT tr.*,
                        ROW_NUMBER() OVER (
                            PARTITION BY tr.user_id
                            ORDER BY tr.tournament_referee_id DESC
                        ) AS row_num
                 FROM tournament_referees tr
                 WHERE tr.tournament_id = ?
             ) latest
             WHERE latest.row_num = 1
               AND latest.removed_at IS NULL
               AND latest.invitation_status = 'accepted'
               AND (latest.is_external = 0 OR latest.external_approval_status = 'approved')`,
            [tournamentId]
        );
        const refereesAccepted = Number(referees[0]?.total ?? 0);
        if (refereesAccepted < 1) {
            await conn.rollback();
            return { status: 'referees_incomplete', refereesAccepted };
        }

        const [result] = await conn.query<ResultSetHeader>(
            `UPDATE tournaments
             SET tournament_status = 'public', updated_at = NOW(), updated_by = ?
             WHERE tournament_id = ? AND tournament_status = 'private'`,
            [userId, tournamentId]
        );
        if (result.affectedRows !== 1) {
            await conn.rollback();
            return { status: 'invalid_status' };
        }
        await conn.commit();
        return { status: 'ok' };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

export async function changeTournamentStatus(tournamentId: number, userId: number, from: TournamentRow['tournament_status'], to: TournamentRow['tournament_status']): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE tournaments
         SET tournament_status = ?, updated_at = NOW(), updated_by = ?
         WHERE tournament_id = ? AND tournament_status = ? AND deleted_at IS NULL`,
        [to, userId, tournamentId, from]
    );
    return result.affectedRows === 1;
}

export async function changeRegistrationState(tournamentId: number, userId: number, open: boolean): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE tournaments
         SET registration_open = ?, updated_at = NOW(), updated_by = ?
         WHERE tournament_id = ? AND tournament_status = 'public'
           AND registration_open = ? AND deleted_at IS NULL`,
        [open, userId, tournamentId, !open]
    );
    return result.affectedRows === 1;
}
