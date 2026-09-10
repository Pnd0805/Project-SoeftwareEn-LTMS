import pool from '../config/db.js';
import type { MatchRow} from '../types/db.js';
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