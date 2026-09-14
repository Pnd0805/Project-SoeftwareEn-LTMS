import type { RowDataPacket , ResultSetHeader} from 'mysql2';
import pool from '../config/db.js';

import type { AdminScopeRow, TeamAdminRequestRow } from '../types/db.js';
import type { getOfficialRequest } from '../mappers/adminScope.mapper.js';


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