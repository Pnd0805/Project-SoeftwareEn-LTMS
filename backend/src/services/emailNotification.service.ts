import { categoryOf, type NotificationType } from '../config/notificationCategories.js';
import { EMAIL_CATEGORIES, immediateDue, nextDigestDue, resolveEmailPrefs } from '../config/emailNotification.js';
import * as EmailRepo from '../repositories/emailNotification.repo.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export async function getEmailPreferences(userId: number) {
    const stored = await EmailRepo.readPreferences(userId);
    if (stored === undefined) throw new AppError(404, 'USER_NOT_FOUND', 'ไม่พบผู้ใช้นี้');
    const prefs = resolveEmailPrefs(stored);
    return { categories: EMAIL_CATEGORIES.map(key => ({ key, enabled: prefs[key], locked: false })),
        delivery: { critical: 'immediate', other: 'daily', hourThailand: 8 } };
}

export async function updateEmailPreferences(userId: number, patch: Partial<ReturnType<typeof resolveEmailPrefs>>) {
    const stored = await EmailRepo.readPreferences(userId);
    if (stored === undefined) throw new AppError(404, 'USER_NOT_FOUND', 'ไม่พบผู้ใช้นี้');
    const prefs = { ...resolveEmailPrefs(stored), ...patch };
    if (!(await EmailRepo.savePreferences(userId, prefs)))
        throw new AppError(404, 'USER_NOT_FOUND', 'ไม่พบผู้ใช้นี้');
    return getEmailPreferences(userId);
}

/** Only writes a durable queue entry: no SMTP network call in a user's HTTP request. */
export async function queueNotificationEmail(notificationId: number, userId: number, type: NotificationType): Promise<void> {
    if (!env.EMAIL_NOTIFICATIONS_ENABLED) return;
    const category = categoryOf(type);
    const mode = category === 'critical' ? 'immediate' : 'digest';
    await EmailRepo.enqueue(notificationId, userId, category, mode,
        mode === 'immediate' ? immediateDue() : nextDigestDue());
}
