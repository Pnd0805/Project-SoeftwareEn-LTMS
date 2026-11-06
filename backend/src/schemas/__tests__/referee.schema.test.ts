import { describe, it, expect } from 'vitest';
import { inviteRefereeSchema } from '../referee.schema.js';

describe('inviteRefereeSchema', () => {
  it('accepts a valid userId with isExternal true', () => {
    const result = inviteRefereeSchema.safeParse({ userId: 1, isExternal: true });
    expect(result.success).toBe(true);
  });

  it('accepts a valid userId with isExternal false', () => {
    const result = inviteRefereeSchema.safeParse({ userId: 1, isExternal: false });
    expect(result.success).toBe(true);
  });

  it('rejects userId 0', () => {
    const result = inviteRefereeSchema.safeParse({ userId: 0, isExternal: true });
    expect(result.success).toBe(false);
  });

  it('rejects a negative userId', () => {
    const result = inviteRefereeSchema.safeParse({ userId: -3, isExternal: true });
    expect(result.success).toBe(false);
  });

  it('rejects a decimal userId', () => {
    const result = inviteRefereeSchema.safeParse({ userId: 1.5, isExternal: true });
    expect(result.success).toBe(false);
  });

  /**
   * 🔴 กลับด้านเมื่อ 7 ต.ค. 2569 (BE-23) — เทสเดิมชื่อ "rejects a missing isExternal field"
   *   มติ 6 ต.ค. ให้ server ตัดสินจากโดเมนอีเมลเอง ⇒ ค่านี้ไม่ถูกใช้แล้ว
   *   แต่ยังบังคับส่ง ⇒ ไม่ส่งมาได้ VALIDATION_FAILED และส่งมาผิดก็ไม่มีผล
   *   = ช่องบังคับกรอกที่กรอกอะไรก็ได้ ซึ่งแย่กว่าไม่มีช่อง
   * ★ ยังรับฟิลด์ต่อถ้า FE ส่งมา (ไม่ breaking) — แต่ไม่บังคับ และ service ไม่สนค่า
   */
  it('ไม่ส่ง isExternal มาก็ผ่าน (server ตัดสินจากโดเมนอีเมลเอง — มติ 6 ต.ค.)', () => {
    expect(inviteRefereeSchema.safeParse({ userId: 1 }).success).toBe(true);
  });

  it('ส่ง isExternal มาก็ยังรับ (ไม่ breaking) แต่ต้องเป็น boolean', () => {
    expect(inviteRefereeSchema.safeParse({ userId: 1, isExternal: true }).success).toBe(true);
    expect(inviteRefereeSchema.safeParse({ userId: 1, isExternal: 'yes' }).success).toBe(false);
  });

  it('rejects a non-boolean isExternal value', () => {
    const result = inviteRefereeSchema.safeParse({ userId: 1, isExternal: 'yes' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing userId field', () => {
    const result = inviteRefereeSchema.safeParse({ isExternal: true });
    expect(result.success).toBe(false);
  });
});
