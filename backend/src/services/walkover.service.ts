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

export type WalkoverResult = { matchId : number; winnerTeamId : number | null; loserTeamId : number | null };

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
        // คู่แข่งก็ถอนไปแล้วเหมือนกัน (สายล่าง double elim / คู่ที่มาทีหลัง) — ไม่มีใครให้ชนะ → แพ้ทั้งคู่เหมือน M17
        // ไม่มีใครเดินสาย ช่องรอบถัดไปว่างถาวร → ทีมที่รออยู่บายผ่าน (dead slot) ไม่ต้องให้ ORG มาเปิดเช็คอินแล้ว forfeit เอง
        if(await WalkoverRepo.isTeamWithdrawn(tournamentId, opponent)){
            await WalkoverRepo.applyWalkover({
                match : next, winnerTeamId : null, loserTeamId : null, forfeitedTeamIds : [teamId, opponent],
                actorUserId : leaderUserId, actorRole : 'team_leader',
                scoreData : null, winPoints : WIN_POINTS, reason : 'both_withdrawn'
            });
            done.push({ matchId : next.match_id, winnerTeamId : null, loserTeamId : null });
            done.push(...await resolveIfOpponentWithdrawn(next.next_match_id));
            done.push(...await resolveIfOpponentWithdrawn(next.loser_next_match_id));
            continue;
        }

        await WalkoverRepo.applyWalkover({
            match : next, winnerTeamId : opponent, loserTeamId : teamId,
            actorUserId : leaderUserId, actorRole : 'team_leader',
            scoreData : scoreDataFor(sport, opponent, teamId), winPoints : WIN_POINTS, reason : 'team_withdrawn'
        });
        done.push({ matchId : next.match_id, winnerTeamId : opponent, loserTeamId : teamId });
        // ผู้ชนะไปถึงแมตช์ถัดไปที่ช่องอีกฝั่งอาจว่างถาวรแล้ว (แพ้ทั้งคู่ก่อนหน้า) → บายผ่านต่อ
        done.push(...await resolveIfOpponentWithdrawn(next.next_match_id));
    }
    return done;
}

/**
 * เรียกหลังแมตช์ต้นทางจบ (verify ปกติ หรือ walkover) และวางทีมลงแมตช์นี้แล้ว —
 *   1. ฝั่งใดฝั่งหนึ่งถอนตัวไปก่อนแล้ว → walkover ทันที (และไล่ลูกโซ่ต่อถ้าทีมที่ถอนตกสายล่าง)
 *   2. ช่องคู่แข่งว่างและแมตช์ต้นทางจบหมดแล้ว (แพ้ทั้งคู่ที่รอบก่อน) → ไม่มีใครจะมาอีก ทีมที่รออยู่ได้บาย (dead slot)
 */
export async function resolveIfOpponentWithdrawn(matchId : number | null): Promise<WalkoverResult[]>{
    if(matchId === null) return [];
    const match = await MatchRepo.findById(matchId);
    if(!match) return [];
    if(match.match_status !== 'scheduled' && match.match_status !== 'checkin_open') return [];

    const present = [match.team_a_id, match.team_b_id].filter((t): t is number => t !== null);
    if(present.length === 1){
        return resolveDeadSlot(match, present[0]!);
    }
    if(present.length === 0){
        return closeDeadMatch(match);
    }

    for(const teamId of present){
        if(await WalkoverRepo.isTeamWithdrawn(match.tournament_id, teamId)){
            const leader = await WalkoverRepo.findTeamLeaderId(teamId);
            return processTeamWithdrawal(match.tournament_id, teamId, leader ?? 0);
        }
    }
    return [];
}

/**
 * ว่างทั้งสองช่อง + ต้นทางจบหมด (แพ้ทั้งคู่ป้อนเข้ามาทั้งสองฝั่ง) = แมตช์ตาย → ปิดเป็น completed ไม่มีผล
 * แล้วไล่ต่อ: แมตช์ถัดไปที่รอผลจากแมตช์นี้จะเห็นว่าต้นทางจบแล้ว → ทีมที่รออยู่ผ่าน (dead slot) หรือเป็นแมตช์ตายต่อ
 */
async function closeDeadMatch(match : MatchRow): Promise<WalkoverResult[]>{
    if(await WalkoverRepo.hasUnfinishedPredecessor(match.match_id)) return [];
    if(!(await WalkoverRepo.closeDeadMatch(match.match_id, 0))) return [];
    const done : WalkoverResult[] = [{ matchId : match.match_id, winnerTeamId : null, loserTeamId : null }];
    done.push(...await resolveIfOpponentWithdrawn(match.next_match_id));
    done.push(...await resolveIfOpponentWithdrawn(match.loser_next_match_id));
    return done;
}

/** ทีมเดียวในแมตช์ + ไม่มีแมตช์ต้นทางที่ยังไม่จบ = ช่องอีกฝั่งจะว่างตลอดไป → ทีมนั้นผ่านรอบ (บาย ไม่มีผู้แพ้) */
async function resolveDeadSlot(match : MatchRow, teamId : number): Promise<WalkoverResult[]>{
    if(await WalkoverRepo.hasUnfinishedPredecessor(match.match_id)) return [];
    await WalkoverRepo.applyWalkover({
        match, winnerTeamId : teamId, loserTeamId : null,
        actorUserId : (await WalkoverRepo.findTeamLeaderId(teamId)) ?? 0, actorRole : 'organizer',
        scoreData : null, winPoints : WIN_POINTS, reason : 'dead_slot'
    });
    const done : WalkoverResult[] = [{ matchId : match.match_id, winnerTeamId : teamId, loserTeamId : null }];
    // ทีมที่ผ่านไปอาจไปเจอช่องตายอีก (ต้นทางอีกฝั่งแพ้ทั้งคู่เหมือนกัน) → ไล่ต่อ
    return done.concat(await resolveIfOpponentWithdrawn(match.next_match_id));
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

export async function applyNoShowWalkover(match : MatchRow, winnerTeamId : number, loserTeamId : number,
                                          actorUserId : number, actorRole : 'referee' | 'organizer' = 'referee'): Promise<WalkoverResult>{
    const sport = await WalkoverRepo.findSportOfTournament(match.tournament_id);
    await WalkoverRepo.applyWalkover({
        match, winnerTeamId, loserTeamId,
        actorUserId, actorRole,
        scoreData : scoreDataFor(sport, winnerTeamId, loserTeamId), winPoints : WIN_POINTS, reason : 'insufficient_checkins'
    });
    return { matchId : match.match_id, winnerTeamId, loserTeamId };
}

/**
 * M17 — ORG ตัดสินแมตช์ที่ทีมไม่มาตามนัด (แมตช์ checkin_open):
 *   ฝั่งเดียวไม่ถึง min_members → อีกฝั่งชนะบาย (เหมือน M10 แต่ ORG กด ไม่ต้องรอกรรมการ)
 *   ไม่ถึงทั้งคู่ → แพ้ทั้งคู่: ไม่มีใครเดินสาย ทั้งสองได้ lost · ช่องที่ว่างในรอบถัดไปให้ทีมที่รออยู่บายผ่าน (dead slot)
 *   ครบทั้งคู่ → null (ให้กรรมการกด start ตามปกติ)
 */
export async function applyOrganizerForfeit(match : MatchRow, countA : number, countB : number, minMembers : number, orgUserId : number)
    : Promise<{ kind : 'walkover' | 'double_forfeit'; results : WalkoverResult[] } | null>{
    const decision = decideNoShow(match, countA, countB, minMembers);
    if(decision === null) return null;

    if(decision !== 'both_short'){
        const wo = await applyNoShowWalkover(match, decision.winnerTeamId, decision.loserTeamId, orgUserId, 'organizer');
        return { kind : 'walkover', results : [wo] };
    }

    await WalkoverRepo.applyWalkover({
        match, winnerTeamId : null, loserTeamId : null, forfeitedTeamIds : [match.team_a_id!, match.team_b_id!],
        actorUserId : orgUserId, actorRole : 'organizer', scoreData : null, winPoints : WIN_POINTS, reason : 'double_forfeit'
    });
    const results : WalkoverResult[] = [{ matchId : match.match_id, winnerTeamId : null, loserTeamId : null }];
    // รอบถัดไปมีทีมรออยู่แล้วและไม่มีใครจะมาอีก → บายผ่าน
    results.push(...await resolveIfOpponentWithdrawn(match.next_match_id));
    results.push(...await resolveIfOpponentWithdrawn(match.loser_next_match_id));
    return { kind : 'double_forfeit', results };
}

/** M18 — ORG ปิดเช็คอินกลับเป็น scheduled (เช่น ฝนตก) เพื่อไปเลื่อนด้วย M06 · เช็คอินรอบนี้ถูกล้าง */
export async function closeCheckin(matchId : number): Promise<boolean>{
    return WalkoverRepo.closeCheckin(matchId);
}

function opponentOf(match : MatchRow, teamId : number): number | null{
    return match.team_a_id === teamId ? match.team_b_id : match.team_a_id;
}
