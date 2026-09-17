# LTMS Open Decisions and Known Gaps

**Status:** Open / Non-normative until promoted  
**Last reviewed:** 2026-09-15

ไฟล์นี้เก็บเรื่องที่ยัง **ห้ามเดา** ใน implementation ถ้า decision ใดถูกทีมยืนยันแล้ว ให้ย้ายผลลัพธ์ไป domain spec และ mark entry นี้ว่า resolved

## OD-01 — Exact Referee Match-Invitation API

> **ปิดแล้ว (2026-09-15):** F01 รับ `matchIds?` · F05 รับ `matchIds` เลือกบางแมตช์ได้ แมตช์ที่ไม่เลือก → `match_referees.assignment_status = 'declined'` (เก็บ offer history) — `GUIDE/06 §6.1`

Direction ที่คุยแล้ว: Referee สามารถเลือกตอบรับบาง Match ได้ แต่ต้อง finalize ว่า F01/F05 หรือ endpoint ใหม่เป็นเจ้าของ `acceptedMatchIds` และสถานะของ unselected matches จะเป็น `declined`, `unassigned` หรือเก็บ offer history อย่างไร

## OD-02 — Referee Change Request Schema

> **ปิดแล้ว (2026-09-15):** ตาราง `referee_change_requests` (migration 003) + FR01–FR08 — `GUIDE/06 §6.2`, `GUIDE/11 §3.2`

ทีมต้องการรองรับ transfer, swap และ Organizer add-match request แต่ยังต้องล็อก:

- exact table shape
- request expiry
- cancellation semantics
- pre-match cutoff/buffer
- concurrent request conflict/locking strategy

เมื่อ implement ต้อง revalidate assignment/time/status ตอน apply และใช้ transaction สำหรับ conflicting changes

## OD-03 — Publication: Capacity vs Explicit Coverage — ✅ Resolved 2026-09-15

> **ปิดแล้ว (2026-09-15):** BR-10 เป็น 2 ด่าน: publish = pool ≥ needed ต่อแมตช์ (1/2) · start match = แมตช์นั้นครบ — ไม่ใช้ peak concurrent เพราะตอน publish ยังไม่มีแมตช์ — `05-referees.md §4`

Publication require **active Tournament Referee pool capacity ≥ peak concurrent demand** เท่านั้น ไม่บังคับให้ทุก planned Match มี explicit `match_referees` assignment ครบ ณ ตอน publish; explicit match assignment เป็น hard gate ภายหลังอย่างช้าที่สุดก่อน Match start

## OD-04 — External Referee Document Model

> **ปิดแล้ว (2026-09-15):** `tournament_referees.external_verification_docs` JSON (S3 key) + `external_rejection_reason` · ตรวจ 'ต่อคน' ผ่านครั้งเดียวใช้ 1 ปีทุกทัวร์ · admin: approve / request-docs / reject — `GUIDE/06 §6.3`

Invariant: external Referee ต้อง Admin-approved ก่อน active

ยังต้องกำหนด:

- required-document definitions เก็บระดับ university/faculty/tournament แบบใด
- file metadata/table
- resubmission/rejection reason
- document expiry/reuse policy

## OD-05 — Match End Time / Duration Representation — ✅ Resolved 2026-09-15

ใช้ `matches.scheduled_time` เป็นเวลาเริ่มและ `matches.scheduled_end_time` เป็นเวลาสิ้นสุดโดยตรง การตรวจ overlap/referee capacity ใช้ช่วง `[scheduled_time, scheduled_end_time)`

## OD-06 — BYE Semantics by Format

Single Elimination: empty slot → opponent advances โดยไม่สร้าง fake result เป็น Current

ต้อง finalize:

- Double Elimination เมื่อ initial/loser bracket มี empty slots
- Round Robin fixture ที่ opponent slot ว่าง: skip fixture, walkover, หรือ no contest และมีผลต่อ standing อย่างไร

## OD-07 — Seeding Timing and Withdrawal — ✅ Resolved 2026-09-17 (withdrawal part)

- Withdrawal หลังมีสาย = **walkover** ไม่ shift seed / ไม่แก้ topology: แมตช์ที่ยังไม่เริ่มของทีมนั้น อีกฝั่งชนะบาย (ลูกโซ่ถึง loser bracket) · คู่ที่ยังไม่มาจะบายเมื่อคู่มาถึง · ถอนกลางแมตช์ `in_progress` ไม่ได้ (409 `MATCH_IN_PROGRESS`)
- ทีมเช็คอินไม่ถึง `sport_types.min_members` ตอน M10 start → แพ้บายเช่นกัน
- บันทึกเป็น `match_results.match_result_status='walkover'` + `score_data` จาก `sport_types.walkover_score` · standings นับ · player stats ไม่นับ
- รายละเอียด `GUIDE/11 §10.5` · migration 011 · `backend/src/services/walkover.service.ts`
- ส่วน seed timing / re-run draw ยังเป็นของทีม Bracket (shokun) — bracket preview ยังไม่ทำ

## OD-08 — Schedule Edit Conflict Policy — ✅ Resolved 2026-09-17

M06 `PATCH /matches/:id/schedule` (implemented in `match.service.scheduleMatch`):

| กรณี | policy | error |
|---|---|---|
| Match ไม่ใช่ `scheduled` (เปิดเช็คอิน/เริ่ม/จบแล้ว) | **block** | 409 `MATCH_NOT_CHANGEABLE` |
| ช่วงเวลาอยู่นอก `event_start_date`–`event_end_date` | **block** — ขยายวันผ่าน C09 amendment | 409 `OUTSIDE_TOURNAMENT_DATES` |
| Team overlap / venue overlap (ช่วง `[start, end)` ซ้อน, ไม่นับ match `completed`) | **block** | 409 `SCHEDULE_CONFLICT` + `conflictingMatchId` |
| ผิดลำดับสาย (match รอบก่อนจบหลังเราเริ่ม / match รอบถัดไปเริ่มก่อนเราจบ) | **block** | 409 `SCHEDULE_BREAKS_BRACKET` + `blockingMatchId` |
| Referee overlap | **allow + warning** — ORG เห็นจาก F14 `coverage.conflicts` / F12 `conflictsWith` | — |

เลื่อนวันแข่ง = M06 ทีละ match + C09 ขยายวัน เท่านั้น (ไม่มี bulk shift / re-pack — มติ 2026-09-17)

## OD-09 — Missing Referee After Publication

> **ปิดแล้ว (2026-09-15):** ด่าน 2 ที่ M10 start: ไม่ครบ → 409 `INSUFFICIENT_REFEREES` · ไม่มี emergency/ORG fallback ใน MVP · ทัวร์ไม่ auto-unpublish

Current direction: Referee ถูกถอด/ถอนภายหลังได้, Tournament ไม่ auto-unpublish และระบบเตือน Organizer

ยังต้องล็อก hard gate ก่อน `check-in/start Match` ว่าถ้า Referee coverage ไม่ครบจะ block, allow emergency Organizer fallback, หรือใช้ QR fallback แบบใด

## OD-10 — Organizer/Referee Conflict Edge Cases

ต้องกำหนด policy เมื่อ Organizer เป็น Referee fallback หรือมี Team ของตนแข่งขันใน Tournament เดียวกัน โดยเฉพาะ approval, seeding, dispute และ result confirmation

## OD-11 — Tournament Scope Delivery — ✅ Resolved 2026-09-15

Domain/database model รองรับ `UNIVERSITY`, `FACULTY`, `DEPARTMENT` แต่ Current MVP API/UI เปิดเฉพาะ `department` และ `faculty`; `university` เป็น deferred delivery และค่อยเปิดหลังตรวจ authorization/filter/UI ที่เกี่ยวข้องครบ

## OD-12 — Sport-Specific Rules

ยังต้องมี canonical Sport Definition สำหรับ:

- roster minimum/maximum
- Match duration
- required Referee per mode
- score schema
- statistics definitions
- draw/winner rule

ห้าม hardcode rule ใหม่ในหลาย service โดยไม่มี source definition เดียว

## OD-13 — Retention Implementation

SRS/SDS กำหนด Tournament/Match/Result retention 4 ปีและ private auto-delete แต่ต้อง finalize production implementation เช่น anonymization vs physical deletion, legal hold และ exact scheduled job

## OD-14 — Implementation Gaps to Reconcile

Current code/schema/API มี known gaps เมื่อเทียบ Current Spec เช่น:

- bracket generation API ยังอิง approved Team count/old lifecycle
- ~~current referee API/schema ยังไม่มี partial assignment response/change requests~~ → มีแล้ว (F05 `matchIds`, FR01–FR08, migration 003) 2026-09-15
- legacy `docs/spec/LTMS_Database_ERD_TH.md` และ legacy course Markdown มี MongoDB/30-table assumptions ที่ไม่ตรง RDS-only current architecture

รายการนี้ใช้วาง migration/gap-analysis รอบถัดไป ไม่ใช่คำสั่งให้แก้ code ใน PR เอกสารนี้
