import pool from '../config/db.js';
import type { MatchRow, MatchCheckinRow } from '../types/db.js';
import type { RowDataPacket } from 'mysql2';

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

export async function findMatchesByTournament(tournamentId: number): Promise<MatchListRow[]> {
    const [rows] = await pool.query<(MatchListRow & RowDataPacket)[]>(
        `SELECT 
            m.match_id, m.round_number, m.scheduled_time, m.venue, m.match_status,
            ta.team_id AS team_a_id, ta.name AS team_a_name, ta.sport_type_id AS team_a_sport_type_id,
            tb.team_id AS team_b_id, tb.name AS team_b_name, tb.sport_type_id AS team_b_sport_type_id
         FROM matches m
         LEFT JOIN teams ta ON m.team_a_id = ta.team_id
         LEFT JOIN teams tb ON m.team_b_id = tb.team_id
         WHERE m.tournament_id = ?`,
        [tournamentId]
    );
    return rows;
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

export async function findConflictingMatch(
    excludeMatchId: number,
    scheduledTime: Date,
    venue: string,
    teamAId: number | null,
    teamBId: number | null
): Promise<{ match_id: number } | null> {
    const [rows] = await pool.query<({ match_id: number } & RowDataPacket)[]>(
        `SELECT match_id FROM matches
         WHERE match_id != ?
           AND scheduled_time = ?
           AND (team_a_id IN (?, ?) OR team_b_id IN (?, ?) OR venue = ?)
         LIMIT 1`,
        [excludeMatchId, scheduledTime, teamAId, teamBId, teamAId, teamBId, venue]
    );
    const conflict = rows[0];
    return conflict ?? null;
}

export async function updateMatchSchedule(matchId: number, scheduledTime: Date, venue: string): Promise<void> {
    await pool.query(
        `UPDATE matches SET scheduled_time = ?, venue = ?, updated_at = NOW() WHERE match_id = ?`,
        [scheduledTime, venue, matchId]
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