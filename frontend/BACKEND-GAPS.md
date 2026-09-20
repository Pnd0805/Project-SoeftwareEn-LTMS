# LTMS — what the frontend still needs from the backend

Frontend branch `feat/1` · API base path `/api/v1`

**Checked against `origin/BE_KN` at `c43f497`, pulled, migrated to 014 and run
locally on 2026-09-20.** Every item below was verified by calling the running
server, not by reading source: a route is reported missing only when it answers
`404 NOT_FOUND`, and anything that answered otherwise was struck from this list
before sending.

**Since the last file.** A1–A9, B2, B5, B4, B6, B7 and B9 are all verified
delivered and wired, and the workarounds they replace are deleted. Four of them
landed in this round:

- **B4** — the resolve panel offers the three real outcomes again. Match 9 was
  corrected from 3–2 to 3–1 through the UI and came back `verified` with
  `amended_by_user_id` set.
- **B6** — our own roster lock now matches yours, including releasing when the
  tournament is `completed`, `rejected` or `auto_deleted`, which it did not before.
- **B7** — the per-match referee probing is gone. It was not only slow, it was
  wrong: `somying@ku.th` used to see 2 of her matches and now sees all 10.
- **B9** — a venue-only edit works and leaves the times alone.

While building a test case for B4 we hit a new one, `FE-disputing-result-yet-verified`:
disputing a result that is still `submitted` answers 500 every time. It is the
ordinary FR-RS-03 path, and it is one null check.

The other open items are unchanged. `FE-way-say-which-faculties` was rewritten
after the team asked whether a tournament can admit more than one faculty —
the short answer is that the enforcement is all there and nothing can put the
data in.

## How to read it

- Each item has a stable code (`FE-…`). It is derived from the item's own
  headline, so it does not shift when another item closes — quote it when you
  answer and we will know exactly which one you mean.
- **Delivery required** — the route or field does not exist and a screen needs
  it. Each item names the route, says what the screen does in the meantime, and
  points at where in your source the gap is.
- **Fix required** — it exists, but behaves in a way the frontend cannot work
  around.
- Where the frontend currently guesses a value because the API does not supply
  one, the item says so. Those guesses are the parts we most want to delete.
- None of this is blocking us from shipping screens; it is the list of places
  where a screen is showing a workaround instead of the real thing.
- This file is an extract and stands on its own. The frontend's planning notes
  live in `FEAT-1-REMAINING.md` in the same folder; nothing there is needed to
  act on anything here.

## Delivery required — 15 items

- [ ] **FE-match-end-level-submitresultschema** — A match cannot end level. `submitResultSchema`
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
- [ ] **FE-standings-carry-points-draws** — Standings carry no points and no draws.
      `GET /tournaments/:id/standings` returns `{team, wins, losses, rank}` and
      nothing else — no drawn count, no points, no goals for/against. The
      leaderboard needs all of them to rank a round robin and to state its own
      tie-break ("level on points is separated by difference, then scored"), so
      `src/api/match.ts` currently fills `points` with `wins * 3` and leaves the
      score columns at 0. That constant is a guess the frontend has no business
      making: points per win differ by sport, and a draw is worth 1. Return the
      real figures and delete the guess.
- [ ] **FE-public-team-list-team** — Public team list or team search.
      `GET /me/teams` only returns the signed-in user's own teams, so the search
      page cannot look up anybody else's squad.
      (The 500 this used to throw on a non-numeric team id was fixed as A2 in
      `c9773ca` — `/teams/:id` answers 400 now. The search route itself is still
      the open part.)
- [ ] **FE-notification-list-mark-one** — Notification list, mark-one-read, and
      mark-all-read routes. `src/api/notification.ts` currently contains
      local `501 ENDPOINT_UNAVAILABLE` guards; the general Inbox must not call
      or simulate unconfirmed paths in real mode until the contract is agreed
      and deployed.
- [ ] **FE-follows-plus-any-profile** — Follows plus any Profile career-by-tournament,
      Pick'em total, and MVP-total reads that remain part of the approved UI.
      `GET /me` and `GET /users/:id/stats` do not supply those sections.
- [ ] **FE-team-leader-transfer-sds** — Team leader transfer (SDS
      `POST /teams/{id}/transfer-leader`, FR-TM-08). Outside mock mode the UI
      labels it unavailable.
- [ ] **FE-whole-admin-user-surface** — The whole admin-user surface (FR-UM-05) —
      `GET /admin/users`, `PATCH /admin/users/{id}/suspend`, `GET /admin/scopes`
      for granting and revoking admin rights, and `GET /admin/audit-logs`. All
      four answer 404 on `6ebda2e`. Login already refuses a suspended account
      (`403 ACCOUNT_SUSPENDED`) and the test database has one to prove it, so
      the rule exists with no way for an admin to apply it. The Admin page's
      Users and Audit tabs work in mock mode only; in real mode they say the
      routes do not exist.
- [ ] **FE-room-code-online-match** — Room code for an online match. `matches` has no
      `room_code` column and no route accepts one — the field exists only in the
      prototype (`MatchDto.roomCode`), so a referee has nowhere to publish the
      lobby code that both squads need before an online match starts. Suggested:
      `ALTER TABLE matches ADD COLUMN room_code VARCHAR(50) NULL AFTER venue;`
      plus a write for the match referee or organizer, returned by
      `GET /matches/:id`. The check-in page states it is unavailable in real mode
      and the referee queue no longer keeps online matches in the "announce the
      room" bucket, which they could never leave while the field is always null.
- [ ] **FE-get-me-tournaments-full** — `GET /me/tournaments` with the full card DTO.
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
- [ ] **FE-closing-tournament-nothing-sets** — Closing a tournament. Nothing sets
      `tournament_status = 'completed'`, so a tournament whose matches are all
      confirmed stays `public` forever, `GET /tournaments/:id/winner` answers 404
      (it only serves completed tournaments) and `championCount` in
      `GET /users/:id/stats` stays 0. Worse, a tournament that *is* completed
      disappears for everyone except an admin: `findPublicTournaments` filters to
      `public` and `getVisibleTournament` refuses anything else, so finished
      results cannot be browsed at all. The tournament page works around the
      first half by declaring the tournament finished once every match is
      confirmed and naming the champion from the standings.
- [ ] **FE-organizer-see-their-own** — An organizer cannot see their own pending
      amendment. `GET /admin/amendment-requests` is the only list, and it is
      `requireAdmin_U`. After sending a change request the organizer has no way
      to ask "is it still pending?" — our panel can only show a note that lasts
      until the page is reloaded, which is not a status.
      A `GET /tournaments/:id/amendment-requests` for the organizer, or the
      pending request inlined on `GET /tournaments/:id`, would close it.
- [ ] **FE-tournament-feedback** — Tournament feedback — both writing it and
      reading it back (SDS `POST /tournaments/{id}/feedback`, FR-CM-02).
      `schema.sql` already has the whole table: `tournament_feedback` with
      `feedback_type ENUM('comment','organizer_feedback','mvp_vote')`, a
      `rating` column and a unique key that enforces one per person. No route
      touches any of it, verified 404 on `6ebda2e`. The Community tab's rating
      form and the organizer's Feedback panel work in mock mode only.
- [ ] **FE-match-comments-pick-em** — Match comments and Pick'em (SDS
      `POST /tournaments/{id}/comments` FR-CM-01,
      `POST /matches/{id}/predictions` FR-PK-01, settled inside the result
      transaction). `src/api/engagement.ts` calls `/matches/:id/comments` and
      `/matches/:id/picks`, which match neither the SDS nor a backend route.
      The match page's Community tab shows `SocialBar` in mock mode only,
      because `SocialBar` takes a store `Match`, not a `MatchDto`.
- [ ] **FE-entry-notes-soft-filter** — Entry notes, the soft filter (FR-TN-03). There
      is no column and no route, so the free-text note an organizer writes for
      applicants has nowhere to live. `saveEntryNotes()` answers 501.
- [ ] **FE-delete-tournaments-id-organizer** — `DELETE /tournaments/:id`. An organizer can
      unpublish but never delete, so a tournament created by mistake is
      permanent. `deleteTournament()` answers 501.

## Fix required — 4 items

- [ ] **FE-c17b-be-reached-by** — C17b cannot be reached by anyone. The route and
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
- [ ] **FE-change-request-has-nowhere** — A change request has nowhere to say why.
      `amendmentRequestSchema` takes `requestedChanges` only, and
      `tournament_amendment_requests` has `rejection_reason` (the admin's) but
      no column for the requester's. The admin sees new values with no case for
      them, and FR-OM-01 asks for a reason on every rejection, which reads odd
      when the request itself cannot carry one. We removed the "Why" box rather
      than collect text that is thrown away.
- [ ] **FE-s06-accepts-whole-numbers** — S06 accepts whole numbers only, but the stat table
      says a stat can be a decimal or a boolean.
      `sport_stat_definitions.data_type` is `enum('integer','decimal','boolean')`
      and `GET /sport-types/:id/stat-definitions` hands that field to us, so the
      form builds its inputs from it. `statSchema` then takes
      `value: z.int()`, so a `decimal` stat (a time, an average) or a `boolean`
      one would be rejected with `VALIDATION_FAILED` at the moment somebody
      seeds it. Latent today — all 15 seeded definitions are `integer` — which
      is why this is a small ask now rather than a bug later: either widen the
      value to match the column, or drop the two values the API cannot carry.
- [ ] **FE-check-has-gone-through** — A check-in that has gone through cannot be undone,
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

## Already delivered

Kept so the same gaps are not reported twice.

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
      **Request form.** "Who may enter" now has a tick list of faculties and one
      of years 1–8, both optional, and a line underneath that names who will
      decide the request as you tick: the organising faculty's admin while the
      only faculty admitted is that faculty, a university admin the moment a
      second one is ticked or none is. That is `adminCoversEligibility` restated
      for the person filling the form, so they learn the queue changes hands
      before they send it, not after. Submitting ticked faculties 1 and 2 and
      year 2 wrote exactly those three rows.
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
