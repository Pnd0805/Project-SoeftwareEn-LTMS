import * as MatchResRepo from '../repositories/matchResult.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import * as TeamRepo from '../repositories/team.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import * as SportTypeRepo from '../repositories/sportType.repo.js';


import { toDisputeResultDto, toSubmittedResultDto, toVerifiedResultDto , toResolveResultDto, toVerifiedResult , toPlayerMatchStat, toTournamentWinnerDto, toStandingDto} from '../mappers/matchResult.mapper.js';
import { checkMatch, checkTournament, checkTeam } from '../utils/checkExist.js';
import { AppError } from '../utils/AppError.js';
import { findTournamentById } from '../repositories/tournament.repo.js';
import { toTeamRef } from '../mappers/team.mapper.js';
import { WIN_POINTS } from '../config/scoring.js';
import type { ResolveInput } from '../schemas/matchResult.schema.js';
import * as Walkover from './walkover.service.js';
import { isRefereeOfMatch, isTeamLeaderOfMatch } from '../middlewares/requireReferee.js';

export async function createSubmitMatchRes(matchId : number , winnerId : number , scoreData : Record<string , number> , submitById : number , role : 'team_leader' | 'referee'){
    const match = await checkMatch(matchId);
    const matchResId = await MatchResRepo.submitMatchResult(matchId , winnerId , scoreData , submitById , role);

    const matchRes = await MatchResRepo.findById(matchResId);
    return toSubmittedResultDto(matchRes!);
}

export async function verifyMatchResult(matchId : number , userid : number){
    const matchRes = await MatchResRepo.findmatchResultByMatchId(matchId);

    await MatchResRepo.verifyMatchResult(matchRes!.match_result_id , matchId , userid , WIN_POINTS);
    const ver_matchRes = await MatchResRepo.findmatchResultByMatchId(matchId);
    const match = await MatchRepo.findById(matchId);

    // ทีมที่เพิ่งถูกวางลงแมตช์ถัดไป อาจเจอคู่ที่ถอนตัวไปแล้ว → แมตช์นั้นจบด้วย walkover ทันที (GUIDE/11 §10.4, มติ Q1-A)
    await Walkover.resolveIfOpponentWithdrawn(match!.next_match_id);
    await Walkover.resolveIfOpponentWithdrawn(match!.loser_next_match_id);
    return toVerifiedResultDto(ver_matchRes! , match!);
}

export async function disputeMatchResult(matchId : number , userId : number , reason : string){
    const matchRes = await MatchResRepo.findmatchResultByMatchId(matchId);
    await MatchResRepo.disputeMatchResult(matchRes!.match_result_id , matchId , userId , reason);

    const disputeMatchRes = await MatchResRepo.findmatchResultByMatchId(matchId);
    return toDisputeResultDto(disputeMatchRes!);
}


/**
 * S04 — ORG ตัดสินข้อโต้แย้ง (B4, 19 ก.ย.)
 *   uphold : ผลเดิมถูก ปิดเรื่อง
 *   reject : ถอนผลที่ verify ไปแล้ว (สาย/standings/stats) → แมตช์ result_rejected รอส่งใหม่ S01→S02
 *   amend  : ถอนผลเดิม + ใส่ผู้ชนะ/สกอร์ที่ ORG แก้ → verified ทันที (isAmended)
 * reject/amend ทำได้เฉพาะเมื่อแมตช์ถัดไป (next/loser_next) ยัง scheduled — ไม่งั้นทีมที่ต้องถอนออกอาจแข่ง/บายไปแล้ว
 */
export async function resolveMatchResult(matchId : number, input : ResolveInput, userId : number){
    const matchRes = await MatchResRepo.findmatchResultByMatchId(matchId);
    if(!matchRes || matchRes.match_result_status !== 'disputed'){
        throw new AppError(409 , "NO_ACTIVE_DISPUTE" , "แมตช์นี้ไม่มีข้อโต้แย้งที่รอตัดสิน");
    }
    const { resolution, resolutionNote } = input;

    if(resolution === 'uphold'){
        await MatchResRepo.upholdMatchResult(matchRes.match_result_id, matchId, userId, resolutionNote);
        return toResolveResultDto({ match_id : matchId, match_result_status : 'verified' });
    }

    const match = (await MatchRepo.findById(matchId))!;
    const tour = (await findTournamentById(match.tournament_id))!;
    const oldWinnerId = matchRes.winner_team_id!;

    for(const nextId of [match.next_match_id, match.loser_next_match_id]){
        if(nextId === null) continue;
        const next = await MatchRepo.findById(nextId);
        if(next && next.match_status !== 'scheduled'){
            throw new AppError(409 , "NEXT_MATCH_STARTED" ,
                `แมตช์ถัดไป #${nextId} เปิดเช็คอิน/เริ่ม/จบไปแล้ว ถอนหรือแก้ผลแมตช์นี้ไม่ได้อีก` , { nextMatchId : nextId });
        }
    }

    if(resolution === 'reject'){
        await MatchResRepo.rejectMatchResult(matchRes.match_result_id, match, oldWinnerId, tour.sport_type_id, WIN_POINTS, userId, resolutionNote);
        return toResolveResultDto({ match_id : matchId, match_result_status : 'rejected' });
    }

    // amend — schema รับประกันว่ามี winnerTeamId/scoreData
    const newWinnerId = input.winnerTeamId!;
    if(newWinnerId !== match.team_a_id && newWinnerId !== match.team_b_id){
        throw new AppError(400 , "VALIDATION_FAILED" , "winnerTeamId ต้องเป็นทีมใดทีมหนึ่งในแมตช์นี้" , { fields : { winnerTeamId : 'ไม่ใช่ทีมในแมตช์' } });
    }
    await MatchResRepo.amendMatchResult(matchRes.match_result_id, match, oldWinnerId, newWinnerId, input.scoreData!, tour.sport_type_id, WIN_POINTS, userId, resolutionNote);
    if(oldWinnerId !== newWinnerId){
        // ทีมที่เพิ่งถูกวางใหม่อาจเจอคู่ที่ถอนไปแล้ว — เหมือนหลัง verify
        await Walkover.resolveIfOpponentWithdrawn(match.next_match_id);
        await Walkover.resolveIfOpponentWithdrawn(match.loser_next_match_id);
    }
    return toResolveResultDto({ match_id : matchId, match_result_status : 'verified', amended : true });
}

/**
 * S05 — ผลที่ verified/walkover ใครก็อ่านได้ · ผลที่ยัง submitted/disputed/rejected อ่านได้เฉพาะ ORG / กรรมการของแมตช์ / หัวหน้า 2 ทีม
 * (ORG ตัดสิน dispute ต้องเห็นสกอร์ที่ถูกโต้แย้ง — FE gaps 19 ก.ย.) · คนอื่นได้ 404 เหมือนเดิม ไม่เผยว่ามีผลค้าง
 */
export async function getVerifiedResult(matchId : number , userId? : number){
    const matchRes = await MatchResRepo.findmatchResultByMatchId(matchId);
    if(!matchRes){
        throw new AppError(404 , "NOT_FOUND" , "ไม่พบข้อมูลที่ต้องการ");
    }

    const isFinal = matchRes.match_result_status === 'verified' || matchRes.match_result_status === 'walkover';
    if(!isFinal){
        if(userId === undefined || !(await canSeeUnfinishedResult(matchId , userId))){
            throw new AppError(404 , "NOT_FOUND" , "ไม่พบข้อมูลที่ต้องการ");
        }
    }

    return toVerifiedResult(matchRes)
}

async function canSeeUnfinishedResult(matchId : number , userId : number): Promise<boolean>{
    const match = await checkMatch(matchId);
    const tour = await findTournamentById(match.tournament_id);
    if(tour?.requested_by_user_id === userId) return true;
    if(await isRefereeOfMatch(matchId , userId , match.tournament_id)) return true;
    return isTeamLeaderOfMatch(matchId , userId);
}

export type recordStat = {userId : number,
                          values : {
                            statDefinitionId : number,
                            value : number
                          }[]
                        }[]


export async function updatePlayerStat(matchId: number, refId: number, playerStats: recordStat) {
    const match = await checkMatch(matchId);
    const tour = await checkTournament(match.tournament_id);
    const statDefs = await SportTypeRepo.findStatDefinitionsBySportType(tour.sport_type_id);
    const validIds = new Set(statDefs.map(d => d.sport_stat_definition_id));

    // รอบที่ 1 — validate ทุกคนให้ครบก่อน ยังไม่เขียนอะไรเลย
    for (const s of playerStats) {
        for (const v of s.values) {
            if (!validIds.has(v.statDefinitionId)) {
                throw new AppError(400, "UNKNOWN_STAT_DEFINITION", "มีรายการสถิติที่ไม่ตรงกับประเภทกีฬานี้");
            }
        }
    }

    // รอบที่ 2 — validate ว่าทุกคนอยู่ทีมจริง เก็บ teamId ไว้ใช้ต่อเลย
    const teamIdByUser = new Map<number, number>();
    for (const s of playerStats) {
        const teamResult = await TeamRepo.findTeamIdOfUserInMatch(s.userId, matchId);
        if (!teamResult) {
            throw new AppError(404, "USER_NOT_IN_MATCH", "ผู้เล่นคนนี้ไม่ได้อยู่ในทีมที่แข่งขันแมตช์นี้");
        }
        teamIdByUser.set(s.userId, teamResult.teamId);
    }

    // รอบที่ 3 — เขียน ใช้ teamId ที่เก็บไว้แล้ว ไม่ query ซ้ำ
    let recordedCount = 0;
    for (const s of playerStats) {
        recordedCount += s.values.length;
        await MatchResRepo.recordPlayerStat(matchId, s.userId, teamIdByUser.get(s.userId)!, refId, s.values);
    }
    return { matchId, recordedCount };

}

export async function getPlayerMatchStat(matchId : number){
    const allPlayer = await MatchResRepo.allPlayerInMatch(matchId);

    const items = [];
    for(const u of allPlayer){
        const stat = await MatchResRepo.showPlayerStat(matchId , u.userId)// ! ขอให้เชื่อเพราะว่าไปเอา userId ที่อยู่ใน Player match stat มา
        items.push(toPlayerMatchStat({userId : u.userId , fullName : u.fullName} , stat));
    }

    return { items : items};
}

export async function getChampion(tourId : number){
    const tour = await checkTournament(tourId);
    if(tour.tournament_status !== 'completed'){
        throw new AppError(404 , "NOT_FOUND" , "ทัวร์นาเมนต์นี้ยังไม่จบการแข่งขัน");
    }

    const finalResult = await MatchResRepo.findFinalMatchResult(tourId);
    if(!finalResult){
        throw new AppError(404 , "NOT_FOUND" , "ไม่พบแมตช์สุดท้ายของทัวร์นาเมนต์นี้");
    }

    const isWalkover = finalResult.match_result_status === 'walkover';

    // รอบชิงแพ้ทั้งคู่ (M17 ไม่มาตามนัดทั้งสองทีม) → ไม่มีแชมป์/รองแชมป์ (GUIDE/11 §10.5)
    if(finalResult.winner_team_id === null){
        return toTournamentWinnerDto(null, null, null, tour.event_end_date, isWalkover);
    }

    const runnerUpTeamId = finalResult.team_a_id === finalResult.winner_team_id
        ? finalResult.team_b_id
        : finalResult.team_a_id;

    const championRow = await checkTeam(finalResult.winner_team_id);
    // รอบชิงที่คู่แข่งว่างถาวร (dead slot) ไม่มีรองแชมป์
    const runnerUpRow = runnerUpTeamId === null ? null : await TeamRepo.findById(runnerUpTeamId);

    return toTournamentWinnerDto(
        toTeamRef(championRow),
        runnerUpRow ? toTeamRef(runnerUpRow) : null,
        finalResult.score_data,
        tour.event_end_date,
        isWalkover
    );
}

export async function getDashboard(tourId : number){
    await checkTournament(tourId);

    const teamCount = await MatchResRepo.countApprovedTeams(tourId);
    const playerCount = await MatchResRepo.countApprovedPlayers(tourId);
    const { matchCount, matchesCompleted } = await MatchResRepo.countMatches(tourId);

    return { teamCount, playerCount, matchCount, matchesCompleted };
}

export async function getStandings(tourId : number){
    await checkTournament(tourId);

    const rows = await MatchResRepo.findStandings(tourId);
    const items = rows.map((row , index) => toStandingDto(row , index + 1));

    return { items };
}

const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+)/;

export async function updateLivestream(matchId : number , youtubeUrl : string | null){
    await checkMatch(matchId);

    if(youtubeUrl !== null && !YOUTUBE_URL_REGEX.test(youtubeUrl)){
        throw new AppError(400 , "INVALID_YOUTUBE_URL" , "ลิงก์ YouTube ไม่ถูกต้อง");
    }

    await MatchRepo.updateLivestreamUrl(matchId , youtubeUrl);
    return { matchId , youtubeUrl };
}