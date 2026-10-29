import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMAIL_CATEGORIES, nextDigestDue, resolveEmailPrefs } from '../../config/emailNotification.js';
import { emailNotificationPrefsSchema } from '../../schemas/notification.schema.js';

vi.mock('../../config/env.js', () => ({
  env: { EMAIL_NOTIFICATIONS_ENABLED: true, FRONTEND_URL: 'http://localhost:8080', MAIL_FROM: 'no-reply@ltms.local' },
}));
vi.mock('../../repositories/emailNotification.repo.js', () => ({
  readPreferences: vi.fn(), savePreferences: vi.fn(), enqueue: vi.fn(),
  readyGroups: vi.fn(), claim: vi.fn(), finish: vi.fn(), retry: vi.fn(),
}));
import * as Repo from '../../repositories/emailNotification.repo.js';
import { getEmailPreferences, updateEmailPreferences, queueNotificationEmail } from '../emailNotification.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(Repo.readPreferences).mockResolvedValue(null);
  vi.mocked(Repo.savePreferences).mockResolvedValue(true);
  vi.mocked(Repo.enqueue).mockResolvedValue(undefined);
});

describe('email preferences independent of in-app preferences', () => {
  it('defaults all seven categories to enabled, including critical', () => {
    expect(EMAIL_CATEGORIES).toHaveLength(7);
    expect(Object.values(resolveEmailPrefs(null))).toEqual(Array(7).fill(true));
    expect(resolveEmailPrefs({ critical: false, community: false }).critical).toBe(false);
    expect(resolveEmailPrefs('{"critical":false}').critical).toBe(false);
  });
  it('validates partial booleans strictly and permits critical=false', () => {
    expect(emailNotificationPrefsSchema.parse({ critical: false })).toEqual({ critical: false });
    expect(() => emailNotificationPrefsSchema.parse({ critical: 'false' })).toThrow();
    expect(() => emailNotificationPrefsSchema.parse({ surprise: true })).toThrow();
    expect(() => emailNotificationPrefsSchema.parse({})).toThrow();
  });
  it('GET and PATCH allow independent category toggles', async () => {
    vi.mocked(Repo.readPreferences).mockResolvedValue({ critical: false });
    const view = await getEmailPreferences(5);
    expect(view.categories.find(x => x.key === 'critical')).toEqual({ key: 'critical', enabled: false, locked: false });
    await updateEmailPreferences(5, { team: false });
    expect(Repo.savePreferences).toHaveBeenCalledWith(5, expect.objectContaining({ critical: false, team: false, match: true }));
  });
  it('does not invent a user on GET or PATCH', async () => {
    vi.mocked(Repo.readPreferences).mockResolvedValue(undefined);
    await expect(getEmailPreferences(5)).rejects.toMatchObject({ status: 404 });
    await expect(updateEmailPreferences(5, { team: false })).rejects.toMatchObject({ status: 404 });
  });
});

describe('durable queue scheduling', () => {
  it('schedules daily at 08:00 Asia/Bangkok, never in the past', () => {
    expect(nextDigestDue(new Date('2026-10-08T00:59:00Z'))).toBe('2026-10-08 01:00:00');
    expect(nextDigestDue(new Date('2026-10-08T01:00:00Z'))).toBe('2026-10-09 01:00:00');
  });
  it('critical is immediate, other categories are daily', async () => {
    await queueNotificationEmail(10, 5, 'match_scheduled');
    await queueNotificationEmail(11, 5, 'tournament_announcement');
    expect(Repo.enqueue).toHaveBeenNthCalledWith(1, 10, 5, 'critical', 'immediate', expect.any(String));
    expect(Repo.enqueue).toHaveBeenNthCalledWith(2, 11, 5, 'tournament', 'digest', expect.any(String));
  });
});
