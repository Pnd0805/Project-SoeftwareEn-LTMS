import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

import { notFound } from '../notFound.js';
import { AppError } from '../../utils/AppError.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('notFound middleware', () => {
  it('calls next with a 404 NOT_FOUND AppError for any unmatched route', () => {
    const req = { path: '/does/not/exist' } as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    notFound(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('never touches res directly — it always defers to errorHandler via next()', () => {
    const req = {} as Request;
    const res = {
      status: vi.fn(),
      json: vi.fn(),
      send: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    notFound(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });
});
