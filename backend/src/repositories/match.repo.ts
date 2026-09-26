import pool from '../config/db.js';
import type { MatchRow, MatchCheckinRow, MatchResultRow, TournamentRefereeRow } from '../types/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';

/** B5 (รายงาน FE 19 ก.ย.): ใบผล "แถวล่าสุด" ของแมตช์ + เส้นทางสาย — ให้ M04/M05 ตอบผลได้โดย FE ไม่ต้องยิง S05 ทีละแมตช์ */
export type MatchResultSummaryCols = {
    next_match_id: number | null;
    loser_next_match_id: number | null;
    result_status: MatchResultRow['match_result_status'] | null;   // null = ยังไม่มีใบผล
    result_winner_team_id: number | null;
    result_score: Record<string, number> | null;
};

export type MatchListRow = MatchResultSummaryCols & {
    match_id: number;
    round_number: number | null;
    scheduled_time: Date | null;
    scheduled_end_time: Date | null;
    venue: string | null;
    match_status: MatchRow['match_status'];   // อ้าง types/db.ts — สถานะใหม่ใน DB (เช่น result_rejected) ตามมาเอง
    team_a_id: number | null;
    team_a_name: string | null;
    team_a_sport_type_id: number | null;
    team_b_id: number | null;
    team_b_name: string | null;
    team_b_sport_type_id: number | null;
};

export type MatchListFilters = {
    teamId?: number | undefined;
    status?: string | undefined;
    round?: number | undefined;
};

export async function findMatchesByTournament(
    tournamentId: number,
    filters: MatchListFilters,
    offset: number,
    pageSize: number
): Promise<{ rows: MatchListRow[]; totalItems: number }> {
    const conditions: string[] = ['m.tournament_id = ?'];
    const params: unknown[] = [tournamentId];

    if (filters.teamId !== undefined) {
        conditions.push('(m.team_a_id = ? OR m.team_b_id = ?)');
        params.push(filters.teamId, filters.teamId);
    }
    if (filters.status !== undefined) {
        conditions.push('m.match_status = ?');
        params.push(filters.status);
    }
    if (filters.round !== undefined) {
        conditions.push('m.round_number = ?');
        params.push(filters.round);
    }

    const whereClause = conditions.join(' AND ');

    const [rows] = await pool.query<(MatchListRow & RowDataPacket)[]>(
        `SELECT
            m.match_id, m.round_number, m.scheduled_time, m.scheduled_end_time, m.venue, m.match_status,
            m.next_match_id, m.loser_next_match_id,
            r.match_result_status AS result_status, r.winner_team_id AS result_winner_team_id, r.score_data AS result_score,
            ta.team_id AS team_a_id, ta.name AS team_a_name, ta.sport_type_id AS team_a_sport_type_id,
            tb.team_id AS team_b_id, tb.name AS team_b_name, tb.sport_type_id AS team_b_sport_type_id
         FROM matches m
         LEFT JOIN teams ta ON m.team_a_id = ta.team_id
         LEFT JOIN teams tb ON m.team_b_id = tb.team_id
         LEFT JOIN match_results r ON r.match_result_id = (
             SELECT MAX(r2.match_result_id) FROM match_results r2 WHERE r2.match_id = m.match_id)
         WHERE ${whereClause}
         ORDER BY m.match_id
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
    );

    const [countRows] = await pool.query<({ totalItems: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS totalItems FROM matches m WHERE ${whereClause}`,
        params
    );

    return { rows, totalItems: countRows[0]?.totalItems ?? 0 };
}

export type MatchDetailRow = Pick<MatchRow, 
    'match_id' | 'tournament_id' | 'round_number' | 'team_a_id' | 'team_b_id' | 
    'scheduled_time' | 'scheduled_end_time' | 'venue' | 'checkin_open_at' | 'match_status' | 'mode' | 'room_code'
> & MatchResultSummaryCols & {
    team_a_name: string | null;
    team_a_sport_type_id: number | null;
    team_b_name: string | null;
    team_b_sport_type_id: number | null;
};

export async function findMatchById(Id: number): Promise<MatchDetailRow | null> {
    const [rows] = await pool.query<(MatchDetailRow & RowDataPacket)[]>(
        `SELECT 
            m.match_id, m.round_number, m.scheduled_time, m.scheduled_end_time, m.venue, m.match_status, m.tournament_id , m.checkin_open_at , m.mode , m.room_code ,
            m.next_match_id, m.loser_next_match_id,
            r.match_result_status AS result_status, r.winner_team_id AS result_winner_team_id, r.score_data AS result_score,
            ta.team_id AS team_a_id, ta.name AS team_a_name, ta.sport_type_id AS team_a_sport_type_id,
            tb.team_id AS team_b_id, tb.name AS team_b_name, tb.sport_type_id AS team_b_sport_type_id
         FROM matches m
         LEFT JOIN teams ta ON m.team_a_id = ta.team_id
         LEFT JOIN teams tb ON m.team_b_id = tb.team_id
         LEFT JOIN match_results r ON r.match_result_id = (
             SELECT MAX(r2.match_result_id) FROM match_results r2 WHERE r2.match_id = m.match_id)
         WHERE m.match_id = ?`,
        [Id]
    );
    const match = rows[0];
    return match ?? null;
}

/**
 * FR-MM-02: แมตช์อื่นที่ "ซ้อนช่วงเวลา" [start, end) กับที่จะตั้ง และใช้ทีมเดียวกันหรือสนามเดียวกัน
 * แมตช์เก่าที่ยังไม่มี scheduled_end_time ถือเป็นจุดเวลา — ชนเมื่อเวลาเริ่มของมันอยู่ในช่วงของเรา
 * แมตช์ที่จบแล้ว (completed เช่น walkover) ไม่นับ — ทีม/สนามว่างแล้ว
 */
export async function findConflictingMatch(
    excludeMatchId: number,
    scheduledTime: Date,
    scheduledEndTime: Date,
    venue: string,
    teamAId: number | null,
    teamBId: number | null
): Promise<{ match_id: number } | null> {
    const [rows] = await pool.query<({ match_id: number } & RowDataPacket)[]>(
        `SELECT match_id FROM matches
         WHERE match_id != ?
           AND match_status <> 'completed'
           AND scheduled_time IS NOT NULL
           AND (
                (scheduled_end_time IS NOT NULL AND scheduled_time < ? AND ? < scheduled_end_time)
             OR (scheduled_end_time IS NULL AND scheduled_time >= ? AND scheduled_time < ?)
           )
           AND (team_a_id IN (?, ?) OR team_b_id IN (?, ?) OR venue = ?)
         LIMIT 1`,
        [excludeMatchId, scheduledEndTime, scheduledTime, scheduledTime, scheduledEndTime,
         teamAId, teamBId, teamAId, teamBId, venue]
    );
    const conflict = rows[0];
    return conflict ?? null;
}

/** แมตช์ที่ต้องจบก่อนแมตช์นี้เริ่ม (ผู้ชนะ/ผู้แพ้ของมันจะมาเล่นแมตช์นี้) */
export async function findPredecessors(matchId: number): Promise<Pick<MatchRow, 'match_id' | 'scheduled_time' | 'scheduled_end_time'>[]> {
    const [rows] = await pool.query<(Pick<MatchRow, 'match_id' | 'scheduled_time' | 'scheduled_end_time'> & RowDataPacket)[]>(
        `SELECT match_id, scheduled_time, scheduled_end_time FROM matches
         WHERE next_match_id = ? OR loser_next_match_id = ?`,
        [matchId, matchId]
    );
    return rows;
}

/**
 * แมตช์ต้นทางที่ยังไม่จบ (ผู้ชนะ/ผู้แพ้ของมันต้องมาเล่นแมตช์นี้) — ข้อ 1 (มติ 25-26 ก.ย.)
 * ใช้บอก FE ว่า "เปิดเช็คอินไม่ได้เพราะติดแมตช์ไหน" แทนที่จะโยน 409 เปล่า ๆ ให้ไปเดาเอง
 */
export async function findUnresolvedPredecessors(matchId: number): Promise<Pick<MatchRow, 'match_id' | 'match_status'>[]> {
    const [rows] = await pool.query<(Pick<MatchRow, 'match_id' | 'match_status'> & RowDataPacket)[]>(
        `SELECT match_id, match_status FROM matches
         WHERE (next_match_id = ? OR loser_next_match_id = ?) AND match_status <> 'completed'
         ORDER BY match_id`,
        [matchId, matchId]
    );
    return rows;
}

export async function updateMatchSchedule(matchId: number, scheduledTime: Date, scheduledEndTime: Date, venue: string): Promise<void> {
    await pool.query(
        `UPDATE matches SET scheduled_time = ?, scheduled_end_time = ?, venue = ?, updated_at = NOW() WHERE match_id = ?`,
        [scheduledTime, scheduledEndTime, venue, matchId]
    );
}

export async function  updateMatchStatus(matchId: number, status: MatchRow['match_status']): Promise<void> {
    await pool.query(
        "UPDATE matches SET match_status = ? , updated_at = NOW() WHERE match_id = ?",
        [status, matchId]
    );
}

/** M09 — เปลี่ยนได้เฉพาะแถวที่ยัง scheduled (คืน false = สถานะอื่นไปแล้ว ไม่แตะแถวนั้น) */
export async function openMatchCheckin(matchId: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
        "UPDATE matches SET match_status = 'checkin_open', checkin_open_at = NOW(), updated_at = NOW() WHERE match_id = ? AND match_status = 'scheduled'",
        [matchId]
    );
    return result.affectedRows === 1;
}

/**
 * นับเฉพาะ "คนที่ทีมส่งลงแข่งในทัวร์นี้" (application_players ของใบสมัครที่อนุมัติแล้ว)
 * ★ เดิมนับสมาชิกทีมคนไหนก็ได้ — คนที่ไม่ได้ถูกส่งลงแข่งจึงทำให้ครบ min_members ได้ (มติ 19 ก.ย. 2569)
 */
export async function countSuccessfulCheckins(matchId: number, teamId: number | null): Promise<number> {
    if (teamId === null) return 0;
    const [rows] = await pool.query<({ cnt: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS cnt FROM match_checkins mc
         JOIN matches m ON m.match_id = mc.match_id
         JOIN tournament_applications ta ON ta.tournament_id = m.tournament_id AND ta.team_id = ?
              AND ta.tournament_application_status = 'approved'
         JOIN application_players ap ON ap.tournament_application_id = ta.tournament_application_id
              AND ap.user_id = mc.user_id
         WHERE mc.match_id = ? AND mc.match_checkin_status IN ('success', 'exception')`,
        [teamId, matchId]
    );
    return rows[0]?.cnt ?? 0;
}

export type MatchCheckinListRow = {
    match_checkin_id: number;
    user_id: number;
    full_name: string;
    method: 'qr_onsite' | 'photo_online' | 'manual_by_referee';
    match_checkin_status: 'success' | 'rejected' | 'exception' | 'pending';
    document_type: 'student_id' | 'national_id' | null;
    document_s3_key: string | null;   // service แปลงเป็น presigned URL ให้เฉพาะกรรมการของแมตช์ (PDPA)
    note: string | null;              // M19 เหตุผลที่กรรมการอนุโลม — ให้กรรมการคนถัดไป/ORG เห็น
    checked_in_at: Date;
};

export async function findCheckinsByMatch(matchId: number): Promise<MatchCheckinListRow[]> {
    const [rows] = await pool.query<(MatchCheckinListRow & RowDataPacket)[]>(
        `SELECT mc.match_checkin_id, mc.user_id, u.full_name, mc.method, mc.match_checkin_status,
                mc.document_type, mc.document_s3_key, mc.note, mc.checked_in_at
         FROM match_checkins mc
         JOIN users u ON mc.user_id = u.user_id
         WHERE mc.match_id = ?`,
        [matchId]
    );
    return rows;
}

export type MatchCheckinDetailRow = Pick<MatchCheckinRow,
    'match_checkin_id' | 'match_id' | 'match_checkin_status' | 'rejection_reason' | 'verified_by_referee_id' | 'verified_at'
>;

export async function findCheckinById(checkinId: number): Promise<MatchCheckinDetailRow | null> {
    const [rows] = await pool.query<(MatchCheckinDetailRow & RowDataPacket)[]>(
        `SELECT match_checkin_id, match_id, match_checkin_status, rejection_reason, verified_by_referee_id, verified_at
         FROM match_checkins
         WHERE match_checkin_id = ?`,
        [checkinId]
    );
    return rows[0] ?? null;
}

// M14/M15 — แตะเฉพาะแถวที่ยัง pending (คืน false = ถูกตัดสินไปแล้ว หรือไม่ใช่เช็คอินที่รอตรวจ)
export async function verifyCheckin(checkinId: number, refereeUserId: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE match_checkins
         SET match_checkin_status = 'success', verified_by_referee_id = ?, verified_at = NOW()
         WHERE match_checkin_id = ? AND match_checkin_status = 'pending'`,
        [refereeUserId, checkinId]
    );
    return result.affectedRows === 1;
}

/**
 * M15 — ปฏิเสธได้ทั้งที่รอตรวจ (pending) และที่ผ่านไปแล้ว (success จาก QR/รูป · exception จาก manual)
 * มติ 21 ก.ย. (FE-check-has-gone-through): QR และ manual ไม่มีใครตรวจก่อน กรรมการจึงต้องเพิกถอนทีหลังได้
 * คืน false = ถูก reject ไปแล้ว
 */
export async function rejectCheckin(checkinId: number, refereeUserId: number, reason: string): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE match_checkins
         SET match_checkin_status = 'rejected', rejection_reason = ?, verified_by_referee_id = ?, verified_at = NOW()
         WHERE match_checkin_id = ? AND match_checkin_status IN ('pending', 'success', 'exception')`,
        [reason, refereeUserId, checkinId]
    );
    return result.affectedRows === 1;
}

/**
 * เช็คอินใหม่ทับแถวที่ถูก reject (มติ 21 ก.ย. ข้อ 2-ข) — UNIQUE(match_id,user_id) มีแถวเดียวต่อคน จึง UPDATE แทน INSERT
 * ล้างผลตัดสินเก่าทั้งหมด · คืน false = แถวไม่ได้อยู่ในสถานะ rejected แล้ว (มีคนเช็คอินทับไปก่อน)
 */
export async function reCheckin(checkinId: number, input: Omit<InsertCheckinInput, 'matchId' | 'userId'>): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
        `UPDATE match_checkins
         SET method = ?, match_checkin_status = ?, document_type = ?, document_s3_key = ?,
             verified_by_referee_id = ?, verified_at = ${input.verifiedByRefereeId ? 'NOW()' : 'NULL'},
             note = ?, rejection_reason = NULL, checked_in_at = NOW()
         WHERE match_checkin_id = ? AND match_checkin_status = 'rejected'`,
        [input.method, input.status, input.documentType, input.documentS3Key,
         input.verifiedByRefereeId ?? null, input.note ?? null, checkinId]
    );
    return result.affectedRows === 1;
}

export async function countMatchesByTournament(tournamentId: number): Promise<number> {
    const [rows] = await pool.query<({ cnt: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS cnt FROM matches WHERE tournament_id = ?`,
        [tournamentId]
    );
    return rows[0]?.cnt ?? 0;
}

type InsertMatchInput = {
    tournamentId: number;
    roundNumber: number | null;
    teamAId: number | null;
    teamBId: number | null;
    mode: 'onsite' | 'online';
};

// mode ดึงจาก sport_types.default_mode ของทัวร์นาเมนต์นั้น (M01 ไม่มีช่องให้ organizer เลือกเอง
// การแก้ทีละแมตช์ทีหลังต้องรอ M08 ซึ่งเป็น Sprint #2 ยังไม่ได้ทำ — ต้องคุยทีม)
export async function insertMatchTx(conn: PoolConnection, input: InsertMatchInput): Promise<number> {
    const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO matches (tournament_id, round_number, team_a_id, team_b_id, match_status, mode)
         VALUES (?, ?, ?, ?, 'scheduled', ?)`,
        [input.tournamentId, input.roundNumber, input.teamAId, input.teamBId, input.mode]
    );
    return result.insertId;
}

export async function updateMatchNextMatchIdTx(conn: PoolConnection, matchId: number, nextMatchId: number): Promise<void> {
    await conn.query(
        `UPDATE matches SET next_match_id = ? WHERE match_id = ?`,
        [nextMatchId, matchId]
    );
}

export async function updateMatchLoserNextMatchIdTx(conn: PoolConnection, matchId: number, loserNextMatchId: number): Promise<void> {
    await conn.query(
        `UPDATE matches SET loser_next_match_id = ? WHERE match_id = ?`,
        [loserNextMatchId, matchId]
    );
}

// M12 เช็คก่อน insert ว่าเคยเช็คอินแล้วหรือยัง (ตอบ 200 พร้อมแถวเดิม)
// กรณียิงพร้อมกันเป๊ะ UNIQUE(match_id, user_id) จาก migration 008 กันไว้ที่ DB อีกชั้น (insertCheckin คืน null)
export async function findCheckinByMatchAndUser(matchId: number, userId: number): Promise<MatchCheckinRow | null> {
    const [rows] = await pool.query<(MatchCheckinRow & RowDataPacket)[]>(
        `SELECT * FROM match_checkins WHERE match_id = ? AND user_id = ? LIMIT 1`,
        [matchId, userId]
    );
    return rows[0] ?? null;
}

/**
 * คนนี้ถูกทีมส่งลงแข่งในแมตช์นี้ไหม (ใช้กับ M12 เช็คอิน และ M16 ขอลิงก์อัปรูป)
 * ★ เดิมถามแค่ "อยู่ในทีมไหม" — สมาชิกที่ไม่ได้ถูกส่งลงแข่งจึงเช็คอินได้ (มติ 19 ก.ย. 2569)
 */
export async function isRegisteredPlayerOfMatch(userId: number, matchId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1
         FROM matches m
         JOIN tournament_applications ta ON ta.tournament_id = m.tournament_id
              AND ta.team_id IN (m.team_a_id, m.team_b_id)
              AND ta.tournament_application_status = 'approved'
         JOIN application_players ap ON ap.tournament_application_id = ta.tournament_application_id
              AND ap.user_id = ?
         WHERE m.match_id = ?
         LIMIT 1`,
        [userId, matchId]
    );
    return rows.length > 0;
}

export type MatchLineupRow = {
    team_id: number;
    user_id: number;
    full_name: string;
    profile_image_key: string | null;
    match_checkin_status: 'success' | 'rejected' | 'exception' | 'pending' | null;
    checked_in_at: Date | null;
};

/** M19 — รายชื่อผู้เล่นที่ลงแข่งของทั้งสองทีม พร้อมสถานะเช็คอินของแมตช์นี้ */
export async function findLineupsByMatch(matchId: number): Promise<MatchLineupRow[]> {
    const [rows] = await pool.query<(MatchLineupRow & RowDataPacket)[]>(
        `SELECT ta.team_id, u.user_id, u.full_name, u.profile_image_key,
                mc.match_checkin_status, mc.checked_in_at
         FROM matches m
         JOIN tournament_applications ta ON ta.tournament_id = m.tournament_id
              AND ta.team_id IN (m.team_a_id, m.team_b_id)
              AND ta.tournament_application_status = 'approved'
         JOIN application_players ap ON ap.tournament_application_id = ta.tournament_application_id
         JOIN users u ON u.user_id = ap.user_id
         LEFT JOIN match_checkins mc ON mc.match_id = m.match_id AND mc.user_id = u.user_id
         WHERE m.match_id = ?
         ORDER BY ta.team_id, u.full_name`,
        [matchId]
    );
    return rows;
}

type InsertCheckinInput = {
    matchId: number;
    userId: number;
    method: 'qr_onsite' | 'photo_online' | 'manual_by_referee';
    status: 'success' | 'pending' | 'exception';
    documentType: 'student_id' | 'national_id' | null;
    documentS3Key: string | null;
    verifiedByRefereeId?: number;   // manual_by_referee: กรรมการที่กดให้ + verified_at = NOW()
    note?: string | null;           // M19 เหตุผลที่อนุโลม — คอลัมน์ note (migration 015) ไม่ใช่ rejection_reason
};

/** /me/matches (20 ก.ย.) — แมตช์ที่ user มีชื่อลงแข่ง (application_players) ทุกทัวร์ */
export type MyPlayerMatchRow = {
    match_id: number; round_number: number | null; scheduled_time: Date | null; scheduled_end_time: Date | null;
    venue: string | null; mode: MatchRow['mode']; match_status: MatchRow['match_status'];
    tournament_id: number; tournament_name: string; sport_type_id: number;
    team_a_id: number | null; team_a_name: string | null; team_b_id: number | null; team_b_name: string | null;
    my_team_id: number;
};

export async function findMatchesOfPlayer(userId: number): Promise<MyPlayerMatchRow[]> {
    // มีชื่อในรายชื่อลงแข่ง (application_players ของใบสมัคร approved) ของทีมที่อยู่ในแมตช์ — Q5-ก
    const [rows] = await pool.query<(MyPlayerMatchRow & RowDataPacket)[]>(
        `SELECT m.match_id, m.round_number, m.scheduled_time, m.scheduled_end_time, m.venue, m.mode, m.match_status,
                t.tournament_id, t.name AS tournament_name, t.sport_type_id,
                ta_team.team_id AS team_a_id, ta_team.name AS team_a_name, tb.team_id AS team_b_id, tb.name AS team_b_name,
                MIN(ta.team_id) AS my_team_id
         FROM application_players ap
         JOIN tournament_applications ta ON ta.tournament_application_id = ap.tournament_application_id
              AND ta.tournament_application_status = 'approved'
         JOIN matches m ON m.tournament_id = ta.tournament_id AND (m.team_a_id = ta.team_id OR m.team_b_id = ta.team_id)
         JOIN tournaments t ON t.tournament_id = m.tournament_id
         LEFT JOIN teams ta_team ON ta_team.team_id = m.team_a_id
         LEFT JOIN teams tb ON tb.team_id = m.team_b_id
         WHERE ap.user_id = ?
         GROUP BY m.match_id, m.round_number, m.scheduled_time, m.scheduled_end_time, m.venue, m.mode, m.match_status,
                  t.tournament_id, t.name, t.sport_type_id, ta_team.team_id, ta_team.name, tb.team_id, tb.name
         ORDER BY m.scheduled_time IS NULL, m.scheduled_time, m.match_id`,
        [userId]
    );
    return rows;
}

/** คืน null ถ้าชน UNIQUE(match_id, user_id) — คนเดียวกันเช็คอินแมตช์นี้ไปแล้ว (service จะดึงแถวเดิมมาตอบแทน) */
export async function insertCheckin(input: InsertCheckinInput): Promise<MatchCheckinRow | null> {
    let result: ResultSetHeader;
    try {
        [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO match_checkins (match_id, user_id, method, match_checkin_status, document_type, document_s3_key,
                                         verified_by_referee_id, verified_at, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ${input.verifiedByRefereeId ? 'NOW()' : 'NULL'}, ?)`,
            [input.matchId, input.userId, input.method, input.status, input.documentType, input.documentS3Key,
             input.verifiedByRefereeId ?? null, input.note ?? null]
        );
    } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') return null;
        throw err;
    }
    const [rows] = await pool.query<(MatchCheckinRow & RowDataPacket)[]>(
        `SELECT * FROM match_checkins WHERE match_checkin_id = ?`,
        [result.insertId]
    );
    return rows[0]!;
}

// ฟังก์ชันของเพื่อน (origin/backend) — เก็บไว้เผื่อโค้ดอื่นเรียกชื่อนี้ (เช่น requireOrganizerOfMatch)
// ต่างจาก findMatchById ของเราตรงที่คืนแถวดิบจาก matches ล้วนๆ ไม่ JOIN ชื่อทีม
export async function findById(matchId: number): Promise<MatchRow | null> {
    const [rows] = await pool.query<(MatchRow & RowDataPacket)[]>(
        'SELECT * FROM matches WHERE match_id = ?', [matchId]
    );
    return rows[0] ?? null;
}

/** แมตช์ตาม id ที่อยู่ในทัวร์นี้จริง — ใช้เช็คตอน F01 ว่า ORG แนบแมตช์ของทัวร์ตัวเองมา */
export async function findByIdsInTournament(tournamentId : number, matchIds : number[]): Promise<MatchRow[]>{
    if(matchIds.length === 0) return [];
    const [rows] = await pool.query<(MatchRow & RowDataPacket)[]>(
        'SELECT * FROM matches WHERE tournament_id = ? AND match_id IN (?) ORDER BY scheduled_time, match_id',
        [tournamentId, matchIds]);
    return rows;
}

export type MatchRefereeCoverageRow =
    Pick<MatchRow, 'match_id' | 'round_number' | 'scheduled_time' | 'scheduled_end_time' | 'mode' | 'match_status'> & {
        // NULL ทั้งชุดถ้าแมตช์ยังไม่มีใครรับ
        tournament_referee_id : number | null,
        user_id : number | null,
        invitation_status : TournamentRefereeRow['invitation_status'] | null,
        is_external : TournamentRefereeRow['is_external'] | null,
        external_approval_status : TournamentRefereeRow['external_approval_status'] | null,
        removed_at : Date | null
    };

/**
 * ทุกแมตช์ของทัวร์ × กรรมการที่รับแมตช์นั้นแล้ว (1 แถวต่อคู่ แมตช์ที่ไม่มีใครรับได้ 1 แถว NULL)
 * ★ ไม่ตัดสิน active ที่นี่ — service ใช้ isActiveReferee()
 */
export async function findRefereeCoverage(tournamentId : number): Promise<MatchRefereeCoverageRow[]>{
    const [rows] = await pool.query<(MatchRefereeCoverageRow & RowDataPacket)[]>(
        `SELECT m.match_id, m.round_number, m.scheduled_time, m.scheduled_end_time, m.mode, m.match_status,
                tr.tournament_referee_id, tr.user_id,
                tr.invitation_status, tr.is_external, tr.external_approval_status, tr.removed_at
         FROM matches m
         LEFT JOIN match_referees mr
           ON mr.match_id = m.match_id AND mr.assignment_status = 'accepted'
         LEFT JOIN tournament_referees tr
           ON tr.tournament_referee_id = mr.tournament_referee_id
         WHERE m.tournament_id = ?
           AND m.match_status <> 'completed'   -- แมตช์ที่จบแล้ว (รวม walkover จากทีมถอนตัว) ไม่ต้องมีกรรมการอีก
         ORDER BY m.scheduled_time, m.match_id, tr.tournament_referee_id`, [tournamentId]);
    return rows;
}

export async function updateRoomCode(matchId : number , roomCode : string | null): Promise<boolean>{
    const [result] = await pool.query<ResultSetHeader>(
        'UPDATE matches SET room_code = ?, updated_at = NOW() WHERE match_id = ?',
        [roomCode, matchId]);
    return result.affectedRows === 1;
}

export async function updateLivestreamUrl(matchId : number , youtubeUrl : string | null): Promise<boolean>{
    const [result] = await pool.query<ResultSetHeader>(
        'UPDATE matches SET livestream_url = ?, updated_at = NOW() WHERE match_id = ?',
        [youtubeUrl, matchId]);
    return result.affectedRows === 1;
}

/** FE-replace-existing-bracket-atomic — แมตช์ของทัวร์ที่ "ใช้งานไปแล้ว": ไม่ใช่ scheduled หรือมีเช็คอิน/ผล → ห้ามจับฉลากซ้ำ */
export async function findBracketUsage(tournamentId: number): Promise<{ match_id: number; match_status: string; checkins: number; results: number }[]> {
    const [rows] = await pool.query<({ match_id: number; match_status: string; checkins: number; results: number } & RowDataPacket)[]>(
        `SELECT m.match_id, m.match_status,
                (SELECT COUNT(*) FROM match_checkins c WHERE c.match_id = m.match_id) AS checkins,
                (SELECT COUNT(*) FROM match_results r WHERE r.match_id = m.match_id) AS results
         FROM matches m WHERE m.tournament_id = ?
         HAVING m.match_status <> 'scheduled' OR checkins > 0 OR results > 0
         ORDER BY m.match_id`,
        [tournamentId]);
    return rows;
}

/**
 * ลบสายทั้งทัวร์ในทรานแซกชันที่ส่งเข้ามา (ลำดับตาม FK): คำขอโอนกรรมการ → กรรมการรายแมตช์ → เช็คอิน/ผล/สถิติ (ควรว่างอยู่แล้ว — guard เช็คก่อน)
 *   → ตัด self-FK next/loser_next และ bracket_nodes.match_id → matches → bracket_nodes → standings
 * ไม่แตะ tournament_applications / tournament_referees (pool กรรมการ) / announcements (match_id → NULL)
 */
export async function clearBracketTx(conn: PoolConnection, tournamentId: number): Promise<{ matchesDeleted: number; nodesDeleted: number }> {
    const q = (sql: string) => conn.query<ResultSetHeader>(sql, [tournamentId]);
    await q(`DELETE rcr FROM referee_change_requests rcr JOIN matches m ON m.match_id IN (rcr.match_a_id, rcr.match_b_id) WHERE m.tournament_id = ?`);
    await q(`DELETE mr FROM match_referees mr JOIN matches m ON m.match_id = mr.match_id WHERE m.tournament_id = ?`);
    await q(`DELETE pv FROM player_match_stat_values pv JOIN player_match_stats ps ON ps.player_match_stat_id = pv.player_match_stat_id JOIN matches m ON m.match_id = ps.match_id WHERE m.tournament_id = ?`);
    await q(`DELETE ps FROM player_match_stats ps JOIN matches m ON m.match_id = ps.match_id WHERE m.tournament_id = ?`);
    await q(`DELETE c FROM match_checkins c JOIN matches m ON m.match_id = c.match_id WHERE m.tournament_id = ?`);
    await q(`DELETE r FROM match_results r JOIN matches m ON m.match_id = r.match_id WHERE m.tournament_id = ?`);
    await q(`DELETE p FROM pickem_predictions p JOIN matches m ON m.match_id = p.match_id WHERE m.tournament_id = ?`);
    await q(`UPDATE announcements a JOIN matches m ON m.match_id = a.match_id SET a.match_id = NULL WHERE m.tournament_id = ?`);
    await q(`UPDATE tournament_feedback f JOIN matches m ON m.match_id = f.match_id SET f.match_id = NULL WHERE m.tournament_id = ?`);
    await q(`UPDATE matches SET next_match_id = NULL, loser_next_match_id = NULL, bracket_node_id = NULL WHERE tournament_id = ?`);
    await q(`UPDATE bracket_nodes SET match_id = NULL WHERE tournament_id = ?`);
    const [m] = await q(`DELETE FROM matches WHERE tournament_id = ?`);
    const [n] = await q(`DELETE FROM bracket_nodes WHERE tournament_id = ?`);
    await q(`DELETE FROM tournament_standings WHERE tournament_id = ?`);
    return { matchesDeleted: m.affectedRows, nodesDeleted: n.affectedRows };
}
