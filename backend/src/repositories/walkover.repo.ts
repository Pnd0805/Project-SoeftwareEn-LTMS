import pool from '../config/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import type { MatchRow, SportTypeRow } from '../types/db.js';
import * as BracketNodeRepo from './bracketNode.repo.js';

/**
 * walkover (ชนะบาย) — GUIDE/11 §10.4
 * แถวผลถูกเขียนลง match_results เหมือนแมตช์ปกติแต่ status = 'walkover' และไม่แตะ player_profile_stats
 */

/** แมตช์ของทีมในทัวร์ที่ยังไม่เริ่ม (scheduled / checkin_open) — คู่แข่งอาจยังไม่มา (NULL) */
export async function findOpenMatchesOfTeam(tournamentId : number, teamId : number): Promise<MatchRow[]>{
    const [rows] = await pool.query<(MatchRow & RowDataPacket)[]>(
        `SELECT * FROM matches
         WHERE tournament_id = ? AND (team_a_id = ? OR team_b_id = ?)
           AND match_status IN ('scheduled', 'checkin_open')
         ORDER BY round_number, match_id`,
        [tournamentId, teamId, teamId]);
    return rows;
}

export async function hasInProgressMatch(tournamentId : number, teamId : number): Promise<boolean>{
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM matches
         WHERE tournament_id = ? AND (team_a_id = ? OR team_b_id = ?) AND match_status = 'in_progress' LIMIT 1`,
        [tournamentId, teamId, teamId]);
    return rows.length > 0;
}

/** ทีมนี้ถอนตัวจากทัวร์แล้วหรือยัง — ดูใบสมัคร "ล่าสุด" เพราะถอนแล้วสมัครใหม่ได้ (A1) ใบเก่า withdrawn ยังอยู่เป็นประวัติ */
export async function isTeamWithdrawn(tournamentId : number, teamId : number): Promise<boolean>{
    const [rows] = await pool.query<(RowDataPacket & { st : string })[]>(
        `SELECT tournament_application_status AS st FROM tournament_applications
         WHERE tournament_id = ? AND team_id = ?
         ORDER BY tournament_application_id DESC LIMIT 1`,
        [tournamentId, teamId]);
    return rows[0]?.st === 'withdrawn';
}

export async function findTeamLeaderId(teamId : number): Promise<number | null>{
    const [rows] = await pool.query<(RowDataPacket & { leader_id : number })[]>(
        'SELECT leader_id FROM teams WHERE team_id = ?', [teamId]);
    return rows[0]?.leader_id ?? null;
}

export async function findSportOfTournament(tournamentId : number): Promise<SportTypeRow | null>{
    const [rows] = await pool.query<(SportTypeRow & RowDataPacket)[]>(
        `SELECT st.* FROM sport_types st
         JOIN tournaments t ON t.sport_type_id = st.sport_type_id
         WHERE t.tournament_id = ?`, [tournamentId]);
    return rows[0] ?? null;
}

export type ApplyWalkoverInput = {
    match : MatchRow;
    winnerTeamId : number | null;               // NULL = แพ้ทั้งคู่ (ORG forfeit) — ไม่มีใครเดินสาย
    loserTeamId : number | null;                // NULL = ไม่มีผู้แพ้ (ช่องคู่แข่งว่างถาวร — dead slot)
    actorUserId : number;                       // คนที่ทำให้เกิดผลนี้ — หัวหน้าทีมที่ถอน / กรรมการที่กด start / ORG
    actorRole : 'team_leader' | 'referee' | 'organizer';
    scoreData : Record<string, number> | null;  // {"<winnerTeamId>": n, "<loserTeamId>": n}
    winPoints : number;
    reason : 'team_withdrawn' | 'both_withdrawn' | 'insufficient_checkins' | 'double_forfeit' | 'dead_slot';
    /** แพ้ทั้งคู่: ทั้งสองทีมได้ lost — ส่งมาแทน loserTeamId */
    forfeitedTeamIds? : number[];
};

/**
 * ทรานแซกชันเดียว: ใบผล walkover → แมตช์ completed → ผู้ชนะ/ผู้แพ้เดินสาย → standings → ยกเลิกคำขอกรรมการที่ค้าง → audit
 * ★ ผู้แพ้ถูกใส่ลง loser_next_match_id ตามปกติ — ถ้าเป็นทีมที่ถอนตัว walkover.service จะไล่ walkover แมตช์นั้นต่อเอง (ลูกโซ่ double elim)
 * ★ ไม่แตะ player_profile_stats — ไม่มีใครลงสนาม (มติ Q3)
 */
export async function applyWalkover(input : ApplyWalkoverInput): Promise<void>{
    const { match, winnerTeamId, loserTeamId } = input;
    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();

        // แมตช์ต้องยังไม่เริ่ม ณ ตอน commit จริง (กันสองคำสั่งแข่งกัน)
        const [locked] = await conn.query<(MatchRow & RowDataPacket)[]>(
            `SELECT * FROM matches WHERE match_id = ? AND match_status IN ('scheduled', 'checkin_open') FOR UPDATE`,
            [match.match_id]);
        if(!locked[0]){
            await conn.rollback();
            return;
        }

        await conn.query<ResultSetHeader>(
            `INSERT INTO match_results
                (match_id, winner_team_id, score_data, submitted_by_user_id, submitted_role, match_result_status, verified_at)
             VALUES (?, ?, ?, ?, ?, 'walkover', NOW())`,
            [match.match_id, winnerTeamId, input.scoreData ? JSON.stringify(input.scoreData) : null,
             input.actorUserId, input.actorRole]);

        await conn.query<ResultSetHeader>(
            `UPDATE matches SET match_status = 'completed', updated_at = NOW() WHERE match_id = ?`, [match.match_id]);

        // เดินสาย — ช่องที่ไม่มีใครไป (winner/loser เป็น NULL) ปล่อยว่าง → resolveDeadSlot จะให้บายทีมที่รออยู่ตรงนั้น
        if(match.next_match_id !== null && winnerTeamId !== null){
            await placeTeam(conn, match.next_match_id, match.tournament_id, winnerTeamId);
        }
        if(match.loser_next_match_id !== null && loserTeamId !== null){
            await placeTeam(conn, match.loser_next_match_id, match.tournament_id, loserTeamId);
        }

        // standings — SQL เดียวกับ verifyMatchResult (matchResult.repo) เพื่อให้ตารางคะแนนนับ walkover เท่าชนะปกติ
        if(winnerTeamId !== null){
            await conn.query<ResultSetHeader>(
                `INSERT INTO tournament_standings (tournament_id, team_id, played, won, lost, points)
                 VALUES (?, ?, 1, 1, 0, ?)
                 ON DUPLICATE KEY UPDATE played = played + 1, won = won + 1, points = points + ?, updated_at = NOW()`,
                [match.tournament_id, winnerTeamId, input.winPoints, input.winPoints]);
        }
        for(const loser of input.forfeitedTeamIds ?? (loserTeamId !== null ? [loserTeamId] : [])){
            await conn.query<ResultSetHeader>(
                `INSERT INTO tournament_standings (tournament_id, team_id, played, won, lost, points)
                 VALUES (?, ?, 1, 0, 1, 0)
                 ON DUPLICATE KEY UPDATE played = played + 1, lost = lost + 1, updated_at = NOW()`,
                [match.tournament_id, loser]);
        }

        // คำขอโอน/สลับกรรมการที่อ้างแมตช์นี้ไม่มีความหมายแล้ว (GUIDE/11 §5.1)
        await conn.query<ResultSetHeader>(
            `UPDATE referee_change_requests SET request_status = 'cancelled', resolved_at = NOW()
             WHERE request_status = 'open' AND (match_a_id = ? OR match_b_id = ?)`,
            [match.match_id, match.match_id]);

        await conn.query<ResultSetHeader>(
            `INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id, details) VALUES (?, 'match_walkover', 'match', ?, ?)`,
            [input.actorUserId, match.match_id,
             JSON.stringify({ winnerTeamId, loserTeamId, forfeitedTeamIds : input.forfeitedTeamIds ?? null, reason : input.reason, actorRole : input.actorRole })]);

        await conn.commit();
    }catch(err){
        await conn.rollback();
        throw err;
    }finally{
        conn.release();
    }
}

/** M18 ปิดเช็คอิน: checkin_open → scheduled และล้างเช็คอินรอบนี้ (ผู้เล่นต้องยืนยันตัวใหม่วันแข่งจริง) — คืน false ถ้าไม่ได้อยู่ checkin_open */
export async function closeCheckin(matchId : number): Promise<boolean>{
    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();
        const [res] = await conn.query<ResultSetHeader>(
            `UPDATE matches SET match_status = 'scheduled', checkin_open_at = NULL, updated_at = NOW()
             WHERE match_id = ? AND match_status = 'checkin_open'`, [matchId]);
        if(res.affectedRows === 0){
            await conn.rollback();
            return false;
        }
        await conn.query<ResultSetHeader>('DELETE FROM match_checkins WHERE match_id = ?', [matchId]);
        await conn.commit();
        return true;
    }catch(err){
        await conn.rollback();
        throw err;
    }finally{
        conn.release();
    }
}

/**
 * แมตช์ตาย: ว่างทั้งสองช่องและไม่มีทีมจะมาอีก (ต้นทางแพ้ทั้งคู่ทั้งสองฝั่ง) → ปิดเป็น completed โดยไม่มีใบผล/standings
 * เพื่อให้แมตช์ถัดไปมองว่าต้นทางจบแล้วและปล่อยทีมที่รออยู่ผ่าน · คืน false ถ้าไม่ได้อยู่ในสถานะที่ปิดได้
 */
export async function closeDeadMatch(matchId : number, actorUserId : number): Promise<boolean>{
    const [res] = await pool.query<ResultSetHeader>(
        `UPDATE matches SET match_status = 'completed', updated_at = NOW()
         WHERE match_id = ? AND team_a_id IS NULL AND team_b_id IS NULL AND match_status IN ('scheduled', 'checkin_open')`,
        [matchId]);
    if(res.affectedRows === 0) return false;
    await pool.query<ResultSetHeader>(
        `UPDATE referee_change_requests SET request_status = 'cancelled', resolved_at = NOW()
         WHERE request_status = 'open' AND (match_a_id = ? OR match_b_id = ?)`, [matchId, matchId]);
    await pool.query<ResultSetHeader>(
        `INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id, details) VALUES (?, 'match_walkover', 'match', ?, ?)`,
        [actorUserId, matchId, JSON.stringify({ winnerTeamId : null, loserTeamId : null, reason : 'dead_match' })]);
    return true;
}

/** แมตช์ต้นทางที่ส่งทีมมาแมตช์นี้ (next_match_id หรือ loser_next_match_id ชี้มา) ยังมีที่ไม่จบไหม */
export async function hasUnfinishedPredecessor(matchId : number): Promise<boolean>{
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM matches
         WHERE (next_match_id = ? OR loser_next_match_id = ?) AND match_status <> 'completed' LIMIT 1`,
        [matchId, matchId]);
    return rows.length > 0;
}

/** ใส่ทีมลงช่องว่างช่องแรกของแมตช์ถัดไป — ลำดับเดียวกับ verifyMatchResult (a ก่อน b) */
async function placeTeam(conn : PoolConnection, matchId : number, tournamentId : number, teamId : number): Promise<void>{
    const [a] = await conn.query<ResultSetHeader>(
        `UPDATE matches SET team_a_id = ? WHERE match_id = ? AND tournament_id = ? AND team_a_id IS NULL`,
        [teamId, matchId, tournamentId]);
    if(a.affectedRows === 0){
        await conn.query<ResultSetHeader>(
            `UPDATE matches SET team_b_id = ? WHERE match_id = ? AND tournament_id = ? AND team_b_id IS NULL`,
            [teamId, matchId, tournamentId]);
    }
    await BracketNodeRepo.syncNodeTeamsFromMatchTx(conn, matchId);   // B2: bracket_nodes ตามช่องของ matches เสมอ
}
