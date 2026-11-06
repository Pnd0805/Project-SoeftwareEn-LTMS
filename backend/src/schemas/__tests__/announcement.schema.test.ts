import { describe, it, expect } from 'vitest';
import { createAnnouncementSchema, updateAnnouncementSchema } from '../announcement.schema.js';

describe('createAnnouncementSchema', () => {
  it('accepts a valid title and body', () => {
    const result = createAnnouncementSchema.safeParse({ title: 'Schedule update', body: 'The match moved to 10:00.' });

    expect(result.success).toBe(true);
    if (result.success) {
      // ไม่ส่ง type มา = 'general' เหมือนพฤติกรรมเดิมก่อน 27 ก.ย. ของเก่าจึงไม่พัง
      expect(result.data).toEqual({ title: 'Schedule update', body: 'The match moved to 10:00.', type: 'general' });
    }
  });

  /**
   * `announcement_type` มีในตารางพร้อม 5 ค่ามาตั้งแต่ schema แรก แต่เดิม INSERT ฮาร์ดโค้ด 'general'
   * ผู้จัดเลือกชนิดไม่ได้เลย และ FE ติดป้าย "เปลี่ยนเวลา"/"ผลการแข่งขัน" ไม่ได้ (แก้ 27 ก.ย.)
   */
  it('accepts each of the five announcement types', () => {
    for (const type of ['general', 'schedule_change', 'venue_change', 'result', 'livestream'] as const) {
      const r = createAnnouncementSchema.safeParse({ title: 'a', body: 'b', type });
      expect(r.success).toBe(true);
      expect(r.data?.type).toBe(type);
    }
  });

  it('rejects a type that is not one of the five', () => {
    expect(createAnnouncementSchema.safeParse({ title: 'a', body: 'b', type: 'urgent' }).success).toBe(false);
  });

  /**
   * 🔴 กลับด้านเมื่อ 7 ต.ค. 2569 (BE-29) — เทสเดิมชื่อ
   *   "accepts empty strings for title and body (no min-length constraint)" และยืนยันว่า `true`
   *   = ตรึง**พฤติกรรมที่เป็นบั๊ก**ไว้ ไม่ใช่ตรึงเจตนา
   *   ของจริงที่เกิดขึ้น: ประกาศเปล่าได้ 201 การ์ดเปล่าขึ้นหน้าเว็บ และยิงแจ้งเตือน
   *   "ประกาศจากผู้จัด: " ถึงหัวหน้าทีมทุกคน ซึ่งเรียกคืนไม่ได้
   * ★ ไม่ได้ลบเทส แต่เขียนใหม่ให้ยืนยันเจตนาที่ถูก — และกันช่องว่างล้วนด้วย ซึ่งเทสเดิมไม่แตะ
   */
  it.each([
    ['ว่างทั้งคู่', '', ''],
    ['หัวข้อว่าง', '', 'เนื้อหา'],
    ['เนื้อหาว่าง', 'หัวข้อ', ''],
    ['ช่องว่างล้วน', '   ', '   '],
  ])('ปฏิเสธประกาศที่ %s', (_name, title, body) => {
    expect(createAnnouncementSchema.safeParse({ title, body }).success).toBe(false);
  });

  /** ★ `.trim()` ต้อง **แปลงค่า** ให้ด้วย ไม่ใช่แค่ตรวจ — ที่เก็บลงฐานต้องไม่มีช่องว่างหัวท้าย */
  it('ตัดช่องว่างหัวท้ายออกให้', () => {
    const result = createAnnouncementSchema.safeParse({ title: '  เลื่อนเวลา  ', body: '  ย้ายไป 15:00  ' });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ title: 'เลื่อนเวลา', body: 'ย้ายไป 15:00' });
  });

  /** BE-30 — หัวข้อ 300 ตัวเคยทะลุ VARCHAR(255) แล้วผู้ใช้ได้ 500 INTERNAL_ERROR */
  it('ปฏิเสธหัวข้อที่ยาวเกินคอลัมน์ แทนที่จะปล่อยไปพังที่ฐาน', () => {
    expect(createAnnouncementSchema.safeParse({ title: 'ก'.repeat(256), body: 'ok' }).success).toBe(false);
    expect(createAnnouncementSchema.safeParse({ title: 'ก'.repeat(255), body: 'ok' }).success).toBe(true);
  });

  it('rejects a missing title', () => {
    const result = createAnnouncementSchema.safeParse({ body: 'Body only' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'title')).toBe(true);
    }
  });

  it('rejects a missing body', () => {
    const result = createAnnouncementSchema.safeParse({ title: 'Title only' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'body')).toBe(true);
    }
  });

  it('rejects a non-string title', () => {
    const result = createAnnouncementSchema.safeParse({ title: 123, body: 'Body' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'title')).toBe(true);
    }
  });

  it('rejects a non-string body', () => {
    const result = createAnnouncementSchema.safeParse({ title: 'Title', body: null });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'body')).toBe(true);
    }
  });

  it('strips unknown fields rather than rejecting them', () => {
    const result = createAnnouncementSchema.safeParse({ title: 'T', body: 'B', extra: 'ignored' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('extra');
    }
  });
});

describe('updateAnnouncementSchema', () => {
  it('accepts an empty object since both fields are optional', () => {
    const result = updateAnnouncementSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts title only', () => {
    const result = updateAnnouncementSchema.safeParse({ title: 'New title' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ title: 'New title' });
    }
  });

  it('accepts body only', () => {
    const result = updateAnnouncementSchema.safeParse({ body: 'New body' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ body: 'New body' });
    }
  });

  it('accepts both title and body', () => {
    const result = updateAnnouncementSchema.safeParse({ title: 'T', body: 'B' });
    expect(result.success).toBe(true);
  });

  it('rejects a non-string title when provided', () => {
    const result = updateAnnouncementSchema.safeParse({ title: 123 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'title')).toBe(true);
    }
  });

  it('rejects a non-string body when provided', () => {
    const result = updateAnnouncementSchema.safeParse({ body: false });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'body')).toBe(true);
    }
  });
});
