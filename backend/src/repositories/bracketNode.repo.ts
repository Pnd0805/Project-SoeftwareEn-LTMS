import pool from '../config/db.js';
import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

type InsertBracketNodeInput = {
    tournamentId: number;
    nodeCode: string;
    bracketType: 'winners' | 'losers' | 'grand_final';
    round: number | null;
    matchNumber: number;
    teamAId: number | null;
    teamBId: number | null;
    matchId: number | null;
};

export async function insertBracketNodeTx(conn: PoolConnection, input: InsertBracketNodeInput): Promise<number> {
    const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO bracket_nodes
            (tournament_id, node_code, bracket_type, round, match_number, team_a_id, team_b_id, match_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.tournamentId, input.nodeCode, input.bracketType, input.round, input.matchNumber, input.teamAId, input.teamBId, input.matchId]
    );
    return result.insertId;
}

export type BracketNodeListRow = {
    bracket_node_id: number;
    bracket_type: 'winners' | 'losers' | 'grand_final';
    round: number | null;
    match_number: number;
    team_a_id: number | null;
    team_a_name: string | null;
    team_a_sport_type_id: number | null;
    team_b_id: number | null;
    team_b_name: string | null;
    team_b_sport_type_id: number | null;
    match_id: number | null;
    match_status: 'scheduled' | 'checkin_open' | 'in_progress' | 'completed' | 'disputed' | null;
    advances_to_node_id: number | null;
};

export async function findNodesByTournament(tournamentId: number): Promise<BracketNodeListRow[]> {
    const [rows] = await pool.query<(BracketNodeListRow & RowDataPacket)[]>(
        `SELECT
            n.bracket_node_id, n.bracket_type, n.round, n.match_number,
            n.team_a_id, ta.name AS team_a_name, ta.sport_type_id AS team_a_sport_type_id,
            n.team_b_id, tb.name AS team_b_name, tb.sport_type_id AS team_b_sport_type_id,
            n.match_id, m.match_status,
            next_node.bracket_node_id AS advances_to_node_id
         FROM bracket_nodes n
         LEFT JOIN teams ta ON n.team_a_id = ta.team_id
         LEFT JOIN teams tb ON n.team_b_id = tb.team_id
         LEFT JOIN matches m ON n.match_id = m.match_id
         LEFT JOIN bracket_nodes next_node ON next_node.match_id = m.next_match_id
         WHERE n.tournament_id = ?
         ORDER BY n.round, n.match_number`,
        [tournamentId]
    );
    return rows;
}
