import { describe, it, expect } from 'vitest';
import { refRequestSchema, orgAddMatchSchema, orgSwapSchema } from '../refereeRequest.schema.js';

describe('refRequestSchema', () => {
  it('accepts a transfer request (theirMatchId omitted)', () => {
    const result = refRequestSchema.safeParse({ myMatchId: 30, toTournamentRefereeId: 60 });
    expect(result.success).toBe(true);
  });

  it('accepts a swap request (theirMatchId provided)', () => {
    const result = refRequestSchema.safeParse({ myMatchId: 30, toTournamentRefereeId: 60, theirMatchId: 31 });
    expect(result.success).toBe(true);
  });

  it('rejects a missing myMatchId', () => {
    const result = refRequestSchema.safeParse({ toTournamentRefereeId: 60 });
    expect(result.success).toBe(false);
  });

  it('rejects a missing toTournamentRefereeId', () => {
    const result = refRequestSchema.safeParse({ myMatchId: 30 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer myMatchId with the "ต้องเป็นจำนวนเต็ม" message for that field', () => {
    const result = refRequestSchema.safeParse({ myMatchId: 30.5, toTournamentRefereeId: 60 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'แมตช์ของคุณต้องเป็นจำนวนเต็ม')).toBe(true);
    }
  });

  it('rejects myMatchId = 0 with the "กรุณาระบุ" message for that field', () => {
    const result = refRequestSchema.safeParse({ myMatchId: 0, toTournamentRefereeId: 60 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'กรุณาระบุแมตช์ของคุณ')).toBe(true);
    }
  });

  it('rejects a negative toTournamentRefereeId with its own "กรุณาระบุ" message', () => {
    const result = refRequestSchema.safeParse({ myMatchId: 30, toTournamentRefereeId: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'กรุณาระบุกรรมการที่ต้องการโอน/แลกด้วย')).toBe(true);
    }
  });

  it('rejects a non-integer toTournamentRefereeId with its own field-labeled message', () => {
    const result = refRequestSchema.safeParse({ myMatchId: 30, toTournamentRefereeId: 1.2 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'กรรมการที่ต้องการโอน/แลกด้วยต้องเป็นจำนวนเต็ม')).toBe(true);
    }
  });

  it('rejects theirMatchId = 0 when provided (still validated even though optional)', () => {
    const result = refRequestSchema.safeParse({ myMatchId: 30, toTournamentRefereeId: 60, theirMatchId: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'กรุณาระบุแมตช์ของอีกฝ่าย')).toBe(true);
    }
  });

  it('rejects a non-integer theirMatchId when provided', () => {
    const result = refRequestSchema.safeParse({ myMatchId: 30, toTournamentRefereeId: 60, theirMatchId: 1.5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'แมตช์ของอีกฝ่ายต้องเป็นจำนวนเต็ม')).toBe(true);
    }
  });
});

describe('orgAddMatchSchema', () => {
  it('accepts valid tournamentRefereeId and matchId', () => {
    const result = orgAddMatchSchema.safeParse({ tournamentRefereeId: 60, matchId: 30 });
    expect(result.success).toBe(true);
  });

  it('rejects a missing tournamentRefereeId', () => {
    const result = orgAddMatchSchema.safeParse({ matchId: 30 });
    expect(result.success).toBe(false);
  });

  it('rejects a missing matchId', () => {
    const result = orgAddMatchSchema.safeParse({ tournamentRefereeId: 60 });
    expect(result.success).toBe(false);
  });

  it('rejects tournamentRefereeId = 0 with the "กรุณาระบุรหัสกรรมการ" message', () => {
    const result = orgAddMatchSchema.safeParse({ tournamentRefereeId: 0, matchId: 30 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'กรุณาระบุรหัสกรรมการ')).toBe(true);
    }
  });

  it('rejects a non-integer matchId with the "รหัสแมตช์ต้องเป็นจำนวนเต็ม" message', () => {
    const result = orgAddMatchSchema.safeParse({ tournamentRefereeId: 60, matchId: 3.3 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'รหัสแมตช์ต้องเป็นจำนวนเต็ม')).toBe(true);
    }
  });
});

describe('orgSwapSchema', () => {
  const valid = { refereeAId: 60, matchAId: 30, refereeBId: 61, matchBId: 31 };

  it('accepts a fully valid swap request', () => {
    const result = orgSwapSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects when any one of the four ids is missing', () => {
    for (const key of Object.keys(valid) as (keyof typeof valid)[]) {
      const { [key]: _omit, ...rest } = valid;
      const result = orgSwapSchema.safeParse(rest);
      expect(result.success).toBe(false);
    }
  });

  it('gives refereeAId and refereeBId distinct field-labeled messages', () => {
    const resultA = orgSwapSchema.safeParse({ ...valid, refereeAId: -1 });
    const resultB = orgSwapSchema.safeParse({ ...valid, refereeBId: -1 });

    expect(resultA.success).toBe(false);
    expect(resultB.success).toBe(false);
    if (!resultA.success) {
      expect(resultA.error.issues.some((i) => i.message === 'กรุณาระบุรหัสกรรมการ A')).toBe(true);
    }
    if (!resultB.success) {
      expect(resultB.error.issues.some((i) => i.message === 'กรุณาระบุรหัสกรรมการ B')).toBe(true);
    }
  });

  it('gives matchAId and matchBId distinct field-labeled messages', () => {
    const resultA = orgSwapSchema.safeParse({ ...valid, matchAId: 1.1 });
    const resultB = orgSwapSchema.safeParse({ ...valid, matchBId: 1.1 });

    expect(resultA.success).toBe(false);
    expect(resultB.success).toBe(false);
    if (!resultA.success) {
      expect(resultA.error.issues.some((i) => i.message === 'แมตช์ของ Aต้องเป็นจำนวนเต็ม')).toBe(true);
    }
    if (!resultB.success) {
      expect(resultB.error.issues.some((i) => i.message === 'แมตช์ของ Bต้องเป็นจำนวนเต็ม')).toBe(true);
    }
  });
});
