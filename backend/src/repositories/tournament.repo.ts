import pool from '../config/db.js';
import type { TournamentRow } from '../types/db.js';
import type { RowDataPacket } from 'mysql2';

export async function findById(tournamentId : number): Promise<TournamentRow | null>{
    const [rows] = await pool.query<(TournamentRow & RowDataPacket)[]>(
        'SELECT * FROM tournaments WHERE tournament_id = ? AND deleted_at IS NULL', [tournamentId]);
    return rows[0] ?? null;
}