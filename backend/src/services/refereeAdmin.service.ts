import * as RefRepo from '../repositories/tournamentReferee.repo.js';
import * as UserRepo from '../repositories/user.repo.js';
import { AppError } from '../utils/AppError.js';
import { toUserRef } from '../mappers/user.mapper.js';
import { getIdentityState } from './refereeIdentity.service.js';
import type { AdminReviewRow } from '../repositories/tournamentReferee.repo.js';
import type { RejectExternalRefereeInput } from '../schemas/referee.schema.js';
import * as NotificationService from './notification.service.js';
import { presignAll } from './upload.service.js';

/**
 * AR01 — คิวตรวจตัวตน จัดกลุ่ม "ต่อคน" (1 รายการ = 1 user แม้รออยู่หลายทัวร์)
 *
 * 🔴 แก้ 6 ต.ค. 2569 (FE รายงานว่าเป็น blocker) — `docs` ต้องเป็น presigned URL
 *   เดิมส่ง **S3 key ดิบ** ออกไปพร้อมคอมเมนต์ว่า "FE ขอ presign เอง"
 *   แต่ไม่มี endpoint ไหนให้ FE ขอได้เลย ⇒ แอดมินตัดสินโดยไม่เห็นเอกสาร
 *   และขัดกฎที่ upload.service เขียนไว้เองว่า "ทุก response ที่มีรูปต้องเป็น presigned URL
 *   ไม่ใช่ S3 key ดิบ" — ที่นี่เป็น **ที่เดียวในโปรเจกต์** ที่ไม่ทำตาม ขณะที่อีก 7 ที่
 *   presign ฝั่ง server หมด (คำขอทีมทางการ · คำร้องผู้ใช้ · เอกสาร soft filter ·
 *   รูปเช็คอิน · หลักฐานค้านผล · หลักฐานร้องเรียน · คำร้องของตัวเอง)
 *   🔴 น่าเป็นห่วงกว่าที่อื่นด้วย เพราะเอกสารยืนยันตัวตนเป็นของที่ส่วนตัวที่สุดในระบบ
 *   (เรื่องเดียวกันเคยเกิดกับคำร้องผู้ใช้ แก้ไปแล้ว 1 ต.ค. — คอมเมนต์ยังอยู่ใน mapper)
 *
 * ★ อายุลิงก์ใช้ค่ากลางของระบบ (20 นาที) ไม่ตั้งพิเศษ — มติ 6 ต.ค. ทางเลือก ก
 *   ถ้าวันหนึ่งคิดว่ายาวเกินไป ควรลดทั้งระบบที่เดียว ไม่ใช่ทำพิเศษเฉพาะหน้านี้
 *   (หลักฐานคำร้องผู้ใช้ก็อ่อนไหวไม่ต่างกันและใช้ค่าเดียวกัน)
 * ★ ไม่เช็คก่อนว่าไฟล์ยังอยู่จริงไหม — มติ 6 ต.ค. ทางเลือก ก เหมือนอีก 7 ที่
 *   การ presign เป็นการเซ็นในเครื่องเรา ไม่ยิงไปถามที่เก็บไฟล์เลย ⇒ เปิดคิวได้เสมอ
 *   แม้ที่เก็บไฟล์ล่ม (แค่รูปไม่ขึ้น) · ถ้าเช็คทุกไฟล์จะเป็น 1 คำขอต่อไฟล์ต่อการเปิดคิว
 *   และทำให้ที่เก็บไฟล์ล่ม = คิวทั้งหน้าเปิดไม่ได้
 *   🙋 เคส "มีชื่อไฟล์แต่ไฟล์ไม่อยู่" เกิดยาก เพราะคิวลิสต์แค่แถวที่รอตรวจ
 *     และระบบล้างเอกสารทิ้งทันทีที่อนุมัติ/ขอเอกสารใหม่ (PDPA)
 */
export async function listPendingExternalReferees(){
    const rows = await RefRepo.findPendingAdminReview();
    const byUser = new Map<number, AdminReviewRow[]>();
    for(const r of rows){
        const list = byUser.get(r.user_id) ?? [];
        list.push(r);
        byUser.set(r.user_id, list);
    }
    const items = await Promise.all([...byUser.values()].map(async group => {
        const first = group[0]!;
        const docKeys = group.find(g => g.external_verification_docs)?.external_verification_docs ?? [];
        return {
            userId : first.user_id,
            user : { ...toUserRef(first), email : first.email },
            /** presigned URL อายุ 20 นาที — ไม่ใช่ S3 key · ดูเหตุผลที่หัวฟังก์ชัน */
            docs : await presignAll(docKeys),
            /**
             * 🆕 6 ต.ค. 2569 (ทางเลือก ข) — แยก "ยังไม่ส่งเอกสาร" ออกจาก "ส่งแล้ว"
             * 🔴 คิวนี้ลิสต์ทุกคนที่สถานะ pending ซึ่งรวมคนที่ **กดรับคำเชิญแล้วแต่ยังไม่ส่งเอกสาร**
             *   (resolveApprovalForAccept ตั้ง pending ให้ตั้งแต่ตอนกดรับ แม้ไม่มีเอกสารแนบ)
             *   ⇒ เดิมเขาโผล่ในคิวโดยมี docs: [] ซึ่งแยกจาก "ส่งมาแต่ไฟล์ว่าง" ไม่ได้
             * ★ ยังโชว์ในคิวต่อ (ไม่ซ่อน) เพราะแอดมินต้องเห็นว่ามีใครค้างอยู่ไม่ส่งเอกสาร
             *   แต่ด่านใน approveExternalReferee กันไม่ให้กดอนุมัติคนกลุ่มนี้
             */
            docsSubmitted : group.some(g => g.external_verification_docs !== null),
            tournaments : group.map(g => ({ id : g.tournament_id, name : g.tournament_name, tournamentRefereeId : g.tournament_referee_id })),
            submittedAt : first.created_at.toISOString()
        };
    }));
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
    /**
     * 🔴 มติ 6 ต.ค. 2569 (ทางเลือก ข) — ห้ามอนุมัติคนที่ยังไม่ส่งเอกสาร
     *   เดิมด่านนี้เช็คแค่สถานะ ⇒ คนที่กดรับคำเชิญแล้วแต่ยังไม่ส่งเอกสารเลย
     *   ก็ถูกกดอนุมัติได้ = "ยืนยันตัวตน" โดยไม่เคยเห็นเอกสารอะไร
     *   และผลนั้นใช้ได้ 1 ปี ก็อปไปทุกทัวร์ที่เขาจะเข้าต่อจากนั้น (resolveApprovalForAccept)
     *   ⇒ ไม่ใช่แค่ขั้นตอนไม่ครบ แต่ผลมันกระจายต่อเอง
     * ★ ไม่ใช่การซ่อนเขาจากคิว — คิวยังโชว์พร้อมธง `docsSubmitted` ให้แอดมินเห็นว่าใครค้างอยู่
     */
    if(!state.docsSubmitted){
        throw new AppError(409, 'DOCS_NOT_SUBMITTED',
            'ผู้ใช้นี้ยังไม่ได้ส่งเอกสารยืนยันตัวตน อนุมัติไม่ได้ — ต้องรอให้เขาส่งเอกสารก่อน');
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
