import * as OversightRepo from '../repositories/oversight.repo.js';
import { ORG_RESOLVE_HOURS } from '../config/scoring.js';

/**
 * OD-34 — "มีอะไรค้างจนต้องมีคนเข้ามาปลดล็อกไหม"
 *
 * root อ่าน audit_logs ได้อยู่แล้ว แต่ audit log บอกว่า *เกิดอะไรขึ้นแล้ว* ไม่ได้บอกว่า
 * *อะไรยังไม่เกิด* — และเรื่องที่ค้างคือเรื่องที่ไม่มี log · ถ้าไม่มีหน้านี้ root ก็เป็น
 * บัญชีทุบกระจกฉุกเฉินที่มองไม่เห็นกระจก
 *
 * **ตั้งใจให้จืด** — ตัวเลขกับ id เท่านั้น ไม่มีเหตุผล ไม่มีหลักฐาน ไม่มีชื่อคู่กรณี
 * เส้นแบ่งคือ "เห็น" กับ "ทำ" · ใครจะกดต้องผ่าน requireAdmin_U / requireCanResolveDispute
 * ตามเดิม ซึ่ง root ไม่ผ่านทั้งคู่โดยเจตนา
 */
export async function getStalledWork(){
    const [ disputeMatchIds , complaintIds , universityAdmins ] = await Promise.all([
        OversightRepo.findStalledDisputes(),
        OversightRepo.findComplaintsAwaitingAdmin(),
        OversightRepo.countUniversityAdmins(),
    ]);

    return {
        thresholdHours : ORG_RESOLVE_HOURS,
        disputesPastDeadline    : { count : disputeMatchIds.length , matchIds : disputeMatchIds },
        complaintsAwaitingAdmin : { count : complaintIds.length , complaintIds },
        universityAdmins,
        // ไม่มีแอดมินมหาวิทยาลัยที่ใช้งานได้เลย แต่มีของค้าง = ไม่มีใครกดได้ ทางแก้คือแต่งตั้งคนใหม่
        needsAttention : universityAdmins.active === 0
                         && (disputeMatchIds.length > 0 || complaintIds.length > 0),
    };
}
