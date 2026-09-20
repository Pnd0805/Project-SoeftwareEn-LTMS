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
    verifiedAt : string | null
}

export function toVerifiedResult(rows : MatchResultRow): verifiedResult{
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
        verifiedAt : rows.verified_at?.toISOString() ?? null
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
    wins : number,
    losses : number,
    rank : number
}

export function toStandingDto(row : { team_id : number , name : string , sport_type_id : number , won : number , lost : number } , rank : number) : standingDto{
    return {
        team : { id : row.team_id , name : row.name , sportTypeId : row.sport_type_id },
        wins : row.won,
        losses : row.lost,
        rank : rank
    };
}