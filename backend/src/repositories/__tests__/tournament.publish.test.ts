import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const connection = {
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  query,
};

vi.mock('../../config/db.js', () => ({
  default: {
    getConnection: vi.fn(async () => connection),
  },
}));

import { publishTournament } from '../tournament.repo.js';

beforeEach(() => {
  vi.clearAllMocks();
});

function mockQueries(options: {
  matches: Array<{ match_id: number; scheduled_time: Date | null; scheduled_end_time: Date | null; mode: 'onsite' | 'online' }>;
  activeReferees: number;
}) {
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT tournament_status')) {
      return [[{ tournament_status: 'private' }], []];
    }
    if (sql.includes('FROM matches')) {
      return [options.matches, []];
    }
    if (sql.includes('FROM (') && sql.includes('tournament_referees')) {
      return [[{ total: options.activeReferees }], []];
    }
    if (sql.includes('UPDATE tournaments')) {
      return [{ affectedRows: 1 }, []];
    }
    throw new Error(`Unexpected SQL in test: ${sql}`);
  });
}

// BR-10 ด่าน 1 (GUIDE/11 §10.2): publish ต้องมี active pool ≥ refereesRequired (คำนวณใน service จากกีฬา)
// ตอน publish ยังไม่มีแมตช์ — repo ไม่ดู matches เลย
describe('publishTournament readiness', () => {
  it('rejects publication when the active referee pool is below refereesRequired', async () => {
    mockQueries({ matches: [], activeReferees: 1 });

    await expect(publishTournament(10, 99, 2)).resolves.toEqual({
      status: 'referees_incomplete',
      refereesAccepted: 1,
    });
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it('publishes when the pool meets refereesRequired even though no match exists yet', async () => {
    mockQueries({ matches: [], activeReferees: 2 });

    await expect(publishTournament(10, 99, 2)).resolves.toEqual({ status: 'ok' });
    expect(connection.commit).toHaveBeenCalled();
  });

  it('accepts a pool of 1 when the sport only needs one referee per match', async () => {
    mockQueries({ matches: [], activeReferees: 1 });

    await expect(publishTournament(10, 99, 1)).resolves.toEqual({ status: 'ok' });
  });
});
