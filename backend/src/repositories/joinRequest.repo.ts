import pool from '../config/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { TeamJoinRequestRow, UserRow } from '../types/db.js';

/** คำขอเข้าร่วมทีมสาธารณะ (migration 017) — มติ 20 ก.ย. 2569 */

export type JoinRequestWithUser = TeamJoinRequestRow & Pick<UserRow, 'full_name' | 'profile_image_key'>;
export type JoinRequestWithTeam = TeamJoinRequestRow & { team_name : string; sport_type_id : number };

export async function findById(requestId : number): Promise<TeamJoinRequestRow | null>{
    const [rows] = await pool.query<(TeamJoinRequestRow & RowDataPacket)[]>(
        'SELECT * FROM team_join_requests WHERE team_join_request_id = ?', [requestId]);
    return rows[0] ?? null;
}

export async function findPendingByTeamAndUser(teamId : number , userId : number): Promise<TeamJoinRequestRow | null>{
    const [rows] = await pool.query<(TeamJoinRequestRow & RowDataPacket)[]>(
        `SELECT * FROM team_join_requests WHERE team_id = ? AND user_id = ? AND team_join_request_status = 'pending' LIMIT 1`,
        [teamId, userId]);
    return rows[0] ?? null;
}

export async function create(teamId : number , userId : number , message : string | null): Promise<number>{
    const [result] = await pool.query<ResultSetHeader>(
        'INSERT INTO team_join_requests (team_id, user_id, message) VALUES (?, ?, ?)', [teamId, userId, message]);
    return result.insertId;
}

/** T21 — คำขอที่รอหัวหน้าทีมตอบ พร้อมชื่อผู้ขอ */
export async function findPendingByTeam(teamId : number): Promise<JoinRequestWithUser[]>{
    const [rows] = await pool.query<(JoinRequestWithUser & RowDataPacket)[]>(
        `SELECT r.*, u.full_name, u.profile_image_key
         FROM team_join_requests r JOIN users u ON u.user_id = r.user_id
         WHERE r.team_id = ? AND r.team_join_request_status = 'pending'
         ORDER BY r.created_at`, [teamId]);
    return rows;
}

/** T24 — คำขอของฉัน (ทุกสถานะ ล่าสุดก่อน) */
export async function findByUser(userId : number): Promise<JoinRequestWithTeam[]>{
    const [rows] = await pool.query<(JoinRequestWithTeam & RowDataPacket)[]>(
        `SELECT r.*, t.name AS team_name, t.sport_type_id
         FROM team_join_requests r JOIN teams t ON t.team_id = r.team_id
         WHERE r.user_id = ?
         ORDER BY r.created_at DESC`, [userId]);
    return rows;
}

/** เปลี่ยนสถานะเฉพาะเมื่อยัง pending — คืน false ถ้ามีคนตอบไปก่อน */
export async function settle(requestId : number , status : 'rejected' | 'cancelled' , respondedBy : number | null , reason : string | null): Promise<boolean>{
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE team_join_requests SET team_join_request_status = ?, responded_at = NOW(), responded_by = ?, reject_reason = ?
         WHERE team_join_request_id = ? AND team_join_request_status = 'pending'`,
        [status, respondedBy, reason, requestId]);
    return result.affectedRows === 1;
}

/**
 * T22 — อนุมัติ: ใส่สมาชิก + คำนวณ Ready + ปิดคำขอ ในทรานแซกชันเดียว (โครงเดียวกับ invitation.repo.createAcceptInvite)
 * คืน false ถ้าคำขอไม่ใช่ pending แล้ว
 */
export async function approve(requestId : number , teamId : number , userId : number , respondedBy : number): Promise<boolean>{
    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();
        const [upd] = await conn.query<ResultSetHeader>(
            `UPDATE team_join_requests SET team_join_request_status = 'approved', responded_at = NOW(), responded_by = ?
             WHERE team_join_request_id = ? AND team_join_request_status = 'pending'`, [respondedBy, requestId]);
        if(upd.affectedRows === 0){
            await conn.rollback();
            return false;
        }
        await conn.query<ResultSetHeader>('INSERT INTO team_members (team_id, user_id) VALUES (?, ?)', [teamId, userId]);
        const [count] = await conn.query<({ c : number } & RowDataPacket)[]>('SELECT COUNT(*) AS c FROM team_members WHERE team_id = ?', [teamId]);
        const [min] = await conn.query<({ min_members : number } & RowDataPacket)[]>(
            `SELECT s.min_members FROM sport_types s JOIN teams t ON t.sport_type_id = s.sport_type_id WHERE t.team_id = ?`, [teamId]);
        if(count[0]!.c >= min[0]!.min_members){
            await conn.query<ResultSetHeader>(`UPDATE teams SET readiness_status = 'Ready', updated_at = NOW() WHERE team_id = ?`, [teamId]);
        }
        await conn.commit();
        return true;
    }catch(err){
        await conn.rollback();
        throw err;
    }finally{
        conn.release();
    }
}
