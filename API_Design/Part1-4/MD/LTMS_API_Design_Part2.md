# LTMS — API Design ตอนที่ 2
## Endpoint Matrix

**เวอร์ชัน:** 0.1 (ร่างแรก)
**วันที่:** 2 สิงหาคม 2569
**ต่อจาก:** `LTMS_API_Design_Part0-1.md` (Conventions + Resource Inventory)
**ยังไม่รวม:** request/response schema รายตัว (ตอนที่ 3), error catalog (ตอนที่ 4), OpenAPI YAML (ตอนที่ 5)

---

## วิธีอ่านเอกสารนี้

ทุก endpoint ละ prefix `/api/v1` ไว้

**คอลัมน์ Auth**
| สัญลักษณ์ | ความหมาย |
|---|---|
| `—` | Public ไม่ต้องล็อกอิน |
| `Auth` | `requireAuth` อย่างเดียว |
| `TL` | Team Leader ของทีมนั้น |
| `ORG` | Organizer ของทัวร์นาเมนต์นั้น |
| `REF` | Referee ที่ `invitation_status='accepted'` ของแมตช์นั้น |
| `ADM-f` | Admin scope `faculty` |
| `ADM-u` | Admin scope `university_wide` |
| `SYS` | ไม่มี endpoint — scheduled job หรือระบบทำเอง |

**คอลัมน์ Sprint** อ้างจาก Traceability Matrix (SRS ภาคผนวก ก) และตาราง 2.3
**⚠️** = ยังไม่ผ่าน Change Management ตัดออกได้โดยไม่กระทบส่วนอื่น

**สรุปจำนวน:** 146 endpoint (MVP 93 / Sprint #1 45 / Sprint #2 8) — เพิ่มจาก 142 เป็น 146 ในรอบที่ 5 (เพิ่ม R05 สำหรับ sport stat definitions + E34-E36 สำหรับจัดการ `/admin/rewards` ที่ขาดหายไป — ดูหัวข้อ 10)

---

# 1. Auth (FR-UM)

| # | FR | Method + Path | Auth | Guard / BR | Transition | Sprint |
|---|---|---|---|---|---|---|
| A01 | UM-01 | `POST /auth/register` | — | อีเมลไม่ซ้ำ, รหัสผ่านผ่านเกณฑ์ | Guest → User | MVP |
| A02 | UM-02 | `POST /auth/login` | — | เช็ค `is_suspended` | — | MVP |
| A03 | UM-02 | `POST /auth/logout` | Auth | — | — | MVP |
| A04 | UM-04 | `POST /auth/forgot-password` | — | rate limit 3/ชม./อีเมล | — | Sprint #1 |
| A05 | UM-04 | `POST /auth/reset-password` | — | token ใช้ครั้งเดียว + ยังไม่หมดอายุ | — | Sprint #1 |
| A06 | UM-04 | `POST /auth/change-password` | Auth | ต้องส่งรหัสผ่านเดิม | — | Sprint #1 |

**หมายเหตุการออกแบบ**

`POST /auth/logout` มีทั้งที่ระบบไม่มี session ฝั่ง server — endpoint นี้แค่ตอบ 204 ให้ frontend ล้าง token ทิ้ง มีไว้เพื่อความชัดเจนของ API และรองรับการเพิ่ม token blacklist ในอนาคต

`POST /auth/reset-password` ไม่ต้องมี JWT เพราะผู้ใช้เข้าไม่ได้อยู่แล้ว ใช้ token จากอีเมลแทน (`password_reset_tokens`) ต้องเช็ค 3 อย่าง — มีอยู่จริง, ยังไม่ถูกใช้, ยังไม่หมดอายุ ตาม FR-UM-04

**ข้อควรระวังด้านความปลอดภัย** `forgot-password` ต้องตอบ 200 เหมือนกันทุกกรณี **ไม่ว่าอีเมลนั้นมีในระบบหรือไม่** ไม่งั้นจะกลายเป็นเครื่องมือให้คนไล่เช็คว่าใครสมัครไว้บ้าง

---

# 2. Users & Profile (FR-UM, FR-PP)

| # | FR | Method + Path | Auth | Guard / BR | Sprint |
|---|---|---|---|---|---|
| U01 | UM-03 | `GET /me` | Auth | — | MVP |
| U02 | UM-03 | `PATCH /me` | Auth | แก้ได้เฉพาะรูป/ช่องทางติดต่อ/ที่อยู่ | MVP |
| U03 | PP-01 | `GET /users/:id` | — | โปรไฟล์สาธารณะ ซ่อนอีเมล/เบอร์ | MVP |
| U04 | PP-01 | `GET /users/:id/stats` | — | read-only จาก `player_profile_stats` | MVP |
| U05 | PP-02 | `GET /users/:id/match-history` | — | filter `?sportTypeId=` | Sprint #1 |
| U06 | TM-02 | `GET /users/search?q=` | Auth | ค้นจากชื่อ/อีเมล ใช้เชิญเข้าทีม | MVP |
| U07 | PP-03 | `GET /me/badges` | Auth | — | Sprint #2 |
| U08 | PP-03 | `PATCH /me/badges/display` | Auth | เลือก badge ที่แสดงบนโปรไฟล์ | Sprint #2 |
| U09 | UM-05 | `GET /admin/users?q=` | ADM-f | ค้นผู้ใช้ + ดูประวัติ | Sprint #1 |
| U10 | UM-05 | `POST /admin/users/:id/suspend` | ADM-f | ต้องมี reason + audit log | Sprint #1 |
| U11 | UM-05 | `POST /admin/users/:id/unsuspend` | ADM-f | audit log | Sprint #1 |

**หมายเหตุการออกแบบ**

**U03 กับ U01 คืนข้อมูลคนละชุด** ทั้งที่เป็นผู้ใช้คนเดียวกันได้ — `/me` คืนอีเมล เบอร์โทร การตั้งค่าแจ้งเตือน ส่วน `/users/:id` คืนเฉพาะข้อมูลสาธารณะ **ห้ามใช้ handler ร่วมกัน** เพราะพลาดครั้งเดียวข้อมูลส่วนตัวรั่วทั้งระบบ

**U06 ต้องจำกัดผลลัพธ์** — ค้นได้เฉพาะเมื่อพิมพ์ครบ 3 ตัวอักษรขึ้นไป และคืนไม่เกิน 20 รายการ ไม่งั้นจะกลายเป็นช่องดึงรายชื่อผู้ใช้ทั้งระบบ (NF-SE-04 การเข้าถึงข้อมูลผู้อื่นด้วยการเดารหัสอ้างอิง)

**U10 กระทบทันทีทุก session** เพราะ middleware เช็ค `is_suspended` ทุกคำขอ ตาม FR-UM-05 ที่ระบุว่าผู้ถูกระงับต้องไม่ถูกนับเป็นสมาชิกทีมที่มีสิทธิ์ลงแข่งด้วย → **ต้องคำนวณ `teams.readiness_status` ใหม่ทุกทีมที่เขาสังกัด** ในทรานแซกชันเดียวกัน ไม่ใช่แค่ตั้งธง

---

# 3. Reference Data

| # | FR | Method + Path | Auth | หมายเหตุ | Sprint |
|---|---|---|---|---|---|
| R01 | TC-01 | `GET /faculties` | — | ⚠️ multi-faculty | MVP |
| R02 | TC-01 | `GET /faculties/:id/departments` | — | ⚠️ | MVP |
| R03 | TM-01 | `GET /sport-types` | — | รวม `minMembers`/`maxMembers` | MVP |
| R04 | — | `GET /admin/scopes` | ADM-u | ⚠️ | Sprint #1 |
| R05 | — | `GET /sport-types/:id/stat-definitions` | — | 🆕 ใหม่ (รอบ 5) — ให้ frontend รู้ว่ากีฬานี้ต้องกรอกสถิติอะไรบ้าง ก่อนเรียก S06 | MVP |

ข้อมูลอ้างอิงทั้งหมด **seed ผ่าน migration ไม่ใช่ผ่าน API** จึงไม่มี POST/PATCH ในเฟสนี้ (ยกเว้น `sport_stat_definitions` ที่ query จาก R05 — ข้อมูลยัง seed ผ่าน migration เหมือนกัน แค่มี endpoint อ่านเพิ่ม)

---

# 4. Teams (FR-TM) — OF-02

| # | FR | Method + Path | Auth | Guard / BR | Transition | Sprint |
|---|---|---|---|---|---|---|
| T01 | TM-01 | `POST /teams` | Auth | ชื่อไม่ซ้ำในกีฬาเดียวกัน · BR-05 | → `Forming` | MVP |
| T02 | TR-03 | `GET /me/teams` | Auth | ใช้ตอนเลือกทีมลงสมัคร · BR-09 | — | MVP |
| T03 | — | `GET /teams/:id` | — | สาธารณะ ซ่อนข้อมูลติดต่อสมาชิก | — | MVP |
| T04 | TM-04 | `PATCH /teams/:id` | TL | ถ้าทีม approved แล้ว → บันทึกประวัติ + แจ้ง ORG | — | MVP |
| T05 | TM-05 | `DELETE /teams/:id` | TL | **ปฏิเสธถ้ากำลังแข่ง** แนะนำให้ถอนตัวแทน | → soft delete `leader_deleted` | MVP |
| T06 | TM-02 | `GET /teams/:id/members` | Auth | สมาชิกทีมเท่านั้นเห็นรายละเอียด | — | MVP |
| T07 | TM-04 | `PATCH /teams/:id/members/:uid` | TL | ตั้งตัวจริง/ตัวสำรอง | — | MVP |
| T08 | TM-04 | `DELETE /teams/:id/members/:uid` | TL | ถอดสมาชิก → คำนวณ Ready ใหม่ | อาจ `Ready → Forming` | MVP |
| T09 | TM-02 | `POST /teams/:id/invitations` | TL | ผู้ถูกเชิญยังไม่อยู่ในทีม | → `pending` | MVP |
| T10 | TM-02 | `GET /teams/:id/invitations` | TL | ดูสถานะคำเชิญทั้งหมด | — | MVP |
| T11 | TM-02 | `DELETE /teams/:id/invitations/:iid` | TL | ยกเลิกคำเชิญที่ยังไม่ตอบ | → ลบ | MVP |
| T12 | TM-03 | `GET /me/invitations` | Auth | คำเชิญที่ค้างอยู่ของฉัน | — | MVP |
| T13 | TM-03 | `POST /invitations/:id/accept` | Auth | **BR-05** + คำเชิญยังไม่หมดอายุ | → `accepted` | MVP |
| T14 | TM-03 | `POST /invitations/:id/decline` | Auth | — | → `declined` | MVP |
| T15 | TM-06 | `POST /teams/:id/official-request` | TL | แนบเอกสารประกอบ | → `pending` | MVP |
| T16 | TM-06 | `GET /admin/team-requests` | ADM-u | คิวคำร้องรออนุมัติ | — | MVP |
| T17 | TM-06 | `POST /admin/team-requests/:id/approve` | ADM-u | **BR-05** เช็คสมาชิกทุกคนไม่ติดทีม Official อื่น | → `approved` | MVP |
| T18 | TM-06 | `POST /admin/team-requests/:id/reject` | ADM-u | ต้องมี reason + รายชื่อที่ขัดเงื่อนไข | → `rejected` | MVP |
| T19 | TM-08 | `POST /teams/:id/transfer-leader` | TL | เฉพาะทีม Official · **BR-07** | → คิวรออนุมัติ | Sprint #1 |
| T20 | TM-08 | `POST /admin/team-requests/:id/approve-transfer` | ADM-u | อนุมัติแล้วจึงเปลี่ยน `leader_id` | — | Sprint #1 |
| — | TM-07 | *(ไม่มี endpoint)* | SYS | **BR-06** ไม่สมัครใน 2 สัปดาห์ / เว้น 6 เดือน · ✅ เตือนล่วงหน้า 3 วันก่อนครบ 2 สัปดาห์ และ 30+7 วันก่อนครบ 6 เดือน (ดูหมายเหตุ) | → soft delete | MVP |
| — | TM-03 | *(ไม่มี endpoint)* | SYS | สมาชิกครบตาม `sport_types.min_members` | `Forming → Ready` | MVP |

**หมายเหตุการออกแบบ**

**`Forming → Ready` ไม่มี endpoint โดยเจตนา** — เกิดอัตโนมัติภายใน T13 (รับคำเชิญ) เมื่อจำนวนสมาชิกถึง `min_members` ถ้าทำเป็น endpoint แยก หัวหน้าทีมจะกดให้ทีมพร้อมได้ทั้งที่คนไม่ครบ ซึ่งขัด BR-04 ที่บังคับลำดับ Create → Invite → Confirm → Ready

**T13 คือจุดที่ BR-05 ต้องบังคับจริง** — ผู้ใช้อยู่ทีม Unofficial ได้สูงสุด 5 ทีม และทีม Official ได้ 1 ทีม/กีฬา ต้องเช็คตอนรับคำเชิญ **และ** ตอนอนุมัติทีม Official (T17) ตามที่ BR-05 ระบุไว้ทั้งสองจุด

**T05 ต้องแยก 2 กรณีให้ชัด** ตาม FR-TM-05 — ถ้าทีมอยู่ระหว่างแข่ง ต้องตอบ 409 พร้อมข้อความแนะนำให้ใช้ `POST /applications/:id/withdraw` แทน ไม่ใช่แค่ปฏิเสธเฉยๆ

**T08 ต้องคำนวณสถานะย้อนกลับ** — ถอดสมาชิกจนเหลือน้อยกว่า `min_members` ต้องเปลี่ยน `Ready → Forming` ด้วย ไม่งั้นทีมที่คนไม่ครบจะยังสมัครแข่งได้

**✅ TM-07 แจ้งเตือนล่วงหน้า — ตัดสินใจแล้ว (เดิมข้อ 12.4):** scheduled job เตือน 2 กรณีแยกกัน — (1) ทีมที่ยังไม่สมัครทัวร์ใดเลย เตือนก่อนครบ 2 สัปดาห์ **3 วัน** (2) ทีมที่เว้นว่างนาน เตือนก่อนครบ 6 เดือน **2 ครั้ง** คือที่ 30 วันและ 7 วันก่อนกำหนด ตัวเลขเหล่านี้เป็นค่าประมาณ ยังไม่ยืนยันกับอาจารย์ที่ปรึกษา ควรเก็บเป็น config (เช่น `TEAM_EXPIRY_WARNING_DAYS`) ไม่ hardcode เพื่อปรับได้ภายหลังโดยไม่ต้อง deploy ใหม่

---

# 5. Tournaments (FR-TC, FR-OM) — OF-01

| # | FR | Method + Path | Auth | Guard / BR | Transition | Sprint |
|---|---|---|---|---|---|---|
| C01 | TC-01 | `POST /tournaments` | Auth | **BR-01** ตรวจช่วงวันสมเหตุสมผล | → `pending_approval` | MVP |
| C02 | TC-01 | `GET /me/tournament-requests` | Auth | คำขอของฉัน + สถานะ | — | MVP |
| C03 | TC-02 | `GET /admin/tournament-requests` | ADM-f | คิวรอพิจารณา | — | MVP |
| C04 | TC-02/03 | `POST /tournaments/:id/approve` | ADM-f | **BR-01, BR-02** | `pending_approval → private` | MVP |
| C05 | TC-02 | `POST /tournaments/:id/reject` | ADM-f | ต้องมี reason | `pending_approval → rejected` | MVP |
| C06 | TR-01 | `GET /tournaments` | — | **บังคับ `status='public'`** ที่ service | — | MVP |
| C07 | TR-02 | `GET /tournaments/:id` | — | private เห็นได้เฉพาะ ORG/ADM | — | MVP |
| C08 | OM-01 | `PATCH /tournaments/:id` | ORG | เฉพาะข้อมูลทั่วไป | — | MVP |
| C09 | OM-01 | `POST /tournaments/:id/amendment-requests` | ORG | ข้อมูลสำคัญ (วันแข่ง/จำนวนทีม/เกณฑ์) | → `pending` | MVP |
| C10 | OM-01 | `GET /admin/amendment-requests` | ADM-f | — | — | MVP |
| C11 | OM-01 | `POST /amendment-requests/:id/approve` | ADM-f | apply การแก้ไขจริงตอนอนุมัติ | → `approved` | MVP |
| C12 | OM-01 | `POST /amendment-requests/:id/reject` | ADM-f | ต้องมี reason | → `rejected` | MVP |
| C13 | OM-02 | `POST /tournaments/:id/publish` | ORG | **BR-10** กรรมการครบ + ข้อมูลครบ | `private → public` | MVP |
| C14 | OM-02 | `POST /tournaments/:id/unpublish` | ORG | — | `public → private` | MVP |
| C15 | OM-03 | `POST /tournaments/:id/open-registration` | ORG | — | `registrationOpen = true` | MVP |
| C16 | OM-03 | `POST /tournaments/:id/close-registration` | ORG | คำขอที่ค้างยังพิจารณาได้ | `registrationOpen = false` | MVP |
| C17 | TC-01 | `GET /tournaments/:id/eligibility-rules` | — | เงื่อนไขคุณสมบัติ | — | MVP |
| C18 | TC-05 | `GET /admin/tournaments/archived` | ADM-f | ข้อมูลย้อนหลังก่อนถึงกำหนดลบ | — | Sprint #2 |
| — | TC-04 | *(ไม่มี endpoint)* | SYS | **BR-03** ถึงวันแข่งแต่ยัง private | → `auto_deleted` | MVP |
| — | TC-05 | *(ไม่มี endpoint)* | SYS | **BR-03** ครบ 4 ปีหลังจบ | → ลบข้อมูล | Sprint #2 |
| — | — | *(ไม่มี endpoint)* | SYS | แมตช์สุดท้าย verified | → `completed` | MVP |

**หมายเหตุการออกแบบ**

**C01 ไม่ได้สร้างทัวร์นาเมนต์** แต่สร้างคำขอ — ดีไซน์ของคุณเก็บทั้งสองอย่างในตาราง `tournaments` เดียวกันโดยใช้ `status` แยก ซึ่งตรงกับ BR-01 ที่ห้ามมีเส้นทางสร้างทัวร์นาเมนต์ที่ข้ามการอนุมัติ **ห้ามมี endpoint ใดที่สร้างแถวด้วย `status` อื่นนอกจาก `pending_approval`**

**C08 กับ C09 แยกกันตาม FR-OM-01** — ข้อมูลทั่วไป (คำอธิบาย ช่องทางติดต่อ) แก้ได้ทันที ส่วนข้อมูลที่กระทบเงื่อนไขการสมัคร (วันแข่งขัน จำนวนทีม เกณฑ์คุณสมบัติ) ต้องผ่าน Admin **รายชื่อฟิลด์ที่จัดเป็น "สำคัญ" ต้อง hardcode เป็น allowlist ที่ backend** ไม่ใช่ให้ client บอก

**C11 ต้อง apply การแก้ไขจริงตอนอนุมัติ** ไม่ใช่แค่เปลี่ยนสถานะคำขอ — ต้อง `UPDATE tournaments` ด้วยค่าที่ขอไว้ในทรานแซกชันเดียวกัน

**C13 คือ guard ที่สำคัญที่สุดในกลุ่มนี้** — BR-10 บังคับว่าต้องมีกรรมการที่ **ตอบรับแล้ว** (`invitation_status='accepted'`) ไม่ใช่แค่ถูกเชิญ ถ้าเป็นการแข่ง on-site ที่บันทึกสถิติ ต้องครบ 2 คนตาม BR-11 ด้วย

**C06 กับ C07 ต้องระวังต่างกัน** — C06 บังคับ `status='public'` เสมอ (ห้ามให้ client ส่ง `?status=private`) ส่วน C07 เข้าถึงด้วย id ตรงๆ ต้องเช็คว่าถ้า private ผู้เรียกต้องเป็น ORG หรือ ADM เท่านั้น

---

# 6. Referees (FR-RM, FR-OM-05)

> **✅ อัปเดต 2 ส.ค. 2569:** กลุ่มนี้แก้ตามผลตัดสินใจข้อ 12.1 — แยก `tournament_referees` (แต่งตั้งระดับทัวร์ + สถานะตอบรับ) กับ `match_referees` (มอบหมายรายแมตช์) ออกจากกัน ดู `LTMS_Database_Design.md` changelog 2 ส.ค. รอบที่ 3

| # | FR | Method + Path | Auth | Guard / BR | Transition | Sprint |
|---|---|---|---|---|---|---|
| F01 | OM-05 | `POST /tournaments/:id/referees` | ORG | เชิญผู้ใช้เป็นกรรมการของทัวร์นี้ · เชิญซ้ำได้ไม่จำกัดครั้ง (ไม่มี UNIQUE แล้ว — ★ รอบ 5) | → `pending` ใน `tournament_referees` (แถวใหม่ทุกครั้ง) | MVP |
| F02 | OM-05 | `GET /tournaments/:id/referees` | ORG | ดูสถานะตอบรับ + จำนวนที่ `accepted` (เช็ค BR-10) | — | MVP |
| F03 | OM-05 | `DELETE /tournaments/:id/referees/:rid` | ORG | ถอดกรรมการ → soft delete (`removed_at`/`removed_by`) ไม่ลบจริง → เช็ค BR-10 ใหม่ | → `removed_at` ตั้งค่า (★ รอบ 5) | MVP |
| F04 | RM-01 | `GET /me/referee-invitations` | Auth | คำเชิญระดับทัวร์ที่รอฉันตอบ | — | MVP |
| F05 | RM-01 | `POST /referee-invitations/:id/accept` | Auth | ถ้า external ต้องรอ ADM ก่อนได้สิทธิ์ · **ตอบรับครั้งเดียว ใช้ได้ทุกแมตช์ที่ถูกมอบหมายภายหลัง** | → `accepted` ใน `tournament_referees` | MVP |
| F06 | RM-01 | `POST /referee-invitations/:id/decline` | Auth | — | → `declined` | MVP |
| F07 | RM-02 | `POST /tournaments/:id/referees/:rid/request-approval` | ORG | เฉพาะ `is_external=true` + แนบเอกสาร | → `pending` | Sprint #1 |
| F08 | RM-02 | `GET /admin/referee-approvals` | ADM-f | คิวกรรมการภายนอก | — | Sprint #1 |
| F09 | RM-02 | `POST /admin/referee-approvals/:id/approve` | ADM-f | **CO-06** | → `approved` | Sprint #1 |
| F10 | RM-02 | `POST /admin/referee-approvals/:id/reject` | ADM-f | ต้องมี reason | → `rejected` | Sprint #1 |
| F11 | — | `POST /matches/:id/referees` | ORG | **ต้องมีแถวใน `tournament_referees` ที่ `invitation_status='accepted'` อยู่ก่อน** · UNIQUE (match_id, tournament_referee_id) | → INSERT `match_referees` | MVP |
| F12 | — | `GET /matches/:id/referees` | — | รายชื่อกรรมการที่คุมแมตช์นี้ | — | MVP |
| F13 | — | `DELETE /matches/:id/referees/:rid` | ORG | ถอดกรรมการออกจากแมตช์นี้เท่านั้น ไม่กระทบการแต่งตั้งระดับทัวร์ | → ลบ `match_referees` | MVP |

**หมายเหตุการออกแบบ**

**F05 ยังไม่ให้สิทธิ์ทันทีถ้าเป็นคนนอก** — ตาม FR-RM-02 และ CO-06 กรรมการภายนอกต้องผ่าน **2 ด่าน** คือตอบรับคำเชิญ **และ** Admin อนุมัติ middleware `requireReferee` จึงต้องเช็คทั้ง `invitation_status='accepted'` และ (ถ้า `is_external`) `external_approval_status='approved'` ทั้งสองฟิลด์นี้อยู่ใน `tournament_referees` เท่านั้น — query ต้อง join ผ่าน `match_referees` เสมอเมื่อจะเช็คสิทธิ์ระดับแมตช์:

```sql
SELECT tr.* FROM tournament_referees tr
JOIN match_referees mr ON mr.tournament_referee_id = tr.id
WHERE mr.match_id = ? AND tr.user_id = ? AND tr.invitation_status = 'accepted'
```

**F01 กับ F11 มีลำดับบังคับ** — ตาม FR-OM-05/FR-RM-01 การ "ตอบรับ" เกิดครั้งเดียวตอนเข้าร่วมทัวร์ ไม่ใช่ตอบรับซ้ำทุกแมตช์ที่มอบหมาย ดังนั้น F11 (มอบหมายเข้าแมตช์) ต้องปฏิเสธด้วย 409 ถ้ายังไม่มีแถวใน `tournament_referees` ที่ `accepted` มาก่อน — เขียนสลับลำดับไม่ได้ **★ ตั้งแต่รอบ 5:** เพราะเชิญซ้ำได้ไม่จำกัดครั้งแล้ว (ไม่มี `UNIQUE` คุม) middleware ตรวจสิทธิ์ทุกจุดต้องดึง**แถวล่าสุดเท่านั้น** (`ORDER BY created_at DESC LIMIT 1`) ไม่ใช่ query ตรงๆ เหมือนเดิม ไม่งั้นอาจอ่านแถวเก่าที่ `rejected` ปนกับแถวใหม่ที่ `accepted`

**F03 เปลี่ยนเป็น soft delete ตั้งแต่รอบ 5** — ไม่ `DELETE` จริงอีกต่อไป เพราะจะไม่เหลือร่องรอยว่าเคยมีกรรมการคนนี้อยู่ (ตรวจสอบย้อนหลังไม่ได้ถ้ามีข้อพิพาท) เปลี่ยนเป็น `UPDATE tournament_referees SET removed_at = NOW(), removed_by = ? WHERE tournament_referee_id = ?` แทน — **`match_referees` ที่ผูกอยู่ไม่ต้องลบตาม** เพราะ middleware ตรวจสิทธิ์จะเช็ค `tournament_referees.removed_at IS NULL` เสมออยู่แล้ว ถ้าถูกถอดไปแล้วจะเช็คไม่ผ่านเองโดยอัตโนมัติ ยังต้องเช็คย้อนกลับว่าถอดแล้วยังครบ BR-10 อยู่ไหม — ถอดจนเหลือไม่ครบขณะทัวร์เป็น `public` **ข้อเสนอ: ปฏิเสธด้วย 409** ให้ ORG unpublish เองก่อน จะได้ไม่เกิดผลข้างเคียงที่ผู้ใช้ไม่ได้สั่ง

**F13 ต่างจาก F03** — ถอดออกจากแมตช์เดียว ไม่กระทบสถานะตอบรับระดับทัวร์ กรรมการยังเป็นกรรมการของทัวร์นี้อยู่ แค่ไม่ได้คุมแมตช์นั้นแล้ว

**BR-11 (on-site ต้องมีกรรมการ ≥2 คน) ต้องนับจาก `match_referees`** ไม่ใช่ `tournament_referees` — นับจำนวนกรรมการที่ถูกมอบหมายเข้าแมตช์นั้นโดยเฉพาะ ต่างจาก BR-10 ที่นับจากทั้งทัวร์

---

# 7. Applications (FR-TR, FR-PV, FR-OM-04) — OF-02

| # | FR | Method + Path | Auth | Guard / BR | Transition | Sprint |
|---|---|---|---|---|---|---|
| P01 | TR-03 | `POST /tournaments/:id/applications` | TL | **BR-04, BR-08, BR-09** + อยู่ในช่วงรับสมัคร + ไม่เคยสมัคร | → `pending` | MVP |
| P02 | TR-05 | `GET /me/applications` | Auth | สถานะแบบเรียลไทม์ + เหตุผลถ้าถูกปฏิเสธ | — | MVP |
| P03 | OM-04 | `GET /tournaments/:id/applications` | ORG | พร้อมผล Hard Filter รายบุคคล | — | MVP |
| P04 | PV-02 | `GET /applications/:id` | ORG/TL | เอกสาร Soft Filter — **จำกัดเฉพาะรูปบัตรนิสิต/บัตรประชาชน** | — | MVP |
| P05 | OM-04 | `POST /applications/:id/approve` | ORG | Soft Filter ผ่านดุลพินิจ | `pending → approved` | MVP |
| P06 | OM-04 | `POST /applications/:id/reject` | ORG | ต้องมี reason ส่งถึง TL | `pending → rejected` | MVP |
| P07 | TR-04 | `POST /applications/:id/cancel` | TL | ต้องยังเป็น `pending` | `pending → cancelled` | MVP |
| P08 | TR-04 | `POST /applications/:id/withdraw` | TL | คืนช่องว่าง + แจ้ง ORG + เตือนจัดสายใหม่ | `approved → withdrawn` | MVP |
| P09 | TR-02 | `GET /tournaments/:id/teams` | — | รายชื่อทีมที่อนุมัติแล้ว (สาธารณะ) | — | MVP |

**หมายเหตุการออกแบบ**

**P01 รัน Hard Filter ทันทีในคำขอเดียวกัน** — ตาม FR-PV-01 ระบบตรวจเพศ อายุ ชั้นปี คณะ ของสมาชิกทุกคนอัตโนมัติ **ถ้าไม่ผ่านต้องตอบ 422 พร้อมรายชื่อและเหตุผลรายบุคคล** ไม่ใช่แค่บอกว่า "ไม่ผ่าน" เพราะ BR-08 บังคับให้แยกผลสองชั้นให้ชัด ผู้สมัครต้องรู้ว่าถูกปฏิเสธด้วยเหตุใด

**P07 ต้องใช้ค่า `cancelled` ที่เพิ่งเพิ่มเข้า DDL** (changelog 2 ส.ค.) ถ้ายังไม่ได้รัน ALTER endpoint นี้จะพัง

**P08 มีผลข้างเคียงที่ P07 ไม่มี** — ตาม FR-TR-04 ต้องคืนช่องว่าง แจ้ง Organizer และถ้าสร้าง Bracket แล้วต้องแจ้งว่าจำเป็นต้องจัดสายใหม่ **ต้องเช็คว่ามี bracket หรือยัง** แล้วส่งข้อมูลนี้กลับใน response ให้หน้าเว็บแสดงคำเตือนได้

**P03 ต้องคืนผล Hard Filter ที่เก็บไว้ ไม่ใช่คำนวณใหม่** — `tournament_applications.hard_filter_details` เก็บผลตอนสมัครไว้แล้ว ถ้าคำนวณใหม่ตอน Organizer เปิดดู ผลอาจเปลี่ยน (สมาชิกอาจถูกถอดไปแล้ว) ทำให้เห็นข้อมูลไม่ตรงกับตอนสมัคร

---

# 8. Brackets & Matches (FR-MM) — OF-03

| # | FR | Method + Path | Auth | Guard / BR | Transition | Sprint |
|---|---|---|---|---|---|---|
| M01 | MM-01 | `POST /tournaments/:id/bracket` | ORG | จำนวนทีมพอ + สอดคล้องกับรูปแบบ | สร้าง `matches` หลายแถว + สร้าง `bracket_nodes` (★ รอบ 5 — ยกเว้น Round Robin ไม่สร้าง node เลย) | MVP |
| M02 | MM-01 | `GET /tournaments/:id/bracket` | — | SELECT จาก `bracket_nodes` (★ รอบ 5 — เดิมอ่านจาก MongoDB) | — | MVP |
| M03 | MM-01 | `PATCH /tournaments/:id/bracket` | ORG | จัดสายใหม่ — ปฏิเสธถ้ามีแมตช์เริ่มแล้ว → UPDATE `bracket_nodes` | — | Sprint #1 |
| M04 | MM-03 | `GET /tournaments/:id/matches` | — | filter `?teamId=&status=&round=` | — | MVP |
| M05 | MM-03 | `GET /matches/:id` | — | รวมสถานที่ (FR-MM-05) | — | MVP |
| M06 | MM-02 | `PATCH /matches/:id/schedule` | ORG | **ตรวจทับซ้อนทีม/สนาม/เวลา** | — | MVP |
| M07 | OM-07 | `PATCH /matches/:id/venue` | ORG | ตรวจทับซ้อนสนาม + แจ้งผู้เกี่ยวข้อง | — | Sprint #1 |
| M08 | OM-07 | `PATCH /matches/:id/mode` | ORG | ห้ามแก้หลัง `checkin_open_at` หรือ status ≠ `scheduled` | — | Sprint #1 |
| M09 | MM-04 | `POST /matches/:id/open-checkin` | ORG | — | `scheduled → checkin_open` | MVP |
| M10 | — | `POST /matches/:id/start` | REF | ต้องมีผู้เช็คอินขั้นต่ำ | `checkin_open → in_progress` | MVP |
| M11 | PV-03 | `GET /matches/:id/checkin-qr` | ORG/REF | QR สำหรับ on-site | — | MVP |
| M12 | PV-03/04 | `POST /matches/:id/checkins` | Auth | ต้องอยู่ในทีมที่อนุมัติของแมตช์นี้ · idempotent | → `checked_in` | MVP |
| M13 | MM-04 | `GET /matches/:id/checkins` | REF/ORG | รายชื่อผู้เช็คอิน | — | MVP |
| M14 | PV-04 | `POST /matches/:id/checkins/:cid/verify` | REF | ตรวจภาพคู่บัตร (online) | → `verified` | MVP |
| M15 | PV-04 | `POST /matches/:id/checkins/:cid/reject` | REF | ต้องมี reason | → `rejected` | MVP |
| M16 | — | `POST /uploads/presign` | Auth | สำหรับภาพเช็คอิน/เอกสาร | — | MVP |
| — | — | *(ไม่มี endpoint)* | SYS | ผล verified | `in_progress → completed` | MVP |
| — | — | *(ไม่มี endpoint)* | SYS | sync จาก `match_results` | `→ disputed` | MVP |

**หมายเหตุการออกแบบ**

**M01 เป็น endpoint ที่หนักที่สุดในระบบ** — ★ ตั้งแต่รอบ 5 (ยุบ MongoDB) สร้างแถว `bracket_nodes` + `matches` หลายสิบแถวพร้อม `next_match_id`/`loser_next_match_id` ที่เชื่อมกันถูกต้อง **ทั้งหมดอยู่ในทรานแซกชัน MySQL เดียวกัน** ไม่ต้อง sync ข้าม 2 ฐานข้อมูลอีกต่อไป (เดิมต้องสร้าง MySQL ก่อน commit แล้วค่อย sync ไป MongoDB — ปัญหานี้หมดไปแล้ว)

รองรับ 3 รูปแบบตาม FR-MM-01 — Single Elimination, Double Elimination, Round Robin และเลือกได้ระหว่างสุ่มอัตโนมัติกับกำหนดคู่เอง ตาม NF-MA-02 อัลกอริทึมนี้ต้องแยกเป็นโมดูลอิสระที่ทดสอบได้เอง

**✅ Round Robin กับ `next_match_id` — ตัดสินใจแล้ว (เดิมข้อ 12.3):** ถ้า `tournaments.bracket_format = 'round_robin'` ให้ตั้ง `next_match_id = NULL` ทุกแถวตอนสร้าง (ใช้ค่า NULL เดิม ไม่เพิ่มคอลัมน์ใหม่) เพราะไม่มีแนวคิด "เข้ารอบถัดไป" ผลตัดสินทั้งทัวร์มาจาก `tournament_standings` ล้วนๆ — **ไม่สร้างแถวใน `bracket_nodes` เลยด้วย** (ตารางนี้มีไว้สำหรับ Elimination เท่านั้น) ในทรานแซกชัน S02 (verify) ขั้นที่ 3 ต้องเช็ค `IF next_match_id IS NULL THEN SKIP` ก่อนพยายามเลื่อนผู้ชนะ ไม่งั้นจะพยายามเขียนทับแมตช์ที่ไม่เกี่ยวข้อง

**M02 — ★ ตั้งแต่รอบ 5:** อ่านจากตาราง `bracket_nodes` โดยตรง (`SELECT * FROM bracket_nodes WHERE tournament_id = ?`) แล้ว backend ประกอบเป็นโครงต้นไม้ก่อนส่งให้ frontend (ใช้ `round` + `match_number` จัดคอลัมน์) — schema ที่แน่นอนยังต้องตัดสินใจตอนแก้ Part 3 (flat array vs ประกอบต้นไม้ก่อนส่ง)

**M03 อันตรายที่สุด** — จัดสายใหม่หลังเริ่มแข่งจะทำให้ผลที่บันทึกไปแล้วกำพร้า **ต้องปฏิเสธถ้ามีแมตช์ใดสถานะเกิน `scheduled`** — ★ ตั้งแต่รอบ 5: UPDATE ตาราง `bracket_nodes` ในทรานแซกชันเดียวกับที่แก้ `matches`

**M06 ต้องตรวจ 2 แบบ** ตาม FR-MM-02 — ทีมเดียวกันห้ามมีนัดเวลาทับซ้อน และสนามเดียวกันห้ามถูกใช้ซ้อนเวลา ตรวจก่อนบันทึกเสมอ

**M12 ต้อง idempotent** — UNIQUE `(match_id, user_id)` กันซ้ำที่ DB แต่ backend ต้องตอบ **200 พร้อมข้อมูลเดิม ไม่ใช่ 409** เพราะสถานการณ์หน้าสนามที่สัญญาณไม่ดี (AS-02) ทำให้กดซ้ำเป็นเรื่องปกติ

**M12 แยก 2 flow ตาม `matches.mode`** — on-site สแกน QR (FR-PV-03) ตรวจว่า QR ตรงกับแมตช์นี้ / online อัปโหลดภาพคู่บัตรแล้วรอกรรมการตรวจ (FR-PV-04) → ต้องผ่าน M14/M15

**ภาพจาก M12 อยู่ใต้ NF-SE-03 และ CO-07 (PDPA)** — เข้าถึงได้เฉพาะกรรมการของแมตช์นั้นและ Admin และต้องลบเมื่อจบการแข่งขัน → ต้องมี scheduled job ลบ object ใน S3 ไม่ใช่แค่ลบแถวใน DB

---

# 9. Match Results (FR-RS) — OF-03

| # | FR | Method + Path | Auth | Guard / BR | Transition | Sprint |
|---|---|---|---|---|---|---|
| S01 | RS-01 | `POST /matches/:id/result` | TL หรือ REF ตาม **BR-13** | **BR-11** ถ้า on-site + บันทึกสถิติ ต้องมี REF ≥ 2 | → `submitted` | MVP |
| S02 | RS-02/03 | `POST /matches/:id/result/verify` | อีกฝ่ายตาม **BR-13** | **BR-12** ผู้ยืนยันต้องไม่ใช่ผู้ส่ง | `submitted → verified` | MVP |
| S03 | RS-04 | `POST /matches/:id/result/dispute` | TL / REF | **BR-14** ภายใน `dispute_window_hours` · active ได้ครั้งละ 1 | `submitted → disputed` | MVP |
| S04 | RS-04 | `POST /matches/:id/result/resolve` | ORG | ต้องระบุคำตัดสิน | `disputed → verified \| rejected` | MVP |
| S05 | RS-01 | `GET /matches/:id/result` | — | สาธารณะเมื่อ verified | — | MVP |
| S06 | RS-01 | `POST /matches/:id/stats` | REF | **BR-11** | — | MVP |
| S07 | RS-01 | `GET /matches/:id/stats` | — | — | — | MVP |
| S08 | RS-07 | `PATCH /matches/:id/result` | REF / ORG | ✅ ดูหมายเหตุ (409 ถ้าผู้ชนะเปลี่ยน+รอบถัดไปเริ่มแล้ว) · `amendReason` บังคับ | `verified → verified` + ตั้ง `amended_at` | Sprint #1 |
| S09 | RS-07 | `GET /tournaments/:id/report` | ORG / REF | export ไฟล์รายงาน | — | Sprint #1 |
| S10 | RS-06 | `GET /tournaments/:id/winner` | — | ผู้ชนะ + สรุปสถิติ | — | MVP |
| S11 | DL-01 | `GET /tournaments/:id/dashboard` | — | จำนวนผู้เล่น/ทีม/แมตช์ + ภาพรวม | — | MVP |
| S12 | DL-02 | `GET /tournaments/:id/standings` | — | **read-only** ระบบคำนวณ | — | MVP |
| — | RS-05 | *(ไม่มี endpoint)* | SYS | คำนวณผู้เข้ารอบ + อัปเดตทุกอย่าง | เกิดใน S02 | MVP |

**หมายเหตุการออกแบบ**

**S01 กับ S02 สลับผู้เรียกตาม `matches.mode`** — นี่คือจุดที่ BR-13 บังคับ

| mode | ผู้ส่ง (S01) | ผู้ยืนยัน (S02) | FR |
|---|---|---|---|
| `online` | หัวหน้าทีมที่ชนะ | Referee | FR-RS-02 |
| `onsite` | Referee | หัวหน้าทีมที่ชนะ | FR-RS-03 |

**ต้องอ่าน `matches.mode` แล้วเลือก middleware ตอน runtime** ไม่ใช่ hardcode — และ **ห้ามให้คนเดียวทำทั้งสองขั้น** ตาม BR-12 ที่บังคับว่าผลต้องผ่านการยืนยันจากสองฝ่าย

**S02 คือ transaction ที่สำคัญที่สุดของระบบ** — ทำ 9 อย่างในทรานแซกชันเดียว (ดู Part 0–1 หัวข้อ 1.15) ต้อง `SELECT ... FOR UPDATE` ที่ `match_results` ตั้งแต่ต้นเพื่อกันกรรมการ 2 คนกดพร้อมกัน

**S03 ต้อง sync 2 ตาราง** — `match_results.status='disputed'` **และ** `matches.status='disputed'` ในทรานแซกชันเดียวกันเสมอ (`match_results` เป็น source of truth) และ BR-14 ระบุว่ามี dispute active ได้ครั้งละ 1 เท่านั้น

**✅ S08 ขอบเขตการแก้ย้อนหลัง — ตัดสินใจแล้ว (เดิมข้อ 12.2):** ก่อน `UPDATE` ต้องเช็คก่อนว่าการแก้ครั้งนี้จะทำให้ `winner_team_id` เปลี่ยนไหม ถ้าเปลี่ยน **และ** แมตช์ที่ `next_match_id`/`loser_next_match_id` ชี้ไปมีสถานะเกิน `'scheduled'` แล้ว → ตอบ 409 ทันที ไม่ต้องเริ่มทรานแซกชัน พร้อมข้อความ "แก้ผู้ชนะไม่ได้ เพราะแมตช์รอบถัดไปเริ่มไปแล้ว กรุณาติดต่อผู้จัดการแข่งขัน" — การแก้ที่ไม่กระทบผู้ชนะ (คะแนน สถิติผู้เล่น) ทำได้เสมอไม่ว่ารอบถัดไปจะเริ่มไปแล้วหรือยัง ⚠️ ยังต้องผ่าน Change Management (SRS 3.6) ก่อนใช้งานจริง เพราะเป็นกฎธุรกิจใหม่ที่ SRS ยังไม่ระบุไว้

**S12 ไม่มี write endpoint โดยเจตนา** — FR-DL-02 ระบุว่าอันดับอัปเดตอัตโนมัติทันทีที่มีการยืนยันผล ถ้าเปิดให้แก้ด้วยมือ อันดับจะไม่ตรงกับผลจริงและตรวจสอบย้อนกลับไม่ได้

---

# 10. Engagement (FR-FN, FR-AN, FR-CM, FR-VW, FR-LS, FR-PK)

| # | FR | Method + Path | Auth | Guard / BR | Sprint |
|---|---|---|---|---|---|
| E01 | FN-01 | `POST /users/:id/follow` | Auth | idempotent | Sprint #1 |
| E02 | FN-01 | `DELETE /users/:id/follow` | Auth | 204 | Sprint #1 |
| E03 | FN-01 | `GET /me/following` | Auth | — | Sprint #1 |
| E04 | FN-03 | `GET /me/notifications` | Auth | `?isRead=&type=` | Sprint #1 |
| E05 | FN-03 | `POST /me/notifications/:id/read` | Auth | idempotent | Sprint #1 |
| E06 | FN-03 | `POST /me/notifications/read-all` | Auth | — | Sprint #1 |
| E07 | FN-03 | `PATCH /me/notification-prefs` | Auth | เปิด/ปิดรายประเภท | Sprint #1 |
| E08 | AN-01 | `POST /tournaments/:id/announcements` | ORG | แจ้งเตือนผู้เกี่ยวข้อง | MVP |
| E09 | AN-01 | `GET /tournaments/:id/announcements` | — | — | MVP |
| E10 | AN-01 | `PATCH /announcements/:id` | ORG | — | MVP |
| E11 | AN-01 | `DELETE /announcements/:id` | ORG | soft delete | MVP |
| E12 | LS-01 | `PUT /matches/:id/livestream` | ORG | validate YouTube URL | MVP |
| E13 | CM-01 | `POST /tournaments/:id/comments` | Auth | rate limit 10/นาที | Sprint #1 |
| E14 | CM-01 | `GET /tournaments/:id/comments` | — | ซ่อน `is_removed` | Sprint #1 |
| E15 | CM-01 | `POST /comments/:id/report` | Auth | idempotent | Sprint #1 |
| E16 | CM-01 | `GET /admin/reported-comments` | ADM-f | — | Sprint #1 |
| E17 | CM-01 | `POST /admin/comments/:id/remove` | ADM-f | ตั้ง `is_removed` | Sprint #1 |
| E18 | CM-02 | `POST /tournaments/:id/organizer-feedback` | Auth | 1 คน/ทัวร์ | Sprint #1 |
| E19 | CM-02 | `GET /tournaments/:id/organizer-feedback` | ORG | — | Sprint #1 |
| E20 | CM-03 | `POST /tournaments/:id/mvp-votes` | Auth | **ผู้ลงแข่งโหวตไม่ได้** · 1 ครั้ง/รายการ · หลังจบรอบชิง | Sprint #1 |
| E21 | CM-03 | `POST /matches/:id/mvp-votes` | Auth | ผู้ลงแข่งแมตช์นั้นโหวตไม่ได้ · ปิดหลัง `dispute_window_hours` | Sprint #1 |
| E22 | CM-03 | `GET /tournaments/:id/mvp-results` | — | แสดงเมื่อปิดรอบแล้วเท่านั้น | Sprint #1 |
| E23 | OM-08 | `POST /tournaments/:id/questions` | Auth | — | Sprint #1 |
| E24 | OM-08 | `GET /tournaments/:id/questions` | — | — | Sprint #1 |
| E25 | OM-08 | `POST /questions/:id/answer` | ORG / REF | ตอบรอบเดียว ไม่ใช่ thread | Sprint #1 |
| E26 | PK-01 | `POST /matches/:id/prediction` | Auth | **ปฏิเสธถ้าเลยเวลาเริ่มแข่ง** · idempotent | Sprint #1 |
| E27 | PK-01 | `GET /me/predictions` | Auth | — | Sprint #1 |
| E28 | PK-01 | `GET /tournaments/:id/pickem-leaderboard` | — | — | Sprint #1 |
| E29 | PK-01 | `GET /me/points` | Auth | ยอดรวม | Sprint #1 |
| E30 | PK-01 | `GET /me/points/transactions` | Auth | **read-only** ledger | Sprint #1 |
| E31 | PK-01 | `GET /rewards` | Auth | รายการ badge ที่แลกได้ · บังคับ `is_active=true` เสมอสำหรับ user ทั่วไป (★ รอบ 5) | Sprint #2 |
| E32 | PK-01 | `POST /rewards/:id/redeem` | Auth | **BR-15** แต้มพอ · ห้ามเชื่อมระบบชำระเงิน | Sprint #2 |
| E33 | — | `GET /admin/audit-logs` | ADM-f | **read-only** NF-SE-05 | Sprint #1 |
| E34 | — | `POST /admin/rewards` | ADM-u | สร้างรางวัลใหม่ (★ ใหม่ รอบ 5 — เดิมไม่มี endpoint นี้เลย) | Sprint #2 |
| E35 | — | `PATCH /admin/rewards/:id` | ADM-u | แก้ไขรางวัล (★ ใหม่ รอบ 5) | Sprint #2 |
| E36 | — | `DELETE /admin/rewards/:id` | ADM-u | **ทาง A:** ปิดใช้งาน (`is_active=false`) ไม่ใช่ลบจริง · ต้องเช็คก่อนว่ามี `user_rewards` อ้างอิงอยู่ไหม (★ ใหม่ รอบ 5) | Sprint #2 |

**หมายเหตุการออกแบบ**

**E20/E21 ต้องเช็คซ้ำที่โค้ดเสมอ** ถึงแม้จะแก้ UNIQUE key เป็น `match_key` แล้ว (changelog 2 ส.ค.) เพราะต้องตอบ 409 พร้อมข้อความภาษาไทยตาม NF-US-03 ไม่ใช่ปล่อย SQL error ออกไป

**E20 มีเงื่อนไขที่ระบบต้องเช็คเอง** — FR-CM-03 ระบุว่าผู้ที่ลงแข่งในทัวร์นาเมนต์นั้นโหวตไม่ได้ ต้องเช็คจาก `player_match_stats` / `match_checkins` ที่ application layer เพราะ DB constraint ทำ subquery ข้ามตารางไม่ได้

**E26 ต้องเช็คเวลาแบบเข้มงวด** — FR-PK-01 ระบุว่าทายผลหลังเวลาเริ่มแข่งต้องถูกปฏิเสธ **เทียบกับ `matches.scheduled_time` ไม่ใช่ `status`** เพราะแมตช์อาจยังไม่ถูกเปลี่ยนสถานะทั้งที่เลยเวลาแล้ว

**E30 ไม่มี POST โดยเจตนา** — แต้มเกิดจากระบบคำนวณตอนผลถูกยืนยันเท่านั้น ถ้ามี endpoint สร้างรายการแต้ม = เปิดช่องให้แจกแต้มตัวเอง

**★ E34-E36 (ใหม่ทั้งชุด รอบ 5) — ทำไมต้องเพิ่ม:** ตรวจพบตอนทำ Database Design ว่า `rewards` เป็นตารางที่ผู้ใช้ query ได้ (E31) และแลกได้ (E32) แต่**ไม่มีทางสร้างข้อมูลเข้าไปเลยผ่าน API** ถ้าไม่เพิ่ม endpoint นี้ ตาราง `rewards` จะว่างเปล่าตลอดไป

**E36 ใช้ `is_active` แทนการลบจริง (ทาง A)** — เหตุผลคือถ้าลบแถวจริงทั้งที่มีคนแลกไปแล้ว `user_rewards.reward_id` จะกลายเป็น FK ที่ชี้ไปหาแถวที่ไม่มีอยู่จริง ประวัติการแลกรางวัลของผู้ใช้จะพัง — ต้องเช็คก่อนเสมอว่ามี `user_rewards` อ้างอิงอยู่ไหม (ไม่ใช่แค่ตั้ง `is_active=false` เฉยๆ โดยไม่เช็ค เพราะถ้าไม่มีใครใช้เลย Admin ควรลบทิ้งได้จริงถ้าต้องการ — แต่ในเฟสนี้ยึดนโยบายเดียวคือ**ปิดใช้งานเสมอ ไม่ลบจริงเด็ดขาด**เพื่อความปลอดภัยสูงสุด)

**E31 ต้องกรองด้วย `is_active=true` เสมอสำหรับผู้ใช้ทั่วไป** — Admin เท่านั้นที่เห็นรางวัลที่ปิดใช้งานแล้ว (ผ่าน endpoint แยกถ้าจำเป็น ยังไม่ได้ออกแบบไว้ในเฟสนี้)

**E12 ใช้ `PUT` ตัวเดียวในทั้งระบบ** — เพราะเป็นการตั้งค่าลิงก์เดียวที่เขียนทับได้ทั้งก้อน มีหรือไม่มีก็ตั้งค่าเหมือนกัน ไม่ใช่การแก้บางส่วน

---

# 11. สรุปตามเส้นทางหลัก

## OF-01 ขอจัดตั้งทัวร์นาเมนต์ (UC-01)
```
C01 สร้างคำขอ → C03 Admin ดูคิว → C04 อนุมัติ
  → F01 เชิญกรรมการ → F05 กรรมการตอบรับ
  → C13 เปิด Public (BR-10) → C15 เปิดรับสมัคร
```

## OF-02 สร้างทีมและสมัครแข่ง (UC-02, UC-03)
```
T01 สร้างทีม → T09 เชิญ → T13 ตอบรับ (BR-05) → [Forming→Ready อัตโนมัติ]
  → C06 ค้นหาทัวร์ → P01 สมัคร (Hard Filter, BR-08/09)
  → P05 Organizer อนุมัติ (Soft Filter) → M01 สร้าง Bracket
```

## OF-03 แข่งขันและบันทึกผล (UC-04, UC-05)
```
M09 เปิดเช็คอิน → M12 ผู้เล่นเช็คอิน → M14 กรรมการตรวจ (ถ้า online)
  → M10 เริ่มแมตช์ → S01 ส่งผล (BR-13) → S02 ยืนยัน (BR-12)
  → [9-step transaction: Bracket + Standings + Stats + Pick'em + Notify + Audit]
```

---

# 12. ประเด็นที่พบระหว่างทำตอนนี้ — ทั้งหมดตัดสินใจแล้ว (2 ส.ค. 2569)

## 12.1 ✅ `tournament_referees` ปนสองความหมายในตารางเดียว — แก้แล้ว

**ปัญหาเดิม:** `match_id` เป็น NULL ได้ แปลว่าแถวหนึ่งอาจหมายถึง "กรรมการของทัวร์นาเมนต์" หรือ "กรรมการที่คุมแมตช์นี้" — กรรมการคนเดียวคุม 3 แมตช์ → 3 แถว → `invitation_status` ซ้ำ 3 ที่ ถ้าอัปเดตไม่ครบจะเกิดสภาพที่ตอบรับในแถวหนึ่งแต่ยัง pending ในอีกแถว

**ตัดสินใจ:** แยกเป็น 2 ตาราง — `tournament_referees` (การแต่งตั้งระดับทัวร์ + สถานะตอบรับ, UNIQUE ต่อ tournament+user) และ `match_referees` ตารางใหม่ (การมอบหมายรายแมตช์ อ้างอิงแถวแรก ไม่มี `invitation_status` ซ้ำ) ยืนยันด้วย FR-OM-05/FR-RM-01 ที่ระบุว่า "ตอบรับ" เกิดครั้งเดียวตอนเข้าร่วมทัวร์ ไม่ใช่ตอบรับซ้ำทุกแมตช์ที่มอบหมาย — แก้แล้วใน `LTMS_Database_Design.md`, `LTMS_MySQL_All_Tables.html` (การ์ด + ER diagram) และหัวข้อ 6 ของเอกสารนี้

## 12.2 ✅ ขอบเขต S08 (แก้ผลย้อนหลัง) — ตัดสินใจแล้ว

**ปัญหาเดิม:** ถ้าแก้จนผู้ชนะเปลี่ยนแต่รอบถัดไปแข่งไปแล้ว ระบบเข้าสู่สภาพที่แก้อัตโนมัติไม่ได้

**ตัดสินใจ:** ปฏิเสธ 409 เมื่อ **ผู้ชนะเปลี่ยน และ** แมตช์ถัดไปสถานะเกิน `scheduled` แล้ว — การแก้ที่ไม่กระทบผู้ชนะทำได้เสมอ ⚠️ ยังต้องผ่าน Change Management (SRS 3.6) ก่อนใช้งานจริง เพราะเป็นกฎธุรกิจใหม่ที่ SRS ยังไม่มี — รายละเอียดอยู่ในหมายเหตุใต้ตารางหัวข้อ 9

## 12.3 ✅ Round Robin กับ `next_match_id` — ตัดสินใจแล้ว

**ปัญหาเดิม:** `matches.next_match_id` ออกแบบมาเพื่อ Elimination แต่ Round Robin ไม่มีการเลื่อนผู้ชนะ

**ตัดสินใจ:** Round Robin ให้ `next_match_id = NULL` ทุกแถวตอนสร้าง Bracket (M01) — ทรานแซกชัน S02 (verify) ต้องเช็ค `IF next_match_id IS NULL THEN SKIP` ก่อนพยายามเลื่อนผู้ชนะ — รายละเอียดอยู่ในหมายเหตุใต้ตารางหัวข้อ 8

## 12.4 ✅ แจ้งเตือนล่วงหน้าก่อนปิดทีม (FR-TM-07) — ตัดสินใจแล้ว

**ปัญหาเดิม:** BR-06 ระบุว่าต้อง "แจ้งเตือนล่วงหน้า" ก่อนปิดการใช้งานทีม แต่ไม่มีตัวเลขกำกับว่าเตือนก่อนกี่วัน

**ตัดสินใจ:** เตือนก่อนครบ 2 สัปดาห์ 3 วัน / เตือนก่อนครบ 6 เดือนเงียบ 2 ครั้ง (30 วัน และ 7 วัน) เป็นค่าประมาณที่ยังไม่ยืนยันกับอาจารย์ที่ปรึกษา เก็บเป็น config ปรับได้ — รายละเอียดอยู่ในหมายเหตุใต้ตารางหัวข้อ 4

## 12.5 ✅ ขอบเขตเอกสารประกอบ Soft Filter (FR-PV-02) — ตัดสินใจแล้ว

**ปัญหาเดิม:** FR-PV-02 ไม่ระบุว่า Organizer จะขอเอกสารประเภทไหนได้บ้าง กระทบ schema ของ P01 และ endpoint อัปโหลด

**ตัดสินใจ:** จำกัดเฉพาะรูปบัตรนิสิต/บัตรประชาชนในเฟสนี้ ไม่รองรับไฟล์ประเภทอื่น — `tournament_applications.soft_filter_documents` เก็บเป็น array ของ S3 key รูปภาพ

**ค่าที่คงเดิมไม่เปลี่ยน:** `dispute_window_hours` ยืนยันคงค่า 24 ชั่วโมงตามที่ออกแบบไว้แต่แรก / ค่า `sport_types.min_members`/`max_members` ยังเป็น placeholder รอยืนยันกับทีม/อาจารย์ตอน seed ข้อมูลจริง (ไม่บล็อกการทำ endpoint matrix)

---

# 13. ลำดับถัดไป

| ตอน | เนื้อหา | สถานะ |
|---|---|---|
| 0–1 | Conventions + Resource Inventory | ✅ |
| **2** | **Endpoint Matrix (146 endpoint)** | ✅ เอกสารนี้ |
| 3 | Request/Response schema รายตัว | ถัดไป |
| 4 | Error catalog (ภาษาไทย) | |
| 5 | OpenAPI 3.1 YAML | |

**ข้อเสนอสำหรับตอนที่ 3** — ทำเฉพาะ MVP ก่อน (92 endpoint) แล้วค่อยตาม Sprint #1/#2 เพราะ schema กินพื้นที่มากและ Sprint #1 ยังมีโอกาสเปลี่ยนตามผลตอบรับจาก R01
