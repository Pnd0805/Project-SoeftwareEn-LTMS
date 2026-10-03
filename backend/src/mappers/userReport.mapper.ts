import type { getUserReport } from "../repositories/userReport.repo.js";
import type { UserRefDto } from "./user.mapper.js";
import { toPublicImageUrl } from "../utils/imageUrl.js";

export type userReportDto = {
    id : number,
    reporter : UserRefDto,
    target : UserRefDto & { isAdmin : boolean },
    reason : string,
    evidence : string[],
    status : 'pending' | 'approved' | 'rejected',
    createdAt : string,
    // ผลการพิจารณา (เพิ่ม 30 ก.ย. 2569) — null ทั้งชุดตราบใดที่ยัง pending
    // เดิม `rejection_reason` ถูกบังคับให้แอดมินพิมพ์ เก็บลงฐาน แล้ว **ไม่มี endpoint ไหนคืนออกมาเลย**
    // แอดมินคนถัดไปจึงไม่มีทางรู้ว่าเรื่องคล้ายกันเคยถูกปฏิเสธเพราะอะไร และตัดสินสวนกันเองได้
    // คิวนี้เป็นของแอดมินอยู่แล้ว (requireAdmin) จึงไม่มีอะไรรั่วออกนอก — ผู้แจ้งไม่ได้เห็นชุดนี้
    reviewedBy : number | null,
    reviewedByName : string | null,
    reviewedAt : string | null,
    rejectionReason : string | null
};

// evidence เป็นหลักฐานส่วนตัว (รูปบัตร/แชต ฯลฯ) ไม่ใช่ของสาธารณะแบบ avatar/โลโก้ — ต้อง presign มาให้แล้วจาก
// service (mapper เป็น sync, presign เป็น async) เหมือน supporting_docs ของ getAllOfficialRequest — ห้ามใช้ toPublicImageUrl ที่นี่
export function toUserReportDto(row : getUserReport , presignedEvidence : string[]) : userReportDto{
    return {
        id : row.user_report_id,
        reporter : { id : row.reporter_id , fullName : row.reporter_name , avatarUrl : toPublicImageUrl(row.reporter_avatar_key) },
        target : { id : row.target_id , fullName : row.target_name , avatarUrl : toPublicImageUrl(row.target_avatar_key) , isAdmin : row.target_is_admin === 1 },
        reason : row.reason,
        evidence : presignedEvidence,
        status : row.user_report_status,
        createdAt : row.created_at.toISOString(),
        reviewedBy : row.reviewed_by,
        reviewedByName : row.reviewed_by_name,
        reviewedAt : row.reviewed_at?.toISOString() ?? null,
        rejectionReason : row.rejection_reason
    };
}
