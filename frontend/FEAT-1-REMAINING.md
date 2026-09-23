# `feat/1` — Current Frontend Integration Plan

Frontend branch: `feat/1`
API base path: `/api/v1`

**Current backend contract reference: remote `BE_KN@e5ea50d` and the
2026-09-23 C1/C6/C7 and BE_KN FE notices.** Verified with `git ls-remote` and
`git fetch origin BE_KN` on 2026-09-23. Individual entries in the "Backend blockers" section retain
the exact commit and date against which they were verified; older hashes there
are historical evidence, not the current backend reference.

## C1/C6/C7 engagement integration — checked 2026-09-23

The routes below are present in `BE_KN@e5ea50d`. This is source-contract
evidence, not a deployed API or browser pass. `backend_shokun_2` now points to
`79754dc`; use the fetched `BE_KN` head for frontend integration. Real-mode
engagement now uses `src/api/liveEngagement.ts`; the older mock adapters remain
isolated from backend entity data.

- [x] **Backend C1 delivered in source:** `GET /me/notifications` with
      `items`, `unreadCount`, and `pagination`; `PATCH /me/notifications/:id/read`;
      `POST /me/notifications/read-all`. Authenticated, own notifications only.
- [x] **Frontend C1:** replace the `src/api/notification.ts` 501 guards and
      mock DTO (`read`, `href`, `userId`) with `isRead`, `type`, `title`,
      `relatedEntityType`/`relatedEntityId`, `unreadCount`, and pagination.
      Wire Inbox unread filter, read actions, Shell badge, entity links, and a
      neutral fallback for unknown types. Include `comment_removed` (show the
      reason already in `message`) and `comment_reported` (open the tournament's
      reported-comments view), plus the other C1 event types. Wired in Inbox,
      Shell and notification hooks; unknown types retain the server title/message
      with a neutral bell icon.
- [x] **Backend C6 delivered in source:** tournament review submit/read,
      MVP vote submit/read, feedback report/admin removal and admin restore.
- [x] **Frontend C6, real mode:** replace mock Community rating and MVP flows with C6
      DTOs and numeric IDs. Use review `status`, `opensAt`, `canSubmit`, `mine`,
      summary/distribution and the organizer-only anonymous `items`; use MVP
      `window`, `candidates`, `winners`, and `canVote`. Handle eligibility,
      closed-window and validation errors, reported feedback, admin restore,
      and the optional review prompt before an open-window team withdrawal.
      Do not offer organizer deletion of participant reviews or MVP votes.
      Wired in the tournament Community/Manage tabs, MVP page, admin moderation
      tab and team withdrawal prompt. The prototype's mock flows stay separate.
- [x] **Backend C7 delivered in source:** tournament comments, match Pick'em,
      personal Pick'em history and tournament leaderboard. The old match-comment
      routes are gone. `e5ea50d` also adds organizer comment removal with a
      required reason, admin restore, moderator fields/filter, and two comment
      notification types; no new migration is required by this notice.
- [x] **Frontend C7, real mode:** move comments from match `SocialBar` to the tournament
      Community tab. Use `mine`/`canComment`, one comment per person, own
      deletion, reporting, `canModerate`, `isReported`, and `?reported=true`.
      Require and explain the organizer's removal reason; give admin a restore
      action. If pinning `mine`, remove its duplicate from `items`. Preserve the
      report badge after edits. Keep match `SocialBar` for Pick'em using the
      summary's `isOpen`, `canPredict`, percentages, `mine.status`, and cutoff
      reason; add `/me/pickem` and the tournament leaderboard. Legacy mock mode
      retains its match-thread prototype for demo data; real mode never mounts it.
- [x] **Developer verification:** 40 test files / 233 tests, lint, TypeScript,
      production build and Vite startup at `127.0.0.1:5173` pass on 2026-09-23.
      The existing >500 kB bundle warning remains. Contract/UI tests cover C1
      routing and C7 moderation reason/duplicate handling.
- [ ] **Real-backend/browser verification:** check as guest, participant, organizer, referee
      and university-wide admin. Capture API responses and verify permission,
      empty, pending, error, reload and notification navigation states. The
      local Vite proxy returned 502 because nothing is listening on backend
      port 8000; no live API or browser pass is claimed.

## Newly reported match and profile gaps — triaged 2026-09-22

Triaged against frontend `f0a5538` and the verified remote head of `BE_KN`
`a88f7ad`. These are acceptance items, not claims that the corresponding fix has
already been delivered.

- [x] **R17 · Referee-request rejection feedback and match identity · FE first,
      then BE if the payload is wrong:** when a referee declines an
      `org_add_match` request, keep the resolved request visible to the organizer
      on Draw/Fixture with a **Declined** state instead of silently removing it.
      The displayed match number, round, kick-off and end time must come from the
      same `matchA` returned for that request.
  - Current evidence: `MatchRefereePlanner` and `FixturePage` filter tournament
    requests to `status === 'open'`, so a declined request disappears. The BE
    mapper does return `matchA.id`, `scheduledTime` and `scheduledEndTime`; the
    reported mismatched match/time still needs a Network capture. If those fields
    are already wrong in `GET /tournaments/:id/referee-requests` or
    `GET /me/referee-requests`, fix the BE query/mapper; otherwise fix the FE row
    association/formatting.
  - Accept: decline one of several requests, reload as organizer, and still see
    which referee declined which exact match and fixture time without confusing
    it with another request.

- [ ] **R18 · Multiple referees can accept the same match · Backend + FE
      refresh:** two independent `org_add_match` requests for the same match must
      both remain valid so two referees can accept in either order without a
      second invitation.
  - Backend fix required: `refereeChangeRequest.repo.apply()` currently marks
    every other open request touching the accepted match as `cancelled`. Keep
    independent `org_add_match` requests for other referees open; cancel only
    requests whose transfer/swap assumptions were actually invalidated. Apply
    and revalidation must remain transactional and reject real time conflicts.
  - Frontend follow-up: refresh the request and assignment queries after each
    answer and render both accepted referees. A terminal cancellation/error must
    say why instead of looking like a successful Accept.
  - Accept: invite two eligible referees to one future on-site match, accept in
    both orders, reload organizer/referee views, and see both accepted assignments.
  - FE scope: the response-state feedback and query refresh are implemented.
    The backend still cancels the second independent request, so accepting both
    invitations without reinviting remains blocked on the backend. Keep this
    item unticked until the backend contract and two-account acceptance pass.

- [ ] **R18a · Double elimination requires four teams before a draw · FE scope:**
      a new double-elimination tournament has no bracket until the organizer
      draws with at least four approved teams. Progress must not count an older
      two-team bracket as a valid draw.
  - Frontend Progress requires four approved teams, identifies an undersized
    saved bracket and routes to the confirmed redraw; the public bracket hides
    that invalid saved draw. The mock draw also enforces four teams. Frontend
    43 files / 261 tests, lint and build pass. Backend M01 still accepts a
    direct draw with two approved teams when tournament `minTeams` is two;
    enforcement at the API boundary and real backend/browser QA remain open.

- [ ] **R19 · A complete fixture gates the next match stage · Backend + FE:** a
      match must have a valid future `scheduledTime`, `scheduledEndTime` and
      non-blank venue before it can move from `scheduled` to `checkin_open`.
  - Backend fix required: `POST /matches/:id/open-checkin` currently checks only
    `match_status === 'scheduled'`; enforce the saved fixture fields and return a
    named error with missing/invalid fields so direct API calls cannot bypass the
    workflow.
  - Frontend fix required: `SetupTrail` currently counts a real fixture ready
    from only venue + start time. Include end time, keep later CTAs gated, disable
    Open check-in for an incomplete fixture, and show the backend reason.
  - Accept: an incomplete fixture cannot advance from either UI or direct API;
    after saving all three fields, the authorized role can open check-in.

- [ ] **R20 · Assigned referee may open check-in · Backend + FE:** allow an
      active referee who has accepted that match assignment to open check-in;
      retain organizer access and do not grant this to an unrelated tournament
      referee.
  - Backend fix required: the route currently uses `requireOrganizerOfMatch`.
    Add an organizer-or-assigned-referee authorization boundary while preserving
    the fixture gate in R19 and the atomic `scheduled -> checkin_open` transition.
  - Frontend fix required: `MatchLifecycle` currently renders **Open check-in**
    only for the organizer even though the viewer model already identifies an
    assigned referee. Expose the action for either authorized role and display
    403/409 feedback.
  - Accept: organizer and assigned referee can each open a fully scheduled match;
    an unassigned referee and ordinary participant receive 403 and see no action.

- [ ] **R21 · Organizer sees the dispute reason · Backend + FE mapping:** the
      organizer's disputed-result panel must show the exact reason, who raised
      it and when.
  - Backend fix required: the DB stores `dispute_reason`,
    `dispute_raised_by` and `dispute_raised_at`, but the current S05 result DTO
    omits them. Return the fields to authorized match participants/organizer.
  - Frontend fix required: `getResult()` currently hardcodes all dispute fields
    to `null`. Map the delivered fields. `ResolvePanel` and `ResultTrail` already
    have a rendering location for `disputeReason`.
  - Accept: submit a dispute with a distinctive reason, reload as organizer, and
    see the same reason/actor/time before choosing uphold, amend or reject.

- [ ] **R22 / existing R14 · Completed-match YouTube replay persists · Backend
      blocker + FE contract sync:** a link saved after completion must survive a
      reload and render on that match page, distinct from any pre-match/live URL.
  - Backend fix required: `PUT /matches/:id/livestream` writes
    `matches.livestream_url` and returns `{ matchId, youtubeUrl }`, but M05
    `GET /matches/:id` does not return it and there is no explicit replay field.
    Deliver the agreed replay read/write contract (and migration if replay and
    livestream are separate fields).
  - Frontend state: the mutation response can show the link temporarily, but the
    backend match mapper is the source of truth after reload. Map the delivered
    replay field and retain the current YouTube validation/error states.
  - Accept: save/update a valid YouTube replay on a completed match, reload/open
    from another account, and see the persisted replay without showing it as a
    live broadcast. Keep the older R14 row open until this passes.

- [ ] **R23 · Account avatar, team logo and profile shortcut · FE + Backend:**
      users can upload/remove their own avatar, team leaders can upload/remove a
      team logo, and clicking the signed-in avatar in the shell navigates to
      `/me`.
  - [ ] **Account avatar · Backend + FE:** `PATCH /me { avatarUrl }` and
    `users.profile_image_key` exist, but `/uploads/presign` has no avatar purpose
    and user mappers currently expose the raw key rather than a downloadable URL.
    Add the authorized upload/read contract, then add Profile controls, preview,
    pending/error states and render the saved avatar throughout the FE.
  - [ ] **Team logo · Backend + FE:** `teams` has no logo column and
    `PATCH /teams/:id` accepts only name/visibility. Add a migration, leader-only
    upload/update/removal contract and mapped read field; then connect Team
    manage/detail/list views. Do not use the prototype-only `logoUrl` as a real
    backend fallback.
  - [ ] **Shell avatar link · FE:** replace the non-interactive initial in
    `Shell` with the current avatar/initial fallback in an accessible link or
    button to `/me`.

### R17–R23 — frontend pass, 2026-09-23

Worked against `BE_KN` at `e5ea50d`, not the `a88f7ad` the triage above was
written on. Re-checked each "Backend fix required" line against that head first:
**none of them has landed**, so every backend half named below is still owed.
Developer verification: 41 test files / 243 tests, lint, TypeScript.

- [x] **R17 — done, and the payload was not the problem.** Both
      `MatchRefereePlanner` and `FixturePage` filtered requests to
      `status === 'open'`, so a decline erased the row and the organizer was left
      guessing. Declined requests now stay on the match they were for, with who
      declined and when, and the referee stays selectable so they can be asked
      again. The reported match/time mix-up did not reproduce: requests are keyed
      off `matchA.id` from the request itself — never position or round — and the
      live payload carries the right `matchA.id`, `scheduledTime` and
      `scheduledEndTime`. Verified on tournament 22: มานะ declined match 14 and
      the row reads `Declined · มานะ ไร้ทีม · 9/23/2026, 6:05:23 PM` against
      Match 14's own kick-off. If the reporter still sees a mismatch we need
      their Network capture, because this path now reads only from the request.
- [ ] **R18 — frontend half done, backend fix required.** The real
      frontend defect was that Accept announced "You are officiating match #N"
      whenever the call did not throw. FR06 answers 200 with the request and its
      `status`, and that status can be `cancelled` when the first referee accepts.
      A referee was being told they had a match they did not have. Accept now
      believes the returned status, says plainly when the request closed without
      reaching them, and names the reason on a refusal
      (`REQUEST_CLOSED`, `REFEREE_TIME_CONFLICT`, `MATCH_NOT_CHANGEABLE`,
      `REFEREE_NOT_ACTIVE`). Answering also invalidates the whole `referees` and
      `match` key space, so an organizer holding the Draw tab open sees the
      change. The current backend cancels another referee's open
      `org_add_match` request for the same match. The FE cannot make both
      acceptances persist until the backend changes that transaction.
- [x] **R19 — frontend half done.** `SetupTrail` counted a fixture ready from
      venue + start time only; end time is just as mandatory, because M06's first
      write refuses with `SCHEDULE_INCOMPLETE` without all three and FR02
      (`assertMatchChangeable`) will not take a referee request while
      `scheduled_end_time` is null. The trail said "set" on matches that could
      not be staffed at all. Open check-in is now disabled until all three are
      saved, names which are missing, and offers a shortcut to the fixture page.
      Verified live on match 13: with no end time and no venue the button is
      disabled reading "Set the kick-off, end time and venue first".
      **Still owed:** `POST /matches/:id/open-checkin` checks only
      `match_status`, so a direct API call still bypasses this.
- [ ] **R20 — frontend seam ready, deliberately not exposed yet.** The route is
      still `requireOrganizerOfMatch`, so showing the action to an assigned
      referee today guarantees a 403 on every press, which is the one thing the
      api-layer convention forbids. Added `viewer.can.openCheckin` as its own
      capability and routed the button through it; the mapper line reads
      `openCheckin: isOrganizer` and becomes `isOrganizer || isReferee` the day
      the middleware changes — one line, nothing else to touch. The 403/409
      surface asked for is in place now (`lifecycleError` names `NOT_ORGANIZER`,
      `NOT_REFEREE`, `INVALID_STATUS_TRANSITION`, `INSUFFICIENT_REFEREES`,
      `CHECKIN_NOT_OPEN`, `MATCH_TEAMS_INCOMPLETE`, `TEAMS_PRESENT`).
- [ ] **R21 — frontend half done, backend half still required.** `getResult()`
      no longer hardcodes the six dispute fields to `null`; it reads them when
      present, and `BackendResultDto` declares them optional. Contract tests
      cover both directions — present and absent. `ResolvePanel` and
      `ResultTrail` already render them, so the organizer starts seeing the
      dispute reason the moment S05 sends it, with no further frontend change.
      Tracked for the backend as `FE-dispute-resolution-not-returned`.
- [ ] **R22 / R14 — unchanged, still the backend read.** The frontend half was
      delivered on 2026-09-22 and re-checked here. `BackendMatchDetailDto`
      already declares `livestreamUrl` optional and the mapper reads it, so the
      link renders as soon as M05 returns it. Tracked as
      `FE-replay-link-write-only`.
- [ ] **R23 — not started here, and not ours to start.** Two of the three parts
      have no backend to build against: `/uploads/presign` has no avatar purpose
      (`purpose` is still `checkin_document | soft_filter_document |
      referee_identity`) and `teams` has no logo column, so neither upload
      contract exists. The third part, the Shell avatar link, is in
      `src/components/layout/Shell.tsx`, which `PLAN.md` assigns to Person 1 —
      it needs their change, not ours.
  - Accept: avatar and team logo persist across reload/login, unauthorized users
    cannot modify them, broken/expired image URLs recover visibly, removal works,
    and the shell avatar opens the signed-in profile on desktop and mobile.

### R24–R27 — four questions from 2026-09-23

Two turned out to be bugs, one was a deliberate rule nobody had told the screen
about, and one was a design question with a real answer. All four were checked
against the running backend at `e5ea50d` before anything changed.

- [x] **R24 — the referee invitation in the inbox opened onto a dead end.**
      Reported as a 403; the actual status is **404**, and the screen it
      produced said *"That tournament doesn't exist"*, which is worse than a
      permission message. Cause: the C1 notification `referee_invited` carries
      `relatedEntityType: 'tournament'`, so `notificationHref` sent the referee
      to `/t/:id` — but `getVisibleTournament` admits only the requester and a
      covering admin to a non-`public` tournament, and a referee invitation
      almost always arrives while the tournament is still `private`, because
      *approve → appoint referees → publish* is the order the product itself
      prescribes. Reproduced end to end: invited 9003 to tournament 28
      (`private`), `GET /tournaments/28` as 9003 → 404, inbox Open → "That
      tournament doesn't exist". The frontend now renders no Open button for
      `referee_invited`; Accept and Decline are in the Referee appointments
      panel of the same page, which is what the referee actually needs. Filed
      the other half as `FE-referee-cannot-read-invited-tournament` — a referee
      still cannot look at what they are being asked to officiate before
      answering, and that is a backend visibility rule, not a link.
- [x] **R25 — "does an admin not have to approve a new tournament any more?"**
      Deliberate, not a regression. `autoApproveIfOwnScope`
      (`tournament.service.ts:220`, decision of 18 ก.ย. item 8) approves on
      creation when the creator is an admin whose scope covers the tournament:
      university-wide covers everything, a faculty admin covers only a
      tournament their own faculty organises **and** whose faculty eligibility
      rules name that one faculty. Everyone else still goes to
      `pending_approval`. Verified all four branches against the live server —
      university admin → `{status: "private", autoApproved: true}`; faculty
      admin, own faculty, own-faculty-only rule → `private`; same admin, open to
      every faculty → `pending_approval`; same admin, another faculty →
      `pending_approval`; non-admin organiser → `pending_approval`.
      **Our bug was the screen.** `POST /tournaments` returns
      `{id, status, name, autoApproved}`, but `api/tournament.ts` declared the
      return type as a full `TournamentDto`, so the extra fields were invisible
      to every caller and the confirmation panel told *everyone* "is with an
      admin. Nothing else is needed from you right now" — an admin whose
      tournament was already approved sat waiting for themselves. Typed the
      response as `TournamentCreatedDto` and branched the panel. While there:
      the panel also claimed "the tournament page stays closed — even to you",
      which stopped being true when C17b opened own-request visibility on
      20 ก.ย.; both branches now offer **Open the tournament**, and both were
      confirmed to load in the browser (`private` with the Manage tab,
      `pending_approval` reading "Pending review").
- [x] **R26 — "is สมชาย a faculty admin or a university admin, and is there a
      test account for the other one?"** สมชาย ใจดี (`somchai@ku.th`, 9001) is
      **university-wide** — `admin_scopes` row 1, `scope_type` =
      `university_wide`, `faculty_id` NULL. The faculty admin was not missing
      from the design, it was missing from the *data*: `seed-test.sql` has
      defined อาจารย์วิศวะ (`admin.eng@ku.th`, 9004, faculty 1) as a faculty
      admin all along, but `qa-baseline.sql` ships only the university-wide row,
      so the QA database everybody tests against had exactly one admin and the
      entire faculty-scope half of R25 was untestable. Loaded 9004 into the
      running database (password `abcd1234` like every test account) and used it
      to verify the matrix above. Not a backend defect — worth folding into the
      baseline so it survives `qa-baseline.py restore`.
- [x] **R27 — "can the faculty/department dropdowns and the all/one/several
      faculty tick-list be merged?"** Two different questions are being asked in
      that form and only one pair could be merged, so that is the pair that was
      merged.
      - *Who organises it* (`scopeType` + `organizingFacultyId` +
        `organizingDepartmentId`) and *who may enter* (`eligibilityRules` of type
        `faculty`) are genuinely independent — tournament 27 is organised by
        Engineering and open to everybody, which no single control can express.
        They stay separate. The entry side was already reduced to a three-way
        choice with the faculty checklist appearing only under "Choose
        faculties", so the part that reads as a duplicate list is already gone.
      - *Scope* and *organising department* **were** one question asked twice.
        `ensureCreateReferences` allows exactly two combinations: faculty scope
        = a faculty and no department; department scope = both, with the
        department inside that faculty. Asking separately only created a way to
        answer inconsistently and collect a 400. The Scope dropdown is gone; the
        form asks for a faculty, then a department whose blank option reads
        "The whole faculty", and derives `scopeType` from it. Changing the
        faculty clears a department that no longer belongs to it — the other
        400 the old form allowed. `scopeType` is still sent, unchanged, so the
        backend contract is untouched.
- [x] **R27a — the merge shipped with a regression of its own, reported the same
      day and fixed here.** Leaving the organising faculty blank looked like it
      had broken tournament creation outright. Two causes, both ours:
      - Making the two selects controlled took them off `register`, and a plain
        `setValue` does not re-validate. So the submit-time message
        "กรุณาเลือกคณะที่จัดการแข่งขัน" stayed on screen after the user picked a
        faculty, which reads as *the form will not let me through at all*.
        Pressing send again did work — but nothing on screen said so. Both
        pickers now pass `shouldValidate: true`, restoring what `register` used
        to do. Covered by a test that fails without the flag.
      - The two controls sit side by side and look identical, but only the lower
        one may be left blank — and after the merge its blank option reads "The
        whole faculty", which makes blank look like a legitimate answer in that
        whole row. The faculty placeholder now reads "Choose a faculty —
        required", there is a standing hint underneath explaining that LTMS has
        no university-wide level yet, and the department is labelled "optional".
        Both selects carry `aria-invalid`.
      Worth saying plainly: there is **no way to create a tournament without an
      organising faculty**, and that is the backend's rule, not a UI choice —
      `ensureCreateReferences` requires `organizingFacultyId` for both scope
      types, and `tournaments.scope_type` has a `university` value that the MVP
      does not accept. If university-wide tournaments are wanted, that is a
      backend change first.
- [x] **R27b — "the faculty admin does not seem to get auto-approved."** The
      rule works; the form does not explain it. Re-verified against `e5ea50d`
      through both the API and the browser as `admin.eng@ku.th` (faculty 1):
      organising faculty 1 with entry set to *Only the faculty running it* →
      `private, autoApproved: true`, and the confirmation reads "Approved on the
      spot". Adding a year rule alongside it still auto-approves. What does
      **not** auto-approve is the form's own default, *Every faculty*, which
      sends no faculty rule at all — and `adminCoversEligibility` requires at
      least one faculty rule, all naming the admin's faculty. So a faculty admin
      who fills the form the obvious way is queued every single time, which is
      exactly what "seems not to auto-approve" looks like from the outside.
      The frontend cannot say "this one will skip the queue for *you*", because
      `GET /me` does not carry the viewer's admin scope and `GET /admin/scopes`
      is 404 — filed as `FE-viewer-admin-scope-unknown`. Until that lands the
      banner states the rule conditionally: the own-faculty case now adds "If
      that admin is you, it skips the queue and is approved the moment you send
      it", and the default case says a faculty admin sending it still waits, and
      points at the setting that changes the answer. Nothing about the payload
      changed.
- [x] **R27c — the admin queue lists requests the faculty admin is then refused
      permission to approve.** Asked as "should we just hide them?" — our answer
      is *mark, do not hide*, and the filtering itself has to move to the
      backend.
      - Cause, verified 2026-09-23 as `admin.eng@ku.th`: the queue filters on
        `organizing_faculty_id` alone (`adminScopeWhere`) while approving also
        runs `adminCoversEligibility`, which wants at least one faculty rule and
        all of them naming that faculty. All three pending requests in the QA
        database are organised by faculty 1 with **no eligibility rules**, so
        the queue showed three rows and all three answered
        `403 ELIGIBILITY_OUT_OF_SCOPE`.
      - We cannot filter it here. The list response carries no eligibility
        rules, and nothing tells the frontend the viewer's own admin scope. Any
        client-side filter would be a guess, and a wrong guess hides a real
        request from the person who is allowed to decide it.
      - Why not hide even once we can: a faculty admin has a legitimate interest
        in knowing their own faculty has a request pending, even when a
        university admin signs it. Filed as
        `FE-admin-queue-shows-undecidable-rows` asking for `canDecide` plus a
        reason on the row, rather than for the row to disappear.
      - What ships now: the row is marked **Above your scope** once the server
        has actually said so, its Approve is disabled with a title saying who
        must decide it, and the refusal is explained in this page's own words
        instead of echoing the backend's Thai string into an English screen.
        Other refusal codes still show in the banner, now readable.
      - Found on the way, and worth a decision: **`reject` does not check
        eligibility scope at all.** The same admin who gets 403 on approve gets
        `200 {status: "rejected"}` on decline. Filed as
        `FE-reject-skips-eligibility-scope`. Decline is deliberately left
        enabled — the server really does allow it — but the row now says so.

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

## Registration open/close lifecycle — fixed 2026-09-22

- [x] Preserve `registrationOpen`, `registrationStart` and `registrationEnd` from
      the backend tournament DTO in the shared tournament view.
- [x] Separate publication from registration in Manage progress. A public
      tournament now exposes an explicit **Open registration** action backed by
      `POST /tournaments/:id/open-registration`; it no longer advances directly
      to **Approve the squads** while the backend still rejects applications.
- [x] Keep registration open while squads apply and the organizer approves them.
      Draw and atomic redraw do not require registration to close: M01 uses the
      currently approved squads and `replace: true` remains available while all
      matches are still `scheduled` with no check-ins or results. This follows
      `BE_KN` `a88f7ad`, whose bracket service deliberately ignores
      `registration_open`.
- [x] Keep the entry form closed in real mode unless the authoritative
      `registrationOpen` flag is true; public visibility alone is not treated as
      permission to submit an application.
- [x] Add API and progress/view regressions for the dedicated registration
      routes, the blocked public-but-closed state, drawing while registration is
      open, lifecycle ordering and DTO mapping.
- [ ] Frontend Tester verifies in a real browser that an organizer can publish,
      open registration, receive a squad application, approve at least two
      squads, draw while registration remains open, approve another squad and
      redraw with `replace: true` against current `BE_KN`, recording Network
      evidence for the lifecycle and bracket writes.

Developer verification passed on 2026-09-22: focused registration coverage
passed (3 files / 29 tests), the full suite passed (36 files / 226 tests), lint
passed, TypeScript and the production build passed. The existing Vite chunk-size
warning remains; real-backend/browser acceptance stays open above.

## Fixture and standings failure states — fixed 2026-09-22

- [x] Show the actual scheduling rejection on Fixture instead of collapsing
      every `PATCH /matches/:id/schedule` failure into “Could not save the
      fixture.” Named feedback covers an incomplete first schedule, a locked
      match, tournament date bounds, team/venue overlap (including
      `conflictingMatchId`) and bracket order (including `blockingMatchId`).
- [x] Keep a schedule/check-in-state mutation scoped to match caches. It no
      longer invalidates result, statistics, Pick'em or standings queries as if
      a score had changed, so saving Fixture cannot cause an unrelated standings
      retry storm.
- [x] Treat a failed standings request as an error on Leaderboard, with the
      server message and a retry action. A backend failure is no longer rendered
      as the successful empty state “No table yet”. Dashboard already keeps its
      match summary available while labelling only the table unavailable.
- [x] Add focused regressions for schedule-conflict detail and for distinct
      Leaderboard error/empty states.
- [ ] Backend runtime prerequisite: apply
      `database/migrations/021_standings_goals.sql` to every database used with
      BE_KN `92857f1` or newer. `ER_BAD_FIELD_ERROR: ts.goals_for` proves that
      the running code and database schema are out of sync; switching to
      `backend_shokun_2` or `backend_step9-10` does not fix that because both
      carry the same query and migration.
- [ ] Frontend Tester verifies in a real browser that each schedule rejection
      shows its actionable reason, a successful save survives reload, and
      Dashboard/Leaderboard load after migration 021, recording the schedule
      and standings responses from Network.

Developer verification passed on 2026-09-22: focused Fixture/Leaderboard
coverage passed (2 files / 7 tests), the full suite passed (37 files / 229
tests), lint passed, TypeScript and the production build passed. The existing
Vite chunk-size warning remains; database migration and real-browser acceptance
stay open above.

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
| [x] | Slice 1 | Profile — unsupported panels (earlier boundary) | Hide or label these panels instead of calculating them from the seed. C6/C7 now supply tournament MVP and personal Pick'em reads, and the latter is wired; follows, career and received-MVP totals still need read contracts. |
| [x] | Slice 1 | Inbox — notifications | C1 is wired in real mode against `BE_KN@e5ea50d`; the older local 501 state applied to the previous baseline. Deployment/browser verification remains open above. |
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
- [x] **Backend owner:** define a notification list/read/read-all contract,
      authorization, DTO, event producers, and pagination. C1 is present in
      `BE_KN@e5ea50d`; frontend wiring is complete and deployment/browser
      verification remains open.
- [x] **Backend owner:** define global team search/list authorization and DTO
      before the Search team section is enabled in real mode.
      Delivered as public T19 in BE_KN `c11954c`; the FE sends
      `visibility=public` and renders the returned numeric team DTOs.
- [ ] **Backend owner:** define follows and any missing Profile career reads.
      Pick'em history (`GET /me/pickem`) and tournament MVP vote reads are now
      in `BE_KN@e5ea50d` and wired in real mode.
- [x] **Head Frontend Dev:** update this file with each confirmed route, request,
      response, errors, permission, reviewed backend commit, and deployment
      evidence before assigning its frontend migration.
      Updated through reviewed BE_KN `e5ea50d`; deployment/browser evidence is
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
      never fall back to store data in real mode. The earlier boundary test
      guarded notifications and MVP before C1/C6 existed. It now checks C1 is
      enabled without a prototype-store read and that MVP rejects invalid IDs;
      Watch remains an explicit unavailable route.
- [x] Run `rg` over routed feature components for `useLtms`, `shared/store`,
      `shared/selectors`, `shared/seed`, and `src/mocks`; review and document
      every remaining real-mode-reachable use.
      Audited 2026-09-21. Remaining imports fall into three explicit groups:
      mock-only branches guarded by `USE_MOCK` (Home/Search/Profile/tournament
      compatibility views), API-backed screens that use the store only for their
      mock adapter (Match/Team), and direct unsupported routes guarded before the
      prototype hooks mount (Watch). Shell badges now use C1 `unreadCount` in
      real mode. No reviewed real-mode render derives an entity, permission,
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
      real bracket~~ — delivered and wired. Tournament comments were delivered
      later in C7 and are tracked separately above. What the delivered result routes will not
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
- [x] ~~Backend delivery required: notification list, mark-one-read, and
      mark-all-read routes.~~ Delivered in `BE_KN@e5ea50d` (C1) and wired to
      Inbox/Shell. Live browser verification remains open.
- [ ] Backend delivery required: follows plus any Profile career-by-tournament
      and received-MVP-total reads that remain part of the approved UI. Pick'em
      history and tournament MVP vote reads are delivered and wired in C7/C6.
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
- [x] ~~Backend delivery required: tournament feedback writing and reading.~~
      C6 is present in `BE_KN@e5ea50d`: review submit/read, MVP vote
      submit/read, reporting, admin removal and restore. The 404 at `6ebda2e`
      is historical. Real-mode Community rating and organizer feedback now use
      the C6 API; browser acceptance is tracked above.
- [x] ~~Backend delivery required: comments and Pick'em.~~ C7 is present in
      `BE_KN@e5ea50d`. Comments now belong to tournaments, one per person;
      Pick'em remains per match. Real mode uses the C7 API-backed tournament
      Community and match Pick'em components. `src/api/engagement.ts` and the
      mock match `SocialBar` remain prototype-only.
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
      - [x] **Frontend Dev delivery (2026-09-22):** the part of R04 that was
        still missing — doing this *from the draw workflow* rather than one
        Fixture page at a time — is now `MatchRefereePlanner` under the Draw
        subtab. See the R10 entry below; R04 and R10 are the same request and
        share that component, so do not schedule them separately.
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

- [x] **R10 · P1 · Draw referee planning · Slices 2/3/4 + Backend:** on the draw
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

- [x] **R11 · P1 · Check-in reject then re-verify · Slice 3 + Backend:** fix the
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

- [x] **R12 · P1 · Fixture editor scope · Slices 2/4 + Backend:** make Fixture
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

- [x] **R13 · P1 · Double forfeit lifecycle · Slices 2/4 + Backend:** when both
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

- [x] **R15 · P1 · Winning team-leader confirmation · Slices 2/4 + Backend:**
      restore the winner's team leader ability to confirm a submitted result;
      the currently working dispute action must not mask or replace confirm.
  - Reproduce/evidence: capture match/result IDs and state, winner team ID,
    current user/team/role membership, result read payload, visible actions,
    confirmation request/response, and refreshed state.
  - Accept: the winning team's authorized leader sees an enabled Confirm action
    and can complete it once; dispute remains available only where allowed;
    losing leaders/plain members cannot confirm; duplicate confirmation is
    idempotent or returns a clear terminal-state response.

- [x] **R16 · P1 · Organizer dispute resolution · Slices 2/4 + Backend:** after
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

### R10–R16 — what the causes turned out to be (2026-09-22)

> Short version for both teams, including the backend half:
> `HANDOVER-2026-09-22.md`.


Each one was reproduced against the running backend at `a88f7ad` before
anything was changed, and re-checked in the browser afterwards. Five were ours.
Two are a backend field that is written and never returned, now filed in
`BACKEND-GAPS.md`. The Frontend Tester rows below stay open regardless.

- [x] **R10** — the draw page had no referee UI at all; the only way in was the
      per-match Fixture page. Added `MatchRefereePlanner`, mounted under the
      Draw subtab, listing every match of the tournament with its accepted and
      pending referees and a picker per row. Later rounds staff fine before
      anyone knows who plays in them — FR02 `assertMatchChangeable` wants
      `scheduled` plus a future start/end and says nothing about teams — so a
      slot with no teams gets the picker and a slot with no kick-off gets told
      to set one. A request is never drawn as an assignment. Verified live on
      tournament 22: requested มานะ for match 14, row read "Waiting for their
      answer", cancelled it, row went back to Available.
- [x] **R11** — two separate causes. `SquadPanel` and `CheckinConsole` both
      offered a referee no action at all on a row whose status was `rejected`,
      so a referee who rejected the wrong person had no way back even though
      M19 has overwritten a rejected row since OD-19. And the Reject button
      posted a hardcoded `'Rejected by the referee'`, so the mandatory M15
      reason was never the referee's words. Added `RevokeCheckinModal` (reason
      required), gave a rejected row the M19 path with a banner saying what it
      is for, and put the referee's own decision errors on screen — they were
      silent before. Verified live on match 7: rejected ผู้เล่น เอหนึ่ง with a
      typed reason, row went Rejected, verified by hand, row came back Checked
      in with the note showing. The first attempt correctly failed 403
      `NOT_IN_APPROVED_ROSTER` and, for the first time, said so.
- [x] **R12** — the page already edited the schedule and the referees; the gate
      was wrong. `open = m.checkedIn === 0` let a `checkin_open` match with
      nobody checked in show an editable form that M06 then refused, and the
      locked branch hid the referees entirely. Gate is now
      `m.status === 'scheduled'`, matching M06 and FR02; the locked view states
      which status it is in and still lists the officials. Also split
      `can.editFixture` into "not the organizer" (403) and "too late to change"
      — the organizer of a finished match used to be told the fixture was not
      theirs. Dropped the `capacityFull` block: BR-10's count is a minimum, not
      a cap, and it silently disabled the button past it.
- [x] **R13** — `ResultTrail` counted only `verified` as settled, so every
      walkover and double forfeit parked at "Waiting on the winning team's
      leader. Until then nothing moves." and never ticked Bracket updated,
      although M17 writes the result and advances the bracket in one
      transaction. A forfeit now reads as settled without play, says no
      confirmation is needed, and — when there is no winner — says nobody
      advances. Verified live: forfeited match 7 with both squads short, the
      Progress tab reads correctly end to end.
- [ ] **R14** — ours is done, the cause is backend. The organizer's panel never
      showed a saved link because `matchFromBackend` hardcoded
      `replayUrl: null` — correctly, since M05 does not send the field.
      `setLivestream` also claimed to return a `MatchDto` when E12 answers
      `{matchId, youtubeUrl}`. Both fixed: the link now renders from the E12
      response and the page says plainly that it will not survive a reload.
      Stays open until `FE-replay-link-write-only` lands, then it works with no
      further change.
- [x] **R15** — could not be reproduced as a blocked confirmation. Tried the
      winning leader on an onsite match twice (match 12 as `playerA1@ku.th`,
      match 9 as `p9225@ku.th`) and the Confirm button was present, enabled, and
      the confirmation went through and advanced the bracket; the backend
      accepted `POST /matches/:id/result/verify` from the winner's leader every
      time. What was certainly broken is that **neither Confirm nor Dispute had
      anywhere to show an error** — a refused request left the screen completely
      unchanged, which is indistinguishable from a dead button. Added
      `SignOffError`, with named handling for `SAME_PERSON_CANNOT_VERIFY` (the
      one a combined referee-and-team-leader account hits), plus
      `WRONG_SUBMITTER_ROLE` and `MATCH_RESULT_ALREADY_VERIFIED`. If the
      original report was an online match, the referee is the confirmer there by
      BR-13 and that is the design, not a defect — worth settling with the
      reporter.
- [x] **R16** — two causes, both confirmed in the browser. All three resolve
      buttons were disabled until the Why box had text, with no hint, no title
      and no asterisk, so the panel looked dead; the requirement is now stated
      and the disabled buttons carry a title. Then the real dead end: after a
      throw-out the match goes to `result_rejected`, a value **missing from
      `MatchStatusEnum`** — `matchStateOf` fell through to "Scheduled",
      `ActionPanel` had no branch for a `rejected` result, and `can.submitResult`
      required `checkin_open`/`in_progress`, so nobody could record the match
      again although `requireCanSubmitResult` was waiting for exactly that.
      Added the status, a panel that says what happened, and the form back.
      Also stopped drawing the thrown-out score on the scorebug. Shared UI
      vocabulary refactored: `MatchState` officially includes `'rejected'`,
      `MatchStateBadge` shows "Result thrown out" with `crit` variant, and
      `STATE_ORDER`/dashboard counters include rejected matches. Verified live
      on match 9: threw the result out as the organizer, the referee got the
      form, entered 4–1, and the winning leader confirmed it.

### Regression completion gate

- [ ] Head Frontend Dev: attach reproduction evidence and confirmed ownership
      to every open item in R01–R16; settle R02 timing, R03 role-conflict scope,
      and the frontend/backend boundary for R10–R16.
- [x] Add targeted regression tests for confirmed causes; run tests/lint/build
      for implementation changes. This entry itself is documentation only.
      Latest Developer verification 2026-09-22: 35 files / 220 tests, lint,
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
