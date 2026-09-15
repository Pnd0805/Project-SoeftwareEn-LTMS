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

export async function createSubmitMatchRes(matchId : number , winnerId : number , scoreData : Record<string , number> , submitById : number , role : 'team_leader' | 'referee'){
    const match = await checkMatch(matchId);
    const matchResId = await MatchResRepo.submitMatchResult(matchId , winnerId , scoreData , submitById , role);

    const matchRes = await MatchResRepo.findById(matchResId);
    return toSubmittedResultDto(matchRes!);
}

export async function verifyMatchResult(matchId : number , userid : number){
    const matchRes = await MatchResRepo.findmatchResultByMatchId(matchId);

    const point = 3;

    await MatchResRepo.verifyMatchResult(matchRes!.match_result_id , matchId , userid , point);
    const ver_matchRes = await MatchResRepo.findmatchResultByMatchId(matchId);
    const match = await MatchRepo.findById(matchId);
    return toVerifiedResultDto(ver_matchRes! , match!);
}

export async function disputeMatchResult(matchId : number , userId : number , reason : string){
    const matchRes = await MatchResRepo.findmatchResultByMatchId(matchId);
    await MatchResRepo.disputeMatchResult(matchRes!.match_result_id , matchId , userId , reason);

    const disputeMatchRes = await MatchResRepo.findmatchResultByMatchId(matchId);
    return toDisputeResultDto(disputeMatchRes!);
}


export async function resolveMatchResult( matchId: number, resolution: 'uphold' | 'reject', userId: number, resolutionNote: string) {
    const matchRes = await MatchResRepo.findmatchResultByMatchId(matchId);

    await MatchResRepo.resolveMatchResult(matchRes!.match_result_id, matchId, resolution, userId, resolutionNote);
    const status: 'verified' | 'rejected' = resolution === 'uphold' ? 'verified' : 'rejected';
    return toResolveResultDto({ match_id: matchId, match_result_status: status });
}

export async function getVerifiedResult(matchId : number){
    const matchRes = await MatchResRepo.findVerifiedResultByMatchId(matchId);
    if(!matchRes){
        throw new AppError(404 , "NOT_FOUND" , "ไม่พบข้อมูลที่ต้องการ");
    }

    return toVerifiedResult(matchRes)
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

    const runnerUpTeamId = finalResult.team_a_id === finalResult.winner_team_id
        ? finalResult.team_b_id
        : finalResult.team_a_id;

    const championRow = await checkTeam(finalResult.winner_team_id);
    const runnerUpRow = await TeamRepo.findById(runnerUpTeamId);

    return toTournamentWinnerDto(
        toTeamRef(championRow),
        runnerUpRow ? toTeamRef(runnerUpRow) : null,
        finalResult.score_data,
        tour.event_end_date
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

export async function updateLivestream(matchId : number , youtubeUrl : string){
    await checkMatch(matchId);

    if(!YOUTUBE_URL_REGEX.test(youtubeUrl)){
        throw new AppError(400 , "INVALID_YOUTUBE_URL" , "ลิงก์ YouTube ไม่ถูกต้อง");
    }

    await MatchRepo.updateLivestreamUrl(matchId , youtubeUrl);
    return { matchId , youtubeUrl };
}