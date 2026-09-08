import * as z from 'zod';
import * as AdminScopeRepo from '../repositories/adminScope.repo.js';
import * as ApplicationRepo from '../repositories/application.repo.js';
import * as DepartmentRepo from '../repositories/department.repo.js';
import * as FacultyRepo from '../repositories/faculty.repo.js';
import * as SportTypeRepo from '../repositories/sportType.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import * as UserRepo from '../repositories/user.repo.js';
import { toTournamentDetailDto, toTournamentListDto } from '../mappers/tournament.mapper.js';
import { toUserRef } from '../mappers/user.mapper.js';
import { buildPagination } from '../utils/pagination.js';
import { AppError } from '../utils/AppError.js';
import type { AdminScopeRow, TournamentRow } from '../types/db.js';
import type { AmendmentRequestInput, CreateTournamentInput, UpdateTournamentInput } from '../schemas/tournament.schema.js';

const amendmentFieldSchema = z.object({
    registrationStart: z.iso.datetime({ offset: true }).optional(),
    registrationEnd: z.iso.datetime({ offset: true }).optional(),
    eventStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    eventEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    minTeams: z.int().min(2).optional(),
    maxTeams: z.int().min(2).optional(),
    genderRequirement: z.enum(['any', 'male', 'female']).optional(),
    minAge: z.int().min(0).max(120).nullable().optional(),
    maxAge: z.int().min(0).max(120).nullable().optional()
}).catchall(z.unknown());

const allowedAmendmentFields = new Set([
    'registrationStart', 'registrationEnd', 'eventStartDate', 'eventEndDate',
    'minTeams', 'maxTeams', 'genderRequirement', 'minAge', 'maxAge'
]);

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
    if (tournament.tournament_status === 'public') return tournament;

    if (userId !== undefined && tournament.requested_by_user_id === userId && tournament.tournament_status === 'private') {
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

export async function createTournament(input: CreateTournamentInput, userId: number) {
    ensureSchedule(input);
    ensureAges(input.minAge, input.maxAge);
    await ensureCreateReferences(input);

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
        genderRequirement: input.genderRequirement,
        minAge: input.minAge ?? null,
        maxAge: input.maxAge ?? null
    });
    return { id, status: 'pending_approval' as const, name: input.name };
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
    await getTournamentAdmin(userId, tournament);
    if (tournament.tournament_status !== 'pending_approval') {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'ทัวร์นาเมนต์นี้ไม่ได้อยู่ในสถานะรออนุมัติ');
    }
    if (!await TournamentRepo.approveTournament(tournamentId, userId)) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'สถานะทัวร์นาเมนต์เปลี่ยนไปแล้ว');
    }
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
    return { id: tournamentId, status: 'rejected' as const, reason };
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

export async function requestAmendment(tournamentId: number, userId: number, input: AmendmentRequestInput) {
    const tournament = await getTournamentOr404(tournamentId);
    const changes = validateAmendmentChanges(input.requestedChanges);
    validateAmendmentAgainstTournament(tournament, changes);
    const id = await TournamentRepo.insertAmendmentRequest(tournamentId, userId, changes);
    return { id, status: 'pending' as const };
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
    await getTournamentAdmin(userId, tournament);
    return { amendment, tournament };
}

export async function approveAmendment(amendmentId: number, userId: number) {
    const { amendment, tournament } = await getAmendmentForAdmin(amendmentId, userId);
    const changes = validateAmendmentChanges(amendment.requested_changes);
    validateAmendmentAgainstTournament(tournament, changes);
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
    const result = await TournamentRepo.publishTournament(tournament.tournament_id, userId);
    if (result.status === 'referees_incomplete') {
        const refereesAccepted = result.refereesAccepted;
        throw new AppError(409, 'REFEREES_INCOMPLETE', 'กรุณาแต่งตั้งกรรมการให้ครบก่อนเปิดเผยแพร่', { refereesAccepted, refereesRequired: 1 });
    }
    if (result.status !== 'ok') {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'สถานะทัวร์นาเมนต์เปลี่ยนไปแล้ว');
    }
    return { id: tournament.tournament_id, status: 'public' as const };
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
    return { id: tournament.tournament_id, registrationOpen: true as const };
}

export async function closeRegistration(tournament: TournamentRow, userId: number) {
    if (tournament.tournament_status !== 'public' || !tournament.registration_open) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'ทัวร์นาเมนต์ต้องเป็น public และกำลังเปิดรับสมัคร');
    }
    if (!await TournamentRepo.changeRegistrationState(tournament.tournament_id, userId, false)) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'สถานะรับสมัครเปลี่ยนไปแล้ว');
    }
    return { id: tournament.tournament_id, registrationOpen: false as const };
}

export async function getEligibilityRules(tournamentId: number, userId?: number) {
    await getVisibleTournament(tournamentId, userId);
    const rows = await ApplicationRepo.findEligibilityRules(tournamentId);
    return { items: rows.map(row => ({ ruleType: row.rule_type, ruleValue: row.rule_value })) };
}
