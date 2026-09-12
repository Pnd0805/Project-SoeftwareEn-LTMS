import * as MatchRepo from '../repositories/match.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import { findLatestTournamentReferee } from '../repositories/referee.repo.js';
import { toMatchDetailDto, toMatchListItemDto, toCheckinListItemDto } from '../mappers/match.mapper.js';
import { AppError } from '../utils/AppError.js';
import { signCheckinQr, verifyCheckinQr } from '../utils/checkinQr.js';
import type { SubmitCheckinInput } from '../schemas/match.schema.js';

// ยึดค่า DB (success/rejected/exception) เป็นหลักตามกฎ Part 0-1 §1.2 แต่ตอบ response เป็นคำที่สเปกเอกสารใช้
// (B2 ที่ค้างอยู่ใน GUIDE/07: DB ไม่มีค่า 'pending_verification' เลยเดาว่า photo_online ที่รอตรวจ = 'exception')
function toCheckinStatusApi(dbStatus: 'success' | 'rejected' | 'exception'): string {
    if (dbStatus === 'success') return 'checked_in';
    if (dbStatus === 'exception') return 'pending_verification';
    return 'rejected';
}

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

export async function getCheckinQr(matchId: number, userId: number) {
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
        throw new AppError(403, "NOT_ORGANIZER_OR_REFEREE", "คุณไม่มีสิทธิ์ขอ QR เช็คอินของแมตช์นี้");
    }

    const { qrPayload, expiresAt } = signCheckinQr(matchId);
    return { qrPayload, expiresAt };
}

export async function submitCheckin(matchId: number, userId: number, input: SubmitCheckinInput) {
    const match = await MatchRepo.findMatchById(matchId);
    if (!match) {
        throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
    }

    const existing = await MatchRepo.findCheckinByMatchAndUser(matchId, userId);
    if (existing) {
        return {
            isNew: false,
            data: {
                id: existing.match_checkin_id,
                status: toCheckinStatusApi(existing.match_checkin_status),
                checkedInAt: existing.checked_in_at,
            },
        };
    }

    const teamIds = [match.team_a_id, match.team_b_id].filter((id): id is number => id !== null);
    const inRoster = await MatchRepo.isUserInTeams(userId, teamIds);
    if (!inRoster) {
        throw new AppError(403, "NOT_IN_APPROVED_ROSTER", "คุณไม่อยู่ในรายชื่อทีมที่ได้รับอนุมัติของแมตช์นี้");
    }

    let status: 'success' | 'exception';
    let documentType: 'student_id' | 'national_id' | null = null;
    let documentS3Key: string | null = null;

    if (input.method === 'qr_onsite') {
        verifyCheckinQr(input.qrPayload, matchId);
        status = 'success';
    } else {
        documentType = input.documentType;
        documentS3Key = input.documentS3Key;
        status = 'exception'; // ยังไม่ได้ตรวจ รอกรรมการผ่าน M14/M15
    }

    const checkin = await MatchRepo.insertCheckin({
        matchId, userId, method: input.method, status, documentType, documentS3Key,
    });

    return {
        isNew: true,
        data: {
            id: checkin.match_checkin_id,
            status: toCheckinStatusApi(checkin.match_checkin_status),
            checkedInAt: checkin.checked_in_at,
        },
    };
}