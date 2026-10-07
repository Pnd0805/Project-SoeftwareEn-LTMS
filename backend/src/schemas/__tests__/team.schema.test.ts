import { describe, it, expect } from 'vitest';
import {
  teamSchema,
  updateTeamSchema,
  createTeamInvitedSchema,
  requestSchema,
  rejectTeamOfficial,
} from '../team.schema.js';

describe('teamSchema', () => {
  it('accepts a valid name and sportTypeId', () => {
    const result = teamSchema.safeParse({ name: 'Dream Team', sportTypeId: 1 });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = teamSchema.safeParse({ name: '', sportTypeId: 1 });
    expect(result.success).toBe(false);
  });

  it('rejects a missing name', () => {
    const result = teamSchema.safeParse({ sportTypeId: 1 });
    expect(result.success).toBe(false);
  });

  it('rejects sportTypeId 0', () => {
    const result = teamSchema.safeParse({ name: 'Dream Team', sportTypeId: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative sportTypeId', () => {
    const result = teamSchema.safeParse({ name: 'Dream Team', sportTypeId: -2 });
    expect(result.success).toBe(false);
  });

  it('rejects a decimal sportTypeId', () => {
    const result = teamSchema.safeParse({ name: 'Dream Team', sportTypeId: 1.2 });
    expect(result.success).toBe(false);
  });
});

describe('updateTeamSchema', () => {
  it('accepts a valid non-empty name', () => {
    const result = updateTeamSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty object since name is optional', () => {
    const result = updateTeamSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects an empty string name when the field is provided', () => {
    const result = updateTeamSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

describe('createTeamInvitedSchema', () => {
  it('accepts a positive integer invitedUserId', () => {
    const result = createTeamInvitedSchema.safeParse({ invitedUserId: 4 });
    expect(result.success).toBe(true);
  });

  it('rejects invitedUserId 0', () => {
    const result = createTeamInvitedSchema.safeParse({ invitedUserId: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative invitedUserId', () => {
    const result = createTeamInvitedSchema.safeParse({ invitedUserId: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a decimal invitedUserId', () => {
    const result = createTeamInvitedSchema.safeParse({ invitedUserId: 3.3 });
    expect(result.success).toBe(false);
  });
});

describe('requestSchema', () => {
  it('accepts an array of strings', () => {
    const result = requestSchema.safeParse({ supportingDocs: ['doc1.pdf', 'doc2.pdf'] });
    expect(result.success).toBe(true);
  });

  it('accepts an empty array', () => {
    const result = requestSchema.safeParse({ supportingDocs: [] });
    expect(result.success).toBe(true);
  });

  it('rejects an array containing a non-string element', () => {
    const result = requestSchema.safeParse({ supportingDocs: ['doc1.pdf', 123] });
    expect(result.success).toBe(false);
  });

  it('rejects a missing supportingDocs field', () => {
    const result = requestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects supportingDocs that is not an array', () => {
    const result = requestSchema.safeParse({ supportingDocs: 'doc1.pdf' });
    expect(result.success).toBe(false);
  });
});

describe('rejectTeamOfficial', () => {
  it('accepts a non-empty reason string', () => {
    const result = rejectTeamOfficial.safeParse({ reason: 'เอกสารไม่ครบ' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty string (schema has no min-length rule, only a custom type-error message)', () => {
    const result = rejectTeamOfficial.safeParse({ reason: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing reason field', () => {
    const result = rejectTeamOfficial.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects a non-string reason', () => {
    const result = rejectTeamOfficial.safeParse({ reason: 42 });
    expect(result.success).toBe(false);
  });
});

/**
 * 🆕 การแก้ 7 ต.ค. 2569 (BE-08 · BE-09) — ชื่อทีมต้องตัดช่องว่างและมีเพดานเท่าคอลัมน์
 *
 * BE-08: `PATCH /teams/:id` ด้วย `{"name":"   "}` ได้ 200 · ชื่อในฐานเป็น "   "
 *        หน้าทีมไม่มีชื่อ และข้อความแจ้งเตือนกลายเป็น "… was removed from ." (ชื่อหายจากประโยค)
 * BE-09: ชื่อ 300 ตัวทะลุ VARCHAR(150) ⇒ mysql โยน error ดิบ ⇒ ผู้ใช้ได้ 500 INTERNAL_ERROR
 * ★ ต้องกันทั้งสองสคีมา — `teamSchema` (สร้าง) และ `updateTeamSchema` (แก้ชื่อ) ใช้กฎตัวเดียวกัน
 */
describe('ชื่อทีม — ช่องว่างล้วนและความยาวเกินคอลัมน์ (BE-08 · BE-09)', () => {
  it.each([
    ['ช่องว่าง 3 ตัว', '   '],
    ['แท็บกับขึ้นบรรทัด', '\t\n'],
  ])('สร้างทีมด้วยชื่อ %s ไม่ได้', (_name, name) => {
    expect(teamSchema.safeParse({ name, sportTypeId: 1 }).success).toBe(false);
    expect(updateTeamSchema.safeParse({ name }).success).toBe(false);
  });

  /** ★ `.trim()` ของ zod **แปลงค่า** ให้ด้วย ⇒ ที่ลงฐานต้องเป็นชื่อที่ตัดแล้ว ไม่ใช่ที่ส่งมา */
  it('ตัดช่องว่างหัวท้ายออกให้ก่อนเก็บ', () => {
    const result = teamSchema.safeParse({ name: '  ทีมวิศวะ  ', sportTypeId: 1 });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('ทีมวิศวะ');
  });

  it('ปฏิเสธชื่อที่ยาวเกินคอลัมน์ (150) แทนที่จะปล่อยไปพังที่ฐานเป็น 500', () => {
    expect(teamSchema.safeParse({ name: 'ก'.repeat(151), sportTypeId: 1 }).success).toBe(false);
    expect(teamSchema.safeParse({ name: 'ก'.repeat(150), sportTypeId: 1 }).success).toBe(true);
    expect(updateTeamSchema.safeParse({ name: 'ก'.repeat(151) }).success).toBe(false);
  });
});
