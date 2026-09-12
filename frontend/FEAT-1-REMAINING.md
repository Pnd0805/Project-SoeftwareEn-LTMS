# Branch `feat/1` — Progress and Remaining Work

สถานะตรวจสอบ: 2026-09-09  
Branch: `feat/1-followup`  
Base: `origin/feat/1` at `bfeff01`  
Backend checked: `origin/backend` at `a46fa0a`  
Working tree: มีไฟล์ untracked นี้ไฟล์เดียว (`FEAT-1-REMAINING.md`)

## สรุปความคืบหน้า

- [x] Auth, Register, Logout และ route guard
- [x] Mock user persistence หลัง Register
- [x] Dropdown คณะและภาควิชาในหน้า Register
- [x] Inbox notifications และ unread badge
- [x] Player search ผ่าน API hook
- [x] Follow ผ่าน API/mock/hook
- [x] MVP voting ผ่าน API/mock/hook
- [x] Match comments ผ่าน API/mock/hook
- [x] Pick'em ผ่าน API/mock/hook
- [x] Tournament API foundation และ `useTournament`
- [x] Tournament announcements API/mock/hook
- [x] Tournament detail ใช้ API เมื่อเป็น numeric ID
- [x] Tournament entry count ใช้ applications จาก API ในหน้าที่รองรับ
- [x] Bracket renderer มี API renderer สำหรับ Match DTO
- [x] Register mock รองรับ Team ID แบบ legacy และ numeric
- [x] RefereePanel ใช้ referee API hooks สำหรับอ่าน เชิญ และถอดกรรมการ
- [x] HomePage ใช้ `useTournaments()` สำหรับรายการ tournament
- [x] `npm.cmd test` ผ่าน: 2 files, 10 tests
- [x] `npm.cmd run build` ผ่าน
- [x] `npm.cmd run lint` ผ่าน
- [!] Build มี warning: JavaScript chunk ใหญ่กว่า 500 kB หลัง minify

## สถานะ Backend ที่ยืนยันแล้ว

Backend มี implementation และ route แล้วสำหรับ:

- Auth, User, Reference data และ profile
- Team CRUD, members และ team invitations
- Tournament applications: list, detail, apply, cancel, withdraw, approve และ reject
- Tournament referee: invite, list และ referee invitation accept/decline
- Admin team official requests: list, approve และ reject

Backend ยังไม่มี route ที่พร้อมให้ frontend ใช้สำหรับ:

- Tournament list/detail/CRUD และ eligibility rules
- Tournament applications approve-all
- Referee coverage และ remove referee
- Match list/detail/result/draw/standings
- Team list หรือ `GET /teams?mine=true`

ดังนั้น frontend ต้องแก้ API contract ให้ตรง backend ก่อน และไม่ควรถือว่า
ทุก mock API ที่มีอยู่พร้อมยิงไป backend จริงแล้ว

## งาน Backend Integration ที่ต้องทำก่อน

- [x] แก้ `src/api/tournament.ts` ให้ตรงกับ application routes จริง
  - approve ใช้ `POST /applications/:id/approve`
  - reject ใช้ `POST /applications/:id/reject`
  - withdraw ใช้ `POST /applications/:id/withdraw`
  - cancel ใช้ `POST /applications/:id/cancel`
  - ไม่มี approve-all route ใน backend ปัจจุบัน

- [x] แก้ `src/api/team.ts` ให้ตรงกับ team/invitation routes จริง
  - ตรวจ `GET /teams/:id`, members และ team invitations
  - invitation response ใช้ `POST /invitations/:id/accept` หรือ `/decline`
  - `GET /teams?mine=true` ยังไม่มี backend route ต้องขอ contract ใหม่หรือใช้ endpoint อื่น

- [x] แก้ `src/api/admin.ts` ให้ใช้ official team request routes
  - `GET /admin/team-requests`
  - `POST /admin/team-requests/:id/approve`
  - `POST /admin/team-requests/:id/reject`

- [x] เพิ่ม/แก้ referee invitation hooks
  - `GET /me/referee-invitations`
  - `POST /referee-invitations/:id/accept`
  - `POST /referee-invitations/:id/decline`
  - คง coverage/remove referee เป็น backend blocker จนกว่าจะมี route จริง

- [ ] Reconcile DTO ให้ตรง response ของ backend
  - application/team/user IDs เป็นตัวเลข
  - application มี `team`, `tournament`, `tournamentId`, `status`, `hardFilterPassed`, `softFilterDocuments` และ `appliedAt`
  - ตรวจชื่อ field camelCase ทุกไฟล์ใน `src/types/`

- [ ] เพิ่ม integration smoke test โดยตั้ง `VITE_USE_MOCK=false` และใช้ backend `a46fa0a`

หมายเหตุ: รายการที่มี API แล้วแต่ยังมี fallback จาก `shared/store` ให้ถือว่าเป็น
`[~]` จนกว่าจะย้ายทุกเส้นทางหรือบันทึกเหตุผล fallback ไว้ชัดเจน

## Priority 1 — Slice 2 Read Path

- [x] `src/features/tournament/BracketTab.tsx`
  - Numeric tournament ใช้ API renderer (`ApiBracket`) ได้แล้ว
  - `ApiBracketNode` มี `data-next={m.nextMatchId}` แล้ว → `useBracketLines` วาด SVG connectors ได้
  - `stage`, `tag` มาจาก DTO ตรงๆ (server คำนวณชื่อรอบ)
  - `host` ref ถูกส่งผ่านจาก `BracketTab` → `ApiBracket` แล้ว → re-draw เมื่อ API data เปลี่ยน
  - Legacy renderer ยังมีสำหรับ prototype string-ID tournaments (fallback)

- [~] `src/features/tournament/RegisterForm.tsx`
  - **BACKEND BLOCKER** — Team member list และ eligibility data ยังไม่มี API
  - ยังใช้ store สำหรับ `tm.members`, hard filter, tournament lookup
  - รอ `GET /teams/:id/members` หรือ `GET /me/teams` ก่อน migration ได้
  - `useApplyToTournament` และ form submission ใช้ API แล้ว (mutation path ✓)

- [x] `src/features/tournament/manage/RegistrationsPanel.tsx`
  - Numeric tournament อ่าน `detail.applications` และใช้ application DTO แล้ว
  - String-ID fallback documented + intentional
  - approve, reject, allowWithdraw mutations ทำงานได้ทั้งสองทาง
  - Dual-source → `RegRow` unified ก่อนวาด JSX

- [x] `src/features/tournament/manage/ManageTab.tsx`
  - โครงสร้าง tabs ถูกต้อง, แต่ละ panel มี owner
  - `FeedbackPanel` อ่าน store เพราะ backend ยังไม่มี `GET /tournaments/:id/feedback` per-organizer
  - **BACKEND BLOCKER** สำหรับ FeedbackPanel — รอ feedback list API

- [x] `src/features/tournament/manage/SetupTrail.tsx` (Progress tab)
  - approved/pend counts ใช้ `useTournament(id).applications` สำหรับ numeric ID แล้ว
  - Store fallback สำหรับ string-ID prototype
  - match-level progress (`ms`, `ready`, `done`) ยังอ่าน store — **BACKEND BLOCKER** (Match list API)

- [x] `src/features/tournament/manage/DrawPanel.tsx`
  - entries มาจาก `detail.applications` (API) สำหรับ numeric ID แล้ว
  - draw mutation ใช้ API แล้ว
  - `drawStarted()` และ pre-filled draw order ยังอ่าน store — **BACKEND BLOCKER** (Match list API)

- [x] `src/features/tournament/manage/RefereePanel.tsx`
  - อ่าน coverage และ referees ผ่าน Slice 4 hooks
  - ใช้ `useAppointReferee` และ `useRemoveReferee`
  - ยังใช้ store เฉพาะรายชื่อผู้สมัคร เพราะยังไม่มี public user-search endpoint
  - ต้องยืนยัน ownership กับ Slice 4 และเพิ่ม answer-invitation flow ให้ครบถ้าหน้านี้รับผิดชอบ

- [~] `src/features/tournament/CommunityTab.tsx`
  - Feedback mutation ใช้ API แล้ว (`useSubmitTournamentFeedback`)
  - Feedback display อ่านจาก store (BACKEND BLOCKER — ไม่มี GET feedback list API)
  - Match threads section: **BACKEND BLOCKER** — ไม่มี Match list API และ Comments API
  - Blocker documented ด้วย comment ในโค้ด

## Priority 2 — Slice 1 Integration

- [~] `src/features/home/HomePage.tsx`
  - Tournament list ใช้ `useTournaments()` แล้ว
  - การจัดหมวด, registration count และ work queue ยังอ่าน store
  - ต้องรวม registrations และ teams จาก hooks ของ Slice 2/4

- [ ] `src/features/home/TournamentCard.tsx`
  - ยังเรียก `useLtms()`, `regsOf()`, `team()` และ `user()` โดยตรง
  - ต้องรับ DTO/view model และ counts จาก API/query

- [ ] `src/features/home/workQueue.ts`
  - ยังอ่าน state ของ tournaments, registrations, matches, referees, invites และ teams โดยตรง
  - ต้องแยกเป็น `pending*()` selector จากแต่ละ Slice แล้วให้ Home compose ผลลัพธ์

- [~] `src/features/search/SearchPage.tsx`
  - Player search ใช้ API แล้ว
  - Tournament และ Team search ยังอ่าน store
  - ต้องย้ายทั้งสองรายการไป Tournament API และ Team API

- [ ] `src/features/watch/WatchPage.tsx`
  - ยังใช้ `routeTour()`, `matchesOf()` และข้อมูล match จาก store ทั้งหมด
  - ต้องย้าย Tournament/Match data ไป API
  - ต้องรองรับ numeric DTO ID และ loading/error/empty states

- [~] `src/components/layout/Shell.tsx`
  - Notifications ใช้ `useNotifications()` แล้ว
  - Session/role, invites และ admin pending count ยังมาจาก store
  - ต้องใช้ `useMe()` เป็น source of truth และย้าย invites/count ไป API queries

- [~] `src/features/profile/ProfilePage.tsx`
  - User stats และ follows ใช้ API แล้ว
  - ยังมี `legacyUser` lookup, Career, Squad list, Pick'em และ MVP votes จาก store
  - ต้องย้ายข้อมูลที่เหลือไป API และลบ legacy lookup

## Priority 3 — Store Cleanup

- [ ] ตรวจและลบ `markAllRead`/`markRead` จาก `src/shared/store.ts` หลังผู้เรียกเก่าหมด
- [ ] ลบ Slice 1 mutations ที่ถูกแทนด้วย API แล้ว
- [ ] ลบ Slice 2 mutations หลังทุกหน้าสลับมาใช้ hooks
- [ ] ลบ `storeBridge.ts` และ bridge ที่เกี่ยวข้องเมื่อ DTO พร้อมทุกหน้า
- [ ] ลบ `shared/seed.ts` และ `shared/store.ts` เมื่อไม่มี legacy screen ใช้แล้ว
- [ ] ลบ selectors/rules ที่ไม่มีผู้เรียกหลัง migration

ยังไม่ควรเริ่ม cleanup ชุดนี้ เพราะหลายหน้าหลักยังมี store fallback อยู่

## Priority 4 — Tests และ Quality

- [ ] Auth และ Register persistence tests
- [ ] Follow tests
- [ ] MVP vote: หนึ่ง user ต่อหนึ่ง tournament
- [ ] Comments: post/remove/permission
- [ ] Pick'em: create/update/closed state
- [ ] Tournament detail/announcements/registration
- [ ] Permission tests สำหรับ Guest, User, Organizer และ Admin
- [ ] ตรวจ loading, empty, error และ mutation pending state ทุกหน้า
- [x] Build ผ่าน
- [x] Lint ผ่าน
- [x] Existing tests ผ่าน: 10 tests
- [ ] เพิ่ม integration flow ตั้งแต่ Guest ถึง Admin ก่อนเปิด PR

Backend มี test suite ของตัวเองแล้ว แต่ยังต้องเพิ่ม frontend API/hook tests
สำหรับ response และ error shape ที่ frontend ใช้งานจริง

ปัจจุบันมี focused test files เพียง:

- `src/components/kit/chips.test.tsx`
- `src/components/kit/Scorebug.test.tsx`

## Blockers ที่ต้องประสานทีม/Backend

- ต้องยืนยัน base URL, auth flow และ error response ก่อนเปิด `VITE_USE_MOCK=false`
- ต้องเพิ่ม Team list endpoint (`GET /teams` หรือ `GET /me/teams`)
- ต้องตัดสินใจ behavior ของ approve-all applications เพราะ backend ปัจจุบันไม่มี route นี้
- ต้องเพิ่ม referee coverage และ remove referee ถ้า frontend ยังต้องแสดง/ใช้สอง action นี้
- ยังไม่มี Tournament CRUD/detail/list และ Match/draw/result/standings routes บน backend branch นี้
- Prototype ใช้ string IDs แต่ backend ใช้ numeric IDs; migration ต้องมี adapter ชั่วคราว
- `workQueue.ts` ต้องตกลง contract `pending*()` ร่วมกันทุก Slice
- ต้องยืนยัน Venue coordinates และ Team `code`/`color` กับ backend response
- ต้องกำหนด owner เดียวของ Tournament-level referee management ระหว่าง Slice 2 และ Slice 4

## ลำดับทำงานถัดไป

1. แก้ API paths และ DTOs ให้ตรง `origin/backend` สำหรับ Team, Applications, Referee และ Admin
2. เชื่อม Register, RegistrationsPanel, TeamsPage, TeamPage, MatchesPage และ AdminPage กับ routes ที่มีจริง
3. เพิ่ม referee invitation accept/decline flow และทดสอบ permission/error states
4. รัน frontend กับ backend จริงด้วย `VITE_USE_MOCK=false` และแก้ contract mismatches
5. ขอ backend contracts ที่ยังขาด: team list, approve-all, referee coverage/remove
6. รอ Tournament และ Match routes ก่อนปิด `DrawPanel`, `BracketTab` และ `WatchPage`
7. หลัง API stable ค่อยทำ Home/workQueue, Search และ Profile integration
8. เพิ่ม tests ของ Slice 2, API hooks และ Guest/User/Organizer/Admin permissions
9. ลบ legacy store/bridge ทีละ domain หลัง real-backend smoke test ผ่าน
10. รัน `npm.cmd test`, `npm.cmd run build`, `npm.cmd run lint` แล้วเปิด PR

## Definition of Done สำหรับ `feat/1`

- [ ] หน้าที่รับผิดชอบอ่านผ่าน hook/API หรือมี fallback ที่มีเหตุผลและทดสอบแล้ว
- [ ] ไม่มี mutation ใหม่เพิ่มใน `shared/store.ts`
- [ ] Mock behavior ไม่เป็น no-op และไม่หายหลัง mutation
- [ ] Query key อยู่ใน namespace ที่ถูกต้อง
- [ ] Loading/error/empty/mutation-pending state ครบ
- [ ] Feature และ permission tests ผ่าน
- [x] Build ผ่าน ณ วันที่ตรวจสอบ
- [x] Lint ไม่มี error ณ วันที่ตรวจสอบ
- [ ] PR review ผ่าน
