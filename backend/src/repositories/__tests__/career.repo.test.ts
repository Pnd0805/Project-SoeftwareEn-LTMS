import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));

import { findCareerByUser } from '../career.repo.js';

beforeEach(() => vi.clearAllMocks());

describe('career.repo', () => {
  it('builds career only from approved applications and verified match results', async () => {
    mocks.query.mockResolvedValueOnce([[], []]);
    await findCareerByUser(9);

    const [sql, values] = mocks.query.mock.calls[0]!;
    expect(sql).toContain("ta.tournament_application_status = 'approved'");
    expect(sql).toContain("mr.match_result_status = 'verified'");
    expect(sql).toContain('t.deleted_at IS NULL');
    expect(sql).not.toContain("mr.match_result_status = 'walkover'");
    expect(values).toEqual([9]);
  });
});
