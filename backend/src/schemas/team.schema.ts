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