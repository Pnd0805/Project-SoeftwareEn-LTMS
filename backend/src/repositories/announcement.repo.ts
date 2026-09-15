import pool from '../config/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { AnnouncementRow } from '../types/db.js';

export async function create(tournamentId : number , title : string , content : string , createdBy : number): Promise<number>{
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO announcements (tournament_id, created_by, announcement_type, title, content)
         VALUES (?, ?, 'general', ?, ?)`,
        [tournamentId, createdBy, title, content]);
    return result.insertId;
}

export async function findById(announcementId : number): Promise<AnnouncementRow | null>{
    const [rows] = await pool.query<(AnnouncementRow & RowDataPacket)[]>(
        `SELECT * FROM announcements WHERE announcement_id = ? AND deleted_at IS NULL`,
        [announcementId]);
    return rows[0] ?? null;
}

export async function findByTournament(tournamentId : number , offset : number , pageSize : number)
        : Promise<{ rows : AnnouncementRow[] , totalItems : number }>{
    const [rows] = await pool.query<(AnnouncementRow & RowDataPacket)[]>(
        `SELECT * FROM announcements
         WHERE tournament_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [tournamentId, pageSize, offset]);
    const [count] = await pool.query<({ totalItems : number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS totalItems FROM announcements WHERE tournament_id = ? AND deleted_at IS NULL`,
        [tournamentId]);
    return { rows, totalItems : Number(count[0]?.totalItems ?? 0) };
}

export async function update(announcementId : number , changes : { title? : string , content? : string } , updatedBy : number): Promise<boolean>{
    const fields : string[] = [];
    const values : (string | number)[] = [];

    if(changes.title !== undefined){
        fields.push('title = ?');
        values.push(changes.title);
    }
    if(changes.content !== undefined){
        fields.push('content = ?');
        values.push(changes.content);
    }
    if(fields.length === 0) return false;

    fields.push('updated_at = NOW()', 'updated_by = ?');
    values.push(updatedBy, announcementId);

    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE announcements SET ${fields.join(', ')} WHERE announcement_id = ? AND deleted_at IS NULL`,
        values);
    return result.affectedRows === 1;
}

export async function softDelete(announcementId : number , deletedBy : number): Promise<boolean>{
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE announcements SET deleted_at = NOW(), deleted_by = ? WHERE announcement_id = ? AND deleted_at IS NULL`,
        [deletedBy, announcementId]);
    return result.affectedRows === 1;
}
