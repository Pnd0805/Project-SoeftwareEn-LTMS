import * as z from 'zod';

// C7 — คอมเมนต์ใต้แมตช์
export const commentSchema = z.object({
    content: z.string('กรุณาพิมพ์ข้อความ').trim().min(1, 'กรุณาพิมพ์ข้อความ').max(500, 'ข้อความยาวได้ไม่เกิน 500 ตัวอักษร'),
});
export type CommentInput = z.infer<typeof commentSchema>;

// C7 — Pick'em ทายผู้ชนะ (ทีมต้องอยู่ในแมตช์ — ตรวจใน service)
export const predictionSchema = z.object({
    teamId: z.int('รหัสทีมต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกทีม'),
});
export type PredictionInput = z.infer<typeof predictionSchema>;

// แอดมินลบคอมเมนต์ — เหตุผลไม่บังคับ (DELETE มักไม่มี body จึงตรวจใน controller)
export const removeCommentSchema = z.object({
    reason: z.string().trim().max(500, 'เหตุผลยาวได้ไม่เกิน 500 ตัวอักษร').optional(),
});
