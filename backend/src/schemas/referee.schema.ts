import * as z from 'zod';

const matchIdList = z.array(z.int('รหัสแมตช์ต้องเป็นจำนวนเต็ม').positive('รหัสแมตช์ไม่ถูกต้อง'), 'matchIds ต้องเป็นรายการรหัสแมตช์');

export const inviteRefereeSchema = z.object({
    userId : z.int('รหัสผู้ใช้ต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกผู้ใช้ที่ต้องการเชิญ'),
    /**
     * 🔴 แก้ 7 ต.ค. 2569 (BE-23) — เลิก **บังคับ** ส่ง
     *   มติ 6 ต.ค. ให้ server ตัดสินจากโดเมนอีเมลเอง (ดู referee.service.ts) ⇒ ค่านี้ไม่ถูกใช้แล้ว
     *   แต่ยัง required อยู่ ⇒ ไม่ส่งมาได้ VALIDATION_FAILED และส่งมาผิดก็ไม่มีผล
     *   = ช่องที่บังคับกรอกแต่กรอกอะไรก็ได้ ซึ่งแย่กว่าไม่มีช่อง
     * ★ ยังรับฟิลด์ต่อ (ไม่ breaking สำหรับ FE ที่ยังส่งมา) แต่ server ไม่สนค่า
     */
    isExternal : z.boolean('isExternal ต้องเป็น true หรือ false').optional(),
    /** แมตช์ที่เสนอให้คุม — ไม่ส่ง/ว่าง = เชิญเข้า pool เฉย ๆ */
    matchIds : matchIdList.default([])
});

const docList = z.array(z.string('รหัสเอกสารต้องเป็นข้อความ').min(1).max(255), 'docs ต้องเป็นรายการรหัสไฟล์')
    .min(1, 'ต้องแนบเอกสารอย่างน้อย 1 ไฟล์').max(5, 'แนบได้ไม่เกิน 5 ไฟล์');

/**
 * F05 — ref เลือกรับบางแมตช์ได้ — ไม่ส่ง body/ว่าง = เข้าทัวร์แบบ pool ไม่รับแมตช์ใด
 * docs = S3 key จาก M16 presign (คนนอกที่ยังไม่เคยผ่านการตรวจใน 1 ปี)
 */
export const acceptInvitationSchema = z.object({
    matchIds : matchIdList.default([]),
    docs : docList.optional()
}).default({ matchIds : [] });

/** F15 — ส่ง/แก้เอกสารระหว่างรอ admin */
export const submitDocsSchema = z.object({ docs : docList });

/** AR03 — admin ปฏิเสธ/ถอน ต้องมีเหตุผล (แบบเดียวกับ T18) */
export const rejectExternalRefereeSchema = z.object({
    reason : z.string('ใส่เหตุผลการปฏิเสธ').trim().min(1, 'ใส่เหตุผลการปฏิเสธ').max(500)
});

export type InviteRefereeInput = z.infer<typeof inviteRefereeSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type SubmitDocsInput = z.infer<typeof submitDocsSchema>;
export type RejectExternalRefereeInput = z.infer<typeof rejectExternalRefereeSchema>;
