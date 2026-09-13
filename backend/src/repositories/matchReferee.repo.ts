import pool from '../config/db.js';
import type { MatchRefereeRow, MatchRow, TournamentRefereeRow, UserRow } from '../types/db.js';
import type { RowDataPacket, ResultSetHeader, Pool, PoolConnection } from 'mysql2/promise';

/** ตัวรัน query — ปกติคือ pool แต่ถ้าอยู่ในทรานแซกชันของ repo อื่นจะส่ง connection มาแทน */
export type Queryable = Pool | PoolConnection;

export type MatchRefereeListRow =
    Pick<MatchRefereeRow, 'match_referee_id' | 'tournament_referee_id' | 'assignment_status'> &
    Pick<TournamentRefereeRow, 'invitation_status' | 'is_external' | 'external_approval_status' | 'removed_at'> &
    Pick<UserRow, 'user_id' | 'full_name' | 'profile_image_key'>;

/** แมตช์ที่ผูกกับคำเชิญ 1 ใบ — ใช้ทั้งแสดงให้ ref ดู (F04) และเช็คตอน accept (F05) */
export type InvitedMatchRow =
    Pick<MatchRefereeRow, 'match_referee_id' | 'tournament_referee_id' | 'assignment_status'> &
    Pick<MatchRow, 'match_id' | 'round_number' | 'scheduled_time' | 'scheduled_end_time' | 'venue' | 'mode' | 'match_status'>;

/** F11 — ORG ใส่ตรง ๆ ถือว่ารับแล้ว (จะถูกแทนด้วยคำขอ R02 ในอนาคต) */
export async function assign(matchId : number, tournamentRefereeId : number): Promise<number>{
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO match_referees (match_id, tournament_referee_id, assignment_status, responded_at)
         VALUES (?, ?, 'accepted', NOW())`,
        [matchId, tournamentRefereeId]);
    return result.insertId;
}

/** F01 — แนบแมตช์มากับคำเชิญ (pending) — เรียกในทรานแซกชันเดียวกับการสร้าง tournament_referees */
export async function insertPending(db : Queryable, tournamentRefereeId : number, matchIds : number[]): Promise<void>{
    if(matchIds.length === 0) return;
    await db.query(
        'INSERT INTO match_referees (match_id, tournament_referee_id) VALUES ?',
        [matchIds.map(id => [id, tournamentRefereeId])]);
}

/** F05 — ref เลือกแมตช์: ที่เลือก → accepted, ที่เหลือ → declined (แตะเฉพาะแถวที่ยัง pending) */
export async function respond(db : Queryable, tournamentRefereeId : number, acceptedMatchIds : number[]): Promise<void>{
    if(acceptedMatchIds.length > 0){
        await db.query(
            `UPDATE match_referees SET assignment_status = 'accepted', responded_at = NOW()
             WHERE tournament_referee_id = ? AND assignment_status = 'pending' AND match_id IN (?)`,
            [tournamentRefereeId, acceptedMatchIds]);
    }
    await db.query(
        `UPDATE match_referees SET assignment_status = 'declined', responded_at = NOW()
         WHERE tournament_referee_id = ? AND assignment_status = 'pending'`,
        [tournamentRefereeId]);
}

/** F06 — ปฏิเสธทั้งคำเชิญ → แมตช์ที่เสนอมาทั้งหมด declined */
export async function declineAll(db : Queryable, tournamentRefereeId : number): Promise<void>{
    await respond(db, tournamentRefereeId, []);
}

/** แมตช์ทั้งหมดที่ผูกกับคำเชิญเหล่านี้ (ทุกสถานะ) — เรียงตามเวลาแข่ง */
export async function findByTournamentReferees(tournamentRefereeIds : number[]): Promise<InvitedMatchRow[]>{
    if(tournamentRefereeIds.length === 0) return [];
    const [rows] = await pool.query<(InvitedMatchRow & RowDataPacket)[]>(
        `SELECT mr.match_referee_id, mr.tournament_referee_id, mr.assignment_status,
                m.match_id, m.round_number, m.scheduled_time, m.scheduled_end_time, m.venue, m.mode, m.match_status
         FROM match_referees mr
         JOIN matches m ON m.match_id = mr.match_id
         WHERE mr.tournament_referee_id IN (?)
         ORDER BY m.scheduled_time, m.match_id`, [tournamentRefereeIds]);
    return rows;
}

/**
 * F12 — แถวที่ ref รับแมตช์แล้ว พร้อมสถานะฝั่งทัวร์
 * ★ ไม่กรอง active ที่นี่ — service ใช้ isActiveReferee() ตัดสิน (external ที่ admin ยังไม่อนุมัติต้องไม่โชว์)
 */
export async function findByMatch(matchId : number): Promise<MatchRefereeListRow[]>{
    const [rows] = await pool.query<(MatchRefereeListRow & RowDataPacket)[]>(
        `SELECT mr.match_referee_id, mr.tournament_referee_id, mr.assignment_status,
                tr.invitation_status, tr.is_external, tr.external_approval_status, tr.removed_at,
                u.user_id, u.full_name, u.profile_image_key
         FROM match_referees mr
         JOIN tournament_referees tr ON tr.tournament_referee_id = mr.tournament_referee_id
         JOIN users u ON u.user_id = tr.user_id
         WHERE mr.match_id = ?
           AND mr.assignment_status = 'accepted'
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
