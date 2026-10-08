import * as z from 'zod';
import { MUTABLE_CATEGORIES } from '../config/notificationCategories.js';
import type { MutableCategory } from '../config/notificationCategories.js';

/** สร้าง shape จากรายชื่อหมวดตัวเดียวกับที่ service ใช้ — เพิ่มหมวดใหม่ที่เดียวแล้วที่นี่ตามเอง */
const shape = Object.fromEntries(
    MUTABLE_CATEGORIES.map(c => [c, z.boolean('ค่าของหมวดต้องเป็น true หรือ false').optional()])
) as Record<MutableCategory, z.ZodOptional<z.ZodBoolean>>;

/**
 * OD-43 — ตั้งค่าแจ้งเตือนรายหมวด · PATCH ส่งมาเฉพาะหมวดที่อยากเปลี่ยน ที่ไม่ส่งมาคงค่าเดิม
 * รับเฉพาะหมวดที่ปิดได้ 6 ตัว — ส่ง `critical` หรือชื่อที่ไม่รู้จักมาจะติด 400 ตั้งแต่ชั้นนี้
 * (ไม่ปล่อยผ่านเงียบ ๆ เพราะผู้ใช้ที่กดปิดแล้วยังได้รับอยู่จะคิดว่าระบบพัง)
 */
export const notificationPrefsSchema = z.strictObject(shape)
    .refine(v => Object.keys(v).length > 0, 'กรุณาระบุอย่างน้อยหนึ่งหมวด');

export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>;
