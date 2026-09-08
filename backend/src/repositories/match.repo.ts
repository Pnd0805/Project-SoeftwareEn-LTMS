import pool from '../config/db.js';
import type { MatchRow } from '../types/db.js';
import type { RowDataPacket } from 'mysql2';

export async function findById(matchId : number): Promise<MatchRow | null>{
    const [rows] = await pool.query<(MatchRow & RowDataPacket)[]>(
        'SELECT * FROM matches WHERE match_id = ?', [matchId]);
    return rows[0] ?? null;
}