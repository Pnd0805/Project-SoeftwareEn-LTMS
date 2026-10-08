# LTMS SMTP Email Notification — Implementation (2026-10-08)

## Agreed behavior
- Reuses the existing Nodemailer transport (provider-agnostic).
- Same recipients as in-app notifications; only verified user email addresses can be queued/sent.
- New **independent** email category preferences, including opt-out for `critical`. In-app `critical` stays mandatory.
- Critical: one email per event, queued for immediate background delivery.
- Other categories: one grouped digest per user, next 08:00 Asia/Bangkok (01:00 UTC), with up to 50 notifications per batch.
- Default preferences: enabled in all categories. Setting `EMAIL_NOTIFICATIONS_ENABLED` is **false by default** so existing deployments do not unexpectedly start sending mail.
- Persistent MySQL outbox: notification_id UNIQUE; claims with expiring 5-minute lease; retry at 1/5 minutes; maximum 3 SMTP send attempts. Failed rows are retained for inspection, not silently dropped.
- HTML escaping + plain-text alternative. Emails include a link to `/inbox`.

## Files and API
- `database/migrations/051_email_notification_outbox.sql`: `users.email_notification_prefs` JSON + `email_notification_outbox` table.
- `backend/src/config/emailNotification.ts`: category defaults and due time.
- `backend/src/repositories/emailNotification.repo.ts`: prefs and durable outbox.
- `backend/src/services/emailNotification.service.ts`: prefs service and enqueue.
- `backend/src/services/emailNotification.worker.ts`: background sender, started in `src/server.ts` only.
- `GET /api/v1/me/email-notification-prefs`: returns category list + delivery policy.
- `PATCH /api/v1/me/email-notification-prefs`: partial JSON boolean categories, e.g. `{"critical":false,"community":false}`.
- Frontend Profile → Notification preferences → Email notifications.

## Setup before enabling
1. Apply the normal pending migrations (including **051**) on the **intended dev/test DB** before starting the server. Do not apply to a live database without a backup/rollout.
2. Run a local Mailpit SMTP server on `localhost:1025` and open its UI to inspect captured emails (or configure a real provider with `SMTP_HOST/PORT/USER/PASS/MAIL_FROM`).
3. Set `EMAIL_NOTIFICATIONS_ENABLED=true` **only after** the above two steps.
4. Set `FRONTEND_URL` to the correct externally reachable frontend origin so links open `/inbox`.
5. Register a test account and confirm `users.email_verified=1` through the normal OTP verification flow; otherwise notification email is intentionally skipped.
6. Trigger a `critical` notification and confirm a message in Mailpit. Trigger a non-critical event to verify it is queued for 08:00 ICT. For test speed, inspect `due_at` in `email_notification_outbox`; do not modify production due times.

## Operational notes
- The worker polls every 30 seconds, so 'immediate' means queued now and ordinarily delivered within ~30 seconds, not synchronously.
- API requests never wait on SMTP delivery, although they do enqueue a database record after the in-app row is created. A queue write error is logged, not propagated to the user.
- Notification and outbox inserts are currently two separate operations; a crash between them can result in a missed email while the in-app notification remains.
- SMTP cannot guarantee exactly once if a process dies after a provider accepts mail but before marking the row sent; the lease recovery can lead to an occasional duplicate despite UNIQUE queue IDs.
- No migration or actual email delivery has been run on production. Existing password reset and OTP emails remain unaffected.
- This worker must run in a long-lived Node server process. A serverless deployment needs a separate persistent worker/cron.
- This feature is intentionally not part of Playwright E2E tests yet. Unit tests cover preferences, queuing policy, rendering, retries and frontend controls.
