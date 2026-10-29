# Player follow bell — frontend verification

Date: 29 October 2026. Branch: `ui-polish-s34`, base `8cf826a`.
All implementation and verification changes are inside `frontend/`. No backend files, database data or environment switches were changed for this task. Delivery includes the frontend implementation and backend handoff on `ui-polish-s34`, excluding `TODO/`.

## Delivered behavior

- A shared follow/bell control appears on real and mock public Player profiles for a signed-in viewer other than the profile owner.
- Follow first: the bell is hidden before following. A supported backend's `POST /users/:id/follow` response makes the bell appear off, with a message explaining how to opt in.
- Bell state is explicit and accessible (`aria-pressed` plus On/Off text). PATCH sends only the requested `notifyEnabled` boolean. No success is shown before the response confirms the same player, following relationship and boolean state.
- Follow and bell writes are serialized. Pending writes disable both actions; errors retain the last confirmed preference and permit retry. `NOT_FOLLOWING` removes stale relationship state and refreshes the following list.
- The enabled hint links to the existing `/me` notification settings and states that the Community category must also be on. No notification category is changed automatically.
- Mock preferences persist across reloads, start off for older saved follows, reset on unfollow/re-follow and stay isolated by viewer. Damaged preference storage does not erase an otherwise valid following list.

The optional control in the account's Following list is deferred. Notification Inbox/types and preferences categories are unchanged.

## Backend readiness

Read-only inspection of `backend/src/routes/users.routes.ts`, `services/user.service.ts` and `repositories/follow.repo.ts` shows that this checkout still has POST/DELETE follow but no PATCH follow handler or notification preference field.

The frontend therefore waits for an explicit boolean from `/me/following` or the confirmed POST response before enabling real bell writes. Until then, a followed player's bell says Notifications unavailable and no request is sent to the undelivered PATCH endpoint. Missing data is not displayed as a confirmed Off state.

Backend delivery required:

- `PATCH /users/:id/follow` → `{ userId, isFollowing: true, notifyEnabled }`.
- `notifyEnabled` in public profile and following-list items; newly followed users return false from POST.
- Notification delivery at actual match start and result verification, Community-category gating and recipient deduplication remain backend/live acceptance.

The requested routes, fields, notification linking and delivery evidence are documented in [TO-BACKEND handoff](../TO-BACKEND-2026-10-29-follow-bell.md) so backend work can proceed from the shared branch. Backend-dependent acceptance remains open after publication.

No backend changes are included in this work. Capability becomes available when the documented fields and route are deployed together; no frontend environment toggle is needed.

## Checks

- API and rendered control first pass: 3 files / 14 tests passed.
- Expanded Player/Team/API regression pass: 15 files / 83 tests passed before one additional persistence recovery case.
- Final `npx.cmd vitest run --maxWorkers=4`: **155 files / 1,163 tests passed**.
- TypeScript (`npx.cmd tsc --noEmit -p tsconfig.app.json` and the production project's `tsc -b`): passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed (Vite production build).
- `git diff --check`: passed. Backend working-tree changes are excluded; `TODO/` remains untracked and excluded from commits.

No new browser/device acceptance is claimed. Browser automation was unavailable earlier in this session; the rendered assertions above use React Testing Library in jsdom. No new live backend test or undelivered endpoint probe was attempted for this task.
