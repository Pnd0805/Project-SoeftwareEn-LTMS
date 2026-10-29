# ui-polish-s34 — frontend verification, 29 October 2026

Initial verification base: `a031a1e`; post-pull commit base: `10eedf2`. All source and evidence changes in this frontend work are under `frontend/`.
The user pulled the collaborator's commits and then authorized a local commit. Push was not requested.
The untracked `frontend/TODO/` directory is excluded from the commit. No backend files were edited by this frontend work.

## Delivered frontend changes

- Cancelled tournaments retain their own status, badge, reason and cancellation time instead of falling back to Public. Guest history, announcements and community remain available.
- Organizer Progress offers permanent cancellation for public/private tournaments, requiring a nonblank reason (maximum 255 characters) and an exact tournament-name confirmation. Duplicate submissions are blocked, errors retain the draft, and successful cancellation refreshes affected data.
- Closed/cancelled entries have no approval/rejection actions. Cancelled tournament management, entry, withdrawal, match/result/fixture/check-in, predictions and MVP writes are suppressed. Fixture/check-in details remain readable within existing permissions.
- Search includes the backend's cancelled filter; cancellation notifications use the warning icon and Critical alerts category; reviews describe the seven-day cancellation window without displaying a future opening date.
- Login handles `403 EMAIL_NOT_VERIFIED` by opening the existing OTP route with the email returned by the server. Incorrect credentials remain on Login. OTP includes the ten-minute resend/registration recovery hint.

## Real backend evidence

Frontend `.env.local` uses `VITE_USE_MOCK=false` and `VITE_API_BASE_URL=/api/v1`.
Vite runs at `http://127.0.0.1:5173` and proxies to the integrated checkout's backend at `http://localhost:8000`.
During the original live verification at `a031a1e`, MySQL, MinIO and Mailpit were running. Migration check returned `up to date (54 migrations)`.
The mandatory C1–C8 role audit returned zero conflicts before live testing.

85 requests through the Vite proxy returned HTTP 200: guest reference/list reads and login/personal/tournament reads for Organizer (`org1@ku.th`), University Admin (`admin@ku.th`), Referee (`ref1@ku.th`) and Team Leader (`b1.lead@ku.th`). Includes notifications at `/me/notifications`, referee requests, teams, matches, eligibility rules and announcements. These are API checks; they do not prove rendered browser acceptance.

A new empty QA tournament **12** was created and approved through existing APIs, then cancelled. No existing demo tournament was cancelled or reset. The test tournament is retained as cancelled history at `/t/12`:

| Check | Result |
| --- | --- |
| Create / approve empty tournament | 201 / 200 |
| Empty reason | 400 VALIDATION_FAILED |
| Unrelated spectator attempts cancellation | 403 NOT_ORGANIZER |
| Organizer cancellation | 200, status cancelled |
| Guest detail after cancellation | 200, reason/time/actor preserved |
| Repeated cancellation / editing afterwards | 409 TOURNAMENT_CANCELLED |
| Cancelled search / default list | Included / excluded |

The 15 cancellation-flow requests, including expected rejection responses, and the 85 successful smoke requests are recorded in [sanitized evidence](QA-UI-POLISH-S34-2026-10-29-evidence.json). Tokens and passwords are excluded.

## Developer checks

- Focused cancellation/search checks: 4 files, 57 tests passed.
- Focused match/detail/registration/auth checks: 5 files, 119 tests passed.
- Focused check-in/fixture/draw checks after preserving read-only history: 3 files, 39 tests passed.
- Final `npx.cmd vitest run --maxWorkers=4`: **153 files / 1,150 tests passed**.
- `npx.cmd tsc --noEmit -p tsconfig.app.json`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed (TypeScript project build and Vite production build).
- `git diff --check`: passed. Git still reports no changes under `backend/` and no staged files.

The first broad run exposed a timing-sensitive Search assertion under high concurrency; it passed in isolation and with limited workers. Later regression failures from the newly added cancellation hook missing in an existing test mock and incomplete check-in fixtures were corrected before the final run.

## Remaining acceptance

- Browser rendering and complete click-through acceptance remain unverified. The browser host was unavailable; native Computer Use then stopped because it could not establish Chrome's current URL with enough confidence to enforce policy. No further UI input was attempted.
- Multi-team cancellation notification fan-out and post-cancellation team membership changes were not exercised against existing demo teams. These remain backend acceptance items, with no backend file changes made here.
- The email gate is now present after the user's pull to `10eedf2`. The `EMAIL_NOT_VERIFIED` error and returned email match the frontend handler. Its frontend routing is covered by regression tests; live verification with the switch enabled remains open. No backend switch was changed.
- Real external SMTP, camera/device and mobile acceptance remain open.

## Post-pull commit verification

The user pulled `ui-polish-s34` to `10eedf2`, tracking `origin/ui-polish-s34`. `git diff a031a1e..10eedf2 -- frontend` is empty: the incoming backend, migration, seed and handoff updates introduced no frontend overlap.
The new backend email-gate contract was inspected read-only. Focused Login, OTP and cancellation-confirmation regressions passed again: **3 files / 20 tests**. Frontend TypeScript passed again. The earlier full frontend suite, lint and production build apply to the unchanged frontend source.
Live API evidence above remains the original 54-migration snapshot; it is not a claim that migrations 055–056 or the newly pulled backend features were tested live. Git confirms no backend working-tree changes and no staged TODO files. This task performs a local frontend commit only.
