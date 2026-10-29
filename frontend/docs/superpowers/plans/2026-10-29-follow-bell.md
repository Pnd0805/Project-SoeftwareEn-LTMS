# Player follow notification bell — 29 October 2026

User-authorized scope: `TASK-FE-2026-10-29-follow-bell.md`, required items 1, 2 and 4. Only frontend files are changed. The optional bell in the account Following list is deferred.

## Contract review

Reviewed existing engagement API, follow hook, mock persistence, public Player pages and the checked-out backend user routes/service/repository at frontend base `8cf826a`.
Existing POST/DELETE follow and GET following are supported. The current backend source has no PATCH follow route or `notifyEnabled` fields yet. The handoff explicitly permits frontend/mock work before backend delivery.

The reviewed implementation choice is to show the bell only after following. Until a real server returns an explicit boolean preference, show a disabled unavailable state and send no PATCH probe. When the new fields arrive, the same frontend uses the documented PATCH contract. A saved preference is never inferred from a missing field.

## Implementation

- [x] Extend following/public-profile DTOs without making fields mandatory on the old backend.
- [x] Preserve the following list and notification preferences in mock mode; existing follows migrate to off, and unfollow/re-follow resets the bell to off.
- [x] Add guarded `PATCH /users/:id/follow` with exactly `{ notifyEnabled: boolean }`, validate the response and keep a missing relationship distinct from an undelivered endpoint.
- [x] Update the follow hook from confirmed responses. The new POST field sets the bell immediately without another GET. Invalidate public profile information; do not optimistically announce a saved bell.
- [x] Share controls between real and mock public Player profiles. Hide controls for Guests/self and hide the bell until following. Explain the opt-in default and the Community settings gate. Retain state on failure, permit retry and prevent concurrent writes.
- [x] Add API, persistence and rendered React regressions for supported/legacy servers, both toggle directions, pending/error recovery, missing follows and Guest/self boundaries.
- [x] Collect full developer checks: 155 files / 1,163 tests passed, TypeScript, lint, production build and whitespace checks passed. Delivery includes the frontend implementation and backend handoff; backend files and `TODO/` are excluded.
- [ ] Backend delivery/live notification fan-out and rendered browser/device acceptance.

## Verification

Focused first pass: 3 files / 14 tests. Expanded Player/Team/API regression pass: 15 files / 83 tests before the final persistence-corruption case was added. Final results are recorded in [QA report](../../QA-FOLLOW-BELL-2026-10-29.md).
