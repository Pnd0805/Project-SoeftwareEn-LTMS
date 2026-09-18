import * as MatchRepo from '../repositories/match.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import { isRefereeOfMatch, isRefereeSufficient } from '../middlewares/requireReferee.js';
import { getPresignedDownloadUrl } from './upload.service.js';
import * as WalkoverRepo from '../repositories/walkover.repo.js';
import * as Walkover from './walkover.service.js';
import { toMatchDetailDto, toMatchListItemDto, toCheckinListItemDto, toCheckinStatusApi } from '../mappers/match.mapper.js';
import { AppError } from '../utils/AppError.js';
import { signCheckinQr, verifyCheckinQr } from '../utils/checkinQr.js';
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
        // code เดียวกับที่ refereeRequest.service ใช้ตอนแมตช์เปลี่ยนไม่ได้
        throw new AppError(409, "MATCH_NOT_CHANGEABLE", "แมตช์นี้เปิดเช็คอินหรือเริ่มแข่งไปแล้ว แก้เวลาหรือสนามไม่ได้");
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

    // UPDATE เฉพาะแถวที่ยัง scheduled — กันเปิดซ้ำตอนแข่งอยู่ (เดิมย้อนสถานะ in_progress กลับเป็น checkin_open ได้)
    const opened = await MatchRepo.openMatchCheckin(matchId);
    if (!opened) {
        throw new AppError(409, "INVALID_STATUS_TRANSITION", "เปิดเช็คอินได้เฉพาะแมตช์ที่ยังไม่เริ่ม (สถานะ scheduled) เท่านั้น");
    }

    const updated = await MatchRepo.findMatchById(matchId);
    return { id: matchId, status: 'checkin_open', checkinOpenAt: updated!.checkin_open_at };
}

/** M18 — ORG ปิดเช็คอิน (checkin_open → scheduled, ล้างเช็คอิน) เพื่อไปเลื่อนด้วย M06 — requireOrganizerOfMatch เช็คสิทธิ์แล้ว */
export async function closeCheckinMatch(matchId: number) {
    const match = await MatchRepo.findMatchById(matchId);
    if (!match) {
        throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
    }
    if (!(await Walkover.closeCheckin(matchId))) {
        throw new AppError(409, "INVALID_STATUS_TRANSITION", "ปิดเช็คอินได้เฉพาะแมตช์ที่กำลังเปิดเช็คอิน (สถานะ checkin_open) เท่านั้น");
    }
    return { id: matchId, status: 'scheduled' as const, checkinOpenAt: null };
}

/**
 * M17 — ORG ตัดสินแมตช์ที่ทีมไม่มาตามนัด (GUIDE/11 §10.5): ฝั่งที่เช็คอินไม่ถึง min_members แพ้บาย · ไม่ถึงทั้งคู่ = แพ้ทั้งคู่
 * ต่างจาก M10: ไม่ต้องรอกรรมการ (ไม่มีการแข่ง) และตัดสินแพ้ทั้งคู่ได้ — requireOrganizerOfMatch เช็คสิทธิ์แล้ว
 */
export async function forfeitMatch(matchId: number, orgUserId: number) {
    const match = await MatchRepo.findMatchById(matchId);
    if (!match) {
        throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
    }
    if (match.match_status !== 'checkin_open') {
        throw new AppError(409, "CHECKIN_NOT_OPEN", "ตัดสินไม่มาตามนัดได้เฉพาะแมตช์ที่เปิดเช็คอินอยู่ — ทีมต้องมีโอกาสเช็คอินก่อน");
    }
    if (match.team_a_id === null || match.team_b_id === null) {
        throw new AppError(409, "MATCH_TEAMS_INCOMPLETE", "แมตช์นี้ยังไม่มีทีมครบทั้งสองฝั่ง");
    }

    const sport = await WalkoverRepo.findSportOfTournament(match.tournament_id);
    const minMembers = sport?.min_members ?? 1;
    const countA = await MatchRepo.countSuccessfulCheckins(matchId, match.team_a_id);
    const countB = await MatchRepo.countSuccessfulCheckins(matchId, match.team_b_id);
    const fullMatch = (await MatchRepo.findById(matchId))!;

    const outcome = await Walkover.applyOrganizerForfeit(fullMatch, countA, countB, minMembers, orgUserId);
    if (outcome === null) {
        throw new AppError(409, "TEAMS_PRESENT", "ทั้งสองทีมเช็คอินครบขั้นต่ำแล้ว ให้กรรมการเริ่มแข่ง (M10) แทน",
            { minMembers, checkedIn: { [match.team_a_id]: countA, [match.team_b_id]: countB } });
    }
    return { id: matchId, status: 'completed' as const, kind: outcome.kind, minMembers,
             checkedIn: { [match.team_a_id]: countA, [match.team_b_id]: countB }, walkovers: outcome.results };
}

// requireReferee (middleware) เช็คว่าเป็นกรรมการของแมตช์นี้ให้แล้วก่อนถึงตรงนี้
export async function startMatch(matchId: number, userId: number){
    const match = await MatchRepo.findMatchById(matchId);
    if (!match) {
        throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
    }

    if (match.match_status !== 'checkin_open') {
        throw new AppError(409, "CHECKIN_NOT_OPEN", "ต้องเปิดเช็คอินก่อนถึงจะเริ่มแข่งได้");
    }

    if (match.team_a_id === null || match.team_b_id === null) {
        throw new AppError(409, "MATCH_TEAMS_INCOMPLETE", "แมตช์นี้ยังไม่มีทีมครบทั้งสองฝั่ง");
    }

    // ด่าน 2 ของ BR-10 (GUIDE/11 §10.2): แมตช์นี้ต้องมีกรรมการ active ครบตามประเภท (on-site+stat = 2, อื่น = 1)
    // ไม่ครบ → ORG ต้องหาคน (FR02) หรือเลื่อน (M06) — ระบบไม่ปล่อยให้แข่งโดยไม่มีกรรมการ
    // เช็คก่อนนับเช็คอิน: กรรมการไม่ครบต้องไม่ทำให้ทีมไหนแพ้บาย
    const fullMatch = await MatchRepo.findById(matchId);
    if (!fullMatch || !(await isRefereeSufficient(fullMatch))) {
        throw new AppError(409, "INSUFFICIENT_REFEREES", "กรรมการของแมตช์นี้ยังไม่ครบ ยังเริ่มแข่งไม่ได้");
    }

    // ทีมต้องมีผู้เล่นเช็คอิน >= sport_types.min_members — ฝั่งที่ไม่ถึงแพ้บาย (GUIDE/11 §10.4, มติ 17 ก.ย.)
    const sport = await WalkoverRepo.findSportOfTournament(match.tournament_id);
    const minMembers = sport?.min_members ?? 1;
    const countA = await MatchRepo.countSuccessfulCheckins(matchId, match.team_a_id);
    const countB = await MatchRepo.countSuccessfulCheckins(matchId, match.team_b_id);
    const decision = Walkover.decideNoShow(fullMatch, countA, countB, minMembers);
    if (decision === 'both_short') {
        // ไม่มีฝ่ายไหนพร้อม — ไม่มีใครควรได้บาย ให้ ORG เลื่อน (M06) หรือรอ
        throw new AppError(409, "INSUFFICIENT_CHECKINS", `ทั้งสองทีมมีผู้เล่นเช็คอินไม่ถึงขั้นต่ำ ${minMembers} คน`,
            { minMembers, checkedIn: { [match.team_a_id]: countA, [match.team_b_id]: countB } });
    }
    if (decision !== null) {
        const wo = await Walkover.applyNoShowWalkover(fullMatch, decision.winnerTeamId, decision.loserTeamId, userId);
        return { id: matchId, status: 'completed', walkover: { ...wo, reason: 'insufficient_checkins', minMembers,
                 checkedIn: { [match.team_a_id]: countA, [match.team_b_id]: countB } } };
    }

    await MatchRepo.updateMatchStatus(matchId, 'in_progress');
    return { id: matchId, status:'in_progress' };
}

/** M11/M13 — ORG ของทัวร์ และ/หรือ กรรมการของแมตช์นี้ (active + รับมอบหมายแมตช์นี้แล้ว) */
async function findMatchRoles(matchId: number, tournamentId: number, userId: number) {
    const tournament = await TournamentRepo.findTournamentById(tournamentId);
    if (!tournament) {
        throw new AppError(404, "TOURNAMENT_NOT_FOUND", "ไม่พบทัวร์นาเมนต์นี้");
    }
    const isOrganizer = tournament.requested_by_user_id === userId
        && tournament.tournament_status !== 'pending_approval'
        && tournament.tournament_status !== 'rejected';
    const isReferee = await isRefereeOfMatch(matchId, userId, tournamentId);

    return { isOrganizer, isReferee };
}

export async function getMatchCheckins(matchId: number, userId: number) {
    const match = await MatchRepo.findMatchById(matchId);
    if (!match) {
        throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
    }

    const { isOrganizer, isReferee } = await findMatchRoles(matchId, match.tournament_id, userId);
    if (!isOrganizer && !isReferee) {
        throw new AppError(403, "NOT_ORGANIZER_OR_REFEREE", "คุณไม่มีสิทธิ์ดูรายการเช็คอินนี้");
    }

    // PDPA (NF-SE-03) — รูปบัตรเปิดดูได้เฉพาะกรรมการของแมตช์นี้ ORG เห็นรายการแต่ documentUrl = null
    const rows = await MatchRepo.findCheckinsByMatch(matchId);
    const items = await Promise.all(rows.map(async (row) => {
        const documentUrl = isReferee && row.document_s3_key
            ? await getPresignedDownloadUrl(row.document_s3_key)
            : null;
        return toCheckinListItemDto(row, documentUrl);
    }));
    return { items };
}

// M14/M15 ตัดสินได้ครั้งเดียว และเฉพาะเช็คอินแบบรูปที่รอตรวจ (pending) — QR ผ่านอัตโนมัติไม่ต้องตรวจ
function checkinAlreadyDecided() {
    return new AppError(409, "ALREADY_DECIDED", "รายการเช็คอินนี้ไม่ได้รอกรรมการตรวจ (ตรวจไปแล้ว หรือเป็นการเช็คอินด้วย QR) เปลี่ยนผลไม่ได้");
}

async function findPendingCheckinOfMatch(checkinId: number, matchId: number) {
    const checkin = await MatchRepo.findCheckinById(checkinId);
    if (!checkin) {
        throw new AppError(404, "CHECKIN_NOT_FOUND", "ไม่พบรายการเช็คอินนี้");
    }
    if(checkin.match_id !== matchId){
        throw new AppError(404, "CHECKIN_NOT_FOUND", "ไม่พบรายการเช็คอินนี้ในแมตช์นี้");
    }

    // ตรวจได้ช่วงเปิดเช็คอินและระหว่างแข่ง (เผื่อคนมาช้า) — ก่อนเปิดหรือหลังจบแล้วตัดสินไม่ได้
    const match = await MatchRepo.findMatchById(matchId);
    if (!match || (match.match_status !== 'checkin_open' && match.match_status !== 'in_progress')) {
        throw new AppError(409, "MATCH_NOT_CHANGEABLE", "แมตช์นี้ยังไม่เปิดเช็คอินหรือจบไปแล้ว ตรวจเช็คอินไม่ได้");
    }

    if (checkin.match_checkin_status !== 'pending') {
        throw checkinAlreadyDecided();
    }
    return checkin;
}

export async function verifyCheckin(checkinId: number , matchId: number, userId: number){
    await findPendingCheckinOfMatch(checkinId, matchId);

    // repo UPDATE เฉพาะแถวที่ยัง pending — กรรมการ 2 คนกดพร้อมกัน คนที่สองได้ 409
    if (!(await MatchRepo.verifyCheckin(checkinId, userId))) {
        throw checkinAlreadyDecided();
    }
    return { id: checkinId, status:'verified' }
}

export async function rejectCheckin(checkinId: number, matchId: number, userId: number, reason: string){
    await findPendingCheckinOfMatch(checkinId, matchId);

    if (!(await MatchRepo.rejectCheckin(checkinId, userId, reason))) {
        throw checkinAlreadyDecided();
    }
    return { id: checkinId, status: 'rejected', reason };
}

export async function getCheckinQr(matchId: number, userId: number) {
    const match = await MatchRepo.findMatchById(matchId);
    if (!match) {
        throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
    }

    const { isOrganizer, isReferee } = await findMatchRoles(matchId, match.tournament_id, userId);
    if (!isOrganizer && !isReferee) {
        throw new AppError(403, "NOT_ORGANIZER_OR_REFEREE", "คุณไม่มีสิทธิ์ขอ QR เช็คอินของแมตช์นี้");
    }

    // QR ใช้เช็คอินได้เฉพาะตอนเปิดเช็คอิน — ออกให้ก่อนหรือหลังช่วงนั้นก็ใช้ไม่ได้อยู่ดี
    if (match.match_status !== 'checkin_open') {
        throw new AppError(409, "CHECKIN_NOT_OPEN", "แมตช์นี้ยังไม่เปิดเช็คอิน หรือปิดเช็คอินไปแล้ว");
    }

    const { qrPayload, expiresAt } = signCheckinQr(matchId);
    return { qrPayload, expiresAt };
}

export async function submitCheckin(matchId: number, userId: number, input: SubmitCheckinInput) {
    const match = await MatchRepo.findMatchById(matchId);
    if (!match) {
        throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
    }

    // กดซ้ำ = 200 ข้อมูลเดิมเสมอ แม้แมตช์จะเริ่มแข่งไปแล้ว (idempotent ตาม spec M12)
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

    // เช็คอินใหม่ได้เฉพาะตอนเปิดเช็คอิน (M09) — ก่อนเปิดหรือหลังเริ่มแข่ง/จบแล้วไม่ได้
    if (match.match_status !== 'checkin_open') {
        throw new AppError(409, "CHECKIN_NOT_OPEN", "แมตช์นี้ยังไม่เปิดเช็คอิน หรือปิดเช็คอินไปแล้ว");
    }

    const teamIds = [match.team_a_id, match.team_b_id].filter((id): id is number => id !== null);
    const inRoster = await MatchRepo.isUserInTeams(userId, teamIds);
    if (!inRoster) {
        throw new AppError(403, "NOT_IN_APPROVED_ROSTER", "คุณไม่อยู่ในรายชื่อทีมที่ได้รับอนุมัติของแมตช์นี้");
    }

    let status: 'success' | 'pending';
    let documentType: 'student_id' | 'national_id' | null = null;
    let documentS3Key: string | null = null;

    if (input.method === 'qr_onsite') {
        verifyCheckinQr(input.qrPayload, matchId);
        status = 'success';
    } else {
        documentType = input.documentType;
        documentS3Key = input.documentS3Key;
        status = 'pending'; // ยังไม่ได้ตรวจ รอกรรมการผ่าน M14/M15
    }

    const inserted = await MatchRepo.insertCheckin({
        matchId, userId, method: input.method, status, documentType, documentS3Key,
    });
    // null = ชน UNIQUE(match_id, user_id) เพราะอีก request ที่ยิงพร้อมกัน insert ไปก่อน → คืนแถวนั้นแบบ idempotent
    const checkin = inserted ?? await MatchRepo.findCheckinByMatchAndUser(matchId, userId);

    return {
        isNew: inserted !== null,
        data: {
            id: checkin!.match_checkin_id,
            status: toCheckinStatusApi(checkin!.match_checkin_status),
            checkedInAt: checkin!.checked_in_at,
        },
    };
}
