import type { MatchResultRow, SportStatDefinitionRow } from "../types/db.js";
import type { MatchRow } from "../types/db.js";

import type { playerStat } from "../repositories/matchResult.repo.js";
import type { TeamRef } from "./team.mapper.js";

export type submittedResultDto = {
    id : number,
    matchId : number,
    status : MatchResultRow['match_result_status'],
    submittedBy : number
};

export function toSubmittedResultDto(rows : MatchResultRow) : submittedResultDto{
    return{
        id : rows.match_result_id,
        matchId : rows.match_id,
        status : rows.match_result_status,
        submittedBy : rows.submitted_by_user_id
    }
}

export type verifiedResultDto = {
    matchId : number,
    status : MatchResultRow['match_result_status'],
    winnerTeamId : number | null,
    nextMatchId : number | null
}

export function toVerifiedResultDto(matchRes: Pick<MatchResultRow , 'match_id' | 'match_result_status' | 'winner_team_id'> ,
                                    nextMatch : Pick<MatchRow , 'next_match_id'>):verifiedResultDto{
        return {
            matchId : matchRes.match_id,
            status : matchRes.match_result_status,
            winnerTeamId : matchRes.winner_team_id,
            nextMatchId : nextMatch.next_match_id
        }                                       
}

export type disputeResultDto = {
    matchId : number,
    status : MatchResultRow['match_result_status']
}

export function toDisputeResultDto(rows : MatchResultRow): disputeResultDto{
    return {
        matchId : rows.match_id,
        status : rows.match_result_status
    }
}

export type resolveResultDto = {
    matchId : number,
    status : 'verified' | 'rejected',
    isAmended : boolean   // B4: true = ORG แก้ผู้ชนะ/สกอร์เองในคำตัดสิน
}

export function toResolveResultDto(rows: { match_id: number; match_result_status: 'verified' | 'rejected'; amended?: boolean }): resolveResultDto {
    return {
        matchId: rows.match_id,
        status: rows.match_result_status,
        isAmended: rows.amended ?? false
    }
}

export type verifiedResult = {
    matchId : number,
    winnerTeamId : number | null,
    scoreData : Record<string , number> | null
    isAmended : boolean | null,
    amendedAt : string | null,
    amendReason : string | null,
    isWalkover : boolean,   // ชนะบาย (ทีมถอน/ไม่มาแข่ง) — ไม่มีสกอร์จริง (GUIDE/11 §10.4)
    status : MatchResultRow['match_result_status'],   // submitted/disputed/rejected เห็นได้เฉพาะผู้เกี่ยวข้อง (S05)
    submittedRole : MatchResultRow['submitted_role'],
    isAutoVerified : boolean,
    verifiedAt : string | null,
    /**
     * FE-dispute-resolution-not-returned — ทั้ง 6 ฟิลด์ถูกเก็บลงฐานแล้วแต่ไม่มี response ไหนคืนออกมา
     * migration 020 บังคับให้ผู้จัดเขียนคำวินิจฉัยก็เพื่อให้ทั้งสองทีมรู้ว่าทำไมผลถูกยืนยัน/แก้/ยกทิ้ง
     * แต่คำวินิจฉัยนั้นไม่เคยไปถึงใครเลย · และผู้จัดที่เปิดหน้าตัดสินก็ไม่เห็นว่าเรื่องที่ค้านคืออะไร
     *
     * ★ ส่งแบบมีเงื่อนไข (มติ 27 ก.ย.) — S05 เป็น endpoint สาธารณะเมื่อผลเป็น verified/walkover
     *   แต่ `GET /matches/:id/result/dispute` (S03b) กันข้อมูลชุดเดียวกันไว้ที่
     *   ORG / กรรมการของแมตช์ / หัวหน้า 2 ทีม · ถ้าใส่ลง S05 แบบไม่มีเงื่อนไขก็เท่ากับเปิดหลังบ้าน:
     *   `disputeReason` เป็นข้อความที่คู่กรณีเขียน อาจระบุชื่อและกล่าวหาผู้เล่นตรง ๆ และ
     *   `disputeRaisedBy` บอกว่าหัวหน้าทีมคนไหนเป็นคนค้าน · คนนอกได้ผลแข่งครบเหมือนเดิม แค่ไม่มี 6 ฟิลด์นี้
     */
    disputeReason? : string | null,
    disputeRaisedBy? : number | null,
    disputeRaisedAt? : string | null,
    disputeResolution? : string | null,
    disputeResolvedBy? : number | null,
    disputeResolvedAt? : string | null
}

/**
 * ★ แยกสองชั้น (มติ 30 ก.ย. 2569 — FE-dispute-ruling-hidden-from-players)
 *   `ruling`    คำวินิจฉัยของผู้จัด — migration 020 บังคับให้เขียน **เพื่อให้ทั้งสองทีมรู้ว่าทำไม**
 *               จึงต้องถึงผู้เล่นทุกคนในรายชื่อลงแข่ง ไม่ใช่แค่หัวหน้า · เป็นข้อความที่ตั้งใจให้อ่าน
 *   `complaint` ตัวคำค้าน — คำของคู่กรณี อาจระบุชื่อและกล่าวหาผู้เล่นตรง ๆ และ `disputeRaisedBy`
 *               บอกว่าหัวหน้าทีมไหนเป็นคนค้าน · คงไว้ที่ ORG / กรรมการของแมตช์ / หัวหน้า 2 ทีม
 * เดิมกั้นหกฟิลด์เป็นก้อนเดียว ผู้เล่นจึงไม่เคยได้อ่านคำวินิจฉัยที่เขียนไว้ให้เขาอ่าน
 */
export function toVerifiedResult(rows : MatchResultRow , see : { ruling? : boolean , complaint? : boolean } = {}): verifiedResult{
    let isAmended: boolean;
    if(rows.amended_at === null)
        isAmended = false;
    else
        isAmended = true;
    return{
        matchId : rows.match_id,
        winnerTeamId : rows.winner_team_id,
        scoreData : rows.score_data,
        isAmended : isAmended,
        amendedAt : rows.amended_at?.toISOString() ?? null,
        amendReason : rows.amend_reason,
        isWalkover : rows.match_result_status === 'walkover',
        status : rows.match_result_status,
        // ป้ายที่ทุกคนเห็น — 'organizer' คือผู้จัดกรอกผลเองเพราะไม่มีใครส่งผลภายในกำหนด (OD-26 ข้อ 6)
        submittedRole : rows.submitted_role,
        // ระบบยืนยันให้เองเพราะไม่มีผู้โต้แย้ง (OD-26 ข้อ 7) — ต่างจากคนกดยืนยัน
        isAutoVerified : rows.verified_at !== null && rows.verified_by_user_id === null,
        verifiedAt : rows.verified_at?.toISOString() ?? null,
        // คนที่ไม่มีสิทธิ์ต้องไม่มีคีย์เหล่านี้เลย ไม่ใช่ได้ null — null แปลว่า "ไม่มีข้อโต้แย้ง" คนละความหมาย
        ...(see.ruling ? {
            disputeResolution : rows.dispute_resolution,
            disputeResolvedBy : rows.dispute_resolved_by,
            disputeResolvedAt : rows.dispute_resolved_at?.toISOString() ?? null,
        } : {}),
        ...(see.complaint ? {
            disputeReason : rows.dispute_reason,
            disputeRaisedBy : rows.dispute_raised_by,
            disputeRaisedAt : rows.dispute_raised_at?.toISOString() ?? null,
        } : {}),
    }
}

export function toPlayerMatchStat(userInfo: {userId: number, fullName: string}, stat: playerStat[]) {
    return { userId: userInfo.userId, fullName: userInfo.fullName, stats: stat };
}

export type tournamentWinnerDto = {
    championTeam : TeamRef | null,    // null = รอบชิงแพ้ทั้งคู่ (ไม่มาตามนัด) — ไม่มีแชมป์
    runnerUpTeam : TeamRef | null,
    summary : Record<string , unknown>
}

export function toTournamentWinnerDto(
    championTeam : TeamRef | null ,
    runnerUpTeam : TeamRef | null ,
    scoreData : Record<string , number> | null ,
    completedAt : string | null ,
    isWalkover : boolean = false
) : tournamentWinnerDto{
    return {
        championTeam : championTeam,
        runnerUpTeam : runnerUpTeam,
        summary : {
            finalScore : scoreData,
            isWalkover : isWalkover,   // รอบชิงจบด้วยบาย (ทีมถอน/ไม่มา) — GUIDE/11 §10.5
            completedAt : completedAt
        }
    };
}

export type standingDto = {
    team : TeamRef,
    played : number,
    wins : number,
    losses : number,
    points : number,
    goalsFor : number,
    goalsAgainst : number,
    goalDiff : number,
    rank : number      // ทีมที่เสมอกันทุกเกณฑ์ได้อันดับเท่ากัน (1,1,3) — B3
}

export type StandingSource = { team_id : number , name : string , sport_type_id : number , played : number , won : number , lost : number , points : number , goals_for : number , goals_against : number };

export function toStandingDto(row : StandingSource , rank : number) : standingDto{
    return {
        team : { id : row.team_id , name : row.name , sportTypeId : row.sport_type_id },
        played : row.played,
        wins : row.won,
        losses : row.lost,
        points : row.points,
        goalsFor : row.goals_for,
        goalsAgainst : row.goals_against,
        goalDiff : row.goals_for - row.goals_against,
        rank : rank
    };
}

/** อันดับแบบ "เท่ากันได้" — เกณฑ์เดียวกับ ORDER BY ใน findStandings (แต้ม, ผลต่าง, ประตูได้, ชนะ) · ชื่อทีมใช้แค่ให้ลำดับนิ่ง ไม่ถือว่าต่างอันดับ */
export function rankStandings(rows : StandingSource[]) : standingDto[]{
    const key = (r : StandingSource) => `${r.points}|${r.goals_for - r.goals_against}|${r.goals_for}|${r.won}`;
    let rank = 0, prevKey = '';
    return rows.map((row , i) => {
        const k = key(row);
        if(k !== prevKey){ rank = i + 1; prevKey = k; }
        return toStandingDto(row , rank);
    });
}