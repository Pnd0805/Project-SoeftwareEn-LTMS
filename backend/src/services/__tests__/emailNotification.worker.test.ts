import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../config/env.js', () => ({ env: { EMAIL_NOTIFICATIONS_ENABLED: true, FRONTEND_URL: 'http://localhost:8080', MAIL_FROM: 'no-reply@ltms.local' } }));
vi.mock('../../config/mail.js', () => ({ default: { sendMail: vi.fn() } }));
vi.mock('../../repositories/emailNotification.repo.js', () => ({
  readyGroups: vi.fn(), claim: vi.fn(), finish: vi.fn(), retry: vi.fn(),
}));
import mail from '../../config/mail.js';
import * as Repo from '../../repositories/emailNotification.repo.js';
import type { MailItem } from '../../repositories/emailNotification.repo.js';
import { processEmailOutbox } from '../emailNotification.worker.js';

const row = (id: number, overrides: Partial<MailItem> = {}): MailItem => ({
  email_notification_id: id, notification_id: id, user_id: 5, category: 'critical',
  title: 'เปลี่ยนเวลาแข่ง', message: '<danger>', email: 'verified@example.com',
  full_name: 'ทดสอบ', email_verified: 1, email_notification_prefs: null, attempts: 0, ...overrides,
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(Repo.readyGroups).mockResolvedValue([]);
  vi.mocked(Repo.claim).mockResolvedValue([]);
  vi.mocked(Repo.finish).mockResolvedValue(undefined);
  vi.mocked(Repo.retry).mockResolvedValue(undefined);
  vi.mocked(mail.sendMail).mockResolvedValue({} as never);
});
it('skips unverified or unsubscribed recipients even when already queued', async () => {
  vi.mocked(Repo.readyGroups).mockResolvedValue([{ user_id: 5, delivery_mode: 'immediate' }]);
  vi.mocked(Repo.claim).mockResolvedValue([
    row(1, { email_verified: 0 }), row(2, { email_notification_prefs: { critical: false } }),
  ]);
  await processEmailOutbox();
  expect(mail.sendMail).not.toHaveBeenCalled();
  expect(Repo.finish).toHaveBeenCalledWith([1, 2], 'skipped');
});
it('sends critical individually, with both HTML escaping and plaintext', async () => {
  vi.mocked(Repo.readyGroups).mockResolvedValue([{ user_id: 5, delivery_mode: 'immediate' }]);
  vi.mocked(Repo.claim).mockResolvedValue([row(1), row(2)]);
  await processEmailOutbox();
  expect(mail.sendMail).toHaveBeenCalledTimes(2);
  expect(vi.mocked(mail.sendMail).mock.calls[0]?.[0]).toMatchObject({ to: 'verified@example.com', text: expect.stringContaining('<danger>'), html: expect.stringContaining('&lt;danger&gt;') });
  expect(Repo.finish).toHaveBeenCalledWith([1], 'sent');
});
it('groups non-critical into one daily digest and retries on SMTP failure', async () => {
  vi.mocked(Repo.readyGroups).mockResolvedValue([{ user_id: 5, delivery_mode: 'digest' }]);
  const rows = [row(3, { category: 'team' }), row(4, { category: 'community' })];
  vi.mocked(Repo.claim).mockResolvedValue(rows);
  vi.mocked(mail.sendMail).mockRejectedValue(new Error('mailpit offline'));
  const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await processEmailOutbox();
  spy.mockRestore();
  expect(mail.sendMail).toHaveBeenCalledTimes(1);
  expect(Repo.retry).toHaveBeenCalledWith(rows, expect.any(Error));
});
