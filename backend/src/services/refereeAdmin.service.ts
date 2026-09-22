import * as RefRepo from '../repositories/tournamentReferee.repo.js';
import * as UserRepo from '../repositories/user.repo.js';
import { AppError } from '../utils/AppError.js';
import { toUserRef } from '../mappers/user.mapper.js';
import { getIdentityState } from './refereeIdentity.service.js';
import type { AdminReviewRow } from '../repositories/tournamentReferee.repo.js';
import type { RejectExternalRefereeInput } from '../schemas/referee.schema.js';
import * as NotificationService from './notification.service.js';

/** AR01 — คิวตรวจตัวตน จัดกลุ่ม "ต่อคน" (1 รายการ = 1 user แม้รออยู่หลายทัวร์) */
export async function listPendingExternalReferees(){
    const rows = await RefRepo.findPendingAdminReview();
    const byUser = new Map<number, AdminReviewRow[]>();
    for(const r of rows){
        const list = byUser.get(r.user_id) ?? [];
        list.push(r);
        byUser.set(r.user_id, list);
    }
    const items = [...byUser.values()].map(group => {
        const first = group[0]!;
        return {
            userId : first.user_id,
            user : { ...toUserRef(first), email : first.email },
            docs : group.find(g => g.external_verification_docs)?.external_verification_docs ?? [],  // S3 key — FE ขอ presign เอง
            tournaments : group.map(g => ({ id : g.tournament_id, name : g.tournament_name, tournamentRefereeId : g.tournament_referee_id })),
            submittedAt : first.created_at.toISOString()
        };
    });
    return { items };
}

async function assertUserExists(userId : number){
    const user = await UserRepo.findById(userId);
    if(!user) throw new AppError(404, 'USER_NOT_FOUND', 'ไม่พบผู้ใช้นี้ในระบบ');
}

/** AR02 — อนุมัติคน: ทุกทัวร์ที่รอ → approved · ใช้ได้ 1 ปี · เอกสารถูกล้าง */
export async function approveExternalReferee(userId : number, adminUserId : number){
    await assertUserExists(userId);
    const state = await getIdentityState(userId);
    if(state.status !== 'pending' && state.status !== 'needs_docs'){
        throw new AppError(409, 'NOT_PENDING_REVIEW', 'ผู้ใช้นี้ไม่ได้อยู่ระหว่างรอตรวจ');
    }
    const affected = await RefRepo.approveUser(userId, adminUserId);
    await NotificationService.notify({
        userId, type : 'referee_external_decided',
        title : 'ยืนยันตัวตนกรรมการผ่านแล้ว',
        message : 'แอดมินยืนยันตัวตนของคุณแล้ว คุณทำหน้าที่กรรมการได้ทันที',
    });
    return { userId, identityStatus : 'approved' as const, tournamentsUpdated : affected };
}

/** AR04 — ขอเอกสารใหม่ (ไม่ใช่ reject): ทัวร์ที่รอยังรอต่อ user เห็นข้อความแล้วส่งใหม่ผ่าน U12 */
export async function requestDocsFromExternalReferee(userId : number, adminUserId : number, input : RejectExternalRefereeInput){
    await assertUserExists(userId);
    const state = await getIdentityState(userId);
    if(state.status !== 'pending'){
        throw new AppError(409, 'NOT_PENDING_REVIEW', 'ผู้ใช้นี้ไม่ได้อยู่ระหว่างรอตรวจ');
    }
    const affected = await RefRepo.requestDocsFromUser(userId, adminUserId, input.reason);
    await NotificationService.notify({
        userId, type : 'referee_external_decided',
        title : 'แอดมินขอเอกสารยืนยันตัวตนเพิ่ม',
        message : `กรุณาส่งเอกสารยืนยันตัวตนใหม่ — ${input.reason}`,
    });
    return { userId, identityStatus : 'needs_docs' as const, reason : input.reason, tournamentsUpdated : affected };
}

/**
 * AR03 — ปฏิเสธคน (final) หรือถอนอนุมัติ (F-10)
 * ทุกแถว pending/needs_docs/approved ของคนนั้น (รวมที่ถูกถอดจากทัวร์แล้ว) → rejected
 * แมตช์ที่รับไว้ยังอยู่แต่ไม่นับ → ORG เห็นจาก F14 coverage
 */
export async function rejectExternalReferee(userId : number, adminUserId : number, input : RejectExternalRefereeInput){
    await assertUserExists(userId);
    const state = await getIdentityState(userId);
    if(state.status === 'none' || state.status === 'rejected'){
        throw new AppError(409, 'NOT_PENDING_REVIEW', 'ผู้ใช้นี้ไม่มีการยืนยันตัวตนที่จะปฏิเสธ');
    }
    const affected = await RefRepo.rejectUser(userId, adminUserId, input.reason);
    await NotificationService.notify({
        userId, type : 'referee_external_decided',
        title : 'ยืนยันตัวตนกรรมการไม่ผ่าน',
        message : `แอดมินไม่อนุมัติตัวตนกรรมการของคุณ — เหตุผล: ${input.reason}`,
    });
    return { userId, identityStatus : 'rejected' as const, reason : input.reason, tournamentsUpdated : affected };
}
