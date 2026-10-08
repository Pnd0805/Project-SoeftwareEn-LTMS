import * as z from 'zod';

/**
 * ชื่อทีม — `teams.name` เป็น VARCHAR(150)
 *
 * 🔴 แก้ 7 ต.ค. 2569 (BE-08 · BE-09) — เดิม `z.string().min(1)` ทั้งสองที่
 *   BE-08: ไม่มี `.trim()` ⇒ ตั้งชื่อเป็น "   " ได้ หน้าทีมไม่มีชื่อ และข้อความแจ้งเตือน
 *          กลายเป็น "… was removed from ." (ชื่อหายไปจากประโยค)
 *   BE-09: ไม่มี `.max()` ⇒ ชื่อ 300 ตัวทะลุคอลัมน์ แล้ว mysql โยน error ดิบ ⇒ ผู้ใช้ได้ 500
 * ★ `.trim()` ของ zod **แปลงค่า** ให้ด้วย ⇒ ที่เก็บลงฐานคือชื่อที่ตัดช่องว่างแล้ว
 *   ลำดับสำคัญ: trim ก่อน แล้วจึง min/max ไม่งั้น "   " ยังนับว่ายาว 3
 */
const teamName = z.string().trim()
    .min(1 , 'กรุณาระบุชื่อทีม')
    .max(150 , 'ชื่อทีมยาวได้ไม่เกิน 150 ตัวอักษร');

export const teamSchema = z.object({
    name : teamName,
    sportTypeId : z.int('รหัสกีฬาต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกกีฬา')
});

export const updateTeamSchema = z.object({
    name : teamName.optional(),
    visibility : z.enum(['private' , 'public'] , 'visibility ต้องเป็น private หรือ public').optional(),   // มติ 20 ก.ย.
    logoKey : z.string().max(512).nullable().optional()   // ส่ง null = ล้างโลโก้ (FE-avatar-and-team-logo-uploads)
});

// ค้นหาทีม (T19)
export const searchTeamsQuerySchema = z.object({
    q : z.string().trim().max(150).optional(),
    sportTypeId : z.coerce.number().int().positive().optional(),
    visibility : z.enum(['private' , 'public']).optional()
});

// ขอเข้าร่วมทีมสาธารณะ (T20) / ปฏิเสธ (T23)
export const joinRequestSchema = z.object({
    message : z.string().trim().max(255).optional()
});
export const rejectJoinRequestSchema = z.object({
    reason : z.string().trim().max(255).optional()
});
export type JoinRequestInput = z.infer<typeof joinRequestSchema>;

export type updateTeamInput = z.infer<typeof updateTeamSchema>;
export type TeamInput = z.infer<typeof teamSchema>;


//Invitations
export const createTeamInvitedSchema = z.object({
    invitedUserId : z.int().positive('รหัสผู้ใช้ต้องเป็นจำนวนเต็มบวก')
});

export type createTeamInvited = z.infer<typeof createTeamInvitedSchema>;


//Team request

export const requestSchema = z.object({
    supportingDocs : z.array(z.string())
})


export const rejectTeamOfficial = z.object({
    reason : z.string("ใส่เหตุผลการปฎิเสธ คำขอเป็น Official Team")
});

// C3 — โอนหัวหน้าทีม (T19)
export const transferLeaderSchema = z.object({
    newLeaderId : z.int('รหัสผู้ใช้ต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกผู้รับตำแหน่ง')
});
