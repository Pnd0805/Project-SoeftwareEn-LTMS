# Frontend integration contract — BE_KN 7–8 Oct 2026

Latest verified remote/fetched head (Round 7): `000d9ec798b0774e304abee228ab1172ff1edb51`; FE-39 delivered at `ce5f79f`. Historical Round 6: `4b51af59850899fc999032f6d7632979b791ae0e`; error/status follow-up: `77039f6b0abb4767e194cde825dc5555cadf9c8f`.
Base URL: `/api/v1`. Source: today's TO-FE and current backend routes/services/mappers.

## Round 7 additions — 2026-10-08

- GET /tournaments/:id/pickem-leaderboard now returns items + pagination
  (page/pageSize/totalItems/totalPages). FE requests page + pageSize=20, keeps each
  page in its own query key, and displays server rank unchanged, including ties.
  BE normalizes invalid page values, defaults size to 20, caps it at 100, and caches
  results for 5 seconds. Refresh can still return cached results during this window.
- POST /auth/register requires fullName/email/password/gender/birthDate for all.
  Exact @ku.th (case-insensitive) also requires facultyId/departmentId/year (1–8).
  External requests omit all three; BE stores them as null and owns userType.
  Do not send null or invalid placeholder IDs: optional fields still validate if
  supplied. /me and public-user academic IDs allow null. KU student details remain
  a local second step, with one register POST after completion. OTP flow unchanged.
- tournament_auto_delete_warning belongs to immutable critical notifications;
  tournament_auto_deleted belongs to mutable tournament notifications. Both link
  via relatedEntityType=tournament and relatedEntityId. Critical stays disabled in
  settings regardless of a missing server lock flag.
- Private tournaments receive a warning 7 days before event start, then close as
  auto_deleted at event start with registration disabled. Scheduled cleanup runs
  hourly; hard purge is after 4 years. These are server jobs, not client timers.
  Migrations 051/052 are delivered; applying them to runtime DB is a separate check.
- GET /admin/amendment-requests/:requestId/impact is now delivered (option A).
  Response: requestId/tournamentId/tournamentName/status/requestedChanges/reason/
  selfRequested/alreadyDecided/canApprove/blockers[{code,message,details}]. Reviewer
  authorization matches queue scope: assigned Faculty or University Admin; Root,
  unassigned/out-of-scope Faculty return 403 INSUFFICIENT_ADMIN_SCOPE; absent request
  returns 404 AMENDMENT_NOT_FOUND. Already-decided requests return 200 with
  alreadyDecided=true, canApprove=false. Stored payload validation produces blockers;
  unexpected DB/system faults remain errors. Affected teams/counts are available
  in the AMENDMENT_BREAKS_APPROVED_TEAMS blocker, not invented for clean previews.
  FE reads only on opening confirmation, disables approval during loading/refresh/
  errors/blockers/already-decided states, and uses the response's stored changes.
  POST /amendment-requests/:id/approve still rechecks current rules/races.
- BE@000d9ec adds database/qa-fixture-9054.sql for focused population after migrate
  and updates baseline with 9054 + canonical 9053 key. 9053 must retain no object;
  9054 uses the PNG from minio-init. Delivery is confirmed; runtime application and
  authenticated preview/expiry acceptance are not claimed.

See [Round 7 handoff](TO-BACKEND-2026-10-08-qa-round7-response.md).

## QA Round 6 additions — historical

- HTTP 409 TEAM_CONFLICT_OF_INTEREST on POST /teams/:id/invitations,
  POST /invitations/:id/accept and POST /teams/:id/join-requests includes flat
  error.tournamentId, role, invitationStatus and expiresAt. ApiError.extra preserves
  these fields; there is no nested error.extra. Pending referee invitations allow
  decline/cancel/expiry recovery with the supplied Bangkok deadline. Accepted
  referee roles have expiresAt=null and require ending the incompatible role or
  choosing an eligible team/person; waiting does not solve them. Organizer has
  invitationStatus=null and expiresAt=null. Missing metadata does not imply pending.
- Fixture 9053 now uses referee_identity/9053/00000000-0000-4000-8000-000000009053.jpg.
  It still intentionally has no MinIO object. Fixture 9054 keeps the canonical PNG
  key delivered in Round 5. Tests preserve full signed URLs and missing-file recovery.
- PUT /me/referee-identity/docs and POST /referee-invitations/:id/accept (when docs
  are supplied) can return 422 REFEREE_IDENTITY_KEY_INVALID with flat objectKeys.
  BE accepts only the current user's referee_identity/<userId>/<UUIDv4>.jpg|png
  keys; FE treats the presign-returned key as opaque, uses purpose referee_identity,
  and uploads afresh on retry. BE does not check object existence at submission.
- At the Round 6 snapshot, reviewer-authorized amendment impact was undelivered. FE selected a read
  by request ID when opening review details (option A); no proposed endpoint is
  called until BE delivers its route/schema and scope checks.
- Server UTC changes do not change Bangkok timestamp display or calendar dates.
  Runtime/502/fixture acceptance requires separate evidence.

See [Round 6 handoff](TO-BACKEND-2026-10-08-qa-round6-response.md).

## Error/status conflict follow-up

- BE implemented option A after the notice: PATCH /matches/:id/schedule retains
  **400 SCHEDULE_INCOMPLETE**, while POST /matches/:id/open-checkin and /start
  now use **409 MATCH_NOT_SCHEDULED**. They describe different recovery actions.
- For 400, missing identifies required fields in the current schedule request.
  FE marks only known supplied fields with accessible descriptions, keeps the
  draft and resets stale server feedback when it changes.
- For 409, missing identifies absent stored match scheduling fields. Show
  organizer scheduling recovery; the organizer can open /m/:id/fixture.
  FR02 already uses MATCH_NOT_SCHEDULED without extra metadata, so missing is
  optional. Never infer a missing field from the message or assume all are absent.
- FE also recognizes legacy **409 SCHEDULE_INCOMPLETE** as match-state recovery
  for older running backend processes. **400 SCHEDULE_INCOMPLETE** remains a
  request error; same code/missing data must not cause the wrong recovery.
- USER_NOT_FOUND on target-user operations is 404, not a login redirect.
  Auth remains driven by HTTP 401; do not add endpoint errors for unreachable
  controller guards after requireAuth. Defensive 401 auth handling is preserved.
- NO_ACTIVE_DISPUTE: GET /matches/:id/result/dispute uses 404; POST
  /matches/:id/result/resolve uses 409. REFEREE_NOT_ASSIGNED: DELETE assignment
  uses 404; FR02 operations use 409. Preserve the route/status meanings.

See [FE handoff](TO-BACKEND-2026-10-07-error-status-response.md).

## QA Round 5 additions

- GET /tournaments/:id/feedback adds openedBy: event_start | completed | first_match | null.
  status remains not_started | open | closed; canSubmit remains the submission authority.
  opensAt is the scheduled tournament start, including when it is still in the future.
  Show that timestamp as an opening date only for open/event_start; first_match and
  completed use their delivered explanation without claiming the future date opened reviews.
  not_started may show the scheduled start; closed has no opening-date assertion.
  openedBy explains current availability, not the chronological first opening event.
- GET /admin/tournament-requests and /admin/amendment-requests return 403
  INSUFFICIENT_ADMIN_SCOPE for Root and faculty admins with no assigned faculty.
  Faculty with an assigned faculty and University Admin keep their normal queue access.
  Gate queue hooks/tabs from GET /me.adminScope, explain blocked deep links, and
  preserve 403 as an access error. Separate cached queues by actor and scope; hide
  stale rows and confirmation dialogs after scope changes or queue read errors.
  Root scope management, audit and existing oversight access remain available.
- BE fixture 9054 uses referee_identity/9054/00000000-0000-4000-8000-000000009054.png.
  IdentityDocs preserves the full HTTP presigned URL without object-key rewriting.
  Links still have a 20-minute lifetime. Fixture 9053 intentionally remains missing.
  Fixture delivery in seed/compose does not prove an existing local DB/bucket was updated.
- Round 5 did not add reviewer-authorized amendment impact or team invitation
  conflict status/expiry metadata. Round 6 delivers team metadata above; reviewer
  impact remains open.

## Sport BO capability

`GET /sport-types` items include `supportsBestOf: boolean`.
The frontend must not infer capability from a sport name or hardcoded ID.

- `POST /tournaments`, `PATCH /tournaments/:id/format`,
  `PATCH /matches/:id/format` reject non-null `bestOf` for unsupported sports.
- `bestOf: null` is allowed for every sport and clears legacy BO settings.
- Tournament format changes still obey server locks after play starts.

| HTTP | Code | Frontend behavior |
|---|---|---|
| 400 | BEST_OF_NOT_SUPPORTED | Show server message and field error for bestOf; offer clearing a legacy value |
| 403 | CANNOT_SUSPEND_ROOT | Root cannot be suspended; disable Suspend and retain server error for races |
| 403 | CANNOT_SUSPEND_UNIVERSITY_ADMIN | Root must revoke University Admin scope first; disable Suspend |

Backend AppError stores metadata in `extra.fields.bestOf`; the error middleware
spreads extra into the JSON error envelope (`error.fields.bestOf`).
`ApiError.fields` preserves this field metadata. Reinstate is a separate action;
the Suspend restrictions must not disable it.

## Session, visibility and referee identity

- Reset password increments token_version (migration 046). Old tokens get the
  existing `401 TOKEN_EXPIRED`; no new code or global-logout UI is required.
- Anonymous private/pending/rejected match/tournament reads return 404.
  Match detail uses `MATCH_NOT_FOUND`. Propagate errors, do not fall back to mock.
- `GET /me/referee-identity` supports `expired`, approvedAt/expiresAt,
  docsRequired and existing tournament approvals. Expired approval does not
  prevent finishing existing tournaments; a new invitation triggers fresh review.
- Frontend reminder threshold: 30 days before approved.expiresAt. This is UI copy,
  not a server reminder policy.
- `403 EMAIL_NOT_VERIFIED` sends users to the existing OTP flow when delivered.
  Login enforcement remains disabled server-side until SMTP acceptance passes.

## Delivered routes used by this QA implementation

- Team visibility PATCH /teams/:id; join requests GET/POST /teams/:id/join-requests,
  POST .../:rid/approve|reject; GET /me/join-requests; DELETE /me/join-requests/:rid.
- PATCH /me: contactInfo, address, showProfileStats.
- GET/PATCH /me/notification-prefs: server categories/locked flags; critical is immutable.
- POST /users/:id/report: reason + private evidence object keys from report_evidence upload.
- GET /admin/user-reports (page/pageSize), POST .../:id/approve|reject.
  Approval suspends the target; Root cannot review; faculty/university scope is server-owned.
- GET /admin/oversight/stalled: Root/University Admin read-only counts and IDs.
- GET /admin/audit-logs: page/pageSize supported; frontend requests 20 rows per page.
- Announcement create + PATCH/DELETE /announcements/:id, types general,
  schedule_change, venue_change, result, livestream.
- Reported comments GET /tournaments/:id/comments?reported=true; reviews GET
  /tournaments/:id/feedback; university-admin moderation uses existing feedback routes.

Missing routes/data and live acceptance are tracked in the QA checklist and BE response.

## QA Round 2/3 additions

- DELETE /teams/:id/members/me returns 204; leader 409 LEADER_CANNOT_LEAVE;
  approved entry 409 MEMBER_LOCKED_IN_TOURNAMENT; non-member 404.
- GET /users/search returns nullable facultyName/year in search items only.
  General UserRef and private contact exposure are unchanged.
- GET /tournaments/:id returns nullable stored bestOf; match.bestOf remains authoritative.
- PATCH /me accepts null to clear contactInfo/address. Limits 255/2000;
  omitted keys are preserved and empty strings are still strings.
- Team name trim/1–150; announcement title trim/1–255, body trim/1–5000;
  scores/predictions integer 0–999 plus match-specific BO restrictions.
- Real referee invitation payload omits isExternal; server classification controls identity.
- TOURNAMENT_DATA_CONFLICT extra: conflictingFields object/requestedFields array.
  AMENDMENT_BREAKS_APPROVED_TEAMS extra: affectedTeamCount, affectedTeams with
  teamId/teamName/players (userId/fullName/reason). No normal preflight impact promised.
- Amendment history selfApproved, admin queue selfRequested and audit details.selfApproved.
  Self approval remains permitted under the delivered team policy and explicitly labeled.
- Login 429 TOO_MANY_LOGIN_ATTEMPTS includes retryAfterSeconds and Retry-After.
- TOO_EARLY_FOR_MATCH extra scheduledTime/opensAt: check-in 60 min before,
  start 15 min before. TOO_LATE_FOR_MATCH extra scheduledTime/closesAt:
  check-in 60 min after. Start has no matching upper bound.
- Open-checkin also requires accepted referees. CANNOT_DISPUTE_OWN_RESULT prevents
  the submitting referee from disputing the same result; onsite editing remains restricted.
- Abandon clears scheduledTime/scheduledEndTime/venue to null.
- Review opensAt remains scheduled event start, not actual opening; status/canSubmit
  controls availability. FE chooses proposed openedBy addition, awaiting delivered DTO.
- Migration 048 deduplicates and enforces pending-request uniqueness. Logout token
  behavior remains unchanged; no global token-version bump introduced.

See [Round 2/3 response and live blocker](TO-BACKEND-2026-10-07-qa-round23-response.md).

## QA Round 4 additions

- Migration 049 scopes tournament/team application uniqueness to active entries.
  Duplicate active team application is ALREADY_APPLIED; player conflict remains PLAYER_ALREADY_REGISTERED.
- Migration 050 adds referee invitation expiry (7 days). Tournament referee **status**
  includes expired, while invitationStatus stays pending/accepted/rejected.
- Stale acceptance: REFEREE_INVITATION_EXPIRED with expiresAt. REFEREE_INVITATION_PENDING
  includes tournamentRefereeId/expiresAt. Registration conflicts include invitationStatus/expiresAt.
- CANNOT_DISPUTE_OWN_RESULT includes resultStatus/mode. Onsite submitted results can be
  resubmitted; online submitted results use correction with reason; verified results cannot use either path.
- Standings outLabel is string|null, unchanged rank/order; round robin deliberately null.
- POST /tournaments/:id/amendment-requests/preview uses the same requestedChanges/reason
  schema as submission, requires organizer, returns canSubmit/blockers[]/pendingAmendmentId without writes.
- GET /admin/feedback/removed?page=&pageSize= delivers items with content/rating/author,
  removal actor/role/time/reason and canRestore plus pagination. Read scoped to Faculty/University,
  Root forbidden; restoration still University only and server-owned canRestore controls the UI.
- openedBy and new MinIO fixture are still not delivered. Admin pre-approval impact for
  another organizer needs an authorized contract; the organizer preview is not that contract.

See [Round 4 response](TO-BACKEND-2026-10-07-qa-round4-response.md).
