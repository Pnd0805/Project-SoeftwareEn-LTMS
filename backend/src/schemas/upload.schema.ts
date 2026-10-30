import * as z from 'zod';

/** ชนิดที่เป็น "เอกสาร" — รับ PDF ได้ */
const PDF_PURPOSES = new Set(['team_official_document', 'referee_identity']);

export const presignUploadSchema = z.object({
    // referee_identity = บัตรประชาชน/selfie ของกรรมการภายนอก (U12) — ผูกกับ user ไม่ต้องมี matchId/tournamentId
    // avatar = รูปโปรไฟล์ผูกกับ userId จาก token เสมอ ไม่รับจาก body · team_logo ต้องส่ง teamId
    // report_evidence = หลักฐานแนบคำร้องขอระงับผู้ใช้ (C2 POST /users/:id/report) — ผูกกับ userId ของผู้แจ้ง
    //   ไม่ผูกกับ target เพราะคนแจ้งอัปรูปก่อนเลือกว่าจะแจ้งใคร และ key ต้องตรวจย้อนได้ว่าใครอัป (1 ต.ค. 69)
    // team_official_document = เอกสารประกอบคำขอเป็นทีม Official (T15) — ต้องส่ง teamId · หัวหน้าทีมเท่านั้น (30 ต.ค. 69)
    purpose: z.enum(['checkin_document', 'soft_filter_document', 'referee_identity', 'dispute_evidence', 'avatar', 'team_logo', 'report_evidence', 'team_official_document']),
    // ★ PDF รับเฉพาะ "เอกสาร" (refine ข้างล่าง) — ชนิดอื่นเป็นรูปที่ต้องพรีวิว/แสดงในหน้าเว็บ
    contentType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
    matchId: z.number().optional(),
    tournamentId: z.number().optional(),
    teamId: z.number().optional(),
}).refine(
    (data) => !['checkin_document', 'dispute_evidence'].includes(data.purpose) || data.matchId !== undefined,
    { message: 'ต้องระบุ matchId เมื่อ purpose เป็น checkin_document หรือ dispute_evidence', path: ['matchId'] }
).refine(
    (data) => data.purpose !== 'soft_filter_document' || data.tournamentId !== undefined,
    { message: 'ต้องระบุ tournamentId เมื่อ purpose เป็น soft_filter_document', path: ['tournamentId'] }
).refine(
    (data) => !['team_logo', 'team_official_document'].includes(data.purpose) || data.teamId !== undefined,
    { message: 'ต้องระบุ teamId เมื่อ purpose เป็น team_logo หรือ team_official_document', path: ['teamId'] }
).refine(
    // 🔴 ห้ามเปิด PDF ให้ทุกชนิด — รูปโปรไฟล์/โลโก้/รูปบัตรตอนเช็คอิน/หลักฐานต้องเป็นรูปภาพเท่านั้น
    // 31 ต.ค. 2569 — เอกสารยืนยันตัวตนกรรมการภายนอก (referee_identity) รับ PDF ด้วย (ผู้ใช้แจ้ง "ส่งเป็น pdf ไม่ได้")
    //   คิวแอดมินแสดงเป็นลิงก์เปิดไฟล์อยู่แล้ว (IdentityDocs — ไม่ใช่รูปก็ไม่พรีวิว)
    (data) => data.contentType !== 'application/pdf' || PDF_PURPOSES.has(data.purpose),
    { message: 'รองรับเฉพาะไฟล์ JPEG และ PNG เท่านั้น', path: ['contentType'] }
);

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

// Part 4: ไฟล์ที่ไม่รองรับตอบ code เฉพาะ ไม่ใช่ VALIDATION_FAILED (ส่งเป็นอาร์กิวเมนต์ที่ 2 ของ validate())
export const presignUploadErrorCodes = {
    contentType: { code: 'UNSUPPORTED_FILE_TYPE', message: 'รองรับเฉพาะไฟล์ JPEG และ PNG เท่านั้น (เอกสารคำขอทีม Official รับ PDF ด้วย)' },
};
