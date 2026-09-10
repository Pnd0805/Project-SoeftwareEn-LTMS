import pool from '../config/db.js';
import type { MatchRow } from '../types/db.js';
import type { RowDataPacket, ResultSetHeader  } from 'mysql2';

export async function findById(matchId : number): Promise<MatchRow | null>{
    const [rows] = await pool.query<(MatchRow & RowDataPacket)[]>(
        'SELECT * FROM matches WHERE match_id = ?', [matchId]);
    return rows[0] ?? null;
}

/** กรรมการมากสุดที่ต้องใช้พร้อมกัน ณ ช่วงใดช่วงหนึ่งของตารางแข่ง */
export async function findMaxConcurrentRefereeNeed(
        tournamentId : number, refereesPerOnsiteMatch : number): Promise<number>{
    const [rows] = await pool.query<({ need : number | string } & RowDataPacket)[]>(
        `SELECT COALESCE(MAX(need), 0) AS need FROM (
             SELECT p.match_id,
                    SUM(CASE WHEN m.mode = 'onsite' THEN ? ELSE 1 END) AS need
             FROM matches p
             JOIN matches m
               ON m.tournament_id  = p.tournament_id
              AND m.scheduled_time <= p.scheduled_time
              AND p.scheduled_time <  m.scheduled_end_time
             WHERE p.tournament_id = ?
               AND p.scheduled_time IS NOT NULL
               AND p.scheduled_end_time IS NOT NULL
             GROUP BY p.match_id
         ) x`,
        [refereesPerOnsiteMatch, tournamentId]);
    return Number(rows[0]?.need ?? 0);
}