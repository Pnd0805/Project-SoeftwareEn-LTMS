import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import pool from '../config/db.js';
import type { MatchResultRow, MatchRow, UserRow } from '../types/db.js';
import * as MatchRepo from '../repositories/match.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import * as BracketNodeRepo from '../repositories/bracketNode.repo.js';

import type { SportStatDefinitionRow , PlayerMatchStatValueRow , TournamentStandingRow , TeamRow} from '../types/db.js';
import * as PickemRepo from './pickem.repo.js';




export async function findById(matchResId : number): Promise<MatchResultRow | null>{
    const [ rows ] = await pool.query<(MatchResultRow & RowDataPacket)[]>(`SELECT * FROM match_results WHERE match_result_id = ?`,[matchResId]);
    return rows[0] ?? null;
}


export async function findmatchResultByMatchId(matchId : number): Promise<MatchResultRow | null>{
    const [ rows ] = await pool.query<(MatchResultRow & RowDataPacket)[]>(`SELECT * FROM match_results WHERE match_id = ?`,[matchId]);
    return rows[0] ?? null;
}



export type DisputeDetailRow = MatchResultRow & { raised_by_name : string | null };

/** S03b — รายละเอียดข้อโต้แย้งพร้อมชื่อผู้ค้าน (ผู้จัดต้องใช้ตัดสิน) */
export async function findDisputeByMatchId(matchId : number): Promise<DisputeDetailRow | null>{
    const [ rows ] = await pool.query<(DisputeDetailRow & RowDataPacket)[]>(
        `SELECT r.* , u.full_name AS raised_by_name
         FROM match_results r LEFT JOIN users u ON u.user_id = r.dispute_raised_by
         WHERE r.match_id = ?`, [matchId]);
    return rows[0] ?? null;
}

export async function submitMatchResult(matchId : number , winnerId : number , score : Record<string , number> , userId:number , role : 'team_leader' | 'referee'): Promise<number>{
    const [ results ] = await pool.query<ResultSetHeader>(`INSERT INTO match_results(match_id,winner_team_id,score_data,submitted_by_user_id,submitted_role,match_result_status,submitted_at)
                                                           VALUES(? , ? , ? , ? ,? ,? , NOW())
                                                           ON DUPLICATE KEY UPDATE
                                                                winner_team_id = VALUES(winner_team_id),
                                                                score_data = VALUES(score_data),
                                                                submitted_by_user_id = VALUES(submitted_by_user_id),
                                                                submitted_role = VALUES(submitted_role),
                                                                match_result_status = 'submitted',
                                                                submitted_at = NOW(),   -- ส่งใหม่ = นาฬิกาเริ่มใหม่ (created_at ยังเป็นครั้งแรก)
                                                                verified_by_user_id = NULL, verified_at = NULL`,   // B4: ส่งใหม่หลัง reject เริ่มวงจร verify ใหม่
                                                            [matchId , winnerId , JSON.stringify(score) , userId , role , 'submitted']);
    
    return results.insertId
}


/** ประตูของทีมจาก score_data ({"<teamId>": n}) — ไม่มี/ไม่ใช่ตัวเลข = 0 */
function goalsOf(score : Record<string, number> | null | undefined, teamId : number): number{
    const v = score?.[String(teamId)];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * standings ± 1 แมตช์ (sign = +1 บวก / -1 ถอน) — B3: เก็บประตูได้/เสียไว้ tie-break (migration 021)
 * ใช้ร่วมกันโดย verify/amend/uphold (บวก) และ reject/amend (ถอน) ให้ตรงกันเสมอ
 */
export async function standingsTx(conn : PoolConnection, tournamentId : number, winnerId : number, loserId : number, point : number,
                                  score : Record<string, number> | null, sign : 1 | -1){
    const gw = goalsOf(score, winnerId), gl = goalsOf(score, loserId);
    if(sign === 1){
        await conn.query<ResultSetHeader>(
            `INSERT INTO tournament_standings (tournament_id, team_id, played, won, lost, points, goals_for, goals_against)
             VALUES (?, ?, 1, 1, 0, ?, ?, ?)
             ON DUPLICATE KEY UPDATE played=played+1, won=won+1, points=points+?, goals_for=goals_for+?, goals_against=goals_against+?, updated_at=NOW()`,
            [tournamentId, winnerId, point, gw, gl, point, gw, gl]);
        await conn.query<ResultSetHeader>(
            `INSERT INTO tournament_standings (tournament_id, team_id, played, won, lost, points, goals_for, goals_against)
             VALUES (?, ?, 1, 0, 1, 0, ?, ?)
             ON DUPLICATE KEY UPDATE played=played+1, lost=lost+1, goals_for=goals_for+?, goals_against=goals_against+?, updated_at=NOW()`,
            [tournamentId, loserId, gl, gw, gl, gw]);
    }else{
        await conn.query<ResultSetHeader>(
            `UPDATE tournament_standings SET played = GREATEST(played - 1, 0), won = GREATEST(won - 1, 0), points = GREATEST(points - ?, 0),
                    goals_for = GREATEST(goals_for - ?, 0), goals_against = GREATEST(goals_against - ?, 0), updated_at = NOW()
             WHERE tournament_id = ? AND team_id = ?`, [point, gw, gl, tournamentId, winnerId]);
        await conn.query<ResultSetHeader>(
            `UPDATE tournament_standings SET played = GREATEST(played - 1, 0), lost = GREATEST(lost - 1, 0),
                    goals_for = GREATEST(goals_for - ?, 0), goals_against = GREATEST(goals_against - ?, 0), updated_at = NOW()
             WHERE tournament_id = ? AND team_id = ?`, [gl, gw, tournamentId, loserId]);
    }
}

/**
 * ผลของ "ทีมนี้ชนะ" ที่ต้องเกิดพร้อมกันเสมอ — ใช้ทั้ง S02 verify และ S04 amend (B4)
 *   เดินสาย (ผู้ชนะ→next, ผู้แพ้→loser_next + sync bracket_nodes) · standings (+ประตู B3) · player_profile_stats
 */
async function applyOutcomeTx(conn : PoolConnection, match : MatchRow, winnerId : number, loserId : number, sportId : number, point : number,
                              score : Record<string, number> | null){
    for(const [teamId, nextId] of [[winnerId, match.next_match_id], [loserId, match.loser_next_match_id]] as const){
        if(nextId === null) continue;
        const [a] = await conn.query<ResultSetHeader>(`UPDATE matches SET team_a_id = ? WHERE match_id = ? AND tournament_id = ? AND team_a_id IS NULL`,
                                                      [teamId, nextId, match.tournament_id]);
        if(a.affectedRows === 0){
            await conn.query<ResultSetHeader>(`UPDATE matches SET team_b_id = ? WHERE match_id = ? AND tournament_id = ? AND team_b_id IS NULL`,
                                              [teamId, nextId, match.tournament_id]);
        }
        await BracketNodeRepo.syncNodeTeamsFromMatchTx(conn, nextId);   // B2: หน้าสายเห็นผู้ชนะในรอบถัดไป
    }

    await standingsTx(conn, match.tournament_id, winnerId, loserId, point, score, 1);

    // player stats ให้เฉพาะคนที่ทีมส่งลงแข่งในทัวร์นี้ (application_players — มติ 19 ก.ย.) ไม่ใช่ทุกคนในคลังทีม
    for(const [teamId, won] of [[winnerId, 1], [loserId, 0]] as const){
        await conn.query<ResultSetHeader>(`INSERT INTO player_profile_stats (user_id, sport_type_id, matches_played, wins, losses, championships)
                                           SELECT ap.user_id, ?, 1, ?, ?, 0 FROM application_players ap
                                           JOIN tournament_applications ta ON ta.tournament_application_id = ap.tournament_application_id
                                           WHERE ta.tournament_id = ? AND ta.team_id = ? AND ta.tournament_application_status = 'approved'
                                           ON DUPLICATE KEY UPDATE
                                           matches_played = matches_played + 1, wins = wins + ?, losses = losses + ?, updated_at = NOW()`,
                                           [sportId, won, 1 - won, match.tournament_id, teamId, won, 1 - won]);
    }

    // C7 Pick'em — ผลยืนยันแล้วเท่านั้นที่ให้แต้ม (spec 08 §6) · ทรานแซกชันเดียวกับผล พังพร้อมกัน
    await PickemRepo.settleTx(conn, match.match_id, winnerId);
}

/**
 * B4 — ถอนผลที่ verify ไปแล้ว (กลับด้าน applyOutcomeTx) ก่อน reject/amend
 * service ต้องเช็คก่อนว่าแมตช์ถัดไปยัง scheduled (ไม่งั้นทีมที่ถูกเอาออกอาจแข่ง/บายไปแล้ว)
 * player stats ถอนตามรายชื่อลงแข่ง (application_players) ซึ่งล็อกหลัง approved · GREATEST(0) กันติดลบ
 */
async function undoOutcomeTx(conn : PoolConnection, match : MatchRow, winnerId : number, loserId : number, sportId : number, point : number,
                             score : Record<string, number> | null){
    for(const [teamId, nextId] of [[winnerId, match.next_match_id], [loserId, match.loser_next_match_id]] as const){
        if(nextId === null) continue;
        await conn.query<ResultSetHeader>(`UPDATE matches SET team_a_id = NULL WHERE match_id = ? AND team_a_id = ?`, [nextId, teamId]);
        await conn.query<ResultSetHeader>(`UPDATE matches SET team_b_id = NULL WHERE match_id = ? AND team_b_id = ?`, [nextId, teamId]);
        await BracketNodeRepo.syncNodeTeamsFromMatchTx(conn, nextId);
    }

    await standingsTx(conn, match.tournament_id, winnerId, loserId, point, score, -1);

    // ถอนจากรายชื่อลงแข่งชุดเดียวกับที่บวก (application_players ล็อกหลัง approved — Q2-ค) จึงตรงกันเสมอ
    for(const [teamId, won] of [[winnerId, 1], [loserId, 0]] as const){
        await conn.query<ResultSetHeader>(
            `UPDATE player_profile_stats ps
             JOIN application_players ap ON ap.user_id = ps.user_id
             JOIN tournament_applications ta ON ta.tournament_application_id = ap.tournament_application_id
             SET ps.matches_played = GREATEST(ps.matches_played - 1, 0), ps.wins = GREATEST(ps.wins - ?, 0), ps.losses = GREATEST(ps.losses - ?, 0), ps.updated_at = NOW()
             WHERE ta.tournament_id = ? AND ta.team_id = ? AND ta.tournament_application_status = 'approved' AND ps.sport_type_id = ?`,
            [won, 1 - won, match.tournament_id, teamId, sportId]);
    }

    // C7 Pick'em — ถอนผล = คืนแต้มที่ให้ไปทั้งหมด (amend ที่เปลี่ยนผู้ชนะจะ settle ใหม่ใน applyOutcomeTx ต่อทันที)
    await PickemRepo.unsettleTx(conn, match.match_id);
}

function loserOf(match : MatchRow, winnerId : number): number{
    return match.team_a_id === winnerId ? match.team_b_id! : match.team_a_id!;
}

async function inTx<T>(fn : (conn : PoolConnection) => Promise<T>): Promise<T>{
    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();
        const out = await fn(conn);
        await conn.commit();
        return out;
    }catch(err){
        await conn.rollback();
        throw err;
    }finally{
        conn.release();
    }
}

/** userId = null แปลว่าระบบยืนยันให้เอง (auto-verify) — คอลัมน์ verified_by_user_id ยอม NULL */
export async function verifyMatchResult(matchResId : number, matchId : number , userId : number | null , point : number ){
    const matchRes = (await findById(matchResId))!;
    const match = (await MatchRepo.findById(matchId))!;
    const tour = (await TournamentRepo.findTournamentById(match.tournament_id))!;
    const winnerId = matchRes.winner_team_id!;

    await inTx(async conn => {
        await conn.query<ResultSetHeader>(`UPDATE match_results SET match_result_status = ? , verified_by_user_id = ? , verified_at = NOW()
                                           WHERE match_result_id = ?`, ['verified' , userId , matchResId]);
        await conn.query<ResultSetHeader>(`UPDATE matches SET match_status = ? , updated_at = NOW()
                                           WHERE match_id = ?` , ['completed' ,matchId ]);
        await applyOutcomeTx(conn, match, winnerId, loserOf(match, winnerId), tour.sport_type_id, point, matchRes.score_data);
        // auto-verify ไม่เขียน audit_logs เพราะ user_id ของตารางนั้นเป็น NOT NULL + FK ไป users (ไม่มีผู้ใช้ "ระบบ")
        // ร่องรอยอยู่ที่แถวผลอยู่แล้ว: verified_at มีค่า แต่ verified_by_user_id เป็น NULL = ระบบยืนยันให้
        if(userId !== null){
            await conn.query<ResultSetHeader>(
                `INSERT INTO audit_logs(user_id, action_type, entity_type, entity_id, details)
                VALUES(?, 'match_result_verified', 'match', ?, ?)`,
                [userId, matchId, JSON.stringify({ winnerId, verifiedBy: userId })]
            );
        }
    });
}


export type DisputeRecord = {
    reason : string;
    claimedWinnerTeamId : number | null;
    claimedScore : Record<string, number> | null;
    evidenceKeys : string[] | null;
};

/**
 * OD-26 ข้อ 6 ขั้นสุดท้าย (มติ 26 ก.ย.) — ผู้จัดตัดสินแมตช์ที่แข่งไปแล้วแต่ไม่มีใครส่งผลเลย
 *   'result'         ผู้จัดกรอกผลตามหลักฐาน → verified ทันที · submitted_role = 'organizer' คือ "ป้าย" ที่ทุกคนเห็น
 *   'double_forfeit' แพ้ทั้งคู่ ไม่มีใครผ่านรอบ — ช่องว่างในสายปล่อยให้ dead_slot/dead_match จัดการต่อ
 * เหตุผลบังคับกรอกเสมอ เก็บลง audit_logs ให้ตรวจย้อนได้ว่าผู้จัดตัดสินอะไรเพราะอะไร
 */
export async function organizerDecideMatch(
    match : MatchRow , orgUserId : number , reason : string , point : number,
    outcome : { kind : 'result'; winnerId : number; score : Record<string, number> } | { kind : 'double_forfeit' }
): Promise<boolean>{
    return inTx(async conn => {
        const [locked] = await conn.query<(MatchRow & RowDataPacket)[]>(
            `SELECT * FROM matches WHERE match_id = ? AND match_status = 'finished' FOR UPDATE`, [match.match_id]);
        if(!locked[0]) return false;

        const isResult = outcome.kind === 'result';
        await conn.query<ResultSetHeader>(
            `INSERT INTO match_results (match_id, winner_team_id, score_data, submitted_by_user_id, submitted_role, submitted_at,
                                        match_result_status, verified_by_user_id, verified_at)
             VALUES (?, ?, ?, ?, 'organizer', NOW(), ?, ?, NOW())
             ON DUPLICATE KEY UPDATE winner_team_id = VALUES(winner_team_id), score_data = VALUES(score_data),
                                     submitted_by_user_id = VALUES(submitted_by_user_id), submitted_role = 'organizer',
                                     submitted_at = NOW(), match_result_status = VALUES(match_result_status),
                                     verified_by_user_id = VALUES(verified_by_user_id), verified_at = NOW()`,
            [match.match_id, isResult ? outcome.winnerId : null, isResult ? JSON.stringify(outcome.score) : null,
             orgUserId, isResult ? 'verified' : 'walkover', orgUserId]);

        await conn.query<ResultSetHeader>(
            `UPDATE matches SET match_status = 'completed', updated_at = NOW() WHERE match_id = ?`, [match.match_id]);

        if(isResult){
            const tour = (await TournamentRepo.findTournamentById(match.tournament_id))!;
            await applyOutcomeTx(conn, match, outcome.winnerId, loserOf(match, outcome.winnerId), tour.sport_type_id, point, outcome.score);
        }else{
            // แพ้ทั้งคู่: ไม่มีใครเดินสาย ทั้งสองทีมนับแพ้ 1 แมตช์ ไม่มีแต้ม ไม่มีประตู (เหมือน double_forfeit เดิม)
            for(const teamId of [match.team_a_id, match.team_b_id]){
                if(teamId === null) continue;
                await conn.query<ResultSetHeader>(
                    `INSERT INTO tournament_standings (tournament_id, team_id, played, won, lost, points)
                     VALUES (?, ?, 1, 0, 1, 0)
                     ON DUPLICATE KEY UPDATE played = played + 1, lost = lost + 1, updated_at = NOW()`,
                    [match.tournament_id, teamId]);
            }
        }

        await conn.query<ResultSetHeader>(
            `INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id, details)
             VALUES (?, 'match_decided_by_organizer', 'match', ?, ?)`,
            [orgUserId, match.match_id, JSON.stringify({ outcome : outcome.kind, reason,
                winnerTeamId : isResult ? outcome.winnerId : null })]);
        return true;
    });
}

export async function disputeMatchResult(matchResId : number, matchId : number , userId : number , input : DisputeRecord){
    await inTx(async conn => {
        await conn.query<ResultSetHeader>(`UPDATE match_results
                                           SET dispute_reason = ? , dispute_raised_by = ? , dispute_raised_at = NOW() , match_result_status = ? ,
                                               dispute_claimed_winner_team_id = ? , dispute_claimed_score = ? , dispute_evidence = ?
                                        WHERE match_result_id = ? AND match_id = ?` ,
                                        [input.reason , userId , 'disputed' , input.claimedWinnerTeamId ,
                                         input.claimedScore === null ? null : JSON.stringify(input.claimedScore),
                                         input.evidenceKeys === null ? null : JSON.stringify(input.evidenceKeys),
                                         matchResId , matchId]);
        await conn.query<ResultSetHeader>(`UPDATE matches SET match_status = ? WHERE match_id = ?`,['disputed' , matchId]);
    });
}


/**
 * S04 uphold — ผลเดิมถูกต้อง
 *   โต้แย้งหลัง verify: แค่ปิดข้อโต้แย้ง (สาย/standings ถูกอยู่แล้ว)
 *   โต้แย้งก่อน verify (verified_at NULL): uphold = verify แทนฝ่ายที่ไม่ยอมยืนยัน → ต้อง applyOutcome ด้วย ไม่งั้นแมตช์ completed แต่สายไม่เดิน
 */
export async function upholdMatchResult(matchResId : number , match : MatchRow , userId : number , resolutionNote : string ,
                                        applyOutcome : { winnerId : number; sportId : number; point : number } | null){
    const score = applyOutcome ? (await findById(matchResId))?.score_data ?? null : null;
    await inTx(async conn => {
        await conn.query<ResultSetHeader>(`UPDATE match_results SET dispute_resolved_by = ? , dispute_resolution = ? , match_result_status = 'verified' , dispute_resolved_at = NOW() ,
                                                                    verified_by_user_id = COALESCE(verified_by_user_id, ?) , verified_at = COALESCE(verified_at, NOW())
                                        WHERE match_result_id = ?`,[userId , resolutionNote , userId , matchResId]);
        await conn.query<ResultSetHeader>(`UPDATE matches SET match_status = 'completed' , updated_at = NOW() WHERE match_id = ?`,[match.match_id]);
        if(applyOutcome){
            await applyOutcomeTx(conn, match, applyOutcome.winnerId, loserOf(match, applyOutcome.winnerId), applyOutcome.sportId, applyOutcome.point, score);
            await conn.query<ResultSetHeader>(
                `INSERT INTO audit_logs(user_id, action_type, entity_type, entity_id, details) VALUES(?, 'match_result_verified', 'match', ?, ?)`,
                [userId, match.match_id, JSON.stringify({ winnerId : applyOutcome.winnerId, verifiedBy : userId, viaDispute : true })]);
        }
    });
}

/** S04 reject (B4) — ถอนผลที่ verify ไปแล้ว (ถ้าเคย verify) แล้วรอผู้ส่งส่งใหม่ (S01 → S02) · แมตช์ → result_rejected */
export async function rejectMatchResult(matchResId : number , match : MatchRow , oldWinnerId : number , sportId : number , point : number ,
                                        userId : number , resolutionNote : string , wasVerified : boolean){
    const oldScore = wasVerified ? (await findById(matchResId))?.score_data ?? null : null;
    await inTx(async conn => {
        if(wasVerified) await undoOutcomeTx(conn, match, oldWinnerId, loserOf(match, oldWinnerId), sportId, point, oldScore);
        await conn.query<ResultSetHeader>(`UPDATE match_results SET dispute_resolved_by = ? , dispute_resolution = ? , match_result_status = 'rejected' , dispute_resolved_at = NOW() ,
                                                                    verified_by_user_id = NULL , verified_at = NULL
                                        WHERE match_result_id = ?`,[userId , resolutionNote , matchResId]);
        await conn.query<ResultSetHeader>(`UPDATE matches SET match_status = 'result_rejected' , updated_at = NOW() WHERE match_id = ?`,[match.match_id]);
        await conn.query<ResultSetHeader>(
            `INSERT INTO audit_logs(user_id, action_type, entity_type, entity_id, details) VALUES(?, 'match_result_rejected', 'match', ?, ?)`,
            [userId, match.match_id, JSON.stringify({ oldWinnerId, resolutionNote })]);
    });
}

/** S04 amend (B4) — ORG แก้ผู้ชนะ/สกอร์เอง: ถอนผลเดิม → ใส่ผลใหม่ → verified ทันที (ไม่ต้อง S01/S02 ใหม่) */
export async function amendMatchResult(matchResId : number , match : MatchRow , oldWinnerId : number , newWinnerId : number ,
                                       newScore : Record<string , number> , sportId : number , point : number , userId : number , resolutionNote : string ,
                                       wasVerified : boolean){
    const oldScore = wasVerified ? (await findById(matchResId))?.score_data ?? null : null;
    await inTx(async conn => {
        // เคย verify แล้วและผู้ชนะเปลี่ยน → ถอนของเดิมก่อน · ยังไม่เคย verify → ใส่ผลใหม่เลย (เท่ากับ verify ด้วยค่าที่ ORG แก้)
        // ผู้ชนะเดิมแต่สกอร์เปลี่ยน → สาย/stats ไม่ขยับ แก้เฉพาะประตูในตาราง (B3)
        if(wasVerified && oldWinnerId !== newWinnerId){
            await undoOutcomeTx(conn, match, oldWinnerId, loserOf(match, oldWinnerId), sportId, point, oldScore);
            await applyOutcomeTx(conn, match, newWinnerId, loserOf(match, newWinnerId), sportId, point, newScore);
        }else if(wasVerified){
            await standingsTx(conn, match.tournament_id, newWinnerId, loserOf(match, newWinnerId), point, oldScore, -1);
            await standingsTx(conn, match.tournament_id, newWinnerId, loserOf(match, newWinnerId), point, newScore, 1);
        }else{
            await applyOutcomeTx(conn, match, newWinnerId, loserOf(match, newWinnerId), sportId, point, newScore);
        }
        await conn.query<ResultSetHeader>(`UPDATE match_results SET winner_team_id = ? , score_data = ? ,
                                                                    dispute_resolved_by = ? , dispute_resolution = ? , dispute_resolved_at = NOW() ,
                                                                    amended_by_user_id = ? , amend_reason = ? , amended_at = NOW() ,
                                                                    match_result_status = 'verified' , verified_by_user_id = ? , verified_at = NOW()
                                        WHERE match_result_id = ?`,
                                        [newWinnerId , JSON.stringify(newScore) , userId , resolutionNote , userId , resolutionNote , userId , matchResId]);
        await conn.query<ResultSetHeader>(`UPDATE matches SET match_status = 'completed' , updated_at = NOW() WHERE match_id = ?`,[match.match_id]);
        await conn.query<ResultSetHeader>(
            `INSERT INTO audit_logs(user_id, action_type, entity_type, entity_id, details) VALUES(?, 'match_result_amended', 'match', ?, ?)`,
            [userId, match.match_id, JSON.stringify({ oldWinnerId, newWinnerId, newScore, resolutionNote })]);
    });
}

export async function findVerifiedResultByMatchId(matchId : number): Promise<MatchResultRow | null>{
    const [ rows ] = await pool.query<(MatchResultRow & RowDataPacket)[]>(`SELECT match_id , winner_team_id , score_data , amend_reason , amended_at , verified_at , match_result_status
                                                                           FROM match_results WHERE match_id = ? AND match_result_status IN ('verified', 'walkover')`, [matchId]);
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

/** S07 — ผู้เล่นที่ทีมส่งลงแข่งในแมตช์ (application_players) ไม่ใช่ทุกคนในคลังทีม — OD-17 (แก้ 20 ก.ย.) */
export async function allPlayerInMatch(matchId : number) : Promise<{userId : number , fullName : string}[]>{
    const [rows] = await pool.query<({userId : number , fullName : string} & RowDataPacket)[]>(`
                                        SELECT DISTINCT u.user_id as userId , u.full_name as fullName
                                        FROM matches m
                                        JOIN tournament_applications ta ON ta.tournament_id = m.tournament_id
                                             AND ta.team_id IN (m.team_a_id, m.team_b_id)
                                             AND ta.tournament_application_status = 'approved'
                                        JOIN application_players ap ON ap.tournament_application_id = ta.tournament_application_id
                                        JOIN users u ON u.user_id = ap.user_id
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
    winner_team_id : number | null,   // NULL = รอบชิงแพ้ทั้งคู่ (M17 double forfeit) — ไม่มีแชมป์
    match_result_status : MatchResultRow['match_result_status'],
    team_a_id : number,
    team_b_id : number,
    score_data : Record<string , number> | null
}

/** แมตช์สุดท้ายของบราเคต = แมตช์ที่ next_match_id เป็น NULL (ชนะแล้วไม่มีที่ให้ไปต่อ) และต้อง verified/completed แล้ว */
export async function findFinalMatchResult(tourId : number) : Promise<FinalMatchResult | null>{
    const [rows] = await pool.query<(FinalMatchResult & RowDataPacket)[]>(
        `SELECT mr.winner_team_id, mr.match_result_status, m.team_a_id, m.team_b_id, mr.score_data
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

export type StandingRow = Pick<TournamentStandingRow , 'played' | 'won' | 'lost' | 'points' | 'goals_for' | 'goals_against'> & Pick<TeamRow , 'team_id' | 'name' | 'sport_type_id'>;

/** S12 — tie-break ก (มติ 21 ก.ย.): แต้ม → ผลต่างประตู → ประตูได้ → ชนะ → ชื่อทีม */
export async function findStandings(tourId : number) : Promise<StandingRow[]>{
    const [rows] = await pool.query<(StandingRow & RowDataPacket)[]>(
        `SELECT t.team_id, t.name, t.sport_type_id, ts.played, ts.won, ts.lost, ts.points, ts.goals_for, ts.goals_against
         FROM tournament_standings ts
         JOIN teams t ON t.team_id = ts.team_id
         WHERE ts.tournament_id = ?
         ORDER BY ts.points DESC, (ts.goals_for - ts.goals_against) DESC, ts.goals_for DESC, ts.won DESC, t.name ASC`,
        [tourId]);
    return rows;
}