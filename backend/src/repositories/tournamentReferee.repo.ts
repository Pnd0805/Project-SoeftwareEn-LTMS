import pool from '../config/db.js';
import type { TournamentRefereeRow } from '../types/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { UserRow } from '../types/db.js';
import type { TournamentRow } from '../types/db.js';

/** แถวล่าสุดของ user คนนี้ในทัวร์นี้ — ★ ไม่กรอง removed_at ให้ service ตัดสินเอง */
export async function findLatestByTournamentAndUser(tournamentId : number, userId : number)
        : Promise<TournamentRefereeRow | null>{
    const [rows] = await pool.query<(TournamentRefereeRow & RowDataPacket)[]>(
        `SELECT * FROM tournament_referees
         WHERE tournament_id = ? AND user_id = ?
         ORDER BY tournament_referee_id DESC LIMIT 1`, [tournamentId, userId]);
    return rows[0] ?? null;
}

type NewTournamentReferee = {
    tournamentId : number;
    userId : number;
    invitedBy : number;
    isExternal : boolean;
};

export async function create(data : NewTournamentReferee): Promise<number>{
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO tournament_referees (tournament_id, user_id, invited_by, is_external)
         VALUES (?, ?, ?, ?)`,
        [data.tournamentId, data.userId, data.invitedBy, data.isExternal]);
    return result.insertId;
}

export type TournamentRefereeListRow =
    Pick<TournamentRefereeRow, 'tournament_referee_id' | 'invitation_status' | 'is_external' | 'external_approval_status'> &
    Pick<UserRow, 'user_id' | 'full_name' | 'profile_image_key'>;

/** กรรมการทั้งหมดของทัวร์ — แถวล่าสุดต่อ 1 คน เฉพาะที่ยังไม่ถูกถอด */
export async function findLatestPerUserByTournament(tournamentId : number)
        : Promise<TournamentRefereeListRow[]>{
    const [rows] = await pool.query<(TournamentRefereeListRow & RowDataPacket)[]>(
        `SELECT tr.tournament_referee_id, tr.invitation_status, tr.is_external, tr.external_approval_status,
                u.user_id, u.full_name, u.profile_image_key
         FROM tournament_referees tr
         JOIN ( SELECT user_id, MAX(tournament_referee_id) AS latest_id
                FROM tournament_referees
                WHERE tournament_id = ?
                GROUP BY user_id ) latest
           ON tr.tournament_referee_id = latest.latest_id
         JOIN users u ON u.user_id = tr.user_id
         WHERE tr.removed_at IS NULL
         ORDER BY tr.created_at DESC`, [tournamentId]);
    return rows;
}

export type MyRefereeInvitationRow =
    Pick<TournamentRefereeRow, 'tournament_referee_id' | 'is_external' | 'created_at'> &
    Pick<TournamentRow, 'tournament_id' | 'name' | 'sport_type_id' | 'event_start_date'>;

/** คำเชิญที่ยังรอ user คนนี้ตอบ — แถวล่าสุดต่อ 1 ทัวร์ */
export async function findPendingInvitationsByUser(userId : number)
        : Promise<MyRefereeInvitationRow[]>{
    const [rows] = await pool.query<(MyRefereeInvitationRow & RowDataPacket)[]>(
        `SELECT tr.tournament_referee_id, tr.is_external, tr.created_at,
                t.tournament_id, t.name, t.sport_type_id, t.event_start_date
         FROM tournament_referees tr
         JOIN ( SELECT tournament_id, MAX(tournament_referee_id) AS latest_id
                FROM tournament_referees
                WHERE user_id = ?
                GROUP BY tournament_id ) latest
           ON tr.tournament_referee_id = latest.latest_id
         JOIN tournaments t ON t.tournament_id = tr.tournament_id
         WHERE tr.removed_at IS NULL
           AND tr.invitation_status = 'pending'
           AND t.deleted_at IS NULL
         ORDER BY tr.created_at DESC`, [userId]);
    return rows;
}

export async function findById(tournamentRefereeId : number): Promise<TournamentRefereeRow | null>{
    const [rows] = await pool.query<(TournamentRefereeRow & RowDataPacket)[]>(
        'SELECT * FROM tournament_referees WHERE tournament_referee_id = ?', [tournamentRefereeId]);
    return rows[0] ?? null;
}

/** ตอบรับ — คืน true ถ้าอัปเดตได้จริง (false = มีคนตอบไปก่อนแล้ว) */
export async function accept(tournamentRefereeId : number): Promise<boolean>{
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE tournament_referees
         SET invitation_status = 'accepted',
             external_approval_status = CASE WHEN is_external = 1 THEN 'pending' ELSE 'not_required' END
         WHERE tournament_referee_id = ? AND invitation_status = 'pending' AND removed_at IS NULL`,
        [tournamentRefereeId]);
    return result.affectedRows === 1;
}

export async function decline(tournamentRefereeId : number): Promise<boolean>{
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE tournament_referees SET invitation_status = 'rejected'
         WHERE tournament_referee_id = ? AND invitation_status = 'pending' AND removed_at IS NULL`,
        [tournamentRefereeId]);
    return result.affectedRows === 1;
}