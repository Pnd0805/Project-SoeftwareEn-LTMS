import * as WalkoverRepo from '../repositories/walkover.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import { WIN_POINTS } from '../config/scoring.js';
import type { MatchRow, SportTypeRow } from '../types/db.js';

/**
 * walkover (ชนะบาย) — GUIDE/11 §10.4 · มติ 17 ก.ย. 2569
 *   ถอนตัว (P08)  : แมตช์ที่ยังไม่เริ่มของทีมนั้น → อีกฝั่งชนะบาย · คู่ที่ยังไม่มา → รอจนคู่มาถึงแล้วค่อยบาย (resolveIfOpponentWithdrawn)
 *   ไม่มาแข่ง (M10): ทีมที่เช็คอินไม่ถึง sport_types.min_members ตอนกรรมการกด start → แพ้บาย (decideNoShow)
 * standings นับเท่าชนะปกติ + score_data ตาม sport_types.walkover_score · player stats ไม่แตะ
 */

export type WalkoverResult = { matchId : number; winnerTeamId : number; loserTeamId : number };

function scoreDataFor(sport : SportTypeRow | null, winnerTeamId : number, loserTeamId : number): Record<string, number> | null{
    if(!sport?.walkover_score) return null;
    return { [String(winnerTeamId)] : sport.walkover_score.winner, [String(loserTeamId)] : sport.walkover_score.loser };
}

/**
 * ทีมถอนตัวหลังมีสาย — ไล่ทุกแมตช์ที่ยังไม่เริ่มของทีมนั้นเป็นลูกโซ่:
 * แมตช์ที่รู้คู่ → walkover · ผู้แพ้ (ทีมที่ถอน) ถูกวางลงสายล่างตามปกติ → รอบถัดไปเจอทีมนี้อีกก็ walkover ต่อ (double elim, มติ Q4-A)
 * แมตช์ที่คู่ยังไม่มา → ปล่อยไว้ ให้ resolveIfOpponentWithdrawn จัดการตอนคู่มาถึง (มติ Q1-A)
 */
export async function processTeamWithdrawal(tournamentId : number, teamId : number, leaderUserId : number): Promise<WalkoverResult[]>{
    const sport = await WalkoverRepo.findSportOfTournament(tournamentId);
    const done : WalkoverResult[] = [];
    const seen = new Set<number>();

    // วนจนไม่เหลือแมตช์ที่รู้คู่ — แต่ละรอบ walkover อาจวางทีมที่ถอนลงแมตช์ใหม่ (สายล่าง)
    for(;;){
        const open = await WalkoverRepo.findOpenMatchesOfTeam(tournamentId, teamId);
        const next = open.find(m => !seen.has(m.match_id) && opponentOf(m, teamId) !== null);
        if(!next) break;
        seen.add(next.match_id);

        const opponent = opponentOf(next, teamId)!;
        // คู่แข่งก็ถอนไปแล้วเหมือนกัน (เกิดได้ในสายล่าง double elim) — ไม่มีใครให้ชนะ ปล่อยแมตช์ค้างให้ ORG ตัดสิน
        if(await WalkoverRepo.isTeamWithdrawn(tournamentId, opponent)) continue;

        await WalkoverRepo.applyWalkover({
            match : next, winnerTeamId : opponent, loserTeamId : teamId,
            actorUserId : leaderUserId, actorRole : 'team_leader',
            scoreData : scoreDataFor(sport, opponent, teamId), winPoints : WIN_POINTS, reason : 'team_withdrawn'
        });
        done.push({ matchId : next.match_id, winnerTeamId : opponent, loserTeamId : teamId });
    }
    return done;
}

/**
 * เรียกหลังผลแมตช์ก่อนหน้าถูก verify และวางทีมลงแมตช์นี้แล้ว (matchResult.service) —
 * ถ้าฝั่งใดฝั่งหนึ่งถอนตัวไปก่อนแล้ว แมตช์นี้จบด้วย walkover ทันที (และไล่ลูกโซ่ต่อถ้าทีมที่ถอนตกสายล่าง)
 */
export async function resolveIfOpponentWithdrawn(matchId : number | null): Promise<WalkoverResult[]>{
    if(matchId === null) return [];
    const match = await MatchRepo.findById(matchId);
    if(!match || match.team_a_id === null || match.team_b_id === null) return [];
    if(match.match_status !== 'scheduled' && match.match_status !== 'checkin_open') return [];

    for(const teamId of [match.team_a_id, match.team_b_id]){
        if(await WalkoverRepo.isTeamWithdrawn(match.tournament_id, teamId)){
            const leader = await WalkoverRepo.findTeamLeaderId(teamId);
            return processTeamWithdrawal(match.tournament_id, teamId, leader ?? 0);
        }
    }
    return [];
}

/**
 * M10 — กรรมการกด start: ทีมที่เช็คอินไม่ถึงขั้นต่ำของกีฬาแพ้บาย
 * คืน null = ทั้งสองทีมครบ เริ่มแข่งได้ตามปกติ · throw ไม่ได้ที่นี่ — ให้ match.service ตัดสินกรณีไม่ครบทั้งคู่
 */
export function decideNoShow(match : MatchRow, countA : number, countB : number, minMembers : number)
    : { winnerTeamId : number; loserTeamId : number } | 'both_short' | null{
    const aOk = countA >= minMembers, bOk = countB >= minMembers;
    if(aOk && bOk) return null;
    if(!aOk && !bOk) return 'both_short';
    return aOk
        ? { winnerTeamId : match.team_a_id!, loserTeamId : match.team_b_id! }
        : { winnerTeamId : match.team_b_id!, loserTeamId : match.team_a_id! };
}

export async function applyNoShowWalkover(match : MatchRow, winnerTeamId : number, loserTeamId : number, refereeUserId : number): Promise<WalkoverResult>{
    const sport = await WalkoverRepo.findSportOfTournament(match.tournament_id);
    await WalkoverRepo.applyWalkover({
        match, winnerTeamId, loserTeamId,
        actorUserId : refereeUserId, actorRole : 'referee',
        scoreData : scoreDataFor(sport, winnerTeamId, loserTeamId), winPoints : WIN_POINTS, reason : 'insufficient_checkins'
    });
    return { matchId : match.match_id, winnerTeamId, loserTeamId };
}

function opponentOf(match : MatchRow, teamId : number): number | null{
    return match.team_a_id === teamId ? match.team_b_id : match.team_a_id;
}
