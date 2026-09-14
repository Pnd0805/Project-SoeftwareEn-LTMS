import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/application.service.js', () => ({
  getApprovedTeams: vi.fn(),
  getMyappication: vi.fn(),
  getTournamentApplications: vi.fn(),
  getApplicationDetail: vi.fn(),
  cancelApplication: vi.fn(),
  withdrawApplication: vi.fn(),
  approveApplication: vi.fn(),
  rejectApplication: vi.fn(),
  applyTournament: vi.fn(),
}));

vi.mock('../../utils/parseId.js', () => ({
  parseId: vi.fn(),
}));

import {
  getTournamentTeams,
  getMyappication,
  getTournamentApplications,
  getApplicationDetail,
  cancelApplication,
  withdrawApplication,
  approveApplication,
  rejectApplication,
  applyTournament,
} from '../application.controller.js';
import * as ApplicationService from '../../services/application.service.js';
import { parseId } from '../../utils/parseId.js';
import { AppError } from '../../utils/AppError.js';

const mockedApplicationService = vi.mocked(ApplicationService);
const mockedParseId = vi.mocked(parseId);

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('application.controller getTournamentTeams()', () => {
  it('parses the tournament id and responds 200 with approved teams', async () => {
    const req = { params: { id: '3' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(3);
    const serviceResult = { items: [{ id: 1 }] };
    mockedApplicationService.getApprovedTeams.mockResolvedValue(serviceResult as any);

    await getTournamentTeams(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('3', 'รหัสทัวร์นาเมนต์');
    expect(mockedApplicationService.getApprovedTeams).toHaveBeenCalledWith(3);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates the error and never calls the service when parseId fails', async () => {
    const req = { params: { id: 'bad' } } as unknown as Request;
    const res = makeRes();
    const parseError = new AppError(400, 'VALIDATION_FAILED', 'x');
    mockedParseId.mockImplementation(() => {
      throw parseError;
    });

    await expect(getTournamentTeams(req, res)).rejects.toBe(parseError);
    expect(mockedApplicationService.getApprovedTeams).not.toHaveBeenCalled();
  });
});

describe('application.controller getMyappication()', () => {
  it('throws USER_NOT_FOUND before touching res when req.user is missing', async () => {
    const req = { user: undefined } as Request;
    const res = makeRes();

    await expect(getMyappication(req, res)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(mockedApplicationService.getMyappication).not.toHaveBeenCalled();
  });

  it("fetches the authenticated user's applications and responds 200", async () => {
    const req = { user: { user_id: 1 } } as unknown as Request;
    const res = makeRes();
    const serviceResult = { items: [{ id: 1 }] };
    mockedApplicationService.getMyappication.mockResolvedValue(serviceResult as any);

    await getMyappication(req, res);

    expect(mockedApplicationService.getMyappication).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });
});

describe('application.controller getTournamentApplications()', () => {
  it('parses the tournament id and responds 200 with applications', async () => {
    const req = { params: { id: '3' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(3);
    const serviceResult = { items: [{ id: 1 }] };
    mockedApplicationService.getTournamentApplications.mockResolvedValue(serviceResult as any);

    await getTournamentApplications(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('3', 'รหัสทัวร์นาเมนต์');
    expect(mockedApplicationService.getTournamentApplications).toHaveBeenCalledWith(3);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });
});

describe('application.controller getApplicationDetail()', () => {
  it('throws USER_NOT_FOUND before touching res when req.user is missing', async () => {
    const req = { user: undefined, params: { id: '1' } } as unknown as Request;
    const res = makeRes();

    await expect(getApplicationDetail(req, res)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(mockedParseId).not.toHaveBeenCalled();
  });

  it('parses the application id and responds 200 with the detail', async () => {
    const req = { user: { user_id: 1 }, params: { id: '7' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(7);
    const serviceResult = { id: 7, status: 'pending' };
    mockedApplicationService.getApplicationDetail.mockResolvedValue(serviceResult as any);

    await getApplicationDetail(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('7', 'รหัสใบสมัคร');
    expect(mockedApplicationService.getApplicationDetail).toHaveBeenCalledWith(7, 1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });
});

describe('application.controller cancelApplication()', () => {
  it('throws USER_NOT_FOUND before touching res when req.user is missing', async () => {
    const req = { user: undefined, params: { id: '1' } } as unknown as Request;
    const res = makeRes();

    await expect(cancelApplication(req, res)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(mockedApplicationService.cancelApplication).not.toHaveBeenCalled();
  });

  it('parses the application id and cancels it, responds 200', async () => {
    const req = { user: { user_id: 1 }, params: { id: '7' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(7);
    const serviceResult = { id: 7, status: 'cancelled' };
    mockedApplicationService.cancelApplication.mockResolvedValue(serviceResult as any);

    await cancelApplication(req, res);

    expect(mockedApplicationService.cancelApplication).toHaveBeenCalledWith(7, 1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });
});

describe('application.controller withdrawApplication()', () => {
  it('throws USER_NOT_FOUND before touching res when req.user is missing', async () => {
    const req = { user: undefined, params: { id: '1' } } as unknown as Request;
    const res = makeRes();

    await expect(withdrawApplication(req, res)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(mockedApplicationService.withdrawApplication).not.toHaveBeenCalled();
  });

  it('parses the application id and withdraws it, responds 200', async () => {
    const req = { user: { user_id: 1 }, params: { id: '7' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(7);
    const serviceResult = { id: 7, status: 'withdrawn' };
    mockedApplicationService.withdrawApplication.mockResolvedValue(serviceResult as any);

    await withdrawApplication(req, res);

    expect(mockedApplicationService.withdrawApplication).toHaveBeenCalledWith(7, 1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });
});

describe('application.controller approveApplication()', () => {
  it('throws USER_NOT_FOUND before touching res when req.user is missing', async () => {
    const req = { user: undefined, params: { id: '1' } } as unknown as Request;
    const res = makeRes();

    await expect(approveApplication(req, res)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(mockedApplicationService.approveApplication).not.toHaveBeenCalled();
  });

  it('parses the application id and approves it, responds 200', async () => {
    const req = { user: { user_id: 1 }, params: { id: '7' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(7);
    const serviceResult = { id: 7, status: 'approved' };
    mockedApplicationService.approveApplication.mockResolvedValue(serviceResult as any);

    await approveApplication(req, res);

    expect(mockedApplicationService.approveApplication).toHaveBeenCalledWith(7, 1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });
});

describe('application.controller rejectApplication()', () => {
  it('throws USER_NOT_FOUND before touching res when req.user is missing', async () => {
    const req = { user: undefined, params: { id: '1' }, body: {} } as unknown as Request;
    const res = makeRes();

    await expect(rejectApplication(req, res)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(mockedApplicationService.rejectApplication).not.toHaveBeenCalled();
  });

  it('parses the application id and rejects it with a reason, responds 200', async () => {
    const req = {
      user: { user_id: 1 },
      params: { id: '7' },
      body: { reason: 'ไม่ครบเงื่อนไข' },
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(7);
    const serviceResult = { id: 7, status: 'rejected' };
    mockedApplicationService.rejectApplication.mockResolvedValue(serviceResult as any);

    await rejectApplication(req, res);

    expect(mockedApplicationService.rejectApplication).toHaveBeenCalledWith(7, 1, 'ไม่ครบเงื่อนไข');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });
});

describe('application.controller applyTournament()', () => {
  it('throws USER_NOT_FOUND before touching res when req.user is missing', async () => {
    const req = { user: undefined, params: { id: '1' }, body: {} } as unknown as Request;
    const res = makeRes();

    await expect(applyTournament(req, res)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(mockedApplicationService.applyTournament).not.toHaveBeenCalled();
  });

  it('parses the tournament id, applies with the team from the body, and responds 201', async () => {
    const req = {
      user: { user_id: 1 },
      params: { id: '3' },
      body: { teamId: 9 },
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(3);
    const serviceResult = { id: 100, tournamentId: 3, teamId: 9 };
    mockedApplicationService.applyTournament.mockResolvedValue(serviceResult as any);

    await applyTournament(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('3', 'รหัสทัวร์นาเมนต์');
    expect(mockedApplicationService.applyTournament).toHaveBeenCalledWith(3, 9, 1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates a service error (e.g. team already applied)', async () => {
    const req = {
      user: { user_id: 1 },
      params: { id: '3' },
      body: { teamId: 9 },
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(3);
    const serviceError = new AppError(409, 'ALREADY_APPLIED', 'x');
    mockedApplicationService.applyTournament.mockRejectedValue(serviceError);

    await expect(applyTournament(req, res)).rejects.toBe(serviceError);
  });
});
