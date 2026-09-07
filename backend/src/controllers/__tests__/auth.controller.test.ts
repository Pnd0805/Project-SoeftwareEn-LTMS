import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/auth.service.js', () => ({
  register: vi.fn(),
  login: vi.fn(),
}));

import { register, login, logout } from '../auth.controller.js';
import * as authService from '../../services/auth.service.js';

const mockedAuthService = vi.mocked(authService);

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

describe('auth.controller register()', () => {
  it('registers and responds 201 with the service result', async () => {
    const req = { body: { email: 'a@b.com', password: 'pw', fullName: 'A' } } as Request;
    const res = makeRes();
    const serviceResult = { id: 1, fullName: 'A', email: 'a@b.com' };
    mockedAuthService.register.mockResolvedValue(serviceResult as any);

    await register(req, res);

    expect(mockedAuthService.register).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates (rejects with) the error when the service throws', async () => {
    const req = { body: {} } as Request;
    const res = makeRes();
    const serviceError = new Error('EMAIL_ALREADY_REGISTERED');
    mockedAuthService.register.mockRejectedValue(serviceError);

    await expect(register(req, res)).rejects.toBe(serviceError);
    // Note: `res.status(201).json(await ...)` evaluates `res.status(201)`
    // BEFORE awaiting the argument to `.json()`, so status IS called even
    // though the request ultimately fails — only `.json()` never fires,
    // so no body/headers actually get sent to the client.
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('auth.controller login()', () => {
  it('logs in with email/password from the body and responds 200 with the result', async () => {
    const req = { body: { email: 'a@b.com', password: 'pw' } } as Request;
    const res = makeRes();
    const serviceResult = { accessToken: 'token', expiresIn: 3600, tokenType: 'Bearer' };
    mockedAuthService.login.mockResolvedValue(serviceResult as any);

    await login(req, res);

    expect(mockedAuthService.login).toHaveBeenCalledWith('a@b.com', 'pw');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates (rejects with) the error when credentials are invalid', async () => {
    const req = { body: { email: 'a@b.com', password: 'wrong' } } as Request;
    const res = makeRes();
    const serviceError = new Error('INVALID_CREDENTIALS');
    mockedAuthService.login.mockRejectedValue(serviceError);

    await expect(login(req, res)).rejects.toBe(serviceError);
    // Same evaluation-order note as register(): res.status(200) runs before
    // the awaited service call can reject, but .json() never fires.
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('auth.controller logout()', () => {
  it('responds 204 with no body and does not call the auth service', async () => {
    const req = {} as Request;
    const res = makeRes();

    await logout(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
    expect(mockedAuthService.register).not.toHaveBeenCalled();
    expect(mockedAuthService.login).not.toHaveBeenCalled();
  });
});
