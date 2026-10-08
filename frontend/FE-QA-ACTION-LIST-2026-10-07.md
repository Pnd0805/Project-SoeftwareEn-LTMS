# Frontend QA / Notice — 7 ต.ค. 2026

อ่านครบ `FE-Notice/TO-FE-2026-10-07-sport-capability-and-changes.md`,
`FE-Notice/TO-team-2026-10-07-decisions-done-and-pending.md` และ
`FE-Notice/LTMS_QA_Issues_Frontend.md` (FE-01–FE-43)

ตรวจ remote ด้วย ls-remote และ fetch `BE_KN@8d161a6d25b1ebc501e1412bde37b911cfdea4de`
ฐาน frontend เดิม `7c8f187`. แก้เฉพาะ checkout frontend นี้

**ทำแล้ว = code implementation / developer checks ไม่ใช่ live QA sign-off.**
Round 7 (8 Oct), current: verified/fetched BE_KN@000d9ec; paginated pick'em, conditional external signup/nullable academic data and closure notifications integrated. FE-39 reviewer impact delivered at ce5f79f and integrated before admin confirmation. **42 implemented / 1 partial (FE-10 timing)**; focused fixture script/baseline delivery resolved, runtime application and SMTP/OTP enforcement remain open. Full developer checks: **101 files / 681 tests**, lint/build/diff check, isolated Vite 5197 HTTP module checks passed. [Current BE response](TO-BACKEND-2026-10-08-qa-round7-response.md).
Round 4 update: 41 implemented, 2 partial (FE-10 timing and FE-39 admin pre-approval impact), 0 waiting for the original standings DTO. These counts describe implementation, not QA sign-off.
Round 5: openedBy review copy and queue scope/403 handling implemented against BE_KN@234e4a1. Original counts remain 41 implemented / 2 partial. [Latest BE response](TO-BACKEND-2026-10-07-qa-round5-response.md).
Error/status follow-up: BE_KN@77039f6 separates match-state 409 MATCH_NOT_SCHEDULED from form 400 SCHEDULE_INCOMPLETE; FE recovery integrated with legacy 409 compatibility. Original counts remain 41 / 2. [Latest follow-up](TO-BACKEND-2026-10-07-error-status-response.md).
Round 6 (8 Oct): BE_KN@4b51af5 team-conflict metadata integrated across invite/accept/join requests; canonical 9053 missing-file fixture and identity-key 422 recovery updated. Original counts remain 41 / 2. FE-39 option A selected, awaiting reviewer route/schema. [Current BE response](TO-BACKEND-2026-10-08-qa-round6-response.md).
ทุก flow ยังต้องทดสอบกับ BE_KN จริงหลัง migration และ reload

## Notice วันนี้

- [x] `supportsBestOf` จาก GET /sport-types คุม Request/Fixture/MatchFormat และ mock reference; เลิก helper ที่เดาชื่อกีฬา
- [x] Unsupported sport ซ่อน selector; BO เดิมที่ผิดยังล้างด้วย `bestOf: null` ได้; whole-tournament มี confirmation และ server lock
- [x] `BEST_OF_NOT_SUPPORTED` รักษา server message/field errors; เอกสาร [API-CONTRACT-2026-10-07.md](API-CONTRACT-2026-10-07.md)
- [x] Root/University Admin Suspend ถูกปิดพร้อมเหตุผล; Reinstate ใช้กฎของ action เดิม
- [x] U11 `expired` ใน DTO/Profile; existing tournament work ยังทำต่อได้; ไม่ขอเอกสารถ้า docsRequired=false
- [x] UI เตือนเมื่อ approved.expiresAt อยู่ภายใน 30 วัน; ไม่ใช่ server notification ใหม่
- [x] Private-match 404 ส่งต่อและหยุด enrichment; session ที่มี token ยังแนบ Authorization ตามเดิม
- [x] /me 401 TOKEN_EXPIRED เปลี่ยนเป็น anonymous และล้าง token; login ใหม่ล้าง cache เดิม; logout 401 ล้าง local session ได้
- [x] Login 403 EMAIL_NOT_VERIFIED มีทางกลับ OTP; FE ไม่เปิด verification gate แทน BE
- [x] ตัดข้อความ automatic private-tournament deletion ที่ยังไม่มี implementation
- [ ] Live privacy: anonymous private URL + organizer/admin/referee access + stale session
- [ ] Live password reset: migration 046 แล้วตรวจ token เก่าและ login ใหม่ข้าม session
- [ ] Live identity/docs: MinIO จริง, link expiry 20 นาที, file missing, expired -> new invitation
- [ ] SMTP และ OTP จริงก่อนเปิด login verification gate

## FE-01–FE-43

| ID | สถานะโค้ด | การแก้ / ขอบเขต |
|---|---|---|
| FE-01 | ทำแล้ว | Progress ยอมปิดรายการเมื่อผลครบ รวม walkover ที่ไม่มี fixture |
| FE-02 | ทำแล้ว | Home badge/filter/count และฟอร์มสมัครใช้ธง/ช่วงรับสมัครเดียวกัน; วาดสายไม่ปิดรับสมัครเอง |
| FE-03 | ทำแล้ว | หัวหน้าเปิด Public ได้; search ยังคงอ่านเฉพาะทีมที่ API เปิดเผย |
| FE-04 | ทำแล้ว | Join request, leader approve/reject, คำขอของฉันและ cancel |
| FE-05 | Done | Round 2/3 self-leave, confirmation and cache refresh; real 204/leader/non-member/approved-entry lock verified |
| FE-06 | ทำแล้ว | หลังสมัคร refetch /me/applications และแสดงสถานะ; ตัดทีมที่ Pending/Approved ออกจากตัวเลือก |
| FE-07 | ทำแล้ว | Official supportingDocs มี preview/refresh/error และ confirmation ก่อนอนุมัติ |
| FE-08 | Done | FE DOB/year guards; BE confirms no future DOB and year 1-8 in Round 2; live registration/SMTP acceptance separate |
| FE-09 | ทำแล้ว | Review disclosure วันแข่ง/สนาม/จำนวนทีม/เงื่อนไขจาก API และ confirmation ก่อนอนุมัติ |
| FE-10 | บางส่วน | ตัด /me และ /me/teams ที่ไม่จำเป็นสำหรับ guest Match; lazy-load review details; ยังไม่ได้วัด waterfall จริง |
| FE-11 | Done | Player ID, public profile and nullable facultyName/year from safe search; no private contact; real DTO verified |
| FE-12 | ทำแล้ว | ใช้ A participant แทนการกล่าวว่าเป็นทีมเมื่อไม่มีข้อมูล actor |
| FE-13 | ทำแล้ว | Admin queue ใช้ calendar date ไม่ขึ้น 07:00 |
| FE-14 | ทำแล้ว | หน้าทัวร์แสดงวันเริ่ม–วันสุดท้าย |
| FE-15 | ทำแล้ว | วันที่ใช้ en-GB; timestamp กำหนด Bangkok, calendar date ไม่เลื่อนวัน |
| FE-16 | ทำแล้ว | Finished รอ completed จาก BE; ไม่เดาจากวันแข่งที่ผ่านมา; ชื่อสิทธิ์อ่านง่าย |
| FE-17 | ทำแล้ว | แก้ข้อความ Fixture error ที่ถูกตัดคำ |
| FE-18 | ทำแล้ว | โอนหัวหน้าทีมอธิบายว่าเฉพาะ Official |
| FE-19 | ทำแล้ว | เลิกแสดง VIA API เป็นแหล่งที่มาของใบสมัคร |
| FE-20 | ทำแล้ว | นับ fixture/referee เฉพาะแมตช์ที่ยังไม่ completed |
| FE-21 | ทำแล้ว | Login แสดง server error ของ credentials |
| FE-22 | ทำแล้ว | Forgot/reset password ภาษาไทยและสถานะครบ |
| FE-23 | ทำแล้ว | ตรวจสถานะทัวร์ก่อน Withdraw; completed ไม่มีปุ่มถอน |
| FE-24 | ทำแล้ว | Initial random draw มี confirmation; Cancel ไม่สร้างแมตช์ |
| FE-25 | ทำแล้ว | Dispute confirmation แสดง decision/score/reason ก่อนส่ง |
| FE-26 | ทำแล้ว | Guest player search มีคำแนะนำให้ sign in |
| FE-27 | ทำแล้ว | แก้ contactInfo/address/showProfileStats พร้อม save/error |
| FE-28 | ทำแล้ว | Guest /me gates, user admin-scope gate, stale guest guard, expiry handling และ login/logout cache clear |
| FE-29 | ทำแล้ว | Player-stat inputs มี accessible name |
| FE-30 | ทำแล้ว | Request validation มี aria-invalid/describedby และข้อความทุกช่องที่รายงาน |
| FE-31 | ทำแล้ว | Announcement create/edit/delete, 5 types, trim, confirmation, cache refresh |
| FE-32 | Done | Round 4 preserves server outLabel/null and published ranks; elimination shows undecided state for null, round robin has no elimination column |
| FE-33 | ทำแล้ว | Elimination dashboard ไม่โชว์ pts เป็นเกณฑ์จัดอันดับ; อันดับตาม BE |
| FE-34 | ทำแล้ว | กันประกาศว่างหลัง trim; legacy card ว่างมีคำอธิบาย; BE ต้องกัน direct API ด้วย |
| FE-35 | ทำแล้ว | /m/:id/pickem เปิด canonical community view |
| FE-36 | ทำแล้ว | Prediction closed แยก finished/completed กับ started |
| FE-37 | ทำแล้ว | Report user + evidence uploads และ admin paginated queue/decisions/confirmation |
| FE-38 | Done | Reported content per tournament plus paginated removed history; read by Faculty/University, Root denied; restoration from selected content and server canRestore, no manual ID required |
| FE-39 | Implemented | Organizer preview retained; admin now reads request-specific impact from the reviewer-authorized endpoint before confirmation, uses current stored changes/reason, displays supplied blockers/affected teams and blocks loading/error/already-decided approval. BE rechecks on POST; authenticated acceptance remains open |
| FE-40 | ทำแล้ว | Self guards และ Root/University suspension protection; Reinstate ไม่ถูกปิดด้วยกฎ Suspend |
| FE-41 | ทำแล้ว | Admin rights ค้นผู้ใช้ด้วยชื่อ/ID และแสดงชื่อระดับสิทธิ์ |
| FE-42 | ทำแล้ว | Audit page 20 records ใช้ server pagination เข้าถึงเกิน 100; search/filter ระบุ current page |
| FE-43 | ทำแล้ว | Notification preferences เคารพ locked critical; Stalled overview read-only และ scope gates |

## งานส่งต่อ BE / ทีม

รายละเอียด [TO-BACKEND-2026-10-07-frontend-qa-response.md](TO-BACKEND-2026-10-07-frontend-qa-response.md)

- [x] Migration 046 token_version และ 047 supports_best_of ยืนยันในฐาน local QA แล้ว
- [x] Round 2/3 self-leave, safe search, profile null clear, detail bestOf and amendment conflict impact delivered
- [x] Round 4 eliminated-round labels, removed-feedback history and organizer amendment preflight implemented
- [ ] Admin pre-approval impact for a reviewer who is not the organizer; consolidated reported queue remains optional additional work with no new route delivered
- [x] BE confirms birthday/year enforcement and announcement trim/limits in Round 2; live registration acceptance separate
- [ ] B2 Official membership single team/sport, B4 cleanup/4-year retention,
  cancellation, referee user_type/backfill และ rewards artwork/criteria ตามมติทีม
- [ ] วัด Network timing ของ Match/Fixture/Teams บน API ที่ทำงานจริง
- [x] Live API integration 66 checks: registration/approval/withdrawal, joins,
  uploads/report rejection, announcement CRUD, preferences, draw/BO and permissions
- [x] Browser login/reload/logout, profile/preferences, admin scope/cache,
  announcement create/edit/cancel, private tournament/match และ MinIO image preview
- [ ] Browser upload/CORS PUT, join conflicts, dispute decisions และ reset-token acceptance
- [ ] Mobile/light theme, manual draw, online mode และ real-device scanning

## Validation รอบนี้

- `npm.cmd test -- --maxWorkers=2`: **92 files / 543 tests ผ่าน**; `npm.cmd run lint`, `npm.cmd run build` (รวม TypeScript) ผ่าน; `git diff --check` ผ่าน. Build ยังมีคำเตือน bundle >500 kB (main 924.20 kB)
- Vite isolated port 5193: root, /admin/user-reports และ 4 modules ที่แก้ตอบ HTTP 200;
  หยุดเฉพาะ server ที่เริ่มรอบนี้แล้ว การโหลด HTML/module ไม่ใช่ browser flow acceptance
- Follow-up หลังผู้ใช้เปิด services: live API ผ่าน 66 checks; แก้ audit role gate;
  focused regression 4 files / 25 tests, lint/build ผ่าน (main 924.47 kB).
  [รายละเอียดผลจริงและ BE blockers](QA-LIVE-2026-10-07.md)
- Browser เชื่อมต่อ Chrome แล้ว; [ผล QA ตาม flow ที่ทดสอบจริง](QA-BROWSER-2026-10-07.md).
  แก้ checkbox layout และข้อความ announcement visibility เพิ่ม; focused 6 files / 27 tests,
  lint และ build ผ่าน (main 924.59 kB).
  ยังไม่ถือว่าปิด FE-01–FE-43 ทั้งหมด ไม่แก้ backend หรือรัน migration;
  ใช้ข้อมูล QA และคืนค่า/ลบประกาศทดสอบแล้ว
- คงการลบ HANDOVER-2026-09-22/23 และไฟล์ FE-Notice ที่มีอยู่เดิมไว้ตามสภาพเดิม

## Round 2/3 follow-up

Verified remote/fetched `BE_KN@7aae61f`. See [latest response](TO-BACKEND-2026-10-07-qa-round23-response.md). Real API: 14 PASS / 1 FAIL, including 3 cleanup checks. Reapplication fails with zero matches; SQL shows the unique tournament/team index covers withdrawn applications. Old QA reports belong to the earlier DB.

Validation: full suite 95 files / 559 tests passed; final login/review regression 2 files / 5 tests passed. Lint and TypeScript/build passed (main 932.00 kB; existing bundle-size warning). Git diff whitespace check passed.

## Round 4 follow-up

Verified remote/fetched `BE_KN@7e37d93`. [Current implementation and BE questions](TO-BACKEND-2026-10-07-qa-round4-response.md).
Developer verification: **96 files / 576 tests passed**, lint and TypeScript/build passed; existing 939.31 kB chunk warning. Isolated Vite 5194 served changed modules HTTP 200, then stopped. Browser/manual QA skipped as requested; prior live evidence remains historical.

## Round 5 follow-up

Verified remote/fetched `BE_KN@234e4a1`; implementation commit `65da597`. [Current closures and BE contract requests](TO-BACKEND-2026-10-07-qa-round5-response.md).
Developer verification: **97 files / 599 tests passed**, lint and TypeScript/build passed; existing chunk warning (main 941.47 kB). Isolated Vite 5195 served root/changed modules HTTP 200 and was stopped. Browser/manual QA excluded; no new live API acceptance pass claimed.

## Error/status conflict follow-up

Verified remote/fetched `BE_KN@77039f6`; implementation `579309f` integrates the delivered 400/409 split with optional missing metadata and legacy 409 compatibility. [Current BE response](TO-BACKEND-2026-10-07-error-status-response.md).
Developer verification: **97 files / 618 tests passed**, lint and TypeScript/build passed; existing chunk warning (main 943.27 kB). Isolated Vite 5195/root/changed modules HTTP 200, task-owned server stopped. No browser/manual QA or new live API acceptance pass claimed.

## Round 6 follow-up — 8 Oct 2026

Verified remote/fetched `BE_KN@4b51af5`; implementation `1a7d519` integrates team conflict metadata/recovery, canonical 9053 fixture and identity-key 422 retry guidance. FE-39 option A selected; reviewer read contract and focused DB fixture population remain BE handoffs. [Round 6 response](TO-BACKEND-2026-10-08-qa-round6-response.md).

Developer verification: **98 files / 639 tests passed** with 2 workers; lint, TypeScript/build and diff check passed. Initial concurrent QR test timeout passed in isolation and on full rerun without QR code/timeout edits. Existing main 944.22 kB chunk warning. Isolated Vite 5195 root/changed modules HTTP 200 and task-owned server stopped. Browser/manual QA and new authenticated API/device acceptance excluded.
