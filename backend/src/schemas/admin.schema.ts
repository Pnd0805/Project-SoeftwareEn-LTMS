import * as z from 'zod';
import { MAX_SUSPENSION_DAYS } from '../utils/suspension.js';

// ระยะเวลาระงับ (มติ 1 ต.ค. 2569) — ไม่ส่ง = ถาวรรอแอดมินปลด ซึ่งเป็นพฤติกรรมเดิมทั้งหมด
// มีเพดานเพราะ "ระงับ 3650 วัน" คือการระงับถาวรที่แอบซ่อนอยู่ ทำให้ลิสต์ของแอดมินอ่านไม่ออกว่าใครโดนถาวรจริง
const suspensionDays = z.int('ระยะเวลาระงับต้องเป็นจำนวนวันเต็ม')
                        .positive('ระยะเวลาระงับต้องมากกว่า 0 วัน')
                        .max(MAX_SUSPENSION_DAYS , `ระงับได้ไม่เกิน ${MAX_SUSPENSION_DAYS} วัน หากต้องการนานกว่านี้ให้ระงับถาวรโดยไม่ส่ง days`)
                        .optional();

// C2 — PATCH /admin/users/:id/suspend
// reason บังคับเมื่อ suspended=true เช็คใน service (ไม่ใช่ schema) — ตาม pattern ของ createOfficialRequest (docs.length===0)
export const suspendUserSchema = z.object({
    suspended : z.boolean(),
    reason : z.string().trim().optional(),
    days : suspensionDays
});

// POST /admin/user-reports/:id/approve — การอนุมัติคำร้องคือการระงับ จึงเลือกระยะเวลาได้เหมือนกัน
// .optional() ทั้งก้อน เพราะเดิม endpoint นี้ไม่รับ body เลย · ยิงแบบไม่มี body ต้องยังผ่านเหมือนเดิม
export const approveUserReportSchema = z.object({
    days : suspensionDays
}).optional();

// C2 — POST /admin/scopes
export const grantScopeSchema = z.object({
    userId : z.int('รหัสผู้ใช้ต้องเป็นจำนวนเต็ม').positive(),
    scopeType : z.enum(['faculty' , 'university_wide'] , 'scopeType ต้องเป็น faculty หรือ university_wide'),
    facultyId : z.int().positive().optional()
});

export type SuspendUserInput = z.infer<typeof suspendUserSchema>;
export type ApproveUserReportInput = z.infer<typeof approveUserReportSchema>;
export type GrantScopeInput = z.infer<typeof grantScopeSchema>;
