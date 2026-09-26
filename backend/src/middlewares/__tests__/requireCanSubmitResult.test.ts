import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../repositories/matchResult.repo.js', () => ({ findmatchResultByMatchId: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../utils/checkExist.js', () => ({ checkMatch: vi.fn(), checkMatchResult: vi.fn() }));
vi.mock('../../repositories/tournamentReferee.repo.js', () => ({ findLatestByTournamentAndUser: vi.fn() }));
vi.mock('../../repositories/matchReferee.repo.js', () => ({ findByMatch: vi.fn(() => Promise.resolve([])), countAcceptedByMatch: vi.fn() }));
vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/team.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn() }));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../../services/referee.service.js', () => ({ isActiveReferee: vi.fn(() => true), refereesNeededPerMatch: vi.fn() }));

import { requireCanSubmitResult } from '../requireReferee.js';
import { checkMatch } from '../../utils/checkExist.js';
import * as MatchRefereeRepo from '../../repositories/matchReferee.repo.js';

const REFEREE = 9002;
const req = () => ({ user: { user_id: REFEREE }, params: { id: '1' } }) as unknown as Request;
const match = (status: string) => ({ match_id: 1, tournament_id: 50, team_a_id: 11, team_b_id: 12, mode: 'onsite', match_status: status }) as never;

async function run(status: string) {
  const next = vi.fn();
  vi.mocked(checkMatch).mockResolvedValue(match(status));
  await requireCanSubmitResult(req(), {} as Response, next as NextFunction);
  return next.mock.calls[0]?.[0] as { status: number; code: string; extra?: Record<string, unknown> } | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  // กรรมการของแมตช์นี้ — ให้ผ่านด่านบทบาท จะได้เหลือแต่ด่านสถานะให้ทดสอบ
  vi.mocked(MatchRefereeRepo.findByMatch).mockResolvedValue([{ user_id: REFEREE }] as never);
});

/**
 * OD-26 ข้อ 2+4 (มติ 26 ก.ย.) — ต้องกด "จบการแข่งขัน" ก่อนถึงส่งผลได้
 * ก่อนหน้านี้ด่านนี้ไม่เช็ค match_status เลย ส่งผลแมตช์ที่ยัง scheduled ก็ยังได้
 */
describe('requireCanSubmitResult — the match must be finished first', () => {
  it.each(['scheduled', 'checkin_open', 'in_progress'])('409 MATCH_NOT_FINISHED while the match is %s', async (status) => {
    const err = await run(status);
    expect(err).toMatchObject({ status: 409, code: 'MATCH_NOT_FINISHED' });
    expect(err!.extra).toEqual({ status });
  });

  it('lets a finished match through', async () => {
    expect(await run('finished')).toBeUndefined();
  });

  // ผลถูก ORG ถอน (S04 reject) — แมตช์แข่งจบไปแล้วจริง ส่งใหม่ได้โดยไม่ต้องกดจบซ้ำ
  it('lets result_rejected through so the result can be re-submitted', async () => {
    expect(await run('result_rejected')).toBeUndefined();
  });
});
