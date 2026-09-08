import pool from '../config/db.js';
import type { TournamentRow } from '../types/db.js';
import type { RowDataPacket } from 'mysql2';

export async function findTournamentById(id: number): Promise<TournamentRow | null> {
    const [rows] = await pool.query<(TournamentRow & RowDataPacket)[]>(
        "SELECT * FROM tournaments WHERE tournament_id=?",
        [id]
    );
    const tournament = rows[0];
    return tournament ?? null;
}
