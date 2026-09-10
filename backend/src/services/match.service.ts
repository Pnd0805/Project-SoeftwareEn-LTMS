import * as MatchRepo from '../repositories/match.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import { findLatestTournamentReferee } from '../repositories/referee.repo.js';
import { toMatchDetailDto, toMatchListItemDto, toCheckinListItemDto } from '../mappers/match.mapper.js';
import { AppError } from '../utils/AppError.js';

export async function getTournamentMatches(tournamentId: number) {
    const rows = await MatchRepo.findMatchesByTournament(tournamentId);
    const data = rows.map(toMatchListItemDto);
    return { items: data };
}

export async function getMatchDetail(match_id: number) {
    const match = await MatchRepo.findMatchById(match_id);
    if (!match) {
        throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
    }
    return toMatchDetailDto(match);
}

export async function scheduleMatch(matchId: number, userId: number, scheduledTimeInput: string, venue: string) {
    const scheduledTime = new Date(scheduledTimeInput);

    const match = await MatchRepo.findMatchById(matchId);
    if (!match) {
        throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
    }

    const tournament = await TournamentRepo.findTournamentById(match.tournament_id);
    if (!tournament) {
        throw new AppError(404, "TOURNAMENT_NOT_FOUND", "ไม่พบทัวร์นาเมนต์นี้");
    }
    const isOrganizer = tournament.requested_by_user_id === userId
        && tournament.tournament_status !== 'pending_approval'
        && tournament.tournament_status !== 'rejected';
    if (!isOrganizer) {
        throw new AppError(403, "NOT_ORGANIZER", "คุณไม่ใช่ผู้จัดการแข่งขันของทัวร์นาเมนต์นี้");
    }

    const conflict = await MatchRepo.findConflictingMatch(matchId, scheduledTime, venue, match.team_a_id, match.team_b_id);
    if (conflict) {
        throw new AppError(409, "SCHEDULE_CONFLICT", "ทีมหรือสนามนี้มีนัดแข่งในเวลาดังกล่าวแล้ว", { conflictingMatchId: conflict.match_id });
    }

    await MatchRepo.updateMatchSchedule(matchId, scheduledTime, venue);
    const updated = await MatchRepo.findMatchById(matchId);
    return toMatchDetailDto(updated!);
}

export async function openCheckinMatch(matchId: number, userId: number) {
    const match = await MatchRepo.findMatchById(matchId);
    if (!match) {
        throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
    }

    const tournament = await TournamentRepo.findTournamentById(match.tournament_id);
    if (!tournament) {
        throw new AppError(404, "TOURNAMENT_NOT_FOUND", "ไม่พบทัวร์นาเมนต์นี้");
    }
    const isOrganizer = tournament.requested_by_user_id === userId
        && tournament.tournament_status !== 'pending_approval'
        && tournament.tournament_status !== 'rejected';
    if (!isOrganizer) {
        throw new AppError(403, "NOT_ORGANIZER", "คุณไม่ใช่ผู้จัดการแข่งขันของทัวร์นาเมนต์นี้");
    }

    await MatchRepo.openMatchCheckin(matchId);
    const updated = await MatchRepo.findMatchById(matchId);
    return { id: matchId, status: 'checkin_open', checkinOpenAt: updated!.checkin_open_at };
}

export async function startMatch(matchId: number, userId: number){
    const match = await MatchRepo.findMatchById(matchId);
    if (!match) {
        throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
    }

    if (match.match_status !== 'checkin_open') {
        throw new AppError(409, "MATCH_NOT_CHECKIN_OPEN", "ต้องเปิดเช็คอินก่อนถึงจะเริ่มแข่งได้");
    }
    
    const countA = await MatchRepo.countSuccessfulCheckins(matchId, match.team_a_id);
    const countB = await MatchRepo.countSuccessfulCheckins(matchId, match.team_b_id);

    if (countA === 0 || countB === 0) {
        throw new AppError(409, "INSUFFICIENT_CHECKINS", "ยังมีผู้เล่นเช็คอินไม่ครบ");
    }

    await MatchRepo.updateMatchStatus(matchId, 'in_progress');
    return { id: matchId, status:'in_progress' };
}

export async function getMatchCheckins(matchId: number, userId: number) {
    const match = await MatchRepo.findMatchById(matchId);
    if (!match) {
        throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
    }

    const tournament = await TournamentRepo.findTournamentById(match.tournament_id);
    if (!tournament) {
        throw new AppError(404, "TOURNAMENT_NOT_FOUND", "ไม่พบทัวร์นาเมนต์นี้");
    }
    const isOrganizer = tournament.requested_by_user_id === userId
        && tournament.tournament_status !== 'pending_approval'
        && tournament.tournament_status !== 'rejected';

    const referee = await findLatestTournamentReferee(match.tournament_id, userId);
    const isReferee = referee !== null
        && referee.invitation_status === 'accepted'
        && (referee.is_external === 0 || referee.external_approval_status === 'approved');

    if (!isOrganizer && !isReferee) {
        throw new AppError(403, "NOT_ORGANIZER_OR_REFEREE", "คุณไม่มีสิทธิ์ดูรายการเช็คอินนี้");
    }

    const rows = await MatchRepo.findCheckinsByMatch(matchId);
    return { items: rows.map(toCheckinListItemDto) };
}

export async function verifyCheckin(checkinId: number , matchId: number, userId: number){
    const checkin = await MatchRepo.findCheckinById(checkinId);
    if (!checkin) {
        throw new AppError(404, "CHECKIN_NOT_FOUND", "ไม่พบรายการเช็คอินนี้");
    }
    if(checkin.match_id !== matchId){
        throw new AppError(404, "CHECKIN_NOT_FOUND", "ไม่พบรายการเช็คอินนี้ในแมตช์นี้");
    }

    await MatchRepo.verifyCheckin(checkinId, userId);
    return { id: checkinId, status:'verified' }
}

export async function rejectCheckin(checkinId: number, matchId: number, userId: number, reason: string){
    const checkin = await MatchRepo.findCheckinById(checkinId);
    if (!checkin) {
        throw new AppError(404, "CHECKIN_NOT_FOUND", "ไม่พบรายการเช็คอินนี้");
    }
    if(checkin.match_id !== matchId){
        throw new AppError(404, "CHECKIN_NOT_FOUND", "ไม่พบรายการเช็คอินนี้ในแมตช์นี้");
    }

    await MatchRepo.rejectCheckin(checkinId, userId, reason);
    return { id: checkinId, status: 'rejected', reason };
}