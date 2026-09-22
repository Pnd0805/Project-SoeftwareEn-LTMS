import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const query = vi.fn();
  const connection = {
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
    query,
  };
  return { query, connection };
});

vi.mock('../../config/db.js', () => ({
  default: {
    query: mocks.query,
    getConnection: vi.fn(async () => mocks.connection),
  },
}));

import { insertTournament, softDeleteTournament, updateTournamentGeneral } from '../tournament.repo.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('tournament entry notes persistence', () => {
  it('stores entryNotes when creating a tournament', async () => {
    mocks.query
      .mockResolvedValueOnce([{ insertId: 55 }, []])
      .mockResolvedValueOnce([{ affectedRows: 0 }, []]);

    await expect(insertTournament({
      name: 'KU Open',
      sportTypeId: 1,
      bracketFormat: 'single_elimination',
      scopeType: 'faculty',
      organizingFacultyId: 1,
      organizingDepartmentId: null,
      requestedByUserId: 9,
      registrationStart: '2026-10-01T00:00:00Z',
      registrationEnd: '2026-10-05T00:00:00Z',
      eventStartDate: '2026-10-10',
      eventEndDate: '2026-10-10',
      maxTeams: 8,
      minTeams: 2,
      venue: 'สนามกีฬา',
      entryNotes: 'กรุณานำบัตรนิสิตมาแสดง',
      genderRequirement: 'any',
      minAge: null,
      maxAge: null,
      eligibilityRules: [],
    })).resolves.toBe(55);

    const [sql, values] = mocks.query.mock.calls[0]!;
    expect(sql).toContain('entry_notes');
    expect(values).toContain('กรุณานำบัตรนิสิตมาแสดง');
  });

  it('updates and clears entryNotes through the general tournament update', async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 1 }, []]);

    await expect(updateTournamentGeneral(10, 99, { entryNotes: 'เอกสารเพิ่มเติมตามประกาศ' })).resolves.toBe(true);
    expect(mocks.query).toHaveBeenLastCalledWith(
      expect.stringContaining('entry_notes = ?'),
      ['เอกสารเพิ่มเติมตามประกาศ', 99, 10],
    );

    await expect(updateTournamentGeneral(10, 99, { entryNotes: null })).resolves.toBe(true);
    expect(mocks.query).toHaveBeenLastCalledWith(
      expect.stringContaining('entry_notes = ?'),
      [null, 99, 10],
    );
  });

  it('soft-deletes the tournament and writes the audit log in the same transaction', async () => {
    mocks.query
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    await expect(softDeleteTournament(10, 99)).resolves.toBe(true);
    expect(mocks.query.mock.calls[0]![0]).toContain('deleted_at = NOW()');
    expect(mocks.query.mock.calls[0]![0]).toContain("tournament_status IN ('pending_approval', 'rejected', 'private')");
    expect(mocks.query.mock.calls[1]![0]).toContain('INSERT INTO audit_logs');
    expect(mocks.connection.commit).toHaveBeenCalledTimes(1);
  });
});
