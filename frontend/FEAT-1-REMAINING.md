# `feat/1` — Current Frontend Integration Plan

Merged-contract baseline verified: 2026-09-12
Unmerged backend branch review: 2026-09-15 (see below)
Real-mode migration audit: 2026-09-17 (`origin/backend` `6313a07`)

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

## Unmerged backend update — reviewed 2026-09-15

Remote branches were fetched and their routes, schemas, and mappers inspected.
No backend branch was merged into this frontend checkout. Runtime behavior and
deployment have not been verified by this review.

| Branch | Reviewed commit | Meaning for frontend planning |
| --- | --- | --- |
| `origin/backend` | `6313a07` | Shared integration baseline; changes since `35ce621` are tests/coverage, not new runtime endpoints. |
| `origin/backend_step9-10` | `052cb24` | Implements match results/statistics, winner, dashboard, standings, announcements and livestream (S01–S12, E08–E12). |
| `origin/backend_shokun` | `f222b12` | Bracket, matches, scheduling, check-in, uploads; also application pagination and validation/document-contract updates. |
| `origin/BE_KN` | `5b36e0f` | Includes Step 9–10 and the match/check-in branch, plus match-specific referee invitations, coverage and change requests. Candidate for integration review, not evidence of deployment. |
| `origin/feature/tournaments-step-5` | `d90893c` | Tournament lifecycle, eligibility and admin queues, with further publication-readiness and age-validation changes to reconcile with the integration candidate. |

**Read the historical blocker list below as unavailable on the shared baseline,
not as absent from every backend branch.** Tournament, bracket/match/check-in,
results/statistics, announcements/livestream, dashboard/standings, and referee
removal/coverage now have unmerged implementations available for preparation.
Do not check their frontend migration boxes merely because backend routes exist.

### Next work and owners

1. **Head Dev + backend owners:** agree the candidate commit and deployment,
   reconcile the latest Tournament branch with `BE_KN`, and verify database
   migrations. Keep the existing baseline policy until the team changes it.
2. **Slice 3:** reconcile match/result/statistics DTOs and methods before wiring
   screens. Frontend writes stats with `PUT /matches/:id/stats`; the reviewed
   backend uses `POST` with `{ playerStats: [{ userId, values }] }`. Frontend
   livestream sends `{ url }`; the backend expects `youtubeUrl`. Backend result
   reads return verified results only, so pending/disputed UI needs an agreed
   read contract. Standings currently return `team`, `wins`, `losses`, `rank`,
   not the full round-robin totals expected by the frontend specification.
3. **Slice 2:** prepare Tournament and announcements integration. Dashboard now
   has `GET /tournaments/:id/dashboard` returning `teamCount`, `playerCount`,
   `matchCount`, `matchesCompleted`; map these explicitly into the existing view.
4. **Slices 3 + 4:** prepare match-specific referee invitation UI and DTOs.
   Accepting with no `matchIds` accepts pool membership only. Coverage is now
   per match (`matchesTotal`, `matchesCovered`, `uncovered`, `conflicts`), unlike
   the existing frontend `required/accepted/shortfall` DTO. Add the FR01–FR08
   transfer/swap/add-match request workflow; direct F11 assignment was removed.
5. **All slice owners:** add contract-focused tests for these changes, then run
   the real-backend smoke flows against the agreed candidate. Existing frontend
   test success does not verify these unmerged contracts.

`GUIDE/06`, `GUIDE/10`, and `GUIDE/11` are available in `origin/BE_KN`; older
statements that the guides are missing from the repository are stale for that
branch. Do not copy older prototype contracts over the reviewed backend shapes.

## Rules for implementation

- Use backend DTOs and numeric IDs as the source of truth for every route that
  is available.
- Keep a legacy/mock implementation only behind `VITE_USE_MOCK=true`. When
  `VITE_USE_MOCK=false`, a missing backend route must produce an explicit
  unavailable state or hide the unsupported feature; it must never render
  prototype/store data as though it came from the server.
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
| [x] | Team invitations | `GET/POST /teams/:id/invitations` | Team-leader-only management. Accept/decline with `POST /invitations/:id/accept` or `/decline`. |

These request bodies were confirmed against `origin/backend` `team.schema.ts` on
2026-09-12:
- An invitation sends `{ invitedUserId }`.
- A member position change is `PATCH /teams/:id/members/:uid { position }`.
- An official request sends `{ supportingDocs: string[] }`.

### 2. Connect screens

- [x] Migrate `TeamsPage` to `GET /me/teams`.
- [x] Migrate `TeamPage` to `GET /teams/:id` and `GET /teams/:id/members`.
- [x] Migrate the team selector in `RegisterForm` to `GET /me/teams`.
- [x] Show an access message when team-members returns `403`; do not render this
   as a team with zero members.
- [x] Keep any string-ID prototype data isolated from numeric API data.

### 3. Tournament application flow

| Done | Need | Route | Contract |
| --- | --- | --- | --- |
| [x] | Apply | `POST /tournaments/:id/applications` | Send `{ teamId: number }`. Success: `201 { id, status: 'pending', hardFilterPassed: true }`. |
| [x] | My applications | `GET /me/applications` | Item: `id`, `tournament`, `team`, `status`, `rejectionReason`, `appliedAt`. |
| [x] | Organizer applications | `GET /tournaments/:id/applications` | Organizer-only. Item: `id`, `team`, `status`, `hardFilterPassed`, `softFilterDocuments`, `appliedAt`. |
| [x] | Approved teams | `GET /tournaments/:id/teams` | `{ items: [{ id, name, sportTypeId }] }`. |
| [x] | Actions | `POST /applications/:id/cancel`, `/withdraw`, `/approve`, `/reject` | Reject body: `{ reason }`. There is no approve-all endpoint. |

Implementation requirements:

- [x] Use the backend hard-filter result for eligibility feedback. On
   `422 HARD_FILTER_FAILED`, show the failed member details returned by the
   server; the frontend may provide guidance but must not require a duplicated
   client-side eligibility calculation.
- [x] Migrate `RegistrationsPanel` to the organizer-application DTO.
- [x] Remove or disable any approve-all UI. It cannot work until a backend route
   exists.
- [x] Keep organizer and team-leader action permissions explicit in the UI.

## Priority 2 — Referee and admin flows

### Referees

Available routes:

- `POST /tournaments/:id/referees` — invite a referee.
- `GET /tournaments/:id/referees` — organizer-only; returns `{ items, acceptedCount }`.
- `GET /me/referee-invitations` — current user's pending invitations.
- `POST /referee-invitations/:id/accept`.
- `POST /referee-invitations/:id/decline` — returns `204`.

Next actions:

- [x] Complete the invitation inbox, accept, and decline states.
      `MatchesPage` reads only `GET /me/referee-invitations`. It shows loading,
      401/403 access, an error with retry, a pending state on each row, and a
      success notice. Decline handles the `204` response.
- [x] Use `acceptedCount` where a referee count is displayed.
      `RefereePanel` badge and `SetupTrail` referee step. The required count
      stays the format rule (`refsNeeded`: on-site 2, online 1).
- [x] Do not implement a real remove-referee or coverage action: those APIs do
   not exist yet. Hide the action or label it unavailable.
   Team decision (2026-09-13): an organizer can appoint and remove referees at
   any time, including while the tournament is being played. `RefereePanel`
   shows Remove (or Withdraw invitation) in mock mode only. Removal takes the
   referee off every unfinished match and keeps their name on finished ones.
   Outside mock mode the panel labels removal unavailable, and
   `removeReferee` / `getRefereeCoverage` reject with `501 ENDPOINT_UNAVAILABLE`
   without calling a route that doesn't exist.

### Admin official-team requests

Available routes:

- `GET /admin/team-requests`
- `POST /admin/team-requests/:id/approve`
- `POST /admin/team-requests/:id/reject`

- [x] Connect `AdminPage` to these routes and add admin-only, pending, success,
      and error states.
      The Permanent squads tab reads only `GET /admin/team-requests`; the store
      fallback is gone. It shows loading and empty states, and an access message
      for 401/403 `INSUFFICIENT_ADMIN_SCOPE`. A load error has a retry button.
      Rows show a pending state and a success notice after a decision. Approve
      explains `409 ALREADY_DECIDED` and `422 MEMBER_CONFLICT`. Reject needs a
      reason in a modal (backend `400 TEAM_REJECT_REASON_REQUIRED`). The other
      admin tabs still use store data because their routes don't exist yet.

## Priority 3 — Test the available contract

Add API/hook tests for:

- [x] API error contract: `204` invitation decline, `422 HARD_FILTER_FAILED`,
      and `403` team-members access denial.
- [x] `GET /me/teams`, team detail, members, and invitation actions.
      (`src/api/team.test.ts`)
- [x] Apply success plus `422 HARD_FILTER_FAILED`.
      (`src/api/tournament.test.ts`)
- [x] Application actions and organizer permission errors.
      (`src/api/tournament.test.ts`)
- [x] Referee invitation accept/decline, including `204` handling.
      (`src/api/admin.test.ts`)
- [x] Admin team-request permissions and rejection.
      (`src/api/admin.test.ts`)

Then run and tick each successful check:

- [x] `npm.cmd test` — 11 files, 107 tests pass.
- [x] `npm.cmd run lint` — 0 errors. There are 2 existing `react-hooks/incompatible-library` warnings for React Hook Form `watch()`.
- [x] `npm.cmd run build` — passes. Vite still gives its existing chunk-size warning.

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

- [x] Smoke-test login.
- [ ] Smoke-test listing own teams and viewing team members.
- [ ] Smoke-test applying to a tournament.
- [ ] Smoke-test approving/rejecting an application as organizer.
- [ ] Smoke-test accepting/declining a referee invitation.
- [ ] Backend test-data prerequisite: provision a known Admin account before
      testing `GET /admin/team-requests` and approve/reject actions. The current
      backend data has no Admin account; frontend demo credentials must not be
      treated as backend seed data.
- [ ] Backend fix prerequisite: add and run the migration for
      `team_invitations.expires_at`, then verify `GET /me/invitations` and the
      invitation lifecycle. Keep invitation smoke tests pending while the
      backend returns `ER_BAD_FIELD_ERROR` for the missing column.
- [x] Hide demo-role sign-in controls, browser-only data text, Reset demo data,
      and demo credential defaults when `VITE_USE_MOCK=false`.
- [ ] Verify the real-mode Login page in a real browser. Source checks, lint,
      build, tests, and HTTP reachability pass, but browser automation was not
      available in the verification environment on 2026-09-17.

## Priority 4 — Complete the `VITE_USE_MOCK=false` migration

This is the cross-screen completion gate owned by the Head Frontend Dev. The
earlier priorities prove individual API slices; this section prevents an
API-backed page from silently mixing server data with the prototype seed.

### 1. Real-mode data-source boundary

- [ ] **Head Frontend Dev:** inventory every routed page and record each source
      it reads: backend API, UI-only local state, or prototype/mock store.
- [ ] **All slice owners:** when `VITE_USE_MOCK=false`, do not use
      `shared/store.ts`, `shared/seed.ts`, or `src/mocks/*` as entity data for
      tournaments, teams, users, matches, invitations, notifications, results,
      permissions, or counters.
- [ ] **All slice owners:** UI preferences such as theme may remain in
      localStorage, but persisted prototype data under `ltms.v1` must not affect
      real-mode rendering, authorization, badges, links, or work queues.
- [ ] **All slice owners:** unsupported real-mode features must be hidden,
      disabled with a reason, or show a named unavailable state. Do not fall
      back to demo data after `404`, `403`, `501`, network failure, or an empty
      backend response.
- [ ] **Head Frontend Dev:** require numeric backend IDs in real-mode routes and
      links. Keep string IDs such as `t-vlr` and `t-fb` inside mock mode only.

### 2. Screen migration matrix

| Done | Owner | Screen/domain | Real-mode acceptance criteria |
| --- | --- | --- | --- |
| [ ] | Slice 1 | Search — tournaments | Search and Home use the same backend tournament collection after `GET /tournaments` is merged and deployed. Until then Search shows no `s.tournaments`; `VALORANT Campus League 2025` and other seed records must not appear. |
| [x] | Slice 4 | Search — teams | Do not search `s.teams` in real mode. Keep the section unavailable until a public/global team-list or team-search route is agreed and deployed. |
| [x] | Slice 1 | Search — users | Use the available authenticated `GET /users/search?q=...` contract with loading, no-results, `401`/`403`, and retryable-error states. |
| [x] | Slice 1 | Profile — identity | Render the signed-in user's name and registry fields from `GET /me` without requiring a matching legacy-store user. The page must never return a blank screen because `legacyUser` is absent. |
| [x] | Slice 1 | Profile — statistics | Use `GET /users/:id/stats`; show loading, empty, and error states without hiding the `/me` identity section. |
| [x] | Slice 4 | Profile — squads | Use `GET /me/teams` for the signed-in user's squads; do not derive membership from `s.teams`. |
| [x] | Slice 1 | Profile — unsupported panels | Hide or label Career-by-tournament, Pick'em tokens, follows, and MVP totals unavailable until their backend read contracts are deployed. Do not calculate them from the seed. |
| [x] | Slice 1 | Inbox — notifications | Do not call speculative `/me/notifications` or notification read routes against the baseline. Show a deliberate unavailable state or hide the Inbox navigation until a notification contract is agreed and deployed. |
| [ ] | Slice 4 | Inbox — team invitations | Keep team invitations on the API-backed flow using `GET /me/invitations` and invitation accept/decline routes; do not substitute general notifications for this flow. |
| [ ] | Slices 3 + 4 | Inbox — referee invitations | Keep referee invitations on `GET /me/referee-invitations` in `MatchesPage`; document the navigation until a unified Inbox contract exists. |
| [x] | Slice 1 | Shell and badges | Derive identity, permissions, Inbox count, and navigation badges only from backend-backed queries in real mode. No badge may count prototype tournaments, invites, or notifications. |
| [x] | Slice 1 | Home and work queue | Home cards and `Needs you` entries must use backend-backed collections only. If a required route is absent, omit that queue rather than reading `workQueue(s)`. |
| [ ] | Slice 2 | Tournament detail | A numeric tournament route must not combine a backend DTO with store registrations, teams, brackets, announcements, or permissions. Each tab must be API-backed or explicitly unavailable. |
| [ ] | Slice 3 | Match, bracket, check-in and watch | Remove real-mode reads of store matches/results/check-ins. Each reachable view must be API-backed or explicitly unavailable. |
| [ ] | Slice 4 | Team detail and management | Logo, record, transfer, roster-lock and other mock-only sections must remain isolated from API-backed team identity/membership and be unavailable when their routes are missing. |
| [ ] | Slice 4 | Admin | Only Permanent squads may use the current baseline API. External referees, Users, and other unsupported tabs must not show store records in real mode. |

### 3. Backend contract gates for remaining screens

- [ ] **Head Dev + backend owner:** merge/deploy and freeze the public
      tournament list/detail contract before Search, Home, and Tournament detail
      are marked migrated. A route on an unmerged candidate is not sufficient.
- [ ] **Backend owner:** define a notification list/read/read-all contract,
      authorization, DTO, event producers, pagination, and retention before the
      general Inbox is migrated.
- [ ] **Backend owner:** define global team search/list authorization and DTO
      before the Search team section is enabled in real mode.
- [ ] **Backend owner:** define follows and any missing Profile career/Pick'em/
      MVP read contracts before those panels are enabled in real mode.
- [ ] **Head Frontend Dev:** update this file with each confirmed route, request,
      response, errors, permission, reviewed backend commit, and deployment
      evidence before assigning its frontend migration.

### 4. Verification for the real-mode boundary

- [x] Add tests proving Search cannot render `shared/seed.ts` tournaments or
      teams when `VITE_USE_MOCK=false`.
- [x] Add tests proving Profile renders `/me` identity when no legacy-store user
      matches and displays independent stats/error states.
- [ ] Add tests proving Inbox displays empty only for `200 { items: [] }`, not
      for `401`, `403`, `404`, `501`, malformed responses, or network errors.
- [ ] Add tests proving unsupported panels never issue speculative API calls and
      never fall back to store data in real mode.
- [ ] Run `rg` over routed feature components for `useLtms`, `shared/store`,
      `shared/selectors`, `shared/seed`, and `src/mocks`; review and document
      every remaining real-mode-reachable use.
- [ ] Smoke-test a clean browser profile with `VITE_USE_MOCK=false` and stale
      `ltms.v1` data present; no demo user, team, tournament, match, invitation,
      notification, badge, or permission may appear.
- [ ] Smoke-test direct navigation and reload for `/`, `/search`, `/me`,
      `/inbox`, `/teams`, `/matches`, one numeric team, and one numeric
      tournament route.
- [ ] Record Network evidence for every migrated screen and confirm each entity
      shown can be traced to a successful backend response in that session.
- [x] Run `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build` after each
      migration slice; record exact failures and do not let passing unit tests
      override a red typecheck, build, or browser smoke test.

Developer verification (2026-09-17): `npm.cmd test` passed 110 tests in 14
files, `npm.cmd run lint` passed, and `npm.cmd run build` passed. Browser and
Network-panel smoke checks remain pending and are intentionally unchecked.

## Backend blockers — do not schedule as API migration yet

These screens may retain documented mock/store behavior until the backend
delivers an agreed contract:

- [ ] Backend delivery required: tournament list, detail, create, update,
      delete, eligibility rules, and
  announcements.
- [ ] Backend delivery required: match list/detail, draw, result, standings,
      real bracket, and comments.
- [ ] Backend delivery required: tournament feedback list.
- [ ] Backend delivery required: referee removal and coverage. Organizers may
      remove a referee at any time (team decision 2026-09-13). `schema.sql`
      already has `tournament_referees.removed_at` / `removed_by`, and
      `referee.service` skips removed rows when re-inviting, but there is no
      `DELETE /tournaments/:id/referees/:userId` route.
- [ ] Backend delivery required: public/global team list or team search.
      `GET /me/teams` is only for the
  signed-in user's teams and does not support SearchPage's global search.
- [ ] Backend delivery required: notification list, mark-one-read, and
      mark-all-read routes. `src/api/notification.ts` currently contains
      local `501 ENDPOINT_UNAVAILABLE` guards; the general Inbox must not call
      or simulate unconfirmed paths in real mode until the contract is agreed
      and deployed.
- [ ] Backend delivery required: follows plus any Profile career-by-tournament,
      Pick'em total, and MVP-total reads that remain part of the approved UI.
      `GET /me` and `GET /users/:id/stats` do not supply those sections.
- [ ] Backend delivery required: roster lock. `DELETE /teams/:id/members/:uid`,
      `POST /teams/:id/invitations` and invitation accept don't check whether
      a tournament the team is approved for has started. Only the frontend's mock
      mode blocks these (`rosterLockOf`, `409 ROSTER_LOCKED`).
- [ ] Backend delivery required: team leader transfer (SDS
      `POST /teams/{id}/transfer-leader`, FR-TM-08). Outside mock mode the UI
      labels it unavailable.
- [ ] Backend delivery required: tournament dashboard (SDS
      `GET /tournaments/{id}/dashboard`, FR-DL-01). Until then the Dashboard
      tab summarizes the match list and standings that the other tabs already read.
- [ ] Backend delivery required: external-referee approval (SDS
      `PATCH /admin/requests/{id}`, FR-RM-02). `POST /tournaments/:id/referees`
      already accepts `isExternal`, but no route lets an admin approve the
      referee. The Admin page's External referees tab works in mock mode only.
- [ ] Backend delivery required: user account management and admin rights
      (SDS `GET /admin/users`, `PATCH /admin/users/{id}/suspend`, FR-UM-05).
      Login already refuses suspended accounts (`403 ACCOUNT_SUSPENDED`), but
      the Admin page's Users tab works in mock mode only.
- [ ] Backend delivery required: feedback with a rating (SDS
      `POST /tournaments/{id}/feedback`, FR-CM-02). `schema.sql` has
      `tournament_feedback.rating`, but `origin/backend` has no feedback or
      rating route. The Community tab's rating form works in mock mode only.
- [ ] Backend delivery required: match comments and Pick'em (SDS
      `POST /tournaments/{id}/comments` FR-CM-01,
      `POST /matches/{id}/predictions` FR-PK-01, settled inside the result
      transaction). `src/api/engagement.ts` calls `/matches/:id/comments` and
      `/matches/:id/picks`, which match neither the SDS nor a backend route.
      The match page's Community tab shows `SocialBar` in mock mode only,
      because `SocialBar` takes a store `Match`, not a `MatchDto`.
- [ ] Backend fix required: `referee.service` returns an `acceptedCount` that
      includes external referees an admin has not approved yet (FR-RM-02). The
      mock counts `isActive` rows only.

## Open issues found 2026-09-13 — not backend blockers

Found while checking team links, the mobile preview (`mobile.html`) and the
home page. None is fixed yet. Each item names its owner from `PLAN.md`, and
the owner decides the fix.

### Slice 1 / Person 1 — home page, kit and CSS

- [ ] The home filter bar covers the list on phones. Deferred on 2026-09-13.
      `.toolbar` is sticky (`src/styles/prototype.css:500`). At 393×852 the
      sport chips wrap to three rows, so the bar is 276px tall and the first
      card starts at 1176px. While scrolling, the bar covers 336px of the
      screen and only one card is fully visible. A tested fix for phones only,
      inside the `@media (max-width:820px)` block (`prototype.css:563`):
      `.toolbar{position:static;}`,
      `.toolbar .chips{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;}`,
      `.toolbar .chips .btn{flex:none;}`. With it the bar is 170px, the chips
      sit in one row, and nothing overflows sideways.
- [ ] Home "All" looks smaller than a stage filter. The grid shows only the
      selected tab, and the page selects the first non-empty tab
      (`src/features/home/HomePage.tsx:101`). Signed in as Sirawit, All opens
      "Yours to run · 1" with one card, and In progress opens "You're
      competing in · 3" with three, while "Find one" reads 7 of 7 and 4 of 7.
      On phones `.tabs` wraps (`prototype.css:255`), so the tabs read like
      section headings. Options: add an "All" tab or show every group, keep
      the chosen tab when the stage changes, and scroll the tabs sideways on
      phones.
- [ ] Under All, "Other tournaments" leaves out finished tournaments
      (`HomePage.tsx:92`). They appear only under Finished.
- [ ] "Needs you" is fixed at three columns (`HomePage.tsx:123`, inline
      `repeat(3,1fr)`). Seen in the code, not measured on a phone.
- [ ] Team names link to pages that don't exist for fixture teams.
      `ScorebugView` (`src/components/kit/Scorebug.tsx:28`) and `TeamLinkView`
      (`src/components/kit/chips.tsx:63`) always link to `/team/:id`. The
      fixture matches `/m/301` to `/m/304` use team ids 11–14
      (`src/mocks/match.mock.ts`), which aren't in the store, so the link opens
      "No such squad". Request: a way to render the name as plain text, such
      as a `linkTeams` prop that defaults to `true`. Not urgent, because no
      menu leads to these pages.
- [ ] The engagement mocks and the seed disagree. `src/mocks/comment.mock.ts`
      and `src/mocks/pick.mock.ts` read and write localStorage, but the seed
      keeps comments and picks in the store (`s.comments`, `s.picks`). The
      tournament Community tab counts two comments on QF1
      (`src/features/tournament/CommunityTab.tsx:53`), yet the match page shows
      none. Comments posted on the match page aren't counted there, and picks
      made in `SocialBar` don't count as Tokens (`pickScore`,
      `src/shared/career.ts:93`).

### Slice 2 — tournament page

- [ ] A tournament opened by its numeric id shows no squads. `/t/t-fb` reads
      "Squads in 8 of 8", but the same tournament at `/t/402261` reads "0 of 8"
      and "No teams have been approved yet". The page content comes from the
      store while the approved-teams panel reads the fixture
      (`src/features/tournament/TournamentPage.tsx:36`). The panel's "View
      team" button (`TournamentPage.tsx:172`) links fixture team ids that
      aren't in the store. Slice 4's External referees tab now opens
      tournaments by their store id, so no current link leads here.

### Slices 1 and 4 — need an agreement

- [ ] The follow state depends on the link format. `TeamPage.tsx:67` and
      `PlayerPage.tsx:82` (slice 4) build the follow key from the raw URL id,
      so a team followed at `/team/t-tit` shows "Follow this squad" at
      `/team/683878`. Slice 1 owns `follows` and has to agree which id the key
      uses. The change itself is in slice 4's files.

### Repository and process

- [ ] Nothing checks a push to `feat/1`. `.github/workflows/frontend-ci.yml`
      runs only on pushes and pull requests to `frontend` and `main`, and
      `frontend` no longer exists on `origin` (gone by 2026-09-13). Work
      reaches `feat/1` by direct push, so no check runs and no slice owner sees
      changes to their files. Suggested: add `feat/**` to the trigger, and
      merge into `feat/1` through pull requests reviewed by the slice owner
      (a CODEOWNERS file can follow the table in `PLAN.md`).
- [ ] The items in this plan have no owner. `PLAN.md` gives `features/team` to
      slice 4, but Priority 1 here assigns the team screens without naming
      one. Suggested: name the owner on each item.

## Definition of done for the currently available backend scope

- [ ] Team, application, referee, and admin screens above use API hooks and
      numeric DTO IDs.
- [ ] Every route reachable with `VITE_USE_MOCK=false` satisfies the Priority 4
      data-source boundary: backend data, an explicit unavailable state, or
      UI-only local state—never silent prototype/mock entity fallback.
- [ ] Search, Home, Profile, Inbox, Shell badges, and direct numeric detail
      routes have passed the Priority 4 clean-browser and stale-`ltms.v1`
      checks.
- [ ] No new mutations have been added to `shared/store.ts`.
- [x] Team list/detail screens have loading, empty, error, and permission
      states.
- [ ] Every migrated screen has loading, empty, error, permission, and pending
      mutation states.
- [x] API/hook tests cover success, validation, and permission paths.
- [ ] Real-backend smoke test passes with `VITE_USE_MOCK=false`.
- [x] `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build` pass.

## Re-check checklist before beginning any blocked feature

- [ ] Fetch or inspect the current `origin/backend` branch.
- [ ] Confirm route, request body, response DTO, error codes, and authorization.
- [ ] Add the route to this file before starting frontend integration.
- [ ] Only then replace the fallback implementation.
