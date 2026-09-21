import type { RowDataPacket , ResultSetHeader} from 'mysql2';
import pool from '../config/db.js';

import type { AdminScopeRow, TeamAdminRequestRow } from '../types/db.js';
import type { getOfficialRequest, getTransferRequest } from '../mappers/adminScope.mapper.js';


export async function findAdminByUserId(userId : number): Promise<AdminScopeRow | null>{
    const [ rows ] = await pool.query<(AdminScopeRow & RowDataPacket)[]>(`SELECT * FROM admin_scopes WHERE user_id = ?`,[userId]);
    return rows[0] ?? null;
}

export async function findAllOfficialRequests(offset: number, pageSize: number): Promise<{ rows: getOfficialRequest[], totalItems: number }> {
    const [ rows ] = await pool.query<(getOfficialRequest & RowDataPacket)[]>(`SELECT req.team_admin_request_id , req.team_admin_request_status , req.requested_at,
                                                                                t.team_id , t.name , t.sport_type_id,
                                                                                u.user_id , u.full_name , u.profile_image_key
                                                                                FROM team_admin_requests req JOIN teams t ON req.team_id = t.team_id
                                                                                JOIN users u ON req.requested_by = u.user_id
                                                                                WHERE request_type = ?
                                                                                LIMIT ? OFFSET ? `,
                                                                                ['official_status' , pageSize , offset]);
    
    const [ count ] = await pool.query<({totalItems : number} & RowDataPacket)[]>(`SELECT count(*) as totalItems
                                                                                FROM team_admin_requests req WHERE request_type = ?`,['official_status']);
    
    return { rows , totalItems : count[0]!.totalItems};

}

// C3 — ลิสต์คำขอโอนหัวหน้าทีมที่รออนุมัติ (คู่กับ findAllOfficialRequests — กรอง request_type ต่างกัน)
export async function findAllTransferRequests(offset: number, pageSize: number): Promise<{ rows: getTransferRequest[], totalItems: number }> {
    const [ rows ] = await pool.query<(getTransferRequest & RowDataPacket)[]>(`SELECT req.team_admin_request_id , req.team_admin_request_status , req.requested_at,
                                                                                t.team_id , t.name , t.sport_type_id,
                                                                                cur.user_id AS current_leader_id , cur.full_name AS current_leader_full_name , cur.profile_image_key AS current_leader_profile_image_key,
                                                                                tgt.user_id AS proposed_leader_id , tgt.full_name AS proposed_leader_full_name , tgt.profile_image_key AS proposed_leader_profile_image_key
                                                                                FROM team_admin_requests req JOIN teams t ON req.team_id = t.team_id
                                                                                JOIN users cur ON req.requested_by = cur.user_id
                                                                                JOIN users tgt ON req.target_user_id = tgt.user_id
                                                                                WHERE req.request_type = ?
                                                                                LIMIT ? OFFSET ? `,
                                                                                ['leader_transfer' , pageSize , offset]);

    const [ count ] = await pool.query<({totalItems : number} & RowDataPacket)[]>(`SELECT count(*) as totalItems
                                                                                FROM team_admin_requests req WHERE request_type = ?`,['leader_transfer']);

    return { rows , totalItems : count[0]!.totalItems};
}

export async function approveTeamOfficial(adminId : number , teamRequestId : number , teamId : number) : Promise<number>{
    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();
        const [ result ] = await conn.query<ResultSetHeader>(`UPDATE teams SET official_status = ? WHERE team_id = ?`,['Official' , teamId]);
        const [ approve ] = await conn.query<ResultSetHeader>(`UPDATE team_admin_requests SET team_admin_request_status = ? , reviewed_by = ? , reviewed_at = NOW()
                                                            WHERE team_admin_request_id = ?`,
                                                            ['approved' , adminId , teamRequestId]);
        await conn.commit();
        return result.affectedRows;
    }catch(err){
        await conn.rollback();
        throw err;
    }finally{
        await conn.release();
    }
}


export async function rejectTeamOfficial(adminId : number , teamReqId : number , reason : string) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(`UPDATE team_admin_requests SET team_admin_request_status = ? , rejection_reason = ? , reviewed_by = ?, reviewed_at = NOW()
                                                          WHERE team_admin_request_id = ?` ,['rejected' , reason , adminId, teamReqId]);
    return result.affectedRows;
}

// C3 — แอดมินโอนหัวหน้าทีมแทนตอนหัวหน้าเดิมหายไป (ไม่ผ่านคิว T19 — แอดมินคือผู้อนุมัติเองอยู่แล้ว)
// ใช้ได้ทั้งทีม Official/Unofficial — Unofficial ไม่มีทางโอนหัวหน้าได้ทางอื่นเลย
// ยัง INSERT ลง team_admin_requests ด้วย (สถานะ 'approved' ทันที) เพื่อให้มี audit trail เดียวกับ T19/T20
export async function transferLeaderByAdmin(adminId : number , teamId : number , newLeaderId : number) : Promise<number>{
    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();
        const [ result ] = await conn.query<ResultSetHeader>(`UPDATE teams SET leader_id = ? WHERE team_id = ?`,[newLeaderId , teamId]);
        await conn.query<ResultSetHeader>(`INSERT INTO team_admin_requests(team_id , request_type , requested_by , target_user_id , team_admin_request_status , reviewed_by , reviewed_at)
                                            VALUES(? , ? , ? , ? , ? , ? , NOW())`,
                                            [teamId , 'leader_transfer' , adminId , newLeaderId , 'approved' , adminId]);
        await conn.commit();
        return result.affectedRows;
    }catch(err){
        await conn.rollback();
        throw err;
    }finally{
        conn.release();
    }
}

// C3 — โอนหัวหน้าทีม (T20) — endpoint นี้เท่านั้นที่ UPDATE teams SET leader_id จริง
export async function approveTransferRequest(adminId : number , teamRequestId : number , teamId : number , newLeaderId : number) : Promise<number>{
    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();
        const [ result ] = await conn.query<ResultSetHeader>(`UPDATE teams SET leader_id = ? WHERE team_id = ?`,[newLeaderId , teamId]);
        await conn.query<ResultSetHeader>(`UPDATE team_admin_requests SET team_admin_request_status = ? , reviewed_by = ? , reviewed_at = NOW()
                                            WHERE team_admin_request_id = ?`,
                                            ['approved' , adminId , teamRequestId]);
        await conn.commit();
        return result.affectedRows;
    }catch(err){
        await conn.rollback();
        throw err;
    }finally{
        conn.release();
    }
}