import pool from '../config/db.js';
import type { MatchRow, TournamentRefereeRow } from '../types/db.js';
import type { RowDataPacket } from 'mysql2';

export async function findById(matchId : number): Promise<MatchRow | null>{
    const [rows] = await pool.query<(MatchRow & RowDataPacket)[]>(
        'SELECT * FROM matches WHERE match_id = ?', [matchId]);
    return rows[0] ?? null;
}

/** แมตช์ตาม id ที่อยู่ในทัวร์นี้จริง — ใช้เช็คตอน F01 ว่า ORG แนบแมตช์ของทัวร์ตัวเองมา */
export async function findByIdsInTournament(tournamentId : number, matchIds : number[]): Promise<MatchRow[]>{
    if(matchIds.length === 0) return [];
    const [rows] = await pool.query<(MatchRow & RowDataPacket)[]>(
        'SELECT * FROM matches WHERE tournament_id = ? AND match_id IN (?) ORDER BY scheduled_time, match_id',
        [tournamentId, matchIds]);
    return rows;
}

export type MatchRefereeCoverageRow =
    Pick<MatchRow, 'match_id' | 'round_number' | 'scheduled_time' | 'scheduled_end_time' | 'mode' | 'match_status'> & {
        // NULL ทั้งชุดถ้าแมตช์ยังไม่มีใครรับ
        tournament_referee_id : number | null,
        user_id : number | null,
        invitation_status : TournamentRefereeRow['invitation_status'] | null,
        is_external : TournamentRefereeRow['is_external'] | null,
        external_approval_status : TournamentRefereeRow['external_approval_status'] | null,
        removed_at : Date | null
    };

/**
 * ทุกแมตช์ของทัวร์ × กรรมการที่รับแมตช์นั้นแล้ว (1 แถวต่อคู่ แมตช์ที่ไม่มีใครรับได้ 1 แถว NULL)
 * ★ ไม่ตัดสิน active ที่นี่ — service ใช้ isActiveReferee()
 */
export async function findRefereeCoverage(tournamentId : number): Promise<MatchRefereeCoverageRow[]>{
    const [rows] = await pool.query<(MatchRefereeCoverageRow & RowDataPacket)[]>(
        `SELECT m.match_id, m.round_number, m.scheduled_time, m.scheduled_end_time, m.mode, m.match_status,
                tr.tournament_referee_id, tr.user_id,
                tr.invitation_status, tr.is_external, tr.external_approval_status, tr.removed_at
         FROM matches m
         LEFT JOIN match_referees mr
           ON mr.match_id = m.match_id AND mr.assignment_status = 'accepted'
         LEFT JOIN tournament_referees tr
           ON tr.tournament_referee_id = mr.tournament_referee_id
         WHERE m.tournament_id = ?
         ORDER BY m.scheduled_time, m.match_id, tr.tournament_referee_id`, [tournamentId]);
    return rows;
}
