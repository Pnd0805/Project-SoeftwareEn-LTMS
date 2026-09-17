import { describe, it, expect, vi } from 'vitest';

vi.mock('../env.js', () => ({
  env: { JWT_SECRET: 'test-secret', JWT_EXPIRES_IN: '7d' },
}));

import { authConfig, parseExpiresIn } from '../auth.js';

describe('parseExpiresIn', () => {
  it.each([
    ['604800', 604800],
    ['3600s', 3600],
    ['30m', 1800],
    ['12h', 43200],
    ['7d', 604800],
    [' 7d ', 604800],
  ])('converts %j to %i seconds', (raw, seconds) => {
    expect(parseExpiresIn(raw)).toBe(seconds);
  });

  it.each(['', '7w', 'abc', '1.5h', '-5', '0'])('rejects %j with a clear error', (raw) => {
    expect(() => parseExpiresIn(raw)).toThrow(/JWT_EXPIRES_IN/);
  });
});

describe('authConfig', () => {
  it('turns the .env value "7d" into 604800 seconds (A02 expiresIn)', () => {
    expect(authConfig.expireIn).toBe(604800);
  });
});
