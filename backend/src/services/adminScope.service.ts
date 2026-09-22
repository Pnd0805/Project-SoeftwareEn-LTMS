import { toGetOfficialRequest, toRequestApproveDto, toRequestRejectDto, toGetTransferRequest, toAdminScopeDto } from '../mappers/adminScope.mapper.js';
import * as AdminRepo from '../repositories/adminScope.repo.js';
import * as TeamRepo from '../repositories/team.repo.js';
import * as UserRepo from '../repositories/user.repo.js';
import * as AuditLogRepo from '../repositories/auditLog.repo.js';
import * as FacultyRepo from '../repositories/faculty.repo.js';
import * as UserReportRepo from '../repositories/userReport.repo.js';
import { toOfficialMemberConflictDto } from '../mappers/team.mapper.js';
import { toAdminUserDto } from '../mappers/user.mapper.js';
import { toAuditLogDto } from '../mappers/auditLog.mapper.js';
import { toUserReportDto } from '../mappers/userReport.mapper.js';

import { buildPagination } from '../utils/pagination.js';
import { AppError } from '../utils/AppError.js';
import { checkTeam, checkUser } from '../utils/checkExist.js';
import type { AdminScopeRow } from '../types/db.js';

export async function getAllOfficialRequest(offset : number , page : number , pageSize : number){
    const { rows , totalItems } = await AdminRepo.findAllOfficialRequests(offset , pageSize);

    const pagination = buildPagination(page , pageSize , totalItems)
    const data = rows.map(toGetOfficialRequest);
    return { items : data , pagination}
}



export async function approveTeamRequest(adminId : number ,teamReqId : number){
    const teamReq = await TeamRepo.findOfficialRequestById(teamReqId);
    if(!teamReq){
        throw new AppError(404 , "TEAM_REQUEST_NOT_FOUND", "ไม่พบคำร้องขอทีม Official");
    }

    const status = teamReq['team_admin_request_status'];
    if(status !== 'pending'){
        throw new AppError(409 , "ALREADY_DECIDED" , "คําขอนี้ถูกพิจารณาไปแล้ว");
    }

    const teamId = teamReq['team_id'];
    const team = await TeamRepo.findById(teamId);
    const isMemberConflict = await TeamRepo.findOfficialMemberConflict(teamId , team!['sport_type_id']);

    if(isMemberConflict.length > 0 ){
        const extra = {conflictingMembers : isMemberConflict.map(toOfficialMemberConflictDto)};
        throw new AppError(422 , "MEMBER_CONFLICT" , "สมาชิกบางคนสังกัดทีม Official อื่นในกีฬาเดียวกันแล้ว" , extra );
    }

    await AdminRepo.approveTeamOfficial(adminId , teamReqId , teamId);
    const official_team = await TeamRepo.findById(teamId);
    return toRequestApproveDto(official_team!);
}

export async function rejectTeamOfficial(adminId : number , teamReqId : number , reason : string){

    const teamReq = await TeamRepo.findOfficialRequestById(teamReqId);
    if(!teamReq){
        throw new AppError(404 , "TEAM_REQUEST_NOT_FOUND", "ไม่พบคำร้องขอทีม Official");
    }

    const status = teamReq['team_admin_request_status'];
    if(status !== 'pending'){
        throw new AppError(409 , "ALREADY_DECIDED" , "คําขอนี้ถูกพิจารณาไปแล้ว");
    }

    if(reason === ""){
        throw new AppError(400 , 'TEAM_REJECT_REASON_REQUIRED' , "กรุณาระบุเหตุผลที่ปฏิเสธคำร้อง");
    }

    await AdminRepo.rejectTeamOfficial(adminId , teamReqId , reason);
    const reject_request = await TeamRepo.findOfficialRequestById(teamReqId);

    return toRequestRejectDto(reject_request!);
}

// C3 — ลิสต์คำขอโอนหัวหน้าทีมที่รออนุมัติ
export async function getAllTransferRequest(offset : number , page : number , pageSize : number){
    const { rows , totalItems } = await AdminRepo.findAllTransferRequests(offset , pageSize);

    const pagination = buildPagination(page , pageSize , totalItems)
    const data = rows.map(toGetTransferRequest);
    return { items : data , pagination}
}

// C3 — โอนหัวหน้าทีม (T20)
export async function approveTransferRequest(adminId : number , teamReqId : number){
    const teamReq = await TeamRepo.findTransferRequestById(teamReqId);
    if(!teamReq){
        throw new AppError(404 , "TEAM_REQUEST_NOT_FOUND", "ไม่พบคำร้องขอโอนหัวหน้าทีม");
    }

    if(teamReq.team_admin_request_status !== 'pending'){
        throw new AppError(409 , "ALREADY_DECIDED" , "คําขอนี้ถูกพิจารณาไปแล้ว");
    }

    const teamId = teamReq.team_id;
    const newLeaderId = teamReq.target_user_id!;

    await AdminRepo.approveTransferRequest(adminId , teamReqId , teamId , newLeaderId);
    return { teamId , newLeaderId };
}

// C3 — ปฏิเสธคำขอโอนหัวหน้าทีม (ใช้ AdminRepo.rejectTeamOfficial ร่วมกับ T18 ได้เลย — repo ฝั่งนั้นเป็น UPDATE ทั่วไป ไม่กรอง request_type)
export async function rejectTransferRequest(adminId : number , teamReqId : number , reason : string){
    const teamReq = await TeamRepo.findTransferRequestById(teamReqId);
    if(!teamReq){
        throw new AppError(404 , "TEAM_REQUEST_NOT_FOUND", "ไม่พบคำร้องขอโอนหัวหน้าทีม");
    }

    if(teamReq.team_admin_request_status !== 'pending'){
        throw new AppError(409 , "ALREADY_DECIDED" , "คําขอนี้ถูกพิจารณาไปแล้ว");
    }

    if(reason === ""){
        throw new AppError(400 , 'TEAM_REJECT_REASON_REQUIRED' , "กรุณาระบุเหตุผลที่ปฏิเสธคำร้อง");
    }

    await AdminRepo.rejectTeamOfficial(adminId , teamReqId , reason);
    const reject_request = await TeamRepo.findTransferRequestById(teamReqId);

    return toRequestRejectDto(reject_request!);
}

// C3 — แอดมินโอนหัวหน้าทีมแทนตอนหัวหน้าเดิมหายไป (ไม่ผ่านคิว — ไม่เช็ค official_status เพราะใช้ได้ทั้ง Official/Unofficial)
export async function transferLeaderByAdmin(adminId : number , teamId : number , newLeaderId : number){
    await checkTeam(teamId);

    const member = await TeamRepo.isMemberOf(teamId , newLeaderId);
    if(!member){
        throw new AppError(422 , "NOT_A_TEAM_MEMBER" , "ผู้ใช้ที่เลือกต้องเป็นสมาชิกของทีมนี้อยู่แล้ว");
    }

    await AdminRepo.transferLeaderByAdmin(adminId , teamId , newLeaderId);
    return { teamId , newLeaderId };
}

// ============================= C2 — Admin user surface =============================

// root มีหน้าที่แค่แต่งตั้ง/ถอน university_wide + ดู audit/scopes ทั้งหมด — ไม่ทำงานทั่วไปประจำวันใดๆ ทั้งสิ้น
function assertNotRoot(admin : AdminScopeRow){
    if(admin.scope_type === 'root'){
        throw new AppError(403 , "ROOT_NO_DAILY_OPERATIONS" , "Root มีหน้าที่แต่งตั้ง/ถอนสิทธิ์ University Admin เท่านั้น ไม่ทำหน้าที่นี้");
    }
}

// C2 — GET /admin/users · admin คณะเห็นแค่คนในคณะตัวเอง (ล้อ pattern เดียวกับ tournament.repo.ts ที่ให้ university_wide เห็นหมด) · root ไม่มีสิทธิ์เปิดดูเลย
export async function listUsers(admin : AdminScopeRow , filters : { q? : string | undefined; facultyId? : number | undefined; suspended? : boolean | undefined },
                                 offset : number , page : number , pageSize : number){
    assertNotRoot(admin);
    const scopedFilters = admin.scope_type === 'faculty' ? { ...filters , facultyId : admin.faculty_id! } : filters;
    const { rows , totalItems } = await UserRepo.searchUsersAdmin(scopedFilters , offset , pageSize);

    return { items : rows.map(toAdminUserDto) , pagination : buildPagination(page , pageSize , totalItems) };
}

// ตรวจว่า admin คนนี้แตะ targetUserId ได้ไหม (ใช้ร่วมกันทั้ง suspend/unsuspend/approve-report/reject-report)
// root ไม่ทำ · faculty admin แตะแอดมินไม่ได้เลย (ทุกระดับ) แตะได้แค่ user ธรรมดาในคณะตัวเอง — university_wide แตะใครก็ได้ (ยกเว้นตัวเอง)
async function assertCanActOnUser(admin : AdminScopeRow , targetUserId : number , target : { faculty_id : number | null }){
    assertNotRoot(admin);
    if(targetUserId === admin.user_id){
        throw new AppError(403 , "CANNOT_SUSPEND_SELF" , "ไม่สามารถระงับบัญชีตัวเองได้");
    }
    if(admin.scope_type === 'faculty'){
        const targetScope = await AdminRepo.findAdminByUserId(targetUserId);
        if(targetScope || target.faculty_id !== admin.faculty_id){
            throw new AppError(403 , "INSUFFICIENT_ADMIN_SCOPE" , "สิทธิ์ผู้ดูแลระบบของคุณไม่ครอบคลุมขอบเขตนี้");
        }
    }
}

// แกนกลางของการระงับจริง — ใช้ทั้ง PATCH /admin/users/:id/suspend และตอนอนุมัติ user_reports (C2)
async function performSuspend(admin : AdminScopeRow , targetUserId : number , reason : string | undefined){
    const target = await checkUser(targetUserId);
    await assertCanActOnUser(admin , targetUserId , target);

    if(!reason){
        throw new AppError(400 , "SUSPEND_REASON_REQUIRED" , "กรุณาระบุเหตุผลที่ระงับผู้ใช้");
    }

    const [ hasOrgTournament , hasApprovedApp ] = await Promise.all([
        UserRepo.hasActivePublicTournamentAsOrganizer(targetUserId),
        UserRepo.hasApprovedApplicationAsLeader(targetUserId)
    ]);
    if(hasOrgTournament || hasApprovedApp){
        throw new AppError(409 , "USER_HAS_ACTIVE_OBLIGATIONS" , "ผู้ใช้นี้มีทัวร์นาเมนต์หรือทีมที่กำลังดำเนินอยู่ ต้องจัดการให้เสร็จก่อนระงับ");
    }

    // targetScope เป็น null เสมอในเคสปกติ เพราะ assertCanActOnUser กันแอดมินคณะไปแล้ว — เหลือแค่ university_wide ที่ระงับแอดมินได้จริง
    const targetScope = await AdminRepo.findAdminByUserId(targetUserId);
    if(targetScope?.scope_type === 'university_wide'){
        const activeCount = await AdminRepo.countActiveUniversityWideAdmins();
        if(activeCount <= 1){
            throw new AppError(409 , "LAST_UNIVERSITY_ADMIN" , "ต้องมีแอดมินระดับมหาวิทยาลัยที่ใช้งานได้อย่างน้อย 1 คนเสมอ");
        }
    }

    await UserRepo.suspendUser(targetUserId , true , reason);
    await AuditLogRepo.insertAuditLog(admin.user_id , 'user_suspended' , 'user' , targetUserId , { reason });

    let warning : string | null = null;
    if(targetScope?.scope_type === 'faculty' && targetScope.faculty_id !== null){
        const remaining = await AdminRepo.countActiveFacultyAdmins(targetScope.faculty_id);
        if(remaining === 0){
            warning = "คณะนี้จะไม่เหลือแอดมินที่ใช้งานได้เลย ต้องแต่งตั้งแอดมินคณะใหม่";
        }
    }

    const updated = await checkUser(targetUserId);
    const dto = toAdminUserDto({ ...updated , admin_scope_id : targetScope?.admin_scope_id ?? null ,
                                  admin_scope_type : targetScope?.scope_type ?? null , admin_scope_faculty_id : targetScope?.faculty_id ?? null });
    return { dto , warning };
}

// C2 — PATCH /admin/users/:id/suspend
export async function suspendUser(admin : AdminScopeRow , targetUserId : number , suspended : boolean , reason : string | undefined){
    if(suspended){
        const { dto , warning } = await performSuspend(admin , targetUserId , reason);
        return { ...dto , warning };
    }

    const target = await checkUser(targetUserId);
    await assertCanActOnUser(admin , targetUserId , target);

    await UserRepo.suspendUser(targetUserId , false , null);
    await AuditLogRepo.insertAuditLog(admin.user_id , 'user_unsuspended' , 'user' , targetUserId , { reason : null });

    const updated = await checkUser(targetUserId);
    const targetScope = await AdminRepo.findAdminByUserId(targetUserId);
    return { ...toAdminUserDto({ ...updated , admin_scope_id : targetScope?.admin_scope_id ?? null ,
                                  admin_scope_type : targetScope?.scope_type ?? null , admin_scope_faculty_id : targetScope?.faculty_id ?? null }) ,
             warning : null };
}

// C2 — GET /admin/scopes · admin คณะเห็นแค่ scope ในคณะตัวเอง
export async function listScopes(admin : AdminScopeRow , filters : { facultyId? : number | undefined } , offset : number , page : number , pageSize : number){
    const scopedFilters = admin.scope_type === 'faculty' ? { facultyId : admin.faculty_id! } : filters;
    const { rows , totalItems } = await AdminRepo.findAllAdminScopes(scopedFilters , offset , pageSize);

    return { items : rows.map(toAdminScopeDto) , pagination : buildPagination(page , pageSize , totalItems) };
}

// ใครแต่งตั้งใครได้บ้าง (มติ 22 ก.ย. 2569 — ห้ามแต่งตั้งระดับเดียวกับตัวเอง)
// root → university_wide เท่านั้น · university_wide → faculty เท่านั้น · faculty → แต่งตั้งใครไม่ได้เลย
function assertCanGrant(admin : AdminScopeRow , scopeType : 'faculty' | 'university_wide'){
    if(admin.scope_type === 'faculty'){
        throw new AppError(403 , "INSUFFICIENT_ADMIN_SCOPE" , "แอดมินคณะไม่มีสิทธิ์แต่งตั้ง/ถอนสิทธิ์แอดมิน");
    }
    if(admin.scope_type === 'root' && scopeType !== 'university_wide'){
        throw new AppError(403 , "INSUFFICIENT_ADMIN_SCOPE" , "Root แต่งตั้งได้เฉพาะ University Admin เท่านั้น");
    }
    if(admin.scope_type === 'university_wide' && scopeType !== 'faculty'){
        throw new AppError(403 , "INSUFFICIENT_ADMIN_SCOPE" , "University Admin แต่งตั้งได้เฉพาะ Faculty Admin เท่านั้น (แต่งตั้ง University Admin คนอื่นไม่ได้)");
    }
}

// C2 — POST /admin/scopes
export async function grantScope(admin : AdminScopeRow , targetUserId : number , scopeType : 'faculty' | 'university_wide' , facultyId : number | undefined){
    const targetUser = await checkUser(targetUserId);
    assertCanGrant(admin , scopeType);

    if(scopeType === 'faculty' && facultyId === undefined){
        const fields = { facultyId : "ต้องระบุคณะเมื่อตั้ง scope เป็น faculty" };
        throw new AppError(400 , "VALIDATION_FAILED" , "ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบและกรอกใหม่" , { fields });
    }
    if(scopeType === 'university_wide' && facultyId !== undefined){
        const fields = { facultyId : "university_wide ต้องไม่ระบุคณะ" };
        throw new AppError(400 , "VALIDATION_FAILED" , "ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบและกรอกใหม่" , { fields });
    }
    if(facultyId !== undefined && !(await FacultyRepo.findFacultyById(facultyId))){
        throw new AppError(404 , "FACULTY_NOT_FOUND" , "ไม่พบคณะนี้");
    }

    const existing = await AdminRepo.findAdminByUserId(targetUserId);
    if(existing){
        throw new AppError(409 , "ADMIN_SCOPE_ALREADY_EXISTS" , "ผู้ใช้นี้มีสิทธิ์แอดมินอยู่แล้ว ต้องถอนสิทธิ์เดิมก่อนตั้งใหม่");
    }

    const scopeId = await AdminRepo.createAdminScope(targetUserId , scopeType , facultyId ?? null , admin.user_id);
    await AuditLogRepo.insertAuditLog(admin.user_id , 'admin_scope_granted' , 'admin_scope' , scopeId , { targetUserId , scopeType , facultyId : facultyId ?? null });

    const created = await AdminRepo.findAdminScopeById(scopeId);
    return toAdminScopeDto({ admin_scope_id : created!.admin_scope_id , scope_type : created!.scope_type , faculty_id : created!.faculty_id ,
                              created_at : created!.created_at , user_id : targetUserId , full_name : targetUser.full_name , profile_image_key : targetUser.profile_image_key });
}

// C2 — DELETE /admin/scopes/:id
export async function revokeScope(admin : AdminScopeRow , scopeId : number){
    const scope = await AdminRepo.findAdminScopeById(scopeId);
    if(!scope){
        throw new AppError(404 , "ADMIN_SCOPE_NOT_FOUND" , "ไม่พบสิทธิ์แอดมินนี้");
    }

    // root ถอนผ่าน API ไม่ได้เด็ดขาด ไม่ว่าใครจะเป็นคนขอ — ต้องมีเสมอ 1 คนในระบบ แก้ได้แค่ผ่าน DB/seed
    if(scope.scope_type === 'root'){
        throw new AppError(403 , "CANNOT_REVOKE_ROOT_SCOPE" , "ไม่สามารถถอนสิทธิ์ Root ผ่าน API ได้");
    }

    if(scope.user_id === admin.user_id){
        throw new AppError(403 , "CANNOT_REVOKE_OWN_SCOPE" , "ไม่สามารถถอนสิทธิ์แอดมินของตัวเองได้");
    }

    assertCanGrant(admin , scope.scope_type);

    if(scope.scope_type === 'university_wide'){
        const count = await AdminRepo.countActiveUniversityWideAdmins();
        if(count <= 1){
            throw new AppError(409 , "LAST_UNIVERSITY_ADMIN" , "ต้องมีแอดมินระดับมหาวิทยาลัยเหลืออย่างน้อย 1 คนเสมอ");
        }
    }

    await AdminRepo.deleteAdminScope(scopeId);
    await AuditLogRepo.insertAuditLog(admin.user_id , 'admin_scope_revoked' , 'admin_scope' , scopeId , { targetUserId : scope.user_id , scopeType : scope.scope_type });

    return { id : scopeId };
}

// C2 — GET /admin/audit-logs · root + university_wide เท่านั้น (audit log ไม่มี faculty_id ผูกตรงๆ scoping ต่อ entity ซับซ้อนเกินจำเป็นตอนนี้)
export async function listAuditLogs(admin : AdminScopeRow ,
                                     filters : { entityType? : string | undefined; entityId? : number | undefined; userId? : number | undefined; actionType? : string | undefined },
                                     offset : number , page : number , pageSize : number){
    if(admin.scope_type === 'faculty'){
        throw new AppError(403 , "INSUFFICIENT_ADMIN_SCOPE" , "สิทธิ์ผู้ดูแลระบบของคุณไม่ครอบคลุมขอบเขตนี้");
    }
    const { rows , totalItems } = await AuditLogRepo.findAuditLogs(filters , offset , pageSize);
    return { items : rows.map(toAuditLogDto) , pagination : buildPagination(page , pageSize , totalItems) };
}

// ============================= C2 — user_reports (ผู้ใช้ทั่วไปแจ้งขอระงับคนอื่น) =============================

// GET /admin/user-reports · university_wide เห็นทุกคำร้อง (ทั้ง target เป็น user/แอดมิน) · faculty เห็นแค่ target เป็น user ธรรมดาในคณะตัวเอง · root ไม่เกี่ยว
export async function listUserReports(admin : AdminScopeRow , offset : number , page : number , pageSize : number){
    assertNotRoot(admin);
    const facultyOnly = admin.scope_type === 'faculty' ? admin.faculty_id! : undefined;
    const { rows , totalItems } = await UserReportRepo.findAllUserReports(facultyOnly , offset , pageSize);
    return { items : rows.map(toUserReportDto) , pagination : buildPagination(page , pageSize , totalItems) };
}

async function checkReportReviewable(admin : AdminScopeRow , reportId : number){
    assertNotRoot(admin);
    const report = await UserReportRepo.findById(reportId);
    if(!report){
        throw new AppError(404 , "USER_REPORT_NOT_FOUND" , "ไม่พบคำร้องนี้");
    }
    if(report.user_report_status !== 'pending'){
        throw new AppError(409 , "ALREADY_DECIDED" , "คําขอนี้ถูกพิจารณาไปแล้ว");
    }
    // ห้ามแอดมินที่ถูกแจ้งเป็นคนตัดสินคำร้องเรื่องตัวเอง
    if(report.target_user_id === admin.user_id){
        throw new AppError(403 , "CANNOT_REVIEW_OWN_REPORT" , "ไม่สามารถพิจารณาคำร้องที่แจ้งเกี่ยวกับตัวเองได้");
    }
    return report;
}

// POST /admin/user-reports/:id/approve — เรียก performSuspend ตัวเดียวกับ PATCH /admin/users/:id/suspend
// assertCanActOnUser ข้างใน performSuspend จะกัน faculty admin ไม่ให้อนุมัติคำร้องที่ target เป็นแอดมินเองอยู่แล้ว
export async function approveUserReport(admin : AdminScopeRow , reportId : number){
    const report = await checkReportReviewable(admin , reportId);

    const { dto , warning } = await performSuspend(admin , report.target_user_id , report.reason);

    await UserReportRepo.updateStatus(reportId , 'approved' , admin.user_id , null);
    await AuditLogRepo.insertAuditLog(admin.user_id , 'user_report_approved' , 'user_report' , reportId , { targetUserId : report.target_user_id });

    return { ...dto , warning };
}

// POST /admin/user-reports/:id/reject
export async function rejectUserReport(admin : AdminScopeRow , reportId : number , reason : string){
    const report = await checkReportReviewable(admin , reportId);

    // faculty admin ปฏิเสธคำร้องนอกคณะตัวเอง/เกี่ยวกับแอดมินไม่ได้ — เช็คแบบเดียวกับตอน approve โดยไม่ต้อง suspend จริง
    const target = await checkUser(report.target_user_id);
    await assertCanActOnUser(admin , report.target_user_id , target);

    await UserReportRepo.updateStatus(reportId , 'rejected' , admin.user_id , reason);
    await AuditLogRepo.insertAuditLog(admin.user_id , 'user_report_rejected' , 'user_report' , reportId , { targetUserId : report.target_user_id , reason });

    return { id : reportId , status : 'rejected' as const , reason };
}