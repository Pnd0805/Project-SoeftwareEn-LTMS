import { describe, expect, it } from 'vitest';
import { mailTransportOptions } from '../mailOptions.js';

describe('SMTP transport options', () => {
  it('uses mandatory STARTTLS and an SMTP key for Brevo on port 587', () => {
    expect(mailTransportOptions({
      SMTP_HOST: 'smtp-relay.brevo.com', SMTP_PORT: 587,
      SMTP_REQUIRE_TLS: true, SMTP_USER: 'smtp-login', SMTP_PASS: 'smtp-key',
    })).toMatchObject({
      host: 'smtp-relay.brevo.com', port: 587, secure: false, requireTLS: true,
      auth: { user: 'smtp-login', pass: 'smtp-key' },
    });
  });

  it('supports implicit TLS for port 465', () => {
    expect(mailTransportOptions({
      SMTP_HOST: 'other-provider', SMTP_PORT: 465, SMTP_REQUIRE_TLS: false,
    })).toMatchObject({ port: 465, secure: true });
  });

  it('does not send auth to local Mailpit when credentials are absent', () => {
    const options = mailTransportOptions({
      SMTP_HOST: 'localhost', SMTP_PORT: 1025, SMTP_REQUIRE_TLS: false,
    });
    expect(options).toMatchObject({ host: 'localhost', port: 1025, secure: false, requireTLS: false });
    expect(options).not.toHaveProperty('auth');
  });
});
