import * as z from 'zod';

export const scheduleMatchSchema = z.object({
    scheduledTime: z.iso.datetime('รูปแบบวันเวลาไม่ถูกต้อง'),
    venue: z.string().min(1, 'กรุณาระบุสนามแข่งขัน'),
});

export type ScheduleMatchInput = z.infer<typeof scheduleMatchSchema>;

export const rejectCheckinSchema = z.object({
    reason: z.string().min(1, 'กรุณาระบุเหตุผลที่ปฏิเสธการยืนยันตัวตน'),
});

export type RejectCheckinInput = z.infer<typeof rejectCheckinSchema>;
