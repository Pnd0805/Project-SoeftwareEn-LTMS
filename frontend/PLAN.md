# LTMS Frontend — Working Plan

Operating document for four developers and their AI assistants. Everything here is verified against
the tree; if a fact below contradicts the code, the code wins and this file is wrong — fix it.

**The task**: every screen is already built and renders from an in-memory store ported from the
prototype. The remaining work is moving each domain off that store onto a real API layer, one domain
at a time. Not building screens.

Reference: `CONTEXT.md` (glossary) · `FRONTEND-SPEC.md` (77 screens) · `../schema.sql` (36 tables) ·
`ltms-prototype.html` (visual target).

---

## Stack — what the code actually uses

| Concern | Use | Notes |
|---|---|---|
| Build | Vite 8 + TypeScript | Node **20.19+** required, see `.nvmrc` |
| Routing | `react-router-dom` v7 | all routes in `src/App.tsx` |
| Server state | TanStack Query | via `src/hooks/use*.ts` only |
| Client state | `useState` / context + URL search params | **no Zustand, no Redux** — anything shareable (filters, tabs, open row) goes in the URL |
| Forms | React Hook Form + Zod | installed; currently imported by 0 files — first write-screen migration adopts it |
| Validation | Zod in `src/schemas/` | mirror backend rules, never invent client-only ones |
| Styling | Tailwind v4 + `src/styles/prototype.css` + hand-built `src/components/kit/` | **not shadcn** — `@/components/ui/` exists but `src/` imports none of it |
| Test | Vitest + Testing Library | `npm test` |
| Repo | one Vite app, folder-separated | no monorepo |

**Naming**: `CONTEXT.md` is the glossary and wins — Tournament, Organizer, Squad list, Lineup, Hard
filter. Applies to DTO fields and query keys too.

---

## Ownership

Four slices. Work only inside yours; for anything else, open a request to its owner.

| # | Domain | Feature paths | Routes | Query-key namespaces |
|---|---|---|---|---|
| **1** | Auth · Home · Nav shell · Search · Inbox · Profile · Engagement | `features/auth` `features/home` `features/search` `features/inbox` `features/profile` `features/mvp` `features/watch` `features/match/SocialBar.tsx` | `/login` `/` `/home/:tab` `/search` `/search/:q` `/inbox` `/me` `/mvp/:id` `/watch/:id` | `me` `auth` `faculties` `departments` `sportTypes` `notifications` `follows` `picks` `votes` `rewards` `points` |
| **2** | Tournament · Bracket · Draw · Registration | `features/tournament/**` **except** `LeaderboardTab.tsx` `ScheduleTab.tsx` `manage/RefereePanel.tsx` | `/t/:id` `/t/:id/:tab` `/t/:id/:tab/:sub` | `tournament` `tournaments` `bracket` `registrations` `announcements` `feedback` |
| **3** | Match · Results · Standings · Check-in | `features/match/**` (minus `SocialBar.tsx`) `features/matches` `features/checkin` `features/tournament/LeaderboardTab.tsx` `features/tournament/ScheduleTab.tsx` | `/matches` `/m/:id` `/m/:id/:tab` `/m/:id/fixture` `/checkin/:id` | `match` `matches` `standings` `checkins` |
| **4** | Teams · Admin · Organizer approval · Referee management | `features/team` `features/admin` `features/request` `features/player` `features/tournament/manage/RefereePanel.tsx` | `/teams` `/team/:id` `/admin` `/admin/:tab` `/request` `/player/:id` | `admin` `organizer` `referees` `team` `teams` `audit` |

Person 1 additionally owns `src/shared/`, `src/components/kit/`, `src/components/layout/Shell.tsx`,
`src/api/client.ts`.

*Two screens sit in another slice's folder on purpose: `LeaderboardTab` and `ScheduleTab` render
`tournament_standings` and `matches`, which belong to slice 3. A view belongs with its data.*

### Never read or invalidate a query key outside your namespace

Cache cleared across domains is untraceable — nobody can tell which slice did it.

### Store functions, by owner

`src/shared/store.ts` holds every domain's mutations. When you migrate a domain, you delete its rows here.

| Owner | Functions |
|---|---|
| — (infra, dissolves into TanStack Query) | `useLtms` `getState` `resetDemo` `toast` `useToasts` |
| **1** | `GUEST` `login` `continueAsGuest` `signout` `markAllRead` `markRead` `postComment` `removeComment` `placePick` `voteMvp` `toggleFollow` |
| **2** | `registerSquad` `approveRegistration` `rejectRegistration` `approveAll` `requestWithdraw` `allowWithdraw` `requestTournament` `publishTournament` `saveEntryNotes` `requestFilterChange` `drawBracket` `postAnnouncement` `sendFeedback` |
| **3** | `saveFixture` `enterResult` `confirmResult` `disputeResult` `resolveDispute` `reopenResult` `saveReplay` `saveLineup` `checkIn` `markIneligible` `setRoomCode` |
| **4** | `createTeam` `invitePlayer` `answerInvite` `rosterLock` `kickPlayer` `transferLeader` `disbandTeam` `requestPermanent` `decideTournament` `decideFilterChange` `decidePermanent` `appointReferee` `answerAppointment` `removeReferee` |

*Engagement follows the user (picks, votes, follows, points) → slice 1. Engagement that belongs to a
tournament (announcements, Q&A, organizer feedback) → slice 2.*

`src/shared/rules.ts` splits the same way: slice 3 owns `standings` `leaderboard` `BoardRow`
`winnerId` `winnerOf` `isLevel` `wonBy` `nextOf` `feedersOf` `teamTotals` `lineupOf` `startersOf`
`allCheckedIn` `qrToken` `disputeName`. Slice 2 owns `buildBracket` `buildSingle` `buildDouble`
`buildRoundRobin`. Person 1 owns the file and everything else in it.

### Database tables, by owner

| Owner | Tables in `../schema.sql` |
|---|---|
| **1** | `users` `password_reset_tokens` `faculties` `departments` `sport_types` `notifications` `follows` `pickem_predictions` `rewards` `user_rewards` `point_transactions` |
| **2** | `tournaments` `tournament_eligibility_rules` `tournament_amendment_requests` `tournament_applications` `bracket_nodes` `announcements` `tournament_questions` `tournament_feedback` |
| **3** | `matches` `match_results` `match_checkins` `match_referees` `tournament_standings` `player_match_stats` `player_match_stat_values` `sport_stat_definitions` |
| **4** | `teams` `team_members` `team_invitations` `team_admin_requests` `player_profile_stats` `official_team_memberships` `tournament_referees` `admin_scopes` `audit_logs` |

---

## Rules

### 1. `src/shared/store.ts` and `src/shared/rules.ts` are frozen

No new logic goes in either file. Each domain migrates out into its own `api/` + `hooks/` pair and
deletes what it replaced. Bug fixes only, and tell Person 1 first.

*This is what keeps four people out of each other's way: the shared file stops growing and starts
shrinking, so every migration is new files plus a small deletion instead of a contested edit.*

### 2. `src/components/kit/` has two layers, governed differently

| Layer | Components | Rule |
|---|---|---|
| **View** — data in, no store | `TeamChipView` `TeamLinkView` `PlayerLinkView` `TeamMarkView` `ScorebugView` `MatchStateBadge` | Use freely from any slice with your own DTOs. No permission needed. |
| **Store-backed** — id in, looks up `useLtms()` | `TeamChip` `TeamLink` `PlayerLink` `TeamMark` `Scorebug` `StatusBadge` | Person 1's. Changing a prop breaks every caller — ask first. |

Shared shapes and prototype converters live in `src/components/kit/viewModels.ts` (`TeamView`,
`PlayerView`, `MatchState`, `toTeamView`, `matchState`). Also Person 1's.

`MatchState` is the common status vocabulary: `bye` `confirmed` `disputed` `pending` `checkin` `live`
`scheduled` `waiting`. The prototype and the schema disagree — prototype has
`pending`/`confirmed`/`void`, schema has `checkin_open`/`in_progress`/`completed`, and prototype
`pending` is really a *result* status (`match_results.status='submitted'`). Map into `MatchState` at
your own edge.

### 3. Per-domain DTO files, never `src/types/dto.ts`

`dto.ts` is Person 1's and forbids fields for endpoints not yet in `GUIDE/06`. Use
`src/types/<domain>.dto.ts`. Reconcile once, later.

### 4. `src/App.tsx` holds every route

Touch only your own lines, and commit that change on its own.

### 5. Cross-cutting files — Person 1 owns, others request

`shared/selectors.ts` (82) · `shared/career.ts` (108) · `components/kit/primitives.tsx` (190) ·
`components/kit/Scorebug.tsx` (99) · `components/kit/chips.tsx` (74) ·
`components/kit/viewModels.ts` (55)

`features/home/workQueue.ts` (138) is the exception that still needs fixing — it aggregates pending
work from every domain, so as written each migration forces an edit and serialises the whole team
through one file. **Fix**: each slice exports a `pending*()` selector from its own hooks;
`workQueue.ts` only composes them. Needs all four owners to agree. Not done.

---

## How to migrate a domain

Slice 3's Match work is the reference implementation — copy its shape.

### Files to create

```
src/types/<domain>.dto.ts       DTOs derived from schema.sql, camelCase, one owner
src/mocks/<domain>.mock.ts      fixtures covering every status the UI must render
src/api/<domain>.ts             USE_MOCK switch inside each function, pattern of api/auth.ts
src/hooks/use<Domain>.ts        TanStack Query, keys in your namespace
src/schemas/<domain>.schema.ts  Zod for write screens, shape of auth.schema.ts
```

### Order of work

Read paths before write paths. A read-only screen proves the chain and cannot corrupt anything.

1. The five files above — touches nobody
2. One read-only screen wired to a query hook
3. Remaining read screens
4. Write screens — RHF + Zod, mutations, error states. Field errors arrive in
   `ApiErrorBody.fields`; feed them to the form rather than showing a banner
5. Delete the store functions you replaced, plus any `rules.ts` helper only your domain used

### Conventions

- Endpoint paths not confirmed by `GUIDE/06` get a `TODO(guide)` comment. Set hook signatures by
  **use case, not URL**, so a path correction never reaches callers.
- `USE_MOCK` is `import.meta.env.VITE_USE_MOCK !== "false"` — default is mock. `"FALSE"` and `"0"`
  silently stay on mocks.
- Dates cross the wire as ISO 8601 with offset (`2026-03-08T13:00:00+07:00`). `DATETIME` in MySQL
  carries no timezone, so the backend normalises and the frontend never guesses.
- List endpoints denormalise what the list renders (names, scores, counts) rather than making the UI
  fan out one request per row.
- Mutations that change two entities invalidate both keys. Example from the schema: a disputed result
  also sets `matches.match_status='disputed'` in the same transaction, so invalidate match *and*
  result.
- Tests sit beside the file they test and belong to the slice owner.

---

## Verify before you push

```bash
npm ci          # fails loudly if package.json and the lockfile disagree
npx tsc -b      # must exit 0
npm test
npm run build
npm run lint    # 5 known errors, see below — do not add more
```

CI runs the same four on every PR into `frontend` or `main`.

### Known lint debt — 5 errors, none blocking

`@/components/ui/badge.tsx` · `@/components/ui/button.tsx` (shadcn scaffolding, unused) ·
`src/api/user.ts:27` (unused var) · `src/features/tournament/CommunityTab.tsx:17` (fast-refresh) ·
`src/shared/seed.ts:242` (`prefer-const`)

All trivial, spread across three owners' files. Clearing them means deleting one `continue-on-error`
line in the CI workflow and lint becomes a real gate.

---

## Blocked — needs a decision, not a workaround

1. **`GUIDE/04` and `GUIDE/06` are not in the repo.** Code references them throughout. Only four
   endpoint codes survive, from comments in `schema.sql`: `T09/T12/T13`, `C08`, `E12`, `S01`. Every
   other path in `src/api/` is inferred and marked `TODO(guide)`. Whoever has these files, commit them.
2. **`tournament_standings` cannot feed the standings UI.** It stores `played`/`won`/`lost`/`points`.
   `BoardRow` ranks round-robin by goal difference, then goals for, then a mini-table, and shows recent
   form. Decide: backend computes the extra columns, or frontend derives them from the match list.
   Blocks the last step of slice 3.
3. **Three columns the API needs do not exist**: `matches.livestream_url` (E12),
   `team_invitations.expires_at` (T09/T12/T13), `tournaments.description` (C08). `schema.sql` notes all
   three against itself. Needs an owner.
4. **shadcn/ui is in the stack but unused** — seven components, zero imports. Adopt it deliberately or
   delete the folder, `components.json` and the unused deps.
5. **`workQueue.ts` is unsplit** (see Rule 5). Do this before two people migrate at once.

---

## Integration, when slices land

- Walk every user story end to end: guest → player → team leader → referee → organizer → admin
- Reconcile per-domain DTO files into `src/types/dto.ts` once `GUIDE/06` exists
- Delete `shared/store.ts` and `shared/seed.ts` — both should be near-empty by then
- Flip `VITE_USE_MOCK=false` per hook as endpoints land. No big-bang cutover.

*Two mock systems coexist until then: `shared/seed.ts` (prototype shapes, string ids) and
`src/mocks/*` (API shapes, numeric ids) describe the same season with different data. Expected. They
die together.*
