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
});
