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
vi.mock('../../repositories/pickem.repo.js', () => ({ findPickerIdsTx: vi.fn(async () => []) }));
vi.mock('../../repositories/matchReferee.repo.js', () => ({ findAssignedUserIdsInTournament: vi.fn(async () => []) }));
vi.mock('../notification.service.js', () => ({ notifyUsers: vi.fn() }));

import { createBracket } from '../bracket.service.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as PickemRepo from '../../repositories/pickem.repo.js';
import * as MatchRefRepo from '../../repositories/matchReferee.repo.js';
import * as NotificationService from '../notification.service.js';

beforeEach(() => vi.clearAllMocks());

// มติ 22 ก.ย. — จับสายใหม่: การทาย/คอมเมนต์ของแมตช์เก่าถูกลบ · แจ้งคนที่ทายไว้ + กรรมการที่ผูกแมตช์เดิม
describe('createBracket replace — notifications', () => {
  it('reads pickers and referees before clearing, notifies them after commit', async () => {
    vi.mocked(PickemRepo.findPickerIdsTx).mockResolvedValueOnce([301, 302]);
    vi.mocked(MatchRefRepo.findAssignedUserIdsInTournament).mockResolvedValueOnce([401]);

    await createBracket(50, 'random', undefined, true);

    expect(PickemRepo.findPickerIdsTx).toHaveBeenCalledWith(conn, 50);
    expect(vi.mocked(PickemRepo.findPickerIdsTx).mock.invocationCallOrder[0]!)
      .toBeLessThan(vi.mocked(MatchRepo.clearBracketTx).mock.invocationCallOrder[0]!);
    expect(NotificationService.notifyUsers).toHaveBeenCalledWith([301, 302], expect.objectContaining({ type: 'pickem_cancelled', relatedEntityId: 50 }));
    expect(NotificationService.notifyUsers).toHaveBeenCalledWith([401], expect.objectContaining({ type: 'bracket_redrawn' }));
    expect(vi.mocked(NotificationService.notifyUsers).mock.invocationCallOrder[0]!)
      .toBeGreaterThan(conn.commit.mock.invocationCallOrder[0]!);
  });

  it('nothing is sent when the rebuild fails and rolls back', async () => {
    vi.mocked(PickemRepo.findPickerIdsTx).mockResolvedValueOnce([301]);
    vi.mocked(MatchRepo.insertMatchTx).mockRejectedValueOnce(new Error('boom'));
    await expect(createBracket(50, 'random', undefined, true)).rejects.toThrow('boom');
    expect(NotificationService.notifyUsers).not.toHaveBeenCalled();
  });

  it('a first-time bracket (not a replace) sends nothing', async () => {
    vi.mocked(MatchRepo.countMatchesByTournament).mockResolvedValueOnce(0);
    await createBracket(50, 'random', undefined);
    expect(PickemRepo.findPickerIdsTx).not.toHaveBeenCalled();
    expect(NotificationService.notifyUsers).not.toHaveBeenCalled();
  });
});

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
