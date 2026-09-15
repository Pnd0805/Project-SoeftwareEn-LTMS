import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/invitation.service.js', () => ({
  acceptInvitation: vi.fn(),
  rejectInvitation: vi.fn(),
}));

vi.mock('../../utils/parseId.js', () => ({
  parseId: vi.fn(),
}));

import { acceptInvitation, rejectInvitation } from '../invitation.controller.js';
import * as InvitationService from '../../services/invitation.service.js';
import { parseId } from '../../utils/parseId.js';
import { AppError } from '../../utils/AppError.js';

const mockedInvitationService = vi.mocked(InvitationService);
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

describe('invitation.controller acceptInvitation()', () => {
  it('parses the invitation id and accepts it as the authenticated user, responds 200', async () => {
    const req = { params: { id: '5' }, user: { user_id: 1 } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(5);
    const serviceResult = { id: 5, status: 'accepted' };
    mockedInvitationService.acceptInvitation.mockResolvedValue(serviceResult as any);

    await acceptInvitation(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('5', 'รหัสคำเชิญ', 'id');
    expect(mockedInvitationService.acceptInvitation).toHaveBeenCalledWith(5, 1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates the error and never calls the service when parseId fails', async () => {
    const req = { params: { id: 'bad' }, user: { user_id: 1 } } as unknown as Request;
    const res = makeRes();
    const parseError = new AppError(400, 'VALIDATION_FAILED', 'x');
    mockedParseId.mockImplementation(() => {
      throw parseError;
    });

    await expect(acceptInvitation(req, res)).rejects.toBe(parseError);
    expect(mockedInvitationService.acceptInvitation).not.toHaveBeenCalled();
  });

  it('propagates a service error (e.g. invitation already decided)', async () => {
    const req = { params: { id: '5' }, user: { user_id: 1 } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(5);
    const serviceError = new AppError(409, 'INVITATION_ALREADY_DECIDED', 'x');
    mockedInvitationService.acceptInvitation.mockRejectedValue(serviceError);

    await expect(acceptInvitation(req, res)).rejects.toBe(serviceError);
  });
});

describe('invitation.controller rejectInvitation()', () => {
  it('parses the invitation id, rejects it, and responds 204 with no body', async () => {
    const req = { params: { id: '5' }, user: { user_id: 1 } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(5);
    mockedInvitationService.rejectInvitation.mockResolvedValue(undefined as any);

    await rejectInvitation(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('5', 'รหัสคำเชิญ', 'id');
    expect(mockedInvitationService.rejectInvitation).toHaveBeenCalledWith(5, 1);
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

    await expect(rejectInvitation(req, res)).rejects.toBe(parseError);
    expect(mockedInvitationService.rejectInvitation).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
