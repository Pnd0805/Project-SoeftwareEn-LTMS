# Final_Present: integration with current frontend and backend

Date: 2026-10-09. This is an implementation and local verification record, not
authenticated browser, real-device or deployment sign-off.

## Verified sources and branch boundary

Remote heads were verified with `git ls-remote` and fetched before comparison.
The worktree was initially clean on `Final_Present`, tracking
`origin/Final_Present`. No branch switch, pull, history rewrite, commit or push
was performed. All integration changes are currently uncommitted.

| Source | Verified commit | Commits absent from Final_Present |
| --- | --- | ---: |
| Presentation starting point | `8d990b1a2dee3e0c34d258e2ce4f5a822cf27a5c` | — |
| `origin/feat/1` | `dd50305ca1dfce13c887c120b9abf03fa613aa44` | 40 |
| `origin/BE_KN` | `000d9ec798b0774e304abee228ab1172ff1edb51` | 7 |

These are diverged branches: presentation also contains changes absent from
the source branches. Integration used three-way merge results, with manual
resolution of frontend conflicts to retain the presentation layouts and its
existing access, error, draft, responsive and review behavior.

## Integrated behavior

| Area | Current behavior added or reconciled |
| --- | --- |
| Accounts | Two-step KU registration, personal-only external registration for emails outside exact `@ku.th`, optional academic DTOs, draft-preserving Back, server field errors returning to the appropriate step, password recovery/reset, OTP verification and persistent browser quota/cooldown feedback. No sign-in shortcut before OTP confirmation. |
| Profile and players | Server-classified external identity badges/document submission, privacy settings and notification categories, rewards display controls, hidden statistics/history, withdrawn-team history and MVP award counts separate from votes. |
| Match results | Captain mapping and badges, BO score formats, result entry during play with finish before submission, result corrections/overrides, original score display and correction notice, complaints/disputes and structured error recovery. Preserved review dialog and partial score/statistics failure feedback. |
| Referees | Identity document viewing and submission gates, invitation expiry/conflict recovery, match/tournament withdrawals, organizer decisions, cross-tournament coverage warnings and links to rescheduling/assignment actions. |
| Teams and tournaments | Join requests, leaving eligible teams, team logos, registration hard-filter details, lifecycle-aware entry, readable rule-change history, amendment previews and request-ID impact checks before admin approval. |
| Admin | Current scope gates and actor-isolated decisions, temporary/permanent suspension, user reports, stalled work, paginated audit, reported-feedback moderation, identifiable removed-feedback listing and confirmed restoration using server `canRestore`. |
| Pick'em and notifications | Team-ID score payloads, BO validation, actual awarded points and sport rules, paginated leaderboard preserving global ranks/ties, closure warning/auto-closure notification labels and categories. |
| Backend | Latest conditional external signup, paginated leaderboard/cache, scheduler jobs, BR-03 warnings/closure/retention deletion, amendment impact API, user-type classification migration, QA fixture delivery and performance reporting fixes. |

## Presentation behavior retained

All presentation CSS and assets remain byte-identical to the starting branch
except three additive checkbox/preference layout rules in `prototype.css`.
Existing lazy routes/chunks, navigation, responsive workspaces, account layout,
match summary/tabs, filters, draft retention, review dialogs and Draw workflow
remain in use. Missing UI is added within the same shared panels and controls.

The dedicated presentation verification page and Pick'em score draft were
extended instead of replacing them with the source branch's whole screens.
Admin now has two additional navigation destinations: user reports and stalled
work. Profile links expose the new rewards screen.

Backend snapshot audit: all 491 tracked upstream files are present and identical
except `docker-compose.yml`, which retains presentation-specific container
DB/SMTP connectivity and the monorepo frontend build context. All 68 tracked
upstream database files are identical. Presentation `demo-seed.sql` and
`seed-demo.py` remain preserved; neither was run.

## Local verification

See [machine-readable evidence](FINAL-PRESENT-SYNC-2026-10-09-evidence.json)
for final counts and local API paths checked.

- [x] Backend TypeScript and production build.
- [x] Backend unit suite: 170 files, 3,467 passed, 4 todo.
- [x] Backend MySQL/API integration suite: 28 files, 655 passed, 1 skipped.
  Used ignored `.env.test` with dedicated database `ltms_final_present_test`;
  the integration runner resets this test database only.
- [x] Development migrations: up to date, 52 migrations.
- [x] Read-only C1–C8 role audit: 0 conflicts on the current development data.
- [x] Frontend TypeScript and production build; lazy chunk sizes below 500 kB.
- [x] Frontend lint.
- [x] Frontend regression suite: 150 files, 1,097 passed; native exit code 0,
  no unhandled errors or test-environment warnings on the final run.
- [x] 22 live API smoke checks through Vite `/api/v1`, including public reads,
  paginated leaderboard, login/logout and permission-specific reads with the
  existing presentation University Admin, Faculty Admin and Root accounts.
- [x] Snapshot hash comparison and whitespace/conflict-marker checks.

No development data was restored, reseeded or manually repaired. Existing
accounts and role assignments were preserved. Smoke-test sessions were logged
out. Local frontend runs at `http://127.0.0.1:5173/` against this checkout's
backend on port 8000; `VITE_USE_MOCK=false`.

## Remaining acceptance and upstream limitations

- [ ] Browser screenshot/layout and authenticated interaction checks: the
  session's computer-use inventory returned no available browsers. The UI
  preservation claim above is based on source/asset comparison and DOM tests,
  not a visual browser inspection.
- [ ] Real camera QR scanning, MinIO document preview/expiry and FE-10 timing
  acceptance need their corresponding browser/device environments.
- [ ] Real external SMTP delivery and OTP login/protected-access enforcement
  remain upstream limitations at fetched `BE_KN@000d9ec`. Its login service
  still issues a token after password/suspension checks without checking
  `email_verified`. Hiding the shortcut in UI does not close that backend gap.
  No mail delivery or enforcement claim is made by this integration.
- [ ] Historical incoming QA screenshots/results and baseline fixture evidence
  are preserved as historical records; they are not new verification results
  for this presentation database. Fixture 9054/MinIO acceptance was not applied
  to the existing presentation fixture set.

## Development commands for this checkout

From `backend/`: `npm.cmd run migrate`, then the root-relative role audit
`python ../frontend/scripts/audit-roles.py`, then `npm.cmd run dev`.
From `frontend/`: `npm.cmd run dev -- --host 127.0.0.1`.

`frontend/scripts/restore-qa.py` now selects this monorepo before sibling
repositories unless `LTMS_BACKEND_DIR` is explicitly supplied. It is a database
restore tool and replaces data; do not run it merely to check the integration.

## Source commit inventory

The following lists are the commits absent from the starting presentation HEAD.

### feat/1

- [aed9274](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/aed92744c256f84df32d3f85e0a3cdaaf1cddd06) feat(frontend): follow the 4-5 Oct backend notices for results, Pick'em and profiles
- [ec06d53](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/ec06d53b28640230e9abd2b2fbc5e29c6fab5c68) fix(scripts): make restore-qa.py run the schema-034 baseline flow
- [5479e07](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/5479e073c37c86f73585e799d6ae448fba8845a4) feat(match): captain badge in lineup, immediate scoring on in_progress with auto-finish, and fixture BO format
- [6ceb282](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/6ceb282072251f775cf97575cf43ba8faf03bf0a) feat(match): export useSetMatchFormat and integrate with backend endpoint
- [5ef6ddd](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/5ef6dddff416a9b93415118ec350bccafffe4761) feat(frontend): lineup captain badge, immediate in_progress scoring with auto-finish, and fixture BO format
- [ffb561d](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/ffb561d5851f8f076152ff8fd1fa2893813912c1) feat(frontend): ensure captain mapping, auto-finish result form, and type fixes
- [0160958](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/01609589f7fadaa3beb4f86d4abe3be9df3085be) fix(match): setMatchFormat MatchRef typing and JSON payload
- [a667d66](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/a667d665627ec9d3735eff61824cef2e6f48d6ae) feat(match): rename community tab to Pick'em
- [be3cd87](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/be3cd873e6ad5c07f1f76c2f36659a6e02f43749) feat(auth): add email OTP verification flow on register and tests
- [e563210](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/e563210e6c170b44bbb444c351f11263b015a254) feat(admin): add permanent vs temporary suspension dropdown with required days
- [e436443](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/e436443466ebbc2d1b2dc000f1caf9459a6d37bd) feat(profile): display External (Approve) status badge after name
- [638313c](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/638313cd02ff9be8fb09e5a4e7ff5a6186e16737) feat(fixture): enhance schedule validation and display specific error reasons in Thai
- [0bc4105](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/0bc410589590c2f225fbcc7eff89e760367032d2) feat(tournament): display team logo in tournament registrations management panel
- [841616c](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/841616c2c047a08b324b404a83710bec8800951c) feat(match): show referee save success banner, Edit result button, and keep top score with notice
- [c3d5a04](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/c3d5a0434465b87df47b1d387f44a040f9f41277) fix(match): use submittedBy.id in MatchPage banner check
- [7be84f3](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/7be84f381aaf6dd50a4af4582e9484eb0112983f) feat(frontend): complete auth rewards and BO checklist flows
- [1208e20](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/1208e20e92a6c0f8a70b1cc5d3005c568c564bae) feat(frontend): complete referee identity and withdrawal workflows
- [30f0aa5](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/30f0aa5ced7475bf4fe8099f3bd066ef0109c68c) feat(frontend): show signed-in role beneath sidebar name
- [1237f61](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/1237f619fec8763478f9d8ed582c16a13c8c0c0f) feat(frontend): show schedule conflicts and withdrawn match history
- [422852e](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/422852e0c4f0c493a9ebbfcf5c6a6a77f3f382e2) feat(frontend): warn organizers about cross-tournament referee conflicts
- [d7db714](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/d7db714e63eed49a81f2850feabe5f4a1293f1ac) fix(auth): show hourly OTP request quota and persist cooldown
- [4825fd5](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/4825fd54efcfe8597e9d9a6bd23ce72da9b721b3) fix(auth): remove login shortcut before OTP verification
- [9c56040](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/9c56040d5d7b34a72f67cef1af7fc8122c2a2afb) feat(referees): honor server classification and document submission gate
- [7c8f187](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/7c8f187b25fc4f2e7c7dc09d83e7ca6b70ed40f3) feat(admin): open identity documents from AR01 signed links
- [5d031a9](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/5d031a9fd125f44dc75e28258d7f0ffe19edec4c) fix(frontend): address Oct 7 contract notices and QA workflows
- [b322a6b](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/b322a6b5f848dcf3dea5cc02d297e8618021cd4e) docs(qa): record live validation and backend follow-ups
- [eb9ad0c](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/eb9ad0c708343157503988361038095b9fa082b2) fix(frontend): integrate backend QA response rounds 2 and 3
- [8a17a20](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/8a17a200df3fb6426c26ec0f22cf2e509d58c640) docs(qa): answer backend rounds 2 and 3 with reapplication evidence
- [d2755b5](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/d2755b534bb1b554b796fb1a8745f8210b159486) feat(frontend): integrate backend QA round 4 contracts
- [7940cf6](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/7940cf6382fabbbae810730576bba7a1db7b959d) docs(qa): record round 4 closures and remaining backend contracts
- [65da597](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/65da5979541756dee8b78be8c0ec1491bf0cdf38) feat(frontend): integrate backend QA round 5 contracts
- [9962cea](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/9962cea8cfa575652a6a579f3c43d3874ac3b89c) docs(qa): record round 5 closures and backend handoff
- [579309f](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/579309fb9cc79823b5ade33ada7846ce00374d35) fix(frontend): distinguish schedule request and match state errors
- [dc59fb9](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/dc59fb93e48d17942501074b8862d71e4a957389) docs(qa): record error status contract integration
- [1a7d519](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/1a7d51907608250891845aa9bb40dc682a5200cc) fix(frontend): integrate QA round 6 conflict and identity recovery
- [a27a937](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/a27a9374bfebf01160649645eca83ae204fe17a5) docs(frontend): close delivered round 6 work and answer backend
- [31d52f0](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/31d52f0f888641e2f4abab4e0864ae16ca44b81d) feat(auth): separate personal and student signup steps
- [b5aee15](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/b5aee159f289d70ec67eb04fc35075f835f152e2) docs(auth): hand off external signup and SMTP OTP dependencies
- [6f6f658](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/6f6f658b27d2ea0ed9aae7f630d8bf2553581e13) feat: integrate Round 7 signup, leaderboard and amendment impact
- [dd50305](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/dd50305ca1dfce13c887c120b9abf03fa613aa44) docs: close Round 7 integration and record remaining backend acceptance

### BE_KN

- [22afba8](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/22afba87f0a5efdb320e3e76532d6e8aed4e06cf) fix(perf): รายงานบอกเวอร์ชันฐานผิด · CPU เป็น NaN · ด่าน log ไม่อ่าน [slow]
- [88d6651](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/88d6651098680b5f828d1ace216c0507e3f46445) perf(pickem): ตารางอันดับแบ่งหน้า + จำผลไว้ 5 วินาที (B3 ① · ②)
- [31c35a6](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/31c35a61d4e2cc21692de9730c9e2854e88f6078) feat(auth): คณะ/ภาควิชา/ชั้นปี บังคับเฉพาะคนใน @ku.th (ของเดิมข้อ 1 · มติ 8 ต.ค.)
- [01a5310](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/01a531027fbd6045c1e55a9e183b668393b13268) feat(jobs): งานกวาดรันตามเวลาแทนตอนมีคนเปิดหน้า + ปิดทัวร์ที่ยังไม่เผยแพร่ (③ · B2 ส่วนที่ 1)
- [0431ed8](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/0431ed89f7d968cba0a303e50994330a8b031015) feat(tournament): BR-03 ครบสามส่วน — เตือน 7 วัน · ปิด · ลบเมื่อครบ 4 ปี (มติ 8 ต.ค.)
- [ce5f79f](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/ce5f79fb1c4c86f89db27c8be1b039834f943084) feat(admin): แอดมินอ่านผลกระทบของคำขอแก้ไขด้วยเลขคำขอ (FE-39 · ทาง ก)
- [000d9ec](https://github.com/Pnd0805/Project-SoeftwareEn-LTMS/commit/000d9ec798b0774e304abee228ab1172ff1edb51) fix(qa): เติม fixture 9054 ลง baseline + สคริปต์เติมแบบไม่ reseed (FE ขอ)
