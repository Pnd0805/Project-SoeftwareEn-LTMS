import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));

import * as passwordResetRepo from '../passwordReset.repo.js';

beforeEach(() => vi.clearAllMocks());

describe('passwordReset.repo', () => {
  it('create — insert แถวใหม่และคืน insertId', async () => {
    mocks.query.mockResolvedValueOnce([{ insertId: 7 }, []]);
    const expiresAt = new Date('2026-01-01T01:00:00Z');

    await expect(passwordResetRepo.create(1, 'some-hash', expiresAt)).resolves.toBe(7);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO password_reset_tokens'),
      [1, 'some-hash', expiresAt],
    );
  });

  it('findActiveByUser — กรองเฉพาะของ user คนเดียว ที่ used_at IS NULL และยังไม่หมดอายุ', async () => {
    const rows = [{ password_reset_token_id: 1, user_id: 1, token_hash: 'h', expires_at: new Date(), used_at: null }];
    mocks.query.mockResolvedValueOnce([rows, []]);

    await expect(passwordResetRepo.findActiveByUser(1)).resolves.toEqual(rows);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()'),
      [1],
    );
  });

  it('findActiveByHash — ค้นตรงด้วย hash ใบเดียว (bug hunt ข้อ 7 · ไม่กวาดทุกใบมาเทียบ)', async () => {
    const row = { password_reset_token_id: 1, user_id: 1, token_hash: 'h', expires_at: new Date(), used_at: null };
    mocks.query.mockResolvedValueOnce([[row], []]);

    await expect(passwordResetRepo.findActiveByHash('h')).resolves.toEqual(row);
    const [sql, params] = mocks.query.mock.calls[0]!;
    expect(sql).toContain('WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()');
    expect(params).toEqual(['h']);
  });

  it('findActiveByHash — ไม่เจอ → null', async () => {
    mocks.query.mockResolvedValueOnce([[], []]);
    await expect(passwordResetRepo.findActiveByHash('nope')).resolves.toBeNull();
  });

  it('countIssuedWithinLastHour — นับแถวที่ expires_at > NOW() รวมที่ used_at ถูกตั้งแล้วด้วย (rate limit คือ "ขอกี่ครั้ง")', async () => {
    mocks.query.mockResolvedValueOnce([[{ cnt: 2 }], []]);

    await expect(passwordResetRepo.countIssuedWithinLastHour(1)).resolves.toBe(2);
    const [sql] = mocks.query.mock.calls[0]!;
    expect(sql).not.toContain('used_at IS NULL');
    expect(sql).toContain('expires_at > NOW()');
  });

  it('invalidateAllForUser — ตั้ง used_at = NOW() ให้ทุกแถวที่ยังไม่ถูกใช้ของ user นั้น', async () => {
    mocks.query.mockResolvedValueOnce([{ affectedRows: 3 }, []]);

    await expect(passwordResetRepo.invalidateAllForUser(1)).resolves.toBe(3);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL'),
      [1],
    );
  });

  it('markUsed — ตั้ง used_at = NOW() ให้แถวเดียวตาม id', async () => {
    mocks.query.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    await expect(passwordResetRepo.markUsed(10)).resolves.toBe(1);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('SET used_at = NOW() WHERE password_reset_token_id = ? AND used_at IS NULL'),
      [10],
    );
  });
});
