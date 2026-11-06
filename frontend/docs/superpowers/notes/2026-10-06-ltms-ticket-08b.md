# Ticket 08B — Search and Inbox

Plan: `docs/superpowers/plans/2026-10-05-ltms-minimal-street.md`, exact Task **8B**.
Base: `14591823a2864fb66ff795c38ae5381568f50d3a`.

## Execution ledger

- Read AGENTS, CLAUDE, spec, Task 8B, handoff and ticket.
- Applied executing-plans, Impeccable polish in Operate mode, and Ponytail. No agents.
- Pre-flight: consumes existing shell/kit/tokens from Tasks 1–7; no behavior shared with 8A.
- Ruling: use this owned note and evidence directory as execution workspace; user restricts writes to owned frontend files. Do not modify the shared plan or create a root-level SDD workspace.
- Ruling: retain the approved design and execute without another design interview; the user explicitly approved scope and requested direct implementation. No PRODUCT/DESIGN changes.
- npm ci completed. Existing audit report: 13 vulnerabilities (2 moderate, 10 high, 1 critical); fsevents install-script notice. Dependencies unchanged.
- Baseline focused command: `VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npx vitest run src/features/search src/features/inbox` → 4 files / 23 tests passed.
- Trace: Search combines permitted public tournaments, team search and signed-in player search; recovery is source-specific. Real Inbox uses server notifications plus separate invitations/appointments/requests/applications. Mock Inbox uses notification hrefs and mark-read only.
- Identified uncovered risks: lost mark-read outcome when unread rows disappear; invitation mutation errors silent; application loading/failure misreported as empty; cached private notification/request rows visible after access denial.

- Regression run before implementation: `InboxPage.workspace.test.tsx` → 11 failures for missing contextual actions/outcomes/source handling. After implementation → 11 passed.
- Search HTTP consumer cases validate partial-source recovery with retained terms, loading versus empty, and Team/Player destinations. An initial asynchronous assertion raced player loading; changed it to await the rendered Player, without changing production behavior.
- Ruling: update the single Search recovery-button assertion in `src/features/tournament/journeySourceStates.test.tsx` from “Retry squads” to “Retry teams”. This file consumes SearchPage directly; no Tournament test behavior or implementation changed. The first full run exposed this stale copy assertion (94 files / 644 tests passed, one failure), then the corrected full run passed.
- Impeccable bounded audit: inspected incumbent screenshots and first batched desktop/mobile results. One correction batch added meaningful message-based action names for title-less mock notifications and readable referee-request type labels. The title-less consumer case first failed (1 failed / 7 passed), then passed in the final focused suite.
- Browser harness corrections: use the actual `ltms-theme` key, intercept query-suffixed Vite client modules, derive mock IDs using the existing deterministic mapping, and avoid a fixture error code with special existing copy. Earlier browser logs document these harness failures; the final confirmation succeeded. No production change was made to work around a harness failure.
- Final confirmation: **78 captures / 90 records**, plus 2 incumbent screenshots. No additional polish cycle.
- Task 8B: complete after the gates and direct review below; completion commit requested by the user.

## Delivered behavior

- Search has stable visible labels, a compact two-column desktop filter bar, readable grouped result rows, named destinations and responsive wrapping. Source-specific loading, failures and Retry preserve the existing query behavior. Only successfully settled applicable sources can establish no matches; loaded results remain visible during a separate source failure.
- Inbox groups notifications into readable rows with explicit Read/Unread labels, exact timestamps, contextual Mark read/Open names, Unread toggle state and existing pagination. Mark-read and mark-all outcomes persist outside the changing list.
- Real-mode Action requests retain the existing team/referee invitation answers, match destinations, consent/result distinctions, withdrawal and read-only entries. Each source has its own loading/error/Retry; failed or pending entry decisions cannot establish an empty action queue.
- Notification/request cached private rows are hidden on authoritative 401/403; retryable source failures retain usable data. Invitation errors are visible and recoverable. External-referee acceptance follows the existing response's `requiresAdminApproval` flag.
- Mock keeps notification hrefs and mark-read actions; it does not gain the real action-request queue or Unread filter. No API, hook, DTO, payload, store, rule, permission, route, dependency, configuration, shared kit/shell or shared stylesheet changed.

## Final verification

All recorded verification commands ran in this worktree's `frontend/`. Test/build logs have ANSI codes and trailing whitespace removed for a clean committed diff; results are unchanged. Final checks completed on 2026-10-07 Asia/Bangkok, continuing the 2026-10-06 handoff.

| Command | Result |
| --- | --- |
| `VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npx vitest run src/features/search src/features/inbox` | exit 0; **6 files / 40 tests** |
| `npx tsc --noEmit -p tsconfig.app.json` | exit 0 |
| `npm run lint` | exit 0 |
| `VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npx vitest run` | exit 0; **95 files / 646 tests** |
| `npm run build` | exit 0 |
| Frozen manifest names and SHA-256 values | **49/49 unchanged**, same file set |
| `git diff --check` | exit 0 |
| Impeccable detector over the 3 pages and owned CSS | `[]`; no findings |

Non-blocking notices: existing jsdom `Window.scrollTo` message in the full suite; production build warns about bundles above 500 kB. `npm ci` reports 13 existing dependency vulnerabilities and an fsevents install-script notice. No dependency or build configuration changes were authorized or made.

## Rendered evidence

Reproduce with the existing local external Playwright installation (no project dependency changes):

```sh
VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npx vite --host 127.0.0.1 --port 5178 --strictPort
NODE_PATH=/tmp/ltms-ticket1-browser/node_modules node docs/superpowers/notes/ticket-08b/check-browser.cjs
```

Runner: [check-browser.cjs](ticket-08b/check-browser.cjs). Machine-readable results: [checks.json](ticket-08b/checks.json). All HTTP reads/writes were intercepted. Mock-mode selection intercepts the served client module in the browser; it does not edit configuration or source. Mock data lives only in each fresh browser context.

Every case ran in **1280×800**, **1440×900** and **390×844**, in **dark and light**. The final records explicitly assert the theme, no page overflow, 20px panel padding, 24px major gaps, named buttons and no dialogs. Rendered cases cover long Search rows, empty Search, failed Search/recovery, loading Search, long real notifications, unread-row removal with retained feedback, team-invitation removal with retained feedback, notification source denial with hidden cached rows, failed invitation answers, failed entry decisions with surviving sources, mock notifications and both mock read outcomes.

| Representative screenshot | Case |
| --- | --- |
| [Search 1280 dark](ticket-08b/search-1280-dark.png) / [1440 light](ticket-08b/search-1440-light.png) / [390 dark](ticket-08b/search-390-dark.png) | Long result groups and responsive controls |
| [Search empty](ticket-08b/search-empty-1440-light.png) / [loading](ticket-08b/search-loading-1280-dark.png) / [failed](ticket-08b/search-failed-390-light.png) | Distinct applicable source states |
| [Inbox 1440 dark](ticket-08b/inbox-1440-dark.png) / [390 light](ticket-08b/inbox-390-light.png) | Long notifications, invitations, requests and entries |
| [Read outcome](ticket-08b/read-outcome-1280-light.png) / [Answer outcome](ticket-08b/answer-outcome-390-dark.png) | Visible outcome after original row disappears |
| [Inbox denied](ticket-08b/inbox-denied-1440-dark.png) / [Entries failed](ticket-08b/entries-failed-390-dark.png) | Denial and independent source failure |
| [Mock Inbox](ticket-08b/mock-inbox-1440-light.png) / [Long mock receipt](ticket-08b/mock-read-outcome-1280-light.png) / [Mock mark all](ticket-08b/mock-outcome-390-dark.png) | Distinct supported mock actions and title-less context |

Keyboard: Search terms → Tournament status → first result; Enter preserves the Tournament destination. Enter on Mark read in the unread filter removes the row and leaves a visible status result. Named buttons retain visible focus and mobile actions use at least 44px height. Pages introduce no dialog; dialog containment/Escape handling is not invoked by Search or Inbox. Shared dialog regressions pass unchanged in the full suite. All 12 real/mock interaction records have no browser page errors.

## Direct Standards / Spec review

Performed by the implementer, **not an independent review**, against the base commit and the approved spec/Task 8B.

- Standards: changed production files are the three owned pages and one scoped feature stylesheet. It imports only from those pages; all selectors have Search/Inbox roots. Existing source hooks, callbacks, mutation arguments, permission checks and destinations were traced. No shared or frozen implementation files changed. Comments remain consistent with the repository.
- Spec: palette tokens, angular 2px surfaces, Barlow principal headings, Geist body/controls, concise English, 20px panel padding, 24px group gaps, both themes and mobile wrapping confirmed. Loaded/empty/loading/failed/denied states and persistent named action feedback were checked. Notification type routing, invalid-entity suppression, request applied/open/closed distinctions and mock/real separation remain covered.
- No Critical/Important findings remain in the owned slice. No CSS-value unit tests were introduced. No changes to Ticket 08A, Login/Register/Profile, the shared plan/spec/index, or Ticket 09.

## Changed files

- `src/features/search/SearchPage.tsx`
- `src/features/search/search-inbox-workspace.css`
- `src/features/search/SearchPage.workspace.test.tsx`
- `src/features/inbox/InboxPage.tsx`
- `src/features/inbox/BackendInbox.tsx`
- `src/features/inbox/InboxPage.test.tsx`
- `src/features/inbox/InboxPage.real.test.tsx`
- `src/features/inbox/BackendInbox.test.tsx`
- `src/features/inbox/InboxPage.workspace.test.tsx`
- `src/features/tournament/journeySourceStates.test.tsx` — one Search consumer assertion only
- `.scratch/ltms-minimal-street/issues/08b-search-and-inbox.md`
- This completion note and owned `notes/ticket-08b/` evidence

## Remaining gaps

Live-backend acceptance was not performed; this ticket deliberately uses synthetic intercepted fixtures only. Rendered verification covers Chromium, not separate browser engines or an actual screen-reader session. Integration with 08A and Ticket 09 waits for the user's later decision. The assigned worktree and port-5178 preview remain available. No merge, rebase, cherry-pick, push, deployment or worktree deletion occurred.

Commit message: `feat(frontend): complete search and inbox workspace (ticket 08B)`.
