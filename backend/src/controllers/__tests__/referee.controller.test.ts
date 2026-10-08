import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/referee.service.js', () => ({
  inviteReferee: vi.fn(),
  listTournamentReferees: vi.fn(),
  listMyRefereeInvitations: vi.fn(),
  listMyRefereeMatches: vi.fn(),
  acceptRefereeInvitation: vi.fn(),
  declineRefereeInvitation: vi.fn(),
  listMatchReferees: vi.fn(),
  unassignRefereeFromMatch: vi.fn(),
  removeTournamentReferee: vi.fn(),
  getRefereeCoverage: vi.fn(),
}));

vi.mock('../../utils/parseId.js', () => ({
  parseId: vi.fn(),
}));

import {
  invite,
  list,
  listMyInvitations,
  listMyMatches,
  accept,
  decline,
  listByMatch,
  unassignFromMatch,
  removeFromTournament,
  coverage,
} from '../referee.controller.js';
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

  it('characterization: throws a TypeError (not a handled AppError) when req.user is absent', async () => {
    // The handler reads req.user!.user_id with a non-null assertion rather than
    // a guarded check, so a missing user surfaces as a raw TypeError.
    const req = { params: { id: '3' }, user: undefined, body: {} } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(3);

    await expect(invite(req, res)).rejects.toBeInstanceOf(TypeError);
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

  it('characterization: throws a TypeError when req.user is absent', async () => {
    const req = { user: undefined } as unknown as Request;
    const res = makeRes();

    await expect(listMyInvitations(req, res)).rejects.toBeInstanceOf(TypeError);
    expect(mockedRefereeService.listMyRefereeInvitations).not.toHaveBeenCalled();
  });
});

describe('referee.controller listMyMatches()', () => {
  it('falls back to status: undefined and upcoming: false when no query params are given', async () => {
    const req = { user: { user_id: 1 }, query: {} } as unknown as Request;
    const res = makeRes();
    mockedRefereeService.listMyRefereeMatches.mockResolvedValue({ items: [] } as any);

    await listMyMatches(req, res);

    expect(mockedRefereeService.listMyRefereeMatches).toHaveBeenCalledWith(1, {
      status: undefined,
      upcoming: false,
    });
  });

  it('forwards a string status query as-is', async () => {
    const req = { user: { user_id: 1 }, query: { status: 'accepted' } } as unknown as Request;
    const res = makeRes();
    mockedRefereeService.listMyRefereeMatches.mockResolvedValue({ items: [] } as any);

    await listMyMatches(req, res);

    expect(mockedRefereeService.listMyRefereeMatches).toHaveBeenCalledWith(1, {
      status: 'accepted',
      upcoming: false,
    });
  });

  it('treats a non-string status (duplicated query param -> array) as undefined', async () => {
    const req = {
      user: { user_id: 1 },
      query: { status: ['accepted', 'declined'] },
    } as unknown as Request;
    const res = makeRes();
    mockedRefereeService.listMyRefereeMatches.mockResolvedValue({ items: [] } as any);

    await listMyMatches(req, res);

    expect(mockedRefereeService.listMyRefereeMatches).toHaveBeenCalledWith(1, {
      status: undefined,
      upcoming: false,
    });
  });

  it("sets upcoming true only for the exact string 'true'", async () => {
    const req = { user: { user_id: 1 }, query: { upcoming: 'true' } } as unknown as Request;
    const res = makeRes();
    mockedRefereeService.listMyRefereeMatches.mockResolvedValue({ items: [] } as any);

    await listMyMatches(req, res);

    expect(mockedRefereeService.listMyRefereeMatches).toHaveBeenCalledWith(1, {
      status: undefined,
      upcoming: true,
    });
  });

  it.each(['false', '1', 'yes', ''])("treats upcoming=%j as false", async (upcoming) => {
    const req = { user: { user_id: 1 }, query: { upcoming } } as unknown as Request;
    const res = makeRes();
    mockedRefereeService.listMyRefereeMatches.mockResolvedValue({ items: [] } as any);

    await listMyMatches(req, res);

    expect(mockedRefereeService.listMyRefereeMatches).toHaveBeenCalledWith(1, {
      status: undefined,
      upcoming: false,
    });
  });

  it('responds 200 with the service result', async () => {
    const serviceResult = { items: [{ matchId: 4 }] };
    const req = { user: { user_id: 1 }, query: {} } as unknown as Request;
    const res = makeRes();
    mockedRefereeService.listMyRefereeMatches.mockResolvedValue(serviceResult as any);

    await listMyMatches(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('characterization: throws a TypeError when req.user is absent', async () => {
    const req = { user: undefined, query: {} } as unknown as Request;
    const res = makeRes();

    await expect(listMyMatches(req, res)).rejects.toBeInstanceOf(TypeError);
    expect(mockedRefereeService.listMyRefereeMatches).not.toHaveBeenCalled();
  });

  it('propagates a service rejection', async () => {
    // res.status(200).json(await service()) is one chained expression, so
    // res.status(200) fires synchronously before the awaited call is reached —
    // it still runs even though the service call goes on to reject. Only
    // res.json (whose argument is the awaited value) never runs.
    const req = { user: { user_id: 1 }, query: {} } as unknown as Request;
    const res = makeRes();
    const serviceError = new AppError(500, 'INTERNAL_ERROR', 'x');
    mockedRefereeService.listMyRefereeMatches.mockRejectedValue(serviceError);

    await expect(listMyMatches(req, res)).rejects.toBe(serviceError);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('referee.controller accept()', () => {
  it('parses the invitation id and accepts it, responds 200', async () => {
    const req = { params: { id: '9' }, user: { user_id: 1 }, body: { matchIds: [4] } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(9);
    const serviceResult = { id: 9, status: 'accepted' };
    mockedRefereeService.acceptRefereeInvitation.mockResolvedValue(serviceResult as any);

    await accept(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('9', 'รหัสคำเชิญ');
    expect(mockedRefereeService.acceptRefereeInvitation).toHaveBeenCalledWith(9, 1, { matchIds: [4] });
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

  it('characterization: throws a TypeError when req.user is absent', async () => {
    const req = { params: { id: '9' }, user: undefined, body: {} } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(9);

    await expect(accept(req, res)).rejects.toBeInstanceOf(TypeError);
    expect(mockedRefereeService.acceptRefereeInvitation).not.toHaveBeenCalled();
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

  it('characterization: throws a TypeError when req.user is absent', async () => {
    const req = { params: { id: '9' }, user: undefined } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(9);

    await expect(decline(req, res)).rejects.toBeInstanceOf(TypeError);
    expect(mockedRefereeService.declineRefereeInvitation).not.toHaveBeenCalled();
  });

  it('propagates a service rejection', async () => {
    const req = { params: { id: '9' }, user: { user_id: 1 } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(9);
    const serviceError = new AppError(409, 'INVITATION_ALREADY_DECIDED', 'x');
    mockedRefereeService.declineRefereeInvitation.mockRejectedValue(serviceError);

    // declineRefereeInvitation is awaited as its own statement before
    // res.status(204).send() runs, so a rejection here means res.status
    // never gets called.
    await expect(decline(req, res)).rejects.toBe(serviceError);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('referee.controller listByMatch()', () => {
  it('parses the match id and responds 200 with the referee list', async () => {
    const req = { params: { id: '4' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(4);
    const serviceResult = { items: [{ id: 1 }] };
    mockedRefereeService.listMatchReferees.mockResolvedValue(serviceResult as any);

    await listByMatch(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('4', 'รหัสแมตช์');
    expect(mockedRefereeService.listMatchReferees).toHaveBeenCalledWith(4);
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

    await expect(listByMatch(req, res)).rejects.toBe(parseError);
    expect(mockedRefereeService.listMatchReferees).not.toHaveBeenCalled();
  });

  it('propagates a service rejection', async () => {
    // Same chained-call caveat: res.status(200) runs synchronously before the
    // awaited service call is reached, so it still fires on rejection.
    const req = { params: { id: '4' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(4);
    const serviceError = new AppError(500, 'INTERNAL_ERROR', 'x');
    mockedRefereeService.listMatchReferees.mockRejectedValue(serviceError);

    await expect(listByMatch(req, res)).rejects.toBe(serviceError);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('referee.controller unassignFromMatch()', () => {
  it("parses the match id and the referee id (param 'rid'), unassigns, responds 204 with no body", async () => {
    const req = { params: { id: '4', rid: '2' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValueOnce(4).mockReturnValueOnce(2);
    mockedRefereeService.unassignRefereeFromMatch.mockResolvedValue(undefined as any);

    await unassignFromMatch(req, res);

    expect(mockedParseId).toHaveBeenNthCalledWith(1, '4', 'รหัสแมตช์');
    expect(mockedParseId).toHaveBeenNthCalledWith(2, '2', 'รหัสกรรมการ', 'rid');
    expect(mockedRefereeService.unassignRefereeFromMatch).toHaveBeenCalledWith(4, 2);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('propagates the error and never calls the service when the match id fails to parse', async () => {
    const req = { params: { id: 'bad', rid: '2' } } as unknown as Request;
    const res = makeRes();
    const parseError = new AppError(400, 'VALIDATION_FAILED', 'x');
    mockedParseId.mockImplementationOnce(() => {
      throw parseError;
    });

    await expect(unassignFromMatch(req, res)).rejects.toBe(parseError);
    expect(mockedRefereeService.unassignRefereeFromMatch).not.toHaveBeenCalled();
  });

  it('propagates the error and never calls the service when the referee id fails to parse', async () => {
    const req = { params: { id: '4', rid: 'bad' } } as unknown as Request;
    const res = makeRes();
    const parseError = new AppError(400, 'VALIDATION_FAILED', 'x');
    mockedParseId.mockReturnValueOnce(4).mockImplementationOnce(() => {
      throw parseError;
    });

    await expect(unassignFromMatch(req, res)).rejects.toBe(parseError);
    expect(mockedRefereeService.unassignRefereeFromMatch).not.toHaveBeenCalled();
  });

  it('propagates a service rejection', async () => {
    // unassignRefereeFromMatch is awaited as its own statement before
    // res.status(204).send() runs, so a rejection here means res.status
    // never gets called.
    const req = { params: { id: '4', rid: '2' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValueOnce(4).mockReturnValueOnce(2);
    const serviceError = new AppError(404, 'ASSIGNMENT_NOT_FOUND', 'x');
    mockedRefereeService.unassignRefereeFromMatch.mockRejectedValue(serviceError);

    await expect(unassignFromMatch(req, res)).rejects.toBe(serviceError);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('referee.controller removeFromTournament()', () => {
  it("parses the tournament id and referee id (param 'rid'), forwards userId and req.tournament.sport_type_id, responds 200", async () => {
    const req = {
      params: { id: '3', rid: '2' },
      user: { user_id: 1 },
      tournament: { sport_type_id: 5 },
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValueOnce(3).mockReturnValueOnce(2);
    const serviceResult = { removed: true };
    mockedRefereeService.removeTournamentReferee.mockResolvedValue(serviceResult as any);

    await removeFromTournament(req, res);

    expect(mockedParseId).toHaveBeenNthCalledWith(1, '3', 'รหัสทัวร์นาเมนต์');
    expect(mockedParseId).toHaveBeenNthCalledWith(2, '2', 'รหัสกรรมการ', 'rid');
    expect(mockedRefereeService.removeTournamentReferee).toHaveBeenCalledWith(3, 2, 1, 5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates the error and never calls the service when the tournament id fails to parse', async () => {
    const req = {
      params: { id: 'bad', rid: '2' },
      user: { user_id: 1 },
      tournament: { sport_type_id: 5 },
    } as unknown as Request;
    const res = makeRes();
    const parseError = new AppError(400, 'VALIDATION_FAILED', 'x');
    mockedParseId.mockImplementationOnce(() => {
      throw parseError;
    });

    await expect(removeFromTournament(req, res)).rejects.toBe(parseError);
    expect(mockedRefereeService.removeTournamentReferee).not.toHaveBeenCalled();
  });

  it('characterization: throws a TypeError when req.user is absent', async () => {
    const req = {
      params: { id: '3', rid: '2' },
      user: undefined,
      tournament: { sport_type_id: 5 },
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValueOnce(3).mockReturnValueOnce(2);

    await expect(removeFromTournament(req, res)).rejects.toBeInstanceOf(TypeError);
    expect(mockedRefereeService.removeTournamentReferee).not.toHaveBeenCalled();
  });

  it('characterization: throws a TypeError when req.tournament is absent', async () => {
    const req = {
      params: { id: '3', rid: '2' },
      user: { user_id: 1 },
      tournament: undefined,
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValueOnce(3).mockReturnValueOnce(2);

    await expect(removeFromTournament(req, res)).rejects.toBeInstanceOf(TypeError);
    expect(mockedRefereeService.removeTournamentReferee).not.toHaveBeenCalled();
  });

  it('propagates a service rejection', async () => {
    const req = {
      params: { id: '3', rid: '2' },
      user: { user_id: 1 },
      tournament: { sport_type_id: 5 },
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValueOnce(3).mockReturnValueOnce(2);
    const serviceError = new AppError(403, 'FORBIDDEN', 'x');
    mockedRefereeService.removeTournamentReferee.mockRejectedValue(serviceError);

    await expect(removeFromTournament(req, res)).rejects.toBe(serviceError);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('referee.controller coverage()', () => {
  it("parses the tournament id and forwards req.tournament.sport_type_id, responds 200", async () => {
    const req = {
      params: { id: '3' },
      tournament: { sport_type_id: 5 },
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(3);
    const serviceResult = { covered: true };
    mockedRefereeService.getRefereeCoverage.mockResolvedValue(serviceResult as any);

    await coverage(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('3', 'รหัสทัวร์นาเมนต์');
    expect(mockedRefereeService.getRefereeCoverage).toHaveBeenCalledWith(3, 5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates the error and never calls the service when parseId fails', async () => {
    const req = { params: { id: 'bad' }, tournament: { sport_type_id: 5 } } as unknown as Request;
    const res = makeRes();
    const parseError = new AppError(400, 'VALIDATION_FAILED', 'x');
    mockedParseId.mockImplementation(() => {
      throw parseError;
    });

    await expect(coverage(req, res)).rejects.toBe(parseError);
    expect(mockedRefereeService.getRefereeCoverage).not.toHaveBeenCalled();
  });

  it('characterization: throws a TypeError when req.tournament is absent', async () => {
    const req = { params: { id: '3' }, tournament: undefined } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(3);

    await expect(coverage(req, res)).rejects.toBeInstanceOf(TypeError);
    expect(mockedRefereeService.getRefereeCoverage).not.toHaveBeenCalled();
  });

  it('propagates a service rejection', async () => {
    const req = { params: { id: '3' }, tournament: { sport_type_id: 5 } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(3);
    const serviceError = new AppError(500, 'INTERNAL_ERROR', 'x');
    mockedRefereeService.getRefereeCoverage.mockRejectedValue(serviceError);

    await expect(coverage(req, res)).rejects.toBe(serviceError);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).not.toHaveBeenCalled();
  });
});
