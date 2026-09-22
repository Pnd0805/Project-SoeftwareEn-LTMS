import type { RowDataPacket , ResultSetHeader } from 'mysql2';
import pool from '../config/db.js';
import type { UserReportRow } from '../types/db.js';

export async function findById(id : number) : Promise<UserReportRow | null>{
    const [ rows ] = await pool.query<(UserReportRow & RowDataPacket)[]>(`SELECT * FROM user_reports WHERE user_report_id = ?`,[id]);
    return rows[0] ?? null;
}

export async function create(reportedBy : number , targetUserId : number , reason : string , evidence : string[]) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(
        `INSERT INTO user_reports(reported_by , target_user_id , reason , evidence) VALUES(? , ? , ? , ?)`,
        [reportedBy , targetUserId , reason , JSON.stringify(evidence)]);
    return result.insertId;
}

export type getUserReport = {
    user_report_id : number , reason : string , evidence : string[] | null , user_report_status : 'pending' | 'approved' | 'rejected' , created_at : Date,
    reporter_id : number , reporter_name : string,
    target_id : number , target_name : string , target_faculty_id : number | null , target_is_admin : number
};

// university_wide (facultyOnly = undefined) เห็นทุกคำร้อง · faculty admin (facultyOnly = faculty_id) เห็นแค่คำร้องที่ target ไม่ใช่แอดมิน และอยู่คณะตัวเอง
export async function findAllUserReports(facultyOnly : number | undefined , offset : number , pageSize : number)
    : Promise<{ rows : getUserReport[]; totalItems : number }>{
    const where : string[] = [];
    const params : unknown[] = [];
    if(facultyOnly !== undefined){
        where.push('ts.admin_scope_id IS NULL AND target.faculty_id = ?');
        params.push(facultyOnly);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [ rows ] = await pool.query<(getUserReport & RowDataPacket)[]>(
        `SELECT r.user_report_id , r.reason , r.evidence , r.user_report_status , r.created_at,
                reporter.user_id AS reporter_id , reporter.full_name AS reporter_name,
                target.user_id AS target_id , target.full_name AS target_name , target.faculty_id AS target_faculty_id,
                (ts.admin_scope_id IS NOT NULL) AS target_is_admin
           FROM user_reports r
           JOIN users reporter ON reporter.user_id = r.reported_by
           JOIN users target ON target.user_id = r.target_user_id
           LEFT JOIN admin_scopes ts ON ts.user_id = r.target_user_id
          ${whereSql}
          ORDER BY r.user_report_id DESC LIMIT ? OFFSET ?`, [...params , pageSize , offset]);
    const [ count ] = await pool.query<({ totalItems : number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS totalItems FROM user_reports r
           JOIN users target ON target.user_id = r.target_user_id
           LEFT JOIN admin_scopes ts ON ts.user_id = r.target_user_id
          ${whereSql}`, params);

    return { rows , totalItems : Number(count[0]?.totalItems ?? 0) };
}

export async function findByIdJoined(id : number) : Promise<getUserReport | null>{
    const [ rows ] = await pool.query<(getUserReport & RowDataPacket)[]>(
        `SELECT r.user_report_id , r.reason , r.evidence , r.user_report_status , r.created_at,
                reporter.user_id AS reporter_id , reporter.full_name AS reporter_name,
                target.user_id AS target_id , target.full_name AS target_name , target.faculty_id AS target_faculty_id,
                (ts.admin_scope_id IS NOT NULL) AS target_is_admin
           FROM user_reports r
           JOIN users reporter ON reporter.user_id = r.reported_by
           JOIN users target ON target.user_id = r.target_user_id
           LEFT JOIN admin_scopes ts ON ts.user_id = r.target_user_id
          WHERE r.user_report_id = ?`,[id]);
    return rows[0] ?? null;
}

export async function updateStatus(id : number , status : 'approved' | 'rejected' , reviewedBy : number , rejectionReason : string | null) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(
        `UPDATE user_reports SET user_report_status = ? , reviewed_by = ? , reviewed_at = NOW() , rejection_reason = ? WHERE user_report_id = ?`,
        [status , reviewedBy , rejectionReason , id]);
    return result.affectedRows;
}
