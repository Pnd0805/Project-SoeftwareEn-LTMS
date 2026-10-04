import pool from '../config/db.js';
import { AppError } from '../utils/AppError.js';
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

/**
 * ทุกแถวที่ยัง active ของคนนี้ในทัวร์นี้ (แก้ 1 ต.ค. 2569)
 *
 * ตารางนี้เป็น soft delete (`removed_at`) และ F-15 ตั้งใจให้มีแถว active ได้มากกว่าหนึ่งแถว —
 * คนที่ `accepted` แล้วแอดมินปฏิเสธตัวตน (`rejected_by_admin`) ถูกเชิญใหม่ได้ โดยแถวเก่ายังไม่ถูกลบ
 * ⇒ "แถวล่าสุดตาม id" ไม่ใช่คำตอบของคำถามว่า "คนนี้เป็นกรรมการของทัวร์นี้อยู่ไหม"
 *   ถ้าแถวล่าสุดถูกลบไปแล้วแต่แถวเก่ายัง active อยู่ `findLatestByTournamentAndUser` จะตอบว่าไม่เป็น
 *
 * เรียงจากเก่าไปใหม่ เพื่อให้ผู้เรียกเลือกแถวแรกที่ตรงเงื่อนไขได้แบบคาดเดาผลได้
 */
export async function findActiveByTournamentAndUser(tournamentId : number, userId : number)
        : Promise<TournamentRefereeRow[]>{
    const [rows] = await pool.query<(TournamentRefereeRow & RowDataPacket)[]>(
        `SELECT * FROM tournament_referees
         WHERE tournament_id = ? AND user_id = ? AND removed_at IS NULL
         ORDER BY tournament_referee_id`, [tournamentId, userId]);
    return rows;
}

/*
 * ลบ findLatestByTournamentAndUser() ออกแล้ว (4 ต.ค. 2569)
 *
 * มันคืน "แถวล่าสุดตาม id" ซึ่ง **ไม่ใช่คำตอบ** ของคำถามว่า "คนนี้เป็นกรรมการของทัวร์นี้อยู่ไหม"
 * เพราะตารางเป็น soft delete และ F-15 ตั้งใจให้มีแถวที่ใช้งานได้พร้อมแถว rejected_by_admin ค้างอยู่
 * ⇒ ถ้าแถวล่าสุดเป็นแถวที่ถูกปฏิเสธ/ถูกถอด มันจะตอบว่า "ไม่เป็น" ทั้งที่แถวเก่ายังใช้งานได้
 * เป็นบั๊กที่แก้ไปเมื่อ 1 ต.ค. (dabe9e3/d5bda6d) — มีสามที่เรียกตัวนี้แล้วถาม isActiveReferee แถวเดียว
 *
 * คงไว้ถึงวันนี้เพราะสาขาที่ยังไม่ merge ยังเรียกอยู่ · ตรวจแล้วว่าเงื่อนไขนั้นหมดไป:
 * 6 สาขาที่เคยเรียก (rewards-match-history · be-c8-profile · be-c4-c5a · backend_shokun ·
 * tournaments-step-5 · backend) เข้า BE_KN ครบ ahead=0 ทุกตัว และสาขาที่ยังมีของค้างทั้ง 6 ตัว
 * เป็น frontend ที่ไม่เรียกเลย
 *
 * ★ ลบเพราะ **ชื่อมันอ่านเหมือนตัวที่ควรเรียก** — autocomplete เจอแล้วเรียกได้โดยไม่มีอะไรฟ้อง
 *   เหลือ findActiveRefereeRow() ทางเดียวคือทางที่ถูก · คอมเมนต์ไม่ได้หยุดใคร แต่การไม่มีของให้เรียกหยุดได้
 */

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

/**
 * F02b · OD-59 (4 ต.ค. 2569) — กรรมการที่ "ใช้งานได้จริง" ของทัวร์นี้ สำหรับให้กรรมการอีกคน
 * เลือกเป็นปลายทางของคำขอโอน/แลกแมตช์ (FR01/FR03)
 *
 * ★ ต่างจาก `findLatestPerUserByTournament` (F02) สองอย่าง
 *     1. กรองสถานะ **ในSQL** ให้เหลือเฉพาะแถวที่ใช้งานได้ ไม่ใช่คืนทุกสถานะให้ service ไปกรอง
 *        ⇒ คนที่รอตอบ/ถูกปฏิเสธ/ถูกถอด **ไม่หลุดออกไปถึงปลายทางเลย** แม้ FE จะเผลอไม่กรอง
 *     2. ไม่คืน `is_external` / `external_approval_status` — เป็นเรื่องเอกสารตัวตนของคนนั้น
 *        กรรมการอีกคนไม่มีเหตุต้องรู้ (เอกสารนี้ขอไว้ว่าห้ามเปิด)
 *
 * เงื่อนไข "ใช้งานได้" ตรงกับ `toRefereeStatus() === 'active'` และกับ UNIQUE ของ migration 036
 * ⇒ ผลลัพธ์จึงมีได้ไม่เกิน 1 แถวต่อคน โดยฐานเป็นผู้การันตี ไม่ใช่โดย MAX(id)
 *
 * `upcoming_match_count` = แมตช์ของทัวร์นี้ที่ยัง `scheduled` และคนนี้ถืออยู่
 * ใช้ตอบคำถาม "พร้อมรับงานเพิ่มมั้ย" โดยไม่ต้องเปิดข้อมูลส่วนตัวอะไรเลย
 */
export type AssignableRefereeRow =
    Pick<TournamentRefereeRow, 'tournament_referee_id'> &
    { user_id : number , full_name : string , profile_image_key : string | null , upcoming_match_count : number };

export async function findAssignableByTournament(tournamentId : number): Promise<AssignableRefereeRow[]>{
    const [rows] = await pool.query<(AssignableRefereeRow & RowDataPacket)[]>(
        `SELECT tr.tournament_referee_id, u.user_id, u.full_name, u.profile_image_key,
                COUNT(m.match_id) AS upcoming_match_count
           FROM tournament_referees tr
           JOIN users u ON u.user_id = tr.user_id
           LEFT JOIN match_referees mr ON mr.tournament_referee_id = tr.tournament_referee_id
           LEFT JOIN matches m ON m.match_id = mr.match_id AND m.match_status = 'scheduled'
          WHERE tr.tournament_id = ?
            AND tr.removed_at IS NULL
            AND tr.invitation_status = 'accepted'
            AND (tr.is_external = 0 OR tr.external_approval_status IN ('not_required', 'approved'))
          GROUP BY tr.tournament_referee_id, u.user_id, u.full_name, u.profile_image_key
          ORDER BY upcoming_match_count ASC, u.full_name ASC`, [tournamentId]);
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
        `SELECT tr.*
         FROM tournament_referees tr
         JOIN tournaments t ON t.tournament_id = tr.tournament_id
         WHERE tr.tournament_referee_id = ? AND t.deleted_at IS NULL`,
        [tournamentRefereeId]);
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
 * UNIQUE `uq_tr_active_once` (migration 036) ห้ามคนเดียวกันมีแถว "ใช้งานได้" เกินหนึ่งแถวต่อทัวร์
 *
 * ด่านในโค้ด (inviteReferee หลัง dabe9e3) กันไว้ตั้งแต่ขาเข้าแล้ว แต่ด่านนั้นเป็น read-then-write
 * ไม่มีล็อก ⇒ คำเชิญสองใบที่ยิงพร้อมกันผ่านด่านได้ทั้งคู่ แล้วมาชนกันตอนกดรับ/ตอนแอดมินอนุมัติ
 * ซึ่งเป็นจังหวะที่ผู้ใช้เป็นคนกด ⇒ ต้องได้ข้อความที่อ่านรู้เรื่อง ไม่ใช่ 500 จาก ER_DUP_ENTRY ดิบ
 *
 * ตรวจชื่อ index ด้วย ไม่ใช่เช็คแค่ ER_DUP_ENTRY — ตารางนี้อาจมี UNIQUE อื่นเพิ่มทีหลัง
 * แล้วเราจะกลืน error ของกฎที่ไม่เกี่ยวกันไปตอบข้อความผิดเรื่อง
 *
 * create() (F01 เชิญ) ไม่ต้องดักเพราะแถวใหม่เป็น invitation_status = 'pending'
 * ⇒ active_user_id เป็น NULL ⇒ ไม่เคยชน UNIQUE ตัวนี้
 */
function isActiveRefereeConflict(err : unknown) : boolean{
    const e = err as { code? : string; message? : string };
    return e?.code === 'ER_DUP_ENTRY' && (e.message ?? '').includes('uq_tr_active_once');
}

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
        if(isActiveRefereeConflict(err)){
            // มีแถวที่ใช้งานได้ของคนนี้ในทัวร์เดียวกันอยู่แล้ว ⇒ เขาเป็นกรรมการอยู่แล้ว
            // คำเชิญใบนี้เป็นใบเกินที่เกิดจากเชิญซ้อนกันพอดี ไม่ใช่ความผิดของคนกด
            throw new AppError(409, 'REFEREE_ALREADY_ACTIVE',
                'คุณเป็นกรรมการของทัวร์นาเมนต์นี้อยู่แล้ว คำเชิญใบนี้จึงใช้ไม่ได้');
        }
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
           AND t.deleted_at IS NULL
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
           AND t.deleted_at IS NULL
         ORDER BY tr.tournament_referee_id`);
    return rows;
}

/** AR02 — อนุมัติ "คน": ทุกแถว pending/needs_docs → approved · ล้างเอกสาร (PDPA) */
export async function approveUser(userId : number, adminUserId : number): Promise<number>{
    try {
        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE tournament_referees
             SET external_approval_status = 'approved', approved_by = ?, approved_at = NOW(),
                 external_verification_docs = NULL, external_rejection_reason = NULL
             WHERE user_id = ? AND is_external = 1 AND removed_at IS NULL
               AND external_approval_status IN ('pending', 'needs_docs')`,
            [adminUserId, userId]);
        return result.affectedRows;
    } catch (err) {
        // อนุมัติทีเดียวทุกแถวของคนนี้ ⇒ ถ้าเขามีสองแถวรออยู่ในทัวร์เดียวกัน (เชิญซ้อนกันพอดี)
        // ทั้งคู่จะกลายเป็นใช้งานได้พร้อมกันและชน UNIQUE ⇒ การอนุมัติล้มทั้งก้อน
        // ต้องบอกแอดมินว่าให้ไปถอดใบเกินก่อน ไม่ใช่โยน 500 ให้เดาเอง
        if(isActiveRefereeConflict(err)){
            throw new AppError(409, 'REFEREE_DUPLICATE_ROWS',
                'ผู้ใช้นี้มีคำเชิญค้างซ้อนกันในทัวร์นาเมนต์เดียวกัน กรุณาให้ผู้จัดถอดใบที่เกินออกก่อนจึงจะอนุมัติได้');
        }
        throw err;
    }
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
