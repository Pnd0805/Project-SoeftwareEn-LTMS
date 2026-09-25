import { describe, it, expect } from 'vitest';
import { submitResultSchema, disputeSchema, resolveSchema, statSchema } from '../matchResult.schema.js';

describe('submitResultSchema', () => {
  it('accepts a valid winnerTeamId and scoreData record', () => {
    const result = submitResultSchema.safeParse({ winnerTeamId: 10, scoreData: { a: 21, b: 15 } });
    expect(result.success).toBe(true);
  });

  it('accepts an empty scoreData record', () => {
    const result = submitResultSchema.safeParse({ winnerTeamId: 10, scoreData: {} });
    expect(result.success).toBe(true);
  });

  it('rejects a missing winnerTeamId', () => {
    const result = submitResultSchema.safeParse({ scoreData: { a: 21 } });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer winnerTeamId', () => {
    const result = submitResultSchema.safeParse({ winnerTeamId: 10.5, scoreData: { a: 21 } });
    expect(result.success).toBe(false);
  });

  it('rejects a missing scoreData', () => {
    const result = submitResultSchema.safeParse({ winnerTeamId: 10 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative score with the Thai message', () => {
    const result = submitResultSchema.safeParse({ winnerTeamId: 10, scoreData: { a: -1 } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'คะแนนต้องไม่ติดลบ')).toBe(true);
    }
  });

  it('accepts a score of exactly 0 (nonnegative allows zero)', () => {
    const result = submitResultSchema.safeParse({ winnerTeamId: 10, scoreData: { a: 0 } });
    expect(result.success).toBe(true);
  });

  it('rejects a non-integer score value', () => {
    const result = submitResultSchema.safeParse({ winnerTeamId: 10, scoreData: { a: 2.5 } });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric score value', () => {
    const result = submitResultSchema.safeParse({ winnerTeamId: 10, scoreData: { a: 'twenty' } });
    expect(result.success).toBe(false);
  });
});

describe('disputeSchema', () => {
  it('accepts any string reason', () => {
    const result = disputeSchema.safeParse({ reason: 'ผลไม่ตรงกับที่แข่งจริง' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty string reason (no min-length constraint here)', () => {
    const result = disputeSchema.safeParse({ reason: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing reason', () => {
    const result = disputeSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects a non-string reason', () => {
    const result = disputeSchema.safeParse({ reason: 123 });
    expect(result.success).toBe(false);
  });
});

describe('resolveSchema', () => {
  it('accepts resolution "uphold" with just a resolutionNote', () => {
    const result = resolveSchema.safeParse({ resolution: 'uphold', resolutionNote: 'ผลถูกต้องแล้ว' });
    expect(result.success).toBe(true);
  });

  it('accepts resolution "reject" with just a resolutionNote', () => {
    const result = resolveSchema.safeParse({ resolution: 'reject', resolutionNote: 'หลักฐานไม่พอ' });
    expect(result.success).toBe(true);
  });

  it('accepts resolution "amend" when both winnerTeamId and scoreData are provided', () => {
    const result = resolveSchema.safeParse({
      resolution: 'amend',
      resolutionNote: 'แก้ไขสกอร์ตามหลักฐานกล้อง',
      winnerTeamId: 11,
      scoreData: { a: 21, b: 18 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects resolution "amend" when winnerTeamId is missing', () => {
    const result = resolveSchema.safeParse({
      resolution: 'amend',
      resolutionNote: 'แก้ไขสกอร์',
      scoreData: { a: 21, b: 18 },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.message === 'amend ต้องระบุ winnerTeamId และ scoreData');
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(['winnerTeamId']);
    }
  });

  it('rejects resolution "amend" when scoreData is missing', () => {
    const result = resolveSchema.safeParse({
      resolution: 'amend',
      resolutionNote: 'แก้ไขสกอร์',
      winnerTeamId: 11,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'amend ต้องระบุ winnerTeamId และ scoreData')).toBe(true);
    }
  });

  it('rejects resolution "amend" when both winnerTeamId and scoreData are missing', () => {
    const result = resolveSchema.safeParse({ resolution: 'amend', resolutionNote: 'แก้ไขสกอร์' });
    expect(result.success).toBe(false);
  });

  it('does not require winnerTeamId/scoreData for "uphold" even if the refine were misapplied', () => {
    const result = resolveSchema.safeParse({ resolution: 'uphold', resolutionNote: 'โอเค' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid resolution value', () => {
    const result = resolveSchema.safeParse({ resolution: 'overturn', resolutionNote: 'note' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing resolutionNote', () => {
    const result = resolveSchema.safeParse({ resolution: 'uphold' });
    expect(result.success).toBe(false);
  });

  it('accepts an empty resolutionNote (no min-length constraint)', () => {
    const result = resolveSchema.safeParse({ resolution: 'uphold', resolutionNote: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a negative score inside scoreData even for a valid amend', () => {
    const result = resolveSchema.safeParse({
      resolution: 'amend',
      resolutionNote: 'แก้ไขสกอร์',
      winnerTeamId: 11,
      scoreData: { a: -5 },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'คะแนนต้องไม่ติดลบ')).toBe(true);
    }
  });
});

describe('statSchema', () => {
  it('accepts a valid playerStats array with nested values', () => {
    const result = statSchema.safeParse({
      playerStats: [
        {
          userId: 1,
          values: [
            { statDefinitionId: 101, value: 5 },
            { statDefinitionId: 102, value: 3 },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty playerStats array', () => {
    const result = statSchema.safeParse({ playerStats: [] });
    expect(result.success).toBe(true);
  });

  it('accepts a player entry with an empty values array', () => {
    const result = statSchema.safeParse({ playerStats: [{ userId: 1, values: [] }] });
    expect(result.success).toBe(true);
  });

  it('rejects a missing playerStats field', () => {
    const result = statSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer userId', () => {
    const result = statSchema.safeParse({
      playerStats: [{ userId: 1.5, values: [] }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer statDefinitionId', () => {
    const result = statSchema.safeParse({
      playerStats: [{ userId: 1, values: [{ statDefinitionId: 1.5, value: 5 }] }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer stat value', () => {
    const result = statSchema.safeParse({
      playerStats: [{ userId: 1, values: [{ statDefinitionId: 101, value: 5.5 }] }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a negative stat value (statSchema has no nonnegative constraint, unlike scoreData)', () => {
    const result = statSchema.safeParse({
      playerStats: [{ userId: 1, values: [{ statDefinitionId: 101, value: -1 }] }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a values entry missing statDefinitionId', () => {
    const result = statSchema.safeParse({
      playerStats: [{ userId: 1, values: [{ value: 5 }] }],
    });
    expect(result.success).toBe(false);
  });
});
