import * as z from 'zod';

export const rejectApplicationSchema = z.object({
    reason: z.string().min(1, 'กรุณาระบุเหตุผลที่ปฏิเสธใบสมัคร')
});

export type RejectApplicationInput = z.infer<typeof rejectApplicationSchema>;

export const applyTournamentSchema = z.object({
    teamId: z.int('รหัสทีมต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกทีม')
});

export type ApplyTournamentInput = z.infer<typeof applyTournamentSchema>;

