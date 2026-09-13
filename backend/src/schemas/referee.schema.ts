import * as z from 'zod';

const matchIdList = z.array(z.int('รหัสแมตช์ต้องเป็นจำนวนเต็ม').positive('รหัสแมตช์ไม่ถูกต้อง'), 'matchIds ต้องเป็นรายการรหัสแมตช์');

export const inviteRefereeSchema = z.object({
    userId : z.int('รหัสผู้ใช้ต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกผู้ใช้ที่ต้องการเชิญ'),
    isExternal : z.boolean('กรุณาระบุว่าเป็นกรรมการภายนอกหรือไม่'),
    /** แมตช์ที่เสนอให้คุม — ไม่ส่ง/ว่าง = เชิญเข้า pool เฉย ๆ */
    matchIds : matchIdList.default([])
});

/** F05 — ref เลือกรับบางแมตช์ได้ — ไม่ส่ง body/ว่าง = เข้าทัวร์แบบ pool ไม่รับแมตช์ใด */
export const acceptInvitationSchema = z.object({
    matchIds : matchIdList.default([])
}).default({ matchIds : [] });

export type InviteRefereeInput = z.infer<typeof inviteRefereeSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
