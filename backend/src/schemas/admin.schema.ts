import * as z from 'zod';

// C2 — PATCH /admin/users/:id/suspend
// reason บังคับเมื่อ suspended=true เช็คใน service (ไม่ใช่ schema) — ตาม pattern ของ createOfficialRequest (docs.length===0)
export const suspendUserSchema = z.object({
    suspended : z.boolean(),
    reason : z.string().trim().optional()
});

// C2 — POST /admin/scopes
export const grantScopeSchema = z.object({
    userId : z.int('รหัสผู้ใช้ต้องเป็นจำนวนเต็ม').positive(),
    scopeType : z.enum(['faculty' , 'university_wide'] , 'scopeType ต้องเป็น faculty หรือ university_wide'),
    facultyId : z.int().positive().optional()
});

export type SuspendUserInput = z.infer<typeof suspendUserSchema>;
export type GrantScopeInput = z.infer<typeof grantScopeSchema>;
