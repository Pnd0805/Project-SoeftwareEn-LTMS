import pool from '../config/db.js';
import type { RefereeChangeRequestRow, RefereeRequestType, RefereeRequestSideStatus } from '../types/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import * as MatchRefRepo from './matchReferee.repo.js';
import * as TournamentRefRepo from './tournamentReferee.repo.js';

type NewRequest = {
    tournamentId : number;
    type : RefereeRequestType;
    /** ref_withdraw เท่านั้น — ฐานมี CHECK บังคับความสอดคล้องกับ matchAId (migration 045) */
    withdrawScope? : 'match' | 'tournament' | null;
    requestedBy : number;
    refereeAId : number;
    refereeBId : number | null;
    matchAId : number | null;
    matchBId : number | null;
    aStatus : RefereeRequestSideStatus;
    bStatus : RefereeRequestSideStatus;
    /** บังคับสำหรับ ref_withdraw (ด่านอยู่ที่ service) */
    reason? : string | null;
};

export async function create(data : NewRequest): Promise<number>{
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO referee_change_requests
            (tournament_id, request_type, withdraw_scope, requested_by, referee_a_id, referee_b_id,
             match_a_id, match_b_id, a_status, b_status, request_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.tournamentId, data.type, data.withdrawScope ?? null, data.requestedBy, data.refereeAId,
         data.refereeBId, data.matchAId, data.matchBId, data.aStatus, data.bStatus, data.reason ?? null]);
    return result.insertId;
}

export async function findById(requestId : number): Promise<RefereeChangeRequestRow | null>{
    const [rows] = await pool.query<(RefereeChangeRequestRow & RowDataPacket)[]>(
        'SELECT * FROM referee_change_requests WHERE request_id = ?', [requestId]);
    return rows[0] ?? null;
}

/** มีคำขอ open ที่อ้างคู่ (match_a, referee_a) เดียวกันอยู่แล้วไหม — กันส่งซ้ำ */
export async function existsOpenFor(matchAId : number | null, refereeAId : number): Promise<boolean>{
    // 🔴 `match_a_id = NULL` ใน SQL ไม่เคยเป็นจริง ⇒ ใบระดับทัวร์ต้องเทียบด้วย IS NULL
    //   ถ้าเขียน `= ?` เฉย ๆ ด่านกันส่งซ้ำจะปล่อยผ่านทุกครั้งอย่างเงียบ ๆ
    const sameMatch = matchAId === null ? 'match_a_id IS NULL' : 'match_a_id = ?';
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM referee_change_requests
         WHERE request_status = 'open' AND referee_a_id = ? AND ${sameMatch} LIMIT 1`,
        matchAId === null ? [refereeAId] : [refereeAId, matchAId]);
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
    -- 🔴 LEFT ไม่ใช่ JOIN (แก้ 6 ต.ค.) — ใบ ref_withdraw ขอบเขต tournament มี match_a_id = NULL
    --   ถ้าเป็น INNER แถวพวกนั้นจะหายจากทุกรายการ โดยไม่มี error ไม่มีใครรู้
    LEFT JOIN matches ma ON ma.match_id = r.match_a_id
    LEFT JOIN matches mb ON mb.match_id = r.match_b_id
    JOIN tournaments t ON t.tournament_id = r.tournament_id`;

/**
 * คำขอ open ที่ "เรื่องที่มันอ้างถึง" จบแล้ว ใช้ไม่ได้อยู่ดี → ไม่ต้องโชว์ให้กดเสียเที่ยว
 *
 * ★ มติ 6 ต.ค. (ทางเลือก ฏ) — ตัดออกตอน **อ่าน** ไม่ไปเติม UPDATE ในเส้น verify ผล
 *   เส้นนั้นเป็นทรานแซกชันที่ยาวที่สุดในระบบ (เดินสาย · standings · stats · pickem · reward)
 *   เพิ่มคำสั่งเพื่อเรื่องที่ไม่เร่งด่วนเข้าไป = เพิ่มความเสี่ยงให้เส้นที่สำคัญที่สุด
 *   และกฎที่อยู่ "ที่เดียวตอนอ่าน" ครอบทุกทางที่แมตช์/ทัวร์จบ ไม่ต้องตามเติมทีละเส้น
 *   🔴 แถวยังค้างเป็น open ในฐาน — เป็นเรื่องความสะอาด ไม่ใช่พฤติกรรม
 *     ถ้าวันหนึ่งอยากให้ฐานสะอาดด้วย เติมสคริปต์กวาด (แบบ sweepInactiveTeams) ได้ภายหลัง
 *     โดยไม่ต้องแก้อะไรที่นี่
 *
 * เงื่อนไขแมตช์ใช้ IS NULL OR เพราะใบระดับทัวร์ไม่ได้อ้างแมตช์ ⇒ ไม่ควรถูกตัดด้วยเวลาแมตช์
 * เงื่อนไขทัวร์ (เติม 6 ต.ค.) ครอบทั้งห้าชนิด ⇒ ใบซอมบี้ของ ref_transfer/ref_swap ที่ค้างมา
 * ตั้งแต่ทัวร์จบไปแล้ว ก็หายจากรายการไปด้วยในคราวเดียว
 */
const NOT_EXPIRED = `
    (r.match_a_id IS NULL OR ma.scheduled_time > NOW())
    AND (mb.scheduled_time IS NULL OR mb.scheduled_time > NOW())
    AND t.tournament_status <> 'completed' AND t.deleted_at IS NULL`;

export async function findListRowById(requestId : number): Promise<RefereeRequestListRow | null>{
    const [rows] = await pool.query<(RefereeRequestListRow & RowDataPacket)[]>(
        `${LIST_SELECT} WHERE r.request_id = ?`, [requestId]);
    return rows[0] ?? null;
}

/** FR05 — คำขอทั้งหมดของทัวร์ (ORG) — ถ้าขอเฉพาะ open จะซ่อนคำขอที่แมตช์ผ่านไปแล้ว */
export async function findByTournament(tournamentId : number, status? : RefereeChangeRequestRow['request_status'])
        : Promise<RefereeRequestListRow[]>{
    const [rows] = await pool.query<(RefereeRequestListRow & RowDataPacket)[]>(
        `${LIST_SELECT}
         WHERE r.tournament_id = ?
           ${status ? 'AND r.request_status = ?' : ''}
           ${status === 'open' ? `AND ${NOT_EXPIRED}` : ''}
         ORDER BY r.request_id DESC`,
        status ? [tournamentId, status] : [tournamentId]);
    return rows;
}

/** FR04 — คำขอ open ที่รอ user คนนี้ตอบ (ไม่ว่าจะอยู่ฝั่ง A หรือ B) */
export async function findPendingForUser(userId : number): Promise<RefereeRequestListRow[]>{
    const [rows] = await pool.query<(RefereeRequestListRow & RowDataPacket)[]>(
        `${LIST_SELECT}
         WHERE r.request_status = 'open'
           AND ${NOT_EXPIRED}
           AND (   (tra.user_id = ? AND r.a_status = 'pending')
                OR (trb.user_id = ? AND r.b_status = 'pending') )
         ORDER BY r.request_id DESC`, [userId, userId]);
    return rows;
}

/** FR04 — คำขอที่ user คนนี้เป็นคนส่ง (ทุกสถานะ ล่าสุดก่อน) */
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
            /**
             * FR09 — ORG อนุมัติให้กรรมการถอนตัว (migration 045 · มติ 6 ต.ค.)
             *   ขอบเขต 'match'      → ถอดออกจากแมตช์นั้นแมตช์เดียว (เครื่องมือเดิมของ F12)
             *   ขอบเขต 'tournament' → ถอดออกจากทัวร์ทั้งทัวร์ (เครื่องมือเดิมของ F03)
             * ★ ไม่ได้เขียน SQL ใหม่เลย ใช้เส้นที่ ORG กดเองได้อยู่แล้วทั้งคู่
             *   ⇒ ไม่มีอำนาจใหม่ในระบบ มีแต่ช่องทางให้ "ขอ" ซึ่งเดิมไม่มี
             */
            case 'ref_withdraw':
                ok = req.withdraw_scope === 'tournament'
                    ? await TournamentRefRepo.removeAllByRefereeIdTx(conn, req.tournament_id, req.referee_a_id, req.requested_by)
                    : await MatchRefRepo.unassignTx(conn, req.match_a_id!, req.referee_a_id);
                break;
            case 'org_add_match':
                ok = await MatchRefRepo.insertAccepted(conn, req.match_a_id!, req.referee_a_id);
                break;
            case 'ref_transfer':
                ok = await MatchRefRepo.reassign(conn, req.match_a_id!, req.referee_a_id, req.referee_b_id!);
                break;
            case 'ref_swap':
            case 'org_swap':
                ok = await MatchRefRepo.reassign(conn, req.match_a_id!, req.referee_a_id, req.referee_b_id!)
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

        /**
         * คำขอ open อื่นที่อ้างแมตช์ที่เพิ่งเปลี่ยนคน → ข้อมูลเก่าแล้ว ยกเลิกทิ้ง (§5.1)
         *
         * ★ แก้ 27 ก.ย. — ยกเลิกเฉพาะชนิดที่ "ย้ายคน" เท่านั้น
         * เหตุผลของการยกเลิกคือสมมติฐาน "กรรมการ X ถือแมตช์ M อยู่" กลายเป็นเท็จ ซึ่งจริงกับ
         * ref_transfer/ref_swap/org_swap · แต่ `org_add_match` ไม่มีสมมติฐานนั้นเลย มันแค่ INSERT
         * แถวของกรรมการคนเดียวเข้าไป (insertAccepted) การเพิ่มคน B เข้าแมตช์ M จึงไม่ทำให้
         * การเพิ่มคน C เข้าแมตช์ M เป็นโมฆะ — สองเรื่องนี้เป็นอิสระต่อกัน
         *
         * เดิมยกเลิกเหวี่ยงแหทุกชนิด ทำให้ **แมตช์ onsite ที่ต้องมีกรรมการ 2 คนตาม BR-10 หากรรมการ
         * คนที่สองไม่ได้เลย**: ORG เชิญสองคนพร้อมกัน คนแรกกดรับ → ใบของคนที่สองกลายเป็น cancelled
         * → คนที่สองกดรับแล้วไม่มีอะไรเกิดขึ้น (answer ต้องการ request_status = 'open')
         * → startMatch ตอบ INSUFFICIENT_REFEREES ตลอดกาล และ F11 ที่เคยใส่กรรมการตรง ๆ ถูกถอดไปแล้ว
         *
         * ใบซ้ำของกรรมการคนเดิมบนแมตช์เดิมไม่ต้องพึ่งการยกเลิกนี้ — insertAccepted คืน false เมื่อ
         * แถวนั้น accepted อยู่แล้ว apply() จึงคืน false และ service เป็นฝ่าย cancel ให้เอง
         */
        const touched = [req.match_a_id, req.match_b_id].filter((m) : m is number => m !== null);
        // ใบระดับทัวร์ไม่ได้อ้างแมตช์ไหน ⇒ ไม่มีใบอื่นให้ยกเลิกด้วยเกณฑ์นี้
        // (และ `IN ()` ที่ว่างเป็น SQL ที่ผิด ⇒ ต้องออกก่อน ไม่ใช่ส่ง array ว่างลงไป)
        if(touched.length === 0){
            await conn.commit();
            return true;
        }
        await conn.query(
            `UPDATE referee_change_requests SET request_status = 'cancelled', resolved_at = NOW()
             WHERE request_status = 'open' AND request_id <> ?
               AND request_type IN ('ref_transfer', 'ref_swap', 'org_swap')
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
