import * as z from 'zod';

// C7 — Pick'em ทายผู้ชนะ (ทีมต้องอยู่ในแมตช์ — ตรวจใน service)
export const predictionSchema = z.object({
    teamId: z.int('รหัสทีมต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกทีม'),
});
export type PredictionInput = z.infer<typeof predictionSchema>;
