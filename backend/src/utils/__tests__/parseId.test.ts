import { describe, it, expect } from 'vitest';
import { parseId } from '../parseId.js';
import { AppError } from '../AppError.js';

describe('parseId — valid input', () => {
  it('parses a numeric string into a number', () => {
    expect(parseId('5', 'รหัสผู้ใช้')).toBe(5);
  });

  it('accepts the boundary value 1 (smallest valid positive integer)', () => {
    expect(parseId('1', 'รหัสผู้ใช้')).toBe(1);
  });

  it('trims incidental whitespace the way Number() does', () => {
    expect(parseId(' 42 ', 'รหัสผู้ใช้')).toBe(42);
  });

  it('parses large integer strings correctly', () => {
    expect(parseId('123456', 'รหัสผู้ใช้')).toBe(123456);
  });
});

describe('parseId — invalid input', () => {
  it('rejects 0 (not a positive integer)', () => {
    expect(() => parseId('0', 'รหัสผู้ใช้')).toThrow(AppError);
  });

  it('rejects negative numbers', () => {
    expect(() => parseId('-5', 'รหัสผู้ใช้')).toThrow(AppError);
  });

  it('rejects non-integer (decimal) values', () => {
    expect(() => parseId('3.5', 'รหัสผู้ใช้')).toThrow(AppError);
  });

  it('rejects non-numeric strings', () => {
    expect(() => parseId('abc', 'รหัสผู้ใช้')).toThrow(AppError);
  });

  it('rejects undefined (id param missing entirely)', () => {
    expect(() => parseId(undefined, 'รหัสผู้ใช้')).toThrow(AppError);
  });

  it('rejects an array (e.g. a duplicated route param like /users/1/2)', () => {
    expect(() => parseId(['1', '2'], 'รหัสผู้ใช้')).toThrow(AppError);
  });

  it('rejects an empty string', () => {
    expect(() => parseId('', 'รหัสผู้ใช้')).toThrow(AppError);
  });

  it('throws with status 400 and code VALIDATION_FAILED', () => {
    const err = (() => {
      try {
        parseId('abc', 'รหัสผู้ใช้');
      } catch (e) {
        return e as AppError;
      }
    })();
    expect(err?.status).toBe(400);
    expect(err?.code).toBe('VALIDATION_FAILED');
  });
});

describe('parseId — field naming in the error payload', () => {
  it('defaults the error field key to "id" when no field name is given', () => {
    const err = (() => {
      try {
        parseId('abc', 'รหัสผู้ใช้');
      } catch (e) {
        return e as AppError;
      }
    })();
    expect(err?.extra?.fields).toHaveProperty('id');
  });

  it('uses the custom field name when provided (e.g. "facultyId")', () => {
    const err = (() => {
      try {
        parseId('abc', 'รหัสคณะ', 'facultyId');
      } catch (e) {
        return e as AppError;
      }
    })();
    expect(err?.extra?.fields).toHaveProperty('facultyId');
    expect(err?.extra?.fields).not.toHaveProperty('id');
  });
});
