import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

import { validate } from '../validate.js';
import { AppError } from '../../utils/AppError.js';

function makeReq(body: unknown): Request {
  return { body } as unknown as Request;
}

function makeRes(): Response {
  return {} as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validate middleware', () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().min(18),
  });

  it('calls next() with no error and replaces req.body with parsed data on success', () => {
    const req = makeReq({ email: 'test@example.com', age: 20, extraField: 'ignored' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ email: 'test@example.com', age: 20 });
  });

  it('calls next with a single-field VALIDATION_FAILED AppError when one field is invalid', () => {
    const req = makeReq({ email: 'not-an-email', age: 20 });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_FAILED');
    expect(err.extra?.fields).toEqual({
      email: expect.any(String),
    });
  });

  it('collects one message per field when multiple fields are invalid', () => {
    const req = makeReq({ email: 'not-an-email', age: 10 });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    validate(schema)(req, res, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    const fields = err.extra?.fields as Record<string, string>;
    expect(Object.keys(fields).sort()).toEqual(['age', 'email']);
  });

  it('reports a missing required field under its own key', () => {
    const req = makeReq({ age: 20 });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    validate(schema)(req, res, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    const fields = err.extra?.fields as Record<string, string>;
    expect(fields).toHaveProperty('email');
  });

  it('does not mutate req.body when validation fails', () => {
    const originalBody = { email: 'bad', age: 5 };
    const req = makeReq(originalBody);
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    validate(schema)(req, res, next);

    expect(req.body).toBe(originalBody);
  });
});
