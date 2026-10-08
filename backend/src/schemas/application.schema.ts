import * as z from 'zod';

export const rejectApplicationSchema = z.object({
    reason: z.string().min(1, 'กรุณาระบุเหตุผลที่ปฏิเสธใบสมัคร')
});

export type RejectApplicationInput = z.infer<typeof rejectApplicationSchema>;

// Part 4 — ลืมใส่ reason ตอบ code เฉพาะแทน VALIDATION_FAILED (ส่งเป็นอาร์กิวเมนต์ที่ 2 ของ validate())
export const rejectApplicationErrorCodes = {
    reason: { code: 'APPLICATION_REJECT_REASON_REQUIRED', message: 'กรุณาระบุเหตุผลที่ปฏิเสธใบสมัคร' },
};

// P01 (มติทีม 19 ก.ย. 2569): ต้องส่งรายชื่อผู้เล่นที่ลงแข่งมาด้วย — จำนวนเทียบ min/max ของกีฬาใน service
export const applyTournamentSchema = z.object({
    teamId: z.int('รหัสทีมต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกทีม'),
    playerIds: z.array(z.int('รหัสผู้เล่นต้องเป็นจำนวนเต็ม').positive('รหัสผู้เล่นไม่ถูกต้อง'), 'กรุณาเลือกผู้เล่นที่ลงแข่ง')
        .min(1, 'กรุณาเลือกผู้เล่นที่ลงแข่งอย่างน้อย 1 คน')
        .refine(ids => new Set(ids).size === ids.length, 'มีรายชื่อผู้เล่นซ้ำกัน'),
    softFilterDocuments: z.array(z.string().trim().min(1).max(512), 'รายการเอกสาร soft filter ไม่ถูกต้อง')
        .max(10, 'แนบเอกสาร soft filter ได้สูงสุด 10 ไฟล์')
        .refine(keys => new Set(keys).size === keys.length, 'มีเอกสาร soft filter ซ้ำกัน')
        .optional()
});

export type ApplyTournamentInput = z.infer<typeof applyTournamentSchema>;

