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

describe('publishTournament readiness', () => {
  it('requires active referee pool equal to peak overlapping match demand', async () => {
    mockQueries({
      matches: [
        { match_id: 1, scheduled_time: new Date('2026-10-01T09:00:00Z'), scheduled_end_time: new Date('2026-10-01T10:00:00Z'), mode: 'onsite' },
        { match_id: 2, scheduled_time: new Date('2026-10-01T09:30:00Z'), scheduled_end_time: new Date('2026-10-01T10:30:00Z'), mode: 'online' },
        { match_id: 3, scheduled_time: new Date('2026-10-01T09:45:00Z'), scheduled_end_time: new Date('2026-10-01T10:15:00Z'), mode: 'online' },
      ],
      activeReferees: 3,
    });

    await expect(publishTournament(10, 99)).resolves.toEqual({
      status: 'referees_incomplete',
      refereesAccepted: 3,
      refereesRequired: 4,
    });
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it('rejects publication when any planned match has no complete time interval', async () => {
    mockQueries({
      matches: [
        { match_id: 1, scheduled_time: new Date('2026-10-01T09:00:00Z'), scheduled_end_time: null, mode: 'onsite' },
      ],
      activeReferees: 10,
    });

    await expect(publishTournament(10, 99)).resolves.toEqual({
      status: 'schedule_incomplete',
      plannedMatches: 1,
      matchesMissingSchedule: 1,
    });
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it('treats a match ending exactly when another starts as non-overlapping', async () => {
    mockQueries({
      matches: [
        { match_id: 1, scheduled_time: new Date('2026-10-01T09:00:00Z'), scheduled_end_time: new Date('2026-10-01T10:00:00Z'), mode: 'onsite' },
        { match_id: 2, scheduled_time: new Date('2026-10-01T10:00:00Z'), scheduled_end_time: new Date('2026-10-01T11:00:00Z'), mode: 'onsite' },
      ],
      activeReferees: 2,
    });

    await expect(publishTournament(10, 99)).resolves.toEqual({ status: 'ok' });
    expect(connection.commit).toHaveBeenCalled();
  });
});
