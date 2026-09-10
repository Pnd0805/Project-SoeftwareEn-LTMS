import pool from '../config/db.js';
import type { MatchRefereeRow, UserRow } from '../types/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export type MatchRefereeListRow =
    Pick<MatchRefereeRow, 'match_referee_id' | 'tournament_referee_id'> &
    Pick<UserRow, 'user_id' | 'full_name' | 'profile_image_key'>;

export async function assign(matchId : number, tournamentRefereeId : number): Promise<number>{
    const [result] = await pool.query<ResultSetHeader>(
        'INSERT INTO match_referees (match_id, tournament_referee_id) VALUES (?, ?)',
        [matchId, tournamentRefereeId]);
    return result.insertId;
}

export async function findByMatch(matchId : number): Promise<MatchRefereeListRow[]>{
    const [rows] = await pool.query<(MatchRefereeListRow & RowDataPacket)[]>(
        `SELECT mr.match_referee_id, mr.tournament_referee_id,
                u.user_id, u.full_name, u.profile_image_key
         FROM match_referees mr
         JOIN tournament_referees tr ON tr.tournament_referee_id = mr.tournament_referee_id
         JOIN users u ON u.user_id = tr.user_id
         WHERE mr.match_id = ? AND tr.removed_at IS NULL
         ORDER BY mr.match_referee_id`, [matchId]);
    return rows;
}

/** ถอดออกจากแมตช์ — hard delete (ตารางนี้ไม่มี removed_at) */
export async function unassign(matchId : number, tournamentRefereeId : number): Promise<boolean>{
    const [result] = await pool.query<ResultSetHeader>(
        'DELETE FROM match_referees WHERE match_id = ? AND tournament_referee_id = ?',
        [matchId, tournamentRefereeId]);
    return result.affectedRows === 1;
}