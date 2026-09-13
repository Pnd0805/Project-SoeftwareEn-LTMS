import pool from '../config/db.js';
import type { RefereeChangeRequestRow, RefereeRequestType, RefereeRequestSideStatus } from '../types/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import * as MatchRefRepo from './matchReferee.repo.js';

type NewRequest = {
    tournamentId : number;
    type : RefereeRequestType;
    requestedBy : number;
    refereeAId : number;
    refereeBId : number | null;
    matchAId : number;
    matchBId : number | null;
    aStatus : RefereeRequestSideStatus;
    bStatus : RefereeRequestSideStatus;
};

export async function create(data : NewRequest): Promise<number>{
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO referee_change_requests
            (tournament_id, request_type, requested_by, referee_a_id, referee_b_id,
             match_a_id, match_b_id, a_status, b_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.tournamentId, data.type, data.requestedBy, data.refereeAId, data.refereeBId,
         data.matchAId, data.matchBId, data.aStatus, data.bStatus]);
    return result.insertId;
}

export async function findById(requestId : number): Promise<RefereeChangeRequestRow | null>{
    const [rows] = await pool.query<(RefereeChangeRequestRow & RowDataPacket)[]>(
        'SELECT * FROM referee_change_requests WHERE request_id = ?', [requestId]);
    return rows[0] ?? null;
}

/** มีคำขอ open ที่อ้างคู่ (match_a, referee_a) เดียวกันอยู่แล้วไหม — กันส่งซ้ำ */
export async function existsOpenFor(matchAId : number, refereeAId : number): Promise<boolean>{
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM referee_change_requests
         WHERE request_status = 'open' AND match_a_id = ? AND referee_a_id = ? LIMIT 1`,
        [matchAId, refereeAId]);
    return rows.length > 0;
}

/** แถวสำหรับแสดงผล — join ชื่อคน 2 ฝั่ง + เวลาแมตช์ 2 ฝั่ง */
export type RefereeRequestListRow = RefereeChangeRequestRow & {
    a_user_id : number, a_full_name : string, a_profile_image_key : string | null,
    b_user_id : number | null, b_full_name : string | null, b_profile_image_key : string | null,
    ma_round_number : number | null, ma_scheduled_time : Date | null, ma_scheduled_end_time : Date | null,
    mb_round_number : number | null, mb_scheduled_time : Date | null, mb_scheduled_end_time : Date | null
};

const LIST_SELECT = `
    SELECT r.*,
           ua.user_id AS a_user_id, ua.full_name AS a_full_name, ua.profile_image_key AS a_profile_image_key,
           ub.user_id AS b_user_id, ub.full_name AS b_full_name, ub.profile_image_key AS b_profile_image_key,
           ma.round_number AS ma_round_number, ma.scheduled_time AS ma_scheduled_time, ma.scheduled_end_time AS ma_scheduled_end_time,
           mb.round_number AS mb_round_number, mb.scheduled_time AS mb_scheduled_time, mb.scheduled_end_time AS mb_scheduled_end_time
    FROM referee_change_requests r
    JOIN tournament_referees tra ON tra.tournament_referee_id = r.referee_a_id
    JOIN users ua ON ua.user_id = tra.user_id
    LEFT JOIN tournament_referees trb ON trb.tournament_referee_id = r.referee_b_id
    LEFT JOIN users ub ON ub.user_id = trb.user_id
    JOIN matches ma ON ma.match_id = r.match_a_id
    LEFT JOIN matches mb ON mb.match_id = r.match_b_id`;

export async function findListRowById(requestId : number): Promise<RefereeRequestListRow | null>{
    const [rows] = await pool.query<(RefereeRequestListRow & RowDataPacket)[]>(
        `${LIST_SELECT} WHERE r.request_id = ?`, [requestId]);
    return rows[0] ?? null;
}

/** R05 — คำขอทั้งหมดของทัวร์ (ORG) */
export async function findByTournament(tournamentId : number, status? : RefereeChangeRequestRow['request_status'])
        : Promise<RefereeRequestListRow[]>{
    const [rows] = await pool.query<(RefereeRequestListRow & RowDataPacket)[]>(
        `${LIST_SELECT}
         WHERE r.tournament_id = ? ${status ? 'AND r.request_status = ?' : ''}
         ORDER BY r.request_id DESC`,
        status ? [tournamentId, status] : [tournamentId]);
    return rows;
}

/** R04 — คำขอ open ที่รอ user คนนี้ตอบ (ไม่ว่าจะอยู่ฝั่ง A หรือ B) */
export async function findPendingForUser(userId : number): Promise<RefereeRequestListRow[]>{
    const [rows] = await pool.query<(RefereeRequestListRow & RowDataPacket)[]>(
        `${LIST_SELECT}
         WHERE r.request_status = 'open'
           AND (   (tra.user_id = ? AND r.a_status = 'pending')
                OR (trb.user_id = ? AND r.b_status = 'pending') )
         ORDER BY r.request_id DESC`, [userId, userId]);
    return rows;
}

/** R04 — คำขอที่ user คนนี้เป็นคนส่ง (ทุกสถานะ ล่าสุดก่อน) */
export async function findCreatedByUser(userId : number): Promise<RefereeRequestListRow[]>{
    const [rows] = await pool.query<(RefereeRequestListRow & RowDataPacket)[]>(
        `${LIST_SELECT}
         WHERE r.requested_by = ?
         ORDER BY r.request_id DESC LIMIT 50`, [userId]);
    return rows;
}

/** บันทึกคำตอบฝั่งใดฝั่งหนึ่ง — คืน false ถ้าฝั่งนั้นไม่ได้รออยู่ (ตอบไปแล้ว / คำขอปิดแล้ว) */
export async function answerSide(requestId : number, side : 'a' | 'b', answer : 'accepted' | 'declined'): Promise<boolean>{
    const col = side === 'a' ? 'a_status' : 'b_status';
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE referee_change_requests SET ${col} = ?
         WHERE request_id = ? AND request_status = 'open' AND ${col} = 'pending'`,
        [answer, requestId]);
    return result.affectedRows === 1;
}

/** ปิดคำขอ (declined / cancelled) — เฉพาะที่ยัง open */
export async function close(requestId : number, status : 'declined' | 'cancelled'): Promise<boolean>{
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE referee_change_requests SET request_status = ?, resolved_at = NOW()
         WHERE request_id = ? AND request_status = 'open'`, [status, requestId]);
    return result.affectedRows === 1;
}

/**
 * apply คำขอที่ทุกฝ่ายตกลงแล้ว — ทรานแซกชันเดียว:
 *   1. lock แถว match_referees ที่เกี่ยวข้อง
 *   2. ย้าย/เพิ่มกรรมการในแมตช์
 *   3. ปิดคำขอนี้เป็น applied และยกเลิกคำขอ open อื่นที่อ้างแมตช์เดียวกัน (§5.1)
 * คืน false ถ้าสถานะจริงใน DB ไม่ตรงกับคำขอแล้ว (มีคนแก้ไประหว่างรอ) — service จะ cancel ให้
 */
export async function apply(req : RefereeChangeRequestRow): Promise<boolean>{
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        let ok : boolean;
        switch(req.request_type){
            case 'org_add_match':
                ok = await MatchRefRepo.insertAccepted(conn, req.match_a_id, req.referee_a_id);
                break;
            case 'ref_transfer':
                ok = await MatchRefRepo.reassign(conn, req.match_a_id, req.referee_a_id, req.referee_b_id!);
                break;
            case 'ref_swap':
            case 'org_swap':
                ok = await MatchRefRepo.reassign(conn, req.match_a_id, req.referee_a_id, req.referee_b_id!)
                  && await MatchRefRepo.reassign(conn, req.match_b_id!, req.referee_b_id!, req.referee_a_id);
                break;
        }

        if(!ok){
            await conn.rollback();
            return false;
        }

        await conn.query(
            `UPDATE referee_change_requests SET request_status = 'applied', resolved_at = NOW()
             WHERE request_id = ?`, [req.request_id]);

        // คำขอ open อื่นที่อ้างแมตช์ที่เพิ่งเปลี่ยนคน → ข้อมูลเก่าแล้ว ยกเลิกทิ้ง
        const touched = [req.match_a_id, req.match_b_id].filter((m) : m is number => m !== null);
        await conn.query(
            `UPDATE referee_change_requests SET request_status = 'cancelled', resolved_at = NOW()
             WHERE request_status = 'open' AND request_id <> ?
               AND (match_a_id IN (?) OR match_b_id IN (?))`,
            [req.request_id, touched, touched]);

        await conn.commit();
        return true;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}
