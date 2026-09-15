import * as MatchRepo from '../repositories/match.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import { findLatestByTournamentAndUser } from '../repositories/tournamentReferee.repo.js';
import { toMatchDetailDto, toMatchListItemDto, toCheckinListItemDto, toCheckinStatusApi } from '../mappers/match.mapper.js';
import { AppError } from '../utils/AppError.js';
import { signCheckinQr, verifyCheckinQr } from '../utils/checkinQr.js';
import { isRefereeSufficient } from '../middlewares/requireReferee.js';
import { buildPagination } from '../utils/pagination.js';
import type { SubmitCheckinInput } from '../schemas/match.schema.js';
import type { MatchListFilters } from '../repositories/match.repo.js';

export async function getTournamentMatches(
    tournamentId: number,
    filters: MatchListFilters,
    page: number,
    pageSize: number,
    offset: number
) {
    const { rows, totalItems } = await MatchRepo.findMatchesByTournament(tournamentId, filters, offset, pageSize);
    const data = rows.map(toMatchListItemDto);
    const pagination = buildPagination(page, pageSize, totalItems);
    return { items: data, pagination };
}

export async function getMatchDetail(match_id: number) {
    const match = await MatchRepo.findMatchById(match_id);
    if (!match) {
        throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
    }
    return toMatchDetailDto(match);
}

/** วันที่ (ไทย UTC+7) ของ instant นี้ ในรูป YYYY-MM-DD — ไว้เทียบกับ DATE ของทัวร์ */
function thaiDateOf(d: Date): string {
    return new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// requireOrganizerOfMatch (middleware) เช็คสิทธิ์ organizer ให้แล้วก่อนถึงตรงนี้
// M06 — ตั้ง/เลื่อนเวลาแมตช์ · กฎ (GUIDE/11 §4.1, มติ 15 ก.ย.):
//   1. เฉพาะแมตช์ที่ยังไม่เริ่ม     2. อยู่ในช่วงวันของทัวร์ (ขยายวันต้องผ่าน C09)
//   3. ไม่ซ้อนช่วงเวลากับแมตช์อื่นของทีม/สนามเดียวกัน
//   4. ไม่พังลำดับสาย: แมตช์ก่อนหน้าต้องจบก่อนเริ่ม และต้องจบก่อนแมตช์ถัดไปเริ่ม
//   กรรมการซ้อนเวลา "ไม่" block ที่นี่ (มติ Q6) — ORG ดูจาก F14 coverage.conflicts
export async function scheduleMatch(matchId: number, scheduledTimeInput: string, scheduledEndTimeInput: string, venue: string) {
    const scheduledTime = new Date(scheduledTimeInput);
    const scheduledEndTime = new Date(scheduledEndTimeInput);

    const match = await MatchRepo.findMatchById(matchId);
    if (!match) {
        throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
    }
    if (match.match_status !== 'scheduled') {
        throw new AppError(409, "MATCH_ALREADY_STARTED", "แมตช์นี้เปิดเช็คอิน/เริ่มแข่งแล้ว เปลี่ยนเวลาไม่ได้");
    }

    // 2. ช่วงวันของทัวร์
    const tournament = await TournamentRepo.findTournamentById(match.tournament_id);
    if (tournament) {
        const start = thaiDateOf(scheduledTime), end = thaiDateOf(scheduledEndTime);
        const lastDay = tournament.event_end_date ?? tournament.event_start_date;
        if (start < tournament.event_start_date || end > lastDay) {
            throw new AppError(409, "OUTSIDE_TOURNAMENT_DATES",
                `แมตช์ต้องอยู่ระหว่าง ${tournament.event_start_date} ถึง ${lastDay} — ต้องการวันเพิ่มให้ขอแก้ไขทัวร์นาเมนต์ (C09)`,
                { eventStartDate: tournament.event_start_date, eventEndDate: lastDay });
        }
    }

    // 3. ทีม/สนามซ้อน
    const conflict = await MatchRepo.findConflictingMatch(matchId, scheduledTime, scheduledEndTime, venue, match.team_a_id, match.team_b_id);
    if (conflict) {
        throw new AppError(409, "SCHEDULE_CONFLICT", "ทีมหรือสนามนี้มีนัดแข่งซ้อนช่วงเวลาดังกล่าว", { conflictingMatchId: conflict.match_id });
    }

    // 4. ลำดับสาย
    for (const prev of await MatchRepo.findPredecessors(matchId)) {
        const prevEnd = prev.scheduled_end_time ?? prev.scheduled_time;
        if (prevEnd && prevEnd > scheduledTime) {
            throw new AppError(409, "SCHEDULE_BREAKS_BRACKET",
                `แมตช์ #${prev.match_id} (รอบก่อนหน้า) จบหลังเวลาเริ่มที่ตั้ง`, { blockingMatchId: prev.match_id });
        }
    }
    if (match.next_match_id !== null) {
        const next = await MatchRepo.findById(match.next_match_id);
        if (next?.scheduled_time && next.scheduled_time < scheduledEndTime) {
            throw new AppError(409, "SCHEDULE_BREAKS_BRACKET",
                `แมตช์ #${next.match_id} (รอบถัดไป) เริ่มก่อนเวลาจบที่ตั้ง`, { blockingMatchId: next.match_id });
        }
    }

    await MatchRepo.updateMatchSchedule(matchId, scheduledTime, scheduledEndTime, venue);
    const updated = await MatchRepo.findMatchById(matchId);
    return toMatchDetailDto(updated!);
}

// requireOrganizerOfMatch (middleware) เช็คสิทธิ์ organizer ให้แล้วก่อนถึงตรงนี้
export async function openCheckinMatch(matchId: number) {
    const match = await MatchRepo.findMatchById(matchId);
    if (!match) {
        throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
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

    // ด่าน 2 ของ BR-10 (GUIDE/11 §10.2): แมตช์นี้ต้องมีกรรมการ active ครบตามประเภท (on-site+stat = 2, อื่น = 1)
    // ไม่ครบ → ORG ต้องหาคน (FR02) หรือเลื่อน (M06) — ระบบไม่ปล่อยให้แข่งโดยไม่มีกรรมการ
    const fullMatch = await MatchRepo.findById(matchId);
    if (!fullMatch || !(await isRefereeSufficient(fullMatch))) {
        throw new AppError(409, "INSUFFICIENT_REFEREES", "กรรมการของแมตช์นี้ยังไม่ครบ ยังเริ่มแข่งไม่ได้");
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

    const referee = await findLatestByTournamentAndUser(match.tournament_id, userId);
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

    const referee = await findLatestByTournamentAndUser(match.tournament_id, userId);
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