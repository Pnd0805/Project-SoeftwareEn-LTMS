import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../repositories/matchResult.repo.js', () => ({ findmatchResultByMatchId: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../utils/checkExist.js', () => ({ checkMatch: vi.fn(), checkMatchResult: vi.fn() }));
vi.mock('../../repositories/matchReferee.repo.js', () => ({ findByMatch: vi.fn(() => Promise.resolve([])), countAcceptedByMatch: vi.fn() }));
vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/team.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn() }));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../../services/referee.service.js', () => ({
  findActiveRefereeRow: vi.fn(() => Promise.resolve({ tournament_referee_id: 1 })),
  refereesNeededPerMatch: vi.fn(),
}));

import { requireCanOverrideResult } from '../requireReferee.js';
import { checkMatch, checkMatchResult } from '../../utils/checkExist.js';
import * as MatchRefereeRepo from '../../repositories/matchReferee.repo.js';

const REFEREE = 9002;
const OUTSIDER = 9999;

const req = (userId = REFEREE) => ({ user: { user_id: userId }, params: { id: '1' } }) as unknown as Request;

const match = (mode: 'online' | 'onsite') =>
  ({ match_id: 1, tournament_id: 50, team_a_id: 11, team_b_id: 12, mode, match_status: 'finished' }) as never;

const result = (status: string) => ({ match_result_id: 7, match_id: 1, match_result_status: status }) as never;

async function run(opts: { mode?: 'online' | 'onsite'; status?: string; userId?: number } = {}) {
  const next = vi.fn();
  vi.mocked(checkMatch).mockResolvedValue(match(opts.mode ?? 'online'));
  vi.mocked(checkMatchResult).mockResolvedValue(result(opts.status ?? 'submitted'));
  await requireCanOverrideResult(req(opts.userId), {} as Response, next as NextFunction);
  return next.mock.calls[0]?.[0] as { status: number; code: string; extra?: Record<string, unknown> } | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(MatchRefereeRepo.findByMatch).mockResolvedValue([{ user_id: REFEREE }] as never);
});

/**
 * S02b (OD-55 · 4 ต.ค.) — กรรมการเขียนผลทับในโหมด online
 *
 * ★ ความเสี่ยงของเส้นนี้ไม่ใช่ "พัง" แต่เป็น **ด่านหลุดแบบเงียบ** — ถ้าด่านไหนหลุด
 *   endpoint จะยังตอบ 200 ปกติ แค่ให้คนที่ไม่ควรแก้ได้แก้ หรือแก้ของที่แตะไม่ได้แล้ว
 *   เทสชุดนี้จึงตรึงทั้งสามด่านแยกกัน ไม่ใช่แค่เทสว่าเส้นทางที่ถูกต้องผ่าน
 */
describe('requireCanOverrideResult — ด่านโหมด', () => {
  it('ปล่อยผ่านในโหมด online', async () => {
    expect(await run({ mode: 'online' })).toBeUndefined();
  });

  it('409 OVERRIDE_ONSITE_NOT_ALLOWED ในโหมด onsite', async () => {
    const err = await run({ mode: 'onsite' });
    // onsite กรรมการเป็นคนส่งผลเองตั้งแต่ต้น (S01) ⇒ แก้ด้วยการส่งใหม่ทับได้เลย ไม่ต้องมีเส้นพิเศษ
    expect(err).toMatchObject({ status: 409, code: 'OVERRIDE_ONSITE_NOT_ALLOWED' });
    expect(err!.extra).toEqual({ mode: 'onsite' });
  });
});

describe('requireCanOverrideResult — ด่านสถานะผล (มติข้อ ①)', () => {
  it('ผ่านเฉพาะผลที่ยังรอยืนยัน', async () => {
    expect(await run({ status: 'submitted' })).toBeUndefined();
  });

  /**
   * ★ `verified` คือเคสที่สำคัญที่สุด — สาย (next_match_id) และตารางคะแนนขยับไปแล้ว
   *   ถ้าปล่อยให้เขียนทับตรงนี้ จะได้ผลใหม่โดยที่ของเดิมไม่เคยถูกถอนออกจากสาย/standings
   *   (เส้นนี้ไม่มี undoOutcomeTx — มีแต่ใน S04) ⇒ ข้อมูลเพี้ยนแบบไม่มี error ฟ้องเลย
   */
  it.each(['verified', 'disputed', 'rejected', 'walkover'])(
    '409 RESULT_NOT_OVERRIDABLE เมื่อผลอยู่ที่ %s', async (status) => {
      const err = await run({ status });
      expect(err).toMatchObject({ status: 409, code: 'RESULT_NOT_OVERRIDABLE' });
      expect(err!.extra).toEqual({ status });
    });
});

describe('requireCanOverrideResult — ด่านบทบาท', () => {
  it('403 ถ้าไม่ใช่กรรมการของแมตช์นี้', async () => {
    expect(await run({ userId: OUTSIDER })).toMatchObject({ status: 403, code: 'WRONG_SUBMITTER_ROLE' });
  });

  it('403 ถ้าเป็นกรรมการของทัวร์แต่ไม่ได้รับมอบหมายแมตช์นี้', async () => {
    vi.mocked(MatchRefereeRepo.findByMatch).mockResolvedValue([] as never);
    expect(await run()).toMatchObject({ status: 403, code: 'WRONG_SUBMITTER_ROLE' });
  });

  it('401 ถ้าไม่ได้ล็อกอิน', async () => {
    const next = vi.fn();
    await requireCanOverrideResult({ params: { id: '1' } } as unknown as Request, {} as Response, next as NextFunction);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ status: 401, code: 'NO_TOKEN' });
  });
});

describe('requireCanOverrideResult — ลำดับด่าน', () => {
  /**
   * ด่านโหมดต้องมาก่อนด่านอื่น — คนที่ยิงผิดโหมดควรได้ข้อความที่บอกว่า "โหมดนี้ใช้เส้นนี้ไม่ได้"
   * ไม่ใช่ 403 ว่าไม่ใช่กรรมการ ซึ่งทำให้ไปหาสาเหตุผิดทาง
   */
  it('บอกเรื่องโหมดก่อน แม้คนยิงจะไม่ใช่กรรมการด้วย', async () => {
    expect(await run({ mode: 'onsite', userId: OUTSIDER }))
      .toMatchObject({ code: 'OVERRIDE_ONSITE_NOT_ALLOWED' });
  });

  it('บอกเรื่องสถานะผลก่อนเรื่องบทบาท', async () => {
    expect(await run({ status: 'verified', userId: OUTSIDER }))
      .toMatchObject({ code: 'RESULT_NOT_OVERRIDABLE' });
  });
});
