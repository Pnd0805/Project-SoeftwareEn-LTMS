import * as RefRepo from '../repositories/tournamentReferee.repo.js';
import { AppError } from '../utils/AppError.js';
import type { ExternalApproval } from '../repositories/tournamentReferee.repo.js';
import type { SubmitDocsInput } from '../schemas/referee.schema.js';
import type { TournamentRefereeRow } from '../types/db.js';

/**
 * การยืนยันตัวตนกรรมการภายนอก — มองเป็น "สถานะของคน" แม้ DB เก็บต่อแถว
 *   none        ไม่เคยยืนยันเลย                      → ต้องส่ง docs
 *   pending     ส่งแล้ว รอ admin                     → ไม่ต้องส่งซ้ำ
 *   needs_docs  admin ขอเอกสารใหม่ (ดู adminMessage)  → ต้องส่งใหม่
 *   approved    ผ่าน ใช้ได้ถึง expiresAt (1 ปี)
 *   expired     เคยผ่าน แต่เกิน 1 ปีแล้ว              → งานเดิมทำต่อได้ · งานใหม่ต้องตรวจใหม่
 *   rejected    ไม่ผ่าน (final) — ต้องให้ ORG เชิญใหม่แล้วส่งใหม่
 *
 * ═══ กฎอายุการยืนยัน 1 ปี — มติ 6 ต.ค. 2569 ทางเลือก ค ═══
 *
 * **ทัวร์ใหม่ต้องตรวจใหม่ · ทัวร์เดิมไม่กระทบ**
 *   ตอนตอบรับคำเชิญทัวร์ใหม่ (resolveApprovalForAccept) ใช้ findRecentApproval ที่กรอง 1 ปี
 *     ⇒ ผลเก่าเกิน 1 ปีไม่ถูกก็อปมา แถวใหม่เริ่มที่ pending ⇒ ส่งเอกสารและให้แอดมินตรวจใหม่
 *   ด่านที่อนุญาตให้ "ทำงาน" (จับคู่กรรมการ · นับกรรมการตอนส่งผล · เผยแพร่ทัวร์) ดูแค่สถานะ
 *   ของแถวนั้น ไม่ดูอายุ ⇒ คนที่กำลังคุมทัวร์อยู่ทำต่อได้จนจบ ไม่ถูกถอดกลางทางเพราะวันครบรอบ
 *
 * ★ เลือกแบบนี้เพราะการถอดคนกลางทัวร์เสียหายมากกว่าที่กันได้: แมตช์ที่จัดตารางไว้จะไม่มีกรรมการ
 *   โดยไม่มีใครรู้ตัว และผู้จัดต้องหาคนแทนเฉพาะหน้า (FE ก็เสนอแนวเดียวกันใน md 6 ต.ค.)
 * ★ จึง **ไม่แตะด่านที่ตรวจ external_approval_status เลย** (tournamentReferee.repo
 *   findAssignableByTournament · matchReferee.repo ที่นับกรรมการใช้งานได้ · tournament.repo
 *   ตอน publish · migration 036) — ความต่างระหว่าง `= 'approved'` กับ
 *   `IN ('not_required','approved')` ของจุดเหล่านั้นเป็นเรื่องแยก ยังไม่มีมติ ห้ามแก้พลอย
 *
 * 🔴 สิ่งที่แก้ในรอบนี้คือ **ข้อความที่ขัดกับกฎข้างบน** ไม่ใช่พฤติกรรมของด่าน
 *   เดิมเมื่อผลเก่าเกิน 1 ปี /me/referee-identity ตอบ status 'none' + docsRequired true
 *   ⇒ จอบอกว่า "ยังไม่ผ่านการยืนยัน ต้องส่งเอกสาร" ขณะที่รายการทัวร์ข้างล่างในคำตอบเดียวกัน
 *     ยังขึ้นว่า approved และเขายังคุมแมตช์ได้จริง
 *   ⇒ และถ้ากดส่งเอกสารตามที่จอบอก PUT docs ตอบ 409 DOCS_NOT_EXPECTED (ไม่มีแถวที่รอการตรวจ)
 *     = ทางตัน ทำตามคำแนะนำของระบบแล้วไม่มีทางไป
 *   status 'expired' จึงบอกตรง ๆ ว่า "หมดอายุแล้ว แต่ยังไม่มีอะไรต้องทำจนกว่าจะมีคำเชิญใหม่"
 */
export type IdentityStatus = 'none' | 'pending' | 'needs_docs' | 'approved' | 'expired' | 'rejected';

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
    const [rejection , stale] = await Promise.all([
        RefRepo.findLatestRejection(userId),
        RefRepo.findLatestApprovalAnyAge(userId)
    ]);
    // ทั้งสองใบใช้ approved_at เป็นเวลาที่แอดมินตัดสิน ⇒ ใบที่ใหม่กว่าเป็นคำตอบ
    // (แถว approved ที่ถูกปฏิเสธทีหลังถูก UPDATE เป็น rejected ไปแล้ว — เคสที่เหลือคือปฏิเสธก่อน ผ่านทีหลัง)
    const staleAt = stale?.approved_at ?? null;
    if(rejection && (staleAt === null || (rejection.approved_at !== null && rejection.approved_at >= staleAt))){
        return { status : 'rejected' as const, approvedAt : null, expiresAt : null,
                 adminMessage : rejection.external_rejection_reason, docsSubmitted : false };
    }
    if(staleAt !== null){
        // เคยผ่าน แต่เกิน 1 ปี — expiresAt เป็นเวลาในอดีตโดยเจตนา (FE ใช้บอกว่าหมดอายุไปเมื่อไร)
        return { status : 'expired' as const, approvedAt : staleAt,
                 expiresAt : new Date(staleAt.getTime() + ONE_YEAR_MS), adminMessage : null, docsSubmitted : false };
    }
    return { status : 'none' as const, approvedAt : null, expiresAt : null, adminMessage : null, docsSubmitted : false };
}

/** U11 — GET /me/referee-identity: สถานะ + ข้อความ admin + ทัวร์ที่รอผลอยู่ (FE ทำ banner จากตรงนี้) */
export async function getMyIdentity(userId : number){
    const state = await getIdentityState(userId);
    const rows = await RefRepo.findLiveExternalRows(userId);
    return {
        ...state,
        // 'expired' ไม่ขอเอกสาร — ยังไม่มีแถวที่รอการตรวจให้ส่ง (PUT docs จะตอบ 409)
        // สิ่งที่ต้องรอคือคำเชิญทัวร์ใหม่ แล้วระบบจะขอเอกสารเองตอนนั้น
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
 * ★ นี่คือจุดเดียวที่อายุ 1 ปีมีผลจริง (findRecentApproval กรอง 1 ปี) — ผลเก่าเกิน 1 ปีไม่ถูกก็อป
 *   แถวใหม่จึงเริ่มที่ pending = ทัวร์ใหม่ต้องตรวจใหม่ ตามมติทางเลือก ค (กฎเต็มอยู่หัวไฟล์)
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
