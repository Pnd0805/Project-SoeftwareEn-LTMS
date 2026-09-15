import * as z from 'zod';

export const livestreamSchema = z.object({
    youtubeUrl : z.string()
});

export const scheduleMatchSchema = z.object({
    scheduledTime: z.iso.datetime('รูปแบบวันเวลาไม่ถูกต้อง'),
    // เวลาจบ — ใช้เช็คแมตช์ซ้อน (สนาม/ทีม/กรรมการ) และลำดับสาย (GUIDE/11 §4.1)
    scheduledEndTime: z.iso.datetime('รูปแบบวันเวลาจบไม่ถูกต้อง'),
    venue: z.string().min(1, 'กรุณาระบุสนามแข่งขัน'),
}).refine(
    (d) => new Date(d.scheduledEndTime) > new Date(d.scheduledTime),
    { message: 'เวลาจบต้องหลังเวลาเริ่ม', path: ['scheduledEndTime'] }
);

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

export const submitCheckinSchema = z.discriminatedUnion('method', [
    z.object({
        method: z.literal('qr_onsite'),
        qrPayload: z.string().min(1, 'กรุณาระบุ qrPayload'),
    }),
    z.object({
        method: z.literal('photo_online'),
        documentType: z.enum(['student_id', 'national_id']),
        documentS3Key: z.string().min(1, 'กรุณาระบุ documentS3Key'),
    }),
]);

export type SubmitCheckinInput = z.infer<typeof submitCheckinSchema>;
