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

# 2. Users & Profile — 5 endpoint

**ไฟล์:** `routes/user.routes.ts` · `user.controller.ts` · `user.service.ts` · `user.repo.ts` · `user.mapper.ts`

| รหัส | Method + Path          | Auth | ทำอะไร                                            | รับ                                  | คืน                                                                                                                                                     |
| ---- | ---------------------- | ---- | ------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U01  | `GET /me`              | Auth | โปรไฟล์ตัวเอง (มีข้อมูลส่วนตัว)                   | —                                    | `{ id, fullName, email, gender, birthDate, facultyId, departmentId, year, avatarUrl, contactInfo, address, totalPoints, notificationPrefs, createdAt }` |
| U02  | `PATCH /me`            | Auth | แก้โปรไฟล์ · **allowlist 3 field เท่านั้น**       | `avatarUrl?, contactInfo?, address?` | เหมือน U01                                                                                                                                              |
| U03  | `GET /users/:id`       | —    | โปรไฟล์สาธารณะ · **ไม่มี email/contact/address**  | —                                    | `{ id, fullName, avatarUrl, facultyId, departmentId, teams[] }`                                                                                         |
| U04  | `GET /users/:id/stats` | —    | สถิตินักกีฬา (read-only)                          | —                                    | `{ userId, overall{matchesPlayed,wins,losses,winRate,championCount}, bySport[] }`                                                                       |
| U06  | `GET /users/search?q=` | Auth | ค้นคนเพื่อเชิญเข้าทีม · ชื่อ (บางส่วน) หรืออีเมล (ขึ้นต้น) · `q` ≥3 ตัว · **LIMIT 20** | `?q=`                                | `{ items: [{id, fullName, avatarUrl}] }`                                                                                                                |

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
| T03 | `GET /teams/:id` | — | ข้อมูลทีมสาธารณะ | — | `{ id, name, sportTypeId, readinessStatus, officialStatus, leader, memberCount, createdAt }` |
| T04 | `PATCH /teams/:id` | TL | เปลี่ยนชื่อทีม · ถ้า official แล้วต้องบันทึกประวัติ + แจ้ง ORG | `name?` | เหมือน T03 |
| T05 | `DELETE /teams/:id` | TL | **soft delete** · ปฏิเสธถ้ากำลังแข่ง | — | **204** / **409** `TEAM_IN_COMPETITION` |
| T06 | `GET /teams/:id/members` | Auth | รายชื่อสมาชิก (ไม่มี contactInfo) · **ORG/กรรมการของทัวร์ที่ทีมสมัคร**ดูได้ด้วย (เช็คอินด้วยมือ) | — | `{ items: [{userId, fullName, avatarUrl, position, joinedAt}] }` |
| T07 | `PATCH /teams/:id/members/:uid` | TL | ตั้งตัวจริง/ตัวสำรอง · **B6 roster lock (19 ก.ย.)**: ทีมที่มีใบสมัคร `approved` ในทัวร์ที่ยังไม่จบ → **409** `ROSTER_LOCKED` + `tournamentId` ต้องถอนตัว (P08) ก่อน | `position:'starter'\|'substitute'` | `{ userId, position }` |
| T08 | `DELETE /teams/:id/members/:uid` | TL | ถอดสมาชิก · **คำนวณ Ready→Forming ใหม่** · **B6 roster lock (19 ก.ย.)**: ทีมที่มีใบสมัคร `approved` ในทัวร์ที่ยังไม่จบ → **409** `ROSTER_LOCKED` + `tournamentId` ต้องถอนตัว (P08) ก่อน | — | **204** |
| T09 | `POST /teams/:id/invitations` | TL | เชิญเข้าทีม → `pending` · **CoI**: ORG/กรรมการของทัวร์ที่ทีมสมัครอยู่ เข้าทีมไม่ได้ (409 `TEAM_CONFLICT_OF_INTEREST`) · **B6 roster lock (19 ก.ย.)**: ทีมที่มีใบสมัคร `approved` ในทัวร์ที่ยังไม่จบ → **409** `ROSTER_LOCKED` + `tournamentId` ต้องถอนตัว (P08) ก่อน | `invitedUserId` | **201** `{ id, invitedUserId, status:'pending', expiresAt }` |
| T10 | `GET /teams/:id/invitations` | TL | ดูคำเชิญทั้งหมดของทีม | — | `{ items: [{id, invitedUser, status, createdAt}] }` |
| T11 | `DELETE /teams/:id/invitations/:iid` | TL | ยกเลิกคำเชิญที่ยังไม่ตอบ | — | **204** / **409** `INVITATION_ALREADY_ANSWERED` |
| T12 | `GET /me/invitations` | Auth | คำเชิญที่รอฉันตอบ | — | `{ items: [{id, team, invitedBy, expiresAt}] }` |
| T13 | `POST /invitations/:id/accept` | Auth | รับคำเชิญ · **BR-05** · **อาจ Forming→Ready** · transaction · **CoI**: ORG/กรรมการของทัวร์ที่ทีมสมัครอยู่ เข้าทีมไม่ได้ (409 `TEAM_CONFLICT_OF_INTEREST`) · **B6 roster lock (19 ก.ย.)**: ทีมที่มีใบสมัคร `approved` ในทัวร์ที่ยังไม่จบ → **409** `ROSTER_LOCKED` + `tournamentId` ต้องถอนตัว (P08) ก่อน | — | `{ teamId, teamReadinessStatus }` |
| T14 | `POST /invitations/:id/decline` | Auth | ปฏิเสธคำเชิญ | — | **204** |
| T15 | `POST /teams/:id/official-request` | TL | ขอเป็นทีม Official → `pending` | `supportingDocs: string[]` (S3 key) | **201** `{ id, status:'pending' }` |
| T16 | `GET /admin/team-requests` | ADM-u | คิวคำร้องรออนุมัติ | `?page&pageSize` | `{ items: [{id, team, requestedBy, status, createdAt}], pagination }` |
| T17 | `POST /admin/team-requests/:id/approve` | ADM-u | อนุมัติ Official · **เช็ค BR-05 ทุกสมาชิก** · transaction + audit | — | `{ teamId, officialStatus:'official' }` / **422** `MEMBER_CONFLICT` |
| T18 | `POST /admin/team-requests/:id/reject` | ADM-u | ปฏิเสธ · **`reason` บังคับ** | `reason` | `{ status:'rejected', reason }` |

**ไม่มี endpoint (ระบบทำเอง):** `Forming → Ready` (เกิดใน T13) · soft delete จากไม่ใช้งาน (scheduled job, BR-06)

---

# 5. Tournaments — 17 endpoint

**ไฟล์:** `routes/tournament.routes.ts` + `routes/admin.routes.ts`
`tournament.controller.ts` · `tournament.service.ts` · `tournament.repo.ts`, `amendmentRequest.repo.ts`, `auditLog.repo.ts` · `tournament.mapper.ts`

| รหัส | Method + Path                              | Auth  | ทำอะไร                                                                                                            | รับ                                                                                                                                                                                                     | คืน                                                                                                                            |
| ---- | ------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| C01  | `POST /tournaments`                        | Auth  | สร้าง**คำขอ**จัดทัวร์ → `pending_approval` (BR-01) · **admin ในขอบเขตตัวเอง → `private` ทันที** (university_wide ทุกทัวร์ · admin คณะ = ทัวร์ที่ `organizingFacultyId` เป็นคณะตัวเอง) · วันต้องไม่เป็นอดีต (**400** `TOURNAMENT_DATES_IN_PAST`) · ⚠️ `bracketFormat` ใช้ชื่อเต็ม `single_elimination` | `name, sportTypeId, bracketFormat, scopeType, organizingFacultyId, organizingDepartmentId, registrationStart/End, eventStartDate/EndDate, maxTeams, minTeams, venue, genderRequirement, minAge, maxAge` | **201** `{ id, status:'pending_approval'\|'private', name, autoApproved }`                                                                              |
| C02  | `GET /me/tournament-requests`              | Auth  | คำขอของฉัน + สถานะ                                                                                                | `?page&pageSize`                                                                                                                                                                                        | `{ items: [{id, name, status, rejectionReason, createdAt}], pagination }`                                                      |
| C03  | `GET /admin/tournament-requests`           | ADM-f | คิวรอพิจารณา (`pending_approval`)                                                                                 | `?page&pageSize`                                                                                                                                                                                        | `{ items: [{id, name, requestedBy, sportTypeId, eventStartDate, createdAt}], pagination }`                                     |
| C04  | `POST /tournaments/:id/approve`            | ADM-f | อนุมัติ → `private` + audit                                                                                       | —                                                                                                                                                                                                       | `{ id, status:'private', organizerId }`                                                                                        |
| C05  | `POST /tournaments/:id/reject`             | ADM-f | ปฏิเสธ → `rejected` · **`reason` บังคับ**                                                                         | `reason`                                                                                                                                                                                                | `{ id, status:'rejected', reason }`                                                                                            |
| C06  | `GET /tournaments`                         | —     | ค้นหาทัวร์ · **บังคับ `status='public'` ที่ service**                                                             | `?sportTypeId&facultyId&q&page&pageSize`                                                                                                                                                                | `{ items: [{id, name, sportTypeId, eventStartDate, eventEndDate, registrationOpen, venue, organizingFacultyId}], pagination }` |
| C07  | `GET /tournaments/:id`                     | —     | รายละเอียด · ถ้า private + ไม่ใช่ ORG/ADM → **404**                                                               | —                                                                                                                                                                                                       | `{ ...ข้อมูลเต็ม, organizer, approvedTeamCount }`                                                                              |
| C08  | `PATCH /tournaments/:id`                   | ORG   | แก้ข้อมูลทั่วไป · **allowlist**                                                                                   | `venue?, description?`                                                                                                                                                                                  | เหมือน C07                                                                                                                     |
| C09  | `POST /tournaments/:id/amendment-requests` | ORG   | ขอแก้ข้อมูลสำคัญ → `pending`                                                                                      | `requestedChanges` (JSON)                                                                                                                                                                               | **201** `{ id, status:'pending' }`                                                                                             |
| C10  | `GET /admin/amendment-requests`            | ADM-f | คิวคำขอแก้ไข                                                                                                      | `?page&pageSize`                                                                                                                                                                                        | `{ items, pagination }`                                                                                                        |
| C11  | `POST /amendment-requests/:id/approve`     | ADM-f | อนุมัติ · **ต้อง UPDATE tournaments จริงในทรานแซกชันเดียว**                                                       | —                                                                                                                                                                                                       | `{ id, status:'approved' }`                                                                                                    |
| C12  | `POST /amendment-requests/:id/reject`      | ADM-f | ปฏิเสธ · `reason` บังคับ                                                                                          | `reason`                                                                                                                                                                                                | `{ id, status:'rejected', reason }`                                                                                            |
| C13  | `POST /tournaments/:id/publish`            | ORG   | `private → public` · **BR-10 ด่าน 1: pool active ≥ กรรมการที่ 1 แมตช์ต้องใช้** (1 / 2 ถ้า on-site+stat ตาม `default_mode` ของกีฬา) · ด่าน 2 เช็คตอน M10                                                               | —                                                                                                                                                                                                       | `{ id, status:'public' }` / **409** `REFEREES_INCOMPLETE`                                                                      |
| C14  | `POST /tournaments/:id/unpublish`          | ORG   | `public → private`                                                                                                | —                                                                                                                                                                                                       | `{ id, status:'private' }`                                                                                                     |
| C15  | `POST /tournaments/:id/open-registration`  | ORG   | เปิดรับสมัคร                                                                                                      | —                                                                                                                                                                                                       | `{ id, registrationOpen: true }`                                                                                               |
| C16  | `POST /tournaments/:id/close-registration` | ORG   | ปิดรับสมัคร (คำขอค้างยังพิจารณาได้)                                                                               | —                                                                                                                                                                                                       | `{ id, registrationOpen: false }`                                                                                              |
| C17  | `GET /tournaments/:id/eligibility-rules`   | —     | เงื่อนไขคุณสมบัติ                                                                                                 | —                                                                                                                                                                                                       | `{ items: [{ruleType, ruleValue}] }`                                                                                           |

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
| P01 | `POST /tournaments/:id/applications` | TL | สมัครแข่ง · **Hard Filter อัตโนมัติ** · BR-04/08/09 · ต้อง ORG เปิดรับสมัคร (C15) **และ** อยู่ใน `registrationStart–registrationEnd` · ทีมต้องกีฬาเดียวกับทัวร์ · **CoI**: สมาชิกทีมเป็น ORG/กรรมการของทัวร์นี้ไม่ได้ · cancel/withdraw แล้วสมัครใหม่ได้ | `teamId` | **201** `{ id, status:'pending', hardFilterPassed:true }` / **409** `REGISTRATION_CLOSED` (ข้อความบอกว่ายังไม่เปิด / ยังไม่ถึง / หมดช่วง), `SPORT_TYPE_MISMATCH`, `TEAM_CONFLICT_OF_INTEREST` + `conflicts[{userId, role}]` / **422** `HARD_FILTER_FAILED` + `details[]` |
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
| M01 | `POST /tournaments/:id/bracket` | ORG | **สร้างสายทั้งทัวร์** · INSERT matches หลายสิบแถว + bracket_nodes · transaction | `seedingMethod:'random'\|'manual', manualSeeds?` | **201** `{ matchCount, bracketFormat, nodeCount }` / **422** `TEAM_COUNT_MISMATCH` |
| M02 | `GET /tournaments/:id/bracket` | — | ผังสาย (round robin คืน `nodes: []`) · **19 ก.ย.**: `teamA/teamB` ของรอบถัดไปถูกเติมทันทีที่ผลออก (verify / walkover / bye ทุกแบบ sync `bracket_nodes` จาก `matches` — migration 014 backfill ของเก่า) FE ไม่ต้องเอา M01 มาซ้อนแล้ว | — | `{ bracketFormat, nodes: [{nodeId, bracketType, round, matchNumber, teamA, teamB, matchId, matchStatus, advancesToNodeId}] }` |
| M04 | `GET /tournaments/:id/matches` | — | ตารางแข่ง · **19 ก.ย. (B5)**: ทุกแถวมีผลสรุปในตัว FE ไม่ต้องยิง S05/M02 ซ้ำ — `resultStatus` = สถานะใบผลล่าสุด (null ยังไม่ส่ง / submitted / disputed / rejected / verified / walkover) · `score` เฉพาะ verified/walkover (ใบผลที่ยังไม่ยืนยันดูผ่าน S05 ตามสิทธิ์เดิม) · `outcome` เฉพาะแมตช์ `completed`: `played` แข่งจริง · `walkover` คู่ถอน/ไม่มา (แสดง W/O) · `bye` ช่องอีกฝั่งว่างถาวร ทีมเดียวผ่าน (แสดง "BYE" แทนช่องว่าง) · `void` ไม่มีใครผ่าน — แพ้ทั้งคู่/ถอนทั้งคู่/แมตช์ตาย (แสดง "ไม่มีการแข่ง") · ช่องว่างที่ `outcome=null` = ยังรอผลรอบก่อน | `?teamId&status&round&page&pageSize` | `{ items: [{id, round, teamA, teamB, scheduledTime, scheduledEndTime, venue, status, nextMatchId, loserNextMatchId, resultStatus, score, outcome: {kind, winnerTeamId, loserTeamId}\|null}], pagination }` |
| M05 | `GET /matches/:id` | — | รายละเอียดแมตช์ · ฟิลด์ผลสรุปชุดเดียวกับ M04 | — | `{ id, tournamentId, round, teamA, teamB, scheduledTime, scheduledEndTime, venue, checkinOpenAt, status, mode, nextMatchId, loserNextMatchId, resultStatus, score, outcome }` |
| M06 | `PATCH /matches/:id/schedule` | ORG | ตั้ง/เลื่อนเวลา+สนาม · เฉพาะ `scheduled` · อยู่ในวันทัวร์ (ขยายวันผ่าน C09) · **ตรวจทับซ้อนเป็นช่วงเวลา** ทีม/สนาม (แมตช์ที่จบแล้วไม่นับ) · ไม่พังลำดับสาย (`next_match_id` สองทิศ) · กรรมการซ้อน**ไม่ block** ดู F14 (GUIDE/11 Q6) | **B9 (19 ก.ย.): ทุกฟิลด์ optional ส่งเฉพาะที่จะแก้** (แค่ `venue` หรือแค่เวลา — ที่เหลือคงเดิม) · ครั้งแรกที่ยังไม่เคยตั้งต้องครบ 3 ไม่งั้น **400** `SCHEDULE_INCOMPLETE` + `missing[]` · จบ > เริ่ม (เทียบกับค่าเดิมด้วย) · รับทั้ง `Z` และ `+07:00` | เหมือน M05 / **409** `MATCH_NOT_CHANGEABLE`, `OUTSIDE_TOURNAMENT_DATES`, `SCHEDULE_CONFLICT` + `conflictingMatchId`, `SCHEDULE_BREAKS_BRACKET` + `blockingMatchId` |
| M09 | `POST /matches/:id/open-checkin` | ORG | `scheduled → checkin_open` (สถานะอื่นเปิดไม่ได้) | — | `{ id, status:'checkin_open', checkinOpenAt }` / **409** `INVALID_STATUS_TRANSITION` |
| M10 | `POST /matches/:id/start` | REF ของแมตช์ | `checkin_open → in_progress` · **BR-10 ด่าน 2: กรรมการ active ครบ (on-site+stat 2 / อื่น 1) → 409 `INSUFFICIENT_REFEREES`** · **ทีมต้องเช็คอิน ≥ `sport_types.min_members`** — ฝั่งที่ไม่ถึงแพ้บาย (walkover) ทันที · ไม่ถึงทั้งคู่ → 409 ให้ ORG เลื่อน | — | `{ id, status:'in_progress' }` **หรือ** `{ id, status:'completed', walkover:{ matchId, winnerTeamId, loserTeamId, reason:'insufficient_checkins', minMembers, checkedIn } }` / **409** `CHECKIN_NOT_OPEN` \| `MATCH_TEAMS_INCOMPLETE` \| `INSUFFICIENT_REFEREES` \| `INSUFFICIENT_CHECKINS` (+`minMembers, checkedIn`) |
| M11 | `GET /matches/:id/checkin-qr` | ORG / REF ของแมตช์ | QR สำหรับ on-site · ขอได้เฉพาะแมตช์ `checkin_open` | — | `{ qrPayload, expiresAt }` / **409** `CHECKIN_NOT_OPEN` |
| M12 | `POST /matches/:id/checkins` | Auth | เช็คอิน · **idempotent (กดซ้ำ = 200 แม้แมตช์เริ่มแล้ว)** · เช็คอินใหม่ได้เฉพาะแมตช์ `checkin_open` (ไม่งั้น **409** `CHECKIN_NOT_OPEN`) | on-site: `method:'qr_onsite', qrPayload` · online: `method:'photo_online', documentType, documentS3Key` ⚠️ | **201/200** `{ id, status, checkedInAt }` / **403** `NOT_IN_APPROVED_ROSTER` |
| M13 | `GET /matches/:id/checkins` | ORG / REF ของแมตช์ | รายชื่อผู้เช็คอิน · `id` ใช้เป็น `:cid` ของ M14/M15 · **`documentUrl` (presigned 20 นาที) ให้เฉพาะกรรมการของแมตช์** ORG ได้ `null` (PDPA NF-SE-03) | — | `{ items: [{id, userId, fullName, method, status, documentType, documentUrl, checkedInAt}] }` |
| M14 | `POST /matches/:id/checkins/:cid/verify` | REF ของแมตช์ | ตรวจเอกสารผ่าน (online) · เฉพาะเช็คอินที่ `pending` · ตัดสินได้ครั้งเดียว · แมตช์ต้อง `checkin_open` หรือ `in_progress` | — | `{ id, status:'verified' }` / **409** `ALREADY_DECIDED` \| `MATCH_NOT_CHANGEABLE` |
| M15 | `POST /matches/:id/checkins/:cid/reject` | REF ของแมตช์ | ตรวจไม่ผ่าน · `reason` บังคับ · เฉพาะเช็คอินที่ `pending` · ตัดสินได้ครั้งเดียว · แมตช์ต้อง `checkin_open` หรือ `in_progress` | `reason` | `{ id, status:'rejected', reason }` / **409** `ALREADY_DECIDED` \| `MATCH_NOT_CHANGEABLE` |
| M17 | `POST /matches/:id/forfeit` | ORG | **ตัดสินทีมไม่มาตามนัด** · เฉพาะ `checkin_open` · ฝั่งที่เช็คอิน < `min_members` แพ้บาย · ไม่ถึงทั้งคู่ = **แพ้ทั้งคู่** (ไม่มีใครเดินสาย ช่องว่างรอบถัดไปให้ทีมที่รอบายผ่าน) · ครบทั้งคู่ → 409 ให้กรรมการ M10 | — | `{ id, status:'completed', kind:'walkover'\|'double_forfeit', minMembers, checkedIn, walkovers:[{matchId, winnerTeamId, loserTeamId}] }` / **409** `CHECKIN_NOT_OPEN` \| `MATCH_TEAMS_INCOMPLETE` \| `TEAMS_PRESENT` |
| M18 | `POST /matches/:id/close-checkin` | ORG | **ปิดเช็คอินกลับเป็น `scheduled`** (เหตุสุดวิสัย เช่น ฝนตก) · ล้าง `match_checkins` ของรอบนี้ · แล้วไปเลื่อนด้วย M06 | — | `{ id, status:'scheduled', checkinOpenAt:null }` / **409** `INVALID_STATUS_TRANSITION` |
| M19 | `POST /matches/:id/checkins/manual` | REF ของแมตช์ | **เช็คอินแทนผู้เล่น** (กล้อง/เน็ต/QR ใช้ไม่ได้) → `manual_by_referee` / `exception` = นับว่าเช็คอินแล้ว · แมตช์ต้อง `checkin_open` · ผู้เล่นต้องอยู่ roster | `userId, note?` | **201** `{ id, userId, method, status:'checked_in', checkedInAt }` / **403** `NOT_IN_APPROVED_ROSTER` / **409** `CHECKIN_NOT_OPEN` \| `ALREADY_CHECKED_IN` |
| M20 | `GET /matches/:id/checkins/me` | Auth | สถานะเช็คอินของตัวเองในแมตช์นี้ | — | `{ checkin: null \| { id, method, status, rejectionReason, checkedInAt, verifiedAt } }` |
| M16 | `POST /uploads/presign` | Auth | ขอ URL อัปโหลดไฟล์ขึ้น S3 โดยตรง · `purpose`: `checkin_document` (+matchId · ต้องอยู่ในทีมของแมตช์ + แมตช์ `checkin_open` กฎเดียวกับ M12) · `soft_filter_document` (+tournamentId · แค่ทัวร์ต้องมีจริง) · `referee_identity` (ผูก user เอง) | `purpose, contentType, matchId?, tournamentId?` | `{ uploadUrl, objectKey, expiresIn }` / **400** `UNSUPPORTED_FILE_TYPE` / **403** `NOT_IN_APPROVED_ROSTER` / **409** `CHECKIN_NOT_OPEN` |

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
| S01 | `POST /matches/:id/result` | TL/REF ตาม **BR-13** | ส่งผล → `submitted` · idempotent (ส่งซ้ำ = UPDATE) · **B4**: ส่งซ้ำได้เฉพาะตอน `submitted`/`rejected` (ส่งใหม่หลัง reject = สถานะกลับเป็น submitted) · ผลที่ verified/disputed → **409** `MATCH_RESULT_ALREADY_VERIFIED` | `winnerTeamId, scoreData` | **201** `{ id, matchId, status:'submitted', submittedBy }` / **403** `WRONG_SUBMITTER_ROLE` / **409** `INSUFFICIENT_REFEREES` |
| S02 | `POST /matches/:id/result/verify` | อีกฝ่ายตาม **BR-13** | ⭐ **transaction 9 ขั้น** — verified + เลื่อนสาย + standings + stats + แต้ม + แจ้งเตือน + audit | — | `{ matchId, status:'verified', winnerTeamId, nextMatchId }` / **403** `SAME_PERSON_CANNOT_VERIFY` |
| S03 | `POST /matches/:id/result/dispute` | TL/REF | โต้แย้งผล · **BR-14** ภายใน `dispute_window_hours` · active ได้ครั้งละ 1 | `reason` | `{ matchId, status:'disputed' }` / **409** `DISPUTE_WINDOW_CLOSED` \| `DISPUTE_ALREADY_ACTIVE` \| `RESULT_IS_WALKOVER` |
| S04 | `POST /matches/:id/result/resolve` | ORG | ตัดสินข้อโต้แย้ง · **B4 (19 ก.ย.)**: `uphold` ปิดเรื่อง · `reject` **ถอนผลที่ verify ไปแล้วทั้งหมด** (เอาทีมออกจากรอบถัดไป + bracket_nodes, standings −1, player stats −1) แมตช์ → `result_rejected` รอส่งใหม่ S01→S02 · `amend` ORG ใส่ผู้ชนะ/สกอร์ที่ถูกเอง → ถอนผลเดิม+ใส่ผลใหม่ verified ทันที (`isAmended`) · reject/amend ได้เฉพาะเมื่อแมตช์ถัดไปยัง `scheduled` | `resolution:'uphold'\|'reject'\|'amend', resolutionNote` · amend เพิ่ม `winnerTeamId, scoreData` | `{ matchId, status:'verified'\|'rejected', isAmended }` / **409** `NO_ACTIVE_DISPUTE`, `NEXT_MATCH_STARTED` + `nextMatchId` · **400** winnerTeamId ไม่ใช่ทีมในแมตช์ |
| S05 | `GET /matches/:id/result` | — | ผลแข่ง (คืนเฉพาะ `verified` หรือ `walkover` ไม่งั้น 404) · ผลที่ยัง `submitted/disputed/rejected` เห็นได้เฉพาะ ORG/กรรมการแมตช์/หัวหน้า 2 ทีม (ส่ง token) · มี `status` | — | `{ matchId, winnerTeamId, scoreData, isAmended, amendedAt, amendReason, isWalkover, verifiedAt }` |
| S06 | `POST /matches/:id/stats` | REF | บันทึกสถิติรายบุคคล · **BR-11** | `playerStats: [{userId, values:[{statDefinitionId, value}]}]` | **201** `{ matchId, recordedCount }` / **400** `UNKNOWN_STAT_DEFINITION` |
| S07 | `GET /matches/:id/stats` | — | สถิติพร้อม label ไทย | — | `{ items: [{userId, fullName, stats:[{statKey, statLabelTh, value}]}] }` |
| S10 | `GET /tournaments/:id/winner` | — | ผู้ชนะ (เฉพาะทัวร์ที่ `completed`) · รอบชิงแพ้ทั้งคู่ (M17) → `championTeam: null` · รอบชิงบาย → `summary.isWalkover` | — | `{ championTeam \| null, runnerUpTeam \| null, summary:{ finalScore, isWalkover, completedAt } }` |
| S11 | `GET /tournaments/:id/dashboard` | — | ภาพรวมตัวเลข | — | `{ teamCount, playerCount, matchCount, matchesCompleted }` |
| S12 | `GET /tournaments/:id/standings` | — | ตารางคะแนน (**read-only** ระบบคำนวณ) | — | `{ items: [{team, wins, losses, pointsFor, pointsAgainst, rank}] }` |

> **`isAmended` / `amendedAt` / `amendReason` ต้องมีในทุก response ที่คืนผลแข่ง**
> คำนวณจาก `amended_at IS NOT NULL` **ไม่ใช่ค่าใน enum** (NF-SE-05)

---

# 10. Engagement (MVP) — 5 endpoint

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
| `APPLICATION_NOT_APPROVED` | 409 | ใบสมัครนี้ยังไม่ได้รับการอนุมัติ จึงไม่สามารถถอนตัวได้ | service (P08) |
| `CHECKIN_NOT_OPEN` | 409 | ต้องเปิดเช็คอินก่อนถึงจะเริ่มแข่งได้ | service (M10) — ตั้งตาม pattern `VOTING_NOT_OPEN` (E20) · เดิมชื่อ `MATCH_NOT_CHECKIN_OPEN` |
| `BRACKET_ALREADY_EXISTS` | 409 | ทัวร์นาเมนต์นี้สร้างสายการแข่งขันไปแล้ว | service (M01) — คู่กับ `BRACKET_ALREADY_STARTED` (M03) |
| `MANUAL_SEEDS_MISMATCH` | 422 | manualSeeds ต้องมีทีมครบทุกทีมที่ได้รับอนุมัติ ไม่ซ้ำและไม่ขาด | service (M01) — คู่กับ `TEAM_COUNT_MISMATCH` |
| `BRACKET_FORMAT_NOT_SET` | 422 | ทัวร์นาเมนต์นี้ยังไม่ได้ตั้งรูปแบบการแข่งขัน กรุณาตั้งรูปแบบการแข่งขันก่อนสร้างสาย | service (M01) — `bracket_format` เป็น NULL · เดิมชื่อ `BRACKET_FORMAT_NOT_SUPPORTED` 400 (ชื่อเดิมไม่บอกสาเหตุจริงแล้ว เพราะรองรับครบ 3 รูปแบบ) |
| `APPLICATION_REJECT_REASON_REQUIRED` | 400 | กรุณาระบุเหตุผลที่ปฏิเสธใบสมัคร | `validate(schema, rejectApplicationErrorCodes)` (P06) มากับ `fields` |
| `CHECKIN_REJECT_REASON_REQUIRED` | 400 | กรุณาระบุเหตุผลที่ปฏิเสธการยืนยันตัวตน | `validate(schema, rejectCheckinErrorCodes)` (M15) มากับ `fields` |

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
| `POST /tournaments/:id/comments` | 10 ครั้ง / นาที ต่อผู้ใช้ (Sprint #1) |

# ภาคผนวก — Endpoint ที่ต้อง Idempotent (Part 0-1 §1.11)

| endpoint | ตัวป้องกัน | กดซ้ำต้องได้ |
|---|---|---|
| `POST /matches/:id/checkins` | `UNIQUE (match_id, user_id)` | **200 พร้อมข้อมูลเดิม ไม่ใช่ 409** |
| `POST /matches/:id/result` | `match_results.match_id` UNIQUE | UPDATE แถวเดิม |
| `POST /tournaments/:id/applications` | `UNIQUE (tournament_id, team_id)` | 409 `ALREADY_APPLIED` (อันนี้ error ได้) |

---

ต่อไป → [[07 - จุดที่ต้องยืนยันกับทีม]]
