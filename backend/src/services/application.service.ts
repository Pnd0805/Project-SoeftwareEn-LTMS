import * as ApplicationRepo from '../repositories/application.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import { toTeamRef } from '../mappers/team.mapper.js';
import { toApplicationDetailDto, toMyApplicationDto } from '../mappers/application.mapper.js';
import { toOrganizerApplicationDto } from '../mappers/application.mapper.js';
import { AppError } from '../utils/AppError.js';

type HardFilterFail = { userId: number; fullName: string; reason: 'gender' | 'age' | 'year' | 'faculty' };

function calculateAge(birthDate: string): number {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const hasHadBirthdayThisYear =
        today.getMonth() > birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
    if (!hasHadBirthdayThisYear) age -= 1;
    return age;
}


export async function getApprovedTeams(tournamentId: number) {
    const rows = await ApplicationRepo.findApprovedTeamsByTournament(tournamentId);
    const data = rows.map(toTeamRef);
    return { items: data };
}

export async function getMyappication(userId: number) {
    const rows = await ApplicationRepo.findApplicationsByLeader(userId);
    const data = rows.map(toMyApplicationDto);
    return { items: data};
}

export async function getTournamentApplications(tournamentId: number) {
    const rows = await ApplicationRepo.findApplicationsByTournament(tournamentId);
    const data = rows.map(toOrganizerApplicationDto);
    return { items: data};
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

    return toApplicationDetailDto(app) ; 
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
    if (app.tournament_application_status !== "approved"){
        throw new AppError(409, "APPLICATION_NOT_APPROVED", "ใบสมัครนี้ยังไม่ได้รับการอนุมัติ จึงไม่สามารถถอนตัวได้");
    }
    await ApplicationRepo.updateApplicationStatus(applicationId, "withdrawn");
    return { id: applicationId, status: "withdrawn", bracketExists: false};
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
    await ApplicationRepo.updateApplicationStatus(applicationId, "approved");
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
    throw new AppError(409, "ALREADY_DECIDED", "คำขอนี้ถูกพิจารณาไปแล้ว");
    }
    await ApplicationRepo.rejectApplicationInDb(applicationId, reason);
    return { id: applicationId, status:'rejected', reason }
}

export async function applyTournament(tournamentId: number, teamId: number, userId: number) {
    // 1. โหลดทีม + เช็คว่าเป็นหัวหน้าทีม + เช็คว่า Ready
    const team = await ApplicationRepo.findTeamForApply(teamId);
    if (!team) {
        throw new AppError(404, "TEAM_NOT_FOUND", "ไม่พบทีมนี้");
    }
    if (team.leader_id !== userId) {
        throw new AppError(403, "NOT_TEAM_LEADER", "คุณไม่ใช่หัวหน้าทีมนี้");
    }
    if (team.readiness_status !== 'Ready') {
        throw new AppError(409, "TEAM_NOT_READY", "ทีมต้องมีสถานะ Ready ก่อนสมัคร");
    }

    // 2. โหลดทัวร์นาเมนต์ + เช็คว่าเปิดรับสมัคร
    const tournament = await TournamentRepo.findTournamentById(tournamentId);
    if (!tournament) {
        throw new AppError(404, "TOURNAMENT_NOT_FOUND", "ไม่พบทัวร์นาเมนต์นี้");
    }
    if (!tournament.registration_open) {
        throw new AppError(409, "REGISTRATION_CLOSED", "ทัวร์นาเมนต์นี้ปิดรับสมัครแล้ว");
    }

    // 3. เช็คว่าเคยสมัครไปแล้วหรือยัง
    const existing = await ApplicationRepo.findExistingApplication(tournamentId, teamId);
    if (existing) {
        throw new AppError(409, "ALREADY_APPLIED", "ทีมนี้สมัครทัวร์นาเมนต์นี้ไปแล้ว");
    }

    // 4. Hard Filter — วนเช็คสมาชิกทุกคนในทีมทีละคน
    const members = await ApplicationRepo.findTeamMembersForFilter(teamId);
    const rules = await ApplicationRepo.findEligibilityRules(tournamentId);
    const yearRules = rules.filter(r => r.rule_type === 'year').map(r => r.rule_value);
    const facultyRules = rules.filter(r => r.rule_type === 'faculty').map(r => r.rule_value);

    const failedMembers: HardFilterFail[] = [];

    for (const member of members) {
        if (tournament.gender_requirement !== 'any' && member.gender !== tournament.gender_requirement) {
            failedMembers.push({ userId: member.user_id, fullName: member.full_name, reason: 'gender' });
            continue;
        }

        const age = calculateAge(member.birth_date);
        if (tournament.min_age !== null && age < tournament.min_age) {
            failedMembers.push({ userId: member.user_id, fullName: member.full_name, reason: 'age' });
            continue;
        }
        if (tournament.max_age !== null && age > tournament.max_age) {
            failedMembers.push({ userId: member.user_id, fullName: member.full_name, reason: 'age' });
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
        throw new AppError(422, "HARD_FILTER_FAILED", "สมาชิกบางคนไม่ผ่านเงื่อนไขการสมัคร", { details: failedMembers });
    }

    // 5. บันทึกใบสมัครใหม่ + เก็บผล Hard Filter ไว้ด้วย
    const newId = await ApplicationRepo.insertApplication(tournamentId, teamId, {
        checkedAt: new Date().toISOString(),
        memberIds: members.map(m => m.user_id),
    });

    return { id: newId, status: 'pending', hardFilterPassed: true };
}