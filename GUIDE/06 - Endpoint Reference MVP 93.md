# 06 — Endpoint Reference (MVP 93 endpoint)

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
| U06  | `GET /users/search?q=` | Auth | ค้นคนเพื่อเชิญเข้าทีม · `q` ≥3 ตัว · **LIMIT 20** | `?q=`                                | `{ items: [{id, fullName, avatarUrl}] }`                                                                                                                |

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
| T06 | `GET /teams/:id/members` | Auth | รายชื่อสมาชิก (ไม่มี contactInfo) | — | `{ items: [{userId, fullName, avatarUrl, position, joinedAt}] }` |
| T07 | `PATCH /teams/:id/members/:uid` | TL | ตั้งตัวจริง/ตัวสำรอง | `position:'starter'\|'substitute'` | `{ userId, position }` |
| T08 | `DELETE /teams/:id/members/:uid` | TL | ถอดสมาชิก · **คำนวณ Ready→Forming ใหม่** | — | **204** |
| T09 | `POST /teams/:id/invitations` | TL | เชิญเข้าทีม → `pending` | `invitedUserId` | **201** `{ id, invitedUserId, status:'pending', expiresAt }` |
| T10 | `GET /teams/:id/invitations` | TL | ดูคำเชิญทั้งหมดของทีม | — | `{ items: [{id, invitedUser, status, createdAt}] }` |
| T11 | `DELETE /teams/:id/invitations/:iid` | TL | ยกเลิกคำเชิญที่ยังไม่ตอบ | — | **204** / **409** `INVITATION_ALREADY_ANSWERED` |
| T12 | `GET /me/invitations` | Auth | คำเชิญที่รอฉันตอบ | — | `{ items: [{id, team, invitedBy, expiresAt}] }` |
| T13 | `POST /invitations/:id/accept` | Auth | รับคำเชิญ · **BR-05** · **อาจ Forming→Ready** · transaction | — | `{ teamId, teamReadinessStatus }` |
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
| C01  | `POST /tournaments`                        | Auth  | สร้าง**คำขอ**จัดทัวร์ → `pending_approval` เท่านั้น (BR-01) · ⚠️ `bracketFormat` ใช้ชื่อเต็ม `single_elimination` | `name, sportTypeId, bracketFormat, scopeType, organizingFacultyId, organizingDepartmentId, registrationStart/End, eventStartDate/EndDate, maxTeams, minTeams, venue, genderRequirement, minAge, maxAge` | **201** `{ id, status:'pending_approval', name }`                                                                              |
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
| C13  | `POST /tournaments/:id/publish`            | ORG   | `private → public` · **BR-10 กรรมการ accepted ครบ**                                                               | —                                                                                                                                                                                                       | `{ id, status:'public' }` / **409** `REFEREES_INCOMPLETE`                                                                      |
| C14  | `POST /tournaments/:id/unpublish`          | ORG   | `public → private`                                                                                                | —                                                                                                                                                                                                       | `{ id, status:'private' }`                                                                                                     |
| C15  | `POST /tournaments/:id/open-registration`  | ORG   | เปิดรับสมัคร                                                                                                      | —                                                                                                                                                                                                       | `{ id, registrationOpen: true }`                                                                                               |
| C16  | `POST /tournaments/:id/close-registration` | ORG   | ปิดรับสมัคร (คำขอค้างยังพิจารณาได้)                                                                               | —                                                                                                                                                                                                       | `{ id, registrationOpen: false }`                                                                                              |
| C17  | `GET /tournaments/:id/eligibility-rules`   | —     | เงื่อนไขคุณสมบัติ                                                                                                 | —                                                                                                                                                                                                       | `{ items: [{ruleType, ruleValue}] }`                                                                                           |

---

# 6. Referees — 9 endpoint

**ไฟล์:** `routes/referee.routes.ts` (+ path `/matches/:id/referees` อยู่ใน `match.routes.ts` ก็ได้)
`referee.controller.ts` · `referee.service.ts` · `tournamentReferee.repo.ts`, `matchReferee.repo.ts`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| F01 | `POST /tournaments/:id/referees` | ORG | เชิญเป็นกรรมการระดับทัวร์ → `pending` | `userId, isExternal` | **201** `{ id, userId, invitationStatus:'pending', isExternal }` |
| F02 | `GET /tournaments/:id/referees` | ORG | ดูสถานะตอบรับ + นับ accepted (เช็ค BR-10) | — | `{ items: [{id, user, invitationStatus, isExternal, externalApprovalStatus}], acceptedCount }` |
| F03 | `DELETE /tournaments/:id/referees/:rid` | ORG | ถอดกรรมการ · **soft delete** · ลบ match_referees ด้วย · เช็ค BR-10 ใหม่ | — | **204** / **409** `WOULD_BREAK_REFEREE_MINIMUM` |
| F04 | `GET /me/referee-invitations` | Auth | คำเชิญกรรมการที่รอฉันตอบ | — | `{ items: [{id, tournament, isExternal, createdAt}] }` |
| F05 | `POST /referee-invitations/:id/accept` | Auth | ตอบรับ **ครั้งเดียว ใช้ได้ทุกแมตช์** | — | `{ id, invitationStatus:'accepted', requiresAdminApproval }` |
| F06 | `POST /referee-invitations/:id/decline` | Auth | ปฏิเสธ | — | **204** |
| F11 | `POST /matches/:id/referees` | ORG | มอบหมายเข้าแมตช์ · ต้อง `accepted` ก่อน | `tournamentRefereeId` | **201** `{ matchId, tournamentRefereeId, referee }` / **409** `REFEREE_NOT_ACCEPTED` |
| F12 | `GET /matches/:id/referees` | — | กรรมการที่คุมแมตช์นี้ | — | `{ items: [{tournamentRefereeId, referee}] }` |
| F13 | `DELETE /matches/:id/referees/:rid` | ORG | ถอดออกจากแมตช์นี้เท่านั้น (ไม่กระทบระดับทัวร์) | — | **204** |

---

# 7. Applications — 9 endpoint

**ไฟล์:** `routes/application.routes.ts` · `application.controller.ts` · `application.service.ts` · `application.repo.ts` · `application.mapper.ts`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| P01 | `POST /tournaments/:id/applications` | TL | สมัครแข่ง · **Hard Filter อัตโนมัติ** · BR-04/08/09 | `teamId` | **201** `{ id, status:'pending', hardFilterPassed:true }` / **422** `HARD_FILTER_FAILED` + `details[]` |
| P02 | `GET /me/applications` | Auth | ใบสมัครของฉัน + เหตุผลถ้าถูกปฏิเสธ | `?page&pageSize` | `{ items: [{id, tournament, team, status, rejectionReason, appliedAt}], pagination }` |
| P03 | `GET /tournaments/:id/applications` | ORG | ใบสมัครทั้งหมด · `softFilterDocuments` = **S3 key ดิบ** | `?page&pageSize` | `{ items: [{id, team, status, hardFilterPassed, softFilterDocuments, appliedAt}], pagination }` |
| P04 | `GET /applications/:id` | ORG/TL | รายละเอียด · `softFilterDocuments` = **presigned URL** | — | `{ id, tournamentId, team, status, hardFilterDetails[], softFilterDocuments[] }` |
| P05 | `POST /applications/:id/approve` | ORG | อนุมัติ (Soft Filter ดุลพินิจ) | — | `{ id, status:'approved' }` |
| P06 | `POST /applications/:id/reject` | ORG | ปฏิเสธ · `reason` บังคับ | `reason` | `{ id, status:'rejected', reason }` |
| P07 | `POST /applications/:id/cancel` | TL | **ยกเลิกก่อนอนุมัติ** (ต้องเป็น `pending`) | — | `{ id, status:'cancelled' }` / **409** `ALREADY_DECIDED` |
| P08 | `POST /applications/:id/withdraw` | TL | **ถอนตัวหลังอนุมัติ** · คืนช่องว่าง + แจ้ง ORG | — | `{ id, status:'withdrawn', bracketExists }` |
| P09 | `GET /tournaments/:id/teams` | — | ทีมที่อนุมัติแล้ว (สาธารณะ) | — | `{ items: TeamRef[] }` |

---

# 8. Brackets & Matches — 13 endpoint

**ไฟล์:** `routes/match.routes.ts` · `match.controller.ts` · `match.service.ts`, `bracket.service.ts` · `match.repo.ts`, `bracketNode.repo.ts`, `matchCheckin.repo.ts` · `match.mapper.ts`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| M01 | `POST /tournaments/:id/bracket` | ORG | **สร้างสายทั้งทัวร์** · INSERT matches หลายสิบแถว + bracket_nodes · transaction | `seedingMethod:'random'\|'manual', manualSeeds?` | **201** `{ matchCount, bracketFormat, nodeCount }` / **422** `TEAM_COUNT_MISMATCH` |
| M02 | `GET /tournaments/:id/bracket` | — | ผังสาย (round robin คืน `nodes: []`) | — | `{ bracketFormat, nodes: [{nodeId, bracketType, round, matchNumber, teamA, teamB, matchId, matchStatus, advancesToNodeId}] }` |
| M04 | `GET /tournaments/:id/matches` | — | ตารางแข่ง | `?teamId&status&round&page&pageSize` | `{ items: [{id, round, teamA, teamB, scheduledTime, venue, status}], pagination }` |
| M05 | `GET /matches/:id` | — | รายละเอียดแมตช์ | — | `{ id, tournamentId, round, teamA, teamB, scheduledTime, venue, checkinOpenAt, status, mode, nextMatchId }` |
| M06 | `PATCH /matches/:id/schedule` | ORG | ตั้งเวลา+สนาม · **ตรวจทับซ้อน 3 มิติ** | `scheduledTime, venue` | เหมือน M05 / **409** `SCHEDULE_CONFLICT` + `conflictingMatchId` |
| M09 | `POST /matches/:id/open-checkin` | ORG | `scheduled → checkin_open` | — | `{ id, status:'checkin_open', checkinOpenAt }` |
| M10 | `POST /matches/:id/start` | REF | `checkin_open → in_progress` · ต้องมีคนเช็คอินขั้นต่ำ | — | `{ id, status:'in_progress' }` / **409** `INSUFFICIENT_CHECKINS` |
| M11 | `GET /matches/:id/checkin-qr` | ORG/REF | QR สำหรับ on-site | — | `{ qrPayload, expiresAt }` |
| M12 | `POST /matches/:id/checkins` | Auth | เช็คอิน · **idempotent (กดซ้ำ = 200)** | on-site: `method:'qr_onsite', qrPayload` · online: `method:'photo_online', documentType, documentS3Key` ⚠️ | **201/200** `{ id, status, checkedInAt }` / **403** `NOT_IN_APPROVED_ROSTER` |
| M13 | `GET /matches/:id/checkins` | REF/ORG | รายชื่อผู้เช็คอิน | — | `{ items: [{userId, fullName, method, status, checkedInAt}] }` |
| M14 | `POST /matches/:id/checkins/:cid/verify` | REF | ตรวจเอกสารผ่าน (online) | — | `{ id, status:'verified' }` |
| M15 | `POST /matches/:id/checkins/:cid/reject` | REF | ตรวจไม่ผ่าน · `reason` บังคับ | `reason` | `{ id, status:'rejected', reason }` |
| M16 | `POST /uploads/presign` | Auth | ขอ URL อัปโหลดไฟล์ขึ้น S3 โดยตรง | `purpose, contentType, matchId?, tournamentId?` | `{ uploadUrl, objectKey, expiresIn }` |

> ⚠️ **M12 ค่า enum ใน Part 3 ไม่ตรงกับ DB** — DB ใช้ `method`: `qr_onsite`/`photo_online`/`manual_by_referee`
> และ `match_checkin_status`: `success`/`rejected`/`exception` (ไม่ใช่ `checked_in`/`pending_verification`)
> ยึดค่า DB ตามกฎ Part 0-1 §1.2 — ดู [[07 - จุดที่ต้องยืนยันกับทีม]] ข้อ B1/B2

> **M16 คือทางเดียวที่ระบบรับไฟล์** — ห้ามส่งไฟล์ผ่าน API server (CO-02 งบจำกัด)
> Flow: client ขอ presign → PUT ไฟล์ขึ้น S3 เอง → ส่งแค่ `objectKey` กลับมาที่ endpoint จริง

---

# 9. Match Results — 10 endpoint

**ไฟล์:** `routes/result.routes.ts` · `result.controller.ts` · `result.service.ts` (★ ไฟล์ที่ซับซ้อนที่สุด) · `matchResult.repo.ts`, `playerMatchStat.repo.ts`, `standings.repo.ts`, `playerProfileStat.repo.ts`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| S01 | `POST /matches/:id/result` | TL/REF ตาม **BR-13** | ส่งผล → `submitted` · idempotent (ส่งซ้ำ = UPDATE) | `winnerTeamId, scoreData` | **201** `{ id, matchId, status:'submitted', submittedBy }` / **403** `WRONG_SUBMITTER_ROLE` / **409** `INSUFFICIENT_REFEREES` |
| S02 | `POST /matches/:id/result/verify` | อีกฝ่ายตาม **BR-13** | ⭐ **transaction 9 ขั้น** — verified + เลื่อนสาย + standings + stats + แต้ม + แจ้งเตือน + audit | — | `{ matchId, status:'verified', winnerTeamId, nextMatchId }` / **403** `SAME_PERSON_CANNOT_VERIFY` |
| S03 | `POST /matches/:id/result/dispute` | TL/REF | โต้แย้งผล · **BR-14** ภายใน `dispute_window_hours` · active ได้ครั้งละ 1 | `reason` | `{ matchId, status:'disputed' }` / **409** `DISPUTE_WINDOW_CLOSED` \| `DISPUTE_ALREADY_ACTIVE` |
| S04 | `POST /matches/:id/result/resolve` | ORG | ตัดสินข้อโต้แย้ง | `resolution:'uphold'\|'reject', resolutionNote` | `{ matchId, status:'verified'\|'rejected' }` |
| S05 | `GET /matches/:id/result` | — | ผลแข่ง (คืนเฉพาะ `verified` ไม่งั้น 404) | — | `{ matchId, winnerTeamId, scoreData, isAmended, amendedAt, amendReason, verifiedAt }` |
| S06 | `POST /matches/:id/stats` | REF | บันทึกสถิติรายบุคคล · **BR-11** | `playerStats: [{userId, values:[{statDefinitionId, value}]}]` | **201** `{ matchId, recordedCount }` / **400** `UNKNOWN_STAT_DEFINITION` |
| S07 | `GET /matches/:id/stats` | — | สถิติพร้อม label ไทย | — | `{ items: [{userId, fullName, stats:[{statKey, statLabelTh, value}]}] }` |
| S10 | `GET /tournaments/:id/winner` | — | ผู้ชนะ (เฉพาะทัวร์ที่ `completed`) | — | `{ championTeam, runnerUpTeam, summary }` |
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
| E12 | `PUT /matches/:id/livestream` | ORG | ตั้งลิงก์ถ่ายทอดสด · validate YouTube URL | `youtubeUrl` | `{ matchId, youtubeUrl }` / **400** `INVALID_YOUTUBE_URL` |

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
