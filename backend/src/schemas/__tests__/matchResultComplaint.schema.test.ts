import { describe, it, expect } from 'vitest';
import { fileComplaintSchema, organizerStatementSchema, decideComplaintSchema } from '../matchResultComplaint.schema.js';

/** OD-26 ข้อ 8 — ฟอร์มยื่นเรื่องต้องพกข้อมูลพอให้แอดมินตัดสินได้ ไม่ใช่ข้อความเปล่า */
describe('fileComplaintSchema', () => {
  it('accepts a reason on its own', () => {
    expect(fileComplaintSchema.safeParse({ reason: 'อีกฝ่ายส่งคนนอกใบสมัครลงเล่น' }).success).toBe(true);
  });

  it('rejects an empty or whitespace-only reason', () => {
    expect(fileComplaintSchema.safeParse({ reason: '' }).success).toBe(false);
    expect(fileComplaintSchema.safeParse({ reason: '   ' }).success).toBe(false);
  });

  // ถ้าเสนอผลที่ถูกต้องมา แอดมินกดแก้ผลต่อได้เลย — แต่ครึ่ง ๆ กลาง ๆ ใช้ไม่ได้
  it('needs the claimed winner and the claimed score together or not at all', () => {
    expect(fileComplaintSchema.safeParse({ reason: 'x', claimedWinnerTeamId: 12 }).success).toBe(false);
    expect(fileComplaintSchema.safeParse({ reason: 'x', claimedScoreData: { 11: 0, 12: 3 } }).success).toBe(false);
    expect(fileComplaintSchema.safeParse({ reason: 'x', claimedWinnerTeamId: 12, claimedScoreData: { 11: 0, 12: 3 } }).success).toBe(true);
  });

  it('rejects negative scores and more than five evidence files', () => {
    expect(fileComplaintSchema.safeParse({ reason: 'x', claimedWinnerTeamId: 12, claimedScoreData: { 11: -1, 12: 3 } }).success).toBe(false);
    expect(fileComplaintSchema.safeParse({ reason: 'x', evidenceKeys: ['a', 'b', 'c', 'd', 'e', 'f'] }).success).toBe(false);
  });
});

describe('organizerStatementSchema', () => {
  it('needs real text', () => {
    expect(organizerStatementSchema.safeParse({ statement: 'กรรมการยืนยันว่ารายชื่อถูกต้อง' }).success).toBe(true);
    expect(organizerStatementSchema.safeParse({ statement: '  ' }).success).toBe(false);
  });
});

describe('decideComplaintSchema', () => {
  it('defaults to recording the decision without touching the result', () => {
    const parsed = decideComplaintSchema.safeParse({ outcome: 'upheld', note: 'มีมูล' });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.remedy).toBe('record_only');
  });

  it('needs the corrected result when the admin chooses to amend', () => {
    expect(decideComplaintSchema.safeParse({ outcome: 'upheld', remedy: 'amend_result', note: 'x' }).success).toBe(false);
    expect(decideComplaintSchema.safeParse({
      outcome: 'upheld', remedy: 'amend_result', note: 'x', winnerTeamId: 12, scoreData: { 11: 0, 12: 3 },
    }).success).toBe(true);
  });

  // เรื่องไม่มีมูลแล้วยังแก้ผลตามคำขอของผู้ยื่นได้ = ขัดกันเอง
  it('refuses to amend the result on a no-merit decision', () => {
    expect(decideComplaintSchema.safeParse({
      outcome: 'no_merit', remedy: 'amend_result', note: 'x', winnerTeamId: 12, scoreData: { 11: 0, 12: 3 },
    }).success).toBe(false);
  });

  it('always needs a written decision', () => {
    expect(decideComplaintSchema.safeParse({ outcome: 'no_merit', note: '' }).success).toBe(false);
  });
});
