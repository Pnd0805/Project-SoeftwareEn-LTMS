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
    const result = applyTournamentSchema.safeParse({ teamId: 5, playerIds: [1, 2] });
    expect(result.success).toBe(true);
  });

  it('rejects teamId 0', () => {
    const result = applyTournamentSchema.safeParse({ teamId: 0, playerIds: [1] });
    expect(result.success).toBe(false);
  });

  it('rejects a negative teamId', () => {
    const result = applyTournamentSchema.safeParse({ teamId: -1, playerIds: [1] });
    expect(result.success).toBe(false);
  });

  it('rejects a decimal teamId', () => {
    const result = applyTournamentSchema.safeParse({ teamId: 1.5, playerIds: [1] });
    expect(result.success).toBe(false);
  });

  it('rejects a missing teamId', () => {
    const result = applyTournamentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects a string teamId', () => {
    const result = applyTournamentSchema.safeParse({ teamId: '5', playerIds: [1] });
    expect(result.success).toBe(false);
  });

  // รายชื่อผู้เล่นที่ลงแข่ง (มติ 19 ก.ย. 2569) — จำนวนเทียบ min/max ของกีฬาทำใน service
  it('rejects a missing playerIds', () => {
    const result = applyTournamentSchema.safeParse({ teamId: 5 });
    expect(result.success).toBe(false);
  });

  it('rejects an empty playerIds', () => {
    const result = applyTournamentSchema.safeParse({ teamId: 5, playerIds: [] });
    expect(result.success).toBe(false);
  });

  it('rejects duplicated playerIds', () => {
    const result = applyTournamentSchema.safeParse({ teamId: 5, playerIds: [1, 1, 2] });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer playerId', () => {
    const result = applyTournamentSchema.safeParse({ teamId: 5, playerIds: [1, 2.5] });
    expect(result.success).toBe(false);
  });

  it('accepts optional softFilterDocuments', () => {
    const result = applyTournamentSchema.safeParse({
      teamId: 5,
      playerIds: [1, 2],
      softFilterDocuments: [
        'soft_filter_document/20/5/11111111-1111-4111-8111-111111111111.jpg',
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects duplicated or excessive softFilterDocuments', () => {
    const key = 'soft_filter_document/20/5/11111111-1111-4111-8111-111111111111.jpg';
    expect(applyTournamentSchema.safeParse({ teamId: 5, playerIds: [1], softFilterDocuments: [key, key] }).success).toBe(false);
    expect(applyTournamentSchema.safeParse({
      teamId: 5,
      playerIds: [1],
      softFilterDocuments: Array.from({ length: 11 }, (_, i) => `soft_filter_document/20/5/${i}.jpg`),
    }).success).toBe(false);
  });
});
