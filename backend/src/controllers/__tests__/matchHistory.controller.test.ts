import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/matchHistory.service.js', () => ({
  getMatchHistory: vi.fn(),
}));

import { getMatchHistory } from '../matchHistory.controller.js';
import * as MatchHistoryService from '../../services/matchHistory.service.js';

const mockedService = vi.mocked(MatchHistoryService);

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('matchHistory.controller getMatchHistory()', () => {
  it('passes the target user id and the viewer id to the service, responds 200', async () => {
    const req = { params: { id: '12' }, user: { user_id: 3 } } as unknown as Request;
    const res = makeRes();
    const result = { items: [{ match_id: 1 }] };
    mockedService.getMatchHistory.mockResolvedValue(result as never);

    await getMatchHistory(req, res);

    expect(mockedService.getMatchHistory).toHaveBeenCalledWith(12, 3);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('passes undefined as the viewer when the caller is not logged in', async () => {
    const req = { params: { id: '12' } } as unknown as Request;
    const res = makeRes();
    mockedService.getMatchHistory.mockResolvedValue({ items: [] } as never);

    await getMatchHistory(req, res);

    expect(mockedService.getMatchHistory).toHaveBeenCalledWith(12, undefined);
  });

  it.each(['abc', '0', '-1', '1.5'])('rejects id %s with 400 VALIDATION_FAILED before calling the service', async (id) => {
    const req = { params: { id } } as unknown as Request;

    await expect(getMatchHistory(req, makeRes())).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      extra: { fields: { id: expect.stringContaining('รหัสผู้ใช้') } },
    });
    expect(mockedService.getMatchHistory).not.toHaveBeenCalled();
  });

  it('propagates a service error', async () => {
    const req = { params: { id: '12' } } as unknown as Request;
    const err = new Error('DB_DOWN');
    mockedService.getMatchHistory.mockRejectedValue(err);

    await expect(getMatchHistory(req, makeRes())).rejects.toBe(err);
  });
});
