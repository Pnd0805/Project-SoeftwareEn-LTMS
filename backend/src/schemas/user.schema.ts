import * as z from 'zod';

export const updateMeSchema = z.object({
   avatarUrl : z.string().max(512).nullable().optional(),   // เดิมหลวมเกินไป (z.string().optional()) — FE-avatar-and-team-logo-uploads
   /**
    * 🔴 แก้ 7 ต.ค. 2569 (BE-20 + รายงาน FE "null cannot be cleared")
    *   เดิม `z.string().optional()` ⇒ สองปัญหาพร้อมกัน
    *   ① ไม่มีเพดาน ทั้งที่ `contact_info` เป็น VARCHAR(255) (address เป็น TEXT)
    *   ② ไม่รับ `null` ⇒ GET คืน null ได้ แต่ PATCH null ได้ 400 · FE ต้องส่ง "" แทน
    *      แล้วค่าว่างในฐานกลายเป็นสตริงว่าง ไม่ใช่ NULL ⇒ อ่าน-เขียนไม่สมมาตรกัน
    * ★ `null` = ล้างค่า · ไม่ส่งคีย์มา = ไม่แตะ — repo แยกสองกรณีนี้ด้วย `!== undefined` อยู่แล้ว
    *   (`user.repo.ts:88,93`) จึงเขียน NULL ลงฐานได้ถูกโดยไม่ต้องแก้ repo
    * ★ เพดาน address = 2,000 ตัว — **ผมเลือกเลขนี้เอง** คอลัมน์ TEXT ไม่ได้บังคับ
    */
   contactInfo : z.string().trim().max(255 , 'ข้อมูลติดต่อยาวได้ไม่เกิน 255 ตัวอักษร').nullable().optional(),
   address : z.string().trim().max(2000 , 'ที่อยู่ยาวได้ไม่เกิน 2,000 ตัวอักษร').nullable().optional(),
   // OD-46 — ปิดการแสดงสถิติในหน้าโปรไฟล์ของตัวเอง (stats · match-history · career)
   // ไม่แตะตารางคะแนน/ผลแมตช์/โหวต MVP เพราะนั่นเป็นข้อมูลของการแข่งขัน ไม่ใช่ของโปรไฟล์
   showProfileStats : z.boolean().optional()
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;