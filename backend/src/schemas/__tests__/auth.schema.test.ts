import { describe, it, expect, vi, afterEach } from 'vitest';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../auth.schema.js';

const validRegisterInput = {
  fullName: 'สมชาย ใจดี',
  email: 'somchai@example.com',
  password: 'password1',
  gender: 'male',
  birthDate: '2000-01-15',
  facultyId: 1,
  departmentId: 1,
  year: 3,
};

describe('registerSchema — valid input', () => {
  it('accepts a fully valid registration payload', () => {
    const result = registerSchema.safeParse(validRegisterInput);
    expect(result.success).toBe(true);
  });
});

describe('registerSchema — fullName', () => {
  it('rejects a fullName shorter than 2 characters', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, fullName: 'a' });
    expect(result.success).toBe(false);
  });

  it('accepts the boundary value of exactly 2 characters', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, fullName: 'ab' });
    expect(result.success).toBe(true);
  });

  it('rejects a fullName longer than 100 characters', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, fullName: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('accepts the boundary value of exactly 100 characters', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, fullName: 'a'.repeat(100) });
    expect(result.success).toBe(true);
  });
});

describe('registerSchema — email', () => {
  it('rejects a malformed email', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('accepts a well-formed email', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, email: 'user@domain.co.th' });
    expect(result.success).toBe(true);
  });
});

describe('registerSchema — password', () => {
  it('rejects a password shorter than 8 characters even with a digit', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, password: 'ab1' });
    expect(result.success).toBe(false);
  });

  it('rejects an 8+ character password with no digit', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, password: 'onlyletters' });
    expect(result.success).toBe(false);
  });

  it('accepts a password with 8+ characters and at least one digit', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, password: 'password1' });
    expect(result.success).toBe(true);
  });

  it('accepts the boundary value of exactly 8 characters with a digit', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, password: 'abcdefg1' });
    expect(result.success).toBe(true);
  });
});

describe('registerSchema — gender', () => {
  it.each(['male', 'female', 'other'])('accepts gender "%s"', (gender) => {
    const result = registerSchema.safeParse({ ...validRegisterInput, gender });
    expect(result.success).toBe(true);
  });

  it('rejects a gender outside the allowed enum', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, gender: 'unspecified' });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema — birthDate', () => {
  it('accepts a valid YYYY-MM-DD date string', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, birthDate: '1999-12-31' });
    expect(result.success).toBe(true);
  });

  it('rejects a date in the wrong format (e.g. DD/MM/YYYY)', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, birthDate: '31/12/1999' });
    expect(result.success).toBe(false);
  });

  it('rejects a full ISO datetime string (with time component)', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, birthDate: '1999-12-31T00:00:00Z' });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema — facultyId / departmentId / year', () => {
  it('rejects facultyId 0', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, facultyId: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative departmentId', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, departmentId: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a decimal year', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, year: 2.5 });
    expect(result.success).toBe(false);
  });

  it('rejects year 0', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, year: 0 });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts a valid email with any non-empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'whatever' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty password (login has no length/complexity rule)', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'whatever' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing password field', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts a well-formed email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing email field', () => {
    const result = forgotPasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  const valid = { token: 'a'.repeat(64), newPassword: 'newpassword1' };

  it('accepts a valid token + password pair', () => {
    const result = resetPasswordSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects an empty token', () => {
    const result = resetPasswordSchema.safeParse({ ...valid, token: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing token field', () => {
    const { token, ...rest } = valid;
    const result = resetPasswordSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  // ใช้กฎเดียวกับ registerSchema.password — ไม่ copy แยกออกมาใช้ร่วมกัน (TASK-password-recovery)
  it('rejects a newPassword shorter than 8 characters even with a digit', () => {
    const result = resetPasswordSchema.safeParse({ ...valid, newPassword: 'ab1' });
    expect(result.success).toBe(false);
  });

  it('rejects an 8+ character newPassword with no digit', () => {
    const result = resetPasswordSchema.safeParse({ ...valid, newPassword: 'onlyletters' });
    expect(result.success).toBe(false);
  });

  it('accepts a newPassword with 8+ characters and at least one digit', () => {
    const result = resetPasswordSchema.safeParse({ ...valid, newPassword: 'password1' });
    expect(result.success).toBe(true);
  });
});

/**
 * 🆕 มติ/การแก้ 7 ต.ค. 2569 (BE-05) — ค่าที่ผู้ใช้แก้เองไม่ได้ ต้องถูกตั้งแต่ตอนสมัคร
 *
 * `birthDate` และ `year` ไปโผล่ที่ Hard Filter ของทุกทัวร์ (อายุขั้นต่ำ/สูงสุด · ชั้นปีที่รับ)
 * และ**ผู้ใช้แก้เองไม่ได้** หลังสมัคร ⇒ ค่าขยะที่หลุดเข้าไปติดอยู่ตลอดชีวิตบัญชี
 * ของจริงที่ QA เจอ: สมัครด้วย birthDate 2030-01-01 + year 99 ⇒ โปรไฟล์ขึ้น "Age -4, Year 99"
 */
describe('registerSchema — birthDate ห้ามอยู่ในอนาคต (BE-05)', () => {
  // ★ ตรึงเวลา: ด่านนี้เทียบกับ "วันนี้" ⇒ ถ้าใช้เวลาจริง เทสจะหมดอายุเองในอนาคต
  //   และเคสขอบ (เกิดวันนี้) จะพลิกตามเวลาที่รันเหมือนเทส tournament.create ที่เพิ่งแก้
  const freeze = (iso: string) => { vi.useFakeTimers(); vi.setSystemTime(new Date(iso)); };
  afterEach(() => { vi.useRealTimers(); });

  it('ปฏิเสธวันเกิดในอนาคต', () => {
    freeze('2026-10-07T03:00:00Z');
    expect(registerSchema.safeParse({ ...validRegisterInput, birthDate: '2030-01-01' }).success).toBe(false);
  });

  /**
   * ★ เกิด "วันนี้" ต้องผ่าน — เป็นขอบที่ off-by-one ได้ง่ายที่สุด
   *   03:00 UTC = 10:00 ของวันที่ 7 ตามเวลาไทย ⇒ วันนี้ของไทยคือ 2026-10-07
   */
  it('รับวันเกิดวันนี้ (ตามเวลาไทย)', () => {
    freeze('2026-10-07T03:00:00Z');
    expect(registerSchema.safeParse({ ...validRegisterInput, birthDate: '2026-10-07' }).success).toBe(true);
  });

  /**
   * ★ เคสที่พิสูจน์ว่าต้องคิดเป็นเวลาไทย ไม่ใช่ UTC
   *   19:00 UTC ของวันที่ 6 = 02:00 ของวันที่ 7 ตามเวลาไทย ⇒ คนไทยที่เกิดวันที่ 7 ต้องสมัครได้
   *   ถ้าโค้ดเทียบกับวันที่แบบ UTC จะปฏิเสธ เพราะ UTC ยังเป็นวันที่ 6
   */
  it('คนที่เกิดวันนี้สมัครได้ตั้งแต่เที่ยงคืนเวลาไทย (ไม่ใช่เที่ยงคืน UTC)', () => {
    freeze('2026-10-06T19:00:00Z');
    expect(registerSchema.safeParse({ ...validRegisterInput, birthDate: '2026-10-07' }).success).toBe(true);
  });

  it('รับวันเกิดในอดีตตามเดิม', () => {
    freeze('2026-10-07T03:00:00Z');
    expect(registerSchema.safeParse({ ...validRegisterInput, birthDate: '2000-01-15' }).success).toBe(true);
  });
});

describe('registerSchema — ชั้นปีต้องอยู่ในช่วงที่ระบบรองรับ (BE-05)', () => {
  it.each([9, 99, 1000])('ปฏิเสธชั้นปี %i', (year) => {
    expect(registerSchema.safeParse({ ...validRegisterInput, year }).success).toBe(false);
  });

  /** ★ 1 และ 8 ต้องผ่าน — ช่วงเดียวกับที่ `normalizeEligibilityRules` ใช้ตรวจกฎคุณสมบัติ */
  it.each([1, 8])('รับชั้นปี %i (ขอบของช่วง)', (year) => {
    expect(registerSchema.safeParse({ ...validRegisterInput, year }).success).toBe(true);
  });
});
