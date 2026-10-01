import * as z from 'zod';

// C2 — POST /users/:id/report — reason บังคับเสมอ ไม่ว่าจะมี evidence แนบหรือไม่
// evidence = S3 key จาก M16 purpose `report_evidence` (เพดาน 5 ไฟล์เท่ากับหลักฐานการค้านผล S03/S13)
// เดิมเป็น z.array(z.string()) เปล่า ⇒ ส่งสตริงอะไรมาก็ได้ ไม่จำกัดจำนวน (แก้ 1 ต.ค. 69)
export const createUserReportSchema = z.object({
    reason : z.string().trim().min(1 , 'กรุณาระบุเหตุผลที่แจ้ง'),
    evidence : z.array(z.string().trim().min(1).max(512)).max(5 , 'แนบหลักฐานได้ไม่เกิน 5 ไฟล์').optional()
});

export const rejectUserReportSchema = z.object({
    reason : z.string().trim().min(1 , 'กรุณาระบุเหตุผลที่ปฏิเสธคำร้อง')
});

export type CreateUserReportInput = z.infer<typeof createUserReportSchema>;
