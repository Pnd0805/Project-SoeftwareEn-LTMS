import * as ApplicationRepo from '../repositories/application.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import * as SportTypeRepo from '../repositories/sportType.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import * as FeedbackRepo from '../repositories/feedback.repo.js';   // hasPlayedMatch — นิยาม "ทัวร์เริ่มแล้ว" ตัวเดียวของระบบ
import * as UploadService from './upload.service.js';
import { toTeamRef } from '../mappers/team.mapper.js';
import { toApplicationDetailDto, toMyApplicationDto } from '../mappers/application.mapper.js';
import { toOrganizerApplicationDto } from '../mappers/application.mapper.js';
import { AppError } from '../utils/AppError.js';
import { buildPagination } from '../utils/pagination.js';
import { genderAgeFailReason } from '../utils/hardFilter.js';
import * as WalkoverRepo from '../repositories/walkover.repo.js';
import * as Walkover from './walkover.service.js';
import * as NotificationService from './notification.service.js';
import { REFEREE_INVITATION_DAYS } from '../config/scoring.js';

type HardFilterFail = { userId: number; fullName: string; reason: 'gender' | 'age' | 'year' | 'faculty' };

// 🔴 `calculateAge` ย้ายไป utils/hardFilter.ts เมื่อ 7 ต.ค. 2569 (BE-36)
//    เพราะ `approveAmendment` ต้องตรวจเพศ/อายุย้อนหลังด้วยสูตรเดียวกัน
//    ถ้าเขียนขึ้นใหม่ที่ฝั่งนั้น จะมีสองสูตรที่เถียงกันได้


export async function getApprovedTeams(tournamentId: number) {
    const rows = await ApplicationRepo.findApprovedTeamsByTournament(tournamentId);
    const data = rows.map(toTeamRef);
    return { items: data };
}

export async function getMyappication(userId: number, page: number, pageSize: number, offset: number) {
    const { rows, totalItems } = await ApplicationRepo.findApplicationsByLeader(userId, offset, pageSize);
    const data = rows.map(toMyApplicationDto);
    const pagination = buildPagination(page, pageSize, totalItems);
    return { items: data, pagination };
}

export async function getTournamentApplications(tournamentId: number, page: number, pageSize: number, offset: number) {
    const { rows, totalItems } = await ApplicationRepo.findApplicationsByTournament(tournamentId, offset, pageSize);
    const data = rows.map(toOrganizerApplicationDto);
    const pagination = buildPagination(page, pageSize, totalItems);
    return { items: data, pagination };
}

export async function getApplicationDetail(applicationId: number, userId: number) {
    const app = await ApplicationRepo.findApplicationById(applicationId);
    if (!app) {
        throw new AppError(404, "APPLICATION_NOT_FOUND", "ไม่พบใบสมัครนี้");
    }

    const isOrganizer = app.tournament_requested_by_user_id === userId && app.tournament_status !== 'pending_approval' && app.tournament_status !== 'rejected';   
    const isTeamLeader = app.team_leader_id === userId ; 

    if (!isOrganizer && !isTeamLeader) {
        throw new AppError(403, "APPLICATION_ACCESS_DENIED", "คุณไม่มีสิทธิ์ดูใบสมัครนี้");
    }

    // P04 ต้องคืน presigned URL ไม่ใช่ S3 key ดิบ (ต่างจาก P03 ที่คืน key ดิบ) — ดู Part 3 ข้อ 11
    const rawKeys = app.soft_filter_documents ?? [];
    const softFilterDocumentUrls = await Promise.all(rawKeys.map(key => UploadService.getPresignedDownloadUrl(key)));
    const players = await ApplicationRepo.findPlayersByApplication(applicationId);

    return toApplicationDetailDto(app, softFilterDocumentUrls, players);
}

export async function cancelApplication(applicationId: number, userId: number) {
    const app = await ApplicationRepo.findApplicationById(applicationId);
    if (!app) {
        throw new AppError(404, "APPLICATION_NOT_FOUND", "ไม่พบใบสมัครนี้");
    }

    const isTeamLeader = app.team_leader_id === userId;
    if (!isTeamLeader){
        throw new AppError(403, "NOT_TEAM_LEADER", "คุณไม่ใช่หัวหน้าทีมนี้");
    }
    if (app.tournament_application_status !== "pending"){
        throw new AppError(409, "ALREADY_DECIDED", "คำขอนี้ถูกพิจารณาไปแล้ว ยกเลิกไม่ได้");
    }

    await ApplicationRepo.updateApplicationStatus(applicationId, "cancelled");
    // ใบสมัครตาย → ปลดล็อกผู้เล่น ไปอยู่ทีมอื่นในทัวร์เดียวกันได้ (มติ 19 ก.ย. 2569)
    await ApplicationRepo.deletePlayersByApplication(applicationId);
    return { id: applicationId, status: 'cancelled' };
}

export async function withdrawApplication(applicationId: number, userId: number) {
    const app = await ApplicationRepo.findApplicationById(applicationId);
    if (!app){
        throw new AppError(404, "APPLICATION_NOT_FOUND", "ไม่พบใบสมัครนี้");
    }

    const isTeamLeader = app.team_leader_id === userId;
    if (!isTeamLeader){
        throw new AppError(403, "NOT_TEAM_LEADER", "คุณไม่ใช่หัวหน้าทีมนี้");
    }
    if (app.tournament_status === 'completed'){
        throw new AppError(409, "TOURNAMENT_COMPLETED", "ทัวร์นาเมนต์นี้ปิดการแข่งขันแล้ว ถอนตัวไม่ได้");
    }
    if (app.tournament_application_status !== "approved"){
        throw new AppError(409, "APPLICATION_NOT_APPROVED", "ใบสมัครนี้ยังไม่ได้รับการอนุมัติ จึงไม่สามารถถอนตัวได้");
    }
    // ถอนกลางแมตช์ไม่ได้ — ให้กรรมการส่งผลตามจริง (GUIDE/11 §10.4, มติ Q2-A)
    if (await WalkoverRepo.hasInProgressMatch(app.tournament_id, app.team_id)){
        throw new AppError(409, "MATCH_IN_PROGRESS", "ทีมมีแมตช์ที่กำลังแข่งอยู่ ถอนตัวได้หลังแมตช์จบ");
    }

    await ApplicationRepo.updateApplicationStatus(applicationId, "withdrawn");

    /**
     * มติ 26 ก.ย. — ลบรายชื่อผู้เล่นเฉพาะตอนทัวร์ยังไม่เริ่มแข่ง
     *   ยังไม่เริ่ม : ต้องลบ เพื่อปลด UNIQUE (tournament_id, user_id) ให้ทีมสมัครใหม่ได้ (A1)
     *                 และให้ผู้เล่นไปอยู่ทีมอื่นในทัวร์เดียวกันได้
     *   เริ่มแล้ว   : เก็บไว้ — มีประวัติเกิดขึ้นแล้ว ต้องบอกได้ว่าใครลงแมตช์ไหน และกรรมการยังต้อง
     *                 ส่งผล/กรอกสถิติย้อนหลังได้ · UNIQUE ที่ค้างอยู่ไม่ทำร้ายใครเพราะตอนนั้นสมัครใหม่ไม่ได้อยู่แล้ว
     *                 และคนที่ลงแข่งให้ทีมหนึ่งไปแล้วก็ไม่ควรไปเล่นให้อีกทีมในทัวร์เดียวกัน
     * ใช้ตัวตัดสิน "ทัวร์เริ่มแล้วหรือยัง" ตัวเดียวกับ C6 (hasPlayedMatch) — ชนะบายไม่นับว่าเริ่ม
     */
    if (!(await FeedbackRepo.hasPlayedMatch(app.tournament_id))) {
        await ApplicationRepo.deletePlayersByApplication(applicationId);
    }
    const matchCount = await MatchRepo.countMatchesByTournament(app.tournament_id);

    // มีสายแล้ว → แมตช์ที่ยังไม่เริ่มของทีมนี้ อีกฝั่งชนะบาย (คู่ที่ยังไม่มาจะบายตอนคู่มาถึง)
    const walkovers = matchCount > 0
        ? await Walkover.processTeamWithdrawal(app.tournament_id, app.team_id, userId)
        : [];
    await NotificationService.notify({
        userId: app.tournament_requested_by_user_id, type: 'application_withdrawn',
        title: 'ทีมถอนตัวจากทัวร์นาเมนต์',
        message: `ทีม "${app.team_name}" ถอนตัวจากทัวร์นาเมนต์` +
                 (walkovers.length > 0 ? ` — ตัดสินชนะบายให้คู่แข่งแล้ว ${walkovers.length} แมตช์` : ''),
        relatedEntityType: 'tournament', relatedEntityId: app.tournament_id,
    });

    /**
     * สมาชิกของทีมที่ถอน — เดิมมีแต่ ORG ที่ได้รู้ (แก้ 1 ต.ค. 2569)
     *
     * คนที่เสียสิทธิ์ลงแข่งคือสมาชิกทีม แต่ไม่มีใครบอกเขา · ส่งถึง**สมาชิกทุกคน** ไม่ใช่แค่คนในรายชื่อ
     * ลงแข่ง เพราะคนที่ไม่ได้ถูกส่งชื่อลงรอบนี้ก็เสียโอกาสของทัวร์นี้ไปเหมือนกัน
     *
     * ไม่ส่งหาหัวหน้าทีมที่กดเอง (exceptUserId) และ**ไม่ซ้ำกับแจ้งเตือนรายแมตช์**:
     * แมตช์ที่ถูกตัดสินชนะบายจากการถอนนี้ ยิง `match_walkover` แยกอยู่แล้วตามมติ 22 ก.ย.
     * ถึงสมาชิกทุกคนของทั้งสองทีม + กรรมการของแมตช์ + ORG (walkover.service → notifyMatchDecidedWithoutPlay)
     * ⇒ อันนี้คือ "ทีมคุณถอนจากทัวร์" ส่วนอันนั้นคือ "แมตช์นี้จบด้วยผลอะไร" คนละเรื่องกัน
     * และเป็นทางเดียวที่ทีมได้รู้เมื่อทัวร์ยังไม่จัดสาย (matchCount = 0 ⇒ ไม่มีแมตช์ให้ยิงเลย)
     */
    await NotificationService.notifyTeamMembers([app.team_id], {
        type: 'application_withdrawn',
        title: 'ทีมของคุณถอนตัวจากทัวร์นาเมนต์',
        message: `ทีม "${app.team_name}" ถอนตัวจากทัวร์นาเมนต์แล้ว` +
                 (walkovers.length > 0 ? ` — แมตช์ที่ยังไม่แข่ง ${walkovers.length} แมตช์ถูกตัดสินให้คู่แข่งชนะบาย` : ''),
        relatedEntityType: 'tournament', relatedEntityId: app.tournament_id,
    }, { exceptUserId: userId });
    return { id: applicationId, status: "withdrawn", bracketExists: matchCount > 0, walkovers };
}

export async function approveApplication(applicationId: number,userId: number) {
    const app = await ApplicationRepo.findApplicationById(applicationId);
    if (!app){
        throw new AppError(404, "APPLICATION_NOT_FOUND", "ไม่พบใบสมัครนี้");
    }
    const isOrganizer = app.tournament_requested_by_user_id === userId && app.tournament_status !== 'pending_approval' && app.tournament_status !== 'rejected';
    if (!isOrganizer){
        throw new AppError(403, "NOT_ORGANIZER", "คุณไม่ใช่ผู้จัดการแข่งขันของทัวร์นาเมนต์นี้");
    }
    if (app.tournament_application_status !== "pending"){
        throw new AppError(409, "ALREADY_DECIDED", "คำขอนี้ถูกพิจารณาไปแล้ว ยกเลิกไม่ได้");
    }

    /**
     * 🔴 BE-03 (7 ต.ค. 2569) — ห้ามอนุมัติเกินโควตา `max_teams`
     *
     * เดิมเรียก `updateApplicationStatus` ตรง ๆ ⇒ ทัวร์ maxTeams 4 อนุมัติ 5 ทีมได้
     * แล้วจับสายออกมา 4 แมตช์สำหรับ 5 ทีม — ทีมที่เกินมาไม่มีที่ยืนในสาย
     * ★ ด่านอยู่ใน**ทรานแซกชันเดียวกับการเขียน** (ดู repo) ไม่ใช่เช็คที่นี่แล้วเขียนทีหลัง
     *   เพราะกดอนุมัติพร้อมกันสองใบจะผ่านด่านทั้งคู่
     * ★ ด่าน `pending` ข้างบนยังอยู่เพื่อให้ได้ข้อความ/โค้ดเดิมในเคสปกติ แต่ repo ตรวจซ้ำ
     *   ภายใต้ล็อกด้วย — ของข้างบนคือ "ตอบเร็ว" ของข้างล่างคือ "ถูกต้องจริง"
     */
    const quota = await ApplicationRepo.approveApplicationWithinQuota(applicationId);
    if (quota.decision === 'not_found'){
        throw new AppError(404, "APPLICATION_NOT_FOUND", "ไม่พบใบสมัครนี้");
    }
    if (quota.decision === 'already_decided'){
        throw new AppError(409, "ALREADY_DECIDED", "คำขอนี้ถูกพิจารณาไปแล้ว ยกเลิกไม่ได้");
    }
    if (quota.decision === 'tournament_full'){
        throw new AppError(409, "TOURNAMENT_FULL",
            `ทัวร์นาเมนต์นี้รับทีมครบ ${quota.maxTeams} ทีมแล้ว อนุมัติเพิ่มไม่ได้ — ถ้าต้องการรับมากกว่านี้ ต้องยื่นคำขอแก้จำนวนทีมสูงสุดให้แอดมินอนุมัติ`,
            { maxTeams: quota.maxTeams, approvedTeams: quota.approvedTeams });
    }

    await NotificationService.notify({
        userId: app.team_leader_id, type: 'application_decided',
        title: 'ใบสมัครได้รับการอนุมัติ',
        message: `ใบสมัครของทีม "${app.team_name}" ได้รับการอนุมัติแล้ว`,
        relatedEntityType: 'tournament', relatedEntityId: app.tournament_id,
    });
    return { id: applicationId, status: "approved"};
}

export async function rejectApplication(applicationId: number, userId: number, reason: string) {
    const app = await ApplicationRepo.findApplicationById(applicationId);
    if (!app){
        throw new AppError(404, "APPLICATION_NOT_FOUND", "ไม่พบใบสมัครนี้");
    }

    const isOrganizer = app.tournament_requested_by_user_id === userId && app.tournament_status !== 'pending_approval' && app.tournament_status !== 'rejected';
    if (!isOrganizer){
        throw new AppError(403, "NOT_ORGANIZER", "คุณไม่ใช่ผู้จัดการแข่งขันของทัวร์นาเมนต์นี้");
    }
    if (app.tournament_application_status !== "pending"){
        throw new AppError(409, "ALREADY_DECIDED", "คำขอนี้ถูกพิจารณาไปแล้ว ยกเลิกไม่ได้");
    }
    await ApplicationRepo.rejectApplicationInDb(applicationId, reason);
    await ApplicationRepo.deletePlayersByApplication(applicationId);
    await NotificationService.notify({
        userId: app.team_leader_id, type: 'application_decided',
        title: 'ใบสมัครถูกปฏิเสธ',
        message: `ใบสมัครของทีม "${app.team_name}" ถูกปฏิเสธ — เหตุผล: ${reason}`,
        relatedEntityType: 'tournament', relatedEntityId: app.tournament_id,
    });
    return { id: applicationId, status:'rejected', reason }
}

export async function applyTournament(
    tournamentId: number,
    teamId: number,
    userId: number,
    playerIds: number[],
    softFilterDocuments: string[] = []
) {
    // 1. โหลดทีม + เช็คว่าเป็นหัวหน้าทีม + เช็คว่า Ready
    const team = await ApplicationRepo.findTeamForApply(teamId);
    if (!team) {
        throw new AppError(404, "TEAM_NOT_FOUND", "ไม่พบทีมนี้");
    }
    if (team.leader_id !== userId) {
        throw new AppError(403, "NOT_TEAM_LEADER", "คุณไม่ใช่หัวหน้าทีมนี้");
    }
    if (team.readiness_status !== 'Ready') {
        throw new AppError(409, "TEAM_NOT_READY", "ทีมต้องมีสถานะ Ready ก่อนสมัครเข้าร่วม");
    }

    // 2. โหลดทัวร์นาเมนต์ + เช็คว่าเปิดรับสมัคร
    const tournament = await TournamentRepo.findTournamentById(tournamentId);
    if (!tournament) {
        throw new AppError(404, "TOURNAMENT_NOT_FOUND", "ไม่พบทัวร์นาเมนต์นี้");
    }
    // Part2 P01: ต้อง "อยู่ในช่วงรับสมัคร" = ORG กดเปิด (C15) และเวลาปัจจุบันอยู่ใน [registration_start, registration_end]
    // แยกข้อความตามสาเหตุ — ธงยังไม่เคยเปิด ≠ ปิดแล้ว
    const now = new Date();
    if (!tournament.registration_open) {
        const ended = tournament.registration_end !== null && tournament.registration_end < now;
        throw new AppError(409, "REGISTRATION_CLOSED",
            ended ? "ทัวร์นาเมนต์นี้ปิดรับสมัครแล้ว" : "ทัวร์นาเมนต์นี้ยังไม่เปิดรับสมัคร");
    }
    if (tournament.registration_start !== null && now < tournament.registration_start) {
        throw new AppError(409, "REGISTRATION_CLOSED", "ยังไม่ถึงช่วงรับสมัคร",
            { registrationStart: tournament.registration_start, registrationEnd: tournament.registration_end });
    }
    if (tournament.registration_end !== null && now > tournament.registration_end) {
        throw new AppError(409, "REGISTRATION_CLOSED", "หมดช่วงรับสมัครแล้ว",
            { registrationStart: tournament.registration_start, registrationEnd: tournament.registration_end });
    }

    // 2.1 ทีมต้องเป็นกีฬาเดียวกับทัวร์ (ข้อ 6 รายงาน FE 18 ก.ย.) — ทีมวอลเลย์ลงทัวร์ฟุตบอลไม่ได้
    if (team.sport_type_id !== tournament.sport_type_id) {
        throw new AppError(409, "SPORT_TYPE_MISMATCH", "ทีมนี้เป็นกีฬาคนละประเภทกับทัวร์นาเมนต์",
            { teamSportTypeId: team.sport_type_id, tournamentSportTypeId: tournament.sport_type_id });
    }

    // 3. เช็คว่าเคยสมัครไปแล้วหรือยัง
    const existing = await ApplicationRepo.findExistingApplication(tournamentId, teamId);
    if (existing) {
        throw new AppError(409, "ALREADY_APPLIED", "ทีมนี้สมัครทัวร์นาเมนต์นี้ไปแล้ว");
    }

    const members = await ApplicationRepo.findTeamMembersForFilter(teamId);

    // 3.1 Conflict of interest (มติ 18 ก.ย. 2569): ORG หรือกรรมการของทัวร์นี้ มีชื่อในทีมไม่ได้ แม้ไม่ได้ลงแข่ง
    //     (F01 กันฝั่งเชิญกรรมการอยู่แล้ว — ตรงนี้กันการสมัคร "หลัง" ถูกเชิญเป็นกรรมการ)
    const memberIds = members.map(m => m.user_id);
    const conflicts: {
        userId: number; role: 'organizer' | 'referee';
        invitationStatus?: 'pending' | 'accepted'; expiresAt?: string | null;
    }[] = [];
    if (memberIds.includes(tournament.requested_by_user_id)) {
        conflicts.push({ userId: tournament.requested_by_user_id, role: 'organizer' });
    }
    /**
     * 🆕 BE-13 (7 ต.ค. 2569 · มติ ⑨ ง) — บอกให้ครบว่าติดเพราะอะไร และใครปลดล็อกได้
     *
     * เดิมข้อความคือ "สมาชิกในทีมเป็นผู้จัดหรือกรรมการของทัวร์นาเมนต์นี้ สมัครไม่ได้"
     * หัวหน้าทีมอ่านแล้วไม่รู้ว่า ① ใคร ② เพราะคำเชิญที่ยังไม่ได้ตอบ ③ ใครกดแก้ได้
     * ⇒ ทางออกมีอยู่สองทางตั้งแต่ต้น (ผู้ถูกเชิญกดปฏิเสธ · ผู้จัดยกเลิกคำเชิญ)
     *   แต่ทั้งสองคนไม่เคยเห็น 409 ใบนี้ · ข้อความจึงต้องเป็นตัวพาข้อมูลไปหาพวกเขา
     * ★ `invitationStatus` คือตัวที่ทำให้ FE แยกสองกรณีได้:
     *     pending  = ยังไม่ตอบ → บอกวันหมดอายุ และบอกว่าปฏิเสธ/ยกเลิกแล้วสมัครได้ทันที
     *     accepted = เป็นกรรมการจริง → เปลี่ยนรายชื่อผู้เล่น หรือเลิกเป็นกรรมการ
     */
    for (const ref of await ApplicationRepo.findRefereeConflictsAmongUsers(tournamentId, memberIds)) {
        conflicts.push({
            userId : ref.user_id, role : 'referee',
            invitationStatus : ref.invitation_status,
            expiresAt : ref.expires_at === null ? null : ref.expires_at.toISOString()
        });
    }
    if (conflicts.length > 0) {
        const waiting = conflicts.filter(c => c.invitationStatus === 'pending');
        const detail = waiting.length > 0
            ? ` — มี ${waiting.length} คนที่ได้รับคำเชิญเป็นกรรมการแต่ยังไม่ได้ตอบ`
              + ` ให้เขากดปฏิเสธคำเชิญ หรือให้ผู้จัดการแข่งขันยกเลิกคำเชิญ แล้วสมัครได้ทันที`
              + ` (คำเชิญจะหมดอายุเองใน ${REFEREE_INVITATION_DAYS} วัน)`
            : ` — ให้เปลี่ยนรายชื่อผู้เล่น หรือให้เขาเลิกเป็นกรรมการของทัวร์นาเมนต์นี้ก่อน`;
        throw new AppError(409, "TEAM_CONFLICT_OF_INTEREST",
            `สมาชิกในทีมเป็นผู้จัดหรือกรรมการของทัวร์นาเมนต์นี้ สมัครไม่ได้${detail}`, { conflicts });
    }
    // 4. รายชื่อผู้เล่นที่ลงแข่ง (มติ 19 ก.ย. 2569) — ทีม = คลังผู้เล่น, ใบสมัคร = รายชื่อที่ส่งลงแข่ง
    //    จำนวนต้องอยู่ใน [min_members, max_members] ของกีฬา · ส่งแล้วล็อก แก้ไม่ได้ · ทุกคนต้องเป็นสมาชิกทีมนี้จริง
    const sport = await SportTypeRepo.findSportTypeById(tournament.sport_type_id);
    if (!sport) {
        throw new AppError(409, "TOURNAMENT_CONFIGURATION_INVALID", "ทัวร์นาเมนต์นี้ยังไม่ได้กำหนดประเภทกีฬาที่ถูกต้อง");
    }
    if (playerIds.length < sport.min_members || playerIds.length > sport.max_members) {
        throw new AppError(422, "SQUAD_SIZE_INVALID",
            `กีฬานี้ต้องส่งผู้เล่น ${sport.min_members}–${sport.max_members} คน (ส่งมา ${playerIds.length} คน)`,
            { minMembers: sport.min_members, maxMembers: sport.max_members, submitted: playerIds.length });
    }

    const memberById = new Map(members.map(m => [m.user_id, m]));
    const notInTeam = playerIds.filter(id => !memberById.has(id));
    if (notInTeam.length > 0) {
        throw new AppError(422, "PLAYER_NOT_IN_TEAM", "มีผู้เล่นที่ไม่ได้อยู่ในทีมนี้", { userIds: notInTeam });
    }
    const squad = playerIds.map(id => memberById.get(id)!);

    // 5. Hard Filter — เช็คเฉพาะคนที่ลงแข่ง (เดิมเช็คทั้งทีม คนเดียวไม่ผ่านแล้วทั้งทีมสมัครไม่ได้)
    const rules = await ApplicationRepo.findEligibilityRules(tournamentId);
    const yearRules = rules.filter(r => r.rule_type === 'year').map(r => r.rule_value);
    const facultyRules = rules.filter(r => r.rule_type === 'faculty').map(r => r.rule_value);

    const failedMembers: HardFilterFail[] = [];

    if (tournament.registration_end === null) {
        throw new AppError(409, "TOURNAMENT_CONFIGURATION_INVALID", "ทัวร์นาเมนต์ยังไม่ได้กำหนดวันปิดรับสมัคร");
    }
    for (const member of squad) {
        // ★ เพศ/อายุ ใช้สูตรกลาง `genderAgeFailReason` ตัวเดียวกับที่ `approveAmendment` ใช้
        //   ตรวจย้อนหลัง (BE-36) ⇒ ทีมที่ผ่านตอนสมัครต้องไม่ถูกตีว่าไม่ผ่านตอนแก้กฎ
        const genderOrAge = genderAgeFailReason(member, {
            genderRequirement: tournament.gender_requirement,
            minAge: tournament.min_age,
            maxAge: tournament.max_age,
            asOf: tournament.registration_end
        });
        if (genderOrAge !== null) {
            failedMembers.push({ userId: member.user_id, fullName: member.full_name, reason: genderOrAge });
            continue;
        }

        if (yearRules.length > 0 && (member.year === null || !yearRules.includes(member.year))) {
            failedMembers.push({ userId: member.user_id, fullName: member.full_name, reason: 'year' });
            continue;
        }

        if (facultyRules.length > 0 && (member.faculty_id === null || !facultyRules.includes(member.faculty_id))) {
            failedMembers.push({ userId: member.user_id, fullName: member.full_name, reason: 'faculty' });
            continue;
        }
    }

    if (failedMembers.length > 0) {
        throw new AppError(422, "HARD_FILTER_FAILED", "ผู้เล่นบางคนไม่ผ่านเงื่อนไขการสมัคร", { details: failedMembers });
    }

    // 6. Soft Filter documents — key ต้องถูกสร้างจาก presign ของ user คนนี้สำหรับทัวร์นี้ และ object ต้องอัปโหลดสำเร็จแล้ว
    if (softFilterDocuments.length > 0) {
        await UploadService.validateSoftFilterDocuments(softFilterDocuments, tournamentId, userId);
    }

    // 7. บันทึกใบสมัคร + รายชื่อผู้เล่น + document keys ในทรานแซกชันเดียว (ต้องเกิดพร้อมกันหรือไม่เกิดเลย)
    //    hard_filter_details ต้องเป็น array รายคน ไม่ใช่ object สรุป — P04 ดึงไปโชว์ตรงๆ
    const hardFilterDetails = squad.map(m => ({ userId: m.user_id, fullName: m.full_name, passed: true }));
    const inserted = await ApplicationRepo.insertApplicationWithPlayers(
        tournamentId,
        teamId,
        hardFilterDetails,
        playerIds,
        softFilterDocuments
    );

    /**
     * ด่านที่ฐาน — มีไว้เผื่อสองคำขอมาพร้อมกันจนด่าน SELECT ข้างบนผ่านทั้งคู่
     * 🔴 ต้องแยกสองเรื่องนี้ออกจากกัน (มติ ① ก) — เดิมตอบ PLAYER_ALREADY_REGISTERED ทั้งคู่
     *   ⇒ ทีมที่กดสมัครซ้ำได้ข้อความกล่าวหาผู้เล่น ซึ่งพาไปแก้ผิดทาง
     */
    if (inserted.decision === 'team_already_active') {
        // รหัสเดียวกับด่าน SELECT ข้างบนโดยเจตนา — เรื่องเดียวกัน คนละจังหวะ FE จัดการที่เดียว
        throw new AppError(409, "ALREADY_APPLIED", "ทีมนี้สมัครทัวร์นาเมนต์นี้ไปแล้ว");
    }
    if (inserted.decision === 'player_taken') {
        const taken = await ApplicationRepo.findPlayerConflicts(tournamentId, playerIds);
        throw new AppError(409, "PLAYER_ALREADY_REGISTERED",
            "มีผู้เล่นที่ถูกส่งลงแข่งทัวร์นาเมนต์นี้กับทีมอื่นไปแล้ว",
            { players: taken.map(p => ({ userId: p.user_id, fullName: p.full_name, teamId: p.team_id, teamName: p.team_name })) });
    }

    return { id: inserted.id, status: 'pending', hardFilterPassed: true, playerIds };
}
