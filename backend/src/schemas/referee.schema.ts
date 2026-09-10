import * as z from 'zod';

export const inviteRefereeSchema = z.object({
    userId : z.int('รหัสผู้ใช้ต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกผู้ใช้ที่ต้องการเชิญ'),
    isExternal : z.boolean('กรุณาระบุว่าเป็นกรรมการภายนอกหรือไม่')
});

export const assignRefereeSchema = z.object({
    tournamentRefereeId : z.int('รหัสกรรมการต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกกรรมการ')
});

export type InviteRefereeInput = z.infer<typeof inviteRefereeSchema>;
export type AssignRefereeInput = z.infer<typeof assignRefereeSchema>;