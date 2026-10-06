# FE response to the 3–5 October Checklist — 2026-10-06

## Follow-up to F14/U04 reply

- [x] Verified/fetched latest remote `BE_KN@c524726` (includes F14 `eba889a`).
- [x] F14 warning delivered in organizer Referees and Fixture: local match,
  referee name/ID, outside match count, local schedule and edit links. Query
  refresh follows schedule/assignment/result writes and every 30 seconds.
- [x] U04 option A acknowledged; frontend keeps API totals without recomputing.
- [ ] Live conflict/reload/removal acceptance and local historical U04 data
  consistency remain open in FEAT-1-REMAINING; no automatic recount is assumed.
- [x] BO capability flag question: FE would benefit from a server-owned flag
  in sport-types, so supported sports do not depend on display-name matching.
  Please propose its field name and semantics; current hardcoded BO support
  remains until an actual contract is delivered.
- [ ] External policy and tournament cancellation still need team decisions.
  The prior cancellation impact inventory remains applicable; this F14/U04
  delivery does not introduce or infer a cancellation status.

Verified target: remote `BE_KN@63045d17188cec87577122dc4146de423073abbf`.
Frontend implementation and developer checks are complete for Checklist A1–A6,
B1–B5 and C1–C4. Live acceptance stays open in `FEAT-1-REMAINING.md`.

- [x] D1: the email URL is `/reset-password?token=<64 hex>`; public, reads the
  query token unchanged and POSTs `{ token, newPassword }`. `/forgot-password`
  POSTs `{ email }` and uses neutral acknowledgement copy.
- [x] D2: predictions POST `{ scoreData: { '<teamId>': number, ... } }`.
  OD-69 supersedes B3: tolerance comes from the match, points from sport-types.
- [x] D3: resend uses a 60-second cooldown and 3/hour copy. HTTP 200 is described
  as request acceptance, not proof that an email was sent.
- [x] D6 interim artwork: FE uses the existing trophy icon as a fallback for all
  current null `iconKey` values. No new image assets or guessed storage URLs.
- [ ] D4: human-readable criteria beyond the delivered description remain a
  product/backend choice. FE currently displays the delivered name/description.
- [ ] D5: progress such as 7/10 is not in the inspected reward DTO. No progress
  is inferred from earned badge count or unrelated profile totals.
- [ ] D6 final artwork: decide the badge assets and their delivery/read contract
  before replacing the fallback.
- [x] U04: option A delivered in BE_KN@c524726; FE keeps server totals. Local
  historical-data acceptance/backfill stays open, without changing award criteria.
- [x] F14: counts delivered in BE_KN@eba889a; organizer Referees and Fixture
  display warnings. Live rescheduling/reload acceptance remains open.
- [x] External referee decision FE error: the user reproduced a synthetic 404
  thrown by the FE adapter after a successful backend decision. This FE defect
  is fixed and the user confirmed Approve plus assignment/acceptance/match access
  passed. Reject and organizer active-count persistence remain unconfirmed.

FR09 compatibility reads now handle `matchA: null` and show withdrawal reasons.
Withdrawal creation/management UI was subsequently delivered below. Local migration 045 was
subsequently applied during OTP recovery, as recorded below.

Validation: 70 test files / 446 tests passed with `--maxWorkers=2`; lint and build
passed. Vite startup and reset-password HTML HTTP 200 passed. No browser or email
delivery acceptance is claimed; existing main-bundle size warning remains.

## Subsequent local Auth acceptance — 2026-10-06

The user confirmed OTP/recovery email reception in local Mailpit and successful
password reset. The user also confirmed a different new password can log in,
the old password cannot, a used reset link cannot be reused, and incorrect or
expired OTP is rejected. These are user-reported runtime checks, separate from
the delivery-time developer validation above.

Local DB migrations 035–045 were applied successfully; the OTP table now exists.
Mailpit is available at `http://localhost:8025`. Local backend `FRONTEND_URL` was
aligned to the running frontend at `http://localhost:5173` and the watcher reloaded.
No backend source content was changed.

Still open: resend cooldown/quota, leading-zero OTP, expired reset link, and
external SMTP/inbox delivery. No additional feature acceptance is closed here.

## External referee decision follow-up — 2026-10-06

Fetched remote `BE_KN@8a75156f8102a2a091301817d62275ad3a00f1ab`; AR02 still
returns `{ userId, identityStatus, tournamentsUpdated }`, not a request-detail DTO.
FE now treats successful AR02/AR03 writes as acknowledgements instead of throwing
`NOT_FOUND`. The existing success flow refreshes the queue and referee reads;
match permission/list reads are also invalidated. No backend source was changed.

23 focused API/UI tests, lint and production build passed. Approve/Reject notices
and queue refresh are tested. The user subsequently confirmed the External
Approve retest passed on 2026-10-06. The reported Admin decision error is closed;
The user also confirmed assignment -> External acceptance -> match management
access succeeded on 2026-10-06. Reject with reason and organizer active-count
persistence after reload remain unconfirmed separately.

## Remaining FE workflow delivery — 2026-10-06

Target verified/fetched again: `BE_KN@8a75156f8102a2a091301817d62275ad3a00f1ab`.

- [x] U11-backed External Profile states, expiry/admin message, guarded initial
  document submission/resubmission using M16 purpose `referee_identity` and U12.
  Only JPEG/PNG, 1–5 files; submission waits for successful uploads and sends keys.
- [x] AR04 request-docs UI with a required reason (maximum 500 characters),
  queue refresh and document metadata. Approve/Reject still use AR02/AR03.
- [x] FR09 discriminated payloads, reason 5–500 characters, match/tournament
  withdrawal creation, organizer review/history with confirmation and latest reads.
  Requests remain pending until the organizer consents; stale/cancelled responses
  are not shown as successful withdrawal. Existing Inbox supports cancellation.
- [x] Amendment changes use readable values in both organizer and Admin screens.
- [ ] Required backend read contract: AR01 currently returns `docs: string[]`
  containing raw private keys. Neither refereeAdmin.routes nor upload.routes
  exposes an authorized download endpoint, and AR01 supplies no signed URLs.
  Please provide Admin-authorized, expiring read URLs for these files, with missing
  file/error responses. The FE shows count/names and does not open public storage URLs.
- [ ] Optional rewards criteria/progress/final artwork still require an agreed
  read contract/assets. Existing catalogue/descriptions/trophy fallback remain usable.
- [ ] User browser acceptance for these new flows remains deferred as requested.

Final developer validation: full suite passed 74 files / 464 tests; lint and
production build passed. The existing >500 kB main-bundle warning remains.
An isolated Vite server on 127.0.0.1:5189 returned HTTP 200 for Profile, tournament
referee management and the new component modules, then was stopped. This confirms
development serving, not browser or live-backend acceptance of the new workflows.

## ตอบ To-FE / To-Team รอบล่าสุด — 2026-10-06

ตรวจ remote และ fetch `BE_KN@7add50c47d48f1ba6c566836ff7ffbe098df148e` ก่อนทำงาน
ส่วนนี้เป็นสถานะล่าสุดที่ต่อจาก delivery ด้านบน ไม่ได้เปลี่ยนหลักฐานของรอบก่อน

### FE รับมาทำแล้ว

- [x] อ่าน `/me/matches` แบบไม่ส่ง `?role=` และใช้ `conflictingMatchIds`
  แสดงคำเตือน ชื่อทัวร์ เวลา บทบาท และลิงก์แมตช์ที่ชน ก่อนแบ่งกลุ่มผู้เล่น/กรรมการ
  รวมบทบาทซ้ำของแมตช์เดียว และไม่ทิ้งรายการแม้เกินขอบเขต enrichment เดิม
  ถ้าเวลาเริ่ม/จบไม่ครบ แจ้งว่าเทียบเวลาไม่ได้ ไม่แสดงว่าไม่มีเวลาชน
  หากอ่าน personal schedule ไม่สำเร็จ ใช้ error/Retry ไม่เปลี่ยนเป็นลิสต์ไม่มี conflict
- [x] รองรับ `REFEREE_TIME_CONFLICT_CROSS_TOURNAMENT` ในสองเส้นตอบรับ
  เก็บข้อความ BE และเพิ่มลิงก์ไปแมตช์เดิมจาก `conflictsWith.matchId`
  เพื่อใช้ FR09 ที่ส่งมอบแล้ว การเปิดแมตช์ไม่ใช่การถอนตัวทันที ยังต้องกรอกเหตุผลและรอ ORG
- [x] รองรับ `crossTournamentWarnings` หลังเชิญสำเร็จ บอกจำนวนแมตช์ที่ทับ
  พร้อมยืนยันว่าคำเชิญถูกส่งแล้ว ไม่เปิดชื่อ/รหัสทัวร์อื่น
  จอเชิญเข้า pool เดิมส่ง `matchIds: []` จึงตาม contract ได้ค่า 0 ตามปกติ
- [x] U14 มีป้าย Team withdrew อยู่แล้ว เพิ่ม RW05 Match history ในโปรไฟล์
  เจ้าตัวและโปรไฟล์สาธารณะ โดยคงผลแพ้ชนะ/สกอร์เดิมและป้ายถอนตัวต่อรายการ
  แยก hidden/null, empty, loading และ read error/Retry; ไม่รวมเลขใหม่แทน U04
  RW06 ยังไม่มีจอเฉพาะใน FE จึงไม่เพิ่มจอ/เรียก API นั้นเพียงเพื่ออ่าน field ที่เพิ่มมา

### คำตอบและคำขอถึง BE

- [x] `conflictingMatchIds` แบบ ID เพียงพอแล้ว: FE ใช้รายการเดียวกันหา object
  ไม่ต้องเพิ่ม `conflictsWith` ซ้ำในแต่ละแถว และยังไม่ขอ summary ตัวนับรวม
- [x] BE ส่ง F14 `crossTournamentConflicts: [{ userId, matchId, conflictCount }]` แล้ว
  เมื่อ ORG เลื่อนเวลาแล้วชนงานนอกทัวร์ โดยคืน [] เมื่อไม่มี conflict และไม่เปิดชื่อ/
  รหัสทัวร์อื่น FE เตือนให้ ORG ติดต่อกรรมการ พร้อมลิงก์แก้แมตช์ของทัวร์นี้
- [x] U04: BE ทำทาง ก แล้ว — ตอน verify นับใบ approved และ withdrawn ด้วย
  เพื่อให้ยอดรวมตรงกับ U14/RW05 รวมถึง amend/dispute ที่ยืนยันหลังทีมถอนตัว
  BE ยืนยันนิยามแล้ว; ยังต้องตรวจความจำเป็นของ recount/backfill จากฐานที่จะใช้งานจริง
  ตัวเลขฐานใน notice เป็น snapshot ของ BE ไม่ใช่การยืนยันฐานปัจจุบันจาก FE
- [ ] Admin เปิดเอกสาร External: ยังขอ authorized expiring read URL สำหรับ
  private identity keys พร้อมกรณีไฟล์หาย/หมดอายุ (ตาม blocker ด้านบน)
- [ ] Rewards criteria/progress/final artwork: ยังรอ read contract/assets ที่ตกลงกัน

### To-Team: ยกเลิกทัวร์ — ข้อเสนอ ไม่ใช่มติ

- [ ] FE เสนอ ข: เพิ่ม cancelled และคงด่าน delete ปัจจุบัน; ขอทีมตกลง
  ช่วงที่ยกเลิกได้ ผู้มีสิทธิ์ และผลต่อสถิติ/รางวัล/Pick'em ที่เกิดขึ้นแล้วให้ชัด
  ก่อน BE ส่ง migration, endpoint, DTO และ notification contract
- [x] ผลกระทบ FE: tournament status enum/mapper, list/detail badges และตัวกรอง,
  Manage/registration/fixture/match actions, เหตุผลและ confirmation,
  notification navigation และ career/history ที่ยังเปิดอ่านได้
  จอรายละเอียดปัจจุบันแยก public/private/completed; จอ cancelled ต้องเป็น
  หน้าประวัติที่อ่านได้ ไม่ใช่ใช้ 404 แทนหรือปล่อยปุ่มแก้การแข่งขันให้กดต่อ
- [ ] ยังไม่เพิ่มสถานะหรือยิง cancel endpoint ที่ BE ยังไม่ส่งมอบ
- [ ] Browser/live-backend acceptance ของ flow ใหม่ยังเปิด แยกจาก developer checks

Developer checks รอบนี้ผ่าน 78 files / 478 tests, lint และ production build
Vite แยก instance ที่ 127.0.0.1:5189 เปิด Matches/Profile และ modules ใหม่ HTTP 200
แล้วปิดเฉพาะ instance ที่สร้างตรวจ งานนี้ไม่เปลี่ยน source BE และไม่ปิด browser QA
ยังมีคำเตือนขนาด main bundle >500 kB เดิม
