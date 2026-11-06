import * as z from 'zod';

// C6 — ให้คะแนนการจัดทัวร์ (ข้อความอ่านได้เฉพาะผู้จัด · คะแนนเฉลี่ยเป็นสาธารณะ)
export const organizerFeedbackSchema = z.object({
    rating: z.int('คะแนนต้องเป็นจำนวนเต็ม').min(1, 'คะแนนต้องอยู่ระหว่าง 1–5').max(5, 'คะแนนต้องอยู่ระหว่าง 1–5'),
    content: z.string().trim().max(1000, 'ข้อความยาวได้ไม่เกิน 1000 ตัวอักษร').optional(),
});
export type OrganizerFeedbackInput = z.infer<typeof organizerFeedbackSchema>;

// C6 — โหวต MVP (ผู้ถูกโหวตต้องเป็นผู้เล่นในรายชื่อลงแข่ง — ตรวจใน service)
export const mvpVoteSchema = z.object({
    userId: z.int('รหัสผู้เล่นต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกผู้เล่น'),
});
export type MvpVoteInput = z.infer<typeof mvpVoteSchema>;

// C7 — คอมเมนต์ทัวร์ (ทุกคนเห็น · คนละ 1 อัน ส่งซ้ำ = แก้)
export const tournamentCommentSchema = z.object({
    content: z.string('กรุณาพิมพ์ข้อความ').trim().min(1, 'กรุณาพิมพ์ข้อความ').max(500, 'ข้อความยาวได้ไม่เกิน 500 ตัวอักษร'),
});
export type TournamentCommentInput = z.infer<typeof tournamentCommentSchema>;

// ผู้จัดลบความเห็นต่อทัวร์ — เหตุผล "บังคับ" (มติ 23 ก.ย. ข้อ 6.3): ลบคำวิจารณ์เงียบ ๆ ไม่ได้
export const removeCommentByOrganizerSchema = z.object({
    reason: z.string('กรุณาระบุเหตุผลที่ลบ').trim().min(1, 'กรุณาระบุเหตุผลที่ลบ').max(255, 'เหตุผลยาวได้ไม่เกิน 255 ตัวอักษร'),
});
export type RemoveCommentByOrganizerInput = z.infer<typeof removeCommentByOrganizerSchema>;

// แอดมินลบ — เหตุผลบังคับ เท่ากันกับผู้จัด (แก้ 30 ก.ย. 2569 — เดิม optional เป็นความหลุด)
// แอดมินลบได้กว้างกว่าผู้จัด (ทุกทัวร์ ทุกประเปท รวมรีวิวที่วิจารณ์ผู้จัด) จิงต้องอทิบายไม่น้อยกว่า
// และเหตุผลนี้คือสิ่งเดียวที่เจ้าของความเห็นจะได้รับในแจ้งเตือน
export const removeFeedbackSchema = z.object({
    reason: z.string('กรุณาระบุเหตุผลที่ลบ').trim().min(1, 'กรุณาระบุเหตุผลที่ลบ').max(500, 'เหตุผลยาวได้ไม่เกิน 500 ตัวอักษร'),
});
export type RemoveFeedbackInput = z.infer<typeof removeFeedbackSchema>;
