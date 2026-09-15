import pool from '../config/db.js';
import type { MatchRow, MatchCheckinRow, TournamentRefereeRow } from '../types/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';

export type MatchListRow = {
    match_id: number;
    round_number: number | null;
    scheduled_time: Date | null;
    venue: string | null;
    match_status: 'scheduled' | 'checkin_open' | 'in_progress' | 'completed' | 'disputed';
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
            m.match_id, m.round_number, m.scheduled_time, m.venue, m.match_status,
            ta.team_id AS team_a_id, ta.name AS team_a_name, ta.sport_type_id AS team_a_sport_type_id,
            tb.team_id AS team_b_id, tb.name AS team_b_name, tb.sport_type_id AS team_b_sport_type_id
         FROM matches m
         LEFT JOIN teams ta ON m.team_a_id = ta.team_id
         LEFT JOIN teams tb ON m.team_b_id = tb.team_id
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
    'scheduled_time' | 'venue' | 'checkin_open_at' | 'match_status' | 'mode' | 'next_match_id'
> & {
    team_a_name: string | null;
    team_a_sport_type_id: number | null;
    team_b_name: string | null;
    team_b_sport_type_id: number | null;
};

export async function findMatchById(Id: number): Promise<MatchDetailRow | null> {
    const [rows] = await pool.query<(MatchDetailRow & RowDataPacket)[]>(
        `SELECT 
            m.match_id, m.round_number, m.scheduled_time, m.venue, m.match_status, m.tournament_id , m.checkin_open_at , m.mode , m.next_match_id ,
            ta.team_id AS team_a_id, ta.name AS team_a_name, ta.sport_type_id AS team_a_sport_type_id,
            tb.team_id AS team_b_id, tb.name AS team_b_name, tb.sport_type_id AS team_b_sport_type_id
         FROM matches m
         LEFT JOIN teams ta ON m.team_a_id = ta.team_id
         LEFT JOIN teams tb ON m.team_b_id = tb.team_id
         WHERE m.match_id = ?`,
        [Id]
    );
    const match = rows[0];
    return match ?? null;
}

/**
 * แมตช์อื่นที่ "ซ้อนช่วงเวลา" [start, end) กับที่จะตั้ง และใช้ทีมเดียวกันหรือสนามเดียวกัน
 * แมตช์เก่าที่ยังไม่มี end time ถือว่ายาว 1 วินาที (เช็คแค่เริ่มพร้อมกัน) · แมตช์ที่จบแล้วไม่นับ
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
           AND scheduled_time < ?
           AND COALESCE(scheduled_end_time, scheduled_time + INTERVAL 1 SECOND) > ?
           AND (team_a_id IN (?, ?) OR team_b_id IN (?, ?) OR venue = ?)
         LIMIT 1`,
        [excludeMatchId, scheduledEndTime, scheduledTime, teamAId, teamBId, teamAId, teamBId, venue]
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

export async function updateMatchSchedule(matchId: number, scheduledTime: Date, scheduledEndTime: Date, venue: string): Promise<void> {
    await pool.query(
        `UPDATE matches SET scheduled_time = ?, scheduled_end_time = ?, venue = ?, updated_at = NOW() WHERE match_id = ?`,
        [scheduledTime, scheduledEndTime, venue, matchId]
    );
}

export async function  updateMatchStatus(matchId: number, status: 'scheduled' | 'checkin_open' | 'in_progress' | 'completed' | 'disputed' ): Promise<void> {
    await pool.query(
        "UPDATE matches SET match_status = ? , updated_at = NOW() WHERE match_id = ?",
        [status, matchId]
    );
}

export async function openMatchCheckin(matchId: number): Promise<void> {
    await pool.query(
        "UPDATE matches SET match_status = 'checkin_open', checkin_open_at = NOW(), updated_at = NOW() WHERE match_id = ?",
        [matchId]
    );
}

export async function countSuccessfulCheckins(matchId: number, teamId: number | null): Promise<number> {
    if (teamId === null) return 0;
    const [rows] = await pool.query<({ cnt: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS cnt FROM match_checkins mc
         JOIN team_members tm ON mc.user_id = tm.user_id
         WHERE mc.match_id = ? AND tm.team_id = ? AND mc.match_checkin_status = 'success'`,
        [matchId, teamId]
    );
    return rows[0]?.cnt ?? 0;
}

export type MatchCheckinListRow = {
    user_id: number;
    full_name: string;
    method: 'qr_onsite' | 'photo_online' | 'manual_by_referee';
    match_checkin_status: 'success' | 'rejected' | 'exception';
    checked_in_at: Date;
};

export async function findCheckinsByMatch(matchId: number): Promise<MatchCheckinListRow[]> {
    const [rows] = await pool.query<(MatchCheckinListRow & RowDataPacket)[]>(
        `SELECT mc.user_id, u.full_name, mc.method, mc.match_checkin_status, mc.checked_in_at
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

export async function verifyCheckin(checkinId: number, refereeUserId: number): Promise<void> {
    await pool.query(
        `UPDATE match_checkins
         SET match_checkin_status = 'success', verified_by_referee_id = ?, verified_at = NOW()
         WHERE match_checkin_id = ?`,
        [refereeUserId, checkinId]
    );
}

export async function rejectCheckin(checkinId: number, refereeUserId: number, reason: string): Promise<void> {
    await pool.query(
        `UPDATE match_checkins
         SET match_checkin_status = 'rejected', rejection_reason = ?, verified_by_referee_id = ?, verified_at = NOW()
         WHERE match_checkin_id = ?`,
        [reason, refereeUserId, checkinId]
    );
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

// ⚠️ ไม่มี UNIQUE(match_id, user_id) จริงใน schema.sql ทั้งที่ GUIDE อ้างว่ามี (เหมือนเคส C5 ของ tournament_referees)
// เลยต้องเช็คซ้ำที่ฝั่ง service เอง (select ก่อน insert) — มีโอกาสชนกันได้ถ้ายิงพร้อมกันเป๊ะ แต่ยอมรับความเสี่ยงนี้ไปก่อน ต้องคุยทีม
export async function findCheckinByMatchAndUser(matchId: number, userId: number): Promise<MatchCheckinRow | null> {
    const [rows] = await pool.query<(MatchCheckinRow & RowDataPacket)[]>(
        `SELECT * FROM match_checkins WHERE match_id = ? AND user_id = ? LIMIT 1`,
        [matchId, userId]
    );
    return rows[0] ?? null;
}

export async function isUserInTeams(userId: number, teamIds: number[]): Promise<boolean> {
    if (teamIds.length === 0) return false;
    const placeholders = teamIds.map(() => '?').join(', ');
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM team_members WHERE user_id = ? AND team_id IN (${placeholders}) LIMIT 1`,
        [userId, ...teamIds]
    );
    return rows.length > 0;
}

type InsertCheckinInput = {
    matchId: number;
    userId: number;
    method: 'qr_onsite' | 'photo_online';
    status: 'success' | 'exception';
    documentType: 'student_id' | 'national_id' | null;
    documentS3Key: string | null;
};

export async function insertCheckin(input: InsertCheckinInput): Promise<MatchCheckinRow> {
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO match_checkins (match_id, user_id, method, match_checkin_status, document_type, document_s3_key)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [input.matchId, input.userId, input.method, input.status, input.documentType, input.documentS3Key]
    );
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

export async function updateLivestreamUrl(matchId : number , youtubeUrl : string): Promise<boolean>{
    const [result] = await pool.query<ResultSetHeader>(
        'UPDATE matches SET livestream_url = ?, updated_at = NOW() WHERE match_id = ?',
        [youtubeUrl, matchId]);
    return result.affectedRows === 1;
}
