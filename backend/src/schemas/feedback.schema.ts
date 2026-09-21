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

// แอดมินลบ — เหตุผลไม่บังคับ แต่เก็บลง audit ถ้ามี
export const removeFeedbackSchema = z.object({
    reason: z.string().trim().max(500, 'เหตุผลยาวได้ไม่เกิน 500 ตัวอักษร').optional(),
});
export type RemoveFeedbackInput = z.infer<typeof removeFeedbackSchema>;
