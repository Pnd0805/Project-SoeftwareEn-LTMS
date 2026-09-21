import * as z from 'zod';

export const teamSchema = z.object({
    name : z.string().min(1 , 'กรุณาระบุชื่อทีม'),
    sportTypeId : z.int('รหัสกีฬาต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกกีฬา')
});

export const updateTeamSchema = z.object({
    name : z.string().min(1 , 'กรุณาใส่ชื่อทีม').optional(),
    visibility : z.enum(['private' , 'public'] , 'visibility ต้องเป็น private หรือ public').optional()   // มติ 20 ก.ย.
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
