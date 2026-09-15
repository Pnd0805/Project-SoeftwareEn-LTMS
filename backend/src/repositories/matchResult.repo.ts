import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/db.js';
import type { MatchResultRow, MatchRow, UserRow } from '../types/db.js';
import * as MatchRepo from '../repositories/match.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';

import type { SportStatDefinitionRow , PlayerMatchStatValueRow , TournamentStandingRow , TeamRow} from '../types/db.js';




export async function findById(matchResId : number): Promise<MatchResultRow | null>{
    const [ rows ] = await pool.query<(MatchResultRow & RowDataPacket)[]>(`SELECT * FROM match_results WHERE match_result_id = ?`,[matchResId]);
    return rows[0] ?? null;
}


export async function findmatchResultByMatchId(matchId : number): Promise<MatchResultRow | null>{
    const [ rows ] = await pool.query<(MatchResultRow & RowDataPacket)[]>(`SELECT * FROM match_results WHERE match_id = ?`,[matchId]);
    return rows[0] ?? null;
}



export async function submitMatchResult(matchId : number , winnerId : number , score : Record<string , number> , userId:number , role : 'team_leader' | 'referee'): Promise<number>{
    const [ results ] = await pool.query<ResultSetHeader>(`INSERT INTO match_results(match_id,winner_team_id,score_data,submitted_by_user_id,submitted_role,match_result_status)
                                                           VALUES(? , ? , ? , ? ,? ,?)
                                                           ON DUPLICATE KEY UPDATE
                                                                winner_team_id = VALUES(winner_team_id),
                                                                score_data = VALUES(score_data),
                                                                submitted_by_user_id = VALUES(submitted_by_user_id),
                                                                submitted_role = VALUES(submitted_role)`,
                                                            [matchId , winnerId , JSON.stringify(score) , userId , role , 'submitted']);
    
    return results.insertId
}


export async function verifyMatchResult(matchResId : number, matchId : number , userId : number , point : number ){
    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction()

        await conn.query<ResultSetHeader>(`UPDATE match_results SET match_result_status = ? , verified_by_user_id = ? , verified_at = NOW()
                                           WHERE match_result_id = ?`, ['verified' , userId , matchResId]);
        await conn.query<ResultSetHeader>(`UPDATE matches SET match_status = ? , updated_at = NOW()
                                           WHERE match_id = ?` , ['completed' ,matchId ]);

        const matchRes = await findById(matchResId);
        const match = await MatchRepo.findById(matchId);

        const loser_id = match!.team_a_id === matchRes!.winner_team_id ? match!.team_b_id : match!.team_a_id;

        if(match!.next_match_id !== null){
            const [res1] = await conn.query<ResultSetHeader>(`UPDATE matches SET team_a_id = ?
                                                            WHERE match_id = ? AND tournament_id = ? AND team_a_id IS NULL`
                                                            ,[ matchRes!.winner_team_id , match!.next_match_id , match!.tournament_id]);
            if(res1.affectedRows === 0){
                await conn.query<ResultSetHeader>(`UPDATE matches SET team_b_id = ?
                                                WHERE match_id = ? AND tournament_id = ? AND team_b_id IS NULL`
                                                ,[ matchRes!.winner_team_id , match!.next_match_id , match!.tournament_id]);
            }
        }

        if(match!.loser_next_match_id !== null){
            const [res2] = await conn.query<ResultSetHeader>(`UPDATE matches SET team_a_id = ?
                                                            WHERE match_id = ? AND tournament_id = ? AND team_a_id IS NULL`
                                                            ,[ loser_id , match!.loser_next_match_id , match!.tournament_id]);
            if(res2.affectedRows === 0){
                await conn.query<ResultSetHeader>(`UPDATE matches SET team_b_id = ?
                                                WHERE match_id = ? AND tournament_id = ? AND team_b_id IS NULL`
                                                ,[ loser_id , match!.loser_next_match_id , match!.tournament_id]);
            }
        }

        const tour = await TournamentRepo.findTournamentById(match!.tournament_id);
        const sportId = tour!.sport_type_id;

        await conn.query<ResultSetHeader>(
            `INSERT INTO tournament_standings (tournament_id, team_id, played, won, lost, points)
            VALUES (?, ?, 1, 1, 0, ?)
            ON DUPLICATE KEY UPDATE played=played+1, won=won+1, points=points+?, updated_at=NOW()`,
            [match!.tournament_id, matchRes!.winner_team_id, point, point]);

        await conn.query<ResultSetHeader>(
            `INSERT INTO tournament_standings (tournament_id, team_id, played, won, lost, points)
            VALUES (?, ?, 1, 0, 1, 0)
            ON DUPLICATE KEY UPDATE played=played+1, lost=lost+1, updated_at=NOW()`,
            [match!.tournament_id, loser_id]);

        await conn.query<ResultSetHeader>(`INSERT INTO player_profile_stats (user_id, sport_type_id, matches_played, wins, losses, championships)
                                           SELECT user_id, ?, 1, 1, 0, 0 FROM team_members WHERE team_id = ?
                                           ON DUPLICATE KEY UPDATE 
                                           matches_played = matches_played + 1, wins = wins + 1 , updated_at = NOW()`, [sportId , matchRes!.winner_team_id ]);
        
        await conn.query<ResultSetHeader>(`INSERT INTO player_profile_stats (user_id, sport_type_id, matches_played, wins, losses, championships)
                                           SELECT user_id, ?, 1, 0, 1, 0 FROM team_members WHERE team_id = ?
                                           ON DUPLICATE KEY UPDATE
                                           matches_played = matches_played + 1, losses = losses + 1 , updated_at = NOW()`, [sportId , loser_id]);
        
        await conn.query<ResultSetHeader>(
            `INSERT INTO audit_logs(user_id, action_type, entity_type, entity_id, details)
            VALUES(?, ?, ?, ?, ?)`,
            [userId, 'match_result_verified', 'match', matchId, JSON.stringify({ winnerId: matchRes!.winner_team_id, verifiedBy: userId })]
        );

        await conn.commit();
        return;

    }catch(err){
        await conn.rollback();
        throw err

    }finally{
        conn.release();
    }

}


export async function disputeMatchResult(matchResId : number, matchId : number , userId : number , reason : string){
    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();

        await conn.query<ResultSetHeader>(`UPDATE match_results SET dispute_reason = ? , dispute_raised_by = ? , dispute_raised_at = NOW() , match_result_status = ?
                                        WHERE match_result_id = ? AND match_id = ?` , [reason , userId , 'disputed' , matchResId , matchId]);
        await conn.query<ResultSetHeader>(`UPDATE matches SET match_status = ? WHERE match_id = ?`,['disputed' , matchId]);

        await conn.commit();

    }catch(err){
        await conn.rollback();
        throw err;
    }finally{
        await conn.release();
    }
}


export async function resolveMatchResult(matchResId : number , matchId : number , resolution : 'uphold' | 'reject' , userId : number , resolutionNote : string){
    let matchResStatus: string = "";
    let matchStatus: string = "";
    if(resolution === 'uphold'){
        matchResStatus = 'verified';
        matchStatus = 'completed'

    }else if (resolution === 'reject'){
        matchResStatus = 'rejected';
        matchStatus = 'result_rejected';
    }

    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();

        await conn.query<ResultSetHeader>(`UPDATE match_results SET dispute_resolved_by = ? , dispute_resolution = ? , match_result_status = ? , dispute_resolved_at = NOW()
                                        WHERE match_result_id = ?`,[userId , resolutionNote , matchResStatus , matchResId]);

        await conn.query<ResultSetHeader>(`UPDATE matches SET match_status = ? , updated_at = NOW() WHERE match_id = ?`,[matchStatus , matchId]);

        await conn.commit();
    }catch(err){
        await conn.rollback();
        throw err;
    }finally{
        await conn.release();
    }
}


//matchId, winnerTeamId, scoreData, isAmended, amendedAt, amendReason, verifiedAt }`

export async function findVerifiedResultByMatchId(matchId : number): Promise<MatchResultRow | null>{
    const [ rows ] = await pool.query<(MatchResultRow & RowDataPacket)[]>(`SELECT match_id , winner_team_id , score_data , amend_reason , amended_at , verified_at
                                                                           FROM match_results WHERE match_id = ? AND match_result_status = ?`, [matchId , 'verified']);
    return rows[0] ?? null                                                       
}


export async function recordPlayerStat(matchId :number , userId : number , teamId : number , refId : number , values : { statDefinitionId: number, value: number }[]){
    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();

        const [ results ] = await conn.query<ResultSetHeader>(`INSERT INTO player_match_stats(match_id , user_id , team_id , recorded_by_referee_id)
                                            VALUES(?, ?, ?, ?)
                                            ON DUPLICATE KEY UPDATE
                                                recorded_by_referee_id = VALUES(recorded_by_referee_id),
                                                player_match_stat_id = LAST_INSERT_ID(player_match_stat_id)`
                                            ,[ matchId , userId ,teamId , refId]);

        for(const v of values){
            await conn.query<ResultSetHeader>(`INSERT INTO player_match_stat_values(player_match_stat_id , sport_stat_definition_id , value_int)
                                                VALUES(? , ? ,?)
                                                ON DUPLICATE KEY UPDATE
                                                    value_int = VALUES(value_int) + value_int`,
                                                [results.insertId , v.statDefinitionId , v.value])
        }

        await conn.commit();
    }catch(err){
        await conn.rollback();
        throw err;
    }finally{
        await conn.release();
    }
}

export type playerStat = {
    statKey: SportStatDefinitionRow['stat_key'],
    statLabelTh: SportStatDefinitionRow['stat_label_th'],
    value: PlayerMatchStatValueRow['value_int']
}

export async function allPlayerInMatch(matchId : number) : Promise<{userId : number , fullName : string}[]>{
    const [rows] = await pool.query<({userId : number , fullName : string} & RowDataPacket)[]>(`
                                        SELECT u.user_id as userId , u.full_name as fullName
                                        FROM users u JOIN team_members tm
                                        ON u.user_id = tm.user_id
                                        JOIN matches m ON tm.team_id = m.team_a_id OR tm.team_id = m.team_b_id
                                        WHERE m.match_id = ?`,[matchId]);
    return rows

}
export async function showPlayerStat(matchId : number , userId : number) : Promise< playerStat[]>{
    const [ rows ] = await pool.query<(playerStat & RowDataPacket)[]>(`SELECT s.stat_key as statKey, s.stat_label_th as statLabelTh , pv.value_int as value
                                                                                    FROM sport_stat_definitions s JOIN player_match_stat_values pv
                                                                                    ON s.sport_stat_definition_id = pv.sport_stat_definition_id
                                                                                    JOIN player_match_stats p ON p.player_match_stat_id = pv.player_match_stat_id
                                                                                    WHERE p.match_id = ? AND p.user_id = ?`,[matchId , userId]);

    return rows;
}

export type FinalMatchResult = {
    winner_team_id : number,
    team_a_id : number,
    team_b_id : number,
    score_data : Record<string , number> | null
}

/** แมตช์สุดท้ายของบราเคต = แมตช์ที่ next_match_id เป็น NULL (ชนะแล้วไม่มีที่ให้ไปต่อ) และต้อง verified/completed แล้ว */
export async function findFinalMatchResult(tourId : number) : Promise<FinalMatchResult | null>{
    const [rows] = await pool.query<(FinalMatchResult & RowDataPacket)[]>(
        `SELECT mr.winner_team_id, m.team_a_id, m.team_b_id, mr.score_data
         FROM matches m JOIN match_results mr ON mr.match_id = m.match_id
         WHERE m.next_match_id IS NULL AND m.match_status = 'completed' AND m.tournament_id = ?`,
        [tourId]);
    return rows[0] ?? null;
}

/** S11 — ทีม/ผู้เล่นนับเฉพาะที่ application ได้รับ approved แล้ว (ไม่นับ pending/rejected) */
export async function countApprovedTeams(tourId : number) : Promise<number>{
    const [rows] = await pool.query<(RowDataPacket & { cnt : number })[]>(
        `SELECT COUNT(*) AS cnt FROM tournament_applications
         WHERE tournament_id = ? AND tournament_application_status = 'approved'`,
        [tourId]);
    return rows[0]!.cnt;
}

export async function countApprovedPlayers(tourId : number) : Promise<number>{
    const [rows] = await pool.query<(RowDataPacket & { cnt : number })[]>(
        `SELECT COUNT(DISTINCT tm.user_id) AS cnt
         FROM team_members tm
         JOIN tournament_applications ta ON ta.team_id = tm.team_id
         WHERE ta.tournament_id = ? AND ta.tournament_application_status = 'approved'`,
        [tourId]);
    return rows[0]!.cnt;
}

export async function countMatches(tourId : number) : Promise<{ matchCount : number , matchesCompleted : number }>{
    const [rows] = await pool.query<(RowDataPacket & { matchCount : number , matchesCompleted : number })[]>(
        `SELECT COUNT(*) AS matchCount,
                SUM(CASE WHEN match_status = 'completed' THEN 1 ELSE 0 END) AS matchesCompleted
         FROM matches WHERE tournament_id = ?`,
        [tourId]);
    return { matchCount : rows[0]!.matchCount , matchesCompleted : Number(rows[0]!.matchesCompleted ?? 0) };
}

export type StandingRow = Pick<TournamentStandingRow , 'won' | 'lost'> & Pick<TeamRow , 'team_id' | 'name' | 'sport_type_id'>;

/** S12 — เรียงตามแต้มมาก่อน แล้วค่อยชนะมาก (ไม่มี pointsFor/pointsAgainst — ดู GUIDE/07 A11) */
export async function findStandings(tourId : number) : Promise<StandingRow[]>{
    const [rows] = await pool.query<(StandingRow & RowDataPacket)[]>(
        `SELECT t.team_id, t.name, t.sport_type_id, ts.won, ts.lost
         FROM tournament_standings ts
         JOIN teams t ON t.team_id = ts.team_id
         WHERE ts.tournament_id = ?
         ORDER BY ts.points DESC, ts.won DESC`,
        [tourId]);
    return rows;
}