# `feat/1` — Current Frontend Integration Plan

Last verified: 2026-09-12

Frontend branch: `feat/1`

Backend reference: local `origin/backend` at `35ce62159b293292e0164570cee3ad97ef39da61` (2026-09-11)
API base path: `/api/v1`

This is the current working plan for the frontend team. It replaces the older
`a46fa0a` backend snapshot and must be updated again whenever the backend
contract changes.

> **Branch policy:** frontend integration follows `origin/backend` only.
> Endpoints present only in `origin/BE_KN` or `origin/backend_shokun` are
> treated as unavailable until they are merged into `origin/backend` and the
> deployed backend is confirmed to include them.

## Rules for implementation

- Use backend DTOs and numeric IDs as the source of truth for every route that
  is available.
- Keep a legacy/mock fallback only where the backend route is missing. Mark the
  fallback in code with a short comment explaining the missing endpoint.
- Do not add new mutations to `src/shared/store.ts`.
- Every API-backed screen needs loading, empty, error, and mutation-pending
  states. Treat `401` and `403` as access errors, not empty data.
- Backend collection responses in this plan use `{ items: [...] }`.

## Priority 1 — Teams and registration (start here)

### 1. Team API types and hooks

Implement or reconcile types/hooks for these available routes. Tick a row when
its type, hook, and consuming screen are complete:

| Done | Need | Route | Contract |
| --- | --- | --- | --- |
| [x] | My teams | `GET /me/teams` | `{ items: MyTeam[] }`. `MyTeam` has `id`, `name`, `sportTypeId`, `readinessStatus`, `officialStatus`, `memberCount`, `role`. |
| [x] | Team detail | `GET /teams/:id` | Numeric `id`; includes `leader`, `memberCount`, `createdAt`, `readinessStatus`, `officialStatus`. |
| [x] | Team members | `GET /teams/:id/members` | Authenticated team members only. `{ items: TeamMember[] }`; a member has `userId`, `fullName`, `avatarUrl`, `position`, `joinedAt`. |
| [ ] | Team invitations | `GET/POST /teams/:id/invitations` | Team-leader-only management. Accept/decline with `POST /invitations/:id/accept` or `/decline`. |

### 2. Connect screens

- [x] Migrate `TeamsPage` to `GET /me/teams`.
- [x] Migrate `TeamPage` to `GET /teams/:id` and `GET /teams/:id/members`.
- [x] Migrate the team selector in `RegisterForm` to `GET /me/teams`.
- [ ] Show an access message when team-members returns `403`; do not render this
   as a team with zero members.
- [ ] Keep any string-ID prototype data isolated from numeric API data.

### 3. Tournament application flow

| Done | Need | Route | Contract |
| --- | --- | --- | --- |
| [ ] | Apply | `POST /tournaments/:id/applications` | Send `{ teamId: number }`. Success: `201 { id, status: 'pending', hardFilterPassed: true }`. |
| [ ] | My applications | `GET /me/applications` | Item: `id`, `tournament`, `team`, `status`, `rejectionReason`, `appliedAt`. |
| [ ] | Organizer applications | `GET /tournaments/:id/applications` | Organizer-only. Item: `id`, `team`, `status`, `hardFilterPassed`, `softFilterDocuments`, `appliedAt`. |
| [ ] | Approved teams | `GET /tournaments/:id/teams` | `{ items: [{ id, name, sportTypeId }] }`. |
| [ ] | Actions | `POST /applications/:id/cancel`, `/withdraw`, `/approve`, `/reject` | Reject body: `{ reason }`. There is no approve-all endpoint. |

Implementation requirements:

- [x] Use the backend hard-filter result for eligibility feedback. On
   `422 HARD_FILTER_FAILED`, show the failed member details returned by the
   server; the frontend may provide guidance but must not require a duplicated
   client-side eligibility calculation.
- [x] Migrate `RegistrationsPanel` to the organizer-application DTO.
- [ ] Remove or disable any approve-all UI. It cannot work until a backend route
   exists.
- [ ] Keep organizer and team-leader action permissions explicit in the UI.

## Priority 2 — Referee and admin flows

### Referees

Available routes:

- `POST /tournaments/:id/referees` — invite a referee.
- `GET /tournaments/:id/referees` — organizer-only; returns `{ items, acceptedCount }`.
- `GET /me/referee-invitations` — current user's pending invitations.
- `POST /referee-invitations/:id/accept`.
- `POST /referee-invitations/:id/decline` — returns `204`.

Next actions:

- [ ] Complete the invitation inbox, accept, and decline states.
- [ ] Use `acceptedCount` where a referee count is displayed.
- [ ] Do not implement a real remove-referee or coverage action: those APIs do
   not exist yet. Hide the action or label it unavailable.

### Admin official-team requests

Available routes:

- `GET /admin/team-requests`
- `POST /admin/team-requests/:id/approve`
- `POST /admin/team-requests/:id/reject`

- [ ] Connect `AdminPage` to these routes and add admin-only, pending, success,
      and error states.

## Priority 3 — Test the available contract

Add API/hook tests for:

- [ ] `GET /me/teams`, team detail, members, and invitation actions.
- [ ] Apply success plus `422 HARD_FILTER_FAILED`.
- [ ] Application actions and organizer permission errors.
- [ ] Referee invitation accept/decline, including `204` handling.
- [ ] Admin team-request permissions and rejection.

Then run and tick each successful check:

- [ ] `npm.cmd test`
- [ ] `npm.cmd run lint`
- [ ] `npm.cmd run build`

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

- [ ] After the team confirms base URL, authentication-token behavior, and
      error shape, perform a smoke test against the real backend:

```powershell
$env:VITE_USE_MOCK = 'false'
npm.cmd run dev
```

- [ ] Smoke-test login.
- [ ] Smoke-test listing own teams and viewing team members.
- [ ] Smoke-test applying to a tournament.
- [ ] Smoke-test approving/rejecting an application as organizer.
- [ ] Smoke-test accepting/declining a referee invitation.

## Backend blockers — do not schedule as API migration yet

These screens may retain documented mock/store behavior until the backend
delivers an agreed contract:

- [ ] Backend delivery required: tournament list, detail, create, update,
      delete, eligibility rules, and
  announcements.
- [ ] Backend delivery required: match list/detail, draw, result, standings,
      real bracket, and comments.
- [ ] Backend delivery required: tournament feedback list.
- [ ] Backend delivery required: referee removal and coverage.
- [ ] Backend delivery required: public/global team list or team search.
      `GET /me/teams` is only for the
  signed-in user's teams and does not support SearchPage's global search.

## Definition of done for the currently available backend scope

- [ ] Team, application, referee, and admin screens above use API hooks and
      numeric DTO IDs.
- [ ] No new mutations have been added to `shared/store.ts`.
- [x] Team list/detail screens have loading, empty, error, and permission
      states.
- [ ] Every migrated screen has loading, empty, error, permission, and pending
      mutation states.
- [ ] API/hook tests cover success, validation, and permission paths.
- [ ] Real-backend smoke test passes with `VITE_USE_MOCK=false`.
- [ ] `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build` pass.

## Re-check checklist before beginning any blocked feature

- [ ] Fetch or inspect the current `origin/backend` branch.
- [ ] Confirm route, request body, response DTO, error codes, and authorization.
- [ ] Add the route to this file before starting frontend integration.
- [ ] Only then replace the fallback implementation.
