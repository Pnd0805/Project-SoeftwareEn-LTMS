import transport from '../config/mail.js';
import { env } from '../config/env.js';
import { resolveEmailPrefs } from '../config/emailNotification.js';
import * as EmailRepo from '../repositories/emailNotification.repo.js';
import type { MailItem } from '../repositories/emailNotification.repo.js';

const escapeHtml = (raw: string) => raw.replace(/[&<>"']/g, value =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[value]!);
const ids = (items: MailItem[]) => items.map(x => x.email_notification_id);
const inboxUrl = () => `${env.FRONTEND_URL.replace(/\/$/, '')}/inbox`;

function render(items: MailItem[], digest: boolean): { subject: string; text: string; html: string } {
    const heading = digest ? `สรุปการแจ้งเตือน LTMS (${items.length} รายการ)` : `LTMS: ${items[0]!.title}`;
    const text = [
        `สวัสดีคุณ ${items[0]!.full_name}`,
        '',
        ...items.flatMap(item => [item.title, item.message, '']),
        `ดูการแจ้งเตือน: ${inboxUrl()}`,
        'ปรับการรับอีเมลได้ในหน้าตั้งค่าโปรไฟล์',
    ].join('\n');
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6">
      <h2>${escapeHtml(heading)}</h2>
      <p>สวัสดีคุณ ${escapeHtml(items[0]!.full_name)}</p>
      ${items.map(item => `<section><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.message).replace(/\n/g,'<br>')}</p></section>`).join('')}
      <p><a href="${escapeHtml(inboxUrl())}">เปิดกล่องการแจ้งเตือนใน LTMS</a></p>
      <small>ปรับการรับอีเมลได้ในหน้าตั้งค่าโปรไฟล์</small></div>`;
    return { subject: heading, text, html };
}

/** Safe to call repeatedly. Claiming rows provides cross-process mutual exclusion.
 * SMTP itself has no exactly-once guarantee if a process dies after acceptance,
 * so an expired lease can lead to a rare duplicate email.
 */
export async function processEmailOutbox(): Promise<void> {
    for (const group of await EmailRepo.readyGroups()) {
        const items = await EmailRepo.claim(group.user_id, group.delivery_mode);
        if (!items.length) continue;
        const allowed = items.filter(x => x.email_verified === 1 && resolveEmailPrefs(x.email_notification_prefs)[x.category]);
        const rejected = items.filter(x => !allowed.includes(x));
        if (rejected.length) await EmailRepo.finish(ids(rejected), 'skipped');
        if (!allowed.length) continue;
        const batches = group.delivery_mode === 'digest' ? [allowed] : allowed.map(item => [item]);
        for (const batch of batches) {
            try {
                const message = render(batch, group.delivery_mode === 'digest');
                await transport.sendMail({
                    from: env.MAIL_FROM,
                    to: batch[0]!.email,
                    ...message,
                });
                await EmailRepo.finish(ids(batch), 'sent');
            } catch (err) {
                console.error('[email-outbox] SMTP delivery failed', err);
                await EmailRepo.retry(batch, err);
            }
        }
    }
}

let running = false;
export function startEmailNotificationWorker(): void {
    if (!env.EMAIL_NOTIFICATIONS_ENABLED) return;
    const poll = async () => {
        if (running) return;
        running = true;
        try { await processEmailOutbox(); }
        catch (err) { console.error('[email-outbox] worker failed', err); }
        finally { running = false; }
    };
    void poll();
    setInterval(() => void poll(), 30_000).unref();
}
