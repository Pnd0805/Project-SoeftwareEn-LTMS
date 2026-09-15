# LTMS Central Specification

**สถานะ:** Current Source of Truth  
**วันที่เริ่มใช้:** 2026-09-15  
**ขอบเขต:** Local Tournament Management System (LTMS) — Product behavior, business rules และ design constraints ที่ทีมใช้พัฒนาร่วมกัน

## 1. จุดประสงค์

โฟลเดอร์ `docs/spec/` เป็นจุดอ้างอิงกลางของทีมสำหรับคำถามว่า **“ระบบ LTMS ปัจจุบันควรทำงานอย่างไร”** โดยรวบรวม SRS/SDS ล่าสุดเข้ากับมติทีมที่เกิดภายหลังและได้รับการตกลงแล้ว

เป้าหมายคือไม่ให้ Backend, Frontend, Design และ Testing ต้อง reconstruct requirement จาก Discord, SRS/SDS หลายเวอร์ชัน, GUIDE, ADR, API document และ code เองทุกครั้ง

## 2. กฎ Source of Truth

หลังจากเอกสารชุดนี้เริ่มใช้ ให้ตีความแหล่งข้อมูลตามลำดับต่อไปนี้:

1. **`docs/spec/*`** — current product requirement และ behavior ที่ทีมตกลงแล้ว
2. **Accepted ADR ที่ไม่ถูก supersede** — เหตุผลและ trade-off ของ decision สำคัญ
3. **API contract / database schema / migrations** — implementation contract ที่ต้องถูกปรับให้ตรงกับ spec
4. **Current code** — สถานะที่ implement แล้ว ไม่ใช่หลักฐานว่า requirement ต้องเป็นแบบนั้น
5. **SRS / SDS ล่าสุด** — formal course documents และ baseline ที่ใช้สร้าง spec ชุดนี้
6. **Legacy Markdown / GUIDE / Discord / proposal** — historical context หรือ discussion evidence เท่านั้น

ถ้า code หรือ schema ขัดกับ `docs/spec/*` ให้ถือว่าเป็น **implementation gap** จนกว่าจะมีมติเปลี่ยน spec อย่างเป็นทางการ

## 3. แหล่งข้อมูลที่ใช้สร้าง Current Spec v1

Baseline หลัก:

- `SRS_LTMS_Week09.docx` — SRS v1.2, living requirement document
- `SDS Ver.1 (2).pdf` / `SDS Ver.1.docx` — SDS รุ่นหลัง SRS v1.2 และฐานการออกแบบล่าสุดก่อนมติทีมรอบปัจจุบัน
- legacy specification ที่ `01204341_SoftwareEngineer/docs/spec/`
- `files-by-week/week12/11 - Referee Match-Specific Invitation (Proposal).md`
- มติทีมและการสนทนาที่เกิดหลัง SRS/SDS โดยเฉพาะ Tournament preparation, prebuilt bracket และ referee capacity
- current repository API/DB/code ใช้สำหรับระบุ implementation gap เท่านั้น

## 4. สถานะของข้อความใน spec

- **Current** — ทีมถือเป็น requirement ปัจจุบันและใช้พัฒนาได้
- **Open Decision** — ยังไม่มีมติสุดท้าย ห้าม implement เป็น permanent rule โดยเดาเอง
- **Deferred** — ตกลงแนวทางแล้วแต่เลื่อนไป phase/sprint ภายหลัง
- **Superseded** — เคยเป็น requirement/decision แต่ถูกมติใหม่แทนแล้ว

เรื่องที่ยังไม่ชัดต้องอยู่ใน [OPEN_DECISIONS.md](OPEN_DECISIONS.md) ไม่ควรเขียนปนเป็น Current behavior

## 5. Document Map

| File | เนื้อหา |
|---|---|
| [01-system-overview.md](01-system-overview.md) | scope, product phases, architecture, canonical lifecycle ภาพรวม |
| [02-roles-permissions.md](02-roles-permissions.md) | Guest/User/Admin/Team Leader/Organizer/Referee และ permission boundary |
| [03-tournaments.md](03-tournaments.md) | tournament request, approval, private preparation, publication, registration |
| [04-teams-applications.md](04-teams-applications.md) | Team lifecycle, invitations, Official Team, application, Hard/Soft Filter |
| [05-referees.md](05-referees.md) | Tournament/Match referee, external approval, publication capacity, assignment changes |
| [06-brackets-matches.md](06-brackets-matches.md) | bracket skeleton, planned matches, schedule, BYE, match lifecycle |
| [07-checkin-results.md](07-checkin-results.md) | participant verification, check-in, result submission/verification/dispute |
| [08-engagement.md](08-engagement.md) | public viewing, announcements, notification, community, livestream, Pick'em |
| [09-nonfunctional.md](09-nonfunctional.md) | architecture constraints, security, privacy, reliability, performance |
| [OPEN_DECISIONS.md](OPEN_DECISIONS.md) | unresolved decisions และ implementation gaps ที่ห้ามเดา |

`LTMS_Database_ERD_TH.md` ที่มีอยู่ก่อนวันที่ 2026-09-15 เป็น **legacy database reference** และไม่ใช่ product-level source of truth; canonical physical database ต้องดู `database/schema.sql` และ migrations จนกว่าจะมี database spec รุ่นใหม่ที่ sync กับเอกสารชุดนี้

## 6. Current Delivery Scope

### MVP / R01

- account registration/login และ user profile ขั้นพื้นฐาน
- Team creation, invitation, Ready state และ Official Team approval
- Tournament request, Admin approval, private preparation และ publication
- Team application + Hard/Soft Filter
- bracket structure, match scheduling และ referee preparation
- check-in / identity verification
- result submission, two-party confirmation, dispute และ bracket progression
- public tournament, schedule, bracket, result, dashboard และ YouTube embed

### Sprint #1 / R02

- password recovery
- follow / notification
- community, review, private feedback, MVP voting
- Pick'em
- replay viewing
- schedule/stat correction
- report export
- referee change-request workflow ถ้าทีมยังยืนยัน scope นี้หลัง review ของ `OPEN_DECISIONS.md`

### Sprint #2 / Future

- Badge / Achievement
- participation history แบบละเอียด
- advanced notifications
- individual multi-entrant formats ที่ไม่ใช่ head-to-head

## 7. Canonical Product Lifecycle

ภาพรวมที่ใช้ในเอกสารชุดนี้:

```text
User submits Tournament request
        ↓
Admin review
        ↓ approve
PRIVATE PREPARATION
  - tournament configuration
  - fixed bracket skeleton from format + maxTeams
  - planned matches
  - match time ranges / venue
  - referee preparation and external approval
        ↓ readiness passes
PUBLIC
        ↓ registration may be opened
Teams apply and are approved
        ↓
accepted teams fill pre-created bracket slots
empty slots become BYE / unused fixture according to format
        ↓
registration closed / competition locked
        ↓
check-in → play → submit/verify results
        ↓
COMPLETED
```

**มติใหม่ที่ supersede SRS/SDS เดิม:** Bracket structure และ planned schedule ไม่ได้ถูกสร้างครั้งแรกหลังปิดรับสมัครอีกต่อไป แต่ถูกเตรียมระหว่าง `private` เพื่อใช้ตรวจ readiness ก่อน publication

## 8. Change Process

เมื่อมี requirement ใหม่หรือเปลี่ยน behavior:

1. คุย/เสนอ change ผ่าน Discord, meeting หรือ GitHub Issue ได้ แต่ยังไม่ถือเป็น Current
2. วิเคราะห์ผลกระทบต่อ spec, API, DB, Backend, Frontend และ test
3. เมื่อทีมอนุมัติ ให้แก้ domain spec ที่เกี่ยวข้องก่อนหรือใน PR เดียวกับ implementation
4. ถ้าเป็น architectural/business decision ที่มีทางเลือกสำคัญ ให้เพิ่ม ADR หรือ mark ADR เดิมว่า `Superseded`
5. จากนั้นจึงปรับ API/schema/code/tests ให้ตรงกัน
6. ก่อนส่งเอกสารรายวิชา ให้ sync Current Spec กลับไปยัง SRS/SDS และ revision history

ห้ามใช้ Discord message หรือ implementation ปัจจุบันเพื่อ override spec โดยไม่มีการแก้เอกสารนี้

## 9. Definition of Done สำหรับ Behavior Change

Behavior change ถือว่ายังไม่สมบูรณ์จนกว่า:

- Current spec ถูกแก้แล้ว
- invalid state/permission cases ถูกระบุ
- API และ database implications ถูกตรวจ
- automated tests ครอบคลุม business rule สำคัญ
- Backend/Frontend ใช้คำและ state semantics เดียวกัน
- SRS/SDS impact ถูกบันทึกไว้สำหรับรอบ sync ถัดไป

