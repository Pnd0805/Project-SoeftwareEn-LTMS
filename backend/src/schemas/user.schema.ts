import * as z from 'zod';

export const updateMeSchema = z.object({
   avatarUrl : z.string().max(512).nullable().optional(),   // เดิมหลวมเกินไป (z.string().optional()) — FE-avatar-and-team-logo-uploads
   contactInfo : z.string().optional(),
   address : z.string().optional(),
   // OD-46 — ปิดการแสดงสถิติในหน้าโปรไฟล์ของตัวเอง (stats · match-history · career)
   // ไม่แตะตารางคะแนน/ผลแมตช์/โหวต MVP เพราะนั่นเป็นข้อมูลของการแข่งขัน ไม่ใช่ของโปรไฟล์
   showProfileStats : z.boolean().optional()
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;