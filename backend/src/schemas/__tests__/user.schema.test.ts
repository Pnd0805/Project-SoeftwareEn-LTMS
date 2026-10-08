import { describe, it, expect } from 'vitest';
import { updateMeSchema } from '../user.schema.js';

describe('updateMeSchema', () => {
  it('accepts an empty object since every field is optional', () => {
    const result = updateMeSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts all fields provided as strings', () => {
    const result = updateMeSchema.safeParse({
      avatarUrl: 'https://example.com/avatar.png',
      contactInfo: '08x-xxx-xxxx',
      address: '123 ถนนสุขุมวิท',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a subset of fields', () => {
    const result = updateMeSchema.safeParse({ contactInfo: 'line: somchai' });
    expect(result.success).toBe(true);
  });

  it('rejects avatarUrl when it is not a string', () => {
    const result = updateMeSchema.safeParse({ avatarUrl: 123 });
    expect(result.success).toBe(false);
  });

  it('rejects contactInfo when it is not a string', () => {
    const result = updateMeSchema.safeParse({ contactInfo: true });
    expect(result.success).toBe(false);
  });

  it('rejects address when it is not a string', () => {
    const result = updateMeSchema.safeParse({ address: {} });
    expect(result.success).toBe(false);
  });

  it('ignores unrelated extra keys without validation error by default zod behavior', () => {
    // Note: zod objects strip unknown keys by default (non-strict mode).
    const result = updateMeSchema.safeParse({ address: 'ok', unrelatedField: 'ignored' });
    expect(result.success).toBe(true);
  });
  /** OD-46 — สวิตช์ปิดการแสดงสถิติในโปรไฟล์ (U02 เป็นทางเดียวที่แก้ได้) */
  it('OD-46 — รับ showProfileStats เป็น boolean เท่านั้น', () => {
    expect(updateMeSchema.safeParse({ showProfileStats: false }).success).toBe(true);
    expect(updateMeSchema.safeParse({ showProfileStats: true }).success).toBe(true);
    expect(updateMeSchema.safeParse({ showProfileStats: 0 }).success).toBe(false);
    expect(updateMeSchema.safeParse({ showProfileStats: 'false' }).success).toBe(false);
    expect(updateMeSchema.safeParse({ showProfileStats: null }).success).toBe(false);
  });
});

/**
 * 🆕 การแก้ 7 ต.ค. 2569 (BE-20 + รายงาน FE "null cannot be cleared")
 *
 * เดิม `z.string().optional()` ⇒ อ่านกับเขียนไม่สมมาตร: GET คืน `null` ได้
 * แต่ PATCH `null` ได้ 400 ⇒ FE ต้องส่ง `""` แล้วค่าว่างในฐานกลายเป็นสตริงว่าง ไม่ใช่ NULL
 * ★ `null` = ล้างค่า · ไม่ส่งคีย์ = ไม่แตะ — สองอย่างนี้ต้องแยกกันได้ เพราะ repo แยกด้วย
 *   `!== undefined` (user.repo.ts:88,93) ⇒ ถ้า schema ยุบ null เป็น undefined จะล้างค่าไม่ได้เลย
 */
describe('updateMeSchema — ล้างค่าด้วย null และเพดานความยาว (BE-20)', () => {
  it.each(['contactInfo', 'address'])('ส่ง null ให้ %s ได้ และยังเป็น null หลัง parse', (field) => {
    const result = updateMeSchema.safeParse({ [field]: null });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty(field, null);
  });

  /** ★ ไม่ส่งคีย์มาเลย ต้องไม่กลายเป็น null — ไม่งั้น PATCH ช่องเดียวจะล้างช่องอื่นทิ้ง */
  it('ไม่ส่งคีย์มา = ไม่มีคีย์นั้นในผล (ไม่ใช่ null)', () => {
    const result = updateMeSchema.safeParse({ contactInfo: 'line: somchai' });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('address');
  });

  it('ปฏิเสธ contactInfo ที่ยาวเกินคอลัมน์ (255)', () => {
    expect(updateMeSchema.safeParse({ contactInfo: 'ก'.repeat(256) }).success).toBe(false);
    expect(updateMeSchema.safeParse({ contactInfo: 'ก'.repeat(255) }).success).toBe(true);
  });

  it('ปฏิเสธที่อยู่ที่ยาวเกินเพดาน (2,000)', () => {
    expect(updateMeSchema.safeParse({ address: 'ก'.repeat(2001) }).success).toBe(false);
    expect(updateMeSchema.safeParse({ address: 'ก'.repeat(2000) }).success).toBe(true);
  });
});
