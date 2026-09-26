# 06 — Endpoint Reference (MVP 107 endpoint)

> **เปิดไฟล์นี้ค้างไว้ตอนเขียนโค้ด** — รวมทุกอย่างที่ต้องรู้ต่อ 1 endpoint ไว้ในบรรทัดเดียว
> ทุก path ละ prefix `/api/v1` ไว้ → `POST /teams` = `POST /api/v1/teams`
> ต้องการ schema ละเอียดกว่านี้ → เปิด `API_Design/Part1-4/MD/LTMS_API_Design_Part3.md` ค้นด้วยรหัส (เช่น `### T01`)

## ความหมายคอลัมน์ Auth

| สัญลักษณ์ | middleware ที่ต้องใส่ใน route                     |
| --------- | ------------------------------------------------- |
| `—`       | ไม่ต้องใส่อะไร (สาธารณะ)                          |
| `Auth`    | `requireAuth`                                     |
| `TL`      | `requireAuth` + `requireTeamLeader`               |
| `ORG`     | `requireAuth` + `requireOrganizer`                |
| `REF`     | `requireAuth` + `requireReferee`                  |
| `ADM-f`   | `requireAuth` + `requireAdmin('faculty')`         |
| `ADM-u`   | `requireAuth` + `requireAdmin('university_wide')` |

**ทุก endpoint ที่มี request body ต้องใส่ `validate(xxxSchema)` นำหน้าเสมอ**

---

# 1. Auth — 3 endpoint

**ไฟล์:** `routes/auth.routes.ts` · `controllers/auth.controller.ts` · `services/auth.service.ts` · `repositories/user.repo.ts` · `schemas/auth.schema.ts`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| A01 | `POST /auth/register` | — | สมัครสมาชิก · เช็คอีเมลซ้ำ · hash รหัสผ่าน | `fullName, email, password, gender, birthDate, facultyId, departmentId, year` | **201** `{ id, fullName, email }` |
| A02 | `POST /auth/login` | — | ล็อกอิน · เช็ค `is_suspended` · ออก JWT | `email, password` | **200** `{ accessToken, expiresIn, tokenType, user{id,fullName,userType} }` |
| A03 | `POST /auth/logout` | Auth | ไม่ทำอะไร (ไม่มี session ฝั่ง server) | — | **204** |

---

# 2. Users & Profile — 11 endpoint

**ไฟล์:** `routes/users.routes.ts` · `routes/me.routes.ts` · `user.controller.ts` · `user.service.ts` · `user.repo.ts` · `follow.repo.ts` · `career.repo.ts` · `playerStat.repo.ts` · mappers

| รหัส | Method + Path          | Auth | ทำอะไร                                            | รับ                                  | คืน                                                                                                                                                     |
| ---- | ---------------------- | ---- | ------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U01  | `GET /me`              | Auth | โปรไฟล์ตัวเอง (มีข้อมูลส่วนตัว)                   | —                                    | `{ id, fullName, email, gender, birthDate, facultyId, departmentId, year, avatarUrl, contactInfo, address, totalPoints, notificationPrefs, createdAt }` |
| U02  | `PATCH /me`            | Auth | แก้โปรไฟล์ · **allowlist 3 field เท่านั้น**       | `avatarUrl?, contactInfo?, address?` | เหมือน U01                                                                                                                                              |
| U03  | `GET /users/:id`       | Optional | โปรไฟล์สาธารณะ · **ไม่มี email/contact/address** · ถ้ามี token จะคืนสถานะ follow ของ viewer | — | `{ id, fullName, avatarUrl, facultyId, departmentId, teams[], followerCount, isFollowing }` |
| U04  | `GET /users/:id/stats` | —    | สถิตินักกีฬา + totals ของหน้า profile | — | `{ userId, overall{matchesPlayed,wins,losses,winRate,championCount}, bySport[], mvpVotes, pickemPoints, followerCount }` |
| U06  | `GET /users/search?q=` | Auth | ค้นคนเพื่อเชิญเข้าทีม · ชื่อ (บางส่วน) หรืออีเมล (ขึ้นต้น) · `q` ≥3 ตัว · **LIMIT 20** | `?q=` | `{ items: [{id, fullName, avatarUrl}] }` |
| U07  | `POST /users/:id/follow` | Auth | ติดตามผู้ใช้แบบ idempotent · ห้าม follow ตัวเอง | — | `{ userId, isFollowing:true, followerCount }` / **409** `CANNOT_FOLLOW_SELF` |
| U08  | `DELETE /users/:id/follow` | Auth | เลิกติดตามแบบ idempotent · ห้าม target ตัวเอง | — | `{ userId, isFollowing:false, followerCount }` / **409** `CANNOT_FOLLOW_SELF` |
| U09  | `GET /users/:id/followers` | — | รายชื่อผู้ติดตามโปรไฟล์นี้ | — | `{ items:[{id,fullName,avatarUrl}], count }` |
| U10  | `GET /users/:id/following` | — | รายชื่อผู้ใช้ที่โปรไฟล์นี้ติดตาม | — | `{ items:[{id,fullName,avatarUrl}], count }` |
| U13  | `GET /me/following` | Auth | รายชื่อผู้ใช้ที่ฉันติดตาม · C8 ยังไม่ทำ feed/notification | — | เหมือน U10 |
| U14  | `GET /users/:id/career` | — | ประวัติแยก Tournament จาก **approved application** · played/win/loss นับเฉพาะผล `verified` (walkover ไม่ถือว่าลงสนาม) | — | `{ items:[{tournament:{id,name,sportTypeId,status}, team:{id,name}, played,wins,losses,champion}] }` |

> **U01 กับ U03 ห้ามใช้ mapper ตัวเดียวกัน** — พลาดครั้งเดียวอีเมลรั่วทั้งระบบ
> **U06** ถ้า `q` สั้นกว่า 3 → **400** `QUERY_TOO_SHORT`

---

# 3. Reference Data — 4 endpoint

**ไฟล์:** `routes/reference.routes.ts` · `reference.controller.ts` · `reference.service.ts` · `faculty.repo.ts`, `sportType.repo.ts`

| รหัส | Method + Path                           | Auth | ทำอะไร                                      | รับ | คืน                                                                             |
| ---- | --------------------------------------- | ---- | ------------------------------------------- | --- | ------------------------------------------------------------------------------- |
| R01  | `GET /faculties`                        | —    | รายชื่อคณะ                                  | —   | `{ items: [{id, name}] }`                                                       |
| R02  | `GET /faculties/:id/departments`        | —    | ภาควิชาในคณะ                                | —   | `{ items: [{id, name, facultyId}] }`                                            |
| R03  | `GET /sport-types`                      | —    | ประเภทกีฬา + จำนวนสมาชิกขั้นต่ำ/สูงสุด      | —   | `{ items: [{id, name, minMembers, maxMembers, defaultMode}] }`                  |
| R05  | `GET /sport-types/:id/stat-definitions` | —    | รายการสถิติที่กีฬานี้ต้องกรอก (ใช้ก่อน S06) | —   | `{ items: [{statDefinitionId, statKey, statLabelTh, dataType, displayOrder}] }` |

> ข้อมูลกลุ่มนี้ **seed ผ่าน SQL ไม่ใช่ API** — ไม่มี POST/PATCH

---

# 4. Teams — 18 endpoint

**ไฟล์:** `routes/team.routes.ts` + `routes/invitation.routes.ts` + `routes/admin.routes.ts`
`team.controller.ts` · `team.service.ts` · `team.repo.ts`, `teamMember.repo.ts`, `teamInvitation.repo.ts`, `teamAdminRequest.repo.ts` · `team.mapper.ts`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| T01 | `POST /teams` | Auth | สร้างทีม → `Forming` · **transaction** (teams + team_members) · BR-05 | `name, sportTypeId` | **201** `{ id, name, sportTypeId, readinessStatus:'Forming', leaderId }` |
| T02 | `GET /me/teams` | Auth | ทีมของฉัน (ไม่ paginate) | — | `{ items: [{id, name, sportTypeId, readinessStatus, officialStatus, memberCount, role}] }` |
| T03 | `GET /teams/:id` | — | **20 ก.ย.**: มี `visibility` (private/public) + `maxMembers` (เพดานตามกีฬา — แสดง `memberCount/maxMembers`) · ข้อมูลทีมสาธารณะ | — | `{ id, name, sportTypeId, readinessStatus, officialStatus, leader, memberCount, createdAt }` |
| T04 | `PATCH /teams/:id` | TL | เปลี่ยนชื่อทีม · **20 ก.ย.**: `visibility:'private'\|'public'` (default private = เข้าได้ทางคำเชิญเท่านั้น · public = ใครก็ขอเข้าได้ T20) · ถ้า official แล้วต้องบันทึกประวัติ + แจ้ง ORG | `name?` | เหมือน T03 |
| T05 | `DELETE /teams/:id` | TL | **soft delete** · ล็อกถ้าทีมมีใบสมัคร **`approved`** หรือสร้างสายแล้ว (เงื่อนไขเดียวกับ T08 — Q2-ค, แก้ 21 ก.ย.) ต้องถอนทีม (P08) ก่อน · ใบสมัคร pending ที่เหลือถูกปลดผู้เล่นให้ | — | **204** / **409** `TEAM_LOCKED_IN_TOURNAMENT` `{tournaments:[{tournamentId,name}]}` |
| T06 | `GET /teams/:id/members` | Auth | รายชื่อสมาชิก (ไม่มี contactInfo) · **ORG/กรรมการของทัวร์ที่ทีมสมัคร**ดูได้ด้วย (เช็คอินด้วยมือ) | — | `{ items: [{userId, fullName, avatarUrl, position, joinedAt}] }` |
| ~~T07~~ | ~~`PATCH /teams/:id/members/:uid`~~ | — | **ถอดออก 19 ก.ย. (มติ ทีม = คลังผู้เล่น)** — ไม่มีตัวจริง/สำรองในทีม · ใครลงแข่งดูที่รายชื่อใน P01 (`playerIds`) / M21 | — | 404 |
| T08 | `DELETE /teams/:id/members/:uid` | TL | ถอดสมาชิก · **คำนวณ Ready→Forming ใหม่** · **Q2-ค (20 ก.ย.)**: คนที่มีชื่อในรายชื่อลงแข่งของใบสมัคร `approved` (หรือทัวร์สร้างสายแล้ว) → **409** `MEMBER_LOCKED_IN_TOURNAMENT` + `tournaments[]` ต้องถอนทีม (P08) ก่อน · ใบสมัคร `pending` → ลบได้ ชื่อหลุดจากรายชื่อ + แจ้งเตือนหัวหน้าถ้าเหลือไม่ถึง min · คนในคลังที่ไม่ได้ลงแข่ง → ลบได้เสมอ | — | **204** |
| T09 | `POST /teams/:id/invitations` | TL | เชิญเข้าทีม · **ทีม = คลังผู้เล่น**: เข้าคลังได้เสมอ ไม่ล็อก ไม่มีเพดาน (Q2-ค/Q3-ก) | `invitedUserId` | **201** `{ id, invitedUserId, status:'pending', expiresAt }` |
| T10 | `GET /teams/:id/invitations` | TL | ดูคำเชิญทั้งหมดของทีม | — | `{ items: [{id, invitedUser, status, createdAt}] }` |
| T11 | `DELETE /teams/:id/invitations/:iid` | TL | ยกเลิกคำเชิญที่ยังไม่ตอบ | — | **204** / **409** `INVITATION_ALREADY_ANSWERED` |
| T12 | `GET /me/invitations` | Auth | คำเชิญที่รอฉันตอบ | — | `{ items: [{id, team, invitedBy, expiresAt}] }` |
| T13 | `POST /invitations/:id/accept` | Auth | รับคำเชิญ · **ทีม = คลังผู้เล่น**: เข้าคลังได้เสมอ ไม่ล็อก ไม่มีเพดาน (Q2-ค/Q3-ก) | — | `{ teamId, teamReadinessStatus }` |
| T14 | `POST /invitations/:id/decline` | Auth | ปฏิเสธคำเชิญ | — | **204** |
| T15 | `POST /teams/:id/official-request` | TL | ขอเป็นทีม Official → `pending` | `supportingDocs: string[]` (S3 key) | **201** `{ id, status:'pending' }` |
| T16 | `GET /admin/team-requests` | ADM-u | คิวคำร้องรออนุมัติ | `?page&pageSize` | `{ items: [{id, team, requestedBy, status, createdAt}], pagination }` |
| T17 | `POST /admin/team-requests/:id/approve` | ADM-u | อนุมัติ Official · **เช็ค BR-05 ทุกสมาชิก** · transaction + audit | — | `{ teamId, officialStatus:'official' }` / **422** `MEMBER_CONFLICT` |
| T18 | `POST /admin/team-requests/:id/reject` | ADM-u | ปฏิเสธ · **`reason` บังคับ** | `reason` | `{ status:'rejected', reason }` |
| T19 | `GET /teams` | — | **ค้นหาทีม (20 ก.ย.)** · ทีมที่ลบ/Inactive ไม่โชว์ (ดูผ่านทัวร์เก่าเท่านั้น) · ไม่คืน roster · ทุกแถวมี `memberCount` + `maxMembers` (= ขนาดรายชื่อลงแข่งสูงสุดของกีฬา — คลังใหญ่กว่านี้ได้) | `?q=&sportTypeId=&visibility=private\|public&page&pageSize` | `{ items: [TeamDto เหมือน T03], pagination }` |
| T20 | `POST /teams/:id/join-requests` | Auth | **ขอเข้าร่วมทีม public** → `pending` รอหัวหน้าทีม · กฎเดียวกับ T13: CoI, โควตา 5 ทีม, ยังไม่เป็นสมาชิก · คลังไม่มีเพดาน (Q3-ก) | `{ message? }` | **201** `{ id, teamId, status:'pending' }` / **409** `TEAM_PRIVATE`, `ALREADY_MEMBER`, `JOIN_REQUEST_PENDING`, `TEAM_CONFLICT_OF_INTEREST` · **422** `TEAM_QUOTA_EXCEEDED` |
| T21 | `GET /teams/:id/join-requests` | TL | คำขอที่รอตอบ | — | `{ items: [{id, user, message, status, createdAt}] }` |
| T22 | `POST /teams/:id/join-requests/:rid/approve` | TL | อนุมัติ → เป็นสมาชิก (+อาจ Forming→Ready) · **เช็คกฎ T20 ซ้ำ ณ ตอนอนุมัติ** | — | `{ id, userId, status:'approved', teamReadinessStatus }` / **404** `JOIN_REQUEST_NOT_FOUND` · **409** `JOIN_REQUEST_ALREADY_ANSWERED` |
| T23 | `POST /teams/:id/join-requests/:rid/reject` | TL | ปฏิเสธ | `{ reason? }` | `{ id, status:'rejected' }` |
| T24 | `GET /me/join-requests` | Auth | คำขอที่ฉันส่ง ทุกสถานะ ล่าสุดก่อน | — | `{ items: [{id, team:{id,name,sportTypeId}, message, status, rejectReason, createdAt, respondedAt}] }` |
| T25 | `DELETE /me/join-requests/:rid` | Auth | ยกเลิกคำขอของตัวเอง (เฉพาะ pending) | — | **204** / **409** `JOIN_REQUEST_ALREADY_ANSWERED` |

**ไม่มี endpoint (ระบบทำเอง):** `Forming → Ready` (เกิดใน T13) · soft delete จากไม่ใช้งาน (scheduled job, BR-06)

---

# 5. Tournaments — 17 endpoint

**ไฟล์:** `routes/tournament.routes.ts` + `routes/admin.routes.ts`
`tournament.controller.ts` · `tournament.service.ts` · `tournament.repo.ts`, `amendmentRequest.repo.ts`, `auditLog.repo.ts` · `tournament.mapper.ts`

| รหัส | Method + Path                              | Auth  | ทำอะไร                                                                                                            | รับ                                                                                                                                                                                                     | คืน                                                                                                                            |
| ---- | ------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| C01  | `POST /tournaments`                        | Auth  | สร้าง**คำขอ**จัดทัวร์ → `pending_approval` (BR-01) · **admin ในขอบเขตตัวเอง → `private` ทันที** (university_wide ทุกทัวร์ · admin คณะ = คณะตัวเองจัด **และ** กฎคณะจำกัดเฉพาะคณะตัวเอง — มติ 20 ก.ย. Q2-ข) · body รับ `eligibilityRules: [{type:'faculty'\|'year', value}]` (ไม่ส่ง = ไม่จำกัด · คณะต้องมีจริง · ปี 1–8 · ตัดซ้ำ) เก็บลง `tournament_eligibility_rules` ในทรานแซกชันเดียว · `entryNotes?` เป็นข้อความแนะนำผู้สมัคร ≤2000 ตัวอักษร (informational only) · รับ datetime ทั้ง `Z`/offset (แก้ 20 ก.ย. — `Z` เคย 500) · วันต้องไม่เป็นอดีต (**400** `TOURNAMENT_DATES_IN_PAST`) · ⚠️ `bracketFormat` ใช้ชื่อเต็ม `single_elimination` | `name, sportTypeId, bracketFormat, scopeType, organizingFacultyId, organizingDepartmentId, registrationStart/End, eventStartDate/EndDate, maxTeams, minTeams, venue, entryNotes?, genderRequirement, minAge, maxAge, disputeWindowHours?` (**ข้อ 9 · 25 ก.ย.** ระยะเวลาโต้แย้งผลหลัง verify · จำนวนเต็ม 6–72 ชม. · ไม่ส่ง = 24 ชม.) | **201** `{ id, status:'pending_approval'\|'private', name, autoApproved }`                                                                              |
| C02  | `GET /me/tournament-requests`              | Auth  | คำขอของฉัน + สถานะ                                                                                                | `?page&pageSize`                                                                                                                                                                                        | `{ items: [{id, name, status, rejectionReason, createdAt}], pagination }`                                                      |
| C02b | `GET /me/tournaments`                      | Auth  | **20 ก.ย.** ทัวร์ที่ฉันจัด **ทุกสถานะ** การ์ดเต็ม (แก้ N+1 ที่ FE ต้องยิง C07 ทีละอัน) | `?status=pending_approval\|rejected\|private\|public\|completed&page&pageSize` | `{ items: [{...การ์ดเดียวกับ C06, status, rejectionReason, createdAt}], pagination }` |
| C03  | `GET /admin/tournament-requests`           | ADM-f | คิวรอพิจารณา (`pending_approval`)                                                                                 | `?page&pageSize`                                                                                                                                                                                        | `{ items: [{id, name, requestedBy, sportTypeId, eventStartDate, createdAt}], pagination }`                                     |
| C04  | `POST /tournaments/:id/approve`            | ADM-f | อนุมัติ → `private` + audit · **Q2-ข**: admin คณะอนุมัติได้เฉพาะทัวร์ที่กฎคณะจำกัดเฉพาะคณะตัวเอง ไม่งั้น **403** `ELIGIBILITY_OUT_OF_SCOPE` (ให้ university_wide)                                                                                       | —                                                                                                                                                                                                       | `{ id, status:'private', organizerId }`                                                                                        |
| C05  | `POST /tournaments/:id/reject`             | ADM-f | ปฏิเสธ → `rejected` · **`reason` บังคับ**                                                                         | `reason`                                                                                                                                                                                                | `{ id, status:'rejected', reason }`                                                                                            |
| C06  | `GET /tournaments`                         | —     | ค้นหาทัวร์ · **บังคับ `status='public'` ที่ service**                                                             | `?sportTypeId&facultyId&q&page&pageSize&status` (`status`: `public` default · `completed` = ทัวร์ที่จบแล้ว — B1 21 ก.ย.) | `{ items: [{id, name, sportTypeId, eventStartDate, eventEndDate, registrationOpen, venue, organizingFacultyId}], pagination }` |
| C07  | `GET /tournaments/:id`                     | —     | รายละเอียด · `completed` เห็นได้ทุกคนเหมือน `public` (B1 3-ก) + คืน `championTeamId`, `completedAt`, `entryNotes` · `entryNotes` เป็นข้อความแนะนำ ไม่ใช่ Hard Filter · สถานะอื่น → เห็นได้เฉพาะ**ผู้ยื่นคำขอ** (ทุกสถานะรวม `pending_approval`/`rejected`/`completed` — แก้ 20 ก.ย. FE-c17b) และ ADM ในขอบเขต ไม่งั้น **404** | —                                                                                                                                                                                                       | `{ ...ข้อมูลเต็ม, entryNotes:string|null, organizer, approvedTeamCount }`                                                                              |
| C08  | `PATCH /tournaments/:id`                   | ORG   | แก้ข้อมูลทั่วไป · **allowlist** · `entryNotes` แก้ตรงได้ ไม่ต้องผ่าน amendment; ส่ง `null` เพื่อล้าง                                                                                   | `venue?, description?, entryNotes?: string|null` (`entryNotes` ≤2000)                                                                                                                                                                                  | เหมือน C07                                                                                                                     |
| C09  | `POST /tournaments/:id/amendment-requests` | ORG   | ขอแก้ข้อมูลสำคัญ → `pending` · รับ `eligibilityRules` ด้วย (ทางเดียวที่แก้กฎหลังผ่านอนุมัติ) — ได้เฉพาะยังไม่เปิดรับสมัครและยังไม่มีใบสมัคร ไม่งั้น **409** `ELIGIBILITY_LOCKED` · **`reason` บังคับ** (20 ก.ย. FE-change-request-has-nowhere — เหตุผลของผู้ขอ ≤1000 ตัวอักษร) | `requestedChanges` (JSON), `reason`                                                                                                                                                                               | **201** `{ id, status:'pending' }`                                                                                             |
| C09b | `GET /tournaments/:id/amendment-requests`  | ผู้ยื่นคำขอ | คำขอแก้ไขทั้งหมดของทัวร์ (ทุกสถานะ ล่าสุดก่อน) — ORG ดูว่า pending/approved/rejected และเหตุผลที่แอดมินปฏิเสธ (FE-organizer-see-their-own 21 ก.ย.) · guard `requireRequester` (เห็นได้แม้ทัวร์ยัง `pending_approval`) | — | `{ items: [{id, requestedChanges, reason, status, requestedAt, reviewedAt, reviewedBy:{id,name}\|null, rejectionReason}] }` |
| C10  | `GET /admin/amendment-requests`            | ADM-f | คิวคำขอแก้ไข                                                                                                      | `?page&pageSize`                                                                                                                                                                                        | `{ items: [{id, tournamentId, tournamentName, requestedBy, requestedChanges, reason, status, requestedAt}], pagination }` (`reason` null = คำขอก่อน migration 020)                                                                                                        |
| C11  | `POST /amendment-requests/:id/approve`     | ADM-f | อนุมัติ · ถ้ามี `eligibilityRules` → REPLACE ตารางกฎ + เช็ค Q2-ข/`ELIGIBILITY_LOCKED` ซ้ำตอนอนุมัติ · **ต้อง UPDATE tournaments จริงในทรานแซกชันเดียว**                                                       | —                                                                                                                                                                                                       | `{ id, status:'approved' }`                                                                                                    |
| C12  | `POST /amendment-requests/:id/reject`      | ADM-f | ปฏิเสธ · `reason` บังคับ                                                                                          | `reason`                                                                                                                                                                                                | `{ id, status:'rejected', reason }`                                                                                            |
| C13  | `POST /tournaments/:id/publish`            | ORG   | `private → public` · **BR-10 ด่าน 1: pool active ≥ กรรมการที่ 1 แมตช์ต้องใช้** (1 / 2 ถ้า on-site+stat ตาม `default_mode` ของกีฬา) · ด่าน 2 เช็คตอน M10                                                               | —                                                                                                                                                                                                       | `{ id, status:'public' }` / **409** `REFEREES_INCOMPLETE`                                                                      |
| C14  | `POST /tournaments/:id/unpublish`          | ORG   | `public → private`                                                                                                | —                                                                                                                                                                                                       | `{ id, status:'private' }`                                                                                                     |
| C14b | `POST /tournaments/:id/complete`           | ORG   | **ปิดทัวร์** (B1 มติ 21 ก.ย. 1-ข) `public\|private → completed` · ต้องมีแมตช์และ**ทุกแมตช์ `completed`** ไม่งั้น **409** `MATCHES_UNFINISHED` `{matches:[{id,status}]}` / `NO_MATCHES` · ทำในทรานแซกชัน (2-ง): เก็บแชมป์ (elimination = ผู้ชนะรอบชิง · round robin = อันดับ 1 ตาราง; เสมออันดับ 1 หรือรอบชิงแพ้ทั้งคู่ → `null` ไม่บวกแชมป์) · `championships +1` ให้รายชื่อลงแข่งของทีมแชมป์ · `teams.last_competed_at` ทุกทีม approved · **หลังปิด ทุก write ใต้ `/tournaments/:id/*` และ `/matches/:id/*` (ยกเว้น announcements) และ P08 ถอนตัว → 409 `TOURNAMENT_COMPLETED`** | — | `{ id, status:'completed', championTeamId \| null }` |
| C15  | `POST /tournaments/:id/open-registration`  | ORG   | เปิดรับสมัคร                                                                                                      | —                                                                                                                                                                                                       | `{ id, registrationOpen: true }`                                                                                               |
| C16  | `POST /tournaments/:id/close-registration` | ORG   | ปิดรับสมัคร (คำขอค้างยังพิจารณาได้)                                                                               | —                                                                                                                                                                                                       | `{ id, registrationOpen: false }`                                                                                              |
| C17  | `GET /tournaments/:id/eligibility-rules`   | —     | เงื่อนไขคุณสมบัติ · การมองเห็นตาม C07 (ผู้ยื่นคำขออ่านได้ตั้งแต่ `pending_approval`)                             | —                                                                                                                                                                                                       | `{ items: [{ruleType, ruleValue}] }`                                                                                           |
| C17b | `PUT /tournaments/:id/eligibility-rules`   | ผู้ยื่นคำขอ | **แทนที่กฎคุณสมบัติทั้งชุด** (20 ก.ย. Q1-ค) · guard `requireRequester` ไม่ใช่ `requireOrganizer` (ORG ยังไม่มีตอน pending — แก้ 20 ก.ย. FE-c17b) · เฉพาะ `pending_approval` — ผ่านอนุมัติแล้ว **409** `USE_AMENDMENT_REQUEST` (ไป C09) · เปิดรับ/มีใบสมัครแล้ว **409** `ELIGIBILITY_LOCKED` | `{ rules: [{type:'faculty'\|'year', value}] }` (ว่าง = ไม่จำกัด) | `{ items: [{ruleType, ruleValue}] }` |
| C18  | `DELETE /tournaments/:id`                   | ผู้ยื่นคำขอ | **soft delete** · ใช้ได้กับ `pending_approval`, `rejected`, หรือ `private` ที่ยังไม่มี application/match · `public` ต้อง C14 unpublish ก่อน · `completed` ลบไม่ได้ · หลังลบ parent และ `/tournaments/:id/*` / `/matches/:id/*` ของทัวร์นั้นตอบ 404 | — | **204** / **409** `TOURNAMENT_MUST_BE_UNPUBLISHED` \| `TOURNAMENT_HAS_ACTIVITY` \| `TOURNAMENT_COMPLETED` |

---

# 6. Referees — 23 endpoint

> ปรับตามมติทีม 2026-09-13 (`GUIDE/11`): เชิญพร้อมแมตช์ · ref เลือกรับบางแมตช์ · เปลี่ยนภายหลังผ่าน "คำขอ" (FR01–FR08)
> BR-10 = **ทุกแมตช์มีกรรมการครบ** (ดู F14) ไม่ใช่นับหัวรวม · F11 ถูกตัดออก ใช้ FR02 แทน

**ไฟล์:** `routes/referee.routes.ts`, `routes/refereeRequest.routes.ts`
`referee.controller.ts` · `referee.service.ts` · `tournamentReferee.repo.ts`, `matchReferee.repo.ts`
`refereeRequest.controller.ts` · `refereeRequest.service.ts` · `refereeChangeRequest.repo.ts`

## 6.1 คำเชิญ + แมตช์

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| F01 | `POST /tournaments/:id/referees` | ORG | เชิญเป็นกรรมการ · แนบแมตช์ที่เสนอให้คุมได้ (ไม่แนบ = เข้า pool) · แมตช์ต้องอยู่ทัวร์นี้ มีเวลาเริ่ม/จบ ไม่ซ้อนกันเอง · **CoI**: ORG เอง / คนที่มีชื่อในทีมที่สมัครทัวร์นี้ เป็นกรรมการไม่ได้ | `userId, isExternal, matchIds?` | **201** `{ id, userId, invitationStatus:'pending', isExternal, matchIds }` / **404** `MATCH_NOT_FOUND` / **409** `ORGANIZER_CANNOT_BE_REFEREE`, `REFEREE_CONFLICT_OF_INTEREST` + `teamId`, `MATCH_NOT_SCHEDULED`, `REFEREE_TIME_CONFLICT`, `REFEREE_INVITATION_PENDING`, `REFEREE_ALREADY_ACCEPTED` |
| F02 | `GET /tournaments/:id/referees` | ORG | กรรมการทั้งหมด (แถวล่าสุดต่อคน ยังไม่ถูกถอด) + `status` รวม | — | `{ items: [{id, user, invitationStatus, isExternal, externalApprovalStatus, status}], acceptedCount }` |
| F03 | `DELETE /tournaments/:id/referees/:rid` | ORG | ถอดกรรมการ · soft delete ทุกแถวของ user นั้น · **ถอดได้เสมอ** แต่บอกว่าแมตช์ไหนจะขาดคน (Q4) | — | **200** `{ removed:true, uncoveredMatches:[matchId] }` / **404** `REFEREE_NOT_FOUND` |
| F04 | `GET /me/referee-invitations` | Auth | คำเชิญที่รอฉันตอบ พร้อมแมตช์ที่เสนอมา | — | `{ items: [{id, tournament, isExternal, matches:[{id, roundNumber, scheduledTime, scheduledEndTime, venue, mode, matchStatus, assignmentStatus}], createdAt}] }` |
| F04b | `GET /me/referee-matches` | Auth | **B7 (19 ก.ย.)** แมตช์ที่ฉันเป็นกรรมการ — รับแมตช์แล้ว (`accepted`) และยัง active ในทัวร์นั้น (ถูกถอด/external ยังไม่อนุมัติ = ไม่แสดง) ทุกทัวร์ เรียงตามเวลาแข่ง | `?status=scheduled\|checkin_open\|in_progress\|completed` · `?upcoming=true` (ตัด completed) | `{ items: [{id, tournament:{id,name,sportTypeId}, round, teamA, teamB, scheduledTime, scheduledEndTime, venue, mode, status}] }` |
| F05 | `POST /referee-invitations/:id/accept` | Auth | ตอบรับ + **เลือกรับบางแมตช์ได้** (Q1) · เลือกได้เฉพาะที่เสนอมา · `[]`/ไม่ส่ง body = เข้าทัวร์แบบ pool · เช็คซ้อนเวลาอีกรอบ · คนนอก → ตามสถานะยืนยันตัวตนของคน (§6.3): approved ≤ 1 ปี → active ทันที · มีการตรวจค้าง → ร่วมการตรวจเดิม · ไม่มี → pending ต้องส่ง docs | `matchIds?, docs?` | `{ id, invitationStatus:'accepted', requiresAdminApproval, acceptedMatchIds, declinedMatchIds }` / **400** `MATCH_NOT_IN_INVITATION` / **409** `INVITATION_ALREADY_ANSWERED`, `REFEREE_TIME_CONFLICT` |
| F06 | `POST /referee-invitations/:id/decline` | Auth | ปฏิเสธทั้งคำเชิญ (แมตช์ที่เสนอมา → `declined`) | — | **204** |
| F12 | `GET /matches/:id/referees` | — | กรรมการที่คุมแมตช์นี้ = รับแมตช์แล้ว **และ** `status === 'active'` (คนนอกที่ admin ยังไม่อนุมัติไม่โชว์) · `acceptedCount` = active เท่านั้น (คนนอกรอ admin ไม่นับ) · `awaitingAdminCount` | — | `{ items: [{tournamentRefereeId, referee}] }` |
| F13 | `DELETE /matches/:id/referees/:rid` | ORG | ถอดออกจากแมตช์นี้ทันที (ไม่ต้องขอ) · hard delete | — | **204** / **404** `REFEREE_NOT_ASSIGNED` |
| F14 | `GET /tournaments/:id/referees/coverage` | ORG | **BR-10 ใหม่** — แมตช์ที่ยังขาดกรรมการ (`needed` = 2 ถ้า on-site + กีฬามี stat, อื่น 1) + กรรมการที่รับแมตช์ซ้อนเวลา (Q6 เตือน ไม่ block) · C13 publish ควรเรียกตัวนี้ | — | `{ matchesTotal, matchesCovered, uncovered:[{matchId, roundNumber, scheduledTime, needed, assigned}], conflicts:[{tournamentRefereeId, userId, matchIds:[a,b]}] }` |

`status` ของกรรมการ (คำนวณจาก 4 คอลัมน์ ไม่มีใน DB): `pending` · `pending_admin` · `active` · `declined` · `rejected_by_admin` · `removed`

## 6.2 คำขอเปลี่ยนแปลงหลังเชิญ (`referee_change_requests`)

ทุกคำขอ: ผู้เกี่ยวข้องต้อง `active` · แมตช์ต้อง `scheduled` และยังไม่ถึงเวลา · ตารางของแต่ละคน**หลังเปลี่ยน**ต้องไม่ซ้อน · คู่ (match, referee) มีคำขอ open ได้ทีละใบ · ตอน apply เช็คทุกอย่างใหม่ ไม่ผ่าน → `cancelled` + **409** `REQUEST_NO_LONGER_VALID` · ORG แค่รับแจ้ง ไม่ต้องอนุมัติ (Q3)

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| FR01 | `POST /referee-requests` | REF | ขอ**โอน** (`theirMatchId` ไม่ส่ง) หรือ**แลก** (ส่ง) แมตช์กับกรรมการอีกคนในทัวร์เดียวกัน · ผู้ขอถือว่า accept แล้ว รออีกฝ่าย | `myMatchId, toTournamentRefereeId, theirMatchId?` | **201** RequestDto / **403** `NOT_TOURNAMENT_REFEREE` / **400** `SAME_REFEREE`, `SAME_MATCH` / **409** `REFEREE_NOT_ASSIGNED`, `REFEREE_NOT_ACTIVE`, `MATCH_NOT_CHANGEABLE`, `REFEREE_TIME_CONFLICT`, `REQUEST_ALREADY_OPEN` |
| FR02 | `POST /tournaments/:id/referee-requests/add-match` | ORG | ขอให้กรรมการรับแมตช์เพิ่ม (แทน F11) · รอกรรมการตอบ | `tournamentRefereeId, matchId` | **201** RequestDto / **409** `REFEREE_ALREADY_ASSIGNED` + ชุดเดียวกับ FR01 |
| FR03 | `POST /tournaments/:id/referee-requests/swap` | ORG | ขอสลับแมตช์ระหว่างกรรมการ 2 คน · **ทั้งคู่ต้อง accept** | `refereeAId, matchAId, refereeBId, matchBId` | **201** RequestDto |
| FR04 | `GET /me/referee-requests` | Auth | `incoming` = รอฉันตอบ (ซ่อนที่แมตช์ผ่านไปแล้ว) · `outgoing` = ที่ฉันส่ง (ทุกสถานะ) | — | `{ incoming:[RequestDto], outgoing:[RequestDto] }` |
| FR05 | `GET /tournaments/:id/referee-requests` | ORG | คำขอทั้งหมดของทัวร์ · `?status=open` ซ่อนที่แมตช์ผ่านไปแล้ว | `?status=open` · `applied` · `declined` · `cancelled` | `{ items:[RequestDto] }` |
| FR06 | `POST /referee-requests/:id/accept` | Auth | ตอบรับฝั่งของตน · ครบทุกฝ่าย → apply ทันที (ทรานแซกชัน + ยกเลิกคำขอ open อื่นบนแมตช์เดียวกัน) | — | RequestDto (`status:'applied'` หรือยัง `open` ถ้ารออีกฝ่าย) / **403** `NOT_YOUR_REQUEST` / **409** `REQUEST_CLOSED`, `REQUEST_NO_LONGER_VALID` |
| FR07 | `POST /referee-requests/:id/decline` | Auth | ปฏิเสธ → คำขอปิดเป็น `declined` | — | RequestDto |
| FR08 | `DELETE /referee-requests/:id` | ผู้สร้าง | ยกเลิกคำขอที่ยัง open | — | **204** / **403** `NOT_YOUR_REQUEST` / **409** `REQUEST_CLOSED` |

## 6.3 ยืนยันตัวตนกรรมการภายนอก — คิดเป็น "ต่อคน" (GUIDE/10 §8 F-16/F-17)

สถานะของคน: `none` → (accept + docs) → `pending` → admin: `approved` (1 ปี ทุกทัวร์) / `needs_docs` (ขอใหม่ ทัวร์ยังรอ) / `rejected` (final ทุกทัวร์) · ส่ง docs = ทุกทัวร์ที่รอกลับเข้าคิวพร้อมกัน

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| U11 | `GET /me/referee-identity` | Auth | สถานะยืนยันตัวตนของฉัน + ข้อความ admin + ทัวร์ที่รอ — **FE ทำ banner จากตรงนี้** (ไม่มี notification) | — | `{ status, approvedAt, expiresAt, adminMessage, docsSubmitted, docsRequired, tournaments:[{id,name,tournamentRefereeId,externalApprovalStatus}] }` |
| U12 | `PUT /me/referee-identity/docs` | Auth | ส่ง/ส่งใหม่ เอกสาร (S3 key 1–5) → ทุกทัวร์ที่ `pending/needs_docs` กลับเป็น `pending` | `docs: string[]` | `{ status:'pending', docsCount, tournamentsUpdated }` / **409** `DOCS_NOT_EXPECTED` |
| AR01 | `GET /admin/referee-requests` | ADM-u | คิว **1 รายการ = 1 คน** พร้อม `docs` และ `tournaments[]` ที่รอ | — | `{ items:[{userId, user:{…,email}, docs[], tournaments[], submittedAt}] }` |
| AR02 | `POST /admin/referee-requests/:userId/approve` | ADM-u | ผ่าน → ทุกทัวร์ที่รอ approved · ล้าง docs (PDPA) · ใช้ได้ 1 ปี | — | `{ userId, identityStatus:'approved', tournamentsUpdated }` / **409** `NOT_PENDING_REVIEW` |
| AR04 | `POST /admin/referee-requests/:userId/request-docs` | ADM-u | **ขอเอกสารใหม่** (ไม่ใช่ reject) → `needs_docs` + ข้อความ · ทัวร์ยังรอ · ล้าง docs เดิม | `reason` | `{ userId, identityStatus:'needs_docs', reason, tournamentsUpdated }` |
| AR03 | `POST /admin/referee-requests/:userId/reject` | ADM-u | **ไม่ผ่านจริง** (pending/needs_docs) หรือ **ถอนอนุมัติ** (approved · F-10) → ทุกแถวของคนนั้นทุกทัวร์ (รวมที่ถูกถอดแล้ว) `rejected` · แมตช์ที่รับไว้คงอยู่แต่ไม่นับ → F14 `uncovered` · ORG เชิญซ้ำได้ (F01 ยอมให้เชิญทับ `rejected_by_admin`) | `reason` | `{ userId, identityStatus:'rejected', reason, tournamentsUpdated }` |

**RequestDto** = `{ id, tournamentId, type:'org_add_match'|'ref_transfer'|'ref_swap'|'org_swap', requestedBy, refereeA:{tournamentRefereeId, user, status}, refereeB|null, matchA:{id, roundNumber, scheduledTime, scheduledEndTime}, matchB|null, status:'open'|'applied'|'declined'|'cancelled', createdAt, resolvedAt }`
— `refereeX.status` = `not_required` · `pending` · `accepted` · `declined` (ฝั่งนั้นต้องตอบไหม/ตอบว่าอะไร)

**ยังไม่มี:** notification push (ORG ดูจาก FR05/F14) · buffer ก่อนแข่ง (เปลี่ยนได้จนถึงเวลาเริ่ม) · auto-expire (คำขอค้างจะถูก cancel ตอนมีคนกดตอบ)

---

# 7. Applications — 9 endpoint

**ไฟล์:** `routes/application.routes.ts` · `application.controller.ts` · `application.service.ts` · `application.repo.ts` · `application.mapper.ts`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| P01 | `POST /tournaments/:id/applications` | TL | สมัครแข่ง · **Hard Filter อัตโนมัติ** · BR-04/08/09 · ต้อง ORG เปิดรับสมัคร (C15) **และ** อยู่ใน `registrationStart–registrationEnd` · ทีมต้องกีฬาเดียวกับทัวร์ · **CoI**: สมาชิกทีมเป็น ORG/กรรมการของทัวร์นี้ไม่ได้ · `softFilterDocuments` เป็น object keys จาก M16 ของ **user คนนี้ + tournament นี้เท่านั้น** และ backend ตรวจว่า object ถูกอัปโหลดจริงก่อนบันทึก · cancel/withdraw แล้วสมัครใหม่ได้ | `teamId, playerIds, softFilterDocuments?` (สูงสุด 10 keys) | **201** `{ id, status:'pending', hardFilterPassed:true, playerIds }` / **409** `REGISTRATION_CLOSED`, `SPORT_TYPE_MISMATCH`, `TEAM_CONFLICT_OF_INTEREST` / **422** `HARD_FILTER_FAILED`, `SOFT_FILTER_DOCUMENT_INVALID`, `SOFT_FILTER_DOCUMENT_NOT_FOUND` |
| P02 | `GET /me/applications` | Auth | ใบสมัครของฉัน + เหตุผลถ้าถูกปฏิเสธ | `?page&pageSize` | `{ items: [{id, tournament, team, status, rejectionReason, appliedAt}], pagination }` |
| P03 | `GET /tournaments/:id/applications` | ORG | ใบสมัครทั้งหมด · `softFilterDocuments` = **S3 key ดิบ** | `?page&pageSize` | `{ items: [{id, team, status, hardFilterPassed, softFilterDocuments, appliedAt}], pagination }` |
| P04 | `GET /applications/:id` | ORG/TL | รายละเอียด · `softFilterDocuments` = **presigned URL** | — | `{ id, tournamentId, team, status, hardFilterDetails[], softFilterDocuments[] }` |
| P05 | `POST /applications/:id/approve` | ORG | อนุมัติ (Soft Filter ดุลพินิจ) | — | `{ id, status:'approved' }` |
| P06 | `POST /applications/:id/reject` | ORG | ปฏิเสธ · `reason` บังคับ | `reason` | `{ id, status:'rejected', reason }` |
| P07 | `POST /applications/:id/cancel` | TL | **ยกเลิกก่อนอนุมัติ** (ต้องเป็น `pending`) | — | `{ id, status:'cancelled' }` / **409** `ALREADY_DECIDED` |
| P08 | `POST /applications/:id/withdraw` | TL | **ถอนตัวหลังอนุมัติ** · คืนช่องว่าง + แจ้ง ORG · **มีสายแล้ว → แมตช์ที่ยังไม่เริ่มของทีมนี้ อีกฝั่งชนะบาย** (walkover, ลูกโซ่ถึงสายล่าง; คู่ที่ยังไม่มาจะบายตอนคู่มาถึง) · ถอนกลางแมตช์ไม่ได้ | — | `{ id, status:'withdrawn', bracketExists, walkovers: [{matchId, winnerTeamId, loserTeamId}] }` / **409** `MATCH_IN_PROGRESS` |
| P09 | `GET /tournaments/:id/teams` | — | ทีมที่อนุมัติแล้ว (สาธารณะ) | — | `{ items: TeamRef[] }` |

---

# 8. Brackets & Matches — 13 endpoint

**ไฟล์:** `routes/match.routes.ts` · `match.controller.ts` · `match.service.ts`, `bracket.service.ts` · `match.repo.ts`, `bracketNode.repo.ts`, `matchCheckin.repo.ts` · `match.mapper.ts`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| M01 | `POST /tournaments/:id/bracket` | ORG | **สร้างสายทั้งทัวร์** · INSERT matches หลายสิบแถว + bracket_nodes · transaction · **`replace: true` (21 ก.ย.)** = ลบสายเดิม (matches/nodes/นัดหมาย/กรรมการรายแมตช์/standings — คงใบสมัครและ pool กรรมการ) แล้วจับใหม่จากทีม approved ปัจจุบันในทรานแซกชันเดียว · ได้เฉพาะทุกแมตช์ยัง `scheduled` และไม่มีเช็คอิน/ผล ไม่งั้น **409** `BRACKET_IN_USE` `{matches:[{id,status,checkins,results}]}` · ไม่ส่ง replace แต่มีสาย → **409** `BRACKET_ALREADY_EXISTS` · ตอบ `replaced: true\|false` | `seedingMethod:'random'\|'manual', manualSeeds?, replace?` | **201** `{ matchCount, bracketFormat, nodeCount }` / **422** `TEAM_COUNT_MISMATCH` |
| M02 | `GET /tournaments/:id/bracket` | — | ผังสาย (round robin คืน `nodes: []`) · **19 ก.ย.**: `teamA/teamB` ของรอบถัดไปถูกเติมทันทีที่ผลออก (verify / walkover / bye ทุกแบบ sync `bracket_nodes` จาก `matches` — migration 014 backfill ของเก่า) FE ไม่ต้องเอา M01 มาซ้อนแล้ว | — | `{ bracketFormat, nodes: [{nodeId, bracketType, round, matchNumber, teamA, teamB, matchId, matchStatus, advancesToNodeId}] }` |
| M04 | `GET /tournaments/:id/matches` | — | ตารางแข่ง · **19 ก.ย. (B5)**: ทุกแถวมีผลสรุปในตัว FE ไม่ต้องยิง S05/M02 ซ้ำ — `resultStatus` = สถานะใบผลล่าสุด (null ยังไม่ส่ง / submitted / disputed / rejected / verified / walkover) · `score` เฉพาะ verified/walkover (ใบผลที่ยังไม่ยืนยันดูผ่าน S05 ตามสิทธิ์เดิม) · `outcome` เฉพาะแมตช์ `completed`: `played` แข่งจริง · `walkover` คู่ถอน/ไม่มา (แสดง W/O) · `bye` ช่องอีกฝั่งว่างถาวร ทีมเดียวผ่าน (แสดง "BYE" แทนช่องว่าง) · `void` ไม่มีใครผ่าน — แพ้ทั้งคู่/ถอนทั้งคู่/แมตช์ตาย (แสดง "ไม่มีการแข่ง") · ช่องว่างที่ `outcome=null` = ยังรอผลรอบก่อน | `?teamId&status&round&page&pageSize` | `{ items: [{id, round, teamA, teamB, scheduledTime, scheduledEndTime, venue, status, nextMatchId, loserNextMatchId, resultStatus, score, outcome: {kind, winnerTeamId, loserTeamId}\|null}], pagination }` |
| M05 | `GET /matches/:id` | — | รายละเอียดแมตช์ · ฟิลด์ผลสรุปชุดเดียวกับ M04 · **B8**: `roomCode` (แมตช์ online) เห็นเฉพาะผู้เล่นในรายชื่อลงแข่ง/กรรมการของแมตช์/ORG (ส่ง token) ไม่งั้น null | — | `{ id, tournamentId, round, teamA, teamB, scheduledTime, scheduledEndTime, venue, checkinOpenAt, status, mode, nextMatchId, loserNextMatchId, resultStatus, score, outcome, roomCode }` |
| M05b | `PUT /matches/:id/room-code` | REF ของแมตช์ / ORG | **B8 (20 ก.ย.)** ตั้ง/ล้างรหัสห้องเกมของแมตช์ online (migration 016) · แมตช์จบแล้วแก้ไม่ได้ | `{ roomCode: string\|null }` (≤50) | `{ matchId, roomCode }` / **409** `MATCH_NOT_ONLINE`, `MATCH_NOT_CHANGEABLE` · **403** `NOT_MATCH_STAFF` |
| M05c | `GET /me/matches` | Auth | **20 ก.ย.** แมตช์ของฉันทั้ง 2 บทบาท — ผู้เล่น (ฉัน**มีชื่อลงแข่ง** ใน application_players — Q5-ก) + กรรมการ (รับแมตช์แล้ว) **เฉพาะที่ยังไม่จบ** (มติ 20 ก.ย. — ประวัติดู M04 `?teamId=`) เรียงตามเวลา | `?role=player\|referee` | `{ items: [{id, role, myTeamId, tournament:{id,name,sportTypeId}, round, teamA, teamB, scheduledTime, scheduledEndTime, venue, mode, status}] }` |
| M06 | `PATCH /matches/:id/schedule` | ORG | ตั้ง/เลื่อนเวลา+สนาม · เฉพาะ `scheduled` · อยู่ในวันทัวร์ (ขยายวันผ่าน C09) · **ตรวจทับซ้อนเป็นช่วงเวลา** ทีม/สนาม (แมตช์ที่จบแล้วไม่นับ) · ไม่พังลำดับสาย (`next_match_id` สองทิศ) · กรรมการซ้อน**ไม่ block** ดู F14 (GUIDE/11 Q6) | **B9 (19 ก.ย.): ทุกฟิลด์ optional ส่งเฉพาะที่จะแก้** (แค่ `venue` หรือแค่เวลา — ที่เหลือคงเดิม) · ครั้งแรกที่ยังไม่เคยตั้งต้องครบ 3 ไม่งั้น **400** `SCHEDULE_INCOMPLETE` + `missing[]` · จบ > เริ่ม (เทียบกับค่าเดิมด้วย) · รับทั้ง `Z` และ `+07:00` | เหมือน M05 / **409** `MATCH_NOT_CHANGEABLE`, `OUTSIDE_TOURNAMENT_DATES`, `SCHEDULE_CONFLICT` + `conflictingMatchId`, `SCHEDULE_BREAKS_BRACKET` + `blockingMatchId` |
| M09 | `POST /matches/:id/open-checkin` | ORG | `scheduled → checkin_open` (สถานะอื่นเปิดไม่ได้) · **ข้อ 1 (26 ก.ย.)** ห้ามเปิดทับแมตช์ต้นทางที่ยังไม่สรุป: ทีมไม่ครบ 2 ฝั่ง → **409** `MATCH_TEAMS_INCOMPLETE` · ทีมครบแต่ต้นทางยัง `disputed` → **409** `PREDECESSOR_DISPUTED` (ถ้าปล่อยผ่าน ORG จะเสียสิทธิ์แก้ผลต้นทางทันที) · ทั้งสองกรณีแนบ `extra.blockedBy:[{matchId,status,reason}]` ให้ FE ลิงก์ไปแมตช์ที่ติดได้ | — | `{ id, status:'checkin_open', checkinOpenAt }` / **409** `INVALID_STATUS_TRANSITION` |
| M10 | `POST /matches/:id/start` | REF ของแมตช์ | `checkin_open → in_progress` · **BR-10 ด่าน 2: กรรมการ active ครบ (on-site+stat 2 / อื่น 1) → 409 `INSUFFICIENT_REFEREES`** · **ทีมต้องเช็คอิน ≥ `sport_types.min_members`** — ฝั่งที่ไม่ถึงแพ้บาย (walkover) ทันที · ไม่ถึงทั้งคู่ → 409 ให้ ORG เลื่อน | — | `{ id, status:'in_progress' }` **หรือ** `{ id, status:'completed', walkover:{ matchId, winnerTeamId, loserTeamId, reason:'insufficient_checkins', minMembers, checkedIn } }` / **409** `CHECKIN_NOT_OPEN` \| `MATCH_TEAMS_INCOMPLETE` \| `INSUFFICIENT_REFEREES` \| `INSUFFICIENT_CHECKINS` (+`minMembers, checkedIn`) |
| M11 | `GET /matches/:id/checkin-qr` | ORG / REF ของแมตช์ | QR สำหรับ on-site · ขอได้เฉพาะแมตช์ `checkin_open` | — | `{ qrPayload, expiresAt }` / **409** `CHECKIN_NOT_OPEN` |
| M12 | `POST /matches/:id/checkins` | Auth | เช็คอิน · **idempotent (กดซ้ำ = 200 แม้แมตช์เริ่มแล้ว)** · เช็คอินใหม่ได้เฉพาะแมตช์ `checkin_open` (ไม่งั้น **409** `CHECKIN_NOT_OPEN`) · **21 ก.ย.**: ถ้าถูกกรรมการ reject (M15) ไปแล้ว กดอีกครั้ง = เช็คอินใหม่ทับแถวเดิม (id เดิม, **201**) ต้อง `checkin_open` เหมือนครั้งแรก · **วิธีต้องตรง `mode` ของแมตช์** — `onsite` รับเฉพาะ `qr_onsite`, `online` รับเฉพาะ `photo_online` ไม่งั้น **400** `CHECKIN_METHOD_MISMATCH` `{mode, expectedMethod}` | on-site: `method:'qr_onsite', qrPayload` · online: `method:'photo_online', documentType, documentS3Key` ⚠️ | **201/200** `{ id, status, checkedInAt }` / **403** `NOT_IN_APPROVED_ROSTER` |
| M13 | `GET /matches/:id/checkins` | ORG / REF ของแมตช์ | รายชื่อผู้เช็คอิน · **19 ก.ย.**: มี `note` (เหตุผลที่กรรมการอนุโลมเช็คอินให้ใน M19) · `id` ใช้เป็น `:cid` ของ M14/M15 · **`documentUrl` (presigned 20 นาที) ให้เฉพาะกรรมการของแมตช์** ORG ได้ `null` (PDPA NF-SE-03) | — | `{ items: [{id, userId, fullName, method, status, documentType, documentUrl, checkedInAt}] }` |
| M14 | `POST /matches/:id/checkins/:cid/verify` | REF ของแมตช์ | ตรวจเอกสารผ่าน (online) · เฉพาะเช็คอินที่ `pending` · แมตช์ต้อง `checkin_open` หรือ `in_progress` | — | `{ id, status:'verified' }` / **409** `ALREADY_DECIDED` (success/exception) \| `ALREADY_REJECTED` \| `MATCH_NOT_CHANGEABLE` |
| M15 | `POST /matches/:id/checkins/:cid/reject` | REF ของแมตช์ | ตรวจไม่ผ่าน / **เพิกถอน** · `reason` บังคับ · **21 ก.ย. (FE-check-has-gone-through)**: รับทั้ง `pending` และที่ผ่านไปแล้ว (`success` จาก QR/รูป · `exception` จาก M19) — QR/manual ไม่มีใครตรวจก่อน กรรมการจึงถอนทีหลังได้ · แมตช์ต้อง `checkin_open` หรือ `in_progress` · ถอนหลังกด start **ไม่ย้อนผล M10** แค่บันทึกว่าคนนี้ไม่ได้มา · ผู้เล่นที่ถูกถอนเช็คอินใหม่ได้ (M12/M19) ขณะ `checkin_open` | `reason` | `{ id, status:'rejected', reason }` / **409** `ALREADY_REJECTED` \| `MATCH_NOT_CHANGEABLE` |
| M17 | `POST /matches/:id/forfeit` | ORG | **ตัดสินทีมไม่มาตามนัด** · เฉพาะ `checkin_open` · ฝั่งที่เช็คอิน < `min_members` แพ้บาย · ไม่ถึงทั้งคู่ = **แพ้ทั้งคู่** (ไม่มีใครเดินสาย ช่องว่างรอบถัดไปให้ทีมที่รอบายผ่าน) · ครบทั้งคู่ → 409 ให้กรรมการ M10 | — | `{ id, status:'completed', kind:'walkover'\|'double_forfeit', minMembers, checkedIn, walkovers:[{matchId, winnerTeamId, loserTeamId}] }` / **409** `CHECKIN_NOT_OPEN` \| `MATCH_TEAMS_INCOMPLETE` \| `TEAMS_PRESENT` |
| M18 | `POST /matches/:id/close-checkin` | ORG | **ปิดเช็คอินกลับเป็น `scheduled`** (เหตุสุดวิสัย เช่น ฝนตก) · ล้าง `match_checkins` ของรอบนี้ · แล้วไปเลื่อนด้วย M06 | — | `{ id, status:'scheduled', checkinOpenAt:null }` / **409** `INVALID_STATUS_TRANSITION` |
| M19 | `POST /matches/:id/checkins/manual` | REF ของแมตช์ | **21 ก.ย.**: ผู้เล่นที่ถูก reject (M15) แล้วกดให้ใหม่ได้ (ทับแถวเดิม) · **เช็คอินแทนผู้เล่น** (คนในรายชื่อลงแข่งเท่านั้น — `NOT_IN_APPROVED_ROSTER`) · `note` เก็บคอลัมน์ `match_checkins.note` (migration 015 — ไม่ใช่ `rejectionReason` แล้ว) (กล้อง/เน็ต/QR ใช้ไม่ได้) → `manual_by_referee` / `exception` = นับว่าเช็คอินแล้ว · แมตช์ต้อง `checkin_open` · ผู้เล่นต้องอยู่ roster | `userId, note?` | **201** `{ id, userId, method, status:'checked_in', checkedInAt }` / **403** `NOT_IN_APPROVED_ROSTER` / **409** `CHECKIN_NOT_OPEN` \| `ALREADY_CHECKED_IN` |
| M20 | `GET /matches/:id/checkins/me` | Auth | สถานะเช็คอินของตัวเองในแมตช์นี้ | — | `{ checkin: null \| { id, method, status, rejectionReason (เฉพาะ rejected), note (เฉพาะ M19), checkedInAt, verifiedAt } }` |
| M21 | `GET /matches/:id/lineups` | — | **รายชื่อผู้เล่นที่ทีมส่งลงแข่ง** ของ 2 ทีม + สถานะเช็คอิน (มติ 19 ก.ย. ทีม = คลังผู้เล่น · จาก `application_players`) สาธารณะเหมือน M04 · (shokun เรียก M19 ในโค้ด — เลขชนกับ manual checkin) | — | `{ matchId, teamA:{teamId, players:[{userId, fullName, avatarUrl, checkinStatus}]}\|null, teamB }` |
| M16 | `POST /uploads/presign` | Auth | ขอ URL อัปโหลดไฟล์ขึ้น S3 โดยตรง · `purpose`: `checkin_document` (+matchId · ต้องอยู่ในทีมของแมตช์ + แมตช์ `checkin_open` กฎเดียวกับ M12) · `soft_filter_document` (+tournamentId · key ผูกทั้ง tournament + uploader เป็น `soft_filter_document/{tournamentId}/{userId}/{uuid}.{jpg|png}`; P01 ตรวจ ownership + object existence อีกครั้ง) · `referee_identity` (ผูก user เอง) | `purpose, contentType, matchId?, tournamentId?` | `{ uploadUrl, objectKey, expiresIn }` / **400** `UNSUPPORTED_FILE_TYPE` / **403** `NOT_IN_APPROVED_ROSTER` / **409** `CHECKIN_NOT_OPEN` |

> **"REF ของแมตช์"** (M10, M11, M13, M14, M15) = กรรมการที่ active ในทัวร์ **และ** รับมอบหมายแมตช์นั้นแล้ว (`match_referees.assignment_status='accepted'`)
> ผ่าน `isRefereeOfMatch` — กฎเดียวกับ F12 / S01–S03 · กรรมการของทัวร์ที่ไม่ได้รับแมตช์นั้นได้ 403

> ⚠️ **M12 ค่า enum ใน Part 3 ไม่ตรงกับ DB** — DB ใช้ `method`: `qr_onsite`/`photo_online`/`manual_by_referee`
> และ `match_checkin_status`: `success`/`rejected`/`exception`/`pending` — ยึดค่า DB ตามกฎ Part 0-1 §1.2 แล้วแปลงเป็นคำของ Part 3 ตอนตอบ
> (B2 ตัดสินแล้ว 15 ก.ย. — migration 009):
> `pending` (photo_online รอกรรมการตรวจ) → `pending_verification` · `success` (QR ผ่าน/กรรมการตรวจผ่าน) → `checked_in` ·
> `exception` (กรรมการอนุโลมเช็คอินให้ แบบ `manual_by_referee`) → `checked_in` · `rejected` → `rejected`
>
> **M12 idempotent** — มี `UNIQUE(match_id, user_id)` จริงแล้ว (migration 008) กดซ้ำ/ยิงพร้อมกันได้ 200 พร้อมแถวเดิม
>
> **M01 สายแพ้คัดออก** — จำนวนทีมไม่ต้องเป็นเลขยกกำลัง 2 · ช่องที่ขาดเติมเป็น bye โดย bye จับคู่กับทีมจริงเสมอ
> (random = สุ่มคู่ที่ได้ bye · manual = seed ลำดับต้นได้ bye ก่อน) · double elimination เริ่มได้ตั้งแต่ 2 ทีม ·
> นัดชิง double elimination = แชมป์สายบนเจอแชมป์สายล่าง **นัดเดียวจบ** (ไม่มี bracket reset)
>
> **M01 `TEAM_COUNT_MISMATCH`** — ทีมที่ approved **น้อยกว่า 2** หรือ **น้อยกว่า `min_teams`** ของทัวร์ (ใช้กฎเดียวกันทุก format · ตกลงกับทีม 15 ก.ย.)
> — เช็ค < 2 ไว้ด้วยเพราะ DB ไม่ได้บังคับ `min_teams ≥ 2` ถ้ามีทัวร์ตั้ง 0/1 ไว้ก็ยังสร้างสาย 1 ทีมไม่ได้
>
> **อายุลิงก์/QR** — M11 QR หมดอายุ **20 นาที** (response มี `expiresAt` ให้หน้าจอกรรมการขอใหม่ก่อนหมด) ·
> M16 ลิงก์อัปโหลด และลิงก์ดูเอกสาร soft filter ใน P04 หมดอายุ **20 นาที** (`expiresIn` = 1200)
>
> **M11 QR เซ็นด้วย `CHECKIN_QR_SECRET`** — ไม่ใส่ใน `.env` = ใช้ `JWT_SECRET` แทน (มี `type:'checkin_qr'` ในตัว QR กันเอาไปใช้แทน token login อยู่แล้ว) · production ควรตั้งแยก

> **M16 คือทางเดียวที่ระบบรับไฟล์** — ห้ามส่งไฟล์ผ่าน API server (CO-02 งบจำกัด)
> Flow: client ขอ presign → PUT ไฟล์ขึ้น S3 เอง → ส่งแค่ `objectKey` กลับมาที่ endpoint จริง

---

# 9. Match Results — 10 endpoint

**ไฟล์:** `routes/result.routes.ts` · `result.controller.ts` · `result.service.ts` (★ ไฟล์ที่ซับซ้อนที่สุด) · `matchResult.repo.ts`, `playerMatchStat.repo.ts`, `standings.repo.ts`, `playerProfileStat.repo.ts`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| S01 | `POST /matches/:id/result` | TL/REF ตาม **BR-13** | ส่งผล → `submitted` · idempotent (ส่งซ้ำ = UPDATE) · **scoreData (19 ก.ย.)**: key ต้องเป็นรหัส 2 ทีมของแมตช์ครบทั้งคู่ · คะแนน ≥ 0 · `winnerTeamId` ต้องคะแนนมากกว่า (เสมอยังไม่รองรับ) ไม่งั้น **400** `VALIDATION_FAILED` + `expectedKeys` — กฎเดียวกับ S04 amend · **B4**: ส่งซ้ำได้เฉพาะตอน `submitted`/`rejected` (ส่งใหม่หลัง reject = สถานะกลับเป็น submitted) · ผลที่ verified/disputed → **409** `MATCH_RESULT_ALREADY_VERIFIED` | `winnerTeamId, scoreData` | **201** `{ id, matchId, status:'submitted', submittedBy }` / **403** `WRONG_SUBMITTER_ROLE` / **409** `INSUFFICIENT_REFEREES` |
| S02 | `POST /matches/:id/result/verify` | อีกฝ่ายตาม **BR-13** | ⭐ **transaction 9 ขั้น** — verified + เลื่อนสาย + standings + stats + แต้ม + แจ้งเตือน + audit | — | `{ matchId, status:'verified', winnerTeamId, nextMatchId }` / **403** `SAME_PERSON_CANNOT_VERIFY` |
| S03 | `POST /matches/:id/result/dispute` | TL/REF | โต้แย้งผล · **BR-14 มี 2 จังหวะ**: ก่อน verify (ฝ่ายที่ต้องยืนยันเลือกโต้แย้งแทน — ไม่มีกำหนดเวลา) หรือหลัง verify ภายใน `dispute_window_hours` · active ได้ครั้งละ 1 · ผลที่ `rejected` โต้แย้งไม่ได้ (**409** `RESULT_REJECTED`) | `reason` | `{ matchId, status:'disputed' }` / **409** `DISPUTE_WINDOW_CLOSED` \| `DISPUTE_ALREADY_ACTIVE` \| `RESULT_IS_WALKOVER` |
| S04 | `POST /matches/:id/result/resolve` | ORG | ตัดสินข้อโต้แย้ง · **B4 (19 ก.ย.)**: `uphold` ปิดเรื่อง · `reject` **ถอนผลที่ verify ไปแล้วทั้งหมด** (เอาทีมออกจากรอบถัดไป + bracket_nodes, standings −1, player stats −1) แมตช์ → `result_rejected` รอส่งใหม่ S01→S02 · `amend` ORG ใส่ผู้ชนะ/สกอร์ที่ถูกเอง → ถอนผลเดิม+ใส่ผลใหม่ verified ทันที (`isAmended`) · reject/amend ได้เฉพาะเมื่อแมตช์ถัดไปยัง `scheduled` · **โต้แย้งก่อน verify**: uphold = verify ให้เลย (เดินสาย/standings ตอนนี้) · reject ไม่มีอะไรต้องถอน | `resolution:'uphold'\|'reject'\|'amend', resolutionNote` · amend เพิ่ม `winnerTeamId, scoreData` | `{ matchId, status:'verified'\|'rejected', isAmended }` / **409** `NO_ACTIVE_DISPUTE`, `NEXT_MATCH_STARTED` + `nextMatchId` · **400** winnerTeamId ไม่ใช่ทีมในแมตช์ |
| S05 | `GET /matches/:id/result` | — | ผลแข่ง (คืนเฉพาะ `verified` หรือ `walkover` ไม่งั้น 404) · ผลที่ยัง `submitted/disputed/rejected` เห็นได้เฉพาะ ORG/กรรมการแมตช์/หัวหน้า 2 ทีม (ส่ง token) · มี `status` · **ข้อ 3 (25 ก.ย.)** เพิ่ม `disputeClosesAt` = `verified_at + dispute_window_hours` (**null** = ยังไม่ verify ค้านได้ไม่จำกัดเวลา หรือค้านไม่ได้เลยเพราะเป็นบาย/ถูกปฏิเสธ) และ `resultChangeable` = ค้านแล้ว**แก้ผลได้จริง**ไหม (false เมื่อแมตช์ถัดไปพ้น `scheduled` — ยื่นได้แต่เป็นการร้องเรียนที่ไม่เปลี่ยนผล) **FE ต้องเปลี่ยนคำบนปุ่มตามค่านี้** | — | `{ matchId, winnerTeamId, scoreData, isAmended, amendedAt, amendReason, isWalkover, verifiedAt, disputeClosesAt, resultChangeable }` |
| S06 | `POST /matches/:id/stats` | REF | บันทึกสถิติรายบุคคล · **BR-11** · ผู้เล่นต้องอยู่ใน**รายชื่อลงแข่ง** (`application_players`) ไม่ใช่แค่คลังทีม — OD-17 (แก้ 20 ก.ย.) ไม่งั้น **404** `USER_NOT_IN_MATCH` · `value` **จำนวนเต็มเท่านั้น** และ**บวกสะสม**เมื่อส่งซ้ำ (`data_type` เหลือแค่ `integer` — migration 020, OD-18) | `playerStats: [{userId, values:[{statDefinitionId, value:int}]}]` | **201** `{ matchId, recordedCount }` / **400** `UNKNOWN_STAT_DEFINITION` |
| S07 | `GET /matches/:id/stats` | — | สถิติพร้อม label ไทย · รายชื่อ = ผู้เล่นที่ทีมส่งลงแข่ง (`application_players`) ไม่ใช่ทั้งคลังทีม (แก้ 20 ก.ย.) | — | `{ items: [{userId, fullName, stats:[{statKey, statLabelTh, value}]}] }` |
| S10 | `GET /tournaments/:id/winner` | — | ผู้ชนะ (เฉพาะทัวร์ที่ `completed` — ORG ปิดผ่าน C14b) · อ่านจาก `champion_team_id` ที่เก็บตอนปิด · round robin: แชมป์/รองแชมป์ = อันดับ 1/2 ของตาราง, `finalScore` null · รอบชิงแพ้ทั้งคู่ (M17) หรือ RR เสมออันดับ 1 → `championTeam: null` · รอบชิงบาย → `summary.isWalkover` · `completedAt` = เวลาที่ปิด | — | `{ championTeam \| null, runnerUpTeam \| null, summary:{ finalScore, isWalkover, completedAt } }` |
| S11 | `GET /tournaments/:id/dashboard` | — | ภาพรวมตัวเลข | — | `{ teamCount, playerCount, matchCount, matchesCompleted }` |
| S12 | `GET /tournaments/:id/standings` | — | ตารางคะแนน (**read-only**) · **B3 (21 ก.ย.)** ระบบไม่มีผลเสมอ (OD-20) · เรียง **แต้ม → ผลต่างประตู → ประตูได้ → ชนะ → ชื่อ** · ทีมที่เท่ากันทุกเกณฑ์ได้ `rank` เท่ากัน (1,1,3) · ประตูจาก `scoreData` ของผลที่ verified/walkover (walkover ใช้ `sport_types.walkover_score`) | — | `{ items: [{team, played, wins, losses, points, goalsFor, goalsAgainst, goalDiff, rank}], isProvisional, pendingMatches:[{id,status}] }` · **ข้อ 1 (26 ก.ย.)** `isProvisional: true` = ยังมีแมตช์ไม่สรุป อันดับเปลี่ยนได้ (round robin ทุกแมตช์ป้อนตารางเดียวกัน) · เป็น `false` เองเมื่อไม่เหลือแมตช์ค้าง = อันดับเป็นทางการ |

> **`isAmended` / `amendedAt` / `amendReason` ต้องมีในทุก response ที่คืนผลแข่ง**
> คำนวณจาก `amended_at IS NOT NULL` **ไม่ใช่ค่าใน enum** (NF-SE-05)

---

# 10. Engagement — ประกาศ · รีวิว/โหวต MVP · ความเห็นต่อทัวร์ · Pick'em

## 10.1 ประกาศ + ถ่ายทอดสด (MVP) — 5 endpoint

**ไฟล์:** `routes/announcement.routes.ts` · `announcement.controller.ts` · `announcement.service.ts` · `announcement.repo.ts`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| E08 | `POST /tournaments/:id/announcements` | ORG | ประกาศ + แจ้งเตือนผู้เกี่ยวข้อง | `title, body` | **201** `{ id, title, body, createdAt }` |
| E09 | `GET /tournaments/:id/announcements` | — | รายการประกาศ | `?page&pageSize` | `{ items, pagination }` |
| E10 | `PATCH /announcements/:id` | ORG | แก้ประกาศ | `title?, body?` | `{ id, title, body, createdAt }` |
| E11 | `DELETE /announcements/:id` | ORG | **soft delete** | — | **204** |
| E12 | `PUT /matches/:id/livestream` | ORG | ตั้งลิงก์ถ่ายทอดสด · validate YouTube URL · `youtubeUrl: null` = ล้างลิงก์ | `youtubeUrl` | `{ matchId, youtubeUrl }` / **400** `INVALID_YOUTUBE_URL` |

> ⚠️ E12 — ต้นฉบับ DB ออกแบบให้ลิงก์ถ่ายทอดสดเป็นประกาศ (`announcement_type='livestream'`) ไม่ใช่ field ของแมตช์ ต้องเลือกทางก่อนเขียน ดู [[07 - จุดที่ต้องยืนยันกับทีม]] ข้อ A3

---

## 10.2 รีวิวจากผู้ลงแข่ง + โหวต MVP (C6 · OD-23) — 7 endpoint

**ไฟล์:** `routes/feedback.routes.ts` · `feedback.controller.ts` · `feedback.service.ts` · `feedback.repo.ts` · ตาราง `tournament_feedback` (ไม่มี migration)

> **ชื่อเรียก (ตกลง 23 ก.ย.)** — ตารางเดียวเก็บ 3 เรื่อง อย่าเรียกปนกัน
> `organizer_feedback` = **รีวิวจากผู้ลงแข่ง** (คนลงแข่งให้คะแนนการจัดงาน · ข้อความเห็นแค่ผู้จัด) ·
> `mvp_vote` = **โหวต MVP** (เฉพาะคนที่ไม่ได้ลงแข่ง) ·
> `comment` = **ความเห็นต่อทัวร์** (ใครก็เขียนได้ ทุกคนเห็น — อยู่ข้อ 10.3)

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| E18 | `POST /tournaments/:id/feedback` | ผู้เล่นในรายชื่อ / หัวหน้าทีมที่ approved | ให้คะแนนการจัดงาน · **ส่งซ้ำ = แก้** · เปิดตั้งแต่ทัวร์เริ่มถึง 7 วันหลังปิดทัวร์ | `rating 1–5, content?` | **201** ครั้งแรก / **200** แก้ · `{ id, rating, content, createdAt }` |
| E19 | `GET /tournaments/:id/feedback` | — (ล็อกอินได้ข้อมูลตัวเองเพิ่ม) | ค่าเฉลี่ย/การกระจาย + `status` (`not_started`/`open`/`closed`) + `opensAt`/`closesAt` · ผู้จัดเห็น `items` ไม่เห็นชื่อ · แอดมิน `university_wide` เห็นชื่อ | `—` | `{ summary, status, opensAt, closesAt, mine, canSubmit, items }` |
| E20 | `POST /tournaments/:id/mvp-votes` | คนที่**ไม่ได้**ลงแข่ง | โหวต MVP · ส่งซ้ำ = เปลี่ยนคนที่โหวต · เปิดหลังปิดทัวร์ 7 วัน | `userId` | **200** `{ tournamentId, votedForUserId, changed }` |
| E22 | `GET /tournaments/:id/mvp-votes` | — | ผู้ถูกโหวตทั้งหมด + คะแนน · `winners` โชว์หลังปิดโหวต | `—` | `{ window, candidates, totalVotes, winners, mine, canVote }` |
| E15 | `POST /feedback/:id/report` | Auth | รายงานข้อความ (กดซ้ำได้ผลเดิม) · รีวิว report ได้เฉพาะผู้จัด · ความเห็นต่อทัวร์ report ได้ทุกคนยกเว้นเจ้าของ · **ความเห็นต่อทัวร์ → แจ้งเตือนผู้จัด** (`comment_reported`, ครั้งแรกครั้งเดียว) | `—` | `{ id, isReported: true }` |
| E17 | `DELETE /admin/feedback/:id` | ADM-u | ลบ (soft delete) + audit `feedback_removed` | `reason?` | **204** |
| E17b | `POST /admin/feedback/:id/restore` | ADM-u | **คืนของที่ถูกลบ** + audit `feedback_restored` · ล้างธง report ด้วย (มติ 23 ก.ย. 6.3.3 — เผื่อเจ้าของอุทธรณ์ว่าผู้จัดลบคำวิจารณ์) | `—` | **200** `{ id, restored: true }` |

## 10.3 ความเห็นต่อทัวร์ (C7 · OD-24) — 4 endpoint

> ย้ายจาก "คอมเมนต์ใต้แมตช์" มาเป็นระดับทัวร์ (มติ 22 ก.ย.) · **คนละ 1 อันต่อทัวร์ ส่งซ้ำ = แก้** · ทุกคนอ่านได้ · ทัวร์ต้อง `public`/`completed`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| E13 | `POST /tournaments/:id/comments` | Auth | เขียน/แก้ความเห็นของตัวเอง · ≤ 500 ตัวอักษร · **ไม่มี rate limit** (1 อันต่อคน) · ถูก**ผู้จัด**ลบไปแล้วเขียนใหม่ได้ (ใช้แถวเดิม) · ถูก**แอดมิน**ลบ → 409 `COMMENT_REMOVED` | `content` | **201** ครั้งแรก / **200** แก้ · `{ id, tournamentId, author, content, createdAt, isMine }` |
| E14 | `GET /tournaments/:id/comments` | — (ล็อกอินได้ `mine`/`canComment`) | รายการความเห็น ใหม่สุดก่อน · ไม่โชว์ที่ถูกลบ · ทัวร์ private คนนอกได้ 404 · **`?reported=true` = คิวที่ถูกรายงาน** (ORG ของทัวร์/แอดมินเท่านั้น คนอื่น 403 `NOT_ORGANIZER`) · `isReported` ในแต่ละ item โผล่เฉพาะสองคนนี้ (`canModerate: true`) | `?page&pageSize&reported` | `{ items, mine, canComment, canModerate, pagination }` |
| E14b | `DELETE /tournaments/:id/comments/me` | Auth | เจ้าของลบของตัวเอง (ลบจริง → เขียนใหม่ได้) | `—` | **204** |
| E17c | `DELETE /tournaments/:id/comments/:cid` | ORG ของทัวร์นั้น | **ผู้จัดลบความเห็นของคนอื่น** (มติ 23 ก.ย. ข้อ 6) · ได้เฉพาะ `comment` · `reason` **บังคับ** 1–255 · audit `comment_removed_by_organizer` (`details: reason, tournamentId, authorUserId`) · แจ้งเจ้าของ (`comment_removed`) · **ไม่ใช่การแบน** — เจ้าของเขียนใหม่ได้ (ต่างจากแอดมินลบ) | `reason` | **204** |

## 10.4 Pick'em ทายผล (C7 · OD-24) — 6 endpoint

**ไฟล์:** `routes/engagement.routes.ts` · `engagement.controller.ts` · `pickem.service.ts` · `pickem.repo.ts` · ตาราง `pickem_predictions` (มีอยู่แล้ว)

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| E26 | `POST /matches/:id/predictions` | Auth (**คนนอกทัวร์เท่านั้น**) | ทาย/เปลี่ยนทีมที่คิดว่าชนะ · ปิดเมื่อเปิดเช็คอินหรือถึงเวลาแข่ง | `teamId` | **201** ครั้งแรก / **200** เปลี่ยน · `{ matchId, teamId, changed }` |
| E26b | `DELETE /matches/:id/predictions/me` | Auth | ยกเลิกการทาย (ก่อนปิด) | `—` | **204** |
| E26c | `GET /matches/:id/predictions/summary` | — (ล็อกอินได้ `mine`/`canPredict`) | สรุป % ของสองทีม + สถานะเปิด/ปิด | `—` | `{ matchId, isOpen, closedReason, closesAt, total, teams, mine, canPredict }` |
| E26d | `GET /matches/:id/predictions/me` | Auth | การทายของตัวเองในแมตช์นี้ | `—` | `{ matchId, teamId, pointsEarned, status }` / `null` |
| E27 | `GET /me/pickem` | Auth | ประวัติการทาย + แต้มรวม (`users.total_points`) | `—` | `{ totalPoints, correct, settled, items }` |
| E28 | `GET /tournaments/:id/pickem-leaderboard` | — | อันดับในทัวร์ · แต้มเท่ากันได้อันดับเดียวกัน (1,1,3) | `—` | `{ items: [{ rank, user, points, correct, settled }] }` |

> **แต้ม**: ทายถูก 10 · ผิด 0 · ชนะบาย/ปรับแพ้/ไม่มีการแข่ง = void (ไม่ได้ไม่เสีย) · ให้/คืนแต้มในทรานแซกชันเดียวกับผลแมตช์ จึงถูกต้องทั้งตอน verify, โต้แย้ง, แก้ผล · **ไม่มีแจ้งเตือนผลทาย** (ดูที่ E27)

---

# ภาคผนวก — Error code ที่ใช้ได้ทุก endpoint

| code | HTTP | message ไทย | โยนจากไหน |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบและกรอกใหม่ | `validate` middleware (มากับ `fields` เสมอ) |
| `NO_TOKEN` | 401 | กรุณาเข้าสู่ระบบก่อนใช้งาน | `requireAuth` |
| `TOKEN_EXPIRED` | 401 | เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ | `requireAuth` |
| `ACCOUNT_SUSPENDED` | 403 | บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ | `requireAuth` |
| `NOT_TEAM_LEADER` | 403 | คุณไม่ใช่หัวหน้าทีมนี้ | `requireTeamLeader` |
| `NOT_ORGANIZER` | 403 | คุณไม่ใช่ผู้จัดการแข่งขันของทัวร์นาเมนต์นี้ | `requireOrganizer` |
| `NOT_REFEREE` | 403 | คุณไม่ได้เป็นกรรมการของแมตช์นี้ | `requireReferee` |
| `INSUFFICIENT_ADMIN_SCOPE` | 403 | สิทธิ์ผู้ดูแลระบบของคุณไม่ครอบคลุมขอบเขตนี้ | `requireAdmin` |
| `USER_NOT_FOUND` | 404 | ไม่พบผู้ใช้นี้ในระบบ | service |
| `TEAM_NOT_FOUND` | 404 | ไม่พบทีมนี้ | service |
| `TOURNAMENT_NOT_FOUND` | 404 | ไม่พบทัวร์นาเมนต์นี้ | service |
| `MATCH_NOT_FOUND` | 404 | ไม่พบแมตช์นี้ | service |
| `APPLICATION_NOT_FOUND` | 404 | ไม่พบใบสมัครนี้ | service |
| `INVITATION_NOT_FOUND` | 404 | ไม่พบคำเชิญนี้ | service |
| `CHECKIN_NOT_FOUND` | 404 | ไม่พบรายการเช็คอินนี้ | service (M14, M15) |
| `APPLICATION_ACCESS_DENIED` | 403 | คุณไม่มีสิทธิ์ดูใบสมัครนี้ | service (P04) |
| `NOT_ORGANIZER_OR_REFEREE` | 403 | M11: คุณไม่มีสิทธิ์ขอ QR เช็คอินของแมตช์นี้ · M13: คุณไม่มีสิทธิ์ดูรายการเช็คอินนี้ | service (M11, M13) — auth แบบ "ORG หรือ REF คนใดคนหนึ่งก็ได้" ไม่มี middleware สำเร็จรูปสำหรับ route ที่ระบุ matchId |
| `CANNOT_FOLLOW_SELF` | 409 | ไม่สามารถติดตามหรือเลิกติดตามตัวเองได้ | service (U07/U08) |
| `APPLICATION_NOT_APPROVED` | 409 | ใบสมัครนี้ยังไม่ได้รับการอนุมัติ จึงไม่สามารถถอนตัวได้ | service (P08) |
| `CHECKIN_NOT_OPEN` | 409 | ต้องเปิดเช็คอินก่อนถึงจะเริ่มแข่งได้ | service (M10) — ตั้งตาม pattern `VOTING_NOT_OPEN` (E20) · เดิมชื่อ `MATCH_NOT_CHECKIN_OPEN` |
| `BRACKET_ALREADY_EXISTS` | 409 | ทัวร์นาเมนต์นี้สร้างสายการแข่งขันไปแล้ว | service (M01) — คู่กับ `BRACKET_ALREADY_STARTED` (M03) |
| `MANUAL_SEEDS_MISMATCH` | 422 | manualSeeds ต้องมีทีมครบทุกทีมที่ได้รับอนุมัติ ไม่ซ้ำและไม่ขาด | service (M01) — คู่กับ `TEAM_COUNT_MISMATCH` |
| `BRACKET_FORMAT_NOT_SET` | 422 | ทัวร์นาเมนต์นี้ยังไม่ได้ตั้งรูปแบบการแข่งขัน กรุณาตั้งรูปแบบการแข่งขันก่อนสร้างสาย | service (M01) — `bracket_format` เป็น NULL · เดิมชื่อ `BRACKET_FORMAT_NOT_SUPPORTED` 400 (ชื่อเดิมไม่บอกสาเหตุจริงแล้ว เพราะรองรับครบ 3 รูปแบบ) |
| `SOFT_FILTER_DOCUMENT_INVALID` | 422 | key ของเอกสารไม่ได้เป็นของ user/tournament นี้ หรือชนิดไฟล์ที่เก็บไม่ใช่ JPEG/PNG | service (P01) |
| `SOFT_FILTER_DOCUMENT_NOT_FOUND` | 422 | key ถูกต้องแต่ object ยังไม่มีใน storage (เช่น upload ไม่สำเร็จ/หมด flow) | service (P01) |
| `STORAGE_UNAVAILABLE` | 503 | storage ตรวจสอบ object ไม่ได้ชั่วคราว | upload/application service |
| `APPLICATION_REJECT_REASON_REQUIRED` | 400 | กรุณาระบุเหตุผลที่ปฏิเสธใบสมัคร | `validate(schema, rejectApplicationErrorCodes)` (P06) มากับ `fields` |
| `CHECKIN_REJECT_REASON_REQUIRED` | 400 | กรุณาระบุเหตุผลที่ปฏิเสธการยืนยันตัวตน | `validate(schema, rejectCheckinErrorCodes)` (M15) มากับ `fields` |
| `CHECKIN_METHOD_MISMATCH` | 400 | M12: วิธีเช็คอินไม่ตรงโหมดแมตช์ (onsite→qr_onsite · online→photo_online) — extra `{mode, expectedMethod}` |
| `BRACKET_IN_USE` | 409 | M01 replace: สายเดิมมีแมตช์ที่เริ่ม/เช็คอิน/มีผลแล้ว จับฉลากใหม่ไม่ได้ — extra `{matches}` |
| `TOURNAMENT_COMPLETED` | 409 | ทัวร์ปิดแล้ว (C14b) — write ใต้ /tournaments/:id, /matches/:id, P08 ทำไม่ได้อีก · extra `{tournamentId, completedAt}` |
| `MATCHES_UNFINISHED` | 409 | C14b: ยังมีแมตช์ไม่จบ — extra `{matches:[{id,status}]}` |
| `NO_MATCHES` | 409 | C14b: ยังไม่สร้างสาย ปิดไม่ได้ |
| `ALREADY_REJECTED` | 409 | M14/M15: รายการนี้ถูกปฏิเสธไปแล้ว — ให้ผู้เล่นเช็คอินใหม่ (M12) หรือกรรมการกดให้ (M19) |
| `ALREADY_DECIDED` | 409 | M14: รายการนี้ผ่านไปแล้ว (success/exception) ยืนยันซ้ำไม่ได้ — ถอนได้ทาง M15 |
| `FEEDBACK_NOT_REMOVABLE_BY_ORGANIZER` | 403 | E17c: ผู้จัดลบได้เฉพาะ "ความเห็นต่อทัวร์" — รีวิวจากผู้ลงแข่ง/โหวต MVP ลบไม่ได้ (เป็นการประเมินตัวผู้จัดเอง) |
| `FEEDBACK_NOT_REMOVED` | 409 | E17b: กด restore ทั้งที่ความเห็นนี้ไม่ได้ถูกลบอยู่ |
| `PREDECESSOR_DISPUTED` | 409 | M09: แมตช์ต้นทางยังมีข้อโต้แย้งที่ยังไม่ตัดสิน เปิดเช็คอินแมตช์ถัดไปไม่ได้ (`extra.blockedBy`) |

> **code เฉพาะต่อ field:** `validate(schema, { field: { code, message } })` — ถ้า field นั้นไม่ผ่านจะตอบ code ที่ระบุแทน `VALIDATION_FAILED` (ยังมี `fields` ครบ)
> ไม่ส่งอาร์กิวเมนต์ที่ 2 = ทำงานเหมือนเดิมทุกอย่าง · endpoint อื่นที่ Part 4 มี `*_REASON_REQUIRED` (U10, T18, C05, S03, S08) ใช้วิธีเดียวกันได้
| `RATE_LIMITED` | 429 | ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ | `rateLimit` |
| `INTERNAL_ERROR` | 500 | เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง | `errorHandler` (**ห้ามใส่ stack trace**) |

**กฎตั้งชื่อ code ใหม่** (Part 4 §13):
1. บอก**สาเหตุ** ไม่ใช่ผลลัพธ์ — `TEAM_QUOTA_EXCEEDED` ✅ / `CANNOT_CREATE_TEAM` ❌
2. ค้นตารางเดิมก่อนตั้งใหม่เสมอ
3. ระบุ resource ถ้ากำกวม — `INVITATION_EXPIRED` ✅ / `EXPIRED` ❌
4. `message` ต้องบอกวิธีแก้เมื่อทำได้

**Pattern ที่ใช้ซ้ำ:** `*_NOT_FOUND` (404) · `*_REASON_REQUIRED` (400) · `*_ALREADY_*` (409) · `*_CLOSED`/`*_LOCKED` (409) · `NOT_*` (403)

---

# ภาคผนวก — Rate Limiting (Part 0-1 §1.16)

| endpoint | ขีดจำกัด |
|---|---|
| `POST /auth/login` | 10 ครั้ง / 15 นาที ต่อ IP |
| `POST /auth/register` | 5 ครั้ง / ชั่วโมง ต่อ IP |
| `POST /auth/forgot-password` | 3 ครั้ง / ชั่วโมง ต่ออีเมล (Sprint #1) |

> **ความเห็นต่อทัวร์ (E13) ไม่มี rate limit** — OD-24 (22 ก.ย.) กำหนดให้เขียนได้คนละ 1 อันต่อทัวร์ ส่งซ้ำคือแก้ของเดิม ไม่เพิ่มแถว จึงถล่มรายการไม่ได้อยู่แล้ว (เดิมกำหนดไว้ 10 ครั้ง/นาที ตอนที่ออกแบบให้โพสต์ได้หลายอัน)

# ภาคผนวก — Endpoint ที่ต้อง Idempotent (Part 0-1 §1.11)

| endpoint | ตัวป้องกัน | กดซ้ำต้องได้ |
|---|---|---|
| `POST /matches/:id/checkins` | `UNIQUE (match_id, user_id)` | **200 พร้อมข้อมูลเดิม ไม่ใช่ 409** |
| `POST /matches/:id/result` | `match_results.match_id` UNIQUE | UPDATE แถวเดิม |
| `POST /tournaments/:id/applications` | `UNIQUE (tournament_id, team_id)` | 409 `ALREADY_APPLIED` (อันนี้ error ได้) |

---

ต่อไป → [[07 - จุดที่ต้องยืนยันกับทีม]]
