import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../../config/env.js', () => ({
  env: { CHECKIN_QR_SECRET: 'qr-test-secret', JWT_SECRET: 'login-test-secret' },
}));

import { signCheckinQr, verifyCheckinQr } from '../checkinQr.js';
import { AppError } from '../AppError.js';

function expectMismatch(fn: () => void) {
  try {
    fn();
    expect.unreachable('should have thrown');
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('CHECKIN_QR_MISMATCH');
  }
}

describe('checkinQr', () => {
  it('signs a QR that verifies for the same match', () => {
    const { qrPayload } = signCheckinQr(42);
    expect(() => verifyCheckinQr(qrPayload, 42)).not.toThrow();
  });

  it('expires 20 minutes after signing', () => {
    const before = Date.now();
    const { qrPayload, expiresAt } = signCheckinQr(42);

    const decoded = jwt.decode(qrPayload) as { iat: number; exp: number };
    expect(decoded.exp - decoded.iat).toBe(1200);
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(1200 * 1000);
    expect(expiresAt.getTime() - before).toBeLessThan(1201 * 1000);
  });

  it('rejects a QR for a different match', () => {
    const { qrPayload } = signCheckinQr(42);
    expectMismatch(() => verifyCheckinQr(qrPayload, 43));
  });

  it('uses CHECKIN_QR_SECRET — a token signed with the login secret is rejected', () => {
    const forged = jwt.sign({ type: 'checkin_qr', matchId: 42 }, 'login-test-secret');
    expectMismatch(() => verifyCheckinQr(forged, 42));
  });

  it('rejects a correctly signed token that is not a check-in QR', () => {
    const loginLike = jwt.sign({ sub: '9001' }, 'qr-test-secret');
    expectMismatch(() => verifyCheckinQr(loginLike, 42));
  });
});
