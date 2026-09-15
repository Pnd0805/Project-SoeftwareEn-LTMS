import * as UserRepo from '../repositories/user.repo.js'
import * as TeamRepo from '../repositories/team.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import * as MatchResRepo from '../repositories/matchResult.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import * as AnnouncementRepo from '../repositories/announcement.repo.js';
import { AppError } from './AppError.js';

export async function checkUser(userId : number){
    const user = await UserRepo.findById(userId);
    if(!user){
        throw new AppError(404 , "USER_NOT_FOUND" , "ไม่พบผู้ใช้นี้ในระบบ");
    }
    return user
}

export async function checkTeam(teamId : number){
    const team = await TeamRepo.findById(teamId);
    if(!team){
        throw new AppError(404 , "TEAM_NOT_FOUND" , "ไม่พบทีมนี้ในระบบ");
    }
    return team;
}

export async function checkMatch(matchId : number){
    const match = await MatchRepo.findById(matchId);
    if(!match){
        throw new AppError(404 , "MATCH_NOT_FOUND" , "ไม่พบแมตช์นี้");
    }
    return match;
}

export async function checkMatchResult(matchId: number) {
    const matchRes = await MatchResRepo.findmatchResultByMatchId(matchId);
    if (!matchRes) {
        throw new AppError(404, "MATCH_RESULT_NOT_FOUND", "ยังไม่มีผลการแข่งขันที่ส่งไว้สำหรับแมตช์นี้");
    }
    return matchRes;
}

export async function checkTournament(tourId : number){
    const tour = await TournamentRepo.findTournamentById(tourId);
    if(!tour){
        throw new AppError(404 , "TOURNAMENT_NOT_FOUND" , "ไม่พบทัวร์นาเมนต์นี้");
    }
    return tour;
}

export async function checkAnnouncement(announcementId : number){
    const announcement = await AnnouncementRepo.findById(announcementId);
    if(!announcement){
        throw new AppError(404 , "ANNOUNCEMENT_NOT_FOUND" , "ไม่พบประกาศนี้");
    }
    return announcement;
}