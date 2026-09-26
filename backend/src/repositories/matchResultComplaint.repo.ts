import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/db.js';
import type { MatchResultComplaintRow } from '../types/db.js';

/**
 * OD-26 ข้อ 8 — เรื่องร้องเรียนผลแมตช์ (migration 028)
 * ตารางนี้ไม่แตะ `matches.match_status` และไม่แตะ `match_results` เลย ทัวร์จึงเดินต่อและปิดได้ปกติ
 * นาฬิกาเรือนเดียวคือ `created_at` — เลย ORG_RESOLVE_HOURS แล้วแอดมินมหาวิทยาลัยเข้ามาตัดสินได้
 */

export type ComplaintDetailRow = MatchResultComplaintRow & {
    filed_by_name : string | null,
    statement_by_name : string | null,
    decided_by_name : string | null,
    tournament_id : number
};

const DETAIL_SELECT = `
    SELECT c.* ,
           f.full_name AS filed_by_name ,
           s.full_name AS statement_by_name ,
           d.full_name AS decided_by_name ,
           m.tournament_id
      FROM match_result_complaints c
      JOIN matches m ON m.match_id = c.match_id
      LEFT JOIN users f ON f.user_id = c.filed_by
      LEFT JOIN users s ON s.user_id = c.organizer_statement_by
      LEFT JOIN users d ON d.user_id = c.decided_by`;

export async function findById(complaintId : number): Promise<ComplaintDetailRow | null>{
    const [ rows ] = await pool.query<(ComplaintDetailRow & RowDataPacket)[]>(
        `${DETAIL_SELECT} WHERE c.match_result_complaint_id = ?`, [complaintId]);
    return rows[0] ?? null;
}

export async function findByMatchId(matchId : number): Promise<ComplaintDetailRow[]>{
    const [ rows ] = await pool.query<(ComplaintDetailRow & RowDataPacket)[]>(
        `${DETAIL_SELECT} WHERE c.match_id = ? ORDER BY c.created_at DESC`, [matchId]);
    return rows;
}

export async function findOpenByResultAndFiler(matchResultId : number , filedBy : number): Promise<MatchResultComplaintRow | null>{
    const [ rows ] = await pool.query<(MatchResultComplaintRow & RowDataPacket)[]>(
        `SELECT * FROM match_result_complaints WHERE match_result_id = ? AND filed_by = ?`, [matchResultId , filedBy]);
    return rows[0] ?? null;
}

/** จำนวนเรื่องที่ยังไม่ถูกตัดสิน — ใช้ติดธงให้ FE ว่าทัวร์นี้ยังมีเรื่องค้าง (มติ 27 ก.ย.) */
export async function countOpenByTournament(tournamentId : number): Promise<number>{
    const [ rows ] = await pool.query<({ n : number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS n
           FROM match_result_complaints c JOIN matches m ON m.match_id = c.match_id
          WHERE m.tournament_id = ? AND c.complaint_status = 'open'`, [tournamentId]);
    return Number(rows[0]?.n ?? 0);
}

export type ComplaintInput = {
    reason : string,
    claimedWinnerTeamId : number | null,
    claimedScore : Record<string , number> | null,
    evidenceKeys : string[] | null
};

/** ยื่นใหม่ · ยื่นซ้ำของคนเดิมต่อผลเดิม = แก้ของเดิม (UNIQUE uq_complaint_result_filer) */
export async function fileComplaint(matchId : number , matchResultId : number , filedBy : number , input : ComplaintInput): Promise<number>{
    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();
        const [ res ] = await conn.query<ResultSetHeader>(
            `INSERT INTO match_result_complaints
                 (match_id , match_result_id , filed_by , reason , claimed_winner_team_id , claimed_score , evidence)
             VALUES (? , ? , ? , ? , ? , ? , ?)
             ON DUPLICATE KEY UPDATE
                 reason = VALUES(reason) , claimed_winner_team_id = VALUES(claimed_winner_team_id) ,
                 claimed_score = VALUES(claimed_score) , evidence = VALUES(evidence) , updated_at = NOW()`,
            [matchId , matchResultId , filedBy , input.reason , input.claimedWinnerTeamId ,
             input.claimedScore === null ? null : JSON.stringify(input.claimedScore),
             input.evidenceKeys === null ? null : JSON.stringify(input.evidenceKeys)]);

        // insertId เป็น 0 เมื่อ ON DUPLICATE KEY ไม่ได้แทรกแถวใหม่ — ต้องอ่าน id ของแถวเดิม
        let complaintId = res.insertId;
        if(!complaintId){
            const [ rows ] = await conn.query<({ id : number } & RowDataPacket)[]>(
                `SELECT match_result_complaint_id AS id FROM match_result_complaints WHERE match_result_id = ? AND filed_by = ?`,
                [matchResultId , filedBy]);
            complaintId = rows[0]!.id;
        }

        await conn.query<ResultSetHeader>(
            `INSERT INTO audit_logs (user_id , action_type , entity_type , entity_id , details)
             VALUES (? , 'match_result_complaint_filed' , 'match' , ? , ?)`,
            [filedBy , matchId , JSON.stringify({ complaintId , matchResultId , reason : input.reason })]);

        await conn.commit();
        return complaintId;
    }catch(err){
        await conn.rollback();
        throw err;
    }finally{
        conn.release();
    }
}

/** ผู้จัดแนบความเห็น — เขียนทับของเดิมได้ แต่ปัดตกไม่ได้ (ไม่มีทางเปลี่ยน complaint_status จากที่นี่) */
export async function attachOrganizerStatement(complaintId : number , userId : number , statement : string): Promise<boolean>{
    const [ res ] = await pool.query<ResultSetHeader>(
        `UPDATE match_result_complaints
            SET organizer_statement = ? , organizer_statement_by = ? , organizer_statement_at = NOW() , updated_at = NOW()
          WHERE match_result_complaint_id = ? AND complaint_status = 'open'`,
        [statement , userId , complaintId]);
    return res.affectedRows > 0;
}

export type DecisionInput = {
    outcome : 'upheld' | 'no_merit',
    remedy : 'record_only' | 'amend_result',
    note : string
};

/**
 * แอดมินตัดสิน — `filer_flagged` ติดเฉพาะเมื่อไม่มีมูล (บันทึกเฉพาะคนยื่น ไม่บันทึก ORG/กรรมการ)
 * การแก้ผลจริง (remedy = amend_result) ทำผ่านเส้นทาง amend เดิมที่ service เรียกก่อนหน้านี้แล้ว
 */
export async function decideComplaint(complaintId : number , matchId : number , userId : number , input : DecisionInput): Promise<boolean>{
    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();
        const [ res ] = await conn.query<ResultSetHeader>(
            `UPDATE match_result_complaints
                SET complaint_status = ? , remedy = ? , decision_note = ? , decided_by = ? , decided_at = NOW() ,
                    filer_flagged = ? , updated_at = NOW()
              WHERE match_result_complaint_id = ? AND complaint_status = 'open'`,
            [input.outcome , input.remedy , input.note , userId , input.outcome === 'no_merit' , complaintId]);

        if(res.affectedRows > 0){
            await conn.query<ResultSetHeader>(
                `INSERT INTO audit_logs (user_id , action_type , entity_type , entity_id , details)
                 VALUES (? , 'match_result_complaint_decided' , 'match' , ? , ?)`,
                [userId , matchId , JSON.stringify({ complaintId , outcome : input.outcome , remedy : input.remedy , note : input.note })]);
        }

        await conn.commit();
        return res.affectedRows > 0;
    }catch(err){
        await conn.rollback();
        throw err;
    }finally{
        conn.release();
    }
}
