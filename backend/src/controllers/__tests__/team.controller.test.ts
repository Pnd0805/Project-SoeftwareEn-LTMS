import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/team.service.js', () => ({
  createTeam: vi.fn(),
  getMyTeam: vi.fn(),
  getTeamById: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  getTeamMemberById: vi.fn(),
  updateMember: vi.fn(),
  deleteMember: vi.fn(),
  createInvitation: vi.fn(),
  getAllInvitation: vi.fn(),
  deletePendingInvite: vi.fn(),
  createOfficialRequest: vi.fn(),
}));

vi.mock('../../utils/parseId.js', () => ({
  parseId: vi.fn(),
}));

import {
  createTeam,
  getMyTeam,
  getTeamById,
  updateTeamById,
  deleteTeamById,
  getTeamMember,
  updateTeamMember,
  deleteMember,
  createTeamInvitation,
  getAllInvitation,
  deletePendingInvite,
  createTeamOfficialRequest,
} from '../team.controller.js';
import * as TeamService from '../../services/team.service.js';
import { parseId } from '../../utils/parseId.js';
import { AppError } from '../../utils/AppError.js';

const mockedTeamService = vi.mocked(TeamService);
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

describe('team.controller getTeamMember()', () => {
  it('fetches the member using the route id and the authenticated user id, responds 200', async () => {
    const req = { params: { id: '10' }, user: { user_id: 5 } } as unknown as Request;
    const res = makeRes();
    const serviceResult = { user_id: 5, position: 'starter' };
    mockedTeamService.getTeamMemberById.mockResolvedValue(serviceResult as any);

    await getTeamMember(req, res);

    expect(mockedTeamService.getTeamMemberById).toHaveBeenCalledWith(10, 5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates the error when the service throws', async () => {
    const req = { params: { id: '10' }, user: { user_id: 5 } } as unknown as Request;
    const res = makeRes();
    const serviceError = new AppError(404, 'MEMBER_NOT_FOUND', 'x');
    mockedTeamService.getTeamMemberById.mockRejectedValue(serviceError);

    await expect(getTeamMember(req, res)).rejects.toBe(serviceError);
  });
});

describe('team.controller updateTeamMember()', () => {
  it('parses team id and user id from the route and responds 200 with the update result', async () => {
    const req = {
      params: { id: '10', uid: '5' },
      body: { position: 'starter' },
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValueOnce(10).mockReturnValueOnce(5);
    const serviceResult = { user_id: 5, position: 'starter' };
    mockedTeamService.updateMember.mockResolvedValue(serviceResult as any);

    await updateTeamMember(req, res);

    expect(mockedParseId).toHaveBeenNthCalledWith(1, '10', 'รหัสทีม', 'id');
    expect(mockedParseId).toHaveBeenNthCalledWith(2, '5', 'รหัสผู้ใช้', 'uid');
    expect(mockedTeamService.updateMember).toHaveBeenCalledWith(5, 10, 'starter');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates the error and never calls the service when parseId fails on the team id', async () => {
    const req = { params: { id: 'bad', uid: '5' }, body: {} } as unknown as Request;
    const res = makeRes();
    const parseError = new AppError(400, 'VALIDATION_FAILED', 'x');
    mockedParseId.mockImplementation(() => {
      throw parseError;
    });

    await expect(updateTeamMember(req, res)).rejects.toBe(parseError);
    expect(mockedTeamService.updateMember).not.toHaveBeenCalled();
  });
});

describe('team.controller deleteMember()', () => {
  it('throws FORBIDDEN before calling the service when the target user is the team leader', async () => {
    const req = {
      params: { id: '10', uid: '5' },
      team: { leader_id: 5, sport_type_id: 2 },
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValueOnce(10).mockReturnValueOnce(5);

    await expect(deleteMember(req, res)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    expect(mockedTeamService.deleteMember).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('deletes a non-leader member and responds 204 with no body', async () => {
    const req = {
      params: { id: '10', uid: '7' },
      team: { leader_id: 5, sport_type_id: 2 },
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValueOnce(10).mockReturnValueOnce(7);
    mockedTeamService.deleteMember.mockResolvedValue(undefined as any);

    await deleteMember(req, res);

    expect(mockedTeamService.deleteMember).toHaveBeenCalledWith(7, 10, 2);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('team.controller createTeamInvitation()', () => {
  it('parses the team id and creates the invitation, responds 201', async () => {
    const req = {
      params: { id: '10' },
      body: { invitedUserId: 9 },
      user: { user_id: 5 },
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(10);
    const serviceResult = { id: 1, teamId: 10, invitedUserId: 9 };
    mockedTeamService.createInvitation.mockResolvedValue(serviceResult as any);

    await createTeamInvitation(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('10', 'รหัสทีม', 'id');
    expect(mockedTeamService.createInvitation).toHaveBeenCalledWith(10, 9, 5);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });
});

describe('team.controller getAllInvitation()', () => {
  it('parses the team id and responds 200 with the invitation list', async () => {
    const req = { params: { id: '10' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(10);
    const serviceResult = { items: [{ id: 1 }] };
    mockedTeamService.getAllInvitation.mockResolvedValue(serviceResult as any);

    await getAllInvitation(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('10', 'รหัสทีม', 'id');
    expect(mockedTeamService.getAllInvitation).toHaveBeenCalledWith(10);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });
});

describe('team.controller deletePendingInvite()', () => {
  it('parses the team id and invite id, deletes, and responds 204 with no body', async () => {
    const req = { params: { id: '10', iid: '3' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValueOnce(10).mockReturnValueOnce(3);
    mockedTeamService.deletePendingInvite.mockResolvedValue(undefined as any);

    await deletePendingInvite(req, res);

    expect(mockedParseId).toHaveBeenNthCalledWith(1, '10', 'รหัสทีม', 'id');
    expect(mockedParseId).toHaveBeenNthCalledWith(2, '3', 'รหัสคำเชิญ', 'iid');
    expect(mockedTeamService.deletePendingInvite).toHaveBeenCalledWith(10, 3);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('team.controller createTeamOfficialRequest()', () => {
  it('parses the team id and creates an official request, responds 201', async () => {
    const req = {
      params: { id: '10' },
      body: { supportingDocs: ['doc1.pdf'] },
      user: { user_id: 5 },
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(10);
    const serviceResult = { id: 1, teamId: 10, status: 'pending' };
    mockedTeamService.createOfficialRequest.mockResolvedValue(serviceResult as any);

    await createTeamOfficialRequest(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('10', 'รหัสทีม', 'id');
    expect(mockedTeamService.createOfficialRequest).toHaveBeenCalledWith(5, 10, ['doc1.pdf']);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });
});
