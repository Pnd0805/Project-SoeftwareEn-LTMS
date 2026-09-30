import { describe, it, expect } from 'vitest';
import { notificationPrefsSchema } from '../notification.schema.js';
import { MUTABLE_CATEGORIES } from '../../config/notificationCategories.js';

/** OD-38 — ด่านแรกของการตั้งค่าแจ้งเตือน: รับเฉพาะหมวดที่ปิดได้จริง */
describe('notificationPrefsSchema', () => {
  it('รับหมวดเดียวได้ (PATCH ส่งเฉพาะที่เปลี่ยน)', () => {
    expect(notificationPrefsSchema.safeParse({ community: false }).success).toBe(true);
  });

  it('รับครบทุกหมวดพร้อมกันได้', () => {
    const all = Object.fromEntries(MUTABLE_CATEGORIES.map(c => [c, false]));
    expect(notificationPrefsSchema.safeParse(all).success).toBe(true);
  });

  it('★ ส่ง critical มาต้องไม่ผ่าน — หมวดนี้ปิดไม่ได้ ต้องบอกให้รู้ ไม่ใช่เงียบแล้วไม่มีผล', () => {
    expect(notificationPrefsSchema.safeParse({ critical: false }).success).toBe(false);
  });

  it('ชื่อหมวดที่ไม่รู้จักต้องไม่ผ่าน (พิมพ์ผิดแล้วคิดว่าปิดสำเร็จคือกับดัก)', () => {
    expect(notificationPrefsSchema.safeParse({ comunity: false }).success).toBe(false);
    expect(notificationPrefsSchema.safeParse({ community: false, extra: true }).success).toBe(false);
  });

  it('ค่าต้องเป็น boolean เท่านั้น', () => {
    expect(notificationPrefsSchema.safeParse({ community: 'false' }).success).toBe(false);
    expect(notificationPrefsSchema.safeParse({ community: 0 }).success).toBe(false);
  });

  it('object ว่างไม่ผ่าน — ยิงมาแล้วไม่มีอะไรเปลี่ยนคือความเข้าใจผิดของฝั่งเรียก', () => {
    expect(notificationPrefsSchema.safeParse({}).success).toBe(false);
  });
});
