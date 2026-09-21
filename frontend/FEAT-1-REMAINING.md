# `feat/1` — Current Frontend Integration Plan

Frontend branch: `feat/1`
API base path: `/api/v1`

**Current backend contract reference: FE notices `a14d44c` and `a88f7ad`,
received on 2026-09-21.** Individual entries in the "Backend blockers" section retain
the exact commit and date against which they were verified; older hashes there
are historical evidence, not the current backend reference.

## FE delivery for BE_KN `a14d44c` + `a88f7ad` — 2026-09-21

- [x] Result and dispute-amend forms require a winning aggregate score; Draw / Decider input is removed.
- [x] S12 maps `played`, `points`, `goalsFor`, `goalsAgainst`, `goalDiff` and duplicate `rank` directly, without FE sorting or `wins * 3`.
- [x] C14b close action is available in Manage and renders `MATCHES_UNFINISHED.matches`, `NO_MATCHES` and already-completed feedback.
- [x] Tournament completion is based on C07 `status === 'completed'`; the match/standings workaround is removed and S10 supplies the winner.
- [x] Completed tournaments hide Manage and registration/write controls while announcements remain available; stale 409 `TOURNAMENT_COMPLETED` responses stay visible as API errors.
- [x] Search forwards `GET /tournaments?status=completed` through the Completed filter.
- [x] C09b amendment history shows every status plus `rejectionReason`, `reviewedBy` and review time.
- [x] DTOs include standings totals, C07 `championTeamId` / `completedAt`, C09b history and C14b response.
- [x] M01 supports `replace?: true` and the response field `replaced: boolean`.
- [x] Manage Draw confirms bracket replacement, renders `BRACKET_IN_USE.matches`, and warns that match-specific referees must be assigned again.
- [x] Team roster locking follows approved applications and is not released merely because a tournament is completed/rejected/auto-deleted.
- [x] Contract regression tests, full Vitest suite, production build and `git diff --check` are part of this handoff.

Earlier revisions of this file tracked `origin/backend` `35ce621` (2026-09-11)
and treated anything that existed only on `BE_KN` as unavailable. That policy is
no longer what the frontend does: `feat/1` is wired against `BE_KN` directly,
including the routes added in `6ebda2e`. Read the older sections below
("Unmerged backend update", Priorities 1–4) as the record of how we got here;
the section that matters for backend work is **Backend blockers**.

### For the backend team — how to read this

- `- [ ] Backend delivery required:` — the route or field does not exist and a
  screen needs it. Each entry names the route, what the screen does meanwhile,
  and where in your source the gap is.
- `- [ ] Backend fix required:` — it exists but behaves in a way the frontend
  cannot work around.
- `- [x] ~~struck through~~` — delivered; kept so nobody re-reports it.
- Nothing here is a complaint about code quality. Where the frontend guesses a
  value because the API does not supply one, the entry says so, because that
  guess is a bug waiting to happen and we would rather delete it.

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

## Squad roster contract follow-up (`BE_KN` migrations 018–019)

- [x] Treat `origin/BE_KN` as the primary backend contract and inspect its current
  routes, schemas, services and mappers before changing Frontend DTOs.
- [x] Registration loads `GET /teams/:id/members`, lets the leader select players,
  sends `playerIds`, shows the sport min/max and blocks an invalid squad size.
- [x] Registration renders structured feedback for `SQUAD_SIZE_INVALID`,
  `PLAYER_NOT_IN_TEAM` and `PLAYER_ALREADY_REGISTERED`.
- [x] Organizer application detail loads `GET /applications/:id` and displays its
  `players` with loading, empty and error states.
- [x] Match and check-in screens use public `GET /matches/:id/lineups`, not the
  whole team membership, for the submitted players and their check-in statuses.
- [x] Participant check-in is offered only to a user in the approved lineup and
  `NOT_IN_APPROVED_ROSTER` has actionable copy.
- [x] Real-mode team roster no longer exposes starter/substitute controls or calls
  the removed `PATCH /teams/:id/members/:uid` route.
- [x] Team detail consumes `maxMembers` and presents the pool as `X / max`.
- [x] Member/team deletion renders `MEMBER_LOCKED_IN_TOURNAMENT` and
  `TEAM_LOCKED_IN_TOURNAMENT`, including affected tournaments and a withdrawal path.
- [x] Add focused contract/UI regressions, then run full tests, lint, production
  build and `git diff --check`.
- [x] Frontend Tester verified the real-browser registration flow against
  `BE_KN`: the conflict team is rejected with `TEAM_CONFLICT_OF_INTEREST`, and
  team `9025` can submit a valid 5-player squad to QA Age Cup.
- [ ] Frontend Tester verifies organizer application detail and its submitted
  player list against `BE_KN`.
- [ ] Frontend Tester verifies match lineup display and participant check-in
  eligibility against `BE_KN`.
- [ ] Frontend Tester verifies team capacity plus locked member/team deletion
  feedback against `BE_KN`.

Developer verification passed on 2026-09-21: focused roster/check-in contract
tests passed (4 files / 26 tests), the full suite passed (24 files / 159 tests),
lint passed, TypeScript and the production build passed, and `git diff --check`
passed. The existing Vite chunk-size warning remains. A live Backend/browser
registration retest was independently confirmed on 2026-09-21. Organizer,
match/check-in and locked-deletion browser checks remain pending.

## Priority 1 — Teams and registration (start here)

### 1. Team API types and hooks

Implement or reconcile types/hooks for these available routes. Tick a row when
its type, hook, and consuming screen are complete:

| Done | Need | Route | Contract |
| --- | --- | --- | --- |
| [x] | My teams | `GET /me/teams` | `{ items: MyTeam[] }`. `MyTeam` has `id`, `name`, `sportTypeId`, `readinessStatus`, `officialStatus`, `memberCount`, `role`. |
| [x] | Team detail | `GET /teams/:id` | Numeric `id`; includes `leader`, `memberCount`, `createdAt`, `readinessStatus`, `officialStatus`. |
| [x] | Team members | `GET /teams/:id/members` | Authenticated team members or tournament staff. `{ items: TeamMember[] }`; a member has `userId`, `fullName`, `avatarUrl`, `joinedAt`. |
| [x] | Team invitations | `GET/POST /teams/:id/invitations` | Team-leader-only management. Accept/decline with `POST /invitations/:id/accept` or `/decline`. |

These historical request bodies were confirmed against `origin/backend` on
2026-09-12; the position route below was removed by `BE_KN` migration 019:
- An invitation sends `{ invitedUserId }`.
- ~~A member position change is `PATCH /teams/:id/members/:uid { position }`.~~
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
| [x] | Apply | `POST /tournaments/:id/applications` | Send `{ teamId: number, playerIds: number[] }`. Success includes the accepted `playerIds`. |
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

- [x] **Head Frontend Dev:** inventory every routed page and record each source
      it reads: backend API, UI-only local state, or prototype/mock store.
- [x] **All slice owners:** when `VITE_USE_MOCK=false`, do not use
      `shared/store.ts`, `shared/seed.ts`, or `src/mocks/*` as entity data for
      tournaments, teams, users, matches, invitations, notifications, results,
      permissions, or counters.
- [x] **All slice owners:** UI preferences such as theme may remain in
      localStorage, but persisted prototype data under `ltms.v1` must not affect
      real-mode rendering, authorization, badges, links, or work queues.
- [x] **All slice owners:** unsupported real-mode features must be hidden,
      disabled with a reason, or show a named unavailable state. Do not fall
      back to demo data after `404`, `403`, `501`, network failure, or an empty
      backend response.
- [x] **Head Frontend Dev:** require numeric backend IDs in real-mode routes and
      links. Keep string IDs such as `t-vlr` and `t-fb` inside mock mode only.

### 2. Screen migration matrix

| Done | Owner | Screen/domain | Real-mode acceptance criteria |
| --- | --- | --- | --- |
| [x] | Slice 1 | Search — tournaments | Search and Home use the same backend tournament collection after `GET /tournaments` is merged and deployed. Until then Search shows no `s.tournaments`; `VALORANT Campus League 2025` and other seed records must not appear. |
| [x] | Slice 4 | Search — teams | Do not search `s.teams` in real mode. Keep the section unavailable until a public/global team-list or team-search route is agreed and deployed. |
| [x] | Slice 1 | Search — users | Use the available authenticated `GET /users/search?q=...` contract with loading, no-results, `401`/`403`, and retryable-error states. |
| [x] | Slice 1 | Profile — identity | Render the signed-in user's name and registry fields from `GET /me` without requiring a matching legacy-store user. The page must never return a blank screen because `legacyUser` is absent. |
| [x] | Slice 1 | Profile — statistics | Use `GET /users/:id/stats`; show loading, empty, and error states without hiding the `/me` identity section. |
| [x] | Slice 4 | Profile — squads | Use `GET /me/teams` for the signed-in user's squads; do not derive membership from `s.teams`. |
| [x] | Slice 1 | Profile — unsupported panels | Hide or label Career-by-tournament, Pick'em tokens, follows, and MVP totals unavailable until their backend read contracts are deployed. Do not calculate them from the seed. |
| [x] | Slice 1 | Inbox — notifications | Do not call speculative `/me/notifications` or notification read routes against the baseline. Show a deliberate unavailable state or hide the Inbox navigation until a notification contract is agreed and deployed. |
| [x] | Slice 4 | Inbox — team invitations | Keep team invitations on the API-backed flow using `GET /me/invitations` and invitation accept/decline routes; do not substitute general notifications for this flow. |
| [x] | Slices 3 + 4 | Inbox — referee invitations | Keep referee invitations on `GET /me/referee-invitations` in `MatchesPage`; document the navigation until a unified Inbox contract exists. |
| [x] | Slice 1 | Shell and badges | Derive identity, permissions, Inbox count, and navigation badges only from backend-backed queries in real mode. No badge may count prototype tournaments, invites, or notifications. |
| [x] | Slice 1 | Home and work queue | Home cards and `Needs you` entries must use backend-backed collections only. If a required route is absent, omit that queue rather than reading `workQueue(s)`. |
| [x] | Slice 2 | Tournament detail | A numeric tournament route must not combine a backend DTO with store registrations, teams, brackets, announcements, or permissions. Each tab must be API-backed or explicitly unavailable. |
| [x] | Slice 3 | Match, bracket, check-in and watch | Remove real-mode reads of store matches/results/check-ins. Each reachable view must be API-backed or explicitly unavailable. |
| [x] | Slice 4 | Team detail and management | Logo, record, transfer, roster-lock and other mock-only sections must remain isolated from API-backed team identity/membership and be unavailable when their routes are missing. |
| [x] | Slice 4 | Admin | Only Permanent squads may use the current baseline API. External referees, Users, and other unsupported tabs must not show store records in real mode. |

### 3. Backend contract gates for remaining screens

- [ ] **Head Dev + backend owner:** merge/deploy and freeze the public
      tournament list/detail contract before Search, Home, and Tournament detail
      are marked migrated. A route on an unmerged candidate is not sufficient.
- [ ] **Backend owner:** define a notification list/read/read-all contract,
      authorization, DTO, event producers, pagination, and retention before the
      general Inbox is migrated.
- [x] **Backend owner:** define global team search/list authorization and DTO
      before the Search team section is enabled in real mode.
      Delivered as public T19 in BE_KN `c11954c`; the FE sends
      `visibility=public` and renders the returned numeric team DTOs.
- [ ] **Backend owner:** define follows and any missing Profile career/Pick'em/
      MVP read contracts before those panels are enabled in real mode.
- [x] **Head Frontend Dev:** update this file with each confirmed route, request,
      response, errors, permission, reviewed backend commit, and deployment
      evidence before assigning its frontend migration.
      Updated through reviewed BE_KN `a88f7ad`; deployment/browser evidence is
      deliberately tracked by the separate unchecked smoke-test rows.

### 4. Verification for the real-mode boundary

- [x] Add tests proving Search cannot render `shared/seed.ts` tournaments or
      teams when `VITE_USE_MOCK=false`.
- [x] Add tests proving Profile renders `/me` identity when no legacy-store user
      matches and displays independent stats/error states.
- [x] Add tests proving Inbox displays empty only for `200 { items: [] }`, not
      for `401`, `403`, `404`, `501`, malformed responses, or network errors.
      Added `InboxPage.test.tsx`: five error classes and malformed payloads stay
      distinct from the successful empty state.
- [x] Add tests proving unsupported panels never issue speculative API calls and
      never fall back to store data in real mode.
      `realModeBoundary.test.tsx` now also proves the unsupported notification
      query is disabled while the API-backed action inbox renders; MVP and Watch
      guards continue to prove no prototype hooks or speculative match calls run.
- [x] Run `rg` over routed feature components for `useLtms`, `shared/store`,
      `shared/selectors`, `shared/seed`, and `src/mocks`; review and document
      every remaining real-mode-reachable use.
      Audited 2026-09-21. Remaining imports fall into three explicit groups:
      mock-only branches guarded by `USE_MOCK` (Home/Search/Profile/tournament
      compatibility views), API-backed screens that use the store only for their
      mock adapter (Match/Team), and direct unsupported routes guarded before the
      prototype hooks mount (Watch/MVP). Shell badges enable notifications only
      in mock mode. No reviewed real-mode render derives an entity, permission,
      counter, or fallback from `ltms.v1`.
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

- [x] ~~Backend delivery required: tournament list, detail, create, update,
      eligibility rules, announcements~~ — all delivered and wired, except the
      four listed separately (delete, eligibility-rule writes, entry notes,
      feedback). Route inventory re-checked against BE_KN `6ebda2e` on 2026-09-19.
- [x] ~~Backend delivery required: match list/detail, draw, result, standings,
      real bracket~~ — delivered and wired. Comments are still missing and are
      listed on their own. What the delivered result routes will not
      do is listed under its own entries: unverified results, draws, and
      correcting a score when resolving a dispute.
- [x] ~~Backend delivery required: a result that is not yet verified cannot be
      read by anybody~~ — delivered as A7 (`c9773ca`), verified 2026-09-19.
      `GET /matches/:id/result` now serves `submitted` / `disputed` / `rejected`
      to the organizer, the match referees and the two squad leaders, and the
      response carries `status`. Match 9 returns its disputed `3–2` to the
      organizer and 404 to everyone else. The match page shows the score and the
      resolve panel again; `getResult` stopped hard-coding `status: "verified"`.

- [x] ~~Backend delivery required: a match cannot end level.~~ Delivered by OD-20 / `92857f1`; historical context follows. `submitResultSchema`
      requires `winnerTeamId: z.int()`, so a draw cannot be recorded at all.
      Round robin is the format that needs it, and SRS lists `round_robin` as a
      bracket format. `submitResult()` answers 501 rather than inventing a
      winner.
      **Escalated by `75ffb0a` (2026-09-20).** `ensureScoreData()` now also
      rejects a score where the winner does not have more points than the loser,
      so a level match is not merely stored without its tiebreak — it cannot be
      submitted at all. The result form used to accept 1–1 with a decider of
      4–2 and drop the decider quietly; in real mode it now refuses to send a
      level score and says why, and the Decider fields are hidden there because
      `scoreData` takes exactly two keys — the two team ids — and has nowhere to
      carry a tiebreak. The ask is unchanged and now blocking: somewhere to
      record the tiebreak, or a way to record a draw.
- [x] ~~Backend delivery required: standings carry no points and no score totals.~~ Delivered by `92857f1`; historical context follows.
      `GET /tournaments/:id/standings` returns `{team, wins, losses, rank}` and
      nothing else — no drawn count, no points, no goals for/against. The
      leaderboard needs all of them to rank a round robin and to state its own
      tie-break ("level on points is separated by difference, then scored"), so
      `src/api/match.ts` currently fills `points` with `wins * 3` and leaves the
      score columns at 0. That constant is a guess the frontend has no business
      making: points per win differ by sport, and a draw is worth 1. Return the
      real figures and delete the guess.
- [x] ~~Backend delivery required: resolving a dispute cannot correct the
      score~~ — delivered as B4 (`c43f497`), verified 2026-09-20. `resolveSchema`
      takes `amend` with `winnerTeamId` + `scoreData`, and `reject` now rolls the
      verified result back for real. The resolve panel offers all three again:
      corrected match 9 from 3–2 to 3–1 through the UI and the row came back
      `verified` with `amended_by_user_id` and `amend_reason` set.
- [x] ~~Backend delivery required: referee removal and coverage~~ — both
      delivered and wired. `DELETE /tournaments/:id/referees/:rid` answers
      `REFEREE_NOT_FOUND` for a missing row (so the route is live) and
      `GET /tournaments/:id/referees/coverage` answers 200. Verified against
      `6ebda2e` on 2026-09-19; the earlier entry claiming neither existed was
      stale.
- [x] ~~Backend delivery required: public team list or team search.~~ Delivered
      by BE_KN `c11954c` as `GET /teams?q&sportTypeId&visibility&page` and wired
      through `searchBackendTeams` / `useSearchTeams`. Search renders only those
      API rows in real mode, with loading and error states; its regression test
      proves the seed squad does not leak into the result.
      `GET /me/teams` only returns the signed-in user's own teams, so the search
      page cannot look up anybody else's squad.
      (The 500 this used to throw on a non-numeric team id was fixed as A2 in
      `c9773ca` — `/teams/:id` answers 400 now. The search route itself is still
      the open part.)
- [ ] Backend delivery required: notification list, mark-one-read, and
      mark-all-read routes. `src/api/notification.ts` currently contains
      local `501 ENDPOINT_UNAVAILABLE` guards; the general Inbox must not call
      or simulate unconfirmed paths in real mode until the contract is agreed
      and deployed.
- [ ] Backend delivery required: follows plus any Profile career-by-tournament,
      Pick'em total, and MVP-total reads that remain part of the approved UI.
      `GET /me` and `GET /users/:id/stats` do not supply those sections.
- [ ] Backend delivery required: team leader transfer (SDS
      `POST /teams/{id}/transfer-leader`, FR-TM-08). Outside mock mode the UI
      labels it unavailable.
- [x] ~~Backend delivery required: tournament dashboard~~ — delivered as
      `GET /tournaments/:id/dashboard`, verified 2026-09-19. It answers
      `{teamCount, playerCount, matchCount, matchesCompleted}` — four totals, not
      the per-state breakdown, "on now" list or attention queue the Dashboard tab
      draws, so the tab still summarizes the match list itself. Worth wiring the
      four totals to it once somebody compares them against what the tab counts.
- [x] ~~Backend delivery required: external-referee approval~~ — delivered on
      BE_KN as `GET /admin/referee-requests` plus
      `POST /admin/referee-requests/:userId/approve | request-docs | reject`
      (per person, not per request row). `src/api/admin.ts` is wired to it and
      the Admin page's External referees tab now works against the backend.
      The queue does not say who invited the referee, so that column is blank.
- [ ] Backend delivery required: the whole admin-user surface (FR-UM-05) —
      `GET /admin/users`, `PATCH /admin/users/{id}/suspend`, `GET /admin/scopes`
      for granting and revoking admin rights, and `GET /admin/audit-logs`. All
      four answer 404 on `6ebda2e`. Login already refuses a suspended account
      (`403 ACCOUNT_SUSPENDED`) and the test database has one to prove it, so
      the rule exists with no way for an admin to apply it. The Admin page's
      Users and Audit tabs work in mock mode only; in real mode they say the
      routes do not exist.
- [x] ~~Backend delivery required: roster lock (FR-TM-04)~~ — delivered as B6
      (`c43f497`), verified 2026-09-20. `ensureRosterUnlocked` guards T07/T08/T09
      and T13; `PATCH /teams/9031/members/9201` answers `409 ROSTER_LOCKED` and
      names the tournament to withdraw from. The team page's own lock now matches
      the server's rule — it releases when the tournament is `completed`,
      `rejected` or `auto_deleted`, which it did not before.
- [x] ~~Backend delivery required: "my matches" for a referee~~ — delivered as
      B7 (`c43f497`) at `GET /me/referee-matches`, verified 2026-09-20. The
      per-match `/matches/:id/referees` probing is gone. It was not only slow, it
      was wrong: a referee is invited to a tournament they have nothing else to do
      with, so the guessed candidate set missed those matches entirely.
      `somying@ku.th` used to see 2 of her matches and now sees all 10.
      (A player's or organizer's own match list is still composed from
      `/me/teams` + `/me/applications` + `/me/tournament-requests`.)
- [x] ~~Backend delivery required: a team that cancels or withdraws an
      application can never apply again~~ — delivered as A1 (`c9773ca`).
      `findExistingApplication` now counts only `pending`/`approved`.

- [x] ~~Backend delivery required: room code for an online match.~~ Delivered
      by BE_KN `2512e04` as `PUT /matches/:id/room-code`; M05 returns `roomCode`
      only to match staff/players. `matchFromBackend` now preserves it and the
      real-mode check-in screen can publish or clear it.
      Historical gap: `matches` had no
      `room_code` column and no route accepts one — the field exists only in the
      prototype (`MatchDto.roomCode`), so a referee has nowhere to publish the
      lobby code that both squads need before an online match starts. Suggested:
      `ALTER TABLE matches ADD COLUMN room_code VARCHAR(50) NULL AFTER venue;`
      plus a write for the match referee or organizer, returned by
      `GET /matches/:id`. The check-in page states it is unavailable in real mode
      and the referee queue no longer keeps online matches in the "announce the
      room" bucket, which they could never leave while the field is always null.
- [x] ~~Backend delivery required: `GET /me/tournaments` with the full card DTO.~~
      Delivered by BE_KN `2512e04` and wired through `useMyTournaments`. Home
      merges and de-duplicates the public list with the organizer list, removing
      the old capped detail N+1.
      `GET /tournaments` is a public list, so an organizer's own tournament
      disappears from the home page the moment it is anything other than
      `public` — which includes the state it lands in right after an admin
      approves it (`private`), and every tournament that has finished. On the QA
      bench that hid 6 of one organizer's 18 tournaments.
      `GET /me/tournament-requests` knows which ones are ours but returns only
      `{id, name, status, rejectionReason, createdAt}` — not the sport, date,
      venue or cap a card needs. The home page therefore takes the ids that are
      missing from the public list and fetches `GET /tournaments/:id` for each,
      capped at 12: an N+1 that a single richer endpoint would remove. Reported
      by the backend side on 2026-09-19 and fixed on the frontend the same day;
      the request here is only to make it one round trip.
- [x] ~~Backend delivery required: closing a tournament.~~ Delivered by C14b in `92857f1`; historical context follows. Nothing previously set
      `tournament_status = 'completed'`, so a tournament whose matches are all
      confirmed stays `public` forever, `GET /tournaments/:id/winner` answers 404
      (it only serves completed tournaments) and `championCount` in
      `GET /users/:id/stats` stays 0. Worse, a tournament that *is* completed
      disappears for everyone except an admin: `findPublicTournaments` filters to
      `public` and `getVisibleTournament` refuses anything else, so finished
      results cannot be browsed at all. The tournament page works around the
      first half by declaring the tournament finished once every match is
      confirmed and naming the champion from the standings.
- [x] ~~Backend delivery required: a referee or organizer cannot read a squad
      list~~ — delivered as A8 (`c9773ca`). `GET /teams/:id/members` is open to
      the organizer and the active referees of a tournament the team applied to.

- [x] ~~Backend delivery required: a player cannot read their own check-in
      state~~ — delivered as A9 (`c9773ca`) at `GET /matches/:id/checkins/me`.

- [x] ~~Backend delivery required: `manual_by_referee` check-ins~~ —
      delivered as A5 (`c9773ca`) at `POST /matches/:id/checkins/manual`,
      referee-only. Verified live (it answers `NOT_IN_APPROVED_ROSTER` for a
      player who is not on the sheet, so the route and its rules are in place).

- [x] ~~Backend delivery required: `nextMatchId` on the match list~~ — delivered
      as B5 (`7d25994`), verified 2026-09-19. Every M04/M05 row carries
      `nextMatchId` and `loserNextMatchId`. `getTournamentMatches()` stopped
      fetching `GET /tournaments/:id/bracket` alongside the match list: the
      bracket view is one request again.
- [x] ~~Backend delivery required: no score on the match list~~ — delivered as B5
      (`7d25994`), verified 2026-09-19. Rows carry `resultStatus`, `score` and
      `outcome`. `matchFromBackend()` stopped guessing `status === 'completed'
      ? 'verified' : null`, and `fillScores()` now only calls S05 for results
      that are still `submitted`/`disputed`/`rejected` — the ones whose score
      the row deliberately withholds. A tournament of confirmed matches draws
      from a single request where it used to make one per match.
      `outcome.kind` also gave the bracket the three labels it never had:
      `bye` writes "BYE" in a permanently empty slot instead of "TBD", `void`
      writes "No contest", `walkover` writes "W/O", and `matchStateOf()` stops
      reading a finished-but-resultless match as "waiting for someone to enter
      the score".
- [x] ~~Backend delivery required: the bracket does not record who advanced~~ —
      delivered as B2 (`fecd08b` + migration 014), verified 2026-09-19.
      `GET /tournaments/13/bracket` now returns both advanced teams on the
      round-2 node. Note for whoever reads this later: the frontend no longer
      depends on it either way, because it draws the bracket from M04 alone
      since B5.
- [x] ~~Backend fix required: disputing a result that is not yet verified
      answers 500~~ — delivered as `7188dba`, 2026-09-20. `isDisputeWindow`
      returns true when `verified_at` is NULL instead of reading `.getTime()`
      off it, and the backend wrote down the rule behind it: BR-14 has two
      windows, not one — before verification the side that owes the
      confirmation may dispute instead, with no deadline, and after
      verification the `dispute_window_hours` clock applies. A result that was
      already rejected answers `409 RESULT_REJECTED`, and resolving a dispute
      raised before verification with `uphold` verifies the result outright so
      the bracket moves. This was the one thing standing between the losing
      side and its only lever.
- [x] ~~Backend fix required: nothing validates the keys of `scoreData`~~ —
      delivered as `75ffb0a`, 2026-09-20. `ensureScoreData()` now rejects a
      `scoreData` that is not exactly the two team ids of that match, a
      `winnerTeamId` that is not one of them, and any negative score, with a
      400 that carries `expectedKeys` so a client can see what it should have
      sent. Our own `a`/`b` conversion was already in place, so nothing on this
      side had to change.
      One consequence worth naming, because it lands on us: the same guard
      rejects a level score outright ("ระบบยังไม่รองรับผลเสมอ"), which makes the
      open "a match cannot end level" item above blocking rather than untidy.
- [x] ~~Backend fix required: C17b cannot be reached by anyone.~~ Delivered by
      BE_KN `c285918`: the requester can read their pending tournament and call
      `PUT /tournaments/:id/eligibility-rules`. The Entry Rules panel now saves
      faculty/year conditions directly while pending and keeps C09 amendments
      for already-approved tournaments. A regression test locks the route split.
      Historical cause: the route and
      the service disagree about who the organizer is.
      `PUT /tournaments/:id/eligibility-rules` is guarded by `requireOrganizer`,
      and `isOrganizerOf()` returns false while the tournament is
      `pending_approval` ("ทัวร์ที่ยังไม่ถูกอนุมัติ ยังไม่มีผู้จัดการแข่งขันที่ทำอะไรได้").
      `setEligibilityRules()` then refuses unless the status **is**
      `pending_approval` (`409 USE_AMENDMENT_REQUEST`). The two conditions
      cannot both hold, so the endpoint answers 403 to the person who created
      the tournament and 409 to everybody else.
      Verified on `df506ea` end to end: created tournament 26 as
      `p9201@ku.th`, then `PUT /tournaments/26/eligibility-rules` →
      `403 NOT_ORGANIZER`; after an admin approved it the same call →
      `409 USE_AMENDMENT_REQUEST`.
      The same guard hides the tournament from its own requester —
      `GET /tournaments/26` and `GET /tournaments/26/eligibility-rules` both
      answer 404 until approval — so even a read-only "check what I asked for"
      screen has nothing to read.
      Until this is settled the frontend does not offer a C17b screen: the
      conditions are set on the create form and changed afterwards through C09,
      which works. If the intent is that a pending request can still be
      corrected, `isOrganizerOf` needs to let the requester through for this
      route (and for reading their own pending tournament).
- [x] ~~Backend delivery required: an organizer cannot see their own pending amendment.~~
      Delivered by C09b in `a14d44c`; the historical limitation was that `GET /admin/amendment-requests` was the only list, and it is
      `requireAdmin_U`. After sending a change request the organizer has no way
      to ask "is it still pending?" — our panel can only show a note that lasts
      until the page is reloaded, which is not a status.
      A `GET /tournaments/:id/amendment-requests` for the organizer, or the
      pending request inlined on `GET /tournaments/:id`, would close it.
- [x] ~~Backend fix required: a change request has nowhere to say why.~~ Delivered
      by BE_KN `d97db59` (migration 020) and already wired by FE commit
      `e7db4ce`: the reason is required, sent with C09, and shown in amendment
      history.
      `amendmentRequestSchema` takes `requestedChanges` only, and
      `tournament_amendment_requests` has `rejection_reason` (the admin's) but
      no column for the requester's. The admin sees new values with no case for
      them, and FR-OM-01 asks for a reason on every rejection, which reads odd
      when the request itself cannot carry one. We removed the "Why" box rather
      than collect text that is thrown away.
- [x] ~~Backend fix required: S06 accepts whole numbers only, but the stat table
      advertised decimal/boolean.~~ Resolved by BE_KN `d97db59` / OD-18 by
      constraining stat definitions to `integer`; the generated FE form already
      follows the returned definitions and sends integer values.
      Historical mismatch: the stat table
      says a stat can be a decimal or a boolean.
      `sport_stat_definitions.data_type` is `enum('integer','decimal','boolean')`
      and `GET /sport-types/:id/stat-definitions` hands that field to us, so the
      form builds its inputs from it. `statSchema` then takes
      `value: z.int()`, so a `decimal` stat (a time, an average) or a `boolean`
      one would be rejected with `VALIDATION_FAILED` at the moment somebody
      seeds it. Latent today — all 15 seeded definitions are `integer` — which
      is why this is a small ask now rather than a bug later: either widen the
      value to match the column, or drop the two values the API cannot carry.
- [x] ~~Backend fix required: a check-in that has gone through cannot be undone.~~
      Delivered by BE_KN `dd70376`: M15 accepts pending/success/exception and a
      rejected player can check in again. The real-mode referee UI now exposes
      Reject for completed QR/manual check-ins; focused coverage also proves the
      control remains available during a background refresh.
      Historical impact: previously
      so a referee cannot reject the one thing they are there to catch.
      M15 `POST /matches/:id/checkins/:cid/reject` only touches rows that are
      still `pending`: `match.repo.rejectCheckin` ends
      `WHERE match_checkin_id = ? AND match_checkin_status = 'pending'`, and
      `findPendingCheckinOfMatch` throws `ALREADY_DECIDED` for every other
      status. Verified on `c43f497` as a referee of match 12 (status
      `checkin_open`): rejecting checkin 20 (`success`, photo_online) and
      checkin 21 (`exception`, manual_by_referee) both answer
      `409 ALREADY_DECIDED`.
      The ask is to let `reject` also take `success` and `exception` rows while
      the match is still `checkin_open` or `in_progress` — the window
      `findPendingCheckinOfMatch` already enforces. `verify` should stay
      pending-only; it is `reject` that needs the wider door.
      Why it matters: `qr_onsite` is decided by the scan, with nobody looking at
      the face behind it, so the referee's only control over a teammate scanning
      for an absent player is to revoke it afterwards — this page has said so
      since the prototype ("a referee's only lever is after the fact"). The same
      hole is under `manual_by_referee`: a referee who waves the wrong player
      through by hand cannot take it back, and the false row is what decides the
      lineup count and the forfeit call.
      Until then the Reject button is hidden in real mode rather than left
      there to answer 409 on every press.
- [x] ~~Backend fix required: the note on a manual check-in is stored and
      returned as `rejectionReason`~~ — delivered as `75ffb0a` with migration
      015, 2026-09-20. `match_checkins.note` is its own column, the old rows
      were moved into it, and both `GET /matches/:id/checkins` (M13) and
      `GET /matches/:id/checkins/me` (M20) return `note` beside
      `rejectionReason`. Verified on match 11: ten manual rows come back
      `"status": "checked_in"` with their note in `note` and
      `rejectionReason: null`.
      The workaround is gone — the check-in page no longer reads the status to
      decide what that field means, and the referee console now shows the note
      next to "Checked in", which is the audit trail we asked for: the next
      referee and the organizer can see why somebody was waved through by hand.
- [x] ~~Backend fix required: `resultStatus` is public on M04/M05 while S05
      keeps the same result private~~ — **confirmed deliberate** (OD-16,
      2026-09-20), nothing to change. What is public is that a result exists
      and what state it is in; what stays private is the score and the reasons
      — `score` is null until `verified`/`walkover` and S05 answers 404 to
      anyone who is not the organizer, a referee of that match or one of the
      two squad leaders. Re-checked after `df506ea`: `GET /matches/9` with no
      token gives `resultStatus: "disputed"` with `score: null`, and
      `GET /matches/9/result` with no token gives 404.
      We rely on this on purpose: the bracket, the schedule table and the match
      header badge "awaiting confirmation" and "disputed" for everybody. It is
      also what lets a plain player see that a result is in — without it the
      match page told them "no result recorded yet" while the two leaders saw
      the opposite.
- [ ] Backend delivery required: tournament feedback — both writing it and
      reading it back (SDS `POST /tournaments/{id}/feedback`, FR-CM-02).
      `schema.sql` already has the whole table: `tournament_feedback` with
      `feedback_type ENUM('comment','organizer_feedback','mvp_vote')`, a
      `rating` column and a unique key that enforces one per person. No route
      touches any of it, verified 404 on `6ebda2e`. The Community tab's rating
      form and the organizer's Feedback panel work in mock mode only.
- [ ] Backend delivery required: match comments and Pick'em (SDS
      `POST /tournaments/{id}/comments` FR-CM-01,
      `POST /matches/{id}/predictions` FR-PK-01, settled inside the result
      transaction). `src/api/engagement.ts` calls `/matches/:id/comments` and
      `/matches/:id/picks`, which match neither the SDS nor a backend route.
      The match page's Community tab shows `SocialBar` in mock mode only,
      because `SocialBar` takes a store `Match`, not a `MatchDto`.
- [x] ~~Backend fix required: `acceptedCount` counted unapproved external
      referees~~ — delivered as A3 (`c9773ca` + `50cc899`). The response is now
      `{acceptedCount, awaitingAdminCount}`; `effectiveCount` was dropped as a
      duplicate. The frontend already read `acceptedCount`, so nothing changed
      on our side — `awaitingAdminCount` is still unused and could be surfaced.

- [x] ~~Backend delivery required: a way to say which faculties a tournament
      admits, and an approval rule that follows from it~~ — delivered as
      `66d5cfc`, 2026-09-20, with the decision recorded as OD-15.
      Rules go in as `eligibilityRules: [{type: 'faculty'|'year', value}]` on
      `POST /tournaments` (C01); sending none means no restriction. While the
      tournament is `pending_approval` the organizer replaces the whole set
      with `PUT /tournaments/:id/eligibility-rules` (C17b) — after approval
      that answers `409 USE_AMENDMENT_REQUEST` and the change has to go through
      a C09 amendment, which itself locks once registration opens or any
      application exists (`409 ELIGIBILITY_LOCKED`).
      The routing rule is the one the team asked for, decided as OD-15 Q2-ข: a
      faculty admin may approve (or auto-approve) only a tournament whose
      faculty rules name their own faculty and nothing else. Anything that
      admits another faculty, or restricts none, answers
      `403 ELIGIBILITY_OUT_OF_SCOPE` and goes to a `university_wide` admin.
      Two things we asked for that were decided against, so the form must not
      offer them: `scopeType: 'university'` stays closed (OD-11/OD-15 Q3 —
      `university` means the university is *running* it, not that everyone may
      enter; "open to every faculty" is expressed by setting no faculty rule at
      all, and such a tournament goes to a university admin), and
      `admittedFacultyIds` is dropped in favour of `eligibilityRules`.
      Frontend: built and verified 2026-09-20. The request form ticks faculties
      and years and says, live, who will decide the request; the manage tab's
      Entry & filter reads the real rules and sends a change through C09. What
      is *not* built is the C17b screen — see the item about it below.
- [ ] Backend delivery required: entry notes, the soft filter (FR-TN-03). There
      is no column and no route, so the free-text note an organizer writes for
      applicants has nowhere to live. `saveEntryNotes()` answers 501.
- [ ] Backend delivery required: `DELETE /tournaments/:id`. An organizer can
      unpublish but never delete, so a tournament created by mistake is
      permanent. `deleteTournament()` answers 501.
- [x] ~~Backend delivery required: `PATCH /matches/:id/schedule` is all or
      nothing~~ — delivered as B9 (`c43f497`), verified 2026-09-20. Sending only
      `venue` to match 13 moved the court and left the times alone; a match that
      has never been scheduled still answers `400 SCHEDULE_INCOMPLETE`, whose
      message the fixture form shows as it stands. `updateMatch()` sends whatever
      it was given instead of refusing.
- [x] ~~Backend delivery required: clearing a livestream URL~~ — delivered as
      A6 (`c9773ca`). `PUT /matches/:id/livestream` with `{"youtubeUrl": null}`
      answers 200 and clears it; `setLivestream()` no longer refuses null.

- [x] ~~Backend fix required: two datetime formats in one API~~ — delivered as
      A4 (`c9773ca`). `PATCH /matches/:id/schedule` now accepts both `Z` and an
      offset, same as `POST /tournaments`. `toZulu()` in `src/api/match.ts` is no
      longer load-bearing and can go whenever someone is in there.

- [x] ~~Process: sport ids were renumbered in place with no note to the
      frontend~~ — accepted by the backend side on 2026-09-19: *"ผิดจริง ผมบอก
      แค่ BE · ต่อไปทุก migration ที่แตะข้อมูลอ้างอิง (ids, enum) ใส่ในข้อความแจ้ง
      ทีมทั้ง BE+FE"*. Nothing to build. `tournamentView.ts` reads names and
      `defaultMode` from `GET /sport-types` either way, so a future renumber
      passes through without a frontend change.
- [x] ~~Frontend work: no way to set the faculties and years a tournament
      admits~~ — built 2026-09-20 against `66d5cfc`, verified by driving the app
      and reading the rows it wrote.
      **Request form.** "Who may enter" asks which faculties may enter as three
      choices — every faculty, only the faculty running it, or a list to tick —
      plus a tick list of years 1–8, and a line underneath that names who will
      decide the request as you go: the organising faculty's admin while the
      only faculty admitted is that faculty, a university admin the moment a
      second one is admitted or none is. That is `adminCoversEligibility`
      restated for the person filling the form, so they learn the queue changes
      hands before they send it, not after. Submitting ticked faculties 1 and 2
      and year 2 wrote exactly those three rows.
      The three choices replaced a bare tick list of all eight faculties, which
      sat a few fields below the organising-faculty select and read as the same
      question asked twice (reported 2026-09-20). "Only the faculty running it"
      holds no copy of the id — it reads the select live, so changing the
      organiser moves the rule with it, and a list ticked and then abandoned is
      recomputed at submit rather than sent (verified: two ticked faculties,
      switched back to "every faculty", wrote no rules at all).
      **Entry & filter tab.** In real mode this is now its own panel
      (`EntryRulesPanel`) reading `GET /tournaments/:id/eligibility-rules` and
      the tournament detail, because the prototype's `Rules` holds one faculty
      and one year and quietly dropped the rest — a tournament admitting two
      faculties read as "any". It lists every faculty and year, and "Request a
      change" opens the same tick lists prefilled, with the same line about who
      decides, and sends `requestedChanges.eligibilityRules` (C09). Verified:
      the request wrote `{"eligibilityRules": [{faculty 1}, {year 2}], …}`.
      Entry open is shown as a lock up front, since the server refuses the
      change then (`409 ELIGIBILITY_LOCKED`).
      **Two things removed rather than left lying.** The old change modal sent
      `requestedChanges: {rules, reason}`, neither of which is an accepted
      field — every press answered `400 AMENDMENT_FIELD_NOT_ALLOWED`. And the
      soft-filter editor is gone in real mode: entry notes have no column and no
      route, so the box only ever produced a 501.
- [x] ~~Frontend work: the losing side was shown "You won, so you confirm"~~ —
      fixed 2026-09-20, reported from the app. BR-13 gives the on-site
      confirmation to the leader of the **winning** team, and
      `requireCanVerifyResult` enforces exactly that
      (`isLeaderOfTeam(winner_team_id)`), but `viewer.can.verifyResult` was
      `onsite ? !!myTeam : isReferee` — anyone on either side, leader or not.
      Reproduced on match 12 as `playerB1@ku.th`, the leader of the side that
      lost: the page read *"You won, so you confirm"* over a Confirm button, and
      `POST /matches/12/result/verify` answers `403 WRONG_SUBMITTER_ROLE`.
      Three gates were loose against the same middleware and are now tight:
      `verifyResult` and `submitResult` need `isTeamLeader` (a plain player of
      either squad saw both), and so does `disputeResult`, since
      `requireCanDisputeResult` takes a match referee or a team **leader**. The
      winner-only half is checked on the page, where `result.winnerTeamId` is
      known — `M05` only sends `outcome` once the match is `completed`, so the
      api layer cannot know it while a result is still `submitted`. The losing
      leader now lands on the Waiting panel with the dispute box, which is what
      the design said all along.
      Two things the same screen got wrong for a plain player, found while
      checking the fix: `MatchDto` now carries `resultStatus` (public on M05
      since B5) so the status chip no longer reads "Check-in open" for a player
      while the leaders see "Awaiting confirmation", and the panel under it says
      a result is in and who owes the confirmation instead of "No result
      recorded yet". The match page also stopped writing `lineupSize` for a
      viewer who cannot read `/checkins`, which had it printing
      "0 of 2 checked in" to a squad that was fully checked in.
- [x] ~~Frontend work: a failed stats save was silent~~ — fixed 2026-09-20.
      The result form sends the score (S01) and the player stats (S06) as two
      requests, and awaited both with `mutateAsync` while rendering a banner for
      the first one only. If the stats call failed — `409 INSUFFICIENT_REFEREES`
      is reachable if a referee is removed after the match starts — the score was
      already in, the numbers the referee had typed were gone, and the screen
      said nothing. The rejection is caught now and a banner says the score
      saved but the stats did not, and that the numbers are still on screen to
      send again (S01 is an UPDATE, so pressing Submit twice is safe).
- [x] ~~Frontend work: two more places where a screen offered what the server
      refuses~~ — fixed 2026-09-20, found by walking the app as a plain player,
      a leader, an organizer and an admin and reading every non-2xx.
      (1) On a team whose roster is locked, the Remove button was disabled but
      the starter/substitute dropdown next to it was not, although both are
      `PATCH|DELETE /teams/:id/members/:uid` and B6 blocks them alike — changing
      it answered `409 ROSTER_LOCKED` every time. It is disabled now, with the
      same tooltip as Remove.
      (2) `composeMyMatches()` asked `GET /matches/:id/checkins` for every match
      about to be played, but that route is organizer/referee only, so a player
      collected a 403 for each of them on every load of /matches and got nothing
      back. It now asks only for matches the viewer can actually read, and the
      match card prints `—` rather than `0 / 0` when it has no figure — the same
      rule the match page already followed.
- [x] ~~Frontend work: an organizer was shown the referee's check-in buttons~~ —
      fixed 2026-09-20. `POST /matches/:id/checkins/manual`, `/checkins/:cid/verify`
      and `/checkins/:cid/reject` are all `requireReferee`, meaning a referee **of
      that match**, but the check-in page opened those buttons on
      `can.manageCheckin`, which is `isReferee || isOrganizer`. An organizer who
      was not also a match referee saw "Verify by hand", "Review photo" and
      "Reject" and got `403 NOT_REFEREE` from every one of them (reproduced:
      `somchai@ku.th` on match 11). `viewer.can` now carries `verifyCheckin`
      (match referee only) next to `manageCheckin` (opening and closing check-in,
      and reading the console), and the organizer gets a line saying which half
      is theirs instead of three buttons that fail.
- [x] ~~Frontend work: the match lifecycle had no controls at all~~ — wired
      2026-09-19 as `MatchLifecycle` on the match page. A route-by-route diff of
      BE_KN `6ebda2e` against every `apiFetch` in `src/` found four endpoints
      that no screen reached: `POST /matches/:id/open-checkin` (M09) and
      `POST /matches/:id/start` (M10) had api-layer functions written but no
      caller — dead code — and `close-checkin` (M18) and `forfeit` (M17) were
      not wired at all. A match could not leave `scheduled` from the UI, which
      is why the QA bench had to be built with SQL scripts.
      The panel shows the organizer Open check-in on a `scheduled` match, and
      Close check-in plus "A squad did not show up" on a `checkin_open` one; the
      match referee gets Start the match. Forfeit ends the match, so it is
      behind a second confirm. A match still waiting on an earlier round shows
      nothing — the server answers `409 MATCH_TEAMS_INCOMPLETE` for all three.
      All four verified against the running backend: close→reopen round-trips,
      forfeit returned `double_forfeit` with `minMembers: 5`, and start
      correctly refused a match whose squads were short of the minimum.
      Nothing else is unwired: 109 backend routes, every one now reachable.

## User-reported regressions and requirements — 2026-09-20

Owner for triage: Head Frontend Dev. The seven reports below are open acceptance
gates, not reproduced/verified fixes. Source inspection supplies leads only;
capture the current frontend/backend commits, tournament/match/user IDs, role,
request body, HTTP status/error code and relevant read responses before assigning
a backend root cause. Do not capture access tokens or other credentials.

Earlier checked implementation entries (C09, manual check-in, match lifecycle)
remain historical delivery records; they do not mean these reported flows pass.
Real-backend smoke and overall QA remain pending until these regressions pass.

### Fix order and acceptance

- [x] **R01 · P1 · Slice 2 + shared UI; backend validation owner:** hard-filter
      amendment modal jumps repeatedly, and submit reports
      `Couldn't send the request. วันแข่งขันต้องอยู่หลังวันปิดรับสมัคร`.
      Inspect `EntryRulesPanel.tsx`, `components/kit/Modal.tsx`, and C09
      `POST /tournaments/:id/amendment-requests`.
      Source lead: Modal's effect depends on `onClose` and focuses the first
      input every run; this panel supplies a new inline callback on renders.
      Reproduce typing, checkbox changes, scrolling and query refresh before
      attributing the jump to this effect. Keep focus/draft stable while open.
      The inspected payload changes eligibility/gender/age only, not dates.
      Compare stored registration end and event start, timezone/date-only
      handling, and the backend's merged amendment validation. Do not silently
      alter tournament dates to make a hard-filter request pass. If the stored
      schedule is invalid, show an actionable explanation and correction path.
      Delivered 2026-09-20. Root cause confirmed from the frontend and BE_KN
      source: Modal treated each new inline `onClose` callback as a reopen and
      focused its first control again; create validation allowed registration to
      close during the first event day (`23:59:59`) while backend `ensureSchedule`
      treats the date-only event start as midnight. Modal now focuses only when
      `open` changes and keeps the latest Escape callback in a ref. Frontend
      schedule validation mirrors `ensureSchedule`. For an existing conflicting
      schedule, Entry & filter explains why every amendment is rejected, requires
      an explicit corrected first-match date, and includes that visible change in
      the same C09 request; it never changes dates silently. The send button is
      disabled until valid and while pending. Error code `INVALID_DATE_RANGE`
      receives an actionable explanation if the server still rejects it.
      Developer verification passed: focused modal/schema/payload regressions,
      full 19 files / 142 tests, lint, production build and `git diff --check`.
      Existing Vite bundle-size warning remains. Ready for Frontend Tester.
      Real-backend browser retest remains in the regression completion gate.

- [x] **R06 · P1 · Slice 3 + backend check-in owner:** referee "Verify by hand"
      returns `ผู้เล่นคนนี้เช็คอินไปแล้ว` while the roster says `Not yet`.
      Compare `GET /matches/:id/checkins` with
      `POST /matches/:id/checkins/manual` for the same match/user. Check user-ID
      mapping, status mapping, pagination, read failures and cache refresh;
      do not infer that a missing visible row proves no check-in exists.
      Accept: read errors/loading never show a definitive Not yet; existing
      check-ins display their real state; manual success refreshes the roster;
      an already-checked-in response reconciles with a fresh read and does not
      invite repeated writes. Verify after reload and from a second session.
      Delivered 2026-09-21. Missing rows now say `Checking...`,
      `Status unavailable`, or `Not visible` until an authoritative read proves
      `Not yet`; manual actions stay hidden during those uncertain states.
      Successful writes keep the mutation pending through cache refresh, and a
      `409 ALREADY_CHECKED_IN` performs a fresh `GET /matches/:id/checkins` and
      reconciles only the row with the same numeric `userId`. Developer
      verification passed: 7 focused regressions, full 24 files / 156 tests,
      lint, production build, dev startup, and `git diff --check`. Live BE_KN
      `3ec530d` retest passed after the QA baseline restored `application_players`:
      match 7 exposed user 9102 as the one missing member of a four-player
      approved lineup; M19 returned `201 checked_in` with check-in id 51, and
      both a reload and a fresh login session returned that same
      `manual_by_referee` row. A repeated write returned the expected
      `409 ALREADY_CHECKED_IN`, while the fresh list continued to report the
      persisted row. The Vite `/api/v1` proxy returned it too. Real-browser UI
      observation remains pending because this run had no browser surface.

- [ ] **R07 · P1 · Slice 3 + backend check-in owner:** participant check-in
      reports `เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง`.
      Capture whether the failing path is QR/on-site or photo/online, then
      inspect its actual request/response and server log. Check match state,
      approved roster, authenticated identity, QR validity or upload result as
      applicable; the generic message alone does not prove a backend 500.
      Accept: valid participant check-in succeeds and survives reload in both
      participant and referee views; invalid/expired/duplicate submissions have
      specific feedback. Verify each supported check-in method separately.
      - [x] **Frontend Dev delivery (2026-09-21):** confirmed the real API path
        sends `qrPayload` for on-site check-in and, for online check-in, obtains
        an upload presign, uploads the captured JPEG/PNG, then submits the returned
        `objectKey`. Focused contract tests cover both methods. The UI now gives
        specific recovery copy for closed check-in, wrong method, invalid/expired
        QR, non-approved roster, duplicate, missing match and upload failure.
      - [ ] **Frontend Tester + backend owner acceptance:** reproduce the original
        report against current BE_KN, capture its method/status/error/server log,
        then verify valid on-site and online submissions survive reload in both
        participant and referee sessions.

- [ ] **R03 · P1 · Slices 2/4 + backend application/referee owners:** enforce
      the stated rule that an organizer or referee cannot compete in their own
      tournament. Confirm whether referee membership means invited, accepted,
      or active, and whether the conflict rejects the entire team roster.
      Cover both entry points (tournament and team), all relevant team members,
      and the reverse order (already competing, then appointed referee).
      Accept: frontend explains the conflict; the backend rejects conflicting
      applications/appointments even if submitted outside the UI. Do not apply
      this restriction to unrelated tournaments or rely on a hidden button.
      - [x] **Frontend Dev delivery (2026-09-21):** registration now explains the
        conflicting organizer/referee role and recovery path from
        `TEAM_CONFLICT_OF_INTEREST`; referee appointment names an existing team
        conflict from `REFEREE_CONFLICT_OF_INTEREST`. Both entry points preserve
        the server decision instead of relying on hidden controls. Focused FE
        regression coverage verifies the application message.
      - [ ] **Backend owner + Frontend Tester acceptance:** run the current backend
        conflict tests and real-browser/API checks for organizer/referee membership,
        every submitted player, and the reverse order before marking R03 complete.

- [x] **R02 · P1 · Slices 2/3 + backend bracket owner:** atomic bracket
      replacement delivered by BE_KN `a88f7ad` and wired in Manage. M01 sends
      `replace: true` only after confirmation, exposes `replaced`, preserves the
      existing bracket on `BRACKET_IN_USE`, renders the blocking match metadata,
      refreshes tournament/match/standings queries, and tells the organizer to
      assign match-specific referees again. Frontend Dev added a dedicated
      `Random redraw bracket` action on 2026-09-21: it Fisher-Yates shuffles every
      approved team exactly once, avoids an unchanged redraw, previews the random
      order, and requires a second confirmation before the same atomic
      `replace: true` request. Focused random/UI/contract regressions pass.

- [x] **R05 · P2 · Slices 2/3:** draw progress does not update. Reproduce both
      random draw in SetupTrail and manual draw in DrawPanel; distinguish request
      pending feedback from the persistent setup-completion indicator.
      Source leads: SetupTrail uses `t.drawn` for completion despite querying
      backend matches; DrawPanel disables pending submit but keeps its normal
      label. Accept: visible pending feedback, refreshed API-derived completion
      after success and reload, and failure feedback that never marks draw done.
      Delivered 2026-09-21. Real-mode progress now derives draw completion from
      `GET /tournaments/:id/matches`, and the draw mutation remains pending until
      the tournament/match invalidations finish refetching. Both random and manual
      draw surfaces show explicit Drawing feedback; failure stays incomplete.
      The manual editor also reconciles its positions after approved-team data
      loads instead of retaining its first empty render. Regression coverage: 4
      focused tests; full suite 25 files / 163 tests, lint, production build and
      `git diff --check` passed. Existing Vite chunk-size warning remains.
      Real-browser/backend retest is still pending.

- [ ] **R04 · P2 · Slices 2/3/4 + backend referee owner:** select match referees
      in the draw workflow from the tournament referee pool, including future
      rounds whose teams are still TBD. This is a requested UI/workflow addition,
      not evidence that existing appointment APIs are absent.
      Recheck current match-specific invitation/change-request contracts; do not
      restore the removed direct-assignment endpoint. Establish when match IDs
      exist, how consent/acceptance works, and whether future-round appointments
      are supported. Accept: eligible pool selection per match, pending versus
      accepted shown separately, future-round slots, capacity/time-conflict and
      permission feedback, persisted assignments after reload, and safe handling
      of partial draw/assignment failure and redraw. Split any unsupported
      contract into a backend blocker after verification.
      - [x] **Frontend Dev delivery (2026-09-21):** real-mode Fixture no longer
        calls the removed bulk assignment adapter. It saves start/end/venue as a
        separate operation, then uses FR02 to request one active tournament
        referee per match. Available, waiting-for-acceptance and accepted states
        are distinct; an organizer can cancel an open request or remove an accepted
        assignment. Capacity, missing schedule, read/mutation, permission and
        server time-conflict feedback remain visible. The same page works for
        future-round match IDs whose teams are still TBD, and reload/redraw reads
        the authoritative request and match-referee collections. Focused UI/API
        tests prove the consent route is used and bulk assignment is not called.
      - [ ] **Frontend Tester + backend referee owner acceptance:** exercise
        accept/decline, overlapping schedules, reload, redraw and partial request
        failure against populated BE_KN data before marking R04 complete.

- [x] **R08 · Guest access · Slices 1/2/4:** a guest can inspect teams entered
      in a public tournament, but cannot vote for MVP or submit Pick'em.
      Delivered 2026-09-20. The approved-team collection and `GET /teams/:id`
      remain public, and the team page returns guests to Tournaments. It no
      longer calls authenticated `/me/teams`, `/me/applications`, or
      `/teams/:id/members` for a guest; public name, sport, readiness, official
      status, captain and member count still render, while the private roster
      asks the visitor to sign in. MVP standings remain readable in mock mode,
      but Vote is absent without a signed-in user. Pick'em likewise shows its
      public summary with no Call action for a guest. Real-mode MVP and Pick'em
      remain explicitly unavailable because their backend contracts are still
      missing. Developer regression coverage verifies all three boundaries.
      Real-browser/backend retest remains pending below.

- [x] **R09 · Admin navigation · Slice 1:** never treat `userType: "staff"` as
      admin authorization. `organizer@ku.th` is staff but has no `admin_scopes`;
      both `/admin/team-requests` and `/admin/tournament-requests` return
      `403 INSUFFICIENT_ADMIN_SCOPE`, so showing Admin from `userType` was a
      false permission hint. Delivered 2026-09-20: real-mode Shell uses the
      existing `useAdminAccess` backend capability check and shows Admin only
      after the scope-guarded tournament-request queue succeeds. The check is
      disabled for guests and cached for five minutes. Mock mode continues to
      use its isolated Admin role. Direct `/admin` navigation still renders the
      page's 401/403 access state; hiding a menu is not authorization.
      Regression coverage includes staff without scope plus faculty and
      university-wide capability outcomes. Prefer `adminScopes` on `GET /me` or
      a dedicated current-user capability endpoint when backend adds one; then
      replace the queue probe without changing Shell policy.

### New regression intake — 2026-09-21

The checked delivery records above remain historical implementation evidence,
not acceptance evidence for these newly reported regressions. Keep every item
below open until its own API and real-browser criteria pass against the current
backend baseline.

- [ ] **R10 · P1 · Draw referee planning · Slices 2/3/4 + Backend:** on the draw
      page, let the organizer select referees from the tournament referee pool
      for every known match, including future match slots whose teams are not
      resolved yet. Show assigned, pending, accepted, and declined/cancelled
      states without presenting a request as a confirmed assignment.
  - Reproduce/evidence: record the tournament referee pool, draw/bracket payload,
    match IDs (including future slots), assignment request/response, and state
    after reload and redraw. Reconcile this with R04 instead of treating R04's
    earlier frontend delivery as acceptance.
  - Accept: an authorized organizer can select, replace/cancel, and review each
    match referee from the draw workflow; assignments persist after reload,
    future-slot assignments remain attached to the intended match, consent
    status is truthful, and unauthorized roles cannot mutate them.

- [ ] **R11 · P1 · Check-in reject then re-verify · Slice 3 + Backend:** fix the
      referee flow where rejecting a check-in prevents a later verification for
      the same approved player in both `online` and `on_site` modes. Add a
      required reject-reason field and display the recorded reason where the
      affected user/referee needs it.
  - Reproduce/evidence: capture mode, player/application ID, check-in/photo ID,
    status before and after reject, reject request/response, the subsequent
    re-check-in attempt, refreshed list payload, and second verification
    attempt. Distinguish photo review from modes whose check-in succeeds
    immediately rather than assuming they share one state transition.
  - Accept: reject requires a non-blank reason; the reason persists after
    reload; the rejected attempt remains auditable; the player can create the
    next valid attempt; and the referee can approve/reject that new attempt
    without stale-row or disabled-action errors in both modes.

- [ ] **R12 · P1 · Fixture editor scope · Slices 2/4 + Backend:** make Fixture
      the match-management page for editing the scheduled start date/time and
      the referees assigned/requested for that match. Preserve the distinction
      between a pending invitation and an accepted assignment.
  - Reproduce/evidence: capture current match schedule/referee payloads,
    organizer permissions, each update request/response, validation/conflict
    errors, and refreshed match/fixture data.
  - Accept: the organizer can update a future match's start date/time and
    add/replace/cancel eligible referee requests; current and pending referees
    render correctly after reload; invalid/past/conflicting values produce an
    actionable error; read-only roles cannot edit.

- [ ] **R13 · P1 · Double forfeit lifecycle · Slices 2/4 + Backend:** when both
      teams lose by forfeit, advance/recompute the bracket immediately from the
      terminal `double_forfeit`/void outcome instead of leaving the match at the
      stage that waits for team-leader result confirmation.
  - Reproduce/evidence: capture both forfeit operations, returned match/result
    status, subsequent match and bracket reads, and the downstream slot state.
  - Accept: the match reaches the backend-defined terminal double-forfeit
    state, no team-leader confirmation action is required or shown, bracket
    progress is recomputed once, downstream placement is correct, and reload
    does not restore the waiting-confirmation stage.

- [ ] **R14 · P2 · Completed-match YouTube replay · Slices 2/4 + Backend:** a
      replay URL saved after a match ends must render on that match page. Keep
      replay media separate from the pre-match/live-stream URL and state.
  - Reproduce/evidence: capture the actual write endpoint/body/response, the
    persisted field returned by the match read endpoint, completed-match state,
    and the match page after reload.
  - Accept: a valid YouTube replay URL can be added or updated by an authorized
    role, persists after reload, and appears as a usable link/embed for the
    intended viewers; invalid URLs and failed saves are surfaced rather than
    showing false success.

- [ ] **R15 · P1 · Winning team-leader confirmation · Slices 2/4 + Backend:**
      restore the winner's team leader ability to confirm a submitted result;
      the currently working dispute action must not mask or replace confirm.
  - Reproduce/evidence: capture match/result IDs and state, winner team ID,
    current user/team/role membership, result read payload, visible actions,
    confirmation request/response, and refreshed state.
  - Accept: the winning team's authorized leader sees an enabled Confirm action
    and can complete it once; dispute remains available only where allowed;
    losing leaders/plain members cannot confirm; duplicate confirmation is
    idempotent or returns a clear terminal-state response.

- [ ] **R16 · P1 · Organizer dispute resolution · Slices 2/4 + Backend:** after
      a result is disputed, let the organizer resolve it by amending the score
      and winner, upholding it, or throwing out/rejecting the record without
      leaving all controls disabled or creating an unconfirmable result.
  - Reproduce/evidence: for each resolution path capture result/dispute state,
    available actions, request/body/response, the refreshed result, and the
    permissions/actions visible to both organizer and team leaders.
  - Accept: amend persists the corrected score/winner and moves to the intended
    confirmation stage; uphold reaches its intended terminal/confirmation
    state; throw-out removes/rejects the disputed record and permits a fresh
    valid result submission; the correct role can then confirm it, controls
    recover after errors, and bracket progression occurs exactly once.

### Regression completion gate

- [ ] Head Frontend Dev: attach reproduction evidence and confirmed ownership
      to every open item in R01–R16; settle R02 timing, R03 role-conflict scope,
      and the frontend/backend boundary for R10–R16.
- [x] Add targeted regression tests for confirmed causes; run tests/lint/build
      for implementation changes. This entry itself is documentation only.
      Latest Developer verification 2026-09-21: 32 files / 198 tests, lint,
      production build, Vite dev startup on `127.0.0.1:5173`, and
      `git diff --check` pass. The existing 500 kB Vite chunk warning remains;
      real-backend/browser retest remains assigned below.
- [ ] Frontend Tester: retest the affected flows with real backend data as
      organizer, match referee and participant, recording Network evidence.
- [x] Reconcile results with Priority 3 smoke tests, Priority 4 migration matrix
      and Definition of done; do not mark overall QA passed from unit tests.
      Reconciled 2026-09-21. Developer verification is recorded separately from
      the still-open real-backend, browser, hosted-CI and Frontend Tester rows.

## Open issues found 2026-09-13 — not backend blockers

Found while checking team links, the mobile preview (`mobile.html`) and the
home page. Each item keeps its own implementation and verification status.

### Slice 1 / Person 1 — home page, kit and CSS

- [x] The home filter bar covers the list on phones. Deferred on 2026-09-13.
      `.toolbar` is sticky (`src/styles/prototype.css:500`). At 393×852 the
      sport chips wrap to three rows, so the bar is 276px tall and the first
      card starts at 1176px. While scrolling, the bar covers 336px of the
      screen and only one card is fully visible. A tested fix for phones only,
      inside the `@media (max-width:820px)` block (`prototype.css:563`):
      `.toolbar{position:static;}`,
      `.toolbar .chips{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;}`,
      `.toolbar .chips .btn{flex:none;}`. With it the bar is 170px, the chips
      sit in one row, and nothing overflows sideways.
- [x] Home "All" looks smaller than a stage filter. The grid shows only the
      selected tab, and the page selects the first non-empty tab
      (`src/features/home/HomePage.tsx:101`). Signed in as Sirawit, All opens
      "Yours to run · 1" with one card, and In progress opens "You're
      competing in · 3" with three, while "Find one" reads 7 of 7 and 4 of 7.
      On phones `.tabs` wraps (`prototype.css:255`), so the tabs read like
      section headings. Options: add an "All" tab or show every group, keep
      the chosen tab when the stage changes, and scroll the tabs sideways on
      phones.
- [x] Under All, "Other tournaments" leaves out finished tournaments
      (`HomePage.tsx:92`). They appear only under Finished.
- [x] "Needs you" is fixed at three columns (`HomePage.tsx:123`, inline
      `repeat(3,1fr)`). Seen in the code, not measured on a phone.
      Delivered 2026-09-21. Home now has an explicit All relationship tab whose
      contents match the active search/stage filters, including finished events.
      Relationship badges remain correct on the combined grid. Home category and
      stage tabs scroll horizontally on narrow screens, sport chips stay in one
      row, the filter bar is non-sticky below 820px, and Needs you collapses to a
      single column. Pure category regressions cover All, finished Other events
      and the zero-result empty state. Developer verification passed: focused 3
      tests, full suite 26 files / 166 tests, lint, production build and
      `git diff --check`. The existing Vite chunk-size warning remains.
      Real-phone visual QA remains pending.
- [x] Team names link to pages that don't exist for fixture teams.
      `ScorebugView` (`src/components/kit/Scorebug.tsx:28`) and `TeamLinkView`
      (`src/components/kit/chips.tsx:63`) always link to `/team/:id`. The
      fixture matches `/m/301` to `/m/304` use team ids 11–14
      (`src/mocks/match.mock.ts`), which aren't in the store, so the link opens
      "No such squad". Request: a way to render the name as plain text, such
      as a `linkTeams` prop that defaults to `true`. Not urgent, because no
      menu leads to these pages.
      Fixed 2026-09-21: `TeamLinkView.link` and
      `ScorebugView.linkTeams` default to true, while display-only fixture
      matches render team names without dead links. Component coverage checks
      both linked and unlinked modes.
- [x] The engagement mocks and the seed disagree. `src/mocks/comment.mock.ts`
      and `src/mocks/pick.mock.ts` read and write localStorage, but the seed
      keeps comments and picks in the store (`s.comments`, `s.picks`). The
      tournament Community tab counts two comments on QF1
      (`src/features/tournament/CommunityTab.tsx:53`), yet the match page shows
      none. Comments posted on the match page aren't counted there, and picks
      made in `SocialBar` don't count as Tokens (`pickScore`,
      `src/shared/career.ts:93`).
      Fixed 2026-09-21: both mocks now read/write `s.comments` and `s.picks`
      through the shared mock commit boundary. Regression tests prove seeded
      comments appear, posts/removals update the shared count source, and picks
      are visible to both the match API and `pickScore`.

### Slice 3 — what is left of the real-mode boundary (found 2026-09-20)

Match, results, check-in and the fixture page are API-backed. These three views
were the remaining implementation gaps in the Slice 3 row. The fixes below
close those gaps; the matrix stays unticked until real-browser verification.

- [x] The bracket falls back to the store when the tournament has no matches
      yet. `BracketTab.tsx:180` renders the API bracket only when
      `apiMatches.data.items.length` is non-zero; an empty list falls through to
      the prototype branch, and the "not drawn" empty state then counts
      `regsOf(s, t.id)` — a store lookup that a numeric tournament id never
      matches. Seen on tournament 2: it reads "0 squads approved so far" while
      the server has 1 approved application and 0 matches. The count, and the
      "Go to manage" button beside it (gated on `isOrg(s, t)`, also store-only),
      both need the API or need to go.
      Fixed 2026-09-20: real mode mounts a separate API-only bracket component.
      Loading, empty, 401/403 and retryable error states never reach the mock
      branch. Omitted the unsupported count and store-derived manage button.
- [x] `/watch/:id` is store-only (`WatchPage.tsx:22`, `routeTour`). In real mode
      it answers "No such tournament" for every id — verified on `/watch/2`.
      Nothing links to it any more, because `watchable`
      (`TournamentPage.tsx:153`) is a store query that is always false in real
      mode, so the Watch button never renders. Either wire it to
      `GET /tournaments/:id/matches` or drop the route.
      Fixed 2026-09-20: the real-mode route now shows an explicit unavailable
      state without mounting prototype hooks. Watch navigation is mock-only;
      users can open the existing API-backed match pages from the bracket.
- [x] `/mvp/:id` is store-only (`MvpPage.tsx:20`) and this one is reachable:
      `champion` comes from the API first (`TournamentPage.tsx:150`), so a
      finished tournament shows "Vote MVP", and the page it opens answers "No
      such tournament" — verified on `/mvp/2`. The vote itself already has a
      hook (`useMvpVotes`); what is missing is the candidate list, which the
      page tallies from `m.stats` in the store. Hide the button in real mode
      until the tally can be read from the server.
      Fixed 2026-09-20: Vote MVP is mock-only; direct real-mode navigation shows
      an unavailable state before any prototype hooks mount. Champion fallback
      also no longer reads a store team in real mode.

### Verification of the 2026-09-20 boundary fixes

- [x] Added regression coverage for empty/error/loading bracket states, invalid
      IDs, stale prototype storage and unavailable MVP/Watch direct routes.
- [x] Developer verification passed (Node 24.21.0): 16 test files / 136 tests,
      lint, production build and `git diff --check`. The existing Vite bundle
      size warning remains. Ready for Frontend Tester.
- [ ] Frontend Tester: real-browser checks against a populated backend, including
      a tournament with approved teams but no matches and stale `ltms.v1` data.
      Component tests do not constitute real-backend/browser QA.

### Slice 2 — tournament page

- [x] A tournament opened by its numeric id shows no squads. `/t/t-fb` reads
      "Squads in 8 of 8", but the same tournament at `/t/402261` reads "0 of 8"
      and "No teams have been approved yet". The page content comes from the
      store while the approved-teams panel reads the fixture
      (`src/features/tournament/TournamentPage.tsx:36`). The panel's "View
      team" button (`TournamentPage.tsx:172`) links fixture team ids that
      aren't in the store. Slice 4's External referees tab now opens
      tournaments by their store id, so no current link leads here.
      Fixed by the API-only tournament path: numeric detail reads
      `GET /tournaments/:id` plus `GET /tournaments/:id/teams`, and team buttons
      keep the numeric backend IDs. The legacy store lookup is mock-only.

### Slices 1 and 4 — need an agreement

- [x] The follow state depends on the link format. `TeamPage.tsx:67` and
      `PlayerPage.tsx:82` (slice 4) build the follow key from the raw URL id,
      so a team followed at `/team/t-tit` shows "Follow this squad" at
      `/team/683878`. Slice 1 owns `follows` and has to agree which id the key
      uses. The change itself is in slice 4's files.
      Fixed 2026-09-21: team follows use the resolved numeric team ID in both
      alias routes; mock player follows use the resolved store user ID, while
      real player profiles already use the parsed backend user ID.

### Repository and process

- [x] Nothing checks a push to `feat/1`. `.github/workflows/frontend-ci.yml`
      runs only on pushes and pull requests to `frontend` and `main`, and
      `frontend` no longer exists on `origin` (gone by 2026-09-13). Work
      reaches `feat/1` by direct push, so no check runs and no slice owner sees
      changes to their files. Fixed 2026-09-20: added `feat/**` to push and PR
      triggers. Updated `.nvmrc` to 24.15.0, satisfying jsdom 30's Node engine
      requirement instead of the old 22.12.0 pin used by CI.
- [ ] Verify a hosted CI run after these workflow changes are pushed.
- [ ] Agree PR reviews by the slice owner and CODEOWNERS; workflow triggers
      alone do not enforce review or branch protection.
- [ ] The items in this plan have no owner. `PLAN.md` gives `features/team` to
      slice 4, but Priority 1 here assigns the team screens without naming
      one. Suggested: name the owner on each item.

## Definition of done for the currently available backend scope

- [x] Team, application, referee, and admin screens above use API hooks and
      numeric DTO IDs.
- [x] Every route reachable with `VITE_USE_MOCK=false` satisfies the Priority 4
      data-source boundary: backend data, an explicit unavailable state, or
      UI-only local state—never silent prototype/mock entity fallback.
- [ ] Search, Home, Profile, Inbox, Shell badges, and direct numeric detail
      routes have passed the Priority 4 clean-browser and stale-`ltms.v1`
      checks.
- [x] No new mutations have been added to `shared/store.ts`. Engagement mocks
      reuse the existing `getState`/`commitStore` adapter boundary rather than
      adding another store action or persistence source.
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
