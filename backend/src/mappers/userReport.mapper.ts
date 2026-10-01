import type { getUserReport } from "../repositories/userReport.repo.js";
import type { UserRefDto } from "./user.mapper.js";
import { toPublicImageUrl } from "../utils/imageUrl.js";

export type userReportDto = {
    id : number,
    reporter : UserRefDto,
    target : UserRefDto & { isAdmin : boolean },
    reason : string,
    /**
     * หลักฐานที่ผู้แจ้งแนบมา — **presigned URL เสมอ ไม่ใช่ S3 key ดิบ** (กฎรวม Part 3 ข้อ 11)
     *
     * เดิม mapper ส่ง `row.evidence` ออกไปตรงๆ ซึ่งเป็น key ในถัง ⇒ FE เอาไปแสดงเป็นรูปไม่ได้
     * แอดมินจึงอนุมัติ/ปฏิเสธคำร้องขอระงับผู้ใช้โดยไม่เคยเห็นหลักฐานที่เป็นเหตุผลของคำร้อง
     * (รูปแบบเดียวกับ supporting_docs ของคิวทีม Official ที่แก้ไป 27 ก.ย.)
     *
     * การเซ็นลิงก์ต้อง await ⇒ รับมาเป็นอาร์กิวเมนต์ ไม่ให้ mapper เรียก service (ชั้นล่างห้ามพึ่งชั้นบน)
     * และตั้งใจให้เป็นพารามิเตอร์ **บังคับ** ไม่มีค่า default เพราะ default = [] จะทำให้ endpoint ใหม่
     * ที่ลืมส่งเข้ามาเงียบๆ กลายเป็น "ไม่มีหลักฐาน" แทนที่จะพังตอน tsc
     */
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

export function toUserReportDto(row : getUserReport , evidence : string[]) : userReportDto{
    return {
        id : row.user_report_id,
        reporter : { id : row.reporter_id , fullName : row.reporter_name , avatarUrl : toPublicImageUrl(row.reporter_avatar_key) },
        target : { id : row.target_id , fullName : row.target_name , avatarUrl : toPublicImageUrl(row.target_avatar_key) , isAdmin : row.target_is_admin === 1 },
        reason : row.reason,
        evidence,
        status : row.user_report_status,
        createdAt : row.created_at.toISOString(),
        reviewedBy : row.reviewed_by,
        reviewedByName : row.reviewed_by_name,
        reviewedAt : row.reviewed_at?.toISOString() ?? null,
        rejectionReason : row.rejection_reason
    };
}
