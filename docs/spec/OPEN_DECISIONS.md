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

## OD-15 — Eligibility Rules & Faculty-Admin Scope — ✅ Resolved 2026-09-20

- **Q1 (ใครใส่กฎคณะ/ชั้นปี, ตอนไหน) → ค**: ใส่ตอนสร้าง (C01 `eligibilityRules`) · แก้ตรงได้เฉพาะ `pending_approval` (C17b PUT — guard คือ **ผู้ยื่นคำขอ** `requireRequester` เพราะ `isOrganizerOf` ยังเป็น false ตอน pending; FE-c17b พบว่าเวอร์ชันแรกเรียกไม่ได้เลย แก้ 20 ก.ย. พร้อมให้ผู้ยื่นคำขอเห็น C07/C17 ของตัวเองทุกสถานะยกเว้น `auto_deleted`) · ผ่านอนุมัติแล้วต้องผ่าน amendment (C09/C11) · ล็อกเมื่อเปิดรับสมัครหรือมีใบสมัคร (`ELIGIBILITY_LOCKED`)
- **Q2 (แอดมินคณะ "รับผิดชอบ" ทัวร์ไหน) → ข**: คณะตัวเองเป็นผู้จัด **และ** กฎคณะจำกัดเฉพาะคณะตัวเอง · ทัวร์ข้ามคณะหรือไม่จำกัดคณะ → university_wide เท่านั้น (`ELIGIBILITY_OUT_OF_SCOPE`) · ทางเลือก ข′ (มีคณะตัวเองอยู่ในกฎก็พอ) ถูกปฏิเสธ
- **Q3 (`scopeType: 'university'`) → ไม่เปิด** ยืนตาม OD-11 · `university` = มหาวิทยาลัยเป็นผู้จัด ไม่ใช่ "เปิดรับทุกคณะ" — เปิดรับทุกคณะ = ไม่ใส่กฎ `faculty` · จะเปิดได้ต้องกำหนดก่อนว่าใครมีสิทธิ์สร้าง

## OD-16 — Public visibility of `resultStatus` on M04/M05 — ✅ Resolved 2026-09-20

`resultStatus` (submitted/disputed/rejected/verified/walkover) เป็นข้อมูลสาธารณะบนรายการ/รายละเอียดแมตช์ **โดยตั้งใจ** — ตรง spec 07 §8 ที่ให้ UI แยก provisional/disputed ออกจาก verified · สิ่งที่ซ่อนจากคนนอกคือ **สกอร์และเหตุผล** ของผลที่ยังไม่ยืนยัน (`score` null จนกว่า verified/walkover, S05 ตอบ 404) — ไม่ใช่การมีอยู่ของผล

## OD-17 — Team = Player Pool, Application = Squad — ✅ Resolved 2026-09-19/20

มติ 19 ก.ย. (shokun, migration 018/019): ทีมเป็น **คลังผู้เล่น** ไม่มีตัวจริง/สำรอง · ใบสมัคร P01 ส่ง `playerIds` = **รายชื่อลงแข่ง** (`application_players`, จำนวนใน [min,max] ของกีฬา, คนเดียวหนึ่งทีมต่อทัวร์, ส่งแล้วล็อก) · เช็คอิน/นับขั้นต่ำ/สถิตินักกีฬา/`/me/matches` ใช้รายชื่อนี้ ไม่ใช่สมาชิกทีม

ที่ตัดสินเพิ่ม 20 ก.ย. ตอน merge เข้า BE_KN:
- **Q2-ค**: ล็อกเฉพาะ**คนในรายชื่อลงแข่ง**ของใบสมัคร `approved` (ไม่ต้องรอสร้างสาย) — `MEMBER_LOCKED_IN_TOURNAMENT` · คนอื่นในคลังเข้า/ออกอิสระ · แทน B6 roster lock ทั้งทีม (`ROSTER_LOCKED` ถอดออก)
- **Q3-ก**: คลังไม่มีเพดาน — `TEAM_FULL` ถอดออกทุกทาง (T09/T13/T20/T22) · เพดานจริงคือขนาดรายชื่อตอน P01
- **Q4**: `player_profile_stats` บวก/ถอน (verify · B4 reject/amend) ให้เฉพาะ `application_players` ของทีมในทัวร์นั้น
- **Q5-ก**: `/me/matches` ผู้เล่น = แมตช์ที่ฉันมีชื่อลงแข่ง
- migration ของ shokun renumber 014→**018**, 015→**019** (ชนกับ 014/015 ของ BE_KN ที่ FE รันไปแล้ว)

## OD-18 — Player stat data types (decimal / boolean) — ⏸ Deferred 2026-09-20

`sport_stat_definitions.data_type` เคยประกาศ `integer|decimal|boolean` แต่ `player_match_stat_values` มีแค่ `value_int` และ S06 **บวกสะสม** (`value_int = VALUES(value_int) + value_int`) ซึ่งผิดความหมายสำหรับเวลา (decimal) และ true/false (boolean) — FE-s06-accepts-whole-numbers

**มติ 20 ก.ย. (ทาง ค)**: MVP 93 รองรับเฉพาะ `integer` — migration 020 ตัด enum เหลือ `('integer')` ให้ schema/DB/API ตรงกัน · statSchema `value: z.int()` คงเดิม · กีฬา 5 ชนิดที่มีใช้ integer ทั้งหมด

**จะเปิด decimal/boolean ต้องตัดสินก่อน**: (1) S06 เป็น "ตั้งค่าทับ" หรือ "บวกสะสม" หรือแยกตามชนิด (2) คอลัมน์ `value_decimal`/`value_bool` + mapper S07 คืน `number|boolean` (3) FE ฟอร์มกรรมการส่ง "ยอดรวม" หรือ "ส่วนเพิ่ม"

แก้พ่วงในรอบเดียวกัน: S06 `findTeamIdOfUserInMatch` และ S07 `allPlayerInMatch` ย้ายจาก `team_members` ไป `application_players` ตาม OD-17 (เดิมคนในคลังที่ไม่ได้ลงแข่งบันทึกสถิติได้และโผล่ใน S07)

## OD-19 — Revoking a check-in that already went through — ✅ Resolved 2026-09-21

FE-check-has-gone-through: `qr_onsite` ผ่านทันทีตอนสแกน และ `manual_by_referee` ผ่านทันทีตอนกรรมการกด — ไม่มีใครตรวจก่อน แต่ M15 รับเฉพาะ `pending` → เพื่อนสแกนแทนคนที่ไม่มา / กรรมการกดผิดคน แก้ไม่ได้ และแถวนั้นนับเข้า `min_members` ตัดสินแพ้บาย

- **1 → ได้**: M15 reject รับ `pending` / `success` / `exception` ขณะ `checkin_open` หรือ `in_progress` · M14 verify ยังรับ `pending` เท่านั้น
- **2 → ข**: ถูก reject แล้ว ผู้เล่นเช็คอินใหม่ได้ (M12) หรือกรรมการกดให้ใหม่ได้ (M19) — UPDATE ทับแถวเดิม (UNIQUE match+user) ล้าง `rejection_reason`/`verified_*` · ต้อง `checkin_open` เหมือนครั้งแรก
- **3 → ไม่กระทบผล**: ถอนระหว่าง `in_progress` ไม่ย้อนคำตัดสิน M10 (ทีมไม่แพ้บายย้อนหลัง) แค่บันทึกว่าคนนี้ไม่ได้มา
- error ใหม่ `ALREADY_REJECTED` (409) แยกจาก `ALREADY_DECIDED` เพื่อให้ FE รู้ว่าเช็คอินใหม่ได้
