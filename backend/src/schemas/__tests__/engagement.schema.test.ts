import { describe, it, expect } from 'vitest';
import { predictionSchema } from '../engagement.schema.js';

describe('predictionSchema', () => {
  it('accepts a positive integer teamId', () => {
    const result = predictionSchema.safeParse({ teamId: 5 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ teamId: 5 });
    }
  });

  it('rejects a missing teamId', () => {
    const result = predictionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects teamId = 0 with the "กรุณาเลือกทีม" message (fails .positive())', () => {
    const result = predictionSchema.safeParse({ teamId: 0 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'กรุณาเลือกทีม')).toBe(true);
    }
  });

  it('rejects a negative teamId with the "กรุณาเลือกทีม" message', () => {
    const result = predictionSchema.safeParse({ teamId: -1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'กรุณาเลือกทีม')).toBe(true);
    }
  });

  it('rejects a non-integer teamId with the "รหัสทีมต้องเป็นจำนวนเต็ม" message', () => {
    const result = predictionSchema.safeParse({ teamId: 1.5 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'รหัสทีมต้องเป็นจำนวนเต็ม')).toBe(true);
    }
  });

  it('rejects a string teamId (no implicit coercion)', () => {
    const result = predictionSchema.safeParse({ teamId: '5' });
    expect(result.success).toBe(false);
  });

  it('rejects null and undefined teamId', () => {
    expect(predictionSchema.safeParse({ teamId: null }).success).toBe(false);
    expect(predictionSchema.safeParse({ teamId: undefined }).success).toBe(false);
  });
});
