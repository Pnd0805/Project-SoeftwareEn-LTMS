import * as z from 'zod';

export const presignUploadSchema = z.object({
    // referee_identity = บัตรประชาชน/selfie ของกรรมการภายนอก (U12) — ผูกกับ user ไม่ต้องมี matchId/tournamentId
    purpose: z.enum(['checkin_document', 'soft_filter_document', 'referee_identity']),
    contentType: z.enum(['image/jpeg', 'image/png']),
    matchId: z.number().optional(),
    tournamentId: z.number().optional(),
}).refine(
    (data) => data.purpose !== 'checkin_document' || data.matchId !== undefined,
    { message: 'ต้องระบุ matchId เมื่อ purpose เป็น checkin_document', path: ['matchId'] }
).refine(
    (data) => data.purpose !== 'soft_filter_document' || data.tournamentId !== undefined,
    { message: 'ต้องระบุ tournamentId เมื่อ purpose เป็น soft_filter_document', path: ['tournamentId'] }
);

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

// Part 4: ไฟล์ที่ไม่รองรับตอบ code เฉพาะ ไม่ใช่ VALIDATION_FAILED (ส่งเป็นอาร์กิวเมนต์ที่ 2 ของ validate())
export const presignUploadErrorCodes = {
    contentType: { code: 'UNSUPPORTED_FILE_TYPE', message: 'รองรับเฉพาะไฟล์ JPEG และ PNG เท่านั้น' },
};
