import * as RefRepo from '../repositories/tournamentReferee.repo.js';
import { AppError } from '../utils/AppError.js';
import type { ExternalApproval } from '../repositories/tournamentReferee.repo.js';
import type { SubmitDocsInput } from '../schemas/referee.schema.js';
import type { TournamentRefereeRow } from '../types/db.js';

/**
 * การยืนยันตัวตนกรรมการภายนอก — มองเป็น "สถานะของคน" แม้ DB เก็บต่อแถว
 *   none        ไม่เคยส่ง / ผลเก่าหมดอายุ            → ต้องส่ง docs
 *   pending     ส่งแล้ว รอ admin                     → ไม่ต้องส่งซ้ำ
 *   needs_docs  admin ขอเอกสารใหม่ (ดู adminMessage)  → ต้องส่งใหม่
 *   approved    ผ่าน ใช้ได้ถึง expiresAt (1 ปี)
 *   rejected    ไม่ผ่าน (final) — ต้องให้ ORG เชิญใหม่แล้วส่งใหม่
 */
export type IdentityStatus = 'none' | 'pending' | 'needs_docs' | 'approved' | 'rejected';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function getIdentityState(userId : number){
    const approval = await RefRepo.findRecentApproval(userId);
    if(approval && approval.approved_at){
        return { status : 'approved' as const, approvedAt : approval.approved_at,
                 expiresAt : new Date(approval.approved_at.getTime() + ONE_YEAR_MS), adminMessage : null, docsSubmitted : true };
    }
    const open = await RefRepo.findOpenReview(userId);
    if(open){
        return { status : open.external_approval_status as 'pending' | 'needs_docs', approvedAt : null, expiresAt : null,
                 adminMessage : open.external_rejection_reason, docsSubmitted : open.external_verification_docs !== null };
    }
    const rejection = await RefRepo.findLatestRejection(userId);
    if(rejection){
        return { status : 'rejected' as const, approvedAt : null, expiresAt : null,
                 adminMessage : rejection.external_rejection_reason, docsSubmitted : false };
    }
    return { status : 'none' as const, approvedAt : null, expiresAt : null, adminMessage : null, docsSubmitted : false };
}

/** U11 — GET /me/referee-identity: สถานะ + ข้อความ admin + ทัวร์ที่รอผลอยู่ (FE ทำ banner จากตรงนี้) */
export async function getMyIdentity(userId : number){
    const state = await getIdentityState(userId);
    const rows = await RefRepo.findLiveExternalRows(userId);
    return {
        ...state,
        docsRequired : state.status === 'none' || state.status === 'needs_docs'
                    || (state.status === 'pending' && !state.docsSubmitted),
        tournaments : rows.map(r => ({ id : r.tournament_id, name : r.tournament_name, tournamentRefereeId : r.tournament_referee_id,
                                       externalApprovalStatus : r.external_approval_status }))
    };
}

/** U12 — PUT /me/referee-identity/docs: ส่งครั้งเดียว ไปทุกทัวร์ที่รออยู่ → กลับเข้าคิว admin */
export async function submitMyDocs(userId : number, input : SubmitDocsInput){
    const state = await getIdentityState(userId);
    if(state.status === 'approved'){
        throw new AppError(409, 'DOCS_NOT_EXPECTED', 'คุณผ่านการยืนยันตัวตนแล้ว ไม่ต้องส่งเอกสารอีก');
    }
    const affected = await RefRepo.submitDocsForUser(userId, input.docs);
    if(affected === 0){
        throw new AppError(409, 'DOCS_NOT_EXPECTED', 'ยังไม่มีคำเชิญกรรมการภายนอกที่รอการตรวจ — ต้องตอบรับคำเชิญก่อน');
    }
    return { status : 'pending' as const, docsCount : input.docs.length, tournamentsUpdated : affected };
}

/**
 * ใช้ตอน F05 accept — ตัดสินว่าแถวใหม่ควรเริ่มที่สถานะไหน
 *   approved ≤ 1 ปี → ก็อป · มีการตรวจค้าง → เข้าร่วมการตรวจเดิม (ส่ง docs มาด้วยก็ได้ = ส่งใหม่ให้ทุกแถว)
 */
export async function resolveApprovalForAccept(
        invitation : Pick<TournamentRefereeRow, 'is_external' | 'user_id'>, docs : string[] | undefined): Promise<ExternalApproval & { joinsOpenReview : boolean }>{
    if(invitation.is_external !== 1){
        return { status : 'not_required', approvedBy : null, approvedAt : null, docs : null, reason : null, joinsOpenReview : false };
    }
    const prior = await RefRepo.findRecentApproval(invitation.user_id);
    if(prior){
        return { status : 'approved', approvedBy : prior.approved_by, approvedAt : prior.approved_at, docs : null, reason : null, joinsOpenReview : false };
    }
    const open = await RefRepo.findOpenReview(invitation.user_id);
    if(open && !docs){
        // ร่วมการตรวจที่ค้างอยู่ — สถานะและเอกสารตามแถวเดิม
        return { status : open.external_approval_status, approvedBy : null, approvedAt : null,
                 docs : open.external_verification_docs, reason : open.external_rejection_reason, joinsOpenReview : true };
    }
    return { status : 'pending', approvedBy : null, approvedAt : null, docs : docs ?? null, reason : null, joinsOpenReview : open !== null };
}
