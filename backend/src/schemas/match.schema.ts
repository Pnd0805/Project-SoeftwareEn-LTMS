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

export const createBracketSchema = z.object({
    seedingMethod: z.enum(['random', 'manual']),
    manualSeeds: z.array(z.number()).optional(),
}).refine(
    (data) => data.seedingMethod !== 'manual' || (data.manualSeeds !== undefined && data.manualSeeds.length > 0),
    { message: 'ต้องระบุ manualSeeds เมื่อเลือก seedingMethod เป็น manual', path: ['manualSeeds'] }
);

export type CreateBracketInput = z.infer<typeof createBracketSchema>;
