import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/team.service.js', () => ({
  createTeam: vi.fn(),
  getMyTeam: vi.fn(),
  getTeamById: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
}));

import {
  createTeam,
  getMyTeam,
  getTeamById,
  updateTeamById,
  deleteTeamById,
} from '../team.controller.js';
import * as TeamService from '../../services/team.service.js';
import { AppError } from '../../utils/AppError.js';

const mockedTeamService = vi.mocked(TeamService);

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

describe('team.controller createTeam()', () => {
  it('creates a team for the authenticated user and responds 201', async () => {
    const req = { body: { name: 'Team A' }, user: { user_id: 5 } } as Request;
    const res = makeRes();
    const serviceResult = { id: 1, name: 'Team A' };
    mockedTeamService.createTeam.mockResolvedValue(serviceResult as any);

    await createTeam(req, res);

    expect(mockedTeamService.createTeam).toHaveBeenCalledWith(req.body, 5);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates the error when the service throws', async () => {
    const req = { body: {}, user: { user_id: 5 } } as Request;
    const res = makeRes();
    const serviceError = new Error('TEAM_NAME_TAKEN');
    mockedTeamService.createTeam.mockRejectedValue(serviceError);

    await expect(createTeam(req, res)).rejects.toBe(serviceError);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('team.controller getMyTeam()', () => {
  it("fetches the authenticated user's teams and responds 200", async () => {
    const req = { user: { user_id: 5 } } as Request;
    const res = makeRes();
    const serviceResult = { items: [{ id: 1 }] };
    mockedTeamService.getMyTeam.mockResolvedValue(serviceResult as any);

    await getMyTeam(req, res);

    expect(mockedTeamService.getMyTeam).toHaveBeenCalledWith(5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });
});

describe('team.controller getTeamById()', () => {
  it('converts the route param to a number and responds 200 with the team', async () => {
    const req = { params: { id: '42' } } as unknown as Request;
    const res = makeRes();
    const serviceResult = { id: 42, name: 'Team A' };
    mockedTeamService.getTeamById.mockResolvedValue(serviceResult as any);

    await getTeamById(req, res);

    expect(mockedTeamService.getTeamById).toHaveBeenCalledWith(42);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates the error when the team is not found', async () => {
    const req = { params: { id: '999' } } as unknown as Request;
    const res = makeRes();
    const serviceError = new AppError(404, 'TEAM_NOT_FOUND', 'x');
    mockedTeamService.getTeamById.mockRejectedValue(serviceError);

    await expect(getTeamById(req, res)).rejects.toBe(serviceError);
  });
});

describe('team.controller updateTeamById()', () => {
  it('throws TEAM_NOT_FOUND immediately (before touching res) when req.team is missing', async () => {
    const req = { team: undefined, body: {} } as Request;
    const res = makeRes();

    await expect(updateTeamById(req, res)).rejects.toMatchObject({
      status: 404,
      code: 'TEAM_NOT_FOUND',
    });
    // Unlike createTeam()/login(), this throw happens in a plain `if` check
    // BEFORE any res call is made, so res.status is never touched here.
    expect(res.status).not.toHaveBeenCalled();
    expect(mockedTeamService.updateTeam).not.toHaveBeenCalled();
  });

  it('updates the team using fields from req.team and responds 200', async () => {
    const req = {
      team: { team_id: 10, sport_type_id: 2 },
      body: { name: 'New Name' },
    } as unknown as Request;
    const res = makeRes();
    const serviceResult = { id: 10, name: 'New Name' };
    mockedTeamService.updateTeam.mockResolvedValue(serviceResult as any);

    await updateTeamById(req, res);

    expect(mockedTeamService.updateTeam).toHaveBeenCalledWith(10, 2, { name: 'New Name' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });
});

describe('team.controller deleteTeamById()', () => {
  it('throws TEAM_NOT_FOUND immediately (before touching res) when req.team is missing', async () => {
    const req = { team: undefined } as Request;
    const res = makeRes();

    await expect(deleteTeamById(req, res)).rejects.toMatchObject({
      status: 404,
      code: 'TEAM_NOT_FOUND',
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(mockedTeamService.deleteTeam).not.toHaveBeenCalled();
  });

  it('deletes the team from req.team and responds 204 with no body', async () => {
    const req = { team: { team_id: 10 } } as unknown as Request;
    const res = makeRes();
    mockedTeamService.deleteTeam.mockResolvedValue(1 as any);

    await deleteTeamById(req, res);

    expect(mockedTeamService.deleteTeam).toHaveBeenCalledWith(10);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
  });
});
