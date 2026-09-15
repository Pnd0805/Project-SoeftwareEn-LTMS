import { describe, it, expect } from 'vitest';
import {
  teamSchema,
  updateTeamSchema,
  updateMemberschema,
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

describe('updateMemberschema', () => {
  it.each(['starter', 'substitute'])('accepts position "%s"', (position) => {
    const result = updateMemberschema.safeParse({ position });
    expect(result.success).toBe(true);
  });

  it('rejects a position outside the allowed enum', () => {
    const result = updateMemberschema.safeParse({ position: 'benched' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing position field', () => {
    const result = updateMemberschema.safeParse({});
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
