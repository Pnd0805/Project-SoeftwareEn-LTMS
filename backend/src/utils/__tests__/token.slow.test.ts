import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Only the config is mocked, to pin the secret/expiry to known test values.
// jsonwebtoken itself is real — we want to confirm actual sign/verify
// behavior, not a mocked stand-in for it.
vi.mock('../../config/auth.js', () => ({
  authConfig: {
    secret: 'test-secret-key',
    expireIn: 3600, // seconds
  },
}));

import { signToken, verifyToken } from '../token.js';
import { AppError } from '../AppError.js';

const TEST_SECRET = 'test-secret-key';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('signToken', () => {
  it('produces a well-formed JWT (three dot-separated segments)', () => {
    const token = signToken(1);
    expect(token.split('.')).toHaveLength(3);
  });

  it('stringifies the numeric userId into the "sub" claim', () => {
    const token = signToken(42);
    const decoded = jwt.verify(token, TEST_SECRET) as { sub: string };
    expect(decoded.sub).toBe('42');
    expect(typeof decoded.sub).toBe('string');
  });

  it('sets an expiry in the future based on authConfig.expireIn', () => {
    const token = signToken(1);
    const decoded = jwt.decode(token) as { exp: number; iat: number };
    expect(decoded.exp - decoded.iat).toBe(3600);
  });
});

describe('verifyToken', () => {
  it('returns the sub claim for a token signed by signToken itself', () => {
    const token = signToken(7);
    const result = verifyToken(token);
    expect(result).toEqual({ sub: '7' });
  });

  it('throws TOKEN_EXPIRED for a garbage/malformed token string', () => {
    expect(() => verifyToken('not-a-real-jwt')).toThrow(AppError);
    try {
      verifyToken('not-a-real-jwt');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).status).toBe(401);
      expect((err as AppError).code).toBe('TOKEN_EXPIRED');
    }
  });

  it('throws TOKEN_EXPIRED for a token signed with the wrong secret', () => {
    const foreignToken = jwt.sign({ sub: '1' }, 'a-different-secret', { expiresIn: 3600 });
    expect(() => verifyToken(foreignToken)).toThrow(AppError);
  });

  it('throws TOKEN_EXPIRED for an actually-expired token', () => {
    // Sign a token that expired 10 seconds ago by backdating iat/exp manually.
    const expiredToken = jwt.sign(
      { sub: '1', iat: Math.floor(Date.now() / 1000) - 100 },
      TEST_SECRET,
      { expiresIn: 10 }, // exp = iat + 10, which is already in the past
    );
    expect(() => verifyToken(expiredToken)).toThrow(AppError);
  });

  it('throws TOKEN_EXPIRED when the payload is a plain string rather than an object', () => {
    // jwt.sign can encode a raw string payload instead of an object.
    const stringPayloadToken = jwt.sign('just-a-string-payload', TEST_SECRET);
    expect(() => verifyToken(stringPayloadToken)).toThrow(AppError);
  });

  it('throws TOKEN_EXPIRED when sub is present but not a string', () => {
    // Craft a token whose "sub" claim is a number, not a string.
    const numericSubToken = jwt.sign({ sub: 123 }, TEST_SECRET, { expiresIn: 3600 });
    expect(() => verifyToken(numericSubToken)).toThrow(AppError);
  });

  it('throws TOKEN_EXPIRED when sub is missing entirely', () => {
    const noSubToken = jwt.sign({ role: 'admin' }, TEST_SECRET, { expiresIn: 3600 });
    expect(() => verifyToken(noSubToken)).toThrow(AppError);
  });
});
