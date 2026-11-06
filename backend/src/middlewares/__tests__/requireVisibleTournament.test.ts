import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../services/tournament.service.js', () => ({ findVisibleTournament: vi.fn() }));

import { requireVisibleTournamentForReads } from '../requireVisibleTournament.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import { findVisibleTournament } from '../../services/tournament.service.js';
import { AppError } from '../../utils/AppError.js';

/**
 * A2 — ด่านอ่านของทัวร์ที่ยังไม่เผยแพร่ ใต้ /tournaments/:id และ /matches/:id
 */

function req(opts: { method?: string; baseUrl: string; id: string; path?: string; userId?: number }): Request {
  return {
    method: opts.method ?? 'GET',
    baseUrl: opts.baseUrl,
    path: opts.path ?? '/matches',
    params: { id: opts.id },
    user: opts.userId === undefined ? undefined : { user_id: opts.userId },
  } as unknown as Request;
}

const res = {} as Response;
const notFound = () => new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้');

async function run(r: Request) {
  const next = vi.fn();
  await requireVisibleTournamentForReads(r, res, next as NextFunction);
  expect(next).toHaveBeenCalledTimes(1);
  return next.mock.calls[0]![0] as unknown;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findVisibleTournament).mockResolvedValue({ tournament_id: 50 } as never);
  vi.mocked(MatchRepo.findById).mockResolvedValue({ match_id: 7, tournament_id: 50 } as never);
});

describe('requireVisibleTournamentForReads — tournament sub-routes', () => {
  it.each(['/matches', '/teams', '/bracket', '/standings', '/announcements'])(
    'GET %s on a visible tournament passes through',
    async (path) => {
      const err = await run(req({ baseUrl: '/api/v1/tournaments/50', id: '50', path, userId: 3 }));
      expect(err).toBeUndefined();
      expect(findVisibleTournament).toHaveBeenCalledWith(50, 3);
      expect(MatchRepo.findById).not.toHaveBeenCalled();
    },
  );

  it('HEAD is treated as a read too', async () => {
    await run(req({ method: 'HEAD', baseUrl: '/api/v1/tournaments/50', id: '50' }));
    expect(findVisibleTournament).toHaveBeenCalledWith(50, undefined);
  });

  it('passes the viewer as undefined when not logged in', async () => {
    await run(req({ baseUrl: '/api/v1/tournaments/50', id: '50' }));
    expect(findVisibleTournament).toHaveBeenCalledWith(50, undefined);
  });

  it('forwards TOURNAMENT_NOT_FOUND unchanged for a hidden tournament', async () => {
    const hidden = notFound();
    vi.mocked(findVisibleTournament).mockRejectedValueOnce(hidden);

    const err = await run(req({ baseUrl: '/api/v1/tournaments/50', id: '50', path: '/bracket' }));
    expect(err).toBe(hidden);
  });

  it('skips the check for GET /tournaments/:id itself (route has its own guard)', async () => {
    const err = await run(req({ baseUrl: '/api/v1/tournaments/50', id: '50', path: '/' }));
    expect(err).toBeUndefined();
    expect(findVisibleTournament).not.toHaveBeenCalled();
  });
});

describe('requireVisibleTournamentForReads — /matches/:id', () => {
  it('looks up the match, then checks its tournament', async () => {
    const err = await run(req({ baseUrl: '/api/v1/matches/7', id: '7', path: '/', userId: 3 }));

    expect(err).toBeUndefined();
    expect(MatchRepo.findById).toHaveBeenCalledWith(7);
    expect(findVisibleTournament).toHaveBeenCalledWith(50, 3);
  });

  it('checks the tournament even for GET /matches/:id itself (path "/")', async () => {
    await run(req({ baseUrl: '/api/v1/matches/7', id: '7', path: '/' }));
    expect(findVisibleTournament).toHaveBeenCalledTimes(1);
  });

  it('turns a hidden tournament into MATCH_NOT_FOUND so the error does not reveal the tournament exists', async () => {
    vi.mocked(findVisibleTournament).mockRejectedValueOnce(notFound());

    const err = await run(req({ baseUrl: '/api/v1/matches/7', id: '7', path: '/result' }));

    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ status: 404, code: 'MATCH_NOT_FOUND' });
  });

  it('lets an unknown match through so the route answers MATCH_NOT_FOUND itself', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValueOnce(null as never);

    const err = await run(req({ baseUrl: '/api/v1/matches/999', id: '999', path: '/' }));

    expect(err).toBeUndefined();
    expect(findVisibleTournament).not.toHaveBeenCalled();
  });

  it('forwards non-404 errors from the visibility check unchanged', async () => {
    const forbidden = new AppError(403, 'FORBIDDEN', 'x');
    vi.mocked(findVisibleTournament).mockRejectedValueOnce(forbidden);

    const err = await run(req({ baseUrl: '/api/v1/matches/7', id: '7', path: '/' }));
    expect(err).toBe(forbidden);
  });

  it('forwards a repository failure to next()', async () => {
    const dbDown = new Error('DB_DOWN');
    vi.mocked(MatchRepo.findById).mockRejectedValueOnce(dbDown);

    const err = await run(req({ baseUrl: '/api/v1/matches/7', id: '7', path: '/' }));
    expect(err).toBe(dbDown);
  });

  it('does not treat /tournaments/7 as a match route just because the id matches', async () => {
    await run(req({ baseUrl: '/api/v1/tournaments/7', id: '7', path: '/matches' }));
    expect(MatchRepo.findById).not.toHaveBeenCalled();
    expect(findVisibleTournament).toHaveBeenCalledWith(7, undefined);
  });
});

describe('requireVisibleTournamentForReads — requests it does not guard', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s is never checked (writes have their own guards)', async (method) => {
    vi.mocked(findVisibleTournament).mockRejectedValue(notFound());

    const err = await run(req({ method, baseUrl: '/api/v1/tournaments/50', id: '50' }));

    expect(err).toBeUndefined();
    expect(findVisibleTournament).not.toHaveBeenCalled();
    expect(MatchRepo.findById).not.toHaveBeenCalled();
  });

  it.each(['abc', '0', '-5', '1.5', ''])('id %j is left to the route to validate', async (id) => {
    const err = await run(req({ baseUrl: `/api/v1/tournaments/${id}`, id }));

    expect(err).toBeUndefined();
    expect(findVisibleTournament).not.toHaveBeenCalled();
  });
});
