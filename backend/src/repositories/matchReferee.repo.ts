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

/** B7 — แมตช์ที่ user รับเป็นกรรมการแล้ว (accepted) ข้ามทุกทัวร์ · ★ ไม่กรอง active ที่นี่ — service ใช้ isActiveReferee() */
export type MyRefereeMatchRow =
    Pick<MatchRefereeRow, 'match_referee_id' | 'tournament_referee_id'> &
    Pick<TournamentRefereeRow, 'invitation_status' | 'is_external' | 'external_approval_status' | 'removed_at'> &
    Pick<MatchRow, 'match_id' | 'round_number' | 'scheduled_time' | 'scheduled_end_time' | 'venue' | 'mode' | 'match_status'> & {
        tournament_id : number; tournament_name : string; sport_type_id : number;
        team_a_id : number | null; team_a_name : string | null;
        team_b_id : number | null; team_b_name : string | null;
    };

export async function findAcceptedByUser(userId : number): Promise<MyRefereeMatchRow[]>{
    const [rows] = await pool.query<(MyRefereeMatchRow & RowDataPacket)[]>(
        `SELECT mr.match_referee_id, mr.tournament_referee_id,
                tr.invitation_status, tr.is_external, tr.external_approval_status, tr.removed_at,
                m.match_id, m.round_number, m.scheduled_time, m.scheduled_end_time, m.venue, m.mode, m.match_status,
                t.tournament_id, t.name AS tournament_name, t.sport_type_id,
                ta.team_id AS team_a_id, ta.name AS team_a_name,
                tb.team_id AS team_b_id, tb.name AS team_b_name
         FROM match_referees mr
         JOIN tournament_referees tr ON tr.tournament_referee_id = mr.tournament_referee_id
         JOIN matches m ON m.match_id = mr.match_id
         JOIN tournaments t ON t.tournament_id = m.tournament_id
         LEFT JOIN teams ta ON ta.team_id = m.team_a_id
         LEFT JOIN teams tb ON tb.team_id = m.team_b_id
         WHERE tr.user_id = ? AND mr.assignment_status = 'accepted'
         ORDER BY m.scheduled_time IS NULL, m.scheduled_time, m.match_id`, [userId]);
    return rows;
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

/**
 * FR02 apply — ใส่กรรมการเข้าแมตช์แบบ accepted
 * ถ้ามีแถว pending/declined เดิม (เคยถูกเสนอแล้วไม่รับ) จะพลิกเป็น accepted; ถ้า accepted อยู่แล้ว → false
 */
export async function insertAccepted(db : Queryable, matchId : number, tournamentRefereeId : number): Promise<boolean>{
    const [rows] = await db.query<(Pick<MatchRefereeRow, 'match_referee_id' | 'assignment_status'> & RowDataPacket)[]>(
        `SELECT match_referee_id, assignment_status FROM match_referees
         WHERE match_id = ? AND tournament_referee_id = ? FOR UPDATE`, [matchId, tournamentRefereeId]);
    const existing = rows[0];
    if(existing?.assignment_status === 'accepted') return false;

    if(existing){
        await db.query(
            `UPDATE match_referees SET assignment_status = 'accepted', responded_at = NOW()
             WHERE match_referee_id = ?`, [existing.match_referee_id]);
    } else {
        await db.query(
            `INSERT INTO match_referees (match_id, tournament_referee_id, assignment_status, responded_at)
             VALUES (?, ?, 'accepted', NOW())`, [matchId, tournamentRefereeId]);
    }
    return true;
}

/**
 * FR01/FR03 apply — ย้ายแมตช์จากกรรมการ from → to (lock แถวก่อน)
 * คืน false ถ้า from ไม่ได้รับแมตช์นี้อยู่แล้ว (มีคนเปลี่ยนไประหว่างรอตอบ)
 */
export async function reassign(db : Queryable, matchId : number, fromId : number, toId : number): Promise<boolean>{
    const [rows] = await db.query<(Pick<MatchRefereeRow, 'match_referee_id'> & RowDataPacket)[]>(
        `SELECT match_referee_id FROM match_referees
         WHERE match_id = ? AND tournament_referee_id = ? AND assignment_status = 'accepted' FOR UPDATE`,
        [matchId, fromId]);
    const row = rows[0];
    if(!row) return false;

    // to อาจมีแถวเก่า (pending/declined) ในแมตช์นี้ → ลบก่อน ไม่งั้นชน UNIQUE(match_id, tournament_referee_id)
    await db.query('DELETE FROM match_referees WHERE match_id = ? AND tournament_referee_id = ?', [matchId, toId]);
    await db.query(
        `UPDATE match_referees SET tournament_referee_id = ?, responded_at = NOW()
         WHERE match_referee_id = ?`, [toId, row.match_referee_id]);
    return true;
}

/**
 * นับกรรมการที่ใช้งานได้จริงของแมตช์ — ใช้เช็ค BR-11 ตอนส่งผล (S01)
 * ★ หลังเปลี่ยนโฟลว์ (GUIDE/11) ต้องกรอง assignment_status = 'accepted' ด้วย ไม่งั้นนับแถวที่ ref ยังไม่รับ/ปฏิเสธ
 *   และคนนอกนับเฉพาะที่ admin อนุมัติแล้ว (gate เดียวกับ isActiveReferee)
 */
export async function countAcceptedByMatch(matchId : number): Promise<number>{
    const [rows] = await pool.query<(RowDataPacket & { cnt : number })[]>(
        `SELECT COUNT(*) AS cnt
         FROM match_referees mr
         JOIN tournament_referees tr ON tr.tournament_referee_id = mr.tournament_referee_id
         WHERE mr.match_id = ?
           AND mr.assignment_status = 'accepted'
           AND tr.invitation_status = 'accepted' AND tr.removed_at IS NULL
           AND (tr.is_external = 0 OR tr.external_approval_status = 'approved')`,
        [matchId]);
    return rows[0]!.cnt;
}

/** ถอดออกจากแมตช์ — hard delete (ตารางนี้ไม่มี removed_at) */
export async function unassign(matchId : number, tournamentRefereeId : number): Promise<boolean>{
    const [result] = await pool.query<ResultSetHeader>(
        'DELETE FROM match_referees WHERE match_id = ? AND tournament_referee_id = ?',
        [matchId, tournamentRefereeId]);
    return result.affectedRows === 1;
}
