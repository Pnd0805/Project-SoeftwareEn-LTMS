import { MUTABLE_CATEGORIES, type NotificationCategory } from './notificationCategories.js';

export const EMAIL_CATEGORIES = ['critical', ...MUTABLE_CATEGORIES] as const;
export type EmailCategory = NotificationCategory;
export type EmailPreferences = Record<EmailCategory, boolean>;

/** Email preferences are independent of the in-app notification preferences. */
export function resolveEmailPrefs(raw: unknown): EmailPreferences {
    let value: unknown = raw;
    if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch { value = null; }
    }
    const settings = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown> : {};
    return Object.fromEntries(EMAIL_CATEGORIES.map(category => [category, settings[category] !== false])) as EmailPreferences;
}

/** Bangkok remains UTC+7 year-round. Send one digest at the next 08:00 ICT. */
export function nextDigestDue(now = new Date(), hour = 8): string {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour - 7);
    const target = today <= now.getTime() ? today + 86_400_000 : today;
    return new Date(target).toISOString().slice(0, 19).replace('T', ' ');
}

export function immediateDue(now = new Date()): string {
    return now.toISOString().slice(0, 19).replace('T', ' ');
}
