import { describe, it, expect, vi, beforeEach } from 'vitest';

const conn = { beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), query: vi.fn(async () => [{ insertId: 1, affectedRows: 1 }]) };
vi.mock('../../config/db.js', () => ({ default: { getConnection: vi.fn(async () => conn) } }));
vi.mock('../../repositories/application.repo.js', () => ({ findApprovedTeamsByTournament: vi.fn(async () => [{ team_id: 1 }, { team_id: 2 }, { team_id: 3 }, { team_id: 4 }]) }));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn(async () => ({ tournament_id: 50, min_teams: 2, sport_type_id: 1, bracket_format: 'round_robin' })) }));
vi.mock('../../repositories/match.repo.js', () => ({
  countMatchesByTournament: vi.fn(async () => 6),
  findBracketUsage: vi.fn(async () => []),
  clearBracketTx: vi.fn(async () => ({ matchesDeleted: 6, nodesDeleted: 0 })),
  insertMatchTx: vi.fn(async () => 1),
  updateMatchNextMatchIdTx: vi.fn(),
}));
vi.mock('../../repositories/bracketNode.repo.js', () => ({ insertBracketNodeTx: vi.fn(async () => 1) }));
vi.mock('../../repositories/sportType.repo.js', () => ({ findSportTypeById: vi.fn(async () => ({ default_mode: 'onsite' })) }));

import { createBracket } from '../bracket.service.js';
import * as MatchRepo from '../../repositories/match.repo.js';

beforeEach(() => vi.clearAllMocks());

// OD-22 (21 ก.ย.) — จับฉลากซ้ำ: 1-ข ทุกแมตช์ scheduled + ไม่มีเช็คอิน/ผล · 2-ก M01 + replace: true
describe('createBracket replace', () => {
  it('without replace an existing bracket is still refused', async () => {
    await expect(createBracket(50, 'random', undefined)).rejects.toMatchObject({ status: 409, code: 'BRACKET_ALREADY_EXISTS', extra: { matchCount: 6 } });
    expect(MatchRepo.clearBracketTx).not.toHaveBeenCalled();
  });

  it('replace clears the old bracket and rebuilds inside one transaction', async () => {
    await expect(createBracket(50, 'random', undefined, true)).resolves.toMatchObject({ bracketFormat: 'round_robin', matchCount: 6, replaced: true });
    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(MatchRepo.clearBracketTx).toHaveBeenCalledWith(conn, 50);
    expect(MatchRepo.insertMatchTx).toHaveBeenCalledTimes(6);
    expect(vi.mocked(MatchRepo.insertMatchTx).mock.calls.every(c => c[0] === conn)).toBe(true);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it('replace is refused with BRACKET_IN_USE when any match started, has check-ins or a result', async () => {
    vi.mocked(MatchRepo.findBracketUsage).mockResolvedValueOnce([{ match_id: 3, match_status: 'checkin_open', checkins: 2, results: 0 }]);
    await expect(createBracket(50, 'random', undefined, true)).rejects.toMatchObject({
      status: 409, code: 'BRACKET_IN_USE', extra: { matches: [{ id: 3, status: 'checkin_open', checkins: 2, results: 0 }] },
    });
    expect(MatchRepo.clearBracketTx).not.toHaveBeenCalled();
  });

  it('rolls back the whole replacement when the rebuild fails — old bracket survives', async () => {
    vi.mocked(MatchRepo.insertMatchTx).mockRejectedValueOnce(new Error('boom'));
    await expect(createBracket(50, 'random', undefined, true)).rejects.toThrow('boom');
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it('first draw (no matches yet) is unchanged: own transaction, replaced=false', async () => {
    vi.mocked(MatchRepo.countMatchesByTournament).mockResolvedValueOnce(0);
    await expect(createBracket(50, 'random', undefined, true)).resolves.toMatchObject({ replaced: false });
    expect(MatchRepo.clearBracketTx).not.toHaveBeenCalled();
  });
});
