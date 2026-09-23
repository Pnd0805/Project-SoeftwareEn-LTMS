# LTMS — what the frontend still needs from the backend

Frontend branch `feat/1` · API base path `/api/v1`

**Current backend reference: `BE_KN` at `e5ea50d`, read on 2026-09-23.**
The bulk of this file was verified against the running server at `a88f7ad` on
2026-09-22, and the oldest items against `df506ea` on 2026-09-20. Every claim
names the route, schema, service or migration it was checked against, plus live
verification where recorded. A missing route is not claimed from an old branch
snapshot.

**Since the last file.** A1–A9, B2, B4–B9, public team search,
`GET /me/tournaments`, C17b access, amendment reasons and the integer-only stat
contract are delivered. Check-in revocation, match-mode validation, no-draw
result validation, full standings, explicit tournament completion, organizer
amendment history and atomic bracket replacement are also delivered; their
frontend wiring is complete in this branch.

- **B4** — the resolve panel offers the three real outcomes again. Match 9 was
  corrected from 3–2 to 3–1 through the UI and came back `verified` with
  `amended_by_user_id` set.
- **B6** — removed. Teams are reusable player pools; roster mutation remains
  blocked while any application is `approved`, including after its tournament
  completes. The frontend no longer infers release from tournament status.
- **B7** — the per-match referee probing is gone. It was not only slow, it was
  wrong: `somying@ku.th` used to see 2 of her matches and now sees all 10.
- **B9** — a venue-only edit works and leaves the times alone.

`FE-disputing-result-yet-verified` — the report that disputing a still-`submitted`
result answered 500 every time — **is closed.** Retested 2026-09-22 against
`a88f7ad`: `POST /matches/12/result/dispute` as the losing team's leader, on a
result with `status: submitted` and `verifiedAt: null`, answered
`200 {matchId: 12, status: "disputed"}`. The BR-14 first-moment path works. This
paragraph is kept because the previous revision of this file still called it
open.

**Added 2026-09-22.** Chasing seven user-reported regressions through the
running server at `a88f7ad` turned up three fields that are written and never
read back — `FE-replay-link-write-only`, `FE-checkin-reject-reason-not-listed`
and `FE-dispute-resolution-not-returned`. All three are the same shape: the
column exists, a write route fills it, the read route omits it from the response
shape, so a feature looks broken from the outside while the data is sitting in
the database. Each one is a line in a mapper. They are the last remaining cause
of two of the seven reports; the other five were ours and are fixed.

**Added 2026-09-23.** Four more from the R17–R23 triage: two authorization and
gating gaps on `POST /matches/:id/open-checkin`, the request-cancellation rule
that stops two referees holding one match, and the missing upload contracts for
avatars and team logos. Details at the end of the list.

**Retired 2026-09-23.** Six items this file still listed as owed arrived in the
same pull — C1 notifications, C4 tournament delete, C5 entry notes, C6 feedback
and MVP, C7 comments and Pick'em, C8 follows and career. They are struck through
at the end of the list rather than deleted, so nobody re-reports them. That took
the list from 15 to 9.

**Added 2026-09-23 (second pass).** `FE-referee-cannot-read-invited-tournament`,
found chasing a report that the referee invitation in the inbox would not open.
It is the same shape as the three read-route gaps above — the data is there, the
route will not show it to the one person who needs it — except here the missing
reader is a role, not a column. Back to 10.

**Added 2026-09-23 (third pass).** `FE-viewer-admin-scope-unknown`, from a
report that a faculty admin "does not seem to get auto-approved". The backend
rule is working exactly as written; what is missing is that no route tells the
frontend who the viewer is, so the form cannot say which side of the rule they
are standing on. Chasing the same rule into the admin queue then turned up
`FE-admin-queue-shows-undecidable-rows` (the queue and the approve guard filter
by different predicates, so every row a faculty admin sees currently refuses)
and `FE-reject-skips-eligibility-scope` (a faculty admin cannot approve those
requests but *can* decline them). 13 items.

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
- `HANDOVER-2026-09-22.md` is the short version written for both teams: what the
  seven regressions of 21 September turned out to be, and which of them are
  waiting on the three write-only fields listed below.
- `HANDOVER-2026-09-23.md` is the same for the seven reports of 23 September,
  and is where to start if you only read one file: it opens with the four new
  backend items, ranked, and says what we would like each one to return.

## Delivery required — 13 items

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
- [ ] **FE-replay-link-write-only** — `livestreamUrl` on M04/M05. E12
      `PUT /matches/:id/livestream` writes `matches.livestream_url` and the
      column has existed since the first schema, but **no route reads it back**
      — `grep livestream_url backend/src` returns exactly two hits, the E12
      `UPDATE` in `match.repo.ts:502` and the row type in `types/db.ts:193`;
      `toMatchDetailDto` does not include the field. Verified on match 7 at
      `a88f7ad`: saving `https://www.youtube.com/watch?v=…` returns 200 and the
      value is in the database, then `GET /matches/7` comes back without it, so
      the replay link vanishes from the match page on reload. This is the whole
      of the user-reported "replay link saves but never appears". The frontend
      now shows the link from the E12 response for the rest of the session and
      says out loud that it will not survive a reload;
      `BackendMatchDetailDto.livestreamUrl` is already declared optional, so the
      page starts working the moment the field is sent. One line in
      `toMatchDetailDto`.
- [ ] **FE-checkin-reject-reason-not-listed** — `rejectionReason` on M13
      `GET /matches/:id/checkins`. M15 requires a reason and stores it in
      `match_checkins.rejection_reason`, and M20 `/checkins/me` returns it to
      the player it is about — but `toCheckinListItemDto`
      (`mappers/match.mapper.ts:132`) leaves it out, so the referee console can
      never show why any row was rejected, including a reason the referee typed
      themselves a moment earlier. With OD-19 making revocation routine this is
      now the normal case, not an edge one. The frontend patches its own row
      from M20 as a partial stand-in; every other player's reason is blank.
- [ ] **FE-dispute-resolution-not-returned** — `disputeResolution` /
      `disputeResolvedBy` / `disputeResolvedAt` on S05
      `GET /matches/:id/result`. `resolveMatchResult` stores all three, and
      migration 020 made the organizer's note mandatory precisely so both
      squads learn why a result was upheld, amended or thrown out. S05 returns
      `winnerTeamId, scoreData, isAmended, amendedAt, amendReason, isWalkover,
      status, verifiedAt` and none of the dispute-resolution fields, so the
      mandatory note reaches nobody. Verified on match 9 at `a88f7ad`: a
      `reject` with the note "ยกผลทิ้งเพื่อตรวจสอบสถานะ" resolved fine and the
      note is in the row, but the two team leaders see a thrown-out result with
      no stated reason. The frontend renders `result.disputeResolution` already
      and gets `null` in real mode.
      **Extended 2026-09-23 (R21):** the same omission covers the *other* three
      dispute fields — `disputeReason`, `disputeRaisedBy`, `disputeRaisedAt`. An
      organizer opening the resolve panel is told a result is disputed without
      being told what the objection was, which is the one fact they need before
      choosing uphold, amend or reject. All six are now read optionally in
      `getResult()` with contract tests both ways, so sending them is the only
      remaining step.
- [ ] **FE-open-checkin-has-no-fixture-gate** — `POST /matches/:id/open-checkin`
      (R19). The service checks `match_status === 'scheduled'` and nothing else,
      so a match with no end time and no venue can be moved to `checkin_open` by
      a direct API call. That is a one-way door: M06 only edits a `scheduled`
      match, and FR02 `assertMatchChangeable` refuses a referee request without
      `scheduled_end_time`, so the match is then stuck with no fixture and no way
      to staff it. Enforce the three saved fields and answer with a named error
      listing what is missing. The frontend now disables the action and says
      which fields are absent, but that is a screen-side gate only.
- [ ] **FE-open-checkin-organizer-only** — `POST /matches/:id/open-checkin`
      (R20). Still `requireOrganizerOfMatch`. An active referee who has accepted
      that match cannot open its check-in, which is the person actually standing
      at the table. Wanted: organizer **or** the referee assigned to that match,
      keeping the fixture gate above and the atomic `scheduled → checkin_open`
      transition. The frontend seam is in place — `viewer.can.openCheckin` flips
      from `isOrganizer` to `isOrganizer || isReferee` in one line once this
      lands.
- [ ] **FE-second-referee-request-cancelled** — `refereeChangeRequest.repo.apply()`
      (R18). Applying one request runs
      `UPDATE referee_change_requests SET request_status = 'cancelled' … WHERE
      match_a_id IN (?) OR match_b_id IN (?)`, which closes **every** other open
      request touching that match — including an independent `org_add_match` for
      a different referee. An on-site match needs two accepted officials
      (BR-10), so the organizer invites two and the second one's Accept silently
      becomes a cancellation. Keep independent `org_add_match` rows open and
      cancel only the transfer/swap rows whose assumptions the apply actually
      invalidated. The frontend no longer reports a cancelled request as a
      successful Accept, so the symptom is now visible rather than silent, but
      two referees still cannot both accept one match.
- [ ] **FE-avatar-and-team-logo-uploads** — image uploads for people and teams
      (R23). `/uploads/presign` accepts only `checkin_document`,
      `soft_filter_document` and `referee_identity`, so there is no authorized
      way to upload a profile picture even though `users.profile_image_key`
      exists and `PATCH /me` takes `avatarUrl`; user mappers also hand back the
      raw S3 key rather than a readable URL. `teams` has no logo column at all
      and `PATCH /teams/:id` takes only name and visibility. Wanted: an avatar
      purpose plus a mapped readable URL, and a migration with a leader-only
      logo contract. Nothing on the frontend can start until these exist.
- [ ] **FE-referee-cannot-read-invited-tournament** — `getVisibleTournament`
      (`tournament.service.ts:178`). A tournament that is not `public` or
      `completed` is readable only by its requester and by an admin whose scope
      covers it. Referees are not on that list — not while invited, and not
      after accepting. But the order the product itself prescribes is *approve →
      appoint referees → publish*, so a referee invitation almost always arrives
      while the tournament is still `private`. Reproduced on 2026-09-23:
      invited 9003 to tournament 28 (`private`), then `GET /tournaments/28` as
      9003 → **404 TOURNAMENT_NOT_FOUND**, and the C1 notification
      "คุณได้รับเชิญเป็นกรรมการ" linked straight to that page, so the screen read
      *"That tournament doesn't exist"* about a tournament the letter in their
      hand had just named. Wanted: let a user with a row in `tournament_referees`
      for that tournament read it, at whatever status. Meanwhile the frontend
      drops the Open button on `referee_invited` notifications — the accept and
      decline the referee actually needs are in the same inbox page — so nobody
      is sent to a dead end, but a referee still cannot see what they are being
      asked to officiate before they answer.

- [ ] **FE-viewer-admin-scope-unknown** — nothing tells the frontend whether the
      signed-in user is an admin, or of what scope. `GET /me` returns
      `facultyId` (which faculty they *belong to*, unrelated) and no admin
      fields; `GET /admin/scopes` is still 404, as
      `FE-whole-admin-user-surface` already records. The consequence showed up
      on the tournament request form: `autoApproveIfOwnScope` approves on
      creation for an admin inside their own scope, so what happens when you
      press Send differs per viewer — and the one screen that has to set
      expectations cannot read the one fact that decides it. The default entry
      setting is "Every faculty", which is above a faculty admin's scope, so a
      faculty admin who fills the form the obvious way is queued every time and
      has no way to tell whether that is the rule or a fault. Verified
      2026-09-23 against `e5ea50d`: as `admin.eng@ku.th` (faculty 1),
      `POST /tournaments` with `organizingFacultyId: 1` and
      `eligibilityRules: [{faculty, 1}]` → `private, autoApproved: true`; the
      same request with no rules → `pending_approval`. Wanted: the viewer's own
      admin scope on `GET /me` (`adminScope: {scopeType, facultyId} | null`) —
      a read of one row the login already has the user id for. Meanwhile the
      form states the rule conditionally ("if that admin is you") instead of
      telling the viewer which side of it they are on.

- [ ] **FE-admin-queue-shows-undecidable-rows** — `GET /admin/tournament-requests`
      lists requests the caller is then refused permission to approve. The queue
      filters with `adminScopeWhere` (`tournament.repo.ts:175`), which for a
      faculty admin is only `t.organizing_faculty_id = ?`. Approving checks
      `adminCoversEligibility` as well, which additionally requires at least one
      faculty eligibility rule and every one of them to name that faculty. Two
      different rules, so the queue and the guard disagree by construction.
      Verified 2026-09-23 as `admin.eng@ku.th` (faculty 1): the queue returned
      three pending requests, all organised by faculty 1, **all three with no
      eligibility rules at all**, and `POST /tournaments/:id/approve` answered
      `403 ELIGIBILITY_OUT_OF_SCOPE` on every one. A queue where every row
      refuses is not a queue. Wanted: filter the list with the same predicate
      the guard uses — or, better, keep returning the row and mark it, e.g.
      `canDecide: boolean` plus a reason, so a faculty admin can still see that
      their own faculty has a request pending even when a university admin has
      to sign it. The frontend cannot filter these out on its own: the list
      carries no eligibility rules and nothing tells it the viewer's own scope
      (`FE-viewer-admin-scope-unknown`). Meanwhile it marks a row *after* the
      server refuses it and disables that row's Approve.
- [ ] **FE-reject-skips-eligibility-scope** — `rejectTournament`
      (`tournament.service.ts:310`) checks `getTournamentAdmin` but **not**
      `adminCoversEligibility`, while `approveTournament` checks both. So a
      faculty admin can decline a request they are explicitly not allowed to
      approve. Verified 2026-09-23 on a throwaway pending tournament organised
      by faculty 1 with no eligibility rules: as `admin.eng@ku.th`,
      `POST /tournaments/:id/approve` → `403 ELIGIBILITY_OUT_OF_SCOPE`, then
      `POST /tournaments/:id/reject` → `200 {status: "rejected"}`. Killing a
      request is at least as consequential as granting it, so if the eligibility
      scope is the right gate for one it is the right gate for the other. The
      frontend deliberately leaves Decline enabled, because the server does
      allow it and hiding a working control would be its own lie, but it warns
      on the row. Decide which way this should go — we will follow it.

### Delivered in the 2026-09-23 pull

- [x] ~~**FE-notification-list-mark-one**~~ — **delivered (C1).**
      `GET /me/notifications`, `PATCH /me/notifications/:id/read` and
      `POST /me/notifications/read-all` exist at `e5ea50d`; the real Inbox is
      wired to them.
- [x] ~~**FE-follows-plus-any-profile**~~ — **delivered (C8).**
      `GET /users/:id/followers`, `/following`, `/career`, `POST|DELETE
      /users/:id/follow` and `GET /me/following` exist at `e5ea50d`.
- [x] ~~**FE-tournament-feedback**~~ — **delivered (C6).**
      `POST|GET /tournaments/:id/feedback` and `/mvp-votes`, plus report,
      admin remove and restore.
- [x] ~~**FE-match-comments-pick-em**~~ — **delivered (C7), at tournament level.**
      Comments are `GET|POST /tournaments/:id/comments` with own-delete and
      organizer moderation, not the per-match path the SDS sketched (OD-24/25).
      Pick'em is `POST /matches/:id/predictions` with `/summary`, `/me`,
      `GET /me/pickem` and `GET /tournaments/:id/pickem-leaderboard`.
- [x] ~~**FE-entry-notes-soft-filter**~~ — **delivered (C5).** `entryNotes` is in
      the create and update schemas; migration `023_tournament_entry_notes.sql`.
- [x] ~~**FE-delete-tournaments-id-organizer**~~ — **delivered (C4).**
      `DELETE /tournaments/:id` exists at `e5ea50d`.

## Fix required — 0 open items

No independently confirmed behavior fix remains open. The four items added on
2026-09-23 (`FE-open-checkin-has-no-fixture-gate`,
`FE-open-checkin-organizer-only`, `FE-second-referee-request-cancelled`,
`FE-avatar-and-team-logo-uploads`) are capability gaps, filed under Delivery
required above; `FE-second-referee-request-cancelled` is the closest to a
behaviour fix, but what it needs is a narrower rule rather than a repair.

<!-- Historical FE-check-has-gone-through evidence retained for traceability:
      Previously, a check-in that had gone through could not be undone,
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
      The frontend can now expose the action after its contract wiring and
      real-browser regression check are complete. -->

## Already delivered

Kept so the same gaps are not reported twice.

- [x] ~~Backend delivery required: a match cannot end level~~ — settled by
      OD-20/`92857f1`. Every result names a winner and the winning aggregate
      score must be greater. The frontend removed Draw/Decider inputs.
- [x] ~~Backend delivery required: standings lacked real points and score
      totals~~ — delivered by `92857f1`. S12 now supplies `played`, `points`,
      `goalsFor`, `goalsAgainst`, `goalDiff` and duplicate-capable `rank`; the
      frontend uses them without sorting or deriving `wins * 3`.
- [x] ~~Backend delivery required: close a tournament~~ — delivered by
      `92857f1` as C14b plus completed public reads. The frontend exposes the
      explicit organizer close action and removes the all-matches workaround.
- [x] ~~Backend delivery required: organizer amendment history~~ — delivered by
      `a14d44c` as C09b and rendered with reviewer and rejection reason.
- [x] ~~Backend delivery required: atomically replace an unused bracket~~ —
      delivered by `a88f7ad` as M01 `replace: true`. The frontend confirms the
      destructive redraw, reports `BRACKET_IN_USE.matches`, and reminds the
      organizer to reassign match referees.

- [x] ~~Backend fix required: a check-in that has gone through cannot be undone~~
      — delivered by `dd70376`. M15 can revoke `success` and `exception`
      check-ins during the allowed review window, and a rejected participant
      can check in again. Service tests cover the wider reject path and retry
      behavior; frontend wiring and browser regression remain separate work.
- [x] ~~Backend fix required: participant check-in did not enforce the match
      mode~~ — delivered at the current remote head `88765c5`. M12 requires
      `qr_onsite` for on-site matches and `photo_online` for online matches,
      returning a specific validation error for a mismatched method. The
      endpoint guide and service regression tests were updated with it.
- [x] ~~Backend delivery required: public team list or team search~~ — delivered
      by `c11954c` as public/private team visibility, team search and join
      requests. The real-mode Search page can now be wired to it instead of
      `GET /me/teams` or prototype data.
- [x] ~~Backend delivery required: room code for an online match~~ — delivered
      as B8 by `2512e04` with migration 016 and
      `PUT /matches/:id/room-code`. `GET /matches/:id` returns the room code only
      to the organizer, assigned referee and members of the two participating
      teams.
- [x] ~~Backend delivery required: `GET /me/tournaments` with the full card DTO~~
      — delivered by `2512e04`. Backend work is complete; the frontend still
      uses the capped N+1 composition from public tournaments plus
      tournament-request ids and should migrate to this route separately.
- [x] ~~Backend fix required: C17b cannot be reached by anyone~~ — delivered by
      `c285918`. The requester can read their own non-public pending tournament
      and use `PUT /tournaments/:id/eligibility-rules` while it is pending.
- [x] ~~Backend fix required: a change request has nowhere to say why~~ —
      delivered by `d97db59` with migration 020. The amendment contract and
      storage now carry the requester's reason.
- [x] ~~Backend fix required: S06 accepts whole numbers only while definitions
      advertise decimal and boolean~~ — resolved by `d97db59` and migration 020:
      the backend chose the integer-only contract and normalized the schema,
      seed and stat reads to match it. The frontend must not offer unsupported
      decimal or boolean inputs.
- [x] ~~Backend delivery required: prevent an organizer or referee from competing
      in their own tournament~~ — delivered by the application-squad merge
      `43bacda`. Application submission returns `TEAM_CONFLICT_OF_INTEREST` for
      organizers/referees in the submitted squad, while referee invitation
      returns `ORGANIZER_CANNOT_BE_REFEREE` or
      `REFEREE_CONFLICT_OF_INTEREST` for the reverse order. The valid-squad and
      conflict flows were verified against the real backend on 2026-09-21.
- [x] ~~Backend delivery required: tournament list, detail, create, update,
      eligibility rules, announcements~~ — all delivered and wired, except the
      three listed separately (delete, entry notes and feedback). Route inventory
      re-checked against BE_KN `6ebda2e` on 2026-09-19; eligibility-rule writes
      were subsequently fixed by `c285918`.
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
      (`c43f497`), then superseded by the application-squad model in `43bacda`.
      `MEMBER_LOCKED_IN_TOURNAMENT` / `TEAM_LOCKED_IN_TOURNAMENT` remain while an
      application is approved; tournament completion does not release that lock.
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
