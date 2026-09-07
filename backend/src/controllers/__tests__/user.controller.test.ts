import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/user.service.js', () => ({
  getUserById: vi.fn(),
  getUserStats: vi.fn(),
  searchUsers: vi.fn(),
  updateMe: vi.fn(),
}));

vi.mock('../../mappers/user.mapper.js', () => ({
  toMeDto: vi.fn(),
}));

vi.mock('../../utils/parseId.js', () => ({
  parseId: vi.fn(),
}));

import { getMe, getUserById, getUserStats, searchUser, patchMe } from '../user.controller.js';
import * as UserService from '../../services/user.service.js';
import { toMeDto } from '../../mappers/user.mapper.js';
import { parseId } from '../../utils/parseId.js';
import { AppError } from '../../utils/AppError.js';

const mockedUserService = vi.mocked(UserService);
const mockedToMeDto = vi.mocked(toMeDto);
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

describe('user.controller getMe()', () => {
  it('throws USER_NOT_FOUND before touching res when req.user is missing', async () => {
    const req = { user: undefined } as Request;
    const res = makeRes();

    await expect(getMe(req, res)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(mockedToMeDto).not.toHaveBeenCalled();
  });

  it('maps req.user with toMeDto and responds 200', async () => {
    const user = { user_id: 1, full_name: 'Test' };
    const req = { user } as unknown as Request;
    const res = makeRes();
    mockedToMeDto.mockReturnValue({ id: 1, fullName: 'Test' } as any);

    await getMe(req, res);

    expect(mockedToMeDto).toHaveBeenCalledWith(user);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ id: 1, fullName: 'Test' });
  });
});

describe('user.controller getUserById()', () => {
  it('parses the id param and responds 200 with the service result', async () => {
    const req = { params: { id: '42' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(42);
    mockedUserService.getUserById.mockResolvedValue({ id: 42 } as any);

    await getUserById(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('42', 'รหัสผู้ใช้');
    expect(mockedUserService.getUserById).toHaveBeenCalledWith(42);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ id: 42 });
  });

  it('propagates the error when parseId rejects a malformed id', async () => {
    const req = { params: { id: 'not-a-number' } } as unknown as Request;
    const res = makeRes();
    const parseError = new AppError(400, 'INVALID_ID', 'x');
    mockedParseId.mockImplementation(() => {
      throw parseError;
    });

    await expect(getUserById(req, res)).rejects.toBe(parseError);
    expect(mockedUserService.getUserById).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('user.controller getUserStats()', () => {
  it('parses the id param and responds 200 with the stats', async () => {
    const req = { params: { id: '7' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(7);
    mockedUserService.getUserStats.mockResolvedValue({ userId: 7, stats: [] } as any);

    await getUserStats(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('7', 'รหัสผู้ใช้');
    expect(mockedUserService.getUserStats).toHaveBeenCalledWith(7);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ userId: 7, stats: [] });
  });
});

describe('user.controller searchUser()', () => {
  it('throws QUERY_TOO_SHORT before touching res when q is missing from the query', async () => {
    const req = { query: {} } as unknown as Request;
    const res = makeRes();

    await expect(searchUser(req, res)).rejects.toMatchObject({
      status: 400,
      code: 'QUERY_TOO_SHORT',
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(mockedUserService.searchUsers).not.toHaveBeenCalled();
  });

  it('throws QUERY_TOO_SHORT when q is not a string (e.g. an array from ?q=a&q=b)', async () => {
    const req = { query: { q: ['a', 'b'] } } as unknown as Request;
    const res = makeRes();

    await expect(searchUser(req, res)).rejects.toMatchObject({
      code: 'QUERY_TOO_SHORT',
    });
  });

  it('searches with the query string and responds 200', async () => {
    const req = { query: { q: 'ali' } } as unknown as Request;
    const res = makeRes();
    mockedUserService.searchUsers.mockResolvedValue({ items: [] } as any);

    await searchUser(req, res);

    expect(mockedUserService.searchUsers).toHaveBeenCalledWith('ali');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ items: [] });
  });
});

describe('user.controller patchMe()', () => {
  it('throws USER_NOT_FOUND before touching res when req.user is missing', async () => {
    const req = { user: undefined, body: {} } as Request;
    const res = makeRes();

    await expect(patchMe(req, res)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(mockedUserService.updateMe).not.toHaveBeenCalled();
  });

  it('updates the authenticated user and responds 200', async () => {
    const req = { user: { user_id: 1 }, body: { contactInfo: 'x' } } as unknown as Request;
    const res = makeRes();
    mockedUserService.updateMe.mockResolvedValue({ id: 1, contactInfo: 'x' } as any);

    await patchMe(req, res);

    expect(mockedUserService.updateMe).toHaveBeenCalledWith(1, { contactInfo: 'x' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ id: 1, contactInfo: 'x' });
  });
});
