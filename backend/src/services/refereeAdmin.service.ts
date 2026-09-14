import * as RefRepo from '../repositories/tournamentReferee.repo.js';
import { AppError } from '../utils/AppError.js';
import { toUserRef } from '../mappers/user.mapper.js';
import type { RejectExternalRefereeInput } from '../schemas/referee.schema.js';

/** AR01 — คิวกรรมการภายนอกที่รอตรวจ */
export async function listPendingExternalReferees(){
    const rows = await RefRepo.findPendingAdminReview();
    return {
        items : rows.map(r => ({
            id : r.tournament_referee_id,
            user : { ...toUserRef(r), email : r.email },
            tournament : { id : r.tournament_id, name : r.tournament_name },
            docs : r.external_verification_docs ?? [],     // S3 key — FE ขอ presigned URL เองถ้าจะเปิดดู
            submittedAt : r.created_at.toISOString()
        }))
    };
}

async function loadExternal(tournamentRefereeId : number){
    const tr = await RefRepo.findById(tournamentRefereeId);
    if(!tr || tr.removed_at !== null || tr.is_external !== 1){
        throw new AppError(404, 'REFEREE_NOT_FOUND', 'ไม่พบคำขอกรรมการภายนอกนี้');
    }
    return tr;
}

/** AR02 — อนุมัติ (เฉพาะ pending) · เอกสารถูกล้างทิ้งใน repo */
export async function approveExternalReferee(tournamentRefereeId : number, adminUserId : number){
    const tr = await loadExternal(tournamentRefereeId);
    if(tr.external_approval_status !== 'pending'){
        throw new AppError(409, 'NOT_PENDING_REVIEW', 'คำขอนี้ไม่ได้อยู่ระหว่างรอตรวจ');
    }
    const ok = await RefRepo.approveExternal(tournamentRefereeId, adminUserId);
    if(!ok) throw new AppError(409, 'NOT_PENDING_REVIEW', 'คำขอนี้ถูกตัดสินไปแล้ว');
    return { id : tournamentRefereeId, externalApprovalStatus : 'approved' as const };
}

/**
 * AR03 — ปฏิเสธเอกสาร (pending) หรือถอนอนุมัติ (approved · F-10)
 * ถอน = ถอนทุกทัวร์ที่ approved อยู่ของคนนั้นพร้อมกัน; แมตช์ที่รับไว้ยังอยู่แต่ไม่นับ → ORG เห็นจาก coverage
 */
export async function rejectExternalReferee(tournamentRefereeId : number, adminUserId : number, input : RejectExternalRefereeInput){
    const tr = await loadExternal(tournamentRefereeId);
    if(tr.external_approval_status !== 'pending' && tr.external_approval_status !== 'approved'){
        throw new AppError(409, 'NOT_PENDING_REVIEW', 'คำขอนี้ถูกปฏิเสธไปแล้ว');
    }
    const revokeAll = tr.external_approval_status === 'approved';
    const affected = await RefRepo.rejectExternal(tournamentRefereeId, tr.user_id, adminUserId, input.reason, revokeAll);
    if(affected === 0) throw new AppError(409, 'NOT_PENDING_REVIEW', 'คำขอนี้ถูกตัดสินไปแล้ว');
    return { id : tournamentRefereeId, externalApprovalStatus : 'rejected' as const, reason : input.reason, revokedRows : affected };
}
