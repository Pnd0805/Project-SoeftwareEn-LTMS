import * as z from 'zod';
import * as AdminScopeRepo from '../repositories/adminScope.repo.js';
import * as ApplicationRepo from '../repositories/application.repo.js';
import * as DepartmentRepo from '../repositories/department.repo.js';
import * as FacultyRepo from '../repositories/faculty.repo.js';
import * as SportTypeRepo from '../repositories/sportType.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import type { EligibilityRule } from '../repositories/tournament.repo.js';
import { eligibilityRulesSchema } from '../schemas/tournament.schema.js';
import * as UserRepo from '../repositories/user.repo.js';
import { toTournamentDetailDto, toTournamentListDto } from '../mappers/tournament.mapper.js';
import { toUserRef } from '../mappers/user.mapper.js';
import { buildPagination } from '../utils/pagination.js';
import { AppError } from '../utils/AppError.js';
import type { AdminScopeRow, TournamentRow } from '../types/db.js';
import type { AmendmentRequestInput, CreateTournamentInput, UpdateTournamentInput, EligibilityRuleInput, SetEligibilityRulesInput } from '../schemas/tournament.schema.js';
import { refereesNeededPerMatch } from './referee.service.js';
import * as MatchRepo from '../repositories/match.repo.js';
import * as MatchResultService from './matchResult.service.js';
import { isRequesterOf } from '../middlewares/requireOrganizer.js';
import * as NotificationService from './notification.service.js';

const amendmentFieldSchema = z.object({
    registrationStart: z.iso.datetime({ offset: true }).optional(),
    registrationEnd: z.iso.datetime({ offset: true }).optional(),
    eventStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    eventEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    minTeams: z.int().min(2).optional(),
    maxTeams: z.int().min(2).optional(),
    genderRequirement: z.enum(['any', 'male', 'female']).optional(),
    minAge: z.int().min(0).max(120).nullable().optional(),
    maxAge: z.int().min(0).max(120).nullable().optional(),
    eligibilityRules: eligibilityRulesSchema.optional()
}).catchall(z.unknown());

const allowedAmendmentFields = new Set([
    'registrationStart', 'registrationEnd', 'eventStartDate', 'eventEndDate',
    'minTeams', 'maxTeams', 'genderRequirement', 'minAge', 'maxAge', 'eligibilityRules'
]);

/**
 * กฎคุณสมบัติ (มติ 20 ก.ย. 2569 Q1-ค) — ตรวจแล้วคืนชุดที่สะอาด: คณะต้องมีจริง · ชั้นปี 1–8 · ตัดซ้ำ
 */
export async function normalizeEligibilityRules(rules: EligibilityRuleInput[] | undefined): Promise<EligibilityRule[]> {
    if (!rules || rules.length === 0) return [];
    const seen = new Set<string>();
    const out: EligibilityRule[] = [];
    for (const rule of rules) {
        const key = `${rule.type}:${rule.value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (rule.type === 'year' && rule.value > 8) {
            validationError('ชั้นปีต้องอยู่ระหว่าง 1–8', { eligibilityRules: `ชั้นปี ${rule.value} ไม่ถูกต้อง` });
        }
        if (rule.type === 'faculty' && !(await FacultyRepo.findFacultyById(rule.value))) {
            validationError('ไม่พบคณะในกฎคุณสมบัติ', { eligibilityRules: `ไม่พบคณะ ${rule.value}` });
        }
        out.push({ type: rule.type, value: rule.value });
    }
    return out;
}

/**
 * มติ 20 ก.ย. 2569 Q2-ข: แอดมินคณะ "รับผิดชอบ" ทัวร์ก็ต่อเมื่อคณะตัวเองเป็นผู้จัด **และ** กฎคณะจำกัดเฉพาะคณะตัวเอง
 * ทัวร์ที่เปิดรับคณะอื่น/ไม่จำกัดคณะ → ต้องเป็น university_wide · ใช้ทั้ง auto-approve (C01), C04 approve, C11 approve amendment
 */
export function adminCoversEligibility(admin: AdminScopeRow, organizingFacultyId: number | null, rules: EligibilityRule[]): boolean {
    if (admin.scope_type === 'university_wide') return true;
    if (admin.scope_type !== 'faculty' || admin.faculty_id === null || admin.faculty_id !== organizingFacultyId) return false;
    const facultyRules = rules.filter(r => r.type === 'faculty');
    return facultyRules.length > 0 && facultyRules.every(r => r.value === admin.faculty_id);
}

function eligibilityOutOfScope(): never {
    throw new AppError(403, 'ELIGIBILITY_OUT_OF_SCOPE',
        'ทัวร์นาเมนต์นี้เปิดรับนอกคณะของคุณ (หรือไม่จำกัดคณะ) ต้องให้แอดมินระดับมหาวิทยาลัยพิจารณา');
}

async function currentRules(tournamentId: number): Promise<EligibilityRule[]> {
    return (await ApplicationRepo.findEligibilityRules(tournamentId)).map(r => ({ type: r.rule_type, value: r.rule_value }));
}

type AmendmentChanges = Record<string, unknown>;

function validationError(message: string, fields?: Record<string, string>): never {
    throw new AppError(400, 'VALIDATION_FAILED', message, fields === undefined ? undefined : { fields });
}

function dateMilliseconds(value: Date | string | null): number | null {
    if (value === null) return null;
    const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
}

function ensureSchedule(values: {
    registrationStart: Date | string | null;
    registrationEnd: Date | string | null;
    eventStartDate: Date | string;
    eventEndDate: Date | string | null;
    minTeams: number;
    maxTeams: number;
}): void {
    const registrationStart = dateMilliseconds(values.registrationStart);
    const registrationEnd = dateMilliseconds(values.registrationEnd);
    const eventStart = dateMilliseconds(values.eventStartDate);
    const eventEnd = dateMilliseconds(values.eventEndDate);

    if (registrationStart === null || registrationEnd === null || eventStart === null || eventEnd === null) {
        throw new AppError(400, 'INVALID_DATE_RANGE', 'ช่วงวันเวลาไม่ถูกต้อง', { fields: { eventStartDate: 'วันเวลาไม่ถูกต้อง' } });
    }
    if (registrationStart >= registrationEnd) {
        throw new AppError(400, 'INVALID_DATE_RANGE', 'ช่วงเวลารับสมัครไม่ถูกต้อง', { fields: { registrationEnd: 'ต้องอยู่หลัง registrationStart' } });
    }
    if (registrationEnd >= eventStart) {
        throw new AppError(400, 'INVALID_DATE_RANGE', 'วันแข่งขันต้องอยู่หลังวันปิดรับสมัคร', { fields: { eventStartDate: 'ต้องอยู่หลัง registrationEnd' } });
    }
    if (eventStart > eventEnd) {
        throw new AppError(400, 'INVALID_DATE_RANGE', 'ช่วงวันแข่งขันไม่ถูกต้อง', { fields: { eventEndDate: 'ต้องไม่อยู่ก่อน eventStartDate' } });
    }
    if (values.minTeams > values.maxTeams) {
        validationError('จำนวนทีมขั้นต่ำต้องไม่มากกว่าจำนวนทีมสูงสุด', { minTeams: 'ต้องไม่มากกว่า maxTeams' });
    }
}

function ensureAges(minAge: number | null | undefined, maxAge: number | null | undefined): void {
    if (minAge !== null && minAge !== undefined && maxAge !== null && maxAge !== undefined && minAge > maxAge) {
        validationError('อายุขั้นต่ำต้องไม่มากกว่าอายุสูงสุด', { minAge: 'ต้องไม่มากกว่า maxAge' });
    }
}

async function ensureCreateReferences(input: CreateTournamentInput): Promise<void> {
    const sport = await SportTypeRepo.findSportTypeById(input.sportTypeId);
    if (!sport) validationError('ไม่พบชนิดกีฬา', { sportTypeId: 'ไม่พบชนิดกีฬานี้' });

    if (input.scopeType === 'faculty') {
        if (input.organizingFacultyId === undefined || input.organizingFacultyId === null) {
            validationError('ต้องระบุคณะที่จัดการแข่งขัน', { organizingFacultyId: 'จำเป็นสำหรับ scopeType=faculty' });
        }
        if (input.organizingDepartmentId !== undefined && input.organizingDepartmentId !== null) {
            validationError('faculty scope ต้องไม่ระบุภาควิชา', { organizingDepartmentId: 'ต้องเป็น null หรือไม่ส่งมา' });
        }
        const faculty = await FacultyRepo.findFacultyById(input.organizingFacultyId);
        if (!faculty) validationError('ไม่พบคณะที่จัดการแข่งขัน', { organizingFacultyId: 'ไม่พบคณะนี้' });
        return;
    }

    if (input.organizingFacultyId === undefined || input.organizingFacultyId === null) {
        validationError('ต้องระบุคณะที่จัดการแข่งขัน', { organizingFacultyId: 'จำเป็นสำหรับ scopeType=department' });
    }
    if (input.organizingDepartmentId === undefined || input.organizingDepartmentId === null) {
        validationError('ต้องระบุภาควิชาที่จัดการแข่งขัน', { organizingDepartmentId: 'จำเป็นสำหรับ scopeType=department' });
    }
    const department = await DepartmentRepo.findDepartmentInFaculty(input.organizingFacultyId, input.organizingDepartmentId);
    if (!department) {
        validationError('ภาควิชาไม่อยู่ในคณะที่ระบุ', { organizingDepartmentId: 'ภาควิชาต้องอยู่ใน organizingFacultyId เดียวกัน' });
    }
}

function canManageTournament(admin: AdminScopeRow, tournament: TournamentRow): boolean {
    return admin.scope_type === 'university_wide' ||
        (admin.scope_type === 'faculty' && admin.faculty_id !== null && admin.faculty_id === tournament.organizing_faculty_id);
}

async function getTournamentAdmin(userId: number, tournament: TournamentRow): Promise<AdminScopeRow> {
    const admin = await AdminScopeRepo.findAdminByUserId(userId);
    if (!admin || !canManageTournament(admin, tournament)) {
        throw new AppError(403, 'INSUFFICIENT_ADMIN_SCOPE', 'คุณไม่มีสิทธิ์จัดการทัวร์นาเมนต์นี้');
    }
    return admin;
}

async function getTournamentOr404(tournamentId: number): Promise<TournamentRow> {
    const tournament = await TournamentRepo.findTournamentById(tournamentId);
    if (!tournament) throw new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้');
    return tournament;
}

async function getVisibleTournament(tournamentId: number, userId?: number): Promise<TournamentRow> {
    const tournament = await getTournamentOr404(tournamentId);
    // completed = ผลย้อนหลังเป็นสาธารณะเหมือน public (B1 3-ก, 21 ก.ย.)
    if (tournament.tournament_status === 'public' || tournament.tournament_status === 'completed') return tournament;

    // ผู้ยื่นคำขอเห็นทัวร์ของตัวเองทุกสถานะ (รวม pending_approval/rejected/completed) ยกเว้นถูกลบอัตโนมัติ — FE-c17b 20 ก.ย.
    if (userId !== undefined && isRequesterOf(tournament, userId)) {
        return tournament;
    }

    if (userId !== undefined) {
        const admin = await AdminScopeRepo.findAdminByUserId(userId);
        if (admin && canManageTournament(admin, tournament)) return tournament;
    }

    throw new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้');
}

async function getDetail(tournament: TournamentRow): Promise<ReturnType<typeof toTournamentDetailDto>> {
    const organizer = await TournamentRepo.findTournamentOrganizer(tournament.tournament_id);
    if (!organizer) throw new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้');
    const approvedTeamCount = await TournamentRepo.countApprovedTeams(tournament.tournament_id);
    return toTournamentDetailDto(tournament, toUserRef(organizer), approvedTeamCount);
}

/** ข้อ 9 (รายงาน FE 18 ก.ย.): สร้างใหม่ต้องไม่ใช่อดีต — ปิดรับสมัครยังไม่ผ่าน และวันแข่งไม่ก่อนวันนี้ (เวลาไทย) · ไม่ใช้กับ amendment */
function ensureNotInPast(input: CreateTournamentInput): void {
    const now = Date.now();
    const todayThai = new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 10);
    if (new Date(input.registrationEnd).getTime() <= now) {
        throw new AppError(400, 'TOURNAMENT_DATES_IN_PAST', 'วันปิดรับสมัครต้องอยู่ในอนาคต', { fields: { registrationEnd: 'ผ่านไปแล้ว' } });
    }
    if (input.eventStartDate < todayThai) {
        throw new AppError(400, 'TOURNAMENT_DATES_IN_PAST', 'วันแข่งขันต้องไม่ก่อนวันนี้', { fields: { eventStartDate: 'ผ่านไปแล้ว' } });
    }
}

/**
 * ข้อ 8 (มติ 18 ก.ย. 2569): admin สร้างทัวร์ในขอบเขตตัวเองได้เลยไม่ต้องรออนุมัติ
 *   university_wide → ทุกทัวร์ · faculty admin → ทัวร์ที่ organizing_faculty_id = คณะตัวเอง (scope department/faculty ของคณะนั้น)
 *   นอกขอบเขต (หรือไม่ใช่ admin) → pending_approval ตามเดิม
 */
async function autoApproveIfOwnScope(tournamentId: number, userId: number, organizingFacultyId: number, rules: EligibilityRule[]): Promise<boolean> {
    const admin = await AdminScopeRepo.findAdminByUserId(userId);
    if (!admin) return false;
    if (!adminCoversEligibility(admin, organizingFacultyId, rules)) return false;   // Q2-ข
    return TournamentRepo.approveTournament(tournamentId, userId);
}

export async function createTournament(input: CreateTournamentInput, userId: number) {
    ensureSchedule(input);
    ensureNotInPast(input);
    ensureAges(input.minAge, input.maxAge);
    await ensureCreateReferences(input);
    const eligibilityRules = await normalizeEligibilityRules(input.eligibilityRules);

    const id = await TournamentRepo.insertTournament({
        name: input.name,
        sportTypeId: input.sportTypeId,
        bracketFormat: input.bracketFormat,
        scopeType: input.scopeType,
        organizingFacultyId: input.organizingFacultyId as number,
        organizingDepartmentId: input.organizingDepartmentId ?? null,
        requestedByUserId: userId,
        registrationStart: input.registrationStart,
        registrationEnd: input.registrationEnd,
        eventStartDate: input.eventStartDate,
        eventEndDate: input.eventEndDate,
        maxTeams: input.maxTeams,
        minTeams: input.minTeams,
        venue: input.venue,
        entryNotes: input.entryNotes ?? null,
        genderRequirement: input.genderRequirement,
        minAge: input.minAge ?? null,
        maxAge: input.maxAge ?? null,
        eligibilityRules
    });

    const autoApproved = await autoApproveIfOwnScope(id, userId, input.organizingFacultyId as number, eligibilityRules);
    return { id, status: autoApproved ? 'private' as const : 'pending_approval' as const, name: input.name, autoApproved };
}

export async function getMyTournamentRequests(userId: number, offset: number, page: number, pageSize: number) {
    const { rows, totalItems } = await TournamentRepo.findMyTournamentRequests(userId, offset, pageSize);
    return {
        items: rows.map(row => ({
            id: row.tournament_id,
            name: row.name,
            status: row.tournament_status,
            rejectionReason: row.rejection_reason,
            createdAt: row.created_at.toISOString()
        })),
        pagination: buildPagination(page, pageSize, totalItems)
    };
}

export async function getPendingTournamentRequests(userId: number, offset: number, page: number, pageSize: number) {
    const admin = await AdminScopeRepo.findAdminByUserId(userId);
    if (!admin) throw new AppError(403, 'INSUFFICIENT_ADMIN_SCOPE', 'คุณไม่มีสิทธิ์ดูคิวคำขอทัวร์นาเมนต์');
    const { rows, totalItems } = await TournamentRepo.findPendingTournamentRequests(admin, offset, pageSize);
    return {
        items: rows.map(row => ({
            id: row.tournament_id,
            name: row.name,
            requestedBy: toUserRef(row),
            sportTypeId: row.sport_type_id,
            eventStartDate: row.event_start_date,
            createdAt: row.created_at.toISOString()
        })),
        pagination: buildPagination(page, pageSize, totalItems)
    };
}

export async function approveTournament(tournamentId: number, userId: number) {
    const tournament = await getTournamentOr404(tournamentId);
    const admin = await getTournamentAdmin(userId, tournament);
    if (!adminCoversEligibility(admin, tournament.organizing_faculty_id, await currentRules(tournamentId))) eligibilityOutOfScope();
    if (tournament.tournament_status !== 'pending_approval') {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'ทัวร์นาเมนต์นี้ไม่ได้อยู่ในสถานะรออนุมัติ');
    }
    if (!await TournamentRepo.approveTournament(tournamentId, userId)) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'สถานะทัวร์นาเมนต์เปลี่ยนไปแล้ว');
    }
    await NotificationService.notify({
        userId: tournament.requested_by_user_id, type: 'tournament_decided',
        title: 'คำขอจัดทัวร์นาเมนต์ได้รับการอนุมัติ',
        message: `ทัวร์นาเมนต์ "${tournament.name}" ได้รับการอนุมัติแล้ว — ตั้งค่าและเปิดเผยแพร่ได้เลย`,
        relatedEntityType: 'tournament', relatedEntityId: tournamentId,
    });
    return { id: tournamentId, status: 'private' as const, organizerId: tournament.requested_by_user_id };
}

export async function rejectTournament(tournamentId: number, userId: number, reason: string) {
    const tournament = await getTournamentOr404(tournamentId);
    await getTournamentAdmin(userId, tournament);
    if (tournament.tournament_status !== 'pending_approval') {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'ทัวร์นาเมนต์นี้ไม่ได้อยู่ในสถานะรออนุมัติ');
    }
    if (!await TournamentRepo.rejectTournament(tournamentId, userId, reason)) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'สถานะทัวร์นาเมนต์เปลี่ยนไปแล้ว');
    }
    await NotificationService.notify({
        userId: tournament.requested_by_user_id, type: 'tournament_decided',
        title: 'คำขอจัดทัวร์นาเมนต์ถูกปฏิเสธ',
        message: `ทัวร์นาเมนต์ "${tournament.name}" ไม่ได้รับการอนุมัติ — เหตุผล: ${reason}`,
        relatedEntityType: 'tournament', relatedEntityId: tournamentId,
    });
    return { id: tournamentId, status: 'rejected' as const, reason };
}

const tournamentStatuses = new Set(['pending_approval', 'rejected', 'private', 'public', 'completed', 'auto_deleted']);

/** GET /me/tournaments — การ์ดเต็มของทัวร์ที่ฉันจัด ทุกสถานะ (+ status, rejectionReason) */
export async function getMyTournaments(userId: number, status: string | undefined, offset: number, page: number, pageSize: number) {
    if (status !== undefined && !tournamentStatuses.has(status)) validationError('status ไม่ถูกต้อง', { status: 'ค่าที่ไม่รู้จัก' });
    const { rows, totalItems } = await TournamentRepo.findTournamentsByOrganizer(userId, status as TournamentRow['tournament_status'] | undefined, offset, pageSize);
    return {
        items: rows.map(row => ({ ...toTournamentListDto(row), status: row.tournament_status, rejectionReason: row.rejection_reason, createdAt: row.created_at })),
        pagination: buildPagination(page, pageSize, totalItems)
    };
}

export async function getPublicTournaments(filters: TournamentRepo.PublicTournamentFilters, offset: number, page: number, pageSize: number) {
    const { rows, totalItems } = await TournamentRepo.findPublicTournaments(filters, offset, pageSize);
    return {
        items: rows.map(toTournamentListDto),
        pagination: buildPagination(page, pageSize, totalItems)
    };
}

export async function getTournament(tournamentId: number, userId?: number) {
    return getDetail(await getVisibleTournament(tournamentId, userId));
}

export async function updateTournament(tournamentId: number, userId: number, input: UpdateTournamentInput) {
    await TournamentRepo.updateTournamentGeneral(tournamentId, userId, input);
    return getDetail(await getTournamentOr404(tournamentId));
}

function normalizeChanges(value: unknown): AmendmentChanges {
    if (typeof value === 'string') {
        try {
            const parsed: unknown = JSON.parse(value);
            if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as AmendmentChanges;
        } catch {
            // fall through to the same validation error
        }
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value as AmendmentChanges;
    throw new AppError(400, 'VALIDATION_FAILED', 'ข้อมูล requestedChanges ไม่ถูกต้อง');
}

function validateAmendmentChanges(value: unknown): AmendmentChanges {
    const changes = normalizeChanges(value);
    const unknownFields = Object.keys(changes).filter(key => !allowedAmendmentFields.has(key));
    if (unknownFields.length > 0) {
        throw new AppError(400, 'AMENDMENT_FIELD_NOT_ALLOWED', 'ฟิลด์นี้ต้องแก้ผ่านการขออนุมัติรูปแบบที่รองรับ', { fields: unknownFields });
    }
    const parsed = amendmentFieldSchema.safeParse(changes);
    if (!parsed.success) validationError('ข้อมูล amendment ไม่ถูกต้อง');
    return changes;
}

function amendmentValue<T>(changes: AmendmentChanges, key: string, fallback: T): T {
    return Object.prototype.hasOwnProperty.call(changes, key) ? changes[key] as T : fallback;
}

function validateAmendmentAgainstTournament(tournament: TournamentRow, changes: AmendmentChanges): void {
    ensureSchedule({
        registrationStart: amendmentValue(changes, 'registrationStart', tournament.registration_start),
        registrationEnd: amendmentValue(changes, 'registrationEnd', tournament.registration_end),
        eventStartDate: amendmentValue(changes, 'eventStartDate', tournament.event_start_date),
        eventEndDate: amendmentValue(changes, 'eventEndDate', tournament.event_end_date),
        minTeams: amendmentValue(changes, 'minTeams', tournament.min_teams),
        maxTeams: amendmentValue(changes, 'maxTeams', tournament.max_teams)
    });
    ensureAges(
        amendmentValue(changes, 'minAge', tournament.min_age),
        amendmentValue(changes, 'maxAge', tournament.max_age)
    );
}

async function ensureEligibilityEditable(tournament: TournamentRow): Promise<void> {
    if (tournament.registration_open || await TournamentRepo.hasLiveApplications(tournament.tournament_id)) {
        throw new AppError(409, 'ELIGIBILITY_LOCKED',
            'แก้กฎคุณสมบัติไม่ได้แล้ว — เปิดรับสมัครหรือมีทีมสมัครแล้ว (ทีมที่ผ่านตัวกรองไปแล้วจะผิดกฎย้อนหลัง)');
    }
}

/** PUT /tournaments/:id/eligibility-rules — แก้ตรงได้เฉพาะระหว่างรออนุมัติ · ผ่านอนุมัติแล้วต้องไป C09 amendment */
export async function setEligibilityRules(tournament: TournamentRow, userId: number, input: SetEligibilityRulesInput) {
    if (tournament.tournament_status !== 'pending_approval') {
        throw new AppError(409, 'USE_AMENDMENT_REQUEST',
            'ทัวร์นาเมนต์ผ่านการพิจารณาแล้ว การแก้กฎคุณสมบัติต้องยื่นคำขอแก้ไข (amendment) ให้แอดมินอนุมัติ');
    }
    await ensureEligibilityEditable(tournament);
    const rules = await normalizeEligibilityRules(input.rules);
    await TournamentRepo.replaceEligibilityRules(tournament.tournament_id, userId, rules);
    return { items: rules.map(r => ({ ruleType: r.type, ruleValue: r.value })) };
}

export async function requestAmendment(tournamentId: number, userId: number, input: AmendmentRequestInput) {
    const tournament = await getTournamentOr404(tournamentId);
    const changes = validateAmendmentChanges(input.requestedChanges);
    validateAmendmentAgainstTournament(tournament, changes);
    if (Object.prototype.hasOwnProperty.call(changes, 'eligibilityRules')) {
        await ensureEligibilityEditable(tournament);
        changes['eligibilityRules'] = await normalizeEligibilityRules(changes['eligibilityRules'] as EligibilityRuleInput[]);
    }
    const id = await TournamentRepo.insertAmendmentRequest(tournamentId, userId, changes, input.reason);
    return { id, status: 'pending' as const };
}

/** C09b — GET /tournaments/:id/amendment-requests (ผู้ยื่นคำขอ) — ทุกสถานะ เห็น reason ของตัวเองและ rejectionReason ของแอดมิน */
export async function getTournamentAmendments(tournamentId: number) {
    const rows = await TournamentRepo.findAmendmentsByTournament(tournamentId);
    return {
        items: rows.map(row => ({
            id: row.tournament_amendment_request_id,
            requestedChanges: normalizeChanges(row.requested_changes),
            reason: row.request_reason,
            status: row.tournament_amendment_request_status,
            requestedAt: row.requested_at.toISOString(),
            reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
            reviewedBy: row.reviewed_by === null ? null : { id: row.reviewed_by, name: row.reviewer_name },
            rejectionReason: row.rejection_reason
        }))
    };
}

export async function getPendingAmendments(userId: number, offset: number, page: number, pageSize: number) {
    const admin = await AdminScopeRepo.findAdminByUserId(userId);
    if (!admin) throw new AppError(403, 'INSUFFICIENT_ADMIN_SCOPE', 'คุณไม่มีสิทธิ์ดูคิว amendment');
    const { rows, totalItems } = await TournamentRepo.findPendingAmendments(admin, offset, pageSize);
    return {
        items: rows.map(row => ({
            id: row.tournament_amendment_request_id,
            tournamentId: row.tournament_id,
            tournamentName: row.tournament_name,
            requestedBy: toUserRef(row),
            requestedChanges: normalizeChanges(row.requested_changes),
            reason: row.request_reason,
            status: row.tournament_amendment_request_status,
            requestedAt: row.requested_at.toISOString()
        })),
        pagination: buildPagination(page, pageSize, totalItems)
    };
}

async function getAmendmentForAdmin(amendmentId: number, userId: number) {
    const amendment = await TournamentRepo.findAmendmentById(amendmentId);
    if (!amendment) throw new AppError(404, 'AMENDMENT_NOT_FOUND', 'ไม่พบคำขอแก้ไขทัวร์นาเมนต์นี้');
    const tournament = await getTournamentOr404(amendment.tournament_id);
    const admin = await getTournamentAdmin(userId, tournament);
    return { amendment, tournament, admin };
}

export async function approveAmendment(amendmentId: number, userId: number) {
    const { amendment, tournament, admin } = await getAmendmentForAdmin(amendmentId, userId);
    const changes = validateAmendmentChanges(amendment.requested_changes);
    validateAmendmentAgainstTournament(tournament, changes);
    if (Object.prototype.hasOwnProperty.call(changes, 'eligibilityRules')) {
        await ensureEligibilityEditable(tournament);
        if (!adminCoversEligibility(admin, tournament.organizing_faculty_id, changes['eligibilityRules'] as EligibilityRule[])) eligibilityOutOfScope();
    } else if (!adminCoversEligibility(admin, tournament.organizing_faculty_id, await currentRules(tournament.tournament_id))) {
        eligibilityOutOfScope();
    }
    const result = await TournamentRepo.approveAmendment(amendmentId, userId, changes);
    if (result === 'not_found') throw new AppError(404, 'AMENDMENT_NOT_FOUND', 'ไม่พบคำขอแก้ไขทัวร์นาเมนต์นี้');
    if (result === 'already_decided') throw new AppError(409, 'ALREADY_DECIDED', 'คำขอนี้ถูกพิจารณาไปแล้ว');
    if (result === 'capacity_conflict') throw new AppError(409, 'TEAM_CAPACITY_CONFLICT', 'จำนวนทีมสูงสุดใหม่น้อยกว่าจำนวนทีมที่อนุมัติแล้ว');
    return { id: amendmentId, status: 'approved' as const };
}

export async function rejectAmendment(amendmentId: number, userId: number, reason: string) {
    await getAmendmentForAdmin(amendmentId, userId);
    const result = await TournamentRepo.rejectAmendment(amendmentId, userId, reason);
    if (result === 'not_found') throw new AppError(404, 'AMENDMENT_NOT_FOUND', 'ไม่พบคำขอแก้ไขทัวร์นาเมนต์นี้');
    if (result === 'already_decided') throw new AppError(409, 'ALREADY_DECIDED', 'คำขอนี้ถูกพิจารณาไปแล้ว');
    return { id: amendmentId, status: 'rejected' as const, reason };
}

export async function publishTournament(tournament: TournamentRow, userId: number) {
    // ด่าน 1 ของ BR-10 (GUIDE/11 §10.2): pool ต้องมีกรรมการ active อย่างน้อยเท่ากับที่ 1 แมตช์ต้องใช้
    // (ตอน publish ยังไม่มีแมตช์ → ใช้ default_mode ของกีฬาแทน mode รายแมตช์) · ด่าน 2 เช็คตอน M10 start ทีละแมตช์
    const sport = await SportTypeRepo.findSportTypeById(tournament.sport_type_id);
    const refereesRequired = (await refereesNeededPerMatch(tournament.sport_type_id))(sport?.default_mode ?? 'onsite');

    const result = await TournamentRepo.publishTournament(tournament.tournament_id, userId, refereesRequired);
    if (result.status === 'referees_incomplete') {
        const refereesAccepted = result.refereesAccepted;
        throw new AppError(409, 'REFEREES_INCOMPLETE',
            `ต้องมีกรรมการที่พร้อมใช้งานอย่างน้อย ${refereesRequired} คนก่อนเปิดเผยแพร่`, { refereesAccepted, refereesRequired });
    }
    if (result.status !== 'ok') {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'สถานะทัวร์นาเมนต์เปลี่ยนไปแล้ว');
    }
    await NotificationService.notifyTournamentReferees(tournament.tournament_id, {
        type: 'tournament_published',
        title: 'ทัวร์นาเมนต์เปิดเผยแพร่แล้ว',
        message: `ทัวร์นาเมนต์ "${tournament.name}" ที่คุณเป็นกรรมการ เปิดเผยแพร่แล้ว`,
        relatedEntityType: 'tournament', relatedEntityId: tournament.tournament_id,
    });
    return { id: tournament.tournament_id, status: 'public' as const };
}

/**
 * B1 — POST /tournaments/:id/complete (มติ 21 ก.ย. 1-ข: ORG กดปิดเอง)
 *   ต้องมีแมตช์และทุกแมตช์ completed (ไม่มี scheduled/disputed/result_rejected ค้าง)
 *   แชมป์: elimination = ผู้ชนะแมตช์ที่ไม่มี next_match_id · round_robin = อันดับ 1 ของตาราง (เสมออันดับ 1 → ไม่มีแชมป์)
 *   รอบชิงแพ้ทั้งคู่ → ปิดได้ แชมป์ null ไม่บวก championships (4-ก)
 */
export async function completeTournament(tournament: TournamentRow, userId: number) {
    if (tournament.tournament_status === 'completed') {
        throw new AppError(409, 'TOURNAMENT_COMPLETED', 'ทัวร์นาเมนต์นี้ปิดการแข่งขันไปแล้ว');
    }
    if (tournament.tournament_status !== 'public' && tournament.tournament_status !== 'private') {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'ปิดได้เฉพาะทัวร์ที่ผ่านการอนุมัติแล้ว');
    }
    const unfinished = await TournamentRepo.findUnfinishedMatchIds(tournament.tournament_id);
    if (unfinished.length > 0) {
        throw new AppError(409, 'MATCHES_UNFINISHED', `ยังมีแมตช์ที่ไม่จบ ${unfinished.length} แมตช์ ปิดทัวร์ไม่ได้`,
            { matches: unfinished.map(m => ({ id: m.match_id, status: m.match_status })) });
    }
    if (await MatchRepo.countMatchesByTournament(tournament.tournament_id) === 0) {
        throw new AppError(409, 'NO_MATCHES', 'ทัวร์นี้ยังไม่ได้สร้างสาย/ตารางแข่ง ปิดไม่ได้');
    }

    const championTeamId = await MatchResultService.resolveChampionTeamId(tournament);
    if (!(await TournamentRepo.completeTournament(tournament.tournament_id, userId, championTeamId, tournament.sport_type_id))) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'สถานะทัวร์นาเมนต์เปลี่ยนไปแล้ว');
    }
    return { id: tournament.tournament_id, status: 'completed' as const, championTeamId };
}


export async function deleteTournament(tournament: TournamentRow, userId: number) {
    if (tournament.tournament_status === 'public') {
        throw new AppError(409, 'TOURNAMENT_MUST_BE_UNPUBLISHED', 'ต้อง unpublish ทัวร์นาเมนต์ก่อนลบ');
    }
    if (tournament.tournament_status === 'completed') {
        throw new AppError(409, 'TOURNAMENT_COMPLETED', 'ทัวร์นาเมนต์ที่ปิดการแข่งขันแล้วลบไม่ได้');
    }
    if (!['pending_approval', 'rejected', 'private'].includes(tournament.tournament_status)) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'สถานะทัวร์นาเมนต์นี้ไม่สามารถลบได้');
    }

    const [applicationCount, matchCount] = await Promise.all([
        TournamentRepo.countApplicationsByTournament(tournament.tournament_id),
        MatchRepo.countMatchesByTournament(tournament.tournament_id)
    ]);
    if (applicationCount > 0 || matchCount > 0) {
        throw new AppError(
            409,
            'TOURNAMENT_HAS_ACTIVITY',
            'ลบทัวร์นาเมนต์ไม่ได้เพราะมีใบสมัครหรือแมตช์แล้ว',
            { applications: applicationCount, matches: matchCount }
        );
    }

    if (!await TournamentRepo.softDeleteTournament(tournament.tournament_id, userId)) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'สถานะทัวร์นาเมนต์เปลี่ยนไปแล้ว กรุณาลองใหม่');
    }
}

export async function unpublishTournament(tournament: TournamentRow, userId: number) {
    if (tournament.tournament_status !== 'public') {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'ต้อง unpublish จากสถานะ public เท่านั้น');
    }
    if (tournament.registration_open) {
        throw new AppError(409, 'REGISTRATION_OPEN', 'ต้องปิดรับสมัครก่อน unpublish');
    }
    if (!await TournamentRepo.changeTournamentStatus(tournament.tournament_id, userId, 'public', 'private')) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'สถานะทัวร์นาเมนต์เปลี่ยนไปแล้ว');
    }
    return { id: tournament.tournament_id, status: 'private' as const };
}

export async function openRegistration(tournament: TournamentRow, userId: number) {
    if (tournament.tournament_status !== 'public' || tournament.registration_open) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'ทัวร์นาเมนต์ต้องเป็น public และยังไม่เปิดรับสมัคร');
    }
    if (!await TournamentRepo.changeRegistrationState(tournament.tournament_id, userId, true)) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'สถานะรับสมัครเปลี่ยนไปแล้ว');
    }
    await NotificationService.notifyTournamentTeamLeaders(tournament.tournament_id, {
        type: 'registration_toggled',
        title: 'เปิดรับสมัครแล้ว',
        message: `ทัวร์นาเมนต์ "${tournament.name}" เปิดรับสมัครแล้ว`,
        relatedEntityType: 'tournament', relatedEntityId: tournament.tournament_id,
    });
    return { id: tournament.tournament_id, registrationOpen: true as const };
}

export async function closeRegistration(tournament: TournamentRow, userId: number) {
    if (tournament.tournament_status !== 'public' || !tournament.registration_open) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'ทัวร์นาเมนต์ต้องเป็น public และกำลังเปิดรับสมัคร');
    }
    if (!await TournamentRepo.changeRegistrationState(tournament.tournament_id, userId, false)) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'สถานะรับสมัครเปลี่ยนไปแล้ว');
    }
    await NotificationService.notifyTournamentTeamLeaders(tournament.tournament_id, {
        type: 'registration_toggled',
        title: 'ปิดรับสมัครแล้ว',
        message: `ทัวร์นาเมนต์ "${tournament.name}" ปิดรับสมัครแล้ว`,
        relatedEntityType: 'tournament', relatedEntityId: tournament.tournament_id,
    });
    return { id: tournament.tournament_id, registrationOpen: false as const };
}

export async function getEligibilityRules(tournamentId: number, userId?: number) {
    await getVisibleTournament(tournamentId, userId);
    const rows = await ApplicationRepo.findEligibilityRules(tournamentId);
    return { items: rows.map(row => ({ ruleType: row.rule_type, ruleValue: row.rule_value })) };
}
