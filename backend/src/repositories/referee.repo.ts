import pool from '../config/db.js';
import type { TournamentRefereeRow } from '../types/db.js';
import type { RowDataPacket } from 'mysql2';

export async function findLatestTournamentReferee(tournamentId: number, userId: number): Promise<TournamentRefereeRow | null> {
    const [rows] = await pool.query<(TournamentRefereeRow & RowDataPacket)[]>(
        `SELECT * FROM tournament_referees
         WHERE tournament_id = ? AND user_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [tournamentId, userId]
    );
    const referee = rows[0];
    return referee ?? null;
}
