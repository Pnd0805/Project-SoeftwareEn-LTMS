import pool from '../config/db.js';
import type { TournamentRefereeRow } from '../types/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { UserRow } from '../types/db.js';
import type { TournamentRow } from '../types/db.js';
import * as MatchRefRepo from '../repositories/matchReferee.repo.js';

/** แถวล่าสุดของ user คนนี้ในทัวร์นี้ — ★ ไม่กรอง removed_at ให้ service ตัดสินเอง */
export async function findLatestByTournamentAndUser(tournamentId : number, userId : number)
        : Promise<TournamentRefereeRow | null>{
    const [rows] = await pool.query<(TournamentRefereeRow & RowDataPacket)[]>(
        `SELECT * FROM tournament_referees
         WHERE tournament_id = ? AND user_id = ?
         ORDER BY tournament_referee_id DESC LIMIT 1`, [tournamentId, userId]);
    return rows[0] ?? null;
}

type NewTournamentReferee = {
    tournamentId : number;
    userId : number;
    invitedBy : number;
    isExternal : boolean;
    /** แมตช์ที่ ORG เสนอมาพร้อมคำเชิญ — ว่าง = เชิญเข้า pool */
    matchIds : number[];
};

/** F01 — สร้างคำเชิญ + แนบแมตช์ในทรานแซกชันเดียว (แบบเดียวกับ team.repo createTeam) */
export async function create(data : NewTournamentReferee): Promise<number>{
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.query<ResultSetHeader>(
            `INSERT INTO tournament_referees (tournament_id, user_id, invited_by, is_external)
             VALUES (?, ?, ?, ?)`,
            [data.tournamentId, data.userId, data.invitedBy, data.isExternal]);

        await MatchRefRepo.insertPending(conn, result.insertId, data.matchIds);

        await conn.commit();
        return result.insertId;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

export type TournamentRefereeListRow =
    Pick<TournamentRefereeRow, 'tournament_referee_id' | 'invitation_status' | 'is_external' | 'external_approval_status'> &
    Pick<UserRow, 'user_id' | 'full_name' | 'profile_image_key'>;

/** กรรมการทั้งหมดของทัวร์ — แถวล่าสุดต่อ 1 คน เฉพาะที่ยังไม่ถูกถอด */
export async function findLatestPerUserByTournament(tournamentId : number)
        : Promise<TournamentRefereeListRow[]>{
    const [rows] = await pool.query<(TournamentRefereeListRow & RowDataPacket)[]>(
        `SELECT tr.tournament_referee_id, tr.invitation_status, tr.is_external, tr.external_approval_status,
                u.user_id, u.full_name, u.profile_image_key
         FROM tournament_referees tr
         JOIN ( SELECT user_id, MAX(tournament_referee_id) AS latest_id
                FROM tournament_referees
                WHERE tournament_id = ?
                GROUP BY user_id ) latest
           ON tr.tournament_referee_id = latest.latest_id
         JOIN users u ON u.user_id = tr.user_id
         WHERE tr.removed_at IS NULL
         ORDER BY tr.created_at DESC`, [tournamentId]);
    return rows;
}

export type MyRefereeInvitationRow =
    Pick<TournamentRefereeRow, 'tournament_referee_id' | 'is_external' | 'created_at'> &
    Pick<TournamentRow, 'tournament_id' | 'name' | 'sport_type_id' | 'event_start_date'>;

/** คำเชิญที่ยังรอ user คนนี้ตอบ — แถวล่าสุดต่อ 1 ทัวร์ */
export async function findPendingInvitationsByUser(userId : number)
        : Promise<MyRefereeInvitationRow[]>{
    const [rows] = await pool.query<(MyRefereeInvitationRow & RowDataPacket)[]>(
        `SELECT tr.tournament_referee_id, tr.is_external, tr.created_at,
                t.tournament_id, t.name, t.sport_type_id, t.event_start_date
         FROM tournament_referees tr
         JOIN ( SELECT tournament_id, MAX(tournament_referee_id) AS latest_id
                FROM tournament_referees
                WHERE user_id = ?
                GROUP BY tournament_id ) latest
           ON tr.tournament_referee_id = latest.latest_id
         JOIN tournaments t ON t.tournament_id = tr.tournament_id
         WHERE tr.removed_at IS NULL
           AND tr.invitation_status = 'pending'
           AND t.deleted_at IS NULL
         ORDER BY tr.created_at DESC`, [userId]);
    return rows;
}

export async function findById(tournamentRefereeId : number): Promise<TournamentRefereeRow | null>{
    const [rows] = await pool.query<(TournamentRefereeRow & RowDataPacket)[]>(
        'SELECT * FROM tournament_referees WHERE tournament_referee_id = ?', [tournamentRefereeId]);
    return rows[0] ?? null;
}

/** ผลการตรวจคนนอกที่จะเขียนลงแถวตอน accept — service ตัดสิน repo แค่เขียน */
export type ExternalApproval = {
    status : TournamentRefereeRow['external_approval_status'];
    approvedBy : number | null;
    approvedAt : Date | null;
    docs : string[] | null;
};

/**
 * F05 — ตอบรับ + เลือกแมตช์ + บันทึกผลตรวจคนนอก ในทรานแซกชันเดียว
 * คืน true ถ้าอัปเดตได้จริง (false = มีคนตอบไปก่อนแล้ว → ไม่แตะ match_referees)
 */
export async function accept(tournamentRefereeId : number, acceptedMatchIds : number[], approval : ExternalApproval): Promise<boolean>{
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.query<ResultSetHeader>(
            `UPDATE tournament_referees
             SET invitation_status = 'accepted',
                 external_approval_status = ?, approved_by = ?, approved_at = ?, external_verification_docs = ?
             WHERE tournament_referee_id = ? AND invitation_status = 'pending' AND removed_at IS NULL`,
            [approval.status, approval.approvedBy, approval.approvedAt,
             approval.docs ? JSON.stringify(approval.docs) : null, tournamentRefereeId]);

        if(result.affectedRows !== 1){
            await conn.rollback();
            return false;
        }

        await MatchRefRepo.respond(conn, tournamentRefereeId, acceptedMatchIds);

        await conn.commit();
        return true;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/**
 * ผล approve ล่าสุดของ user คนนี้จากทัวร์ไหนก็ได้ภายใน 1 ปี — ใช้ "ก็อป" มาแถวใหม่ ไม่ต้องส่งเอกสารซ้ำ
 * (GUIDE/10 §8: เลือกแบบนี้แทนการย้ายไป users เพื่อไม่แตะ schema ข้ามทีม)
 */
export async function findRecentApproval(userId : number)
        : Promise<Pick<TournamentRefereeRow, 'tournament_referee_id' | 'approved_by' | 'approved_at'> | null>{
    const [rows] = await pool.query<(Pick<TournamentRefereeRow, 'tournament_referee_id' | 'approved_by' | 'approved_at'> & RowDataPacket)[]>(
        `SELECT tournament_referee_id, approved_by, approved_at FROM tournament_referees
         WHERE user_id = ? AND is_external = 1 AND external_approval_status = 'approved'
           AND approved_at > DATE_SUB(NOW(), INTERVAL 1 YEAR)
         ORDER BY approved_at DESC LIMIT 1`, [userId]);
    return rows[0] ?? null;
}

/** F15 — ref ส่ง/แก้เอกสารระหว่างรอ admin (เฉพาะแถวที่ยัง pending) */
export async function updateDocs(tournamentRefereeId : number, docs : string[]): Promise<boolean>{
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE tournament_referees SET external_verification_docs = ?
         WHERE tournament_referee_id = ? AND external_approval_status = 'pending' AND removed_at IS NULL`,
        [JSON.stringify(docs), tournamentRefereeId]);
    return result.affectedRows === 1;
}

export type AdminReviewRow =
    Pick<TournamentRefereeRow, 'tournament_referee_id' | 'user_id' | 'tournament_id' | 'external_verification_docs' | 'created_at'> &
    { full_name : string, profile_image_key : string | null, email : string, tournament_name : string };

/** AR01 — คิวกรรมการภายนอกที่รอ admin ตรวจ (เก่าสุดก่อน) */
export async function findPendingAdminReview(): Promise<AdminReviewRow[]>{
    const [rows] = await pool.query<(AdminReviewRow & RowDataPacket)[]>(
        `SELECT tr.tournament_referee_id, tr.user_id, tr.tournament_id, tr.external_verification_docs, tr.created_at,
                u.full_name, u.profile_image_key, u.email, t.name AS tournament_name
         FROM tournament_referees tr
         JOIN users u ON u.user_id = tr.user_id
         JOIN tournaments t ON t.tournament_id = tr.tournament_id
         WHERE tr.is_external = 1 AND tr.external_approval_status = 'pending'
           AND tr.invitation_status = 'accepted' AND tr.removed_at IS NULL
         ORDER BY tr.tournament_referee_id`);
    return rows;
}

/** AR02 — อนุมัติ · ล้างเอกสารทิ้ง (PDPA) · เฉพาะที่ยัง pending */
export async function approveExternal(tournamentRefereeId : number, adminUserId : number): Promise<boolean>{
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE tournament_referees
         SET external_approval_status = 'approved', approved_by = ?, approved_at = NOW(),
             external_verification_docs = NULL, external_rejection_reason = NULL
         WHERE tournament_referee_id = ? AND external_approval_status = 'pending' AND removed_at IS NULL`,
        [adminUserId, tournamentRefereeId]);
    return result.affectedRows === 1;
}

/**
 * AR03 — ปฏิเสธ (pending) หรือถอนอนุมัติ (approved, F-10)
 * revokeAll = true → ถอนทุกแถว approved ที่ยังไม่ถูกถอดของ user นั้นด้วย (ผลก็อป 1 ปีต้องหายพร้อมกัน)
 * ปฏิเสธเอกสารตอน pending ไม่กระทบทัวร์อื่นที่เคย approved ไปแล้ว
 */
export async function rejectExternal(
        tournamentRefereeId : number, userId : number, adminUserId : number, reason : string, revokeAll : boolean): Promise<number>{
    // ถอน = ล้างทุกแถว approved ของคนนั้น "รวมที่ถูกถอดจากทัวร์ไปแล้ว" — ไม่งั้น findRecentApproval ยังก็อปมาได้
    const target = revokeAll
        ? `(tournament_referee_id = ? OR (user_id = ? AND external_approval_status = 'approved'))`
        : `tournament_referee_id = ? AND removed_at IS NULL`;
    const params = revokeAll
        ? [adminUserId, reason, tournamentRefereeId, userId]
        : [adminUserId, reason, tournamentRefereeId];
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE tournament_referees
         SET external_approval_status = 'rejected', approved_by = ?, approved_at = NOW(),
             external_verification_docs = NULL, external_rejection_reason = ?
         WHERE is_external = 1
           AND external_approval_status IN ('pending', 'approved')
           AND ${target}`, params);
    return result.affectedRows;
}

/** F06 — ปฏิเสธทั้งคำเชิญ → แมตช์ที่เสนอมาทั้งหมด declined ด้วย */
export async function decline(tournamentRefereeId : number): Promise<boolean>{
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.query<ResultSetHeader>(
            `UPDATE tournament_referees SET invitation_status = 'rejected'
             WHERE tournament_referee_id = ? AND invitation_status = 'pending' AND removed_at IS NULL`,
            [tournamentRefereeId]);

        if(result.affectedRows !== 1){
            await conn.rollback();
            return false;
        }

        await MatchRefRepo.declineAll(conn, tournamentRefereeId);

        await conn.commit();
        return true;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/** ถอดทุกแถวของ user คนนี้ในทัวร์นี้ — คืนจำนวนแถวที่ถูกถอด */
export async function removeAllByUser(tournamentId : number, userId : number, removedBy : number)
        : Promise<number>{
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE tournament_referees
         SET removed_at = NOW(), removed_by = ?
         WHERE tournament_id = ? AND user_id = ? AND removed_at IS NULL`,
        [removedBy, tournamentId, userId]);
    return result.affectedRows;
}