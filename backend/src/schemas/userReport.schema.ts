import * as z from 'zod';

// C2 — POST /users/:id/report — reason บังคับเสมอ ไม่ว่าจะมี evidence แนบหรือไม่
export const createUserReportSchema = z.object({
    reason : z.string().trim().min(1 , 'กรุณาระบุเหตุผลที่แจ้ง'),
    evidence : z.array(z.string()).optional()
});

export const rejectUserReportSchema = z.object({
    reason : z.string().trim().min(1 , 'กรุณาระบุเหตุผลที่ปฏิเสธคำร้อง')
});

export type CreateUserReportInput = z.infer<typeof createUserReportSchema>;
