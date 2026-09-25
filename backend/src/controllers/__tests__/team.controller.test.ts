import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// Mock specifiers must match team.controller.ts exactly, so this file is
// expected to sit in a __tests__ subfolder next to the controller.
//
// parseId, parsePagination, and searchTeamsQuerySchema are NOT mocked — all
// three are pure (see their own dedicated tests elsewhere in this codebase for
// parseId/parsePagination; searchTeamsQuerySchema is a real zod schema from
// schemas/team.schema.ts).
//
// Two things confirmed by reading team.routes.ts and requireTeamLeader.ts
// alongside this controller, not visible from the controller alone:
//
// 1. requireTeamLeader.ts validates the :id route param with a bare
//    `Number(teamId)`, not parseId. A malformed team id therefore 404s as
//    TEAM_NOT_FOUND at the middleware layer for every requireTeamLeader-gated
//    route (updateTeamById, deleteTeamById, deleteMember, the invitation
//    endpoints, createTeamOfficialRequest, and the join-request
//    approve/reject endpoints) — the controller's own
//    `parseId(req.params['id'], ...)` call for that same team id never runs
//    in production on those routes; it only runs here, in isolated unit
//    tests of the controller. The 400 VALIDATION_FAILED tests below for the
//    *team* id on those handlers are accurate as controller-unit tests, but
//    don't reflect what a real HTTP request would receive.
//
// 2. listMyJoinRequests and cancelJoinRequest have no route wired up
//    anywhere in team.routes.ts. They're still tested below as controller
//    units (that's a legitimate thing to verify in isolation), but as of
//    this routes file, neither is reachable over HTTP.
vi.mock('../../services/team.service.js', () => ({
  createTeam: vi.fn(),
  getMyTeam: vi.fn(),
  searchTeams: vi.fn(),
  getTeamById: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  getTeamMemberById: vi.fn(),
  deleteMember: vi.fn(),
  createInvitation: vi.fn(),
  getAllInvitation: vi.fn(),
  deletePendingInvite: vi.fn(),
  createOfficialRequest: vi.fn(),
}));

vi.mock('../../services/joinRequest.service.js', () => ({
  createJoinRequest: vi.fn(),
  listJoinRequests: vi.fn(),
  approveJoinRequest: vi.fn(),
  rejectJoinRequest: vi.fn(),
  listMyJoinRequests: vi.fn(),
  cancelJoinRequest: vi.fn(),
}));

import {
  createTeam,
  getMyTeam,
  searchTeams,
  createJoinRequest,
  listJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  listMyJoinRequests,
  cancelJoinRequest,
  getTeamById,
  updateTeamById,
  deleteTeamById,
  getTeamMember,
  deleteMember,
  createTeamInvitation,
  getAllInvitation,
  deletePendingInvite,
  createTeamOfficialRequest,
} from '../team.controller.js';
import * as TeamService from '../../services/team.service.js';
import * as JoinRequestService from '../../services/joinRequest.service.js';
import { AppError } from '../../utils/AppError.js';

const teamSvc = vi.mocked(TeamService);
const joinSvc = vi.mocked(JoinRequestService);

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res as Response;
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    params: { id: '10' },
    query: {},
    body: {},
    user: { user_id: 5 },
    ...overrides,
  } as unknown as Request;
}

beforeEach(() => {
  // resetAllMocks (not clearAllMocks) so a mockRejectedValue/mockResolvedValue
  // set in one test can never leak into a later test that doesn't set its own.
  vi.resetAllMocks();
});

describe('createTeam', () => {
  it('creates a team for the authenticated user and responds 201', async () => {
    const serviceResult = { id: 1, name: 'Team A' };
    teamSvc.createTeam.mockResolvedValue(serviceResult as any);

    const body = { name: 'Team A' };
    const req = makeReq({ body, user: { user_id: 5 } as any });
    const res = makeRes();
    await createTeam(req, res);

    expect(teamSvc.createTeam).toHaveBeenCalledWith(body, 5);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('characterization: throws a TypeError when req.user is absent', async () => {
    const req = makeReq({ user: undefined });

    await expect(createTeam(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    expect(teamSvc.createTeam).not.toHaveBeenCalled();
  });

  it('propagates a service rejection', async () => {
    const serviceError = new AppError(409, 'TEAM_NAME_TAKEN', 'ชื่อทีมนี้ถูกใช้แล้ว');
    teamSvc.createTeam.mockRejectedValue(serviceError);

    const res = makeRes();
    await expect(createTeam(makeReq(), res)).rejects.toBe(serviceError);
    // res.status(201) fires before the awaited argument to .json(...) settles.
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('getMyTeam', () => {
  it("fetches the authenticated user's team and responds 200", async () => {
    const serviceResult = { id: 1, name: 'Team A' };
    teamSvc.getMyTeam.mockResolvedValue(serviceResult as any);

    const res = makeRes();
    await getMyTeam(makeReq({ user: { user_id: 5 } as any }), res);

    expect(teamSvc.getMyTeam).toHaveBeenCalledWith(5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('characterization: throws a TypeError when req.user is absent', async () => {
    const req = makeReq({ user: undefined });

    await expect(getMyTeam(req, makeRes())).rejects.toBeInstanceOf(TypeError);
  });
});

describe('searchTeams', () => {
  it('parses pagination and forwards validated, coerced query data to the service, responds 200', async () => {
    teamSvc.searchTeams.mockResolvedValue({ items: [] } as any);

    const req = makeReq({
      query: { page: '2', pageSize: '10', sportTypeId: '3', q: 'ฟุตบอล', visibility: 'public' },
    });
    const res = makeRes();
    await searchTeams(req, res);

    // sportTypeId is coerced from the string "3" to the number 3 by z.coerce.number().
    // page 2, size 10 -> offset 10 (real parsePagination arithmetic).
    expect(teamSvc.searchTeams).toHaveBeenCalledWith(
      { sportTypeId: 3, q: 'ฟุตบอล', visibility: 'public' },
      10,
      2,
      10,
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('trims whitespace from q (z.string().trim())', async () => {
    teamSvc.searchTeams.mockResolvedValue({ items: [] } as any);

    await searchTeams(makeReq({ query: { q: '  ฟุตบอล  ' } }), makeRes());

    expect(teamSvc.searchTeams).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'ฟุตบอล' }),
      0,
      1,
      20,
    );
  });

  it('omits all filters as an empty object when the query has none', async () => {
    teamSvc.searchTeams.mockResolvedValue({ items: [] } as any);

    await searchTeams(makeReq({ query: {} }), makeRes());

    expect(teamSvc.searchTeams).toHaveBeenCalledWith({}, 0, 1, 20);
  });

  it('rejects with 400 VALIDATION_FAILED for a non-numeric sportTypeId, without calling the service', async () => {
    const req = makeReq({ query: { sportTypeId: 'not-a-number' } });

    await expect(searchTeams(req, makeRes())).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    expect(teamSvc.searchTeams).not.toHaveBeenCalled();
  });

  it('rejects a negative or zero sportTypeId (schema requires .positive())', async () => {
    await expect(
      searchTeams(makeReq({ query: { sportTypeId: '0' } }), makeRes()),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      searchTeams(makeReq({ query: { sportTypeId: '-3' } }), makeRes()),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('rejects a visibility value outside the enum', async () => {
    const req = makeReq({ query: { visibility: 'hidden' } });

    await expect(searchTeams(req, makeRes())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(teamSvc.searchTeams).not.toHaveBeenCalled();
  });

  it('rejects a q longer than 150 characters', async () => {
    const req = makeReq({ query: { q: 'ก'.repeat(151) } });

    await expect(searchTeams(req, makeRes())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('accepts q at exactly the 150-character boundary', async () => {
    teamSvc.searchTeams.mockResolvedValue({ items: [] } as any);

    const q = 'ก'.repeat(150);
    await searchTeams(makeReq({ query: { q } }), makeRes());

    expect(teamSvc.searchTeams).toHaveBeenCalledWith(
      expect.objectContaining({ q }),
      0,
      1,
      20,
    );
  });

  it('does not require req.user', async () => {
    teamSvc.searchTeams.mockResolvedValue({ items: [] } as any);

    const res = makeRes();
    await searchTeams(makeReq({ user: undefined, query: {} }), res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('createJoinRequest', () => {
  it('parses the team id and forwards user_id and the message from the body, responds 201', async () => {
    const serviceResult = { id: 1, status: 'pending' };
    joinSvc.createJoinRequest.mockResolvedValue(serviceResult as any);

    const req = makeReq({
      params: { id: '10' } as any,
      user: { user_id: 5 } as any,
      body: { message: 'ขอเข้าร่วมทีม' },
    });
    const res = makeRes();
    await createJoinRequest(req, res);

    expect(joinSvc.createJoinRequest).toHaveBeenCalledWith(10, 5, 'ขอเข้าร่วมทีม');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('rejects with VALIDATION_FAILED for a bad team id', async () => {
    const req = makeReq({ params: { id: 'abc' } as any });

    await expect(createJoinRequest(req, makeRes())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extra: { fields: { id: 'รหัสทีมต้องเป็นจำนวนเต็มบวก' } },
    });
    expect(joinSvc.createJoinRequest).not.toHaveBeenCalled();
  });

  it('characterization: throws a TypeError when req.user is absent', async () => {
    const req = makeReq({ user: undefined });

    await expect(createJoinRequest(req, makeRes())).rejects.toBeInstanceOf(TypeError);
  });
});

describe('listJoinRequests', () => {
  it('parses the team id and responds 200 with the list, does not require req.user', async () => {
    const serviceResult = [{ id: 1 }];
    joinSvc.listJoinRequests.mockResolvedValue(serviceResult as any);

    const res = makeRes();
    await listJoinRequests(makeReq({ params: { id: '10' } as any, user: undefined }), res);

    expect(joinSvc.listJoinRequests).toHaveBeenCalledWith(10);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('rejects with VALIDATION_FAILED for a bad team id', async () => {
    const req = makeReq({ params: { id: 'abc' } as any });

    await expect(listJoinRequests(req, makeRes())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(joinSvc.listJoinRequests).not.toHaveBeenCalled();
  });
});

describe('approveJoinRequest / rejectJoinRequest — missing "field" argument bug', () => {
  it('approveJoinRequest forwards teamId, joinRequestId, and user_id in that order, responds 200', async () => {
    const serviceResult = { status: 'approved' };
    joinSvc.approveJoinRequest.mockResolvedValue(serviceResult as any);

    const req = makeReq({ params: { id: '10', rid: '4' } as any, user: { user_id: 5 } as any });
    const res = makeRes();
    await approveJoinRequest(req, res);

    expect(joinSvc.approveJoinRequest).toHaveBeenCalledWith(10, 4, 5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('rejectJoinRequest forwards teamId, joinRequestId, user_id, and reason', async () => {
    const serviceResult = { status: 'rejected' };
    joinSvc.rejectJoinRequest.mockResolvedValue(serviceResult as any);

    const req = makeReq({
      params: { id: '10', rid: '4' } as any,
      user: { user_id: 5 } as any,
      body: { reason: 'ทีมเต็มแล้ว' },
    });
    const res = makeRes();
    await rejectJoinRequest(req, res);

    expect(joinSvc.rejectJoinRequest).toHaveBeenCalledWith(10, 4, 5, 'ทีมเต็มแล้ว');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('approveJoinRequest: a bad team id reports extra.fields.id, as expected', async () => {
    const req = makeReq({ params: { id: 'bad', rid: '4' } as any });

    await expect(approveJoinRequest(req, makeRes())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extra: { fields: { id: 'รหัสทีมต้องเป็นจำนวนเต็มบวก' } },
    });
    expect(joinSvc.approveJoinRequest).not.toHaveBeenCalled();
  });

  it('BUG: approveJoinRequest — a bad join-request id (rid) ALSO reports extra.fields.id, not .rid, because parseId is called without a third "field" argument here', async () => {
    // Contrast with deleteMember/createTeamInvitation/deletePendingInvite below,
    // which all pass the field name explicitly ('uid'/'iid') for their second id.
    // Here, both parseId calls default to field 'id', so a frontend that maps
    // validation errors to specific inputs cannot distinguish "bad team id" from
    // "bad join-request id" — both land under the same key.
    const req = makeReq({ params: { id: '10', rid: 'bad' } as any });

    await expect(approveJoinRequest(req, makeRes())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extra: { fields: { id: 'รหัสคำขอต้องเป็นจำนวนเต็มบวก' } }, // note: key is 'id', message is about รหัสคำขอ
    });
    expect(joinSvc.approveJoinRequest).not.toHaveBeenCalled();
  });

  it('BUG: rejectJoinRequest has the same missing-field-argument gap as approveJoinRequest', async () => {
    const req = makeReq({ params: { id: '10', rid: 'bad' } as any });

    await expect(rejectJoinRequest(req, makeRes())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extra: { fields: { id: 'รหัสคำขอต้องเป็นจำนวนเต็มบวก' } },
    });
    expect(joinSvc.rejectJoinRequest).not.toHaveBeenCalled();
  });

  it('both check the team id before the join-request id', async () => {
    const req = makeReq({ params: { id: 'bad', rid: 'also-bad' } as any });

    await expect(approveJoinRequest(req, makeRes())).rejects.toMatchObject({
      extra: { fields: { id: 'รหัสทีมต้องเป็นจำนวนเต็มบวก' } },
    });
  });

  it('both characterization: throw a TypeError when req.user is absent', async () => {
    const req = makeReq({ user: undefined, params: { id: '10', rid: '4' } as any });

    await expect(approveJoinRequest(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    await expect(rejectJoinRequest(req, makeRes())).rejects.toBeInstanceOf(TypeError);
  });
});

describe('listMyJoinRequests', () => {
  it("fetches the authenticated user's join requests and responds 200", async () => {
    const serviceResult = [{ id: 1 }];
    joinSvc.listMyJoinRequests.mockResolvedValue(serviceResult as any);

    const res = makeRes();
    await listMyJoinRequests(makeReq({ user: { user_id: 5 } as any }), res);

    expect(joinSvc.listMyJoinRequests).toHaveBeenCalledWith(5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('characterization: throws a TypeError when req.user is absent', async () => {
    const req = makeReq({ user: undefined });

    await expect(listMyJoinRequests(req, makeRes())).rejects.toBeInstanceOf(TypeError);
  });
});

describe('cancelJoinRequest', () => {
  it('parses the join-request id (from "rid") and user_id, responds 204 with no body', async () => {
    joinSvc.cancelJoinRequest.mockResolvedValue(undefined as any);

    const req = makeReq({ params: { rid: '4' } as any, user: { user_id: 5 } as any });
    const res = makeRes();
    await cancelJoinRequest(req, res);

    expect(joinSvc.cancelJoinRequest).toHaveBeenCalledWith(4, 5);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('minor inconsistency: a bad rid reports extra.fields.id, not .rid (missing third parseId argument, same as approve/reject)', async () => {
    const req = makeReq({ params: { rid: 'bad' } as any });

    await expect(cancelJoinRequest(req, makeRes())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extra: { fields: { id: 'รหัสคำขอต้องเป็นจำนวนเต็มบวก' } },
    });
    expect(joinSvc.cancelJoinRequest).not.toHaveBeenCalled();
  });

  it('characterization: throws a TypeError when req.user is absent', async () => {
    const req = makeReq({ user: undefined, params: { rid: '4' } as any });

    await expect(cancelJoinRequest(req, makeRes())).rejects.toBeInstanceOf(TypeError);
  });

  it('propagates a service rejection without calling res.status (await is on its own line)', async () => {
    const serviceError = new AppError(404, 'REQUEST_NOT_FOUND', 'ไม่พบคำขอ');
    joinSvc.cancelJoinRequest.mockRejectedValue(serviceError);

    const req = makeReq({ params: { rid: '4' } as any });
    const res = makeRes();
    await expect(cancelJoinRequest(req, res)).rejects.toBe(serviceError);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('getTeamById', () => {
  it('parses the team id and responds 200 with the team', async () => {
    const serviceResult = { id: 42, name: 'Team A' };
    teamSvc.getTeamById.mockResolvedValue(serviceResult as any);

    const res = makeRes();
    await getTeamById(makeReq({ params: { id: '42' } as any, user: undefined }), res);

    expect(teamSvc.getTeamById).toHaveBeenCalledWith(42);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('does not require req.user', async () => {
    teamSvc.getTeamById.mockResolvedValue({} as any);

    const res = makeRes();
    await getTeamById(makeReq({ user: undefined }), res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects with VALIDATION_FAILED for a bad id', async () => {
    const req = makeReq({ params: { id: 'abc' } as any });

    await expect(getTeamById(req, makeRes())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(teamSvc.getTeamById).not.toHaveBeenCalled();
  });

  it('propagates a service rejection (e.g. team not found)', async () => {
    const serviceError = new AppError(404, 'TEAM_NOT_FOUND', 'ไม่พบทีมนี้');
    teamSvc.getTeamById.mockRejectedValue(serviceError);

    await expect(
      getTeamById(makeReq({ params: { id: '999' } as any }), makeRes()),
    ).rejects.toBe(serviceError);
  });
});

describe('updateTeamById', () => {
  it('throws TEAM_NOT_FOUND immediately (before touching res) when req.team is missing', async () => {
    const req = makeReq({ team: undefined, body: {} } as any);
    const res = makeRes();

    await expect(updateTeamById(req, res)).rejects.toMatchObject({
      status: 404,
      code: 'TEAM_NOT_FOUND',
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(teamSvc.updateTeam).not.toHaveBeenCalled();
  });

  it('updates the team using fields from req.team and responds 200', async () => {
    const serviceResult = { id: 10, name: 'New Name' };
    teamSvc.updateTeam.mockResolvedValue(serviceResult as any);

    const req = makeReq({
      team: { team_id: 10, sport_type_id: 2 },
      body: { name: 'New Name' },
    } as any);
    const res = makeRes();
    await updateTeamById(req, res);

    expect(teamSvc.updateTeam).toHaveBeenCalledWith(10, 2, { name: 'New Name' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates a service rejection (res.status(200) still fires first, since this is a chained call)', async () => {
    const serviceError = new AppError(409, 'CONFLICT', 'ชื่อทีมซ้ำ');
    teamSvc.updateTeam.mockRejectedValue(serviceError);

    const req = makeReq({ team: { team_id: 10, sport_type_id: 2 }, body: {} } as any);
    const res = makeRes();
    await expect(updateTeamById(req, res)).rejects.toBe(serviceError);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('deleteTeamById', () => {
  it('throws TEAM_NOT_FOUND immediately (before touching res) when req.team is missing', async () => {
    const req = makeReq({ team: undefined } as any);
    const res = makeRes();

    await expect(deleteTeamById(req, res)).rejects.toMatchObject({
      status: 404,
      code: 'TEAM_NOT_FOUND',
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(teamSvc.deleteTeam).not.toHaveBeenCalled();
  });

  it('deletes the team from req.team and responds 204 with no body', async () => {
    teamSvc.deleteTeam.mockResolvedValue(1 as any);

    const req = makeReq({ team: { team_id: 10 } } as any);
    const res = makeRes();
    await deleteTeamById(req, res);

    expect(teamSvc.deleteTeam).toHaveBeenCalledWith(10);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('propagates a service rejection without calling res.status (await is on its own line, before res is touched)', async () => {
    const serviceError = new AppError(409, 'HAS_ACTIVE_MATCHES', 'ทีมมีแมตช์ที่ยังดำเนินอยู่');
    teamSvc.deleteTeam.mockRejectedValue(serviceError);

    const req = makeReq({ team: { team_id: 10 } } as any);
    const res = makeRes();
    await expect(deleteTeamById(req, res)).rejects.toBe(serviceError);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('getTeamMember', () => {
  it('parses the team id and forwards user_id, responds 200', async () => {
    const serviceResult = { user_id: 5, position: 'starter' };
    teamSvc.getTeamMemberById.mockResolvedValue(serviceResult as any);

    const req = makeReq({ params: { id: '10' } as any, user: { user_id: 5 } as any });
    const res = makeRes();
    await getTeamMember(req, res);

    expect(teamSvc.getTeamMemberById).toHaveBeenCalledWith(10, 5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('rejects with VALIDATION_FAILED for a bad team id', async () => {
    const req = makeReq({ params: { id: 'abc' } as any });

    await expect(getTeamMember(req, makeRes())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(teamSvc.getTeamMemberById).not.toHaveBeenCalled();
  });

  it('characterization: throws a TypeError when req.user is absent', async () => {
    const req = makeReq({ user: undefined });

    await expect(getTeamMember(req, makeRes())).rejects.toBeInstanceOf(TypeError);
  });

  it('propagates a service rejection', async () => {
    const serviceError = new AppError(404, 'MEMBER_NOT_FOUND', 'ไม่พบสมาชิก');
    teamSvc.getTeamMemberById.mockRejectedValue(serviceError);

    const res = makeRes();
    await expect(getTeamMember(makeReq(), res)).rejects.toBe(serviceError);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('deleteMember', () => {
  it('throws FORBIDDEN before calling the service when the target user is the team leader', async () => {
    const req = makeReq({
      params: { id: '10', uid: '5' } as any,
      team: { leader_id: 5, sport_type_id: 2 },
    } as any);
    const res = makeRes();

    await expect(deleteMember(req, res)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    expect(teamSvc.deleteMember).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('deletes a non-leader member and responds 204 with no body', async () => {
    teamSvc.deleteMember.mockResolvedValue(undefined as any);

    const req = makeReq({
      params: { id: '10', uid: '7' } as any,
      team: { leader_id: 5, sport_type_id: 2 },
    } as any);
    const res = makeRes();
    await deleteMember(req, res);

    expect(teamSvc.deleteMember).toHaveBeenCalledWith(7, 10, 2);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('rejects with VALIDATION_FAILED, keyed under "uid" (correctly, unlike approve/rejectJoinRequest), for a bad target user id', async () => {
    const req = makeReq({ params: { id: '10', uid: 'bad' } as any, team: { leader_id: 5 } } as any);

    await expect(deleteMember(req, makeRes())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extra: { fields: { uid: 'รหัสผู้ใช้ต้องเป็นจำนวนเต็มบวก' } },
    });
    expect(teamSvc.deleteMember).not.toHaveBeenCalled();
  });

  it('checks both id params before touching req.team at all', async () => {
    const req = makeReq({ params: { id: 'bad', uid: 'also-bad' } as any, team: undefined } as any);

    await expect(deleteMember(req, makeRes())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extra: { fields: { id: 'รหัสทีมต้องเป็นจำนวนเต็มบวก' } },
    });
  });

  it('characterization: throws a TypeError (not a silent-undefined pass-through) if req.team is ever actually undefined — not currently reachable given correct routing', async () => {
    // requireTeamLeader (the middleware wired in front of this route) always
    // either calls next(err) or sets req.team before a bare next(), so
    // req.team is guaranteed set by the time this handler runs under correct
    // routing. This test documents what the handler itself does if that
    // guarantee is ever broken (e.g. the middleware is dropped from the route
    // by a future edit) — it throws loudly via the property access on
    // req.team!.leader_id, unlike tournament.controller.ts's bare
    // `req.tournament!` (passed as a whole argument, no property access),
    // which fails silently instead. Low-priority defense-in-depth gap, not a
    // live bug.
    const req = makeReq({
      params: { id: '10', uid: '7' } as any,
      team: undefined,
    } as any);

    await expect(deleteMember(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    expect(teamSvc.deleteMember).not.toHaveBeenCalled();
  });
});

describe('createTeamInvitation', () => {
  it('parses the team id and forwards invitedUserId and user_id, responds 201', async () => {
    const serviceResult = { id: 1, teamId: 10, invitedUserId: 9 };
    teamSvc.createInvitation.mockResolvedValue(serviceResult as any);

    const req = makeReq({
      params: { id: '10' } as any,
      body: { invitedUserId: 9 },
      user: { user_id: 5 } as any,
    });
    const res = makeRes();
    await createTeamInvitation(req, res);

    expect(teamSvc.createInvitation).toHaveBeenCalledWith(10, 9, 5);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('rejects with VALIDATION_FAILED for a bad team id', async () => {
    const req = makeReq({ params: { id: 'abc' } as any });

    await expect(createTeamInvitation(req, makeRes())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(teamSvc.createInvitation).not.toHaveBeenCalled();
  });

  it('characterization: throws a TypeError when req.user is absent', async () => {
    const req = makeReq({ user: undefined });

    await expect(createTeamInvitation(req, makeRes())).rejects.toBeInstanceOf(TypeError);
  });
});

describe('getAllInvitation', () => {
  it('parses the team id and responds 200 with the invitation list, does not require req.user', async () => {
    const serviceResult = [{ id: 1 }];
    teamSvc.getAllInvitation.mockResolvedValue(serviceResult as any);

    const res = makeRes();
    await getAllInvitation(makeReq({ params: { id: '10' } as any, user: undefined }), res);

    expect(teamSvc.getAllInvitation).toHaveBeenCalledWith(10);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('rejects with VALIDATION_FAILED for a bad team id', async () => {
    const req = makeReq({ params: { id: 'abc' } as any });

    await expect(getAllInvitation(req, makeRes())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });
});

describe('deletePendingInvite', () => {
  it('parses the team id and invite id ("iid"), deletes, responds 204 with no body', async () => {
    teamSvc.deletePendingInvite.mockResolvedValue(undefined as any);

    const req = makeReq({ params: { id: '10', iid: '3' } as any, user: undefined });
    const res = makeRes();
    await deletePendingInvite(req, res);

    expect(teamSvc.deletePendingInvite).toHaveBeenCalledWith(10, 3);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('rejects with VALIDATION_FAILED, correctly keyed under "iid", for a bad invite id', async () => {
    const req = makeReq({ params: { id: '10', iid: 'bad' } as any });

    await expect(deletePendingInvite(req, makeRes())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extra: { fields: { iid: 'รหัสคำเชิญต้องเป็นจำนวนเต็มบวก' } },
    });
    expect(teamSvc.deletePendingInvite).not.toHaveBeenCalled();
  });

  it('does not require req.user', async () => {
    teamSvc.deletePendingInvite.mockResolvedValue(undefined as any);

    const res = makeRes();
    await deletePendingInvite(makeReq({ params: { id: '10', iid: '3' } as any, user: undefined }), res);

    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('propagates a service rejection without calling res.status (await is on its own line)', async () => {
    const serviceError = new AppError(404, 'INVITE_NOT_FOUND', 'ไม่พบคำเชิญ');
    teamSvc.deletePendingInvite.mockRejectedValue(serviceError);

    const req = makeReq({ params: { id: '10', iid: '3' } as any });
    const res = makeRes();
    await expect(deletePendingInvite(req, res)).rejects.toBe(serviceError);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('createTeamOfficialRequest', () => {
  it('parses the team id and forwards user_id (first!) and supportingDocs to the service', async () => {
    // Note the argument order: createOfficialRequest(userId, teamId, supportingDocs) —
    // userId comes FIRST here, unlike every other handler in this file where the
    // resource id (teamId) is always the first argument. Pinned explicitly since a
    // future refactor could easily "fix" this into the more common order by mistake.
    const serviceResult = { id: 1, teamId: 10, status: 'pending' };
    teamSvc.createOfficialRequest.mockResolvedValue(serviceResult as any);

    const req = makeReq({
      params: { id: '10' } as any,
      body: { supportingDocs: ['doc1.pdf'] },
      user: { user_id: 5 } as any,
    });
    const res = makeRes();
    await createTeamOfficialRequest(req, res);

    expect(teamSvc.createOfficialRequest).toHaveBeenCalledWith(5, 10, ['doc1.pdf']);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('rejects with VALIDATION_FAILED for a bad team id', async () => {
    const req = makeReq({ params: { id: 'abc' } as any });

    await expect(createTeamOfficialRequest(req, makeRes())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(teamSvc.createOfficialRequest).not.toHaveBeenCalled();
  });

  it('characterization: throws a TypeError when req.user is absent', async () => {
    const req = makeReq({ user: undefined });

    await expect(createTeamOfficialRequest(req, makeRes())).rejects.toBeInstanceOf(TypeError);
  });
});
