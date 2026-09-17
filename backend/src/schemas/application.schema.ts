import * as z from 'zod';

export const rejectApplicationSchema = z.object({
    reason: z.string().min(1, 'กรุณาระบุเหตุผลที่ปฏิเสธใบสมัคร')
});

export type RejectApplicationInput = z.infer<typeof rejectApplicationSchema>;

// Part 4 — ลืมใส่ reason ตอบ code เฉพาะแทน VALIDATION_FAILED (ส่งเป็นอาร์กิวเมนต์ที่ 2 ของ validate())
export const rejectApplicationErrorCodes = {
    reason: { code: 'APPLICATION_REJECT_REASON_REQUIRED', message: 'กรุณาระบุเหตุผลที่ปฏิเสธใบสมัคร' },
};

export const applyTournamentSchema = z.object({
    teamId: z.int('รหัสทีมต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกทีม')
});

export type ApplyTournamentInput = z.infer<typeof applyTournamentSchema>;

