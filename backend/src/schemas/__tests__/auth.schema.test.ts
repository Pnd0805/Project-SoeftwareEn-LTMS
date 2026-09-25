import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '../auth.schema.js';

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
