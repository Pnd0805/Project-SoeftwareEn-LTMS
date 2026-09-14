import * as z from 'zod';

export const teamSchema = z.object({
    name : z.string().min(1 , 'กรุณาระบุชื่อทีม'),
    sportTypeId : z.int('รหัสกีฬาต้องเป็นจำนวนเต็ม').positive('กรุณาเลือกกีฬา')
});

export const updateTeamSchema = z.object({
    name : z.string().min(1 , 'กรุณาใส่ชื่อทีม').optional()
});

export type updateTeamInput = z.infer<typeof updateTeamSchema>;
export type TeamInput = z.infer<typeof teamSchema>;


//-- Member
export const updateMemberschema = z.object({
    position : z.enum(['starter' , 'substitute'] , 'position ต้องเป็น starter หรือ substitute')
});

export type updateMember = z.infer<typeof updateMemberschema>;


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
