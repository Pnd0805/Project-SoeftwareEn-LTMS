import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

import { errorHandler } from '../errorHandler.js';
import { AppError } from '../../utils/AppError.js';

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

const req = {} as Request;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('errorHandler middleware', () => {
  it('responds with the AppError\'s own status code and error body', () => {
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    const err = new AppError(404, 'TEAM_NOT_FOUND', 'ไม่พบทีมนี้ในระบบ');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'TEAM_NOT_FOUND', message: 'ไม่พบทีมนี้ในระบบ' },
    });
  });

  it('spreads err.extra into the error body (e.g. field-level validation errors)', () => {
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    const err = new AppError(400, 'VALIDATION_FAILED', 'ข้อมูลไม่ถูกต้อง', {
      fields: { email: 'อีเมลไม่ถูกต้อง' },
    });

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'ข้อมูลไม่ถูกต้อง',
        fields: { email: 'อีเมลไม่ถูกต้อง' },
      },
    });
  });

  it('does not error when extra is undefined (no spread crash)', () => {
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    const err = new AppError(401, 'NO_TOKEN', 'กรุณาเข้าสู่ระบบก่อนใช้งาน');

    expect(() => errorHandler(err, req, res, next)).not.toThrow();
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'NO_TOKEN', message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
    });
  });

  it('never calls next() — it always terminates the response itself', () => {
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    const err = new AppError(404, 'USER_NOT_FOUND', 'x');

    errorHandler(err, req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  describe('for non-AppError errors (unexpected exceptions)', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('responds 500 with a generic INTERNAL_ERROR body, hiding the real message', () => {
      const res = makeRes();
      const next = vi.fn() as NextFunction;
      const err = new Error('connect ECONNREFUSED 127.0.0.1:3306');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(body.error.code).toBe('INTERNAL_ERROR');
      // The raw error message (which could leak internals like a DB
      // connection string) must never reach the client.
      expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
      expect(JSON.stringify(body)).not.toContain('3306');
    });

    it('logs the original error server-side via console.error', () => {
      const res = makeRes();
      const next = vi.fn() as NextFunction;
      const err = new Error('unexpected failure');

      errorHandler(err, req, res, next);

      expect(consoleErrorSpy).toHaveBeenCalledWith(err);
    });

    it('never calls next() for unexpected errors either', () => {
      const res = makeRes();
      const next = vi.fn() as NextFunction;
      const err = new Error('boom');

      errorHandler(err, req, res, next);

      expect(next).not.toHaveBeenCalled();
    });
  });
});
