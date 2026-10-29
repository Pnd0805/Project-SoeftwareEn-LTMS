# FE response: error codes / status conflicts — 7 Oct 2026

Read `FE-Notice/ERROR-CODES-status-conflicts-2026-10-07.md` and verified ls-remote/fetched **BE_KN@77039f6b0abb4767e194cde825dc5555cadf9c8f**. The notice's 234e4a1 snapshot proposed options; current BE already implements option A. FE baseline `9962cea`, branch `feat/1`. Only frontend files changed.
FE implementation commit: `579309f`.

Latest status: [Round 6 response](TO-BACKEND-2026-10-08-qa-round6-response.md). Team conflict metadata is now delivered/integrated; FE-39 reviewer impact still awaits its read contract.

## Implemented

| Contract | FE recovery |
|---|---|
| 400 SCHEDULE_INCOMPLETE on PATCH schedule | Keep the schedule draft; mark only delivered known missing fields (Kick-off/End/Venue) and describe them accessibly. Clear stale server feedback when the draft changes. Do not send users away from the form. |
| 409 MATCH_NOT_SCHEDULED on open-checkin/start | Explain that the organizer must complete the schedule before retrying. Show optional missing fields; organizer can open the fixture editor. A referee receives organizer guidance. No fictitious field highlighting in match control. |
| 409 MATCH_NOT_SCHEDULED on FR02 | Shared recovery in transfer/swap and fixture assignment requests; safe when missing metadata is absent. |
| Legacy 409 SCHEDULE_INCOMPLETE | Same match-state recovery for an older running BE process. It is distinguished from 400 by HTTP status. |

Unknown/duplicate/malformed missing values are filtered; no server-message parsing or assumed missing counts/fields. Schedule inputs are disabled while a save is pending so draft error reset cannot unlock a second concurrent save.

## Other audited codes

- **USER_NOT_FOUND:** target-user 404 remains a missing resource and does not clear the current session. No code-based login redirect exists in FE. Existing HTTP-401 auth handling remains, including BE's defensive token-owner check. No special handling added for unreachable controller guards behind requireAuth.
- **NO_ACTIVE_DISPUTE:** preserve 404 for reading absent dispute and 409 for resolving without an active dispute.
- **REFEREE_NOT_ASSIGNED:** preserve 404 for deleting an absent assignment and 409 for FR02 assignment preconditions.
- No BE decision is needed on the proposed schedule split: option A is delivered and FE integration is ready.

## Remaining handoff

FE-39 reviewer-authorized pre-approval impact and team invitation conflict status/expiry metadata remain open; this BE commit only changes the scheduling error contract. [Round 5 response](TO-BACKEND-2026-10-07-qa-round5-response.md) retains fixture deployment and SMTP/team decisions. Original checklist stays **41 implemented / 2 partial** (FE-10 browser timing, FE-39 admin impact).

## Developer validation

- Full final suite: `npm.cmd test -- --maxWorkers=4` — **97 files / 618 tests passed**. Initial focused check: **5 files / 71 tests passed**, with final navigation/FR02 additions covered by the full suite.
- `npm.cmd run lint` and TypeScript/production build passed. Existing chunk-size warning remains (main 943.27 kB).
- Isolated Vite port 5195 started with strictPort; root HTML, MatchPage, FixturePage, RefereeMatchRequest, ContractErrorDetails and matchScheduleErrors modules returned HTTP 200. Task-owned Vite was stopped afterward.
- Git diff whitespace check passed. Browser/manual QA and new live API acceptance were not performed; no backend edits, migrations or seed reloads. No push performed.
