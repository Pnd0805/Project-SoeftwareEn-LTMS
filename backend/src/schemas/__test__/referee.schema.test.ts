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

  it('rejects a missing isExternal field', () => {
    const result = inviteRefereeSchema.safeParse({ userId: 1 });
    expect(result.success).toBe(false);
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
