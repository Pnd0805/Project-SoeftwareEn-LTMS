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
import { suspensionEndsAt } from '../utils/suspension.js';
import type { SuspensionCategory } from '../utils/suspension.js';
import { getPresignedDownloadUrl , presignAll } from './upload.service.js';
import { checkTeam, checkUser } from '../utils/checkExist.js';
import type { AdminScopeRow } from '../types/db.js';

export async function getAllOfficialRequest(offset : number , page : number , pageSize : number){
    const { rows , totalItems } = await AdminRepo.findAllOfficialRequests(offset , pageSize);

    const pagination = buildPagination(page , pageSize , totalItems)
    // เอกสารออกเป็น presigned URL เสมอ ไม่ส่ง S3 key ดิบ — เหมือนหลักฐานการค้านผลและรูปบัตรเช็คอิน
    const data = await Promise.all(rows.map(async row =>
        toGetOfficialRequest(row , await Promise.all((row.supporting_docs ?? []).map(key => getPresignedDownloadUrl(key))))));
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
// days = undefined คือระงับถาวร (พฤติกรรมเดิม) · มีค่าคือพ้นเองเมื่อครบ เพดานคุมที่ schema แล้ว
async function performSuspend(admin : AdminScopeRow , targetUserId : number , reason : string | undefined ,
                              days : number | undefined , category : SuspensionCategory | undefined){
    const target = await checkUser(targetUserId);
    await assertCanActOnUser(admin , targetUserId , target);

    // ย้ายขึ้นมาจากข้างล่าง (เดิมอ่านหลังด่านเหตุผล/ภาระค้าง) — ใช้ค่าเดียวกันทั้งด่าน root และด่าน university admin คนสุดท้าย
    const targetScope = await AdminRepo.findAdminByUserId(targetUserId);

    /**
     * 🔴 A1 (integration test เจอ 6 ต.ค. 2569) — ห้ามระงับบัญชี root ไม่ว่าใครจะเป็นคนขอ
     *
     * เดิม assertCanActOnUser จำกัดเฉพาะแอดมินคณะ และด่านล่างกันแค่ "university admin คนสุดท้าย"
     * ⇒ university admin ระงับ root ได้ · root ที่ถูกระงับเรียก API อะไรไม่ได้เลย (requireAuth ตอบ 403)
     * ขัดกับเจตนาในโค้ดเอง: revokeScope ห้ามถอนสิทธิ์ root "ไม่ว่าใครจะเป็นคนขอ" เพราะต้องมีเสมอ 1 คน
     * แต่การระงับบัญชีให้ผลเดียวกันคือ root ใช้ระบบไม่ได้ ⇒ ด่านที่ตั้งไว้ถูกเดินอ้อมได้ด้วยปุ่มอื่น
     *
     * ★ ที่ตัดสินเอง: วางด่านที่ performSuspend ไม่ใช่ assertCanActOnUser
     *   assertCanActOnUser ใช้ร่วมกับ "ยกเลิกการระงับ" และ "ปฏิเสธคำร้อง" ด้วย
     *   ถ้าวางที่นั่น จะกลายเป็น "ปลดระงับ root ก็ไม่ได้" ซึ่งเป็นการกู้คืน ไม่ใช่การทำร้าย
     *   (root ที่ถูกระงับไว้ก่อนหน้านี้ทางฐาน ยังต้องปลดได้) ⇒ กันเฉพาะทางที่ทำร้าย
     * ★ ครอบทั้งสองทางที่ระงับได้จริง: PATCH /admin/users/:id/suspend และการอนุมัติคำร้องผู้ใช้
     *   เพราะทั้งคู่ลงมาที่ฟังก์ชันนี้ที่เดียว
     */
    if(targetScope?.scope_type === 'root'){
        throw new AppError(403 , "CANNOT_SUSPEND_ROOT" ,
                           "ไม่สามารถระงับบัญชี Root ได้ — ระบบต้องมี Root อยู่เสมอ แก้ได้ทางฐานข้อมูลเท่านั้น");
    }

    /**
     * 🔴 B5 (มติ 6 ต.ค. 2569 ทางเลือก ก) — ระงับแอดมินมหาวิทยาลัยด้วยปุ่มเดียวไม่ได้
     *
     * เดิม university admin ระงับ university admin คนอื่นได้ กันแค่ "คนสุดท้าย"
     * ขณะที่การ **แต่งตั้ง/ถอนสิทธิ์** ระดับเดียวกันทำไม่ได้เลย (assertCanGrant: "University Admin
     * แต่งตั้ง University Admin คนอื่นไม่ได้") ⇒ ถอนสิทธิ์เพื่อนร่วมระดับไม่ได้ แต่ปิดบัญชีเขาได้
     * ซึ่งผลหนักกว่า — เป็นช่องที่เดินอ้อมกฎอำนาจระดับเดียวกัน
     *
     * ★ ทำไมไม่ "ให้เฉพาะ root ระงับ" ตามที่คิดกันตอนแรก: มติ 28 ก.ย. (OD-34) วางไว้ว่า
     *   root = คนแต่งตั้ง + คนตรวจ **ไม่ใช่คนปฏิบัติงาน** (ถอน root ไม่ได้ ระงับ root ไม่ได้
     *   ไม่มีชั้นไหนเหนือกว่า ⇒ ถ้า root กดงานประจำวัน คนตรวจกับคนถูกตรวจเป็นคนเดียวกัน)
     *   และข้อห้ามที่เขียนไว้ชัดคือ "ห้ามเติม root เข้าด่านที่กดได้"
     *
     * ★ ทางที่เลือก: ต้องถอนสิทธิ์ก่อน แล้วจึงระงับในฐานะผู้ใช้ทั่วไป (2 ขั้น)
     *   root ถอนสิทธิ์ (มีเพียง root ที่ถอน university_wide ได้) → เขาเป็นผู้ใช้ทั่วไป
     *   → แอดมินมหาวิทยาลัยคนไหนก็ระงับได้ตามปกติ
     *   ⇒ ได้ผลตามที่ต้องการโดยไม่ต้องให้อำนาจกดใหม่กับ root เลย และตรงกับรูปแบบที่มติ 28 ก.ย.
     *     วางไว้แล้วว่า "งานค้างแก้ด้วยการแต่งตั้ง/ถอน ไม่ใช่กดแทน"
     *   ⇒ ร่องรอยใน audit log มี 2 ขั้นชัดเจน (ถอนสิทธิ์ แล้วระงับ) อ่านย้อนได้ว่าใครทำอะไร
     *
     * ★ ไม่แตะเคสแอดมินคณะ — university admin ระงับแอดมินคณะได้ตามเดิม เพราะคนเดียวกันนั้น
     *   ถอนสิทธิ์แอดมินคณะได้อยู่แล้ว ⇒ ไม่มีช่องอ้อมให้ปิด (ด่านนี้แก้เฉพาะความไม่สมมาตร)
     */
    if(targetScope?.scope_type === 'university_wide'){
        throw new AppError(403 , "CANNOT_SUSPEND_UNIVERSITY_ADMIN" ,
                           "ต้องถอนสิทธิ์แอดมินมหาวิทยาลัยของผู้ใช้นี้ก่อน (เฉพาะ Root ที่ถอนได้) แล้วจึงระงับบัญชีได้");
    }

    if(!reason){
        throw new AppError(400 , "SUSPEND_REASON_REQUIRED" , "กรุณาระบุเหตุผลที่ระงับผู้ใช้");
    }
    // เหตุผลที่พิมพ์เป็นบันทึกภายใน ส่งให้เจ้าตัวไม่ได้ ⇒ ต้องมีประเภทคู่กัน ไม่งั้นคนที่ถูกระงับไม่รู้อะไรเลย
    if(!category){
        throw new AppError(400 , "SUSPEND_CATEGORY_REQUIRED" , "กรุณาเลือกประเภทการระงับ เพราะผู้ใช้ที่ถูกระงับจะเห็นประเภทนี้");
    }

    const [ hasOrgTournament , hasApprovedApp ] = await Promise.all([
        UserRepo.hasActivePublicTournamentAsOrganizer(targetUserId),
        UserRepo.hasApprovedApplicationAsLeader(targetUserId)
    ]);
    if(hasOrgTournament || hasApprovedApp){
        throw new AppError(409 , "USER_HAS_ACTIVE_OBLIGATIONS" , "ผู้ใช้นี้มีทัวร์นาเมนต์หรือทีมที่กำลังดำเนินอยู่ ต้องจัดการให้เสร็จก่อนระงับ");
    }

    // ★ ด่าน LAST_UNIVERSITY_ADMIN เคยอยู่ที่นี่ — ถอดออกเมื่อทำมติ B5 เพราะไปไม่ถึงแล้ว
    //   (ระงับ university admin ถูกปฏิเสธไปก่อนหน้านี้ทุกกรณี) ⇒ เก็บไว้จะเป็นโค้ดตายที่อ่านเข้าใจผิด
    //   หลักประกัน "ต้องมีแอดมินมหาวิทยาลัยเหลืออย่างน้อย 1 คน" ยังอยู่ครบที่ revokeScope
    //   ซึ่งตอนนี้เป็นทางเดียวที่จะทำให้จำนวนแอดมินมหาวิทยาลัยลดลง

    const until = suspensionEndsAt(days);
    await UserRepo.suspendUser(targetUserId , true , reason , until , category);
    // บันทึกทั้งสองค่า — days คือเจตนาที่แอดมินกด · until คือเวลาที่ผลจริงสิ้นสุด ตอนไล่ย้อนต้องแยกออกจากกันได้
    await AuditLogRepo.insertAuditLog(admin.user_id , 'user_suspended' , 'user' , targetUserId ,
                                       { reason , category , days : days ?? null , until : until?.toISOString() ?? null });

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
export async function suspendUser(admin : AdminScopeRow , targetUserId : number , suspended : boolean , reason : string | undefined ,
                                   days : number | undefined , category : SuspensionCategory | undefined){
    if(suspended){
        const { dto , warning } = await performSuspend(admin , targetUserId , reason , days , category);
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
    // หลักฐานคืนเป็น presigned URL เสมอ ไม่ส่ง S3 key ดิบ (กฎรวม Part 3 ข้อ 11 · pattern เดียวกับ S03b/S13c)
    // เดิมส่ง key ดิบออกไป ⇒ FE เปิดรูปไม่ได้เลย แอดมินจึงตัดสินคำร้องโดยไม่เห็นหลักฐาน (แก้ 1 ต.ค. 69)
    // เป็นของส่วนตัว จึงใช้กฎคนละชุดกับ avatar/โลโก้ที่เป็นของสาธารณะ (OD-36)
    const items = await Promise.all(rows.map(async row => toUserReportDto(row , await presignAll(row.evidence))));
    return { items , pagination : buildPagination(page , pageSize , totalItems) };
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
export async function approveUserReport(admin : AdminScopeRow , reportId : number , days : number | undefined ,
                                        category : SuspensionCategory | undefined){
    const report = await checkReportReviewable(admin , reportId);

    // report.reason เป็นข้อความที่ ผู้แจ้ง พิมพ์ — อีกเหตุผลหนึ่งที่ห้ามส่งให้เจ้าตัวเห็นตรงๆ
    // แอดมินจึงต้องเลือกประเภทเองตอนอนุมัติ ไม่ใช่การหยิบจากคำร้องมาใช้เป็นประเภท
    const { dto , warning } = await performSuspend(admin , report.target_user_id , report.reason , days , category);

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