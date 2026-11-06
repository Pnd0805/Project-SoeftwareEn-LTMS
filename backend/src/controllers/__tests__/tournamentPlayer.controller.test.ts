import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/tournamentPlayer.service.js', () => ({
  getTournamentPlayerStats: vi.fn(),
}));

import { getTournamentPlayerStats } from '../tournamentPlayer.controller.js';
import * as TournamentPlayerService from '../../services/tournamentPlayer.service.js';

const mockedService = vi.mocked(TournamentPlayerService);

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// RW06 — GET /tournaments/:id/players/:userId/stats
describe('tournamentPlayer.controller getTournamentPlayerStats()', () => {
  it('passes tournament id and user id (in that order) to the service, responds 200', async () => {
    const req = { params: { id: '50', userId: '7' } } as unknown as Request;
    const res = makeRes();
    const stats = { kills: 10, matches: 3 };
    mockedService.getTournamentPlayerStats.mockResolvedValue(stats as never);

    await getTournamentPlayerStats(req, res);

    expect(mockedService.getTournamentPlayerStats).toHaveBeenCalledWith(50, 7);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(stats);
  });

  it('rejects a bad tournament id with field "id"', async () => {
    const req = { params: { id: 'x', userId: '7' } } as unknown as Request;

    await expect(getTournamentPlayerStats(req, makeRes())).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      extra: { fields: { id: expect.stringContaining('รหัสทัวร์นาเมนต์') } },
    });
    expect(mockedService.getTournamentPlayerStats).not.toHaveBeenCalled();
  });

  it('rejects a bad user id with field "userId" (not "id")', async () => {
    const req = { params: { id: '50', userId: '0' } } as unknown as Request;

    const err = await getTournamentPlayerStats(req, makeRes()).catch((e) => e);
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(err.extra.fields).toEqual({ userId: expect.stringContaining('รหัสผู้ใช้') });
    expect(mockedService.getTournamentPlayerStats).not.toHaveBeenCalled();
  });

  it('propagates a service error (e.g. player not in tournament)', async () => {
    const req = { params: { id: '50', userId: '7' } } as unknown as Request;
    const err = Object.assign(new Error('x'), { status: 404 });
    mockedService.getTournamentPlayerStats.mockRejectedValue(err);

    await expect(getTournamentPlayerStats(req, makeRes())).rejects.toBe(err);
  });
});
