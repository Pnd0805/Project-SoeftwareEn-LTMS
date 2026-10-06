# To Backend / Team — Frontend QA response, 7 Oct 2026

Verified/fetched `BE_KN@8d161a6d25b1ebc501e1412bde37b911cfdea4de`.
Frontend baseline `7c8f187`; this response describes local FE changes, not deployed QA sign-off.
FE implementation commit: `5d031a9` on `feat/1`.

FE now integrates supportsBestOf, null clearing, protected Suspend, expired identity,
OTP recovery, token expiry/cache handling, public-team admission, profile/notification
settings, user reports, oversight, approval/dispute confirmations, announcement CRUD,
reported feedback per tournament, audit pagination and QA copy/accessibility fixes.
See [FE-QA-ACTION-LIST-2026-10-07.md](FE-QA-ACTION-LIST-2026-10-07.md)
and [API-CONTRACT-2026-10-07.md](API-CONTRACT-2026-10-07.md).

## Backend items still required

| FE issue | Evidence / request | FE behavior meanwhile |
|---|---|---|
| FE-05 | Current team routes have no authenticated self-leave endpoint; leader-only member deletion is not a substitute | No fabricated leave action |
| FE-08 / BE-05 | Register schema permits positive year without ceiling and does not reject future birthDateISO | FE uses 1–8, matching existing eligibility-year UI; please enforce DOB and confirm the year range centrally |
| FE-11 / BE-19 | /users/search returns UserRef only, no email/faculty discriminator | Show name, Player ID and public profile link; request safe disambiguation data, not private contact data |
| FE-32 / BE-30 | Standings mapper does not deliver eliminated round/outLabel and uses points/goals/wins ranks | Show published rank, omit misleading elimination pts copy and show Not provided for round |
| FE-34 / BE-29 | FE trims nonempty title/body; direct API still needs equivalent checks | Reject whitespace in FE, explain legacy blank cards |
| FE-38 / BE-33 | No global admin reported-feedback listing/deleted-history read route | Read reported comments + reviews per directory tournament; preserve known-ID restore as secondary confirmed action |
| FE-39 / BE-36 | Amendment reason exists; exact affected-team count is absent | Compare current detail/rules against requested changes; approved count is not represented as affected count |
| FE-10 / BE-18 | Local API and Chrome now reachable | Actual guest match adapter skips /me and /me/teams; browser waterfall profiling remains open |

## Environment / decisions / acceptance

- Migrations 046 and 047 confirmed with read-only SQL in local QA. No backend files/schema were changed; API tests created disposable records.
- Confirm SMTP/OTP end-to-end before enabling EMAIL_NOT_VERIFIED enforcement.
- B2 Official membership, B4 abandoned/private cleanup and 4-year retention,
  cancellation, referee user_type/backfill, rewards criteria/artwork still await team decisions.
  Removed UI claims of automatic deletion while behavior is not implemented.
- Authenticate real-role sessions and test reload/permissions, MinIO presigned links,
  new joins/approvals, report evidence, hidden stats, notification changes and token reset.
- Manual/mobile/light-theme/online/real-device QA remains independent of developer tests.

## Developer verification

`npm.cmd test -- --maxWorkers=2`: **92 files / 543 tests ผ่าน**; `npm.cmd run lint`, `npm.cmd run build` (รวม TypeScript) ผ่าน; `git diff --check` ผ่าน. Build ยังมีคำเตือน bundle >500 kB (main 924.20 kB)

Follow-up: **66 real API integration checks passed**, focused regression **25 tests**,
lint and build pass (main 924.47 kB). See [live QA evidence](QA-LIVE-2026-10-07.md).
Connected Chrome subsequently passed selected login/reload/logout, role/cache,
profile/preferences, announcement and private-access flows, plus MinIO image preview.
See [browser QA](QA-BROWSER-2026-10-07.md); browser upload/expiry, SMTP/reset and
the remaining acceptance flows are still open. Two additional FE fixes address
profile checkbox layout and announcement visibility wording.
Final focused regression: 6 files / 27 tests, lint and TypeScript/build passed
(main 924.59 kB; existing bundle-size warning).

## Suggested BE handoff order

Send this document with [live QA results](QA-LIVE-2026-10-07.md),
[reapplication repro](QA-LIVE-MATCH-2026-10-07-reapply-blocker.json) and
[browser QA](QA-BROWSER-2026-10-07.md).

1. Fix same-team/player reapplication after withdrawal (`PLAYER_ALREADY_REGISTERED`)
   while preserving withdrawn history and preventing duplicate active entries.
   QA team 9036 was subsequently cleaned up; reproduce with a fresh disposable team.
2. Return persisted nullable `bestOf` from tournament detail; verify POST/PATCH,
   reload and match inheritance agree.
3. Align nullable contact/address reads with clearing semantics in PATCH /me.
4. Deliver FE-05 self-leave and FE-32 eliminated-round DTOs, then the safe search,
   global moderation history and affected-team count contracts listed above.
5. Confirm DOB/year and whitespace validation plus SMTP/reset/identity expiry
   acceptance. Do not treat the FE developer checks as those server guarantees.

## Additional live findings

- Tournament detail omits `bestOf` despite persisted BO and match inheritance.
  POST/PATCH works; please expose the nullable stored value in GET detail.
- Same team/player reapplication after withdrawal fails `PLAYER_ALREADY_REGISTERED`.
  Tournament 29, team 9036, withdrawn application 37; retry transaction rolled back.
  Preserve the withdrawn history while releasing active player reservations;
  the current message incorrectly refers to another team.
- Contact/address GET null cannot be cleared by PATCH null (400); empty string
  works. Clarify/null-align the write contract. Test emptiness restored as empty strings.
- Faculty audit access correctly returns 403. FE now skips the query and explains
  the Root/University restriction rather than showing an error/retry panel.
