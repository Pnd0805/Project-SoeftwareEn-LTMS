import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../password.js';

// These tests use the real bcrypt library end-to-end — no mocking — since
// the entire point of this file is confirming passwords are actually
// hashed and verified correctly. bcrypt is deliberately slow, so this
// file will take noticeably longer than the rest of the suite; that's
// expected and not a bug.

describe('hashPassword', () => {
  it('returns a bcrypt hash string, not the plaintext password', async () => {
    const hash = await hashPassword('my-secret-password');

    expect(hash).not.toBe('my-secret-password');
    // bcrypt hashes always start with a version identifier like $2a$, $2b$, or $2y$
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it('produces a different hash each time for the same input (random salt)', async () => {
    const hash1 = await hashPassword('same-password');
    const hash2 = await hashPassword('same-password');

    expect(hash1).not.toBe(hash2);
  });
});

describe('verifyPassword', () => {
  it('returns true when the plaintext matches the hash it was generated from', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');

    await expect(verifyPassword('correct-horse-battery-staple', hash)).resolves.toBe(true);
  });

  it('returns false when the plaintext does not match the hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');

    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('is case-sensitive', async () => {
    const hash = await hashPassword('CaseSensitive123');

    await expect(verifyPassword('casesensitive123', hash)).resolves.toBe(false);
  });

  it('returns false (not a thrown error) for an empty password against a real hash', async () => {
    const hash = await hashPassword('actual-password');

    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });
});
