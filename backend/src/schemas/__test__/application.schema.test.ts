import { describe, it, expect } from 'vitest';
import { rejectApplicationSchema, applyTournamentSchema } from '../application.schema.js';

describe('rejectApplicationSchema', () => {
  it('accepts a non-empty reason string', () => {
    const result = rejectApplicationSchema.safeParse({ reason: 'ไม่ผ่านคุณสมบัติ' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty reason string', () => {
    const result = rejectApplicationSchema.safeParse({ reason: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing reason field', () => {
    const result = rejectApplicationSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects a non-string reason', () => {
    const result = rejectApplicationSchema.safeParse({ reason: 123 });
    expect(result.success).toBe(false);
  });
});

describe('applyTournamentSchema', () => {
  it('accepts a positive integer teamId', () => {
    const result = applyTournamentSchema.safeParse({ teamId: 5 });
    expect(result.success).toBe(true);
  });

  it('rejects teamId 0', () => {
    const result = applyTournamentSchema.safeParse({ teamId: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative teamId', () => {
    const result = applyTournamentSchema.safeParse({ teamId: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a decimal teamId', () => {
    const result = applyTournamentSchema.safeParse({ teamId: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects a missing teamId', () => {
    const result = applyTournamentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects a string teamId', () => {
    const result = applyTournamentSchema.safeParse({ teamId: '5' });
    expect(result.success).toBe(false);
  });
});
