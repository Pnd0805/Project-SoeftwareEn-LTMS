# NEW_UXUI_frontend × BE_KN — Tickets 1–3

Date: 2026-10-08. Worktree: `ltms-desktop-ux`, branch `NEW_UXUI_frontend`.
Frontend base: `3eb42d7a3990b9df8820a85d564939c0de6a25f7`.
Backend contract reference: `origin/BE_KN@240e9e62ca5aa5c429e9e7159414692c2052ae45`.

## Scope and completion

| Ticket | Status | Implementation | Evidence |
| --- | --- | --- | --- |
| 1. Tournament withdrawal Inbox | Complete | Supports `ref_withdraw`, nullable `matchA`, scope/reason, all request statuses, safe tournament navigation, and guarded match consumers. Cancellation remains available only on open requests. | `BackendInbox.withdrawal.test.tsx`, existing Inbox/Fixture/planner tests |
| 2. Admin external referee decisions | Complete | Removes the frontend-generated 404 after a successful decision. Mutation resolves, existing hooks refresh the queue and the UI retains its success receipt. Actual backend errors still reject unchanged. | `api/admin.test.ts`, `AdminReferees.decision.test.tsx` using real hooks/adapters and intercepted HTTP |
| 3. Registration and OTP | Complete for delivered frontend contracts | Calendar date validation, Bangkok future-date boundary, integer year 1–8, existing NEW UX form followed by OTP verification/resend. Leading zeros retained; success requires server `emailVerified: true`. | Auth schema, OTP integration, request-history and demo tests; six browser viewport/theme cases |

All changes are inside `frontend/`. Existing API paths and mutation payloads are preserved.
The added OTP adapters consume already delivered endpoints; no backend source is modified.
At the Ticket 1–3 verification checkpoint, no merge, commit or push had been
performed. Subsequent source integration is recorded separately in
`../2026-10-08-ticket-4/README.md`.

## Registration behavior

- Academic selections remain deliberate; no placeholder faculty, department or year is submitted.
- Signup navigates to `/register?step=otp&email=...`. Password data stays out of that URL and OTP storage.
- Delivery failure from `emailVerificationSent: false` is shown honestly.
- Both signup and acknowledged resend count toward the local rolling three-request/hour feedback.
  Backend issues its initial OTP before trying SMTP, so a delivery failure still counts.
- Resend waits 60 seconds; timestamps persist across reloads per normalized email.
  Server remains the authority across browsers/devices and when storage is unavailable.
- A resend 200 acknowledges a request; it does not prove delivery. The UI uses generic copy.
- Wrong/expired OTP, network errors and actual server failures retain the code for retry.
  Pending actions prevent duplicate submissions. Email changes clear stale code/errors.
- Verification success moves keyboard focus to its heading and offers Sign in; it does not invent a token.
- Mock mode explicitly says no email is sent and accepts only the documented demo code `123456`.

## Verification

Commands run from `frontend/`:

```sh
npx tsc --noEmit -p tsconfig.app.json
npm run lint
VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npx vitest run
VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npm run build
git diff --check
```

TypeScript, lint, API-mode build and diff checks pass.
Full suite: **111 files / 798 tests pass**. The jsdom suite prints its existing
`Window.scrollTo` not-implemented notices; no failed tests result.
Regression tests were observed failing before fixes: Ticket 1 null-match crash,
Ticket 2 false decision failure, and Ticket 3 invalid dates/year and missing OTP routing.

### Browser evidence

`check-browser.cjs` uses an existing local Playwright installation, headless Chromium,
and intercepted HTTP fixtures. It opens no visible browser window and reaches no real backend.
`browser-checks.json` records six cases: 1280×800, 1440×900, 390×844, each in dark/light.

Each case covers signup, SMTP-failure feedback, invalid OTP, resend acknowledgment/cooldown,
leading-zero verification, success focus and Tab to Sign in. Long mobile registration uses
keyboard submission; this is desktop-browser viewport evidence, not physical iPhone acceptance.
Screenshots show registration, OTP and verified states. No horizontal overflow or page errors.
The browser clock advances the 60-second cooldown; the script does not wait a real minute.

Impeccable's mechanical detector returned no findings for the changed UI targets.
Visual inspection confirmed existing account tokens, square corners, readable labels and
short English wording. No new visual identity or decorative form styling is introduced.

## Remaining integration gates

- Actual merge/conflict resolution and full-stack setup belong to Ticket 4.
- Run backend migrations and the required role audit before live backend checks.
- Validate SMTP delivery, expiry and real persistence with team-provided infrastructure.
- Backend `POST /auth/register` still requires academic fields for external addresses.
  Personal-details-only external signup needs backend delivery, not invented defaults.
- Backend `auth.service.login` does not require `email_verified` at the source reference.
  This frontend flow does not enforce a server authentication policy.

These boundaries are also recorded in `FEAT-1-REMAINING.md`.
