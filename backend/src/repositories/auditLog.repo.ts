import type { RowDataPacket } from 'mysql2';
import pool from '../config/db.js';
import type { AuditLogRow } from '../types/db.js';

// C2 — GET /admin/audit-logs
export type getAuditLog = Pick<AuditLogRow , 'audit_log_id' | 'action_type' | 'entity_type' | 'entity_id' | 'details' | 'created_at'> &
                           { actor_user_id : number , actor_full_name : string };

export async function findAuditLogs(
    filters : { entityType? : string | undefined; entityId? : number | undefined; userId? : number | undefined; actionType? : string | undefined },
    offset : number , pageSize : number
) : Promise<{ rows : getAuditLog[]; totalItems : number }>{
    const where : string[] = [];
    const params : unknown[] = [];
    if(filters.entityType){ where.push('l.entity_type = ?'); params.push(filters.entityType); }
    if(filters.entityId !== undefined){ where.push('l.entity_id = ?'); params.push(filters.entityId); }
    if(filters.userId !== undefined){ where.push('l.user_id = ?'); params.push(filters.userId); }
    if(filters.actionType){ where.push('l.action_type = ?'); params.push(filters.actionType); }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [ rows ] = await pool.query<(getAuditLog & RowDataPacket)[]>(
        `SELECT l.audit_log_id , l.action_type , l.entity_type , l.entity_id , l.details , l.created_at,
                u.user_id AS actor_user_id , u.full_name AS actor_full_name
           FROM audit_logs l JOIN users u ON u.user_id = l.user_id
          ${whereSql}
          ORDER BY l.audit_log_id DESC LIMIT ? OFFSET ?`, [...params , pageSize , offset]);
    const [ count ] = await pool.query<({ totalItems : number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS totalItems FROM audit_logs l ${whereSql}`, params);

    return { rows , totalItems : Number(count[0]?.totalItems ?? 0) };
}

export async function insertAuditLog(userId : number , actionType : string , entityType : string , entityId : number , details : unknown) : Promise<void>{
    await pool.query(`INSERT INTO audit_logs(user_id , action_type , entity_type , entity_id , details) VALUES(? , ? , ? , ? , ?)`,
        [userId , actionType , entityType , entityId , details === undefined ? null : JSON.stringify(details)]);
}
