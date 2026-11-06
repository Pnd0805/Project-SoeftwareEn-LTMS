import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../config/env.js', () => ({ env: { EMAIL_NOTIFICATIONS_ENABLED: true, FRONTEND_URL: 'http://localhost:8080', MAIL_FROM: 'no-reply@ltms.local' } }));
vi.mock('../../config/mail.js', () => ({ default: { sendMail: vi.fn() } }));
vi.mock('../../repositories/emailNotification.repo.js', () => ({
  readyGroups: vi.fn(), claim: vi.fn(), finish: vi.fn(), retry: vi.fn(),
}));
import mail from '../../config/mail.js';
import * as Repo from '../../repositories/emailNotification.repo.js';
import type { MailItem } from '../../repositories/emailNotification.repo.js';
import { env } from '../../config/env.js';
import { processEmailOutbox, startEmailNotificationWorker } from '../emailNotification.worker.js';

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

// ─────────────────────────── processEmailOutbox — more paths ───────────────────────────

const sent = (n = 0) => vi.mocked(mail.sendMail).mock.calls[n]![0] as { from: string; to: string; subject: string; text: string; html: string };

describe('processEmailOutbox — grouping and filtering', () => {
  it('does nothing when there are no ready groups', async () => {
    await processEmailOutbox();
    expect(Repo.claim).not.toHaveBeenCalled();
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('moves on when another process already claimed every row of a group', async () => {
    vi.mocked(Repo.readyGroups).mockResolvedValue([
      { user_id: 5, delivery_mode: 'immediate' },
      { user_id: 6, delivery_mode: 'immediate' },
    ]);
    vi.mocked(Repo.claim).mockResolvedValueOnce([]).mockResolvedValueOnce([row(9, { user_id: 6 })]);

    await processEmailOutbox();

    expect(Repo.claim).toHaveBeenNthCalledWith(1, 5, 'immediate');
    expect(Repo.claim).toHaveBeenNthCalledWith(2, 6, 'immediate');
    expect(Repo.finish).toHaveBeenCalledTimes(1);
    expect(Repo.finish).toHaveBeenCalledWith([9], 'sent');
  });

  it('skips only the rows that are not allowed and still sends the rest', async () => {
    vi.mocked(Repo.readyGroups).mockResolvedValue([{ user_id: 5, delivery_mode: 'digest' }]);
    // ปิดเฉพาะหมวด community — หมวดอื่นยังได้รับตามปกติ
    const prefs = { community: false };
    vi.mocked(Repo.claim).mockResolvedValue([
      row(1, { category: 'team', email_notification_prefs: prefs }),
      row(2, { category: 'community', email_notification_prefs: prefs }),
      row(3, { category: 'team', email_notification_prefs: prefs }),
    ]);

    await processEmailOutbox();

    expect(Repo.finish).toHaveBeenCalledWith([2], 'skipped');
    expect(mail.sendMail).toHaveBeenCalledTimes(1);
    expect(Repo.finish).toHaveBeenCalledWith([1, 3], 'sent');
  });

  it('reads prefs stored as a JSON string', async () => {
    vi.mocked(Repo.readyGroups).mockResolvedValue([{ user_id: 5, delivery_mode: 'immediate' }]);
    vi.mocked(Repo.claim).mockResolvedValue([row(1, { email_notification_prefs: '{"critical":false}' })]);

    await processEmailOutbox();

    expect(mail.sendMail).not.toHaveBeenCalled();
    expect(Repo.finish).toHaveBeenCalledWith([1], 'skipped');
  });

  it('does not call finish(skipped) when every row is allowed', async () => {
    vi.mocked(Repo.readyGroups).mockResolvedValue([{ user_id: 5, delivery_mode: 'immediate' }]);
    vi.mocked(Repo.claim).mockResolvedValue([row(1)]);

    await processEmailOutbox();

    expect(Repo.finish).not.toHaveBeenCalledWith(expect.anything(), 'skipped');
  });
});

describe('processEmailOutbox — failures', () => {
  it('an SMTP failure on one immediate email does not stop the next one', async () => {
    vi.mocked(Repo.readyGroups).mockResolvedValue([{ user_id: 5, delivery_mode: 'immediate' }]);
    const first = row(1);
    vi.mocked(Repo.claim).mockResolvedValue([first, row(2)]);
    vi.mocked(mail.sendMail).mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({} as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await processEmailOutbox();
    spy.mockRestore();

    expect(Repo.retry).toHaveBeenCalledWith([first], expect.any(Error));
    expect(Repo.finish).toHaveBeenCalledWith([2], 'sent');
    expect(Repo.finish).not.toHaveBeenCalledWith([1], 'sent');
  });

  it('logs the SMTP failure', async () => {
    vi.mocked(Repo.readyGroups).mockResolvedValue([{ user_id: 5, delivery_mode: 'immediate' }]);
    vi.mocked(Repo.claim).mockResolvedValue([row(1)]);
    const boom = new Error('mailpit offline');
    vi.mocked(mail.sendMail).mockRejectedValue(boom);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await processEmailOutbox();

    expect(spy).toHaveBeenCalledWith('[email-outbox] SMTP delivery failed', boom);
    spy.mockRestore();
  });

  it('a failure while marking a row as sent is retried, not lost', async () => {
    vi.mocked(Repo.readyGroups).mockResolvedValue([{ user_id: 5, delivery_mode: 'immediate' }]);
    const item = row(1);
    vi.mocked(Repo.claim).mockResolvedValue([item]);
    vi.mocked(Repo.finish).mockRejectedValueOnce(new Error('DB_DOWN'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await processEmailOutbox();
    spy.mockRestore();

    expect(Repo.retry).toHaveBeenCalledWith([item], expect.any(Error));
  });

  it('a repository failure outside the send loop is thrown to the caller', async () => {
    vi.mocked(Repo.readyGroups).mockRejectedValue(new Error('DB_DOWN'));
    await expect(processEmailOutbox()).rejects.toThrow('DB_DOWN');
  });
});

describe('processEmailOutbox — message content', () => {
  it('immediate email: subject is "LTMS: <title>", from MAIL_FROM, to the recipient', async () => {
    vi.mocked(Repo.readyGroups).mockResolvedValue([{ user_id: 5, delivery_mode: 'immediate' }]);
    vi.mocked(Repo.claim).mockResolvedValue([row(1, { title: 'แมตช์เลื่อน' })]);

    await processEmailOutbox();

    expect(sent()).toMatchObject({
      from: 'no-reply@ltms.local',
      to: 'verified@example.com',
      subject: 'LTMS: แมตช์เลื่อน',
    });
  });

  it('digest email: one message listing every item with a count in the subject', async () => {
    vi.mocked(Repo.readyGroups).mockResolvedValue([{ user_id: 5, delivery_mode: 'digest' }]);
    vi.mocked(Repo.claim).mockResolvedValue([
      row(3, { category: 'team', title: 'ทีม A', message: 'ข้อความ A' }),
      row(4, { category: 'team', title: 'ทีม B', message: 'ข้อความ B' }),
    ]);

    await processEmailOutbox();

    const msg = sent();
    expect(msg.subject).toBe('สรุปการแจ้งเตือน LTMS (2 รายการ)');
    for (const part of ['ทีม A', 'ข้อความ A', 'ทีม B', 'ข้อความ B']) {
      expect(msg.text).toContain(part);
      expect(msg.html).toContain(part);
    }
    expect(Repo.finish).toHaveBeenCalledWith([3, 4], 'sent');
  });

  it('greets the recipient by name in both text and HTML', async () => {
    vi.mocked(Repo.readyGroups).mockResolvedValue([{ user_id: 5, delivery_mode: 'immediate' }]);
    vi.mocked(Repo.claim).mockResolvedValue([row(1, { full_name: 'สมชาย' })]);

    await processEmailOutbox();

    expect(sent().text).toContain('สวัสดีคุณ สมชาย');
    expect(sent().html).toContain('สวัสดีคุณ สมชาย');
  });

  it('escapes every HTML special character in name, title and message', async () => {
    vi.mocked(Repo.readyGroups).mockResolvedValue([{ user_id: 5, delivery_mode: 'immediate' }]);
    vi.mocked(Repo.claim).mockResolvedValue([row(1, {
      full_name: `<b>"O'Neil"</b>`,
      title: 'A & B',
      message: `<script>alert('x')</script>`,
    })]);

    await processEmailOutbox();

    const html = sent().html;
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;&quot;O&#39;Neil&quot;&lt;/b&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;');
  });

  it('turns newlines in the message into <br> in HTML but keeps them in text', async () => {
    vi.mocked(Repo.readyGroups).mockResolvedValue([{ user_id: 5, delivery_mode: 'immediate' }]);
    vi.mocked(Repo.claim).mockResolvedValue([row(1, { message: 'บรรทัด 1\nบรรทัด 2' })]);

    await processEmailOutbox();

    expect(sent().html).toContain('บรรทัด 1<br>บรรทัด 2');
    expect(sent().text).toContain('บรรทัด 1\nบรรทัด 2');
  });

  it('links to <FRONTEND_URL>/inbox, without a double slash', async () => {
    const original = env.FRONTEND_URL;
    (env as { FRONTEND_URL: string }).FRONTEND_URL = 'https://ltms.example/';
    vi.mocked(Repo.readyGroups).mockResolvedValue([{ user_id: 5, delivery_mode: 'immediate' }]);
    vi.mocked(Repo.claim).mockResolvedValue([row(1)]);

    try {
      await processEmailOutbox();
    } finally {
      (env as { FRONTEND_URL: string }).FRONTEND_URL = original;
    }

    expect(sent().text).toContain('https://ltms.example/inbox');
    expect(sent().html).toContain('href="https://ltms.example/inbox"');
  });
});

// ─────────────────────────── startEmailNotificationWorker ───────────────────────────

describe('startEmailNotificationWorker', () => {
  const setEnabled = (on: boolean) => { (env as { EMAIL_NOTIFICATIONS_ENABLED: boolean }).EMAIL_NOTIFICATIONS_ENABLED = on; };

  beforeEach(() => {
    vi.useFakeTimers();
    setEnabled(true);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    setEnabled(true);
  });

  it('does nothing at all when EMAIL_NOTIFICATIONS_ENABLED is off', async () => {
    setEnabled(false);

    startEmailNotificationWorker();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(Repo.readyGroups).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('polls once right away, then every 30 seconds', async () => {
    startEmailNotificationWorker();
    await vi.advanceTimersByTimeAsync(0);
    expect(Repo.readyGroups).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(29_999);
    expect(Repo.readyGroups).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(Repo.readyGroups).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(Repo.readyGroups).toHaveBeenCalledTimes(4);
  });

  it('skips a tick while the previous poll is still running (no overlap)', async () => {
    let release!: () => void;
    vi.mocked(Repo.readyGroups).mockImplementationOnce(
      () => new Promise((resolve) => { release = () => resolve([]); }),
    );

    startEmailNotificationWorker();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);   // tick while the first poll is stuck
    expect(Repo.readyGroups).toHaveBeenCalledTimes(1);

    release();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(Repo.readyGroups).toHaveBeenCalledTimes(2);
  });

  it('logs a failed poll and keeps polling afterwards', async () => {
    const boom = new Error('DB_DOWN');
    vi.mocked(Repo.readyGroups).mockRejectedValueOnce(boom);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    startEmailNotificationWorker();
    await vi.advanceTimersByTimeAsync(0);
    expect(spy).toHaveBeenCalledWith('[email-outbox] worker failed', boom);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(Repo.readyGroups).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('unrefs its interval so it never keeps the process alive', () => {
    const unref = vi.fn();
    const spy = vi.spyOn(globalThis, 'setInterval').mockReturnValue({ unref } as never);

    startEmailNotificationWorker();

    expect(spy).toHaveBeenCalledWith(expect.any(Function), 30_000);
    expect(unref).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
