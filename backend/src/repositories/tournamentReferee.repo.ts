import pool from '../config/db.js';
import type { TournamentRefereeRow } from '../types/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { UserRow } from '../types/db.js';
import type { TournamentRow } from '../types/db.js';
import * as MatchRefRepo from '../repositories/matchReferee.repo.js';

/** แถวล่าสุดของ user คนนี้ในทัวร์นี้ — ★ ไม่กรอง removed_at ให้ service ตัดสินเอง */
/**
 * Conflict of interest (มติ 18 ก.ย. 2569): คนที่มีชื่อในทีมที่สมัครทัวร์นี้ (pending/approved) เป็นกรรมการไม่ได้ แม้ไม่ได้ลงแข่ง
 * คืน team_id ที่ชนกัน (null = ไม่มี)
 */
export async function findApplyingTeamOfUser(tournamentId : number, userId : number): Promise<{ team_id : number; name : string } | null>{
    const [rows] = await pool.query<(RowDataPacket & { team_id : number; name : string })[]>(
        `SELECT t.team_id, t.name
         FROM tournament_applications a
         JOIN teams t ON t.team_id = a.team_id
         JOIN team_members tm ON tm.team_id = t.team_id
         WHERE a.tournament_id = ? AND tm.user_id = ?
           AND a.tournament_application_status IN ('pending', 'approved')
         LIMIT 1`, [tournamentId, userId]);
    return rows[0] ?? null;
}

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
    reason : string | null;     // ข้อความ admin (needs_docs) ที่ก็อปมาจากการตรวจที่ค้างอยู่
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
                 external_approval_status = ?, approved_by = ?, approved_at = ?,
                 external_verification_docs = ?, external_rejection_reason = ?
             WHERE tournament_referee_id = ? AND invitation_status = 'pending' AND removed_at IS NULL`,
            [approval.status, approval.approvedBy, approval.approvedAt,
             approval.docs ? JSON.stringify(approval.docs) : null, approval.reason, tournamentRefereeId]);

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

// ─────────────── การยืนยันตัวตนกรรมการภายนอก — คิดเป็น "ต่อคน" แม้คอลัมน์อยู่ต่อแถว ───────────────
// ทุกแถว tournament_referees ของ user คนหนึ่งสะท้อนสถานะเดียวกัน (GUIDE/10 §8 F-16/F-17)
// admin ตัดสิน "คน" → UPDATE ทุกแถวของคนนั้นพร้อมกัน

/** ผล approve ล่าสุดภายใน 1 ปี (ทัวร์ไหนก็ได้ ถูกถอดแล้วก็นับ) — ใช้ก็อปมาแถวใหม่ */
export async function findRecentApproval(userId : number)
        : Promise<Pick<TournamentRefereeRow, 'tournament_referee_id' | 'approved_by' | 'approved_at'> | null>{
    const [rows] = await pool.query<(Pick<TournamentRefereeRow, 'tournament_referee_id' | 'approved_by' | 'approved_at'> & RowDataPacket)[]>(
        `SELECT tournament_referee_id, approved_by, approved_at FROM tournament_referees
         WHERE user_id = ? AND is_external = 1 AND external_approval_status = 'approved'
           AND approved_at > DATE_SUB(NOW(), INTERVAL 1 YEAR)
         ORDER BY approved_at DESC LIMIT 1`, [userId]);
    return rows[0] ?? null;
}

export type OpenReviewRow = Pick<TournamentRefereeRow,
    'tournament_referee_id' | 'external_approval_status' | 'external_verification_docs' | 'external_rejection_reason'>;

/** การตรวจที่ค้างอยู่ของ user (pending / needs_docs บนแถวที่ยังไม่ถูกถอด) — มีแล้วไม่ต้องส่งเอกสารซ้ำ */
export async function findOpenReview(userId : number): Promise<OpenReviewRow | null>{
    const [rows] = await pool.query<(OpenReviewRow & RowDataPacket)[]>(
        `SELECT tournament_referee_id, external_approval_status, external_verification_docs, external_rejection_reason
         FROM tournament_referees
         WHERE user_id = ? AND is_external = 1 AND removed_at IS NULL
           AND external_approval_status IN ('pending', 'needs_docs')
         ORDER BY (external_verification_docs IS NOT NULL) DESC, tournament_referee_id DESC
         LIMIT 1`, [userId]);
    return rows[0] ?? null;
}

/** ผล reject ล่าสุด (ไว้บอก user ว่าทำไมไม่ผ่าน) */
export async function findLatestRejection(userId : number)
        : Promise<Pick<TournamentRefereeRow, 'approved_at' | 'external_rejection_reason'> | null>{
    const [rows] = await pool.query<(Pick<TournamentRefereeRow, 'approved_at' | 'external_rejection_reason'> & RowDataPacket)[]>(
        `SELECT approved_at, external_rejection_reason FROM tournament_referees
         WHERE user_id = ? AND is_external = 1 AND external_approval_status = 'rejected'
         ORDER BY approved_at DESC LIMIT 1`, [userId]);
    return rows[0] ?? null;
}

export type IdentityTournamentRow = Pick<TournamentRefereeRow, 'tournament_referee_id' | 'tournament_id' | 'external_approval_status'> & { tournament_name : string };

/** ทัวร์ที่ user คนนี้เป็นกรรมการภายนอกอยู่ (ยังไม่ถูกถอด) — ไว้แสดงใน /me/referee-identity */
export async function findLiveExternalRows(userId : number): Promise<IdentityTournamentRow[]>{
    const [rows] = await pool.query<(IdentityTournamentRow & RowDataPacket)[]>(
        `SELECT tr.tournament_referee_id, tr.tournament_id, tr.external_approval_status, t.name AS tournament_name
         FROM tournament_referees tr JOIN tournaments t ON t.tournament_id = tr.tournament_id
         WHERE tr.user_id = ? AND tr.is_external = 1 AND tr.removed_at IS NULL AND tr.invitation_status = 'accepted'
         ORDER BY tr.tournament_referee_id`, [userId]);
    return rows;
}

/** user ส่ง/ส่งใหม่ เอกสาร → ทุกแถวที่รออยู่กลับเป็น pending พร้อม docs · คืนจำนวนแถว */
export async function submitDocsForUser(userId : number, docs : string[]): Promise<number>{
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE tournament_referees
         SET external_approval_status = 'pending', external_verification_docs = ?, external_rejection_reason = NULL
         WHERE user_id = ? AND is_external = 1 AND removed_at IS NULL
           AND external_approval_status IN ('pending', 'needs_docs')`,
        [JSON.stringify(docs), userId]);
    return result.affectedRows;
}

export type AdminReviewRow =
    Pick<TournamentRefereeRow, 'tournament_referee_id' | 'user_id' | 'tournament_id' | 'external_verification_docs' | 'created_at'> &
    { full_name : string, profile_image_key : string | null, email : string, tournament_name : string };

/** AR01 — แถว pending ทั้งหมด (service จัดกลุ่มต่อคน) */
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

/** AR02 — อนุมัติ "คน": ทุกแถว pending/needs_docs → approved · ล้างเอกสาร (PDPA) */
export async function approveUser(userId : number, adminUserId : number): Promise<number>{
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE tournament_referees
         SET external_approval_status = 'approved', approved_by = ?, approved_at = NOW(),
             external_verification_docs = NULL, external_rejection_reason = NULL
         WHERE user_id = ? AND is_external = 1 AND removed_at IS NULL
           AND external_approval_status IN ('pending', 'needs_docs')`,
        [adminUserId, userId]);
    return result.affectedRows;
}

/** AR04 — ขอเอกสารใหม่: ทุกแถว pending → needs_docs + ข้อความ · ล้างเอกสารเดิม */
export async function requestDocsFromUser(userId : number, adminUserId : number, reason : string): Promise<number>{
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE tournament_referees
         SET external_approval_status = 'needs_docs', approved_by = ?, approved_at = NOW(),
             external_verification_docs = NULL, external_rejection_reason = ?
         WHERE user_id = ? AND is_external = 1 AND removed_at IS NULL AND external_approval_status = 'pending'`,
        [adminUserId, reason, userId]);
    return result.affectedRows;
}

/**
 * AR03 — ปฏิเสธ "คน" (final): ทุกแถว pending/needs_docs/approved → rejected
 * รวมแถวที่ถูกถอดจากทัวร์แล้ว — ไม่งั้น findRecentApproval ยังก็อป approved เก่ามาได้
 */
export async function rejectUser(userId : number, adminUserId : number, reason : string): Promise<number>{
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE tournament_referees
         SET external_approval_status = 'rejected', approved_by = ?, approved_at = NOW(),
             external_verification_docs = NULL, external_rejection_reason = ?
         WHERE user_id = ? AND is_external = 1
           AND external_approval_status IN ('pending', 'needs_docs', 'approved')`,
        [adminUserId, reason, userId]);
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
