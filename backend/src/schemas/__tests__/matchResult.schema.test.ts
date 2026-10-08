import { describe, it, expect } from 'vitest';
import {
  submitResultSchema, disputeSchema, resolveSchema, statSchema,
  overrideResultSchema, organizerDecideSchema,   // 🆕 7 ต.ค. 2569 — เทสเพดานสกอร์ยิงให้ครบทุกช่อง (BE-18)
} from '../matchResult.schema.js';
import { MAX_SCORE_PER_TEAM } from '../../utils/matchFormat.js';

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

  // มติ 26 ก.ย. — เดิมค้านด้วยสตริงว่างได้ ผู้จัดเปิดเรื่องมาแล้วตัดสินไม่ได้
  it('rejects an empty or whitespace-only reason', () => {
    expect(disputeSchema.safeParse({ reason: '' }).success).toBe(false);
    expect(disputeSchema.safeParse({ reason: '   ' }).success).toBe(false);
    expect(disputeSchema.safeParse({ reason: 'x'.repeat(1001) }).success).toBe(false);
  });

  // เสนอผลที่ถูกต้องมาด้วยได้ แต่ต้องมาคู่กัน ไม่งั้นผู้จัดกด amend ต่อไม่ได้
  it('takes a proposed correct result only when both the winner and the score are given', () => {
    expect(disputeSchema.safeParse({ reason: 'ล้ำหน้า', claimedWinnerTeamId: 12, claimedScoreData: { 11: 1, 12: 3 } }).success).toBe(true);
    expect(disputeSchema.safeParse({ reason: 'ล้ำหน้า', claimedWinnerTeamId: 12 }).success).toBe(false);
    expect(disputeSchema.safeParse({ reason: 'ล้ำหน้า', claimedScoreData: { 11: 1, 12: 3 } }).success).toBe(false);
  });

  it('caps the attached evidence at 5 files', () => {
    const keys = (n: number) => Array.from({ length: n }, (_, i) => `dispute_evidence/7/${i}.jpg`);
    expect(disputeSchema.safeParse({ reason: 'x', evidenceKeys: keys(5) }).success).toBe(true);
    expect(disputeSchema.safeParse({ reason: 'x', evidenceKeys: keys(6) }).success).toBe(false);
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

/**
 * 🆕 การแก้ 7 ต.ค. 2569 (BE-18) — สกอร์ต้องมีเพดาน
 *
 * QA ส่งผลแมตช์แบดมินตันด้วย `999999` กับ `1` แล้วได้ 201 · ไม่มีด่านไหนร้อง
 * ⇒ สถิติผู้เล่น ตารางอันดับ และคะแนน Pick'em เพี้ยนตามไปทั้งหมด
 *
 * ★ ไฟล์นี้มีช่องสกอร์ **5 จุด** และเดิมแต่ละจุดเขียนกฎซ้ำกันเอง ⇒ เทสต้องยิงให้ครบทุกจุด
 *   ไม่ใช่แค่ `submitResultSchema` ไม่งั้นเหลือรูไว้ที่เหลือโดยไม่มีใครรู้
 * ★ ไม่ใช่กฎของกีฬา — เป็นด่านกันพิมพ์ผิด · กีฬาที่แข่งเป็นรอบมีด่านที่แคบกว่ามาก
 *   (`possibleScores`: BO3 ได้แค่ 2-0 / 2-1) ซึ่งอยู่ที่ service ไม่ใช่ที่นี่
 */
describe('เพดานสกอร์ ครบทุกช่องในไฟล์นี้ (BE-18)', () => {
  const over = MAX_SCORE_PER_TEAM + 1;

  it.each([
    ['submitResultSchema (กรรมการส่งผล)', (s: Record<string, number>) =>
      submitResultSchema.safeParse({ winnerTeamId: 10, scoreData: s })],
    ['disputeSchema (ทีมค้านพร้อมเสนอผล)', (s: Record<string, number>) =>
      disputeSchema.safeParse({ reason: 'สกอร์ผิด', claimedWinnerTeamId: 10, claimedScoreData: s })],
    ['overrideResultSchema (กรรมการเขียนทับ)', (s: Record<string, number>) =>
      overrideResultSchema.safeParse({ winnerTeamId: 10, scoreData: s, reason: 'แก้ผล' })],
    ['resolveSchema (ผู้จัดตัดสินแล้วแก้ผล)', (s: Record<string, number>) =>
      resolveSchema.safeParse({ resolution: 'amend', resolutionNote: 'ok', winnerTeamId: 10, scoreData: s })],
    ['organizerDecideSchema (ผู้จัดชี้ขาดแมตช์ที่ไม่มีใครส่งผล)', (s: Record<string, number>) =>
      organizerDecideSchema.safeParse({ outcome: 'result', reason: 'ไม่มีใครส่ง', winnerTeamId: 10, scoreData: s })],
  ])('%s: ปฏิเสธสกอร์ที่เกินเพดาน และรับค่าที่ขอบ', (_name, parse) => {
    expect(parse({ '10': over, '11': 1 }).success).toBe(false);
    expect(parse({ '10': 999999, '11': 1 }).success).toBe(false);
    expect(parse({ '10': MAX_SCORE_PER_TEAM, '11': 0 }).success).toBe(true);
  });
});
