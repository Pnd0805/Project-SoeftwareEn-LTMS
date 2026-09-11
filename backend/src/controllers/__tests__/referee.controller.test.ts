import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/referee.service.js', () => ({
  inviteReferee: vi.fn(),
  listTournamentReferees: vi.fn(),
  listMyRefereeInvitations: vi.fn(),
  acceptRefereeInvitation: vi.fn(),
  declineRefereeInvitation: vi.fn(),
}));

vi.mock('../../utils/parseId.js', () => ({
  parseId: vi.fn(),
}));

import { invite, list, listMyInvitations, accept, decline } from '../referee.controller.js';
import * as RefereeService from '../../services/referee.service.js';
import { parseId } from '../../utils/parseId.js';
import { AppError } from '../../utils/AppError.js';

const mockedRefereeService = vi.mocked(RefereeService);
const mockedParseId = vi.mocked(parseId);

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('referee.controller invite()', () => {
  it('parses the tournament id and invites a referee using the whole request body, responds 201', async () => {
    const req = {
      params: { id: '3' },
      user: { user_id: 1 },
      body: { userId: 8, isExternal: false },
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(3);
    const serviceResult = { id: 1, tournamentId: 3, userId: 8 };
    mockedRefereeService.inviteReferee.mockResolvedValue(serviceResult as any);

    await invite(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('3', 'รหัสทัวร์นาเมนต์');
    expect(mockedRefereeService.inviteReferee).toHaveBeenCalledWith(3, 1, {
      userId: 8,
      isExternal: false,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates the error and never calls the service when parseId fails', async () => {
    const req = { params: { id: 'bad' }, user: { user_id: 1 }, body: {} } as unknown as Request;
    const res = makeRes();
    const parseError = new AppError(400, 'VALIDATION_FAILED', 'x');
    mockedParseId.mockImplementation(() => {
      throw parseError;
    });

    await expect(invite(req, res)).rejects.toBe(parseError);
    expect(mockedRefereeService.inviteReferee).not.toHaveBeenCalled();
  });
});

describe('referee.controller list()', () => {
  it('parses the tournament id and responds 200 with the referee list', async () => {
    const req = { params: { id: '3' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(3);
    const serviceResult = { items: [{ id: 1 }] };
    mockedRefereeService.listTournamentReferees.mockResolvedValue(serviceResult as any);

    await list(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('3', 'รหัสทัวร์นาเมนต์');
    expect(mockedRefereeService.listTournamentReferees).toHaveBeenCalledWith(3);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });
});

describe('referee.controller listMyInvitations()', () => {
  it("fetches the authenticated user's referee invitations and responds 200", async () => {
    const req = { user: { user_id: 1 } } as unknown as Request;
    const res = makeRes();
    const serviceResult = { items: [{ id: 1 }] };
    mockedRefereeService.listMyRefereeInvitations.mockResolvedValue(serviceResult as any);

    await listMyInvitations(req, res);

    expect(mockedRefereeService.listMyRefereeInvitations).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });
});

describe('referee.controller accept()', () => {
  it('parses the invitation id and accepts it, responds 200', async () => {
    const req = { params: { id: '9' }, user: { user_id: 1 } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(9);
    const serviceResult = { id: 9, status: 'accepted' };
    mockedRefereeService.acceptRefereeInvitation.mockResolvedValue(serviceResult as any);

    await accept(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('9', 'รหัสคำเชิญ');
    expect(mockedRefereeService.acceptRefereeInvitation).toHaveBeenCalledWith(9, 1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates a service error (e.g. invitation already decided)', async () => {
    const req = { params: { id: '9' }, user: { user_id: 1 } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(9);
    const serviceError = new AppError(409, 'INVITATION_ALREADY_DECIDED', 'x');
    mockedRefereeService.acceptRefereeInvitation.mockRejectedValue(serviceError);

    await expect(accept(req, res)).rejects.toBe(serviceError);
  });
});

describe('referee.controller decline()', () => {
  it('parses the invitation id, declines it, and responds 204 with no body', async () => {
    const req = { params: { id: '9' }, user: { user_id: 1 } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(9);
    mockedRefereeService.declineRefereeInvitation.mockResolvedValue(undefined as any);

    await decline(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('9', 'รหัสคำเชิญ');
    expect(mockedRefereeService.declineRefereeInvitation).toHaveBeenCalledWith(9, 1);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('propagates the error and never calls the service when parseId fails', async () => {
    const req = { params: { id: 'bad' }, user: { user_id: 1 } } as unknown as Request;
    const res = makeRes();
    const parseError = new AppError(400, 'VALIDATION_FAILED', 'x');
    mockedParseId.mockImplementation(() => {
      throw parseError;
    });

    await expect(decline(req, res)).rejects.toBe(parseError);
    expect(mockedRefereeService.declineRefereeInvitation).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
