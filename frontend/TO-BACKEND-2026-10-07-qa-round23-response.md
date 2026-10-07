# FE response to QA Round 2 and 3 — 7 Oct 2026

Read both `TO-FE-2026-10-07-qa-response-round2.md` and `round3.md`.
Verified remote with ls-remote and fetched `BE_KN@7aae61f0c5fce1314528175db1f9566842e4c2b6`.
Only frontend files changed. The running local API supports the new DTOs; its exact runtime SHA is not exposed.
FE implementation commit: `eb9ad0c` on `feat/1`.

## Delivered contracts integrated / developer scope closed

- FE-05: authenticated self-leave with confirmation, leader restriction, server membership-lock feedback and own-team/member cache refresh. Real DELETE returns 204; leader 409, non-member 404 and approved-entry lock 409 verified.
- FE-11: safe search disambiguation using Player ID, nullable facultyName/year in player search, invitations, referee search and admin grants. No email or private contact added. Real search DTO verified.
- FE-08: FE DOB/year guards remain 1–8/no future DOB; BE confirms equivalent enforcement in Round 2. SMTP acceptance remains separate.
- Tournament detail now displays persisted nullable default bestOf. Individual match bestOf still controls score validation. Real stored BO5 readback verified.
- Cleared profile contact/address now sends null, with 255/2000 limits. Null readback and rejected over-limit writes verified live; omitted fields stay omitted.
- Accept BE limits: trimmed team name 1–150; announcement title 1–255/body 1–5000; score and prediction integers 0–999, also subject to match-specific BO rules.
- Real referee invitations send userId only. Server classification remains authoritative; no isExternal inference/write.
- TOURNAMENT_DATA_CONFLICT shows existing conflictingFields separately from requestedFields. INVALID_DATE_RANGE remains a new-input validation error.
- Amendment rejection/approval displays affectedTeamCount and affectedTeams/players/reasons when supplied. FE-39 remains partial for a normal approval preview: there is no preflight impact contract, and approved count is not an affected count.
- Amendment queue selfRequested warning + approval confirmation; history and audit selfApproved badges. Keep the delivered team policy permitting self-approval; no new FE prohibition.
- Login 429 uses retryAfterSeconds countdown and blocks repeated submissions during the interval. Tested with a controlled error, without hammering existing fixture accounts.
- Check-in/start time errors display server opensAt/closesAt in Bangkok time. Existing INSUFFICIENT_REFEREES feedback is retained; no client weakening of referee locks.
- Referee cannot dispute their own submitted result. Online submitted-result recovery points to editing; onsite asks another authorized referee/team leader.
- Abandoned match schedule/venue nulls are already handled by MatchPage and ScheduleTab fallbacks. No fabricated replacement schedule.
- Logout contract unchanged; local session/cache cleanup remains the FE responsibility.
- Migrations 046, 047 and 048 are present in local DB (read-only inspection); FE did not run migrations.

## Priority blocker: same-team reapplication is still rejected before any match

Fresh real-API reproduction at `2026-10-07T08:18:41Z`:

1. Create disposable badminton team **9034**, tournament **27**; approve/publish/open registration.
2. Register players **9101, 9003**, application **36**; approve it.
3. GET tournament matches returns **[]**, recorded before withdrawal.
4. Withdraw application 36 successfully, then POST the same team/player IDs again.
5. Actual: **409 PLAYER_ALREADY_REGISTERED**, message says players belong to another team. Expected: a new active application while retaining withdrawn history.

[API evidence](QA-ROUND23-2026-10-07-results.json) and [read-only DB evidence](QA-ROUND23-2026-10-07-reapply-db.json).
After withdrawal, application 36 is `withdrawn`, application_players is empty, and tournament 27 has no matches.
SHOW INDEX shows a **unique (tournament_id, team_id)** index named `tournament_id` on tournament_applications, covering historical rows too.
Source inspection: findExistingApplication checks only pending/approved, but insertApplicationWithPlayers catches **every ER_DUP_ENTRY** as null; service maps null to PLAYER_ALREADY_REGISTERED.
This strongly points to the historical team/application unique index rather than unreleased player reservations. Please verify the failing SQL/index directly and align uniqueness with active entries, preserving withdrawn history and concurrent duplicate protection. Distinguish the conflicting constraint when mapping duplicate errors.

The disposable team was soft-deleted, tournament closed/private, profile restored. IDs refer to this refreshed DB; do not confuse tournament 27 here with the older Round 2 sample having the same ID.

### Answer about old tournament 29

Earlier browser evidence showed “No matches yet”; the old flow created that tournament without drawing matches. The current reset DB has no tournament 29 or its matches, so its historical state cannot be queried now. The new reproduction above confirms failure with zero matches independently of that old sample.

## Answers to BE decisions / remaining requests

1. **Review opensAt: choose ข (B)**. Keep scheduled event-start meaning; deliver `openedBy: "event_start" | "first_match" | "completed"` with explicit nullability for not_started/unavailable states. FE follows status/canSubmit and now labels opensAt as scheduled tournament start, without promising that reviews open at that timestamp. New openedBy rendering waits for the actual DTO.
2. **MinIO fixtures: choose ข (B)**. Keep 9053 intentionally missing for 404 recovery; add a second valid object/account (e.g. 9054) and document both in baseline/minio-init. This remains BE/fixture-owner work; FE did not change seed or MinIO.
3. **Issue mapping correction:** FE-32 is eliminated-round standings; FE-38 is global reported-feedback/deleted history; FE-10 is request waterfall. The previous BE-30/BE-33/BE-18 pairings were wrong and removed. These FE numbers are not interchangeable with backend QA numbers. Please use the descriptions until the corresponding BE IDs are verified.
4. **maxMembers:** changed team roster wording to a limit per tournament entry, not a cap on the team's player pool.
5. **Profile clearing:** switched to null, verified as above.
6. **Self approval:** FE implements the delivered labels/confirmation policy. Any policy requiring a second admin remains a team decision with the staffing prerequisite stated by BE.
7. **Own-result error wording:** Round 3 suggests editing, but onsite override remains OVERRIDE_ONSITE_NOT_ALLOWED. Please make the server recovery message mode-aware; FE currently recommends another authorized referee/team leader for onsite.
8. Still needed: FE-32 standings eliminated round/outLabel; FE-38 global moderation/deleted-history read route; FE-39 preflight impact if the normal review screen must show impact before submission. FE-10 browser timing remains open.
9. Keep SMTP/login-verification gate acceptance, token-reset sessions, valid MinIO upload/expiry, full browser role workflows and real-device QA open. BE-13 invitation expiry, B2/B4/cancellation and identity-status consistency still need the team decisions listed in Round 3.

## Evidence and validation boundary

[Round 2/3 API results](QA-ROUND23-2026-10-07-results.json): **14 PASS / 1 FAIL**, including three cleanup checks. The failing check is the BE reapplication blocker above.
[Migration/old-ID inspection](QA-ROUND23-2026-10-07-db.json).
API checks use SSR-loaded real FE adapters against localhost with fixture-role sessions; they are not browser acceptance or independent QA sign-off. Old QA reports are retained as historical evidence, not merged into this round's pass count.

Developer verification: full suite **95 files / 559 tests passed**. Final login/review regression **2 files / 5 tests passed**. Lint and TypeScript/build passed; existing bundle warning remains (main 932.00 kB). Git diff whitespace check passed.

Reproduce using `LTMS_QA_PASSWORD` from the local fixture owner and `node scripts/live-qa-round23-2026-10-07.mjs --write` with a real-mode Vite proxy on port 5193. The script creates disposable records and cleans up its own records; rerunning before BE fixes the blocker intentionally exits nonzero.
