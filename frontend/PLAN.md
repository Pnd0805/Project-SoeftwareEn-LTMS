# LTMS Frontend Build Plan (4 people) — v2

Rewritten 2026-08-31 against the code at `ea7eec8`. The v1 plan (2026-08-29) was written before
the prototype port landed and no longer matches the repo — see "What changed" below.

Source of truth: `ltms-prototype.html` (77 screens), `FRONTEND-SPEC.md`, `CONTEXT.md`, `../schema.sql`.

---

## What changed since v1

| v1 said | Repo actually has |
|---|---|
| TanStack Router | `react-router-dom` v7, routes in `src/App.tsx` |
| MSW mock handlers | No MSW. Two mock systems: `shared/seed.ts` (prototype) and `src/mocks/*` (API layer) |
| Vitest + Testing Library | Neither installed |
| `src/shared/` = Zod schemas + API client, owned by Person 1 | `src/shared/` = `store.ts` / `rules.ts` / `selectors.ts` / `types.ts`, ported from the prototype. Zod lives in `src/schemas/` (orphaned) |
| Phase 1 = each person builds their screens | **Screens are already built.** 37 files, 4,971 lines under `src/features/` |

v1 is not wrong about intent. It is wrong about state. The build is further along than it describes,
and the remaining work is a different shape.

## Decisions carried over from v1 — unchanged, still binding

Rewriting the plan against the code dropped these on the first pass. They are v1's calls, they still
hold, and they are restated here so the rewrite does not quietly repeal them:

- **Client state**: plain React (`useState` / context) plus URL search params for anything shareable —
  filters, tabs, the open row. **No Zustand, no Redux.** Add a store only when a cross-cutting case
  actually demands one, and say so in a PR before you do.
- **Forms**: React Hook Form + Zod, reusing the schemas rather than re-declaring validation in the
  component. Both are already dependencies.
- **Repo structure**: one Vite app, folder-separated (`src/shared`, `src/features/*`). No pnpm
  workspace, no monorepo — four people do not need package-boundary overhead.
- **Naming**: `CONTEXT.md` is the glossary and it wins. An entity is a Tournament, an Organizer, a
  Squad list, a Lineup — including in DTO field names and query keys. `shared/types.ts` was written
  against that glossary; keep new types on it.

### Two stack claims from v1 that the code does not honour

Both need a decision, not a silent drift:

- **shadcn/ui.** v1 names it in the stack. `@/components/ui/` holds seven generated components and
  **`src/` imports none of them** — the app renders through the hand-built `components/kit/` against
  `styles/prototype.css`, which is what `FRONTEND-SPEC.md` describes. Either adopt shadcn deliberately
  or drop the folder, `components.json`, and the unused deps. Leaving it is what produces two of the
  five standing lint errors.
- **React Hook Form.** Installed, along with `@hookform/resolvers` and Zod — and **imported by zero
  files.** The forms that exist (`match/ResultForm.tsx`, `tournament/RegisterForm.tsx`) are
  hand-rolled. Migrating a write screen is the moment to settle this; the migration steps below assume
  RHF + Zod, per v1.

---

## The actual situation: two stacks

**Stack A — the prototype port. This is what runs today.**
`src/shared/store.ts` (623 lines) holds all application state in one module-level object plus ~50
mutation functions. `src/features/*` reads it through `useLtms()` and calls those functions directly.
No network, no async, no server.

**Stack B — the real API layer. Built, but nothing consumes it.**
`src/api/*` + `src/hooks/use*.ts` + `src/types/dto.ts`, switched by `VITE_USE_MOCK`. Covers Auth,
Users, Reference (Person 1) and Match/Results/Standings (Person 3). Zero components import it yet.

**The remaining work is migrating A → B, one domain at a time.** Not building screens. The screens
exist and look right; they are wired to the wrong thing.

This reframing matters because it also solves the ownership problem below.

---

## Why v1's work split collides

v1 splits by user flow, which is correct. But the ported code is a monolith, so every person's domain
logic sits in the same two files — both nominally owned by Person 1:

**`src/shared/store.ts` — 623 lines, every domain**

| Lines | Functions | Belongs to |
|---|---|---|
| 46–75 | `useLtms` `getState` `resetDemo` `toast` `useToasts` | Person 1 (infra) |
| 93–103 | `GUEST` `login` `continueAsGuest` `signout` | Person 1 |
| 109–182 | `createTeam` `invitePlayer` `answerInvite` `rosterLock` `kickPlayer` `transferLeader` `disbandTeam` `requestPermanent` | **nobody in v1** |
| 192–251 | `registerSquad` `approveRegistration` `rejectRegistration` `approveAll` `requestWithdraw` `allowWithdraw` | Person 2 |
| 263–298 | `requestTournament` `publishTournament` `saveEntryNotes` `requestFilterChange` | Person 2 |
| 274–357 | `decideTournament` `decideFilterChange` `decidePermanent` `appointReferee` `answerAppointment` `removeReferee` | Person 4 |
| 369 | `drawBracket` | Person 2 |
| 430–551 | `saveFixture` `enterResult` `confirmResult` `disputeResult` `resolveDispute` `reopenResult` `saveReplay` `saveLineup` `checkIn` `markIneligible` `setRoomCode` | Person 3 |
| 560–609 | `postComment` `removeComment` `postAnnouncement` `placePick` `voteMvp` `sendFeedback` `toggleFollow` | **nobody in v1 — and not one slice, see below** |
| 616–620 | `markAllRead` `markRead` | Person 1 |

**"Engagement" is not a vertical slice.** Those seven functions render inside five screens owned by
three different people. Assigning them as a bundle recreates the collision this plan exists to remove:

| Function | Lives in | Owned by |
|---|---|---|
| `postComment` `removeComment` `placePick` | `features/match/SocialBar.tsx` | Person 1 |
| `voteMvp` | `features/mvp/MvpPage.tsx` | Person 1 |
| `toggleFollow` | `player/` + `team/` + `tournament/LeaderboardTab.tsx` | Person 1 |
| `postAnnouncement` | `features/tournament/AnnouncementsTab.tsx` | Person 2 |
| `sendFeedback` | `features/tournament/CommunityTab.tsx` | Person 2 |

Rule: **engagement that follows the user goes to Person 1; engagement that belongs to a tournament
stays with Person 2.** The files that carry the first group — `SocialBar.tsx`, `mvp/`, `watch/` —
move to Person 1 with the functions, so view and data stay together. See the work split below.

**`src/shared/rules.ts` — 524 lines, three domains**
Person 3 owns 13 functions (`standings` `leaderboard` `BoardRow` `winnerId` `teamTotals` `lineupOf`
`allCheckedIn` `qrToken` …). Person 2 owns 4 (`buildBracket` `buildSingle` `buildDouble`
`buildRoundRobin`). Person 1 owns the file.

**15 functions have no owner.** Team lifecycle (8) and Engagement (7) were never assigned, even though
`TeamsPage.tsx` (308 lines) is the largest feature file in the repo.

---

## The rule that dissolves the collision

> **`shared/store.ts` and `shared/rules.ts` are frozen. No new logic goes in. Each domain migrates
> out into its own `api/` + `hooks/` pair, and deletes what it replaced.**

Nobody has to negotiate for edit rights on a file they all need, because the file stops growing and
starts shrinking. Every migration is additive (new files, nobody else's) plus one small deletion at
the end. Conflicts drop to the deletion, which is a few lines and easy to resolve.

Edits to the frozen files are allowed only for genuine bug fixes, and only after telling Person 1.

**Migration template** — Person 3's Match slice is the worked example, copy its shape:

```
src/types/<domain>.dto.ts     DTOs derived from schema.sql, camelCase, one owner
src/mocks/<domain>.mock.ts    fixtures covering every status the UI must render
src/api/<domain>.ts           USE_MOCK switch inside each function, same as api/auth.ts
src/hooks/use<Domain>.ts      TanStack Query, query keys namespaced to the domain
src/schemas/<domain>.schema.ts  Zod, for the write screens — mirrors the backend's rules
```

`src/schemas/auth.schema.ts` is the shape to copy for the last one: Thai error messages per NF-US-03,
validation copied from the backend rather than invented, and a deliberate note about which rules must
*not* be duplicated client-side (a login form never re-checks password length, or everyone who
registered before the rule changed is locked out).

Then rewrite your feature components to call the hooks instead of `useLtms()` + store functions,
and delete the store functions you replaced.

**Query key namespaces** — claim these, never read or invalidate outside your own:

| Person | Namespaces |
|---|---|
| 1 | `me` `auth` `faculties` `departments` `sportTypes` `notifications` `follows` `picks` `votes` `rewards` `points` |
| 2 | `tournament` `tournaments` `bracket` `registrations` `announcements` `feedback` |
| 3 | `match` `matches` `standings` `checkins` |
| 4 | `admin` `organizer` `referees` `team` `teams` `audit` |

**DTOs stay in per-domain files.** `src/types/dto.ts` carries a note forbidding invented fields for
endpoints not yet in GUIDE/06. Adding to it also conflicts with everyone. Use
`src/types/<domain>.dto.ts` and reconcile once, later, when GUIDE/06 arrives.

**`src/App.tsx` holds every route.** Touch only your own lines, and commit that change on its own so
the conflict is trivial.

---

## Work split v2

Same vertical-slice principle as v1, with the gaps assigned.

| Person | Owns | Feature dirs / files | Routes |
|---|---|---|---|
| 1 | Auth · Home · Nav shell · Search · Inbox · Profile · **Engagement** | `auth` `home` `search` `inbox` `profile` `mvp` `watch` + `match/SocialBar.tsx` | `/login` `/` `/home/:tab` `/search` `/search/:q` `/inbox` `/me` `/mvp/:id` `/watch/:id` |
| 2 | Tournament · Bracket · Draw · Registration | `tournament` minus `LeaderboardTab` `ScheduleTab` `manage/RefereePanel` | `/t/:id` `/t/:id/:tab` `/t/:id/:tab/:sub` |
| 3 | Match · Results · Standings · Check-in | `match` (minus `SocialBar`) `matches` `checkin` + `tournament/LeaderboardTab.tsx` `tournament/ScheduleTab.tsx` | `/matches` `/m/:id` `/m/:id/:tab` `/m/:id/fixture` `/checkin/:id` |
| 4 | **Teams** · Admin · Organizer approval · Referee mgmt | `team` `admin` `request` `player` + `tournament/manage/RefereePanel.tsx` | `/teams` `/team/:id` `/admin` `/admin/:tab` `/request` `/player/:id` |

### Why these five files moved

Balance alone is not a reason to move a file. Each of these moves puts a view in the same hands as the
data behind it — the point of a vertical slice:

| File | Lines | From → To | Reason |
|---|---|---|---|
| `tournament/LeaderboardTab.tsx` | 138 | 2 → 3 | Renders `standings()` / `leaderboard()` off `tournament_standings`. That logic and that table are Person 3's; the view was separated from its data. |
| `tournament/ScheduleTab.tsx` | 58 | 2 → 3 | Renders fixtures straight out of `matches`. Same reason. |
| `tournament/manage/RefereePanel.tsx` | 107 | 2 → 4 | The split already gives Person 4 referee management. The file was simply filed under the wrong directory. |
| `match/SocialBar.tsx` | 173 | 3 → 1 | Comments and Pick'em, not match logic. Already a standalone component — `MatchPage` renders `<SocialBar matchId={…} />` and nothing else changes. |
| `mvp/` + `watch/` | 204 | 4 → 1 | MVP voting and livestream viewing are engagement, not team or admin work. |

**The engagement line:** engagement that follows the **user** — picks, votes, follows, points, rewards —
is Person 1. Engagement that belongs to a **tournament** — announcements, Q&A, organizer feedback —
stays with Person 2 in `AnnouncementsTab` and `CommunityTab`. That is why `postAnnouncement` and
`sendFeedback` do not move.

### Measured load after rebalancing

| Person | Feature lines | Store fns to migrate | DB tables |
|---|---|---|---|
| 1 | 1,104 | 11 | 11 |
| 2 | 1,273 | 13 | 8 |
| 4 | 1,176 | 14 | 9 |
| 3 | 1,418 | 11 | 8 |

Total 4,971 lines · 54 functions · 36 tables. Spread on lines is now 1,104–1,418 (±14% around the
mean) against 727–1,576 before. Function and table counts land within three of each other.

Person 3 is highest on lines and lowest on remaining work, because Person 3's API layer is already
built — treat that column as roughly one slice of credit already spent.

**On Person 1 and `src/shared/`:** the earlier draft argued Person 1 should stay light because they
own the shared layer. That holds only through phase 0. Once `store.ts` and `rules.ts` are frozen,
owning them is gatekeeping and deletion, not construction — so Person 1 picks up Engagement
**after phase 0 lands**, not before.

Everyone else treats `src/shared/`, `src/components/kit/`, `src/components/layout/Shell.tsx`, and
`src/api/client.ts` as read-only.

### Cross-cutting files — Person 1 owns, others request changes

These sit in one person's folder but are consumed by several. They are not up for grabs; open a
request to Person 1 instead of editing:

| File | Lines | Consumed by |
|---|---|---|
| `shared/selectors.ts` | 82 | everyone |
| `shared/career.ts` | 108 | `player/` `profile/` `team/` — Persons 1 and 4 |
| `components/kit/primitives.tsx` | 190 | everyone |
| `components/kit/Scorebug.tsx` | 99 | `match/` (P3) and `watch/` (P1) |
| `components/kit/chips.tsx` | 74 | everyone |
| `components/kit/viewModels.ts` | 55 | everyone |

**The kit rule is now narrower than "ask before touching".** Since the split, each of those kit files
has two layers, and they are governed differently:

- the **view layer** (`TeamChipView`, `TeamLinkView`, `PlayerLinkView`, `TeamMarkView`,
  `ScorebugView`, `MatchStateBadge`) is the shared contract — use it freely from any slice with your
  own data, no permission needed. That is what it was built for.
- the **store-backed layer** (`TeamChip`, `TeamLink`, `PlayerLink`, `TeamMark`, `Scorebug`,
  `StatusBadge`) and `viewModels.ts` stay Person 1's. Changing a prop there breaks every caller, so
  ask first.

`toggleFollow` is no longer on this list — it moved into Person 1's Engagement slice along with the
screens that call it, which is what made it cross-cutting in the first place.

### `features/home/workQueue.ts` needs its own rule

138 lines, sitting in Person 1's folder, aggregating pending work from **every** domain — tournament
approvals, match results, team requests. As written, every migration forces an edit to it, which
serialises the whole team through one file.

Split it the same way as `store.ts`: **each person exports a `pending*()` selector from their own
domain's hooks, and `workQueue.ts` only composes them.** Person 1 owns the composition; each person
owns their own contribution. Do this in phase 0, before the first migration.

---

## Phase 0 — clear the ground (whole team, half a day, do this first)

Items marked ✅ are done on `chore/frontend-foundation`.

**✅ Delete the dead island.** Nothing outside these paths imported them; they only imported each
other. 14 files, 508 lines:

```
src/pages/                        7 files,  85 lines
src/components/admin/             1 file,   74 lines
src/components/teams/             1 file,  108 lines
src/components/tournaments/       3 files, 117 lines
src/components/layout/AppShell.tsx         82 lines
src/components/auth/RoleSelector.tsx       42 lines
```

This was urgent, not cosmetic: seven filenames existed in **both** the old and new locations —
`AdminPage` `HomePage` `InboxPage` `MatchesPage` `ProfilePage` `TeamsPage` `TournamentCard`.

`src/schemas/auth.schema.ts` is **not** on this list. An earlier draft had it there, wrongly: it is
Person 1's deliberate unwired work mirroring GUIDE/04 §6, the same category as `hooks/useMatch.ts` —
built ahead of its consumer, not left behind by one. Unwired is not dead.

**✅ Split the kit components so they stop reaching into the store.** This was the real blocker, and
it was not in the first draft of this plan. `chips.tsx` and `Scorebug.tsx` took an id and looked the
entity up via `useLtms()` themselves — so no screen could render API-sourced data until Teams had
migrated, which blocked all three other slices behind Person 4.

Both files now have two layers:

- `TeamChipView` `TeamLinkView` `PlayerLinkView` `TeamMarkView` `ScorebugView` `MatchStateBadge` —
  take data as props, never touch the store
- `TeamChip` `TeamLink` `PlayerLink` `TeamMark` `Scorebug` `StatusBadge` — unchanged signatures that
  look up the store and delegate to the view layer

**No existing caller changed.** `src/components/kit/viewModels.ts` holds the shared shapes
(`TeamView`, `PlayerView`, `MatchState`) and the converters from the prototype types.

`MatchState` also reconciles the two status models: prototype `pending`/`confirmed`/`void` against
schema `checkin_open`/`in_progress`/`completed`. Prototype `pending` is really a *result* status
(`match_results.status='submitted'`), not a match status — the common vocabulary covers both, and
each side maps into it at its own edge.

**✅ Install the test tooling v1 promised:** Vitest + Testing Library + jsdom, config in
`vite.config.ts`, setup in `src/test/setup.ts`, scripts `npm test` / `npm run test:watch`. Tests live
next to what they test, so each slice owner writes their own. `chips.test.tsx` is the worked example —
it renders the view layer with no provider at all, so it fails the moment anyone puts `useLtms()`
back into the pure layer.

**✅ Fix `vite.config.ts`** — `__dirname` → `import.meta.dirname`.

**Split `workQueue.ts` into per-domain contributions** (see the rule above) so migrations stop
serialising through it. Not done — it needs all four owners to agree what each contributes.

**Agree the namespace table and the cross-cutting list above.** Still the phase-0 deliverable that
matters most, and the only one that cannot be done by one person.

### Lint debt

`npx eslint .` reports 5 pre-existing errors, none introduced by the foundation work:
`@/components/ui/badge.tsx`, `@/components/ui/button.tsx` (shadcn scaffolding),
`src/api/user.ts:27` (unused var), `src/features/tournament/CommunityTab.tsx:17` (fast-refresh),
`src/shared/seed.ts:242` (`prefer-const`). All trivial, all in different owners' files — worth
clearing before anyone wires lint into CI.

---

## Phase 1 — migrate, in this order, per person

Read paths before write paths. A read-only screen that renders live data proves the whole chain works
and cannot corrupt anything when it is wrong.

1. **DTO + mock + api + hooks** for your domain — four new files, touches nobody
2. **One read-only screen** wired to a query hook — proves the chain
3. **Remaining read screens**
4. **Write screens** — React Hook Form + Zod against your domain schema, mutations, error states.
   Field-level errors come back from the API in `ApiErrorBody.fields`; feed them to the form rather
   than showing a banner
5. **Delete the store functions you replaced**, and the `rules.ts` helpers only your domain used

Person 3's Match slice is at step 1 complete (`match.dto.ts`, `match.mock.ts`, `api/match.ts`,
`hooks/useMatch.ts`, 16 endpoints, `tsc -b` clean). Use it as the reference for the other three.

Write Vitest tests for your own slice as you go. No shared test infrastructure beyond phase 0 config.

---

## Phase 2 — integration (whole team)

- Walk every user story end to end: guest → player → team leader → referee → organizer → admin
- Reconcile the per-domain DTO files into `src/types/dto.ts` once GUIDE/06 is available
- `shared/store.ts` should be close to empty; delete what remains of it and `shared/seed.ts`
- Flip `VITE_USE_MOCK=false` per hook as backend endpoints land — no big-bang cutover

---

## Open decisions — nobody can settle these alone

1. **GUIDE/04 and GUIDE/06 are not in the repo.** Code references them constantly
   (`api/auth.ts`, `types/dto.ts`, `schema.sql`). Only four endpoint codes are recoverable, from
   comments in `schema.sql`: `T09/T12/T13`, `C08`, `E12`, `S01`. Every other path in `src/api/` is
   inferred and marked `TODO(guide)`. **Whoever has these files, commit them.**

2. **`tournament_standings` cannot feed the standings UI.** The table stores `played/won/lost/points`.
   `BoardRow` in `rules.ts` ranks round-robin by goal difference, then goals for, then a mini-table,
   and renders recent form. Decide: backend computes and sends the extra columns, or frontend derives
   them from the match list. Blocks Person 3's final step.

3. **`matches` has no `livestream_url` column.** `schema.sql:365` notes this against itself — `E12`
   cannot work until the schema adds it. Same class of gap: `team_invitations.expires_at` (T09/T12/T13)
   and `tournaments.description` (C08).

4. **Two mock systems will drift.** `shared/seed.ts` (prototype shapes, string ids) and `src/mocks/*`
   (API shapes, numeric ids) describe the same tournament with different data. Acceptable during
   migration; delete `seed.ts` with `store.ts` in phase 2.
