import pool from '../config/db.js';
import type { RowDataPacket } from 'mysql2';
import type { TournamentRow } from '../types/db.js';

export type CareerTournamentRow = {
    tournament_id: number;
    tournament_name: string;
    sport_type_id: number;
    tournament_status: TournamentRow['tournament_status'];
    team_id: number;
    team_name: string;
    played: number;
    wins: number;
    losses: number;
    champion: number;
};

export async function findCareerByUser(userId: number): Promise<CareerTournamentRow[]> {
    const [rows] = await pool.query<(CareerTournamentRow & RowDataPacket)[]>(
        `SELECT
            t.tournament_id,
            t.name AS tournament_name,
            t.sport_type_id,
            t.tournament_status,
            ta.team_id,
            tm.name AS team_name,
            COUNT(mr.match_id) AS played,
            SUM(CASE WHEN mr.winner_team_id = ta.team_id THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN mr.winner_team_id IS NOT NULL AND mr.winner_team_id <> ta.team_id THEN 1 ELSE 0 END) AS losses,
            CASE WHEN t.champion_team_id = ta.team_id THEN 1 ELSE 0 END AS champion
         FROM application_players ap
         JOIN tournament_applications ta ON ta.tournament_application_id = ap.tournament_application_id
         JOIN tournaments t ON t.tournament_id = ta.tournament_id
         JOIN teams tm ON tm.team_id = ta.team_id
         LEFT JOIN matches m
           ON m.tournament_id = ta.tournament_id
          AND (m.team_a_id = ta.team_id OR m.team_b_id = ta.team_id)
         LEFT JOIN match_results mr
           ON mr.match_id = m.match_id
          AND mr.match_result_status = 'verified'
         WHERE ap.user_id = ?
           AND ta.tournament_application_status = 'approved'
           AND t.deleted_at IS NULL
         GROUP BY t.tournament_id, t.name, t.sport_type_id, t.tournament_status,
                  t.champion_team_id, ta.team_id, tm.name
         ORDER BY COALESCE(t.completed_at, t.event_end_date, t.event_start_date) DESC, t.tournament_id DESC`,
        [userId]
    );
    return rows;
}
