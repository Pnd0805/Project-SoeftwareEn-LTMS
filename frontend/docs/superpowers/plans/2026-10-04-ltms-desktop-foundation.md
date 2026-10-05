# LTMS Desktop Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every desktop viewer a clearer navigation frame and give signed-in users a task-first Home backed by verified real-mode data.

**Architecture:** Keep the existing shell, route table, TanStack Query hooks, and domain ownership. Map each domain response into one small Home task shape, compose independent source states on Home, and reuse that renderer for mock data. Make the visual hierarchy and navigation consistent through existing shared tokens and components.

**Tech Stack:** React 19, TypeScript 6, React Router 7, TanStack Query 5, Vite 8, Vitest, Testing Library, existing CSS tokens and kit components.

**Spec:** `frontend/docs/superpowers/specs/2026-10-04-ltms-desktop-ux-ui-design.md` (first desktop phase only). The companion issue draft is `frontend/docs/superpowers/specs/2026-10-04-ltms-ux-ui-issue.md`.

## Execution status — 2026-10-04

Tasks 1–5 and Task 6's implementation and automated gates are complete. Checked RED steps refer to the implementation reports' recorded fail-first runs; the final verification reran the completed suite rather than recreating those failures.

Fresh final verification: `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`, `VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1 npx vitest run` (74 files / 446 tests), and `npm run build` all exited 0. The build emitted a bundle-size warning. Preview `http://127.0.0.1:5174/` returned HTTP 200. Review follow-ups add source-specific Retry names and `aria-current="page"`; their assertions pass in the full suite. The coordinator's earlier Impeccable detector result was `[]`.

Task 6 Step 5 remains pending. CUA refused Safari access and no browser surface was available, so the 1280 × 800 / 1440 × 900 walkthrough in both themes and per-role fixture acceptance was not completed. Automated focus tests and the recorded urgency-badge contrast calculations do not establish viewport acceptance. Do not claim this phase has full visual acceptance until that walkthrough is recorded.

Implementation remains uncommitted. Local coordinator records are in `.superpowers/sdd/2026-10-04-ltms-desktop-foundation/`.

## Global Constraints

- Change files under `frontend/` only. Coordinate edits to shared shell, styles, kit, routes, and query keys with the owners in `PLAN.md`.
- Node `>=20.19.0`; use the installed dependencies. Keep `src/shared/store.ts` and `src/shared/rules.ts` frozen except for an explicitly reviewed bug fix.
- Preserve the LTMS dark palette, green accent, logo, and street graffiti/sticker character. Keep both light and dark themes.
- Interface labels are short English text, usually one or two words when context names the object. One visually dominant action per context.
- Desktop first. At 1280 × 800 and 1440 × 900, major page titles, status, and primary actions are visible in the first viewport with no page-level horizontal overflow.
- Text contrast is at least 4.5:1 on its actual surface; navigation, forms, dialogs, and actions have visible keyboard focus.
- Real-mode tasks come only from verified server results and permissions. Keep mock data in the mock path, and treat backend authorization as final.
- Do not commit unless the user explicitly asks; `frontend/CLAUDE.md` says “Commit when asked, not before.”

## Review Focus

- A Guest or signed-out viewer must see Tournament discovery without an empty personal queue or private task requests (Task 5 test).
- An expired Team Invitation must not appear as an actionable task even if a stale response contains it (Task 2 test).
- Failure of one source must leave successful work visible and offer retry for the failed source (Task 5 test).
- A staff account without Admin scope must not fetch or see Admin tasks (Task 4 test).
- Long Tournament and Team names must wrap inside task cards without horizontal overflow at 1280 × 800 (Task 6 viewport check).

---

## File map

| File | Responsibility |
|---|---|
| `src/features/home/homeTasks.ts` | Home task types, mock adapter, source composition and ordering. No server calls. |
| `src/features/home/HomeTaskPanel.tsx` | Accessible task list and independent loading, empty, and error messages. |
| `src/features/home/RealHomeTasks.tsx` | Authenticated query orchestration; it consumes domain selectors and hands source snapshots to the panel. |
| `src/features/team/teamHomeTasks.ts` | Team Invitation and Team readiness mapping from backend DTOs. |
| `src/features/match/matchHomeTasks.ts` | Match actions from server-provided viewer capabilities. |
| `src/features/admin/refereeHomeTasks.ts` | Referee invitations and open assignment requests. |
| `src/features/tournament/tournamentHomeTasks.ts` | Organizer-owned private Tournament setup actions. |
| `src/features/admin/adminHomeTasks.ts` | Admin request actions, called only after capability confirmation. |
| `src/features/home/HomePage.tsx` | Task-first placement and Guest discovery branch. |
| `src/components/layout/Shell.tsx`, `src/components/layout/navSection.ts` | Role-aware navigation, active section, and parent navigation. |
| `src/styles/prototype.css` | Shared desktop spacing, hierarchy, task card, focus, and theme treatment. |
| `docs/superpowers/notes/2026-10-04-home-task-api-coverage.md` | Confirmed task sources, role coverage, and missing backend contracts. |

Tests live beside each changed module. Do not add a new state store or a second query layer. Existing `homeView.test.ts`, `Shell.admin.test.ts`, `BackendInbox.test.tsx`, and `realModeBoundary.test.tsx` are prior art.

### Task 1: Task-first Home with mock data

**Files:** Create `src/features/home/homeTasks.ts`, `src/features/home/homeTasks.test.ts`, `src/features/home/HomeTaskPanel.tsx`, `src/features/home/HomeTaskPanel.test.tsx`; modify `src/features/home/HomePage.tsx` and `src/styles/prototype.css`.

**Interfaces:** Produce `HomeTask = { key: string; source: 'team' | 'referee' | 'match' | 'tournament' | 'admin' | 'mock'; label: string; context: string; urgency: 'urgent' | 'waiting' | 'ready'; href: string; detail?: string }`, `HomeTaskFeed = { source: HomeTask['source']; state: 'loading' | 'ready' | 'failed'; tasks: HomeTask[]; retry: () => void }`, `composeHomeTasks(feeds: readonly HomeTaskFeed[]): { tasks: HomeTask[]; loading: boolean; failed: HomeTaskFeed[] }`, `mockHomeTasks(entries: readonly WorkEntry[]): HomeTask[]`, and `HomeTaskPanel({ feeds }: { feeds: readonly HomeTaskFeed[] })`.

- [x] **Step 1: Write failing tests.** In `homeTasks.test.ts`, assert that the mock adapter yields one direct-link card per nested work item, with a stable key and urgency, and that composition orders urgent, waiting, ready while removing duplicate keys. In `HomeTaskPanel.test.tsx`, assert clicking a card navigates to its `href` and the list is headed `Needs you`.

  ```ts
  expect(mockHomeTasks([entry]).map(t => t.href)).toEqual(['/m/12', '/m/13'])
  expect(composeHomeTasks([readyFeed, urgentFeed, duplicateUrgentFeed]).tasks.map(t => t.key))
    .toEqual(['match:12', 'team:4'])
  expect(screen.getByRole('heading', { name: 'Needs you' })).toBeInTheDocument()
  ```
- [x] **Step 2: Run focused tests and confirm the new exports are missing.** Run `cd frontend && npx vitest run src/features/home/homeTasks.test.ts src/features/home/HomeTaskPanel.test.tsx`; expect FAIL for missing modules or assertions.
- [x] **Step 3: Add the exact interfaces above and render individual task cards.** Flatten existing `workQueue(s)` entries only in mock mode; put the task panel before Tournament discovery. Use `Link` for direct destinations, not a severity picker. Keep existing Tournament browsing and filters below it.
- [x] **Step 4: Re-run the focused tests.** Same command; expect PASS.
- [x] **Step 5: Check the diff.** Run `git diff --check`; expect no whitespace errors. Keep changes uncommitted until requested.

### Task 2: Team work from real data

**Files:** Create `src/features/team/teamHomeTasks.ts`, `src/features/team/teamHomeTasks.test.ts`, `src/features/team/TeamsPage.invitation.test.tsx`, `src/features/home/RealHomeTasks.tsx`, `src/features/home/RealHomeTasks.test.tsx`; modify `src/features/home/HomePage.tsx`, `src/hooks/useTeam.ts`, `src/features/team/TeamsPage.tsx`.

**Interfaces:** Produce `teamHomeTasks(invites: readonly BackendMyInvitationDto[], teams: readonly BackendMyTeamDto[], now: Date): HomeTask[]`. `RealHomeTasks()` initially consumes `useBackendMyInvitations()` and `useBackendMyTeams()` and renders `HomeTaskPanel`. Later tasks extend its feeds.

- [x] **Step 1: Write failing tests.** Assert a valid Invitation becomes `Accept` with its Team name and `/teams` destination; an Invitation whose `expiresAt <= now` is absent; a `Forming` Team with `role: 'leader'` becomes `Complete team` linking to `/team/:id`; a member's Team does not become a management task. In rendered tests, assert real Home shows these cards without mock work and that a 403/409 answer at `/teams` shows the server message and invalidates the invitation source.

  ```ts
  expect(teamHomeTasks([validInvite, expiredInvite], [leaderTeam, memberTeam], now)
    .map(t => [t.label, t.href])).toEqual([['Accept', '/teams'], ['Complete team', '/team/7']])
  expect(screen.getByText('Invitation expired')).toBeInTheDocument()
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['teams', 'backend', 'invitations'] })
  ```
- [x] **Step 2: Run focused tests and confirm failure.** Run `cd frontend && VITE_USE_MOCK=false npx vitest run src/features/team/teamHomeTasks.test.ts src/features/team/TeamsPage.invitation.test.tsx src/features/home/RealHomeTasks.test.tsx`; expect FAIL before implementation.
- [x] **Step 3: Implement the mapper and authenticated real-mode branch.** Mount `RealHomeTasks` only for a known signed-in user. Convert independent query results into separate `HomeTaskFeed` values; retain the working feed if the other fails. Do not treat a pending query as empty. On a 403/409 Invitation answer, keep its error visible and invalidate `["teams", "backend", "invitations"]` so a stale Home card can refresh.
- [x] **Step 4: Re-run focused tests.** Same command; expect PASS.
- [x] **Step 5: Check the diff.** Run `git diff --check`; expect no whitespace errors. Keep changes uncommitted until requested.

### Task 3: Referee and Match work from real data

**Files:** Create `src/features/admin/refereeHomeTasks.ts`, `src/features/admin/refereeHomeTasks.test.ts`, `src/features/match/matchHomeTasks.ts`, `src/features/match/matchHomeTasks.test.ts`; modify `src/features/home/RealHomeTasks.tsx`.

**Interfaces:** Produce `refereeHomeTasks(invites: readonly MyRefereeInvitationDto[], incoming: readonly BackendRefereeRequestDto[]): HomeTask[]` and `matchHomeTasks(matches: readonly MatchListItemDto[]): HomeTask[]`. Consume `useMyRefereeInvitations()`, `useMyRefereeRequests()`, and `useMyMatches()` through their existing hooks.

- [x] **Step 1: Write failing tests.** Assert one Referee Invitation links to `/matches`; only an `open` incoming request links to `/inbox`; Match actions are emitted only for true `viewer.can` flags and point to `/m/:id` or `/checkin/:id`; a Match with no capability produces no task. Check duplicate Referee entries collapse by stable source and ID. Do not emit a Player self-check-in card because this list has no verified self-check-in capability field.

  ```ts
  expect(refereeHomeTasks([invitation], [openRequest, closedRequest]).map(t => t.href))
    .toEqual(['/matches', '/inbox'])
  expect(matchHomeTasks([canOpenCheckin, cannotAct]).map(t => t.href)).toEqual(['/checkin/9'])
  expect(matchHomeTasks([playerWithoutCapability])).toEqual([])
  ```
- [x] **Step 2: Run focused tests and confirm failure.** Run `cd frontend && VITE_USE_MOCK=false npx vitest run src/features/admin/refereeHomeTasks.test.ts src/features/match/matchHomeTasks.test.ts`; expect FAIL.
- [x] **Step 3: Implement the two selectors and add their feeds to `RealHomeTasks`.** Show short action labels (`Accept`, `Review`, `Open check-in`, `Record result`) with Match or Tournament context. Do not infer a permission from Match status when `viewer.can` is false or absent.
- [x] **Step 4: Re-run focused tests and the Home real-mode test.** Run `cd frontend && VITE_USE_MOCK=false npx vitest run src/features/admin/refereeHomeTasks.test.ts src/features/match/matchHomeTasks.test.ts src/features/home/RealHomeTasks.test.tsx`; expect PASS.
- [x] **Step 5: Check the diff.** Run `git diff --check`; expect no whitespace errors. Keep changes uncommitted until requested.

### Task 4: Organizer and Admin work from real data

**Files:** Create `src/features/tournament/tournamentHomeTasks.ts`, `src/features/tournament/tournamentHomeTasks.test.ts`, `src/features/admin/adminHomeTasks.ts`, `src/features/admin/adminHomeTasks.test.ts`; modify `src/features/home/RealHomeTasks.tsx`, `src/hooks/useAdmin.ts`.

**Interfaces:** Produce `tournamentHomeTasks(tournaments: readonly TournamentDto[]): HomeTask[]` and `adminHomeTasks(requests: readonly BackendPendingTournamentRequestDto[]): HomeTask[]`. Change `usePendingTournamentRequests(enabled = true)` so `enabled` is combined with its existing real-mode gate. Use `useMyTournaments()` and `useAdminAccess()` as the ownership and Admin-capability sources.

- [x] **Step 1: Write failing tests.** Assert only an owned `private` Tournament produces `Continue setup` linking to its management progress route; a `public` or `pending_approval` Tournament does not claim `Ready to publish`. Assert a pending Admin request yields `Review` with Tournament context. In `RealHomeTasks.test.tsx`, assert a staff account without Admin access does not fetch Admin requests or see an Admin task.

  ```ts
  expect(tournamentHomeTasks([privateTour, publicTour, pendingTour]).map(t => [t.label, t.href]))
    .toEqual([['Continue setup', '/t/6/manage/progress']])
  expect(adminHomeTasks([pendingRequest]).map(t => t.label)).toEqual(['Review'])
  expect(fetchAdminRequests).not.toHaveBeenCalled()
  ```
- [x] **Step 2: Run focused tests and confirm failure.** Run `cd frontend && VITE_USE_MOCK=false npx vitest run src/features/tournament/tournamentHomeTasks.test.ts src/features/admin/adminHomeTasks.test.ts src/features/home/RealHomeTasks.test.tsx`; expect FAIL.
- [x] **Step 3: Implement selectors and gate the Admin query.** The Admin feed runs only after `useAdminAccess()` returns true. An access error means no Admin card; it does not erase Team, Referee, Match, or Organizer work. Keep source query keys in their existing domain namespaces.
- [x] **Step 4: Re-run focused tests.** Same command; expect PASS.
- [x] **Step 5: Check the diff.** Run `git diff --check`; expect no whitespace errors. Keep changes uncommitted until requested.

### Task 5: Honest Home states and guest experience

**Files:** Modify `src/features/home/HomeTaskPanel.tsx`, `src/features/home/RealHomeTasks.tsx`, `src/features/home/HomePage.tsx`; create `src/features/home/HomePage.real.test.tsx`; add cases to `src/features/home/HomeTaskPanel.test.tsx` and `src/features/home/RealHomeTasks.test.tsx`.

**Interfaces:** Consume the Task 1 `HomeTaskFeed` and `composeHomeTasks` contracts. Each failed feed retains its `retry()` callback; the panel never rewrites a failed feed as an empty feed.

- [x] **Step 1: Write failing rendered tests.** Assert loading shows `Loading work…`; all-ready and empty shows `No tasks right now` plus a link to the Tournament section on Home; one failed feed and one ready feed shows the ready card plus `Some work could not load` and a `Retry` button calling only that feed's retry; an all-failed result does not claim there are no tasks; Guest Home has discovery first and never mounts `RealHomeTasks`.

  ```ts
  expect(screen.getByText('No tasks right now')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Browse tournaments' })).toHaveAttribute('href', '#tournaments')
  expect(screen.getByText('Some work could not load')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Accept/ })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Retry team tasks' }))
  expect(failedFeed.retry).toHaveBeenCalledOnce()
  ```
- [x] **Step 2: Run focused tests and confirm failure.** Run `cd frontend && npx vitest run src/features/home/HomeTaskPanel.test.tsx src/features/home/RealHomeTasks.test.tsx src/features/home/HomePage.real.test.tsx`; expect FAIL.
- [x] **Step 3: Add these states and short copy.** Keep independent query states and direct links. Verify that the Invitation 403/409 path from Task 2 displays its server message at the destination and refreshes that source; record any other destination gaps for their role-journey plans instead of guessing an action on Home.
- [x] **Step 4: Re-run focused tests.** Same command; expect PASS.
- [x] **Step 5: Check the diff.** Run `git diff --check`; expect no whitespace errors. Keep changes uncommitted until requested.

### Task 6: Stable desktop navigation and visual acceptance

**Files:** Create `src/components/layout/navSection.ts`, `src/components/layout/navSection.test.ts`; modify `src/components/layout/Shell.tsx`, `src/styles/prototype.css`, `src/features/home/HomePage.tsx`; create `docs/superpowers/notes/2026-10-04-home-task-api-coverage.md`.

**Interfaces:** Produce `navSection(pathname: string): '/' | '/teams' | '/matches' | '/inbox' | '/me' | '/admin' | null`. Shell uses it for active navigation; existing detail-page `Crumb` components continue to own their context-specific parent links.

- [x] **Step 1: Write failing navigation tests.** Assert `/team/7` selects Teams, `/m/9` and `/checkin/9` select Matches, `/t/2` selects Tournaments, `/admin/requests` selects Admin, and unrelated paths return null. Extend the Shell role test to assert keyboard focus reaches nav, search, bell, profile, and the skip control.

  ```ts
  expect(navSection('/team/7')).toBe('/teams')
  expect(navSection('/m/9')).toBe('/matches')
  expect(navSection('/checkin/9')).toBe('/matches')
  expect(navSection('/t/2')).toBe('/')
  expect(navSection('/admin/requests')).toBe('/admin')
  expect(navSection('/unknown')).toBeNull()
  await user.tab()
  expect(screen.getByRole('button', { name: /Skip to the main content/ })).toHaveFocus()
  ```
- [x] **Step 2: Run focused tests and confirm failure.** Run `cd frontend && npx vitest run src/components/layout/navSection.test.ts src/components/layout/Shell.profile.test.tsx`; expect FAIL.
- [x] **Step 3: Implement route mapping and desktop visual rules.** Preserve the logo, green accent, hard outlines, and sticker character. Give the task panel the strongest hierarchy, quieten repeated Tournament rows, keep one main action in the Home header, and use existing theme tokens. Record a coverage table for each role and source: endpoint, permitted task rule, destination, and missing contract where the backend cannot confirm actionability.
- [x] **Step 4: Run focused tests and full frontend gates.** Run `cd frontend && npx tsc --noEmit -p tsconfig.app.json && npm run lint && npx vitest run && npm run build`; expect all commands to exit 0. Use `VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1` for the real-mode test run if the local env defaults to mock.
- [ ] **Step 5: Inspect both desktop sizes and themes.** At 1280 × 800 and 1440 × 900, walk one task per available role fixture. Verify title, status, and action in the first viewport, keyboard focus, no page-level overflow or clipped long names, and 4.5:1 text contrast on actual surfaces. Record any API gap in the coverage note, not as a fictional task.
- [x] **Step 6: Check the diff.** Run `git diff --check` and `git status --short`; expect no whitespace errors and only intended frontend changes. Keep changes uncommitted until requested.

## Scope handoff

This plan implements the shared desktop foundation and task-first Home. The Guest/Player/Team Leader, Organizer/Referee, Admin, and mobile journey phases remain separate plans because their forms, decisions, and acceptance paths are independent subsystems. Carry the shared copy, state, focus, and token conventions from this phase into those plans. Do not implement the later phases from this document alone.
