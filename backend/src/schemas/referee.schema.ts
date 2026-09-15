import * as z from 'zod';

export const inviteRefereeSchema = z.object({
    userId : z.int('รหัสผู้ใช้ต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกผู้ใช้ที่ต้องการเชิญ'),
    isExternal : z.boolean('กรุณาระบุว่าเป็นกรรมการภายนอกหรือไม่')
});

export type InviteRefereeInput = z.infer<typeof inviteRefereeSchema>;