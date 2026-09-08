import pool from '../config/db.js';
import type { TournamentRefereeRow } from '../types/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

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