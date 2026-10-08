import * as z from 'zod';

// B8 — รหัสห้องเกมของแมตช์ออนไลน์ · null = ล้าง
export const roomCodeSchema = z.object({
    roomCode : z.string().trim().min(1).max(50).nullable()
});

export const livestreamSchema = z.object({
    youtubeUrl : z.string().nullable()   // null = ล้างลิงก์ (FE gaps 19 ก.ย.)
});

// scheduledEndTime บังคับ — กรรมการ (F01/F05/FR) และการเช็คทับซ้อนต้องใช้ช่วงเวลา [เริ่ม, จบ)
// B9 (รายงาน FE 19 ก.ย.): ส่งเฉพาะฟิลด์ที่จะแก้ก็ได้ (แค่สนาม / แค่เวลา) — service เติมค่าเดิมของแมตช์ให้
// ครั้งแรกที่ยังไม่เคยตั้ง ต้องครบทั้งสามอยู่ดี (service ตอบ 400 SCHEDULE_INCOMPLETE)
// ★ อย่าสับสนกับ 409 MATCH_NOT_SCHEDULED ของด่านเปิดเช็คอิน/เริ่มแข่ง — คนละเรื่อง
export const scheduleMatchSchema = z.object({
    // รับทั้ง Z และ +07:00 ให้ตรงกับ C01 (FE gaps 19 ก.ย.)
    scheduledTime: z.iso.datetime({ offset: true, message: 'รูปแบบวันเวลาไม่ถูกต้อง' }).optional(),
    // เวลาจบ — ใช้เช็คแมตช์ซ้อน (สนาม/ทีม/กรรมการ) และลำดับสาย (GUIDE/11 §4.1)
    scheduledEndTime: z.iso.datetime({ offset: true, message: 'รูปแบบวันเวลาจบไม่ถูกต้อง' }).optional(),
    venue: z.string().min(1, 'กรุณาระบุสนามแข่งขัน').optional(),
}).refine(
    (d) => d.scheduledTime !== undefined || d.scheduledEndTime !== undefined || d.venue !== undefined,
    { message: 'ต้องระบุอย่างน้อยหนึ่งอย่าง: เวลาเริ่ม เวลาจบ หรือสนาม', path: ['scheduledTime'] }
).refine(
    (d) => d.scheduledTime === undefined || d.scheduledEndTime === undefined
        || new Date(d.scheduledEndTime) > new Date(d.scheduledTime),
    { message: 'เวลาจบต้องหลังเวลาเริ่ม', path: ['scheduledEndTime'] }
);

export type ScheduleMatchInput = z.infer<typeof scheduleMatchSchema>;

export const rejectCheckinSchema = z.object({
    reason: z.string().min(1, 'กรุณาระบุเหตุผลที่ปฏิเสธการยืนยันตัวตน'),
});

export type RejectCheckinInput = z.infer<typeof rejectCheckinSchema>;

// Part 4 — ลืมใส่ reason ตอบ code เฉพาะแทน VALIDATION_FAILED (ส่งเป็นอาร์กิวเมนต์ที่ 2 ของ validate())
export const rejectCheckinErrorCodes = {
    reason: { code: 'CHECKIN_REJECT_REASON_REQUIRED', message: 'กรุณาระบุเหตุผลที่ปฏิเสธการยืนยันตัวตน' },
};

export const createBracketSchema = z.object({
    seedingMethod: z.enum(['random', 'manual']),
    manualSeeds: z.array(z.number()).optional(),
    // FE-replace-existing-bracket-atomic (21 ก.ย.): true = ลบสายเดิมแล้วจับใหม่จากทีม approved ปัจจุบัน ในทรานแซกชันเดียว
    replace: z.boolean().optional(),
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

// M19 — กรรมการเช็คอินแทนผู้เล่น (กล้อง/เน็ตพัง, UC-04 E2b) → status 'exception' นับว่าเช็คอินแล้ว
export const manualCheckinSchema = z.object({
    userId: z.int().positive(),
    note: z.string().trim().max(255).optional(),
});

export type ManualCheckinInput = z.infer<typeof manualCheckinSchema>;

/**
 * M10c — ยกเลิกแมตช์กลางคัน (ฝนตก ไฟดับ คนเจ็บหนัก) · มติ 27 ก.ย.
 * เหตุผลบังคับ เพราะการยกเลิกทำให้ทั้งสองทีมต้องกลับมาแข่งใหม่ ต้องตรวจย้อนได้ว่าสั่งเพราะอะไร
 */
export const abandonMatchSchema = z.object({
    reason: z.string().trim().min(1, 'กรุณาระบุเหตุผลที่ยกเลิกการแข่งขัน').max(500, 'เหตุผลยาวได้ไม่เกิน 500 ตัวอักษร'),
});
export type AbandonMatchInput = z.infer<typeof abandonMatchSchema>;

/**
 * 🆕 BO-N (มติ 5 ต.ค.) — ตั้งรูปแบบ "แข่งหลายรอบ" ของแมตช์เดียว หรือของทัวร์ทั้งทัวร์
 *
 * ★ `null` เป็นค่าที่ **ส่งมาได้** และมีความหมาย: "กีฬานี้ไม่ได้แข่งเป็นรอบ" ⇒ ปลดเพดาน
 *   ⇒ ใช้ .nullable() ไม่ใช่ .optional() — ต้องแยก "ส่ง null มาเพื่อปลด" ออกจาก "ไม่ส่งคีย์มา"
 *     ถ้าเป็น optional การปลดเพดานจะทำไม่ได้เลย
 * 🔴 ค่าที่รับได้ต้องตรงกับ CHECK ในฐาน (migration 044) และ BEST_OF_VALUES ใน utils/matchFormat
 */
export const matchFormatSchema = z.object({
    bestOf: z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(7), z.null()],
                    'รูปแบบต้องเป็น 1, 3, 5, 7 (BO1/BO3/BO5/BO7) หรือ null ถ้าไม่ใช่กีฬาที่แข่งเป็นรอบ'),
});
export type MatchFormatInput = z.infer<typeof matchFormatSchema>;
