# LTMS Open Decisions and Known Gaps

**Status:** Open / Non-normative until promoted  
**Last reviewed:** 2026-10-04

ไฟล์นี้เก็บเรื่องที่ยัง **ห้ามเดา** ใน implementation ถ้า decision ใดถูกทีมยืนยันแล้ว ให้ย้ายผลลัพธ์ไป domain spec และ mark entry นี้ว่า resolved


## อ่านสถานะของแต่ละข้อยังไง

**ดูที่หัวข้อ อย่าดูที่เนื้อหา** — หัวข้อคือสิ่งเดียวที่กรองหาได้

| ธง | หมายความว่า |
|---|---|
| ✅ `Resolved` / `ตัดสินแล้ว` / `ทำแล้ว` | จบแล้ว ที่เหลือเก็บไว้เป็นบันทึกเหตุผล |
| ⚠️ | ปิดบางส่วน — หัวข้อบอกว่าเหลืออะไร |
| ⏸ `Deferred` | ตั้งใจเลื่อนออกไป |
| ไม่มีธง | **ยังค้างจริง ห้ามเดา** |

**4 ต.ค. 2569 — ติดธงคืนให้ 5 ข้อ** · OD-01/02/04/09 มีกล่อง *"ปิดแล้ว (2026-09-15)"* อยู่ใน
เนื้อหามานานแล้ว **แต่หัวข้อไม่ได้บอก** ⇒ ใครไล่หาว่ามีอะไรค้างจะเห็น 8 เรื่อง ทั้งที่ค้างจริงแค่ 3
(OD-06 · OD-12 · OD-13) และ 4 ใน 5 ที่ติดธงคืนเป็นโมดูลกรรมการ ⇒ ดูเหมือนโมดูลนั้นค้างอยู่ 4 เรื่อง

OD-14 **ไม่ติด ✅** เพราะปิดไปข้อเดียวจากสาม (ข้อกรรมการ) เหลือ bracket generation
กับเอกสาร ERD เก่าที่ยัง assume MongoDB ⇒ ติด ⚠️ พร้อมบอกว่าเหลืออะไร

**ติดธงให้แล้ว ไม่แตะเนื้อหาเดิมเลย** — ถ้าใครเห็นว่าข้อไหนยังไม่ควรปิด เอาธงออกได้

## OD-01 — Exact Referee Match-Invitation API — ✅ Resolved 2026-09-15

> **ปิดแล้ว (2026-09-15):** F01 รับ `matchIds?` · F05 รับ `matchIds` เลือกบางแมตช์ได้ แมตช์ที่ไม่เลือก → `match_referees.assignment_status = 'declined'` (เก็บ offer history) — `GUIDE/06 §6.1`

Direction ที่คุยแล้ว: Referee สามารถเลือกตอบรับบาง Match ได้ แต่ต้อง finalize ว่า F01/F05 หรือ endpoint ใหม่เป็นเจ้าของ `acceptedMatchIds` และสถานะของ unselected matches จะเป็น `declined`, `unassigned` หรือเก็บ offer history อย่างไร

## OD-02 — Referee Change Request Schema — ✅ Resolved 2026-09-15

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

## OD-04 — External Referee Document Model — ✅ Resolved 2026-09-15

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

## OD-09 — Missing Referee After Publication — ✅ Resolved 2026-09-15

> **ปิดแล้ว (2026-09-15):** ด่าน 2 ที่ M10 start: ไม่ครบ → 409 `INSUFFICIENT_REFEREES` · ไม่มี emergency/ORG fallback ใน MVP · ทัวร์ไม่ auto-unpublish

Current direction: Referee ถูกถอด/ถอนภายหลังได้, Tournament ไม่ auto-unpublish และระบบเตือน Organizer

ยังต้องล็อก hard gate ก่อน `check-in/start Match` ว่าถ้า Referee coverage ไม่ครบจะ block, allow emergency Organizer fallback, หรือใช้ QR fallback แบบใด

## OD-10 — Organizer/Referee Conflict Edge Cases — ✅ ตัดสินแล้ว 2026-09-18 (ปิดในเอกสาร 30 ก.ย. 2569)

> **ปิดช้า 12 วัน** — มติออกตั้งแต่ 18 ก.ย. และโค้ดบังคับมาตลอด แต่หัวข้อนี้ยังเขียนว่า "ต้องกำหนด policy"
> FE สะดุดจนต้องเขียนมาเตือนใน `FE-REPLY-BE_KN-2026-09-29` · เอกสารที่บอกว่ายังไม่ตัดสินคือคำเชิญให้ถกใหม่

**มติ: ห้ามทับซ้อน ไม่ใช่ "มี policy ตอนทับซ้อน"** — กันที่ทางเข้าทั้งสองทิศ ไม่ปล่อยให้เกิดแล้วค่อยหาทางจัดการ
เหตุผลเดียวกับที่ใช้ทั้งระบบ: **คนตัดสินต้องไม่ใช่คู่กรณี** · ถ้าปล่อยให้เกิดแล้วไปแก้ที่ approval/seeding/dispute
จะต้องเขียนข้อยกเว้นในทุกจุดที่ตัดสินใจ และพลาดจุดใดจุดหนึ่งเมื่อไรก็กลับมาเป็นปัญหาเดิม

| ทิศทาง | error | ที่บังคับ |
|---|---|---|
| ส่งใบสมัคร โดยในรายชื่อมีผู้จัด/กรรมการของทัวร์นั้น | `TEAM_CONFLICT_OF_INTEREST` | ตอนยื่นใบสมัคร |
| เชิญผู้จัดของทัวร์นั้นเป็นกรรมการ | `ORGANIZER_CANNOT_BE_REFEREE` | ตอนเชิญกรรมการ |
| เชิญคนที่อยู่ในทีมที่สมัครทัวร์นั้นเป็นกรรมการ | `REFEREE_CONFLICT_OF_INTEREST` | ตอนเชิญกรรมการ |

ส่ง `43bacda` (spec 02 §7) · FE ยิงจริงครบสามเส้นเมื่อ 29 ก.ย. ยืนยันว่าสร้างเคสใหม่ไม่ได้แล้ว

**เคสฝังใน `qa-baseline.sql` — ✅ ล้างครบ 1 ต.ค. 2569** (ดู OD-42)
baseline รอบ 21 ก.ย. มีเคสผิดกฎฝังอยู่ 12 เคสตั้งแต่ก่อนมติ — เป็นปัญหาของ **ข้อมูลตั้งต้น** ไม่ใช่ของกฎ
เก็บ baseline ใหม่ที่ schema 034 แล้ว · `frontend/scripts/audit-roles.py` ผ่าน C1–C8 ครบ

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

## OD-14 — Implementation Gaps to Reconcile — ⚠️ เหลือ 2 จาก 3 ข้อ (ข้อกรรมการปิดแล้ว 2026-09-15)

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

## OD-20 — No draws; standings tie-break — ✅ Resolved 2026-09-21

FE-match-end-level / FE-standings-carry-points-draws (B3)

- **ไม่มีผลเสมอ** ทุกรูปแบบสาย: S01 บังคับ `winnerTeamId` และสกอร์ผู้ชนะ > ผู้แพ้ (`ensureScoreData` คงเดิม) · กติกา = เสมอต้องตัดสินให้จบในสนาม (ต่อเวลา/จุดโทษ/เซตตัดสิน) แล้วส่งสกอร์รวมที่มีผู้ชนะ · กีฬาทั้ง 5 ใน MVP 93 จบด้วยผู้ชนะได้ · แต้ม = ชนะ × `WIN_POINTS` (3)
- **tie-break ก**: แต้ม → ผลต่างประตู → ประตูได้ → ชนะ → ชื่อทีม (ให้ลำดับนิ่ง ไม่ถือว่าต่างอันดับ) · migration 021 เพิ่ม `goals_for/goals_against` ใน `tournament_standings` + backfill จาก `score_data` ของผล verified/walkover · บวก/ถอนพร้อม standings ใน verify/reject/amend/walkover (`standingsTx`) · amend ที่ผู้ชนะเดิมแต่สกอร์เปลี่ยน → แก้เฉพาะประตู
- S12 คืน `played, points, goalsFor, goalsAgainst, goalDiff` · `rank` เท่ากันได้ (1,1,3) → FE เลิกเดา `wins*3`
- ทางเลือกที่ปฏิเสธ: เสมอเฉพาะ round robin (ต้องมี draw_points ต่อกีฬา + tiebreak JSON + draws ใน player stats — ใหญ่กว่ามาก) · head-to-head (ตัด 3 ทีมวนกันไม่ได้)

## OD-21 — Closing a tournament — ✅ Resolved 2026-09-21

FE-closing-tournament-nothing-sets (B1): เดิมไม่มีอะไร set `tournament_status = 'completed'` → S10 winner 404 ตลอด, `championships` ไม่เคยบวก, `last_competed_at` ไม่เคยอัปเดต, ทัวร์ completed (ถ้ามี) หายจากทุกคนยกเว้นเจ้าของ

- **1-ข ORG กดเอง** `POST /tournaments/:id/complete` (C14b) — ต้องมีแมตช์และทุกแมตช์ `completed` (`MATCHES_UNFINISHED` / `NO_MATCHES`) · ไม่มี scheduler จึงไม่ auto (ทางเลือก ก/ค ปฏิเสธ)
- **2-ง ปิดแล้วทำครบ** ในทรานแซกชัน: `champion_team_id` + `completed_at/by` (migration 022) · `championships +1` ให้ `application_players` ของทีมแชมป์ · `teams.last_competed_at = NOW()` ทุกทีม approved · audit `tournament_completed` · **ล็อกทุก write** ใต้ `/tournaments/:id/*`, `/matches/:id/*` (middleware `lockCompletedTournament` ใน routes/index — ยกเว้น announcements) และ P08 ถอนตัว → 409 `TOURNAMENT_COMPLETED`
- **3-ก ทัวร์จบเป็นสาธารณะ**: C07/C17/S10/S12 เห็นได้ทุกคนเหมือน `public` · C06 `?status=completed` (default `public` — ทัวร์ที่จบไม่ปนกับที่กำลังรับสมัคร)
- **4-ก รอบชิงแพ้ทั้งคู่ปิดได้** แชมป์ `null` ไม่บวกแชมป์ให้ใคร · round robin เสมออันดับ 1 ทุกเกณฑ์ → แชมป์ `null` เช่นกัน (ระบบไม่ตัดสินแทน ORG — ตัดสินเอง 21 ก.ย.)
- แชมป์ round robin = อันดับ 1 ของ S12 (ก่อนหน้านี้ S10 ใช้ `next_match_id IS NULL` ซึ่งเป็นทุกแมตช์ของ RR — ผิด)

## OD-22 — Redrawing an existing bracket — ✅ Resolved 2026-09-21

FE-replace-existing-bracket-atomic: M01 เคยตอบ `BRACKET_ALREADY_EXISTS` ทุกครั้งที่มีแมตช์ → ORG ที่จับฉลากแล้วแต่มีทีมอนุมัติเพิ่ม/ถอนตัว ก่อนเริ่มแข่ง เอาทีมเข้าสายไม่ได้

- **1-ข เงื่อนไข**: ทุกแมตช์ยัง `scheduled` และไม่มีเช็คอิน/ผล — **ไม่สน `registration_open`** (กรณีจริงคือปิดรับสมัครแล้วค่อยมีทีมถอน/อนุมัติค้าง) · ไม่ผ่าน → 409 `BRACKET_IN_USE {matches}`
- **2-ก รูปแบบ**: M01 เดิม + `replace: true` (ไม่ส่ง = 409 เดิม กันกดพลาด) — ไม่แยก DELETE endpoint เพราะ 2 ขั้นไม่ atomic
- ลบใน tx: referee_change_requests, match_referees, (checkins/results/stats/pickem ที่ควรว่าง), announcements/feedback `match_id → NULL`, matches (ตัด self-FK ก่อน), bracket_nodes, tournament_standings · คงไว้: tournament_applications, tournament_referees (pool) · persist* รับ connection ร่วม → ลบ+สร้างเป็นก้อนเดียว พังตรงไหน rollback สายเดิมยังอยู่

## OD-23 — รีวิวจากผู้ลงแข่ง + โหวต MVP (C6) — ✅ Resolved 2026-09-21 · MVP แก้เป็นรายแมตช์ 2026-09-26

FE-tournament-feedback: Community tab (ให้คะแนนการจัดทัวร์) และหน้าโหวต MVP ทำงานเฉพาะ mock · ใช้ตาราง `tournament_feedback` เดิม ไม่มี migration

> **ชื่อเรียกที่ทีมตกลง 23 ก.ย.** — ตาราง `tournament_feedback` เก็บ 3 เรื่อง (ตัดสินแล้วว่า**ไม่แยกตาราง** เพราะกฎสิทธิ์บังคับที่ service และค่าเปลี่ยนสูง) จึงต้องเรียกให้ขาดจากกัน:
> `organizer_feedback` = **รีวิวจากผู้ลงแข่ง** (OD นี้) · `mvp_vote` = **โหวต MVP** (OD นี้) · `comment` = **ความเห็นต่อทัวร์** (OD-24)

- **1 ใครให้คะแนน**: เฉพาะคนที่เกี่ยวข้อง — ผู้เล่นในรายชื่อลงแข่ง (`application_players` ของใบสมัคร approved) · หัวหน้าทีม approved · **ไม่รวมกรรมการ** (แก้ 21 ก.ย. — กรรมการอาจเป็นคนฝั่งผู้จัด) · ORG ให้คะแนนตัวเองไม่ได้ (`ORGANIZER_CANNOT_REVIEW_OWN`) · คนอื่น → 403 `FEEDBACK_NOT_ALLOWED`
- **2 เมื่อไร (รีวิว)** (แก้ 21 ก.ย. · แก้อีกครั้ง 22 ก.ย.): **เปิดตั้งแต่ทัวร์เริ่ม** = ถึง `event_start_date` 00:00 เวลาไทย **หรือ** มีแมตช์ที่แข่งจริงแล้ว (in_progress / disputed / result_rejected / completed ที่มีผลไม่ใช่ walkover) อย่างไหนถึงก่อน — ชนะบายไม่นับว่าเริ่ม (ทีมถอนก่อนวันแข่งก็เกิดได้) · ก่อนหน้า → 409 `TOURNAMENT_NOT_STARTED {opensAt}` · **ปิดรับพร้อม MVP** = 7 วันหลัง `completed_at` (พ้น → 409 `FEEDBACK_CLOSED`) · GET คืน `status` (`not_started` / `open` / `closed`) + `opensAt` + `closesAt` · **แก้คะแนน** = ส่งซ้ำระหว่างเปิด (เขียนทับ ข้อ 3) · MVP เริ่มโหวตหลังทัวร์ `completed` เท่านั้น (ก่อนหน้า → 409 `TOURNAMENT_NOT_COMPLETED`) โหวตได้ 7 วัน (พ้น → 409 `MVP_VOTING_CLOSED`) · ปิดโหวตแล้วค่อยประกาศ `winners` (เสมอได้หลายคน) · `lockCompletedTournament` ยกเว้น `/feedback` และ `/mvp-votes`
- **ทีมถอนตัว** (ตัดสิน 21 ก.ย.): หัวหน้า/ผู้เล่นทีมที่ถอนให้คะแนนไม่ได้อีกหลังถอน (FE ถามให้คะแนนก่อนยืนยันถอนตัว — **เฉพาะเมื่อทัวร์เริ่มแล้ว** `status: open` · ความเห็นที่ให้ไว้แล้วยังนับ) · โหวต MVP ได้เหมือนคนนอก · ผู้เล่นทีมที่ถอนไม่เป็นผู้ถูกโหวต
- **กรรมการที่ถูกถอด** (ตัดสิน 21 ก.ย.): โหวต MVP ได้ · กรรมการที่ยังรอตอบ/ตอบรับแล้วโหวตไม่ได้
- **ทัวร์ที่ completed ก่อนมี `completed_at`** (ข้อมูลเก่าก่อน migration 022 เท่านั้น — ระบบจริงใส่ให้ตอนกด B1 เสมอ): ถือว่าปิดทั้งให้คะแนนและ MVP
- **3 ส่งซ้ำ**: เขียนทับของเดิม (คนละ 1 อันต่อทัวร์ ใช้ UNIQUE เดิมของตาราง) ทั้งรีวิวและโหวต MVP · **แก้ข้อความแล้วธง `is_reported` คงเดิม** (มติ 23 ก.ย. ข้อ 5 ทาง **ก** — เดิมล้างธงทิ้ง ทำให้ "เขียนดี → ถูก report → แก้เป็นข้อความแย่" ธงหายเงียบ ๆ · ไม่เลือกทาง ข (ล้าง + audit) เพราะเพิ่ม action ที่ต้องมีคนไปเปิด audit ดู ทั้งที่ผู้ตรวจอ่านข้อความล่าสุดอยู่แล้ว) · ธงถูกล้างเฉพาะตอนแอดมินกด restore
- **4 โหวต MVP → ย้ายเป็นรายแมตช์ทั้งหมด (มติ 26 ก.ย. 2569)** — ดูหัวข้อ "โหวต MVP รายแมตช์" ท้าย OD นี้ · MVP ระดับทัวร์ (`/tournaments/:id/mvp-votes`) **ถูกถอดออก** พร้อม `findMvpCandidates(tournamentId)` และเงื่อนไข "โหวตได้ 7 วันหลังปิดทัวร์" ทั้งหมด · การปิดรับรีวิว 7 วันหลังปิดทัวร์ (ข้อ 2) ยังอยู่เหมือนเดิม แค่ไม่ได้ผูกกับนาฬิกาของ MVP อีกแล้ว (`REVIEW_CLOSING_DAYS`)
- **การมองเห็น** (ตามข้อเสนอในเอกสารแบ่งงาน): ค่าเฉลี่ย/จำนวน/การกระจายเป็นสาธารณะ · ORG เห็นข้อความแต่ไม่เห็นชื่อ · แอดมิน `university_wide` เห็นชื่อ (ใช้ตรวจ report)
- **คำวินิจฉัยข้อโต้แย้งถึงผู้เล่นทุกคน ตัวคำค้านไม่ถึง** (มติ 30 ก.ย. 2569 · FE-dispute-ruling-hidden-from-players)
  - มติ 27 ก.ย. กั้นหกฟิลด์ไว้เป็นก้อนเดียวที่ ORG / REF ของแมตช์ / หัวหน้า 2 ทีม — ถูกสำหรับ `disputeReason` แต่เกินไปสำหรับคำวินิจฉัย
  - **migration 020 บังคับให้ผู้จัดเขียนคำวินิจฉัยก็เพื่อให้ทั้งสองทีมรู้เหตุผล** — พอกั้นรวม ข้อความที่เขียนไว้ให้ผู้เล่นอ่านก็ไม่เคยถึงผู้เล่น
  - แยกเป็น `ruling` (คำวินิจฉัย — ผู้เกี่ยวข้อง **+ ผู้เล่นในรายชื่อลงแข่งของสองทีม**) กับ `complaint` (ตัวคำค้าน — คงเดิม)
  - เช็คว่าอยู่ในรายชื่อด้วย `findTeamIdOfUserInMatch` (OD-17 — รายชื่อลงแข่งจริง ไม่ใช่คลังทีม) · ถามเฉพาะตอนที่ไม่ผ่านด่านแรก — ผู้เกี่ยวข้องเห็นสองชั้นอยู่แล้ว ไม่ต้องยิงซ้ำ
  - คนนอกทั้งหมดยังไม่ได้สักฟิลด์เหมือนเดิม · คนที่ไม่มีสิทธิ์ไม่มีคีย์เลย ไม่ใช่ได้ `null`

- **report / ลบ**: `POST /feedback/:id/report` — organizer_feedback report ได้เฉพาะ ORG ของทัวร์ (คนที่มองเห็น) · โหวต MVP report ไม่ได้ · `DELETE /admin/feedback/:id` soft delete + audit `feedback_removed` · คนที่ถูกลบส่งใหม่ไม่ได้ (409 `FEEDBACK_REMOVED`) · ค่าเฉลี่ย/คะแนนโหวตไม่นับแถวที่ถูกลบ

### โหวต MVP รายแมตช์ — ✅ Resolved 2026-09-26

MVP ระดับทัวร์ตอบคำถาม "ใครเก่งสุดทั้งทัวร์" ซึ่งคนดูตอบได้ยากและต้องรอจนปิดทัวร์ถึงจะโหวตได้ · ย้ายมาเป็นรายแมตช์ = โหวตตอนที่ยังจำเกมได้ และใช้ข้อมูลที่ระบบมีอยู่แล้ว (เช็คอิน + สถิติรายแมตช์)
**ไม่มี migration** — `tournament_feedback.match_id` + `match_key` (generated column) และ UNIQUE `(tournament_id, match_key, user_id, feedback_type)` รองรับ "1 คน 1 เสียงต่อแมตช์" อยู่แล้ว

| # | เรื่อง | มติ |
|---|---|---|
| 1 | ขอบเขต | แทนที่ MVP ระดับทัวร์ทั้งหมด |
| 2 | ใครโหวตได้ | ใครก็ได้ที่ล็อกอิน **ยกเว้นสมาชิกของสองทีมในแมตช์นั้น** (`team_members` + หัวหน้า — กันทั้งทีม ไม่ใช่แค่รายชื่อที่ลงแข่ง) → 403 `MVP_VOTER_NOT_ELIGIBLE` · กรรมการและผู้จัดโหวตได้ (ต่างจากกฎเดิม) |
| 3 | เปิดเมื่อไร | ทันทีที่แมตช์จบ (`matches.actual_end_time` จาก migration 026) · ก่อนหน้านั้น → 409 `MVP_VOTING_NOT_OPEN` |
| 4 | ปิดเมื่อไร | **24 ชม. หลัง `actual_end_time`** (`MVP_VOTING_HOURS` ใน `config/scoring.ts`) → 409 `MVP_VOTING_CLOSED {closesAt}` · ไม่ผูกกับเวลาปิดทัวร์หรือการ verify ผล |
| 5 | ใครถูกโหวตได้ | เฉพาะผู้เล่นที่ `match_checkins.match_checkin_status = 'success'` ในแมตช์นั้น — คนที่ลงเล่นจริง ไม่ใช่ทุกคนในใบสมัคร → ไม่ใช่ = 422 `MVP_CANDIDATE_NOT_ELIGIBLE` |
| 6 | ไม่ได้แข่งจริง | ผลเป็น `walkover` (ชนะบาย/ปรับแพ้/แมตช์ตาย) → ไม่มีโหวต 409 `MVP_NOT_AVAILABLE` · GET คืน `candidates: []` |
| 6b | ทัวร์ต้องเปิดเผยแพร่ | ทัวร์ต้อง `public` หรือ `completed` — unpublish กลับเป็น private / ถูกลบ → 409 `TOURNAMENT_NOT_PUBLIC` · `canVote` เป็น false · อ่านผลได้ตามปกติ (กฎเดียวกับความเห็นต่อทัวร์และ Pick'em ใน OD-24) |
| 7 | ผลถูกแก้ย้อนหลัง | โหวตที่ลงไปแล้วคงอยู่ — MVP คือผลงานในสนาม ไม่ใช่ผลแพ้ชนะ |
| 8 | แมตช์ไหนมี | ทุกแมตช์ที่แข่งจริง |
| 9 | วิธีตัดสิน | โหวต + แสดงสถิติรายคนของแมตช์นั้นประกอบ (`player_match_stats`) |
| 10 | ★ ระหว่างเปิดโหวต | **ห้ามส่งจำนวนโหวตออกไปเลย** — ไม่มีคีย์ `votes` ในผู้ถูกโหวต และไม่มี `totalVotes` (ไม่ใช่ส่ง 0) · รายชื่อเรียงตามทีม/ชื่อ ไม่ใช่ตามคะแนน เพราะลำดับก็บอกใบ้ได้ · กัน "แห่ตามคนนำ" |
| 11 | คะแนนเสมอ | `winners` เป็น array — ประกาศร่วมกันหลายคน |
| 12 | ไม่มีใครโหวต | `winners: []` แมตช์นั้นไม่มี MVP |
| 13 | ส่งซ้ำ | เปลี่ยนคนที่โหวต ไม่ใช่เพิ่มเสียง (UNIQUE เดิมบังคับ) · 201 ครั้งแรก / 200 เปลี่ยน |

- `lockCompletedTournament` ยังยกเว้น `/mvp-votes` เหมือนเดิม (เส้นทางใหม่ใช้ path ท้ายเดียวกัน) → แมตช์ที่จบก่อนผู้จัดปิดทัวร์ยังโหวตต่อได้จนครบ 24 ชม.
- แมตช์ที่ถูกยกเลิกกลางคัน (M10c abandon) ล้าง `actual_end_time` เป็น NULL อยู่แล้ว และการโหวตเกิดได้ก็ต่อเมื่อมีเวลาจบ จึงไม่มีโหวตค้างจากรอบที่ถูกยกเลิก

## OD-24 — ความเห็นต่อทัวร์ + Pick'em (C7) — ✅ Resolved 2026-09-22

FE-match-comments-pick-em: SocialBar ในหน้าแมตช์ (คอมเมนต์ + ทายผล) ทำงานเฉพาะ mock

**ความเห็นต่อทัวร์ (`comment`) — ระดับทัวร์** (แก้ 22 ก.ย.: เดิมทำเป็นรายแมตช์ หลายอันต่อคน ในตาราง `match_comments` migration 024 → **เอาออกทั้งหมด** · migration 024 ถูกลบ ไม่เคยเข้า BE_KN)
- อยู่ใน `tournament_feedback` แบบ `feedback_type = 'comment'` (enum มีอยู่แล้ว · **ไม่มี migration**) · เหมือน feedback แต่ **ทุกคนเห็น** (feedback ให้ ORG เห็นคนเดียว)
- **คนละ 1 อันต่อทัวร์** (UNIQUE เดิม) · **ส่งซ้ำ = แก้** (201 ครั้งแรก / 200 แก้ · แก้แล้วล้างธง report) · ≤ 500 ตัวอักษร
- **ใครก็ได้ที่ล็อกอิน** (รวมผู้เล่น/ORG — เป็นแค่การพูดคุย) · อ่านเป็นสาธารณะ พร้อม `mine` + `canComment`
- ทัวร์ต้อง `public` หรือ `completed` — อื่น ๆ (private / รออนุมัติ / ถูกปฏิเสธ / ถูกลบ) → 409 `TOURNAMENT_NOT_PUBLIC` · อ่าน: คนนอกได้ 404 เหมือนหน้าทัวร์ (ORG กับแอดมินทั้งมหาวิทยาลัยยังอ่านได้)
- เจ้าของลบเอง (`DELETE /tournaments/:id/comments/me`) = ลบจริง โพสต์ใหม่ได้ · report ใครก็ได้ยกเว้นของตัวเอง (`POST /feedback/:id/report` → 400 `CANNOT_REPORT_OWN_COMMENT`) · ลบของคนอื่นได้ทั้งแอดมิน `university_wide` (`DELETE /admin/feedback/:id` + audit `feedback_removed`) และผู้จัดของทัวร์นั้น (ดู "การกำกับดูแลความเห็น" ท้าย OD นี้) · **ถูกแอดมินลบแล้วโพสต์/ลบเองไม่ได้อีก** (409 `COMMENT_REMOVED`)
- คอมเมนต์ได้แม้ทัวร์ปิดแล้ว (`lockCompletedTournament` ยกเว้น `/comments` และ `/comments/me`) · จับสายใหม่ไม่กระทบคอมเมนต์ (ไม่ผูกแมตช์)
- **กันสแปม 5 ครั้ง/นาที ถูกเอาออก** — คนละ 1 อัน ส่งซ้ำเป็นการแก้ ไม่เพิ่มแถว จึงท่วมรายการไม่ได้อยู่แล้ว (GUIDE/06 ภาคผนวก Rate Limiting ลบแถวนี้แล้ว)

**การกำกับดูแลความเห็น** (มติ 23 ก.ย. ข้อ 6 — เดิมลบได้แต่แอดมินระบบ ซึ่งไม่มีใครเฝ้าคิว ทำให้ปุ่ม report แทบไม่มีความหมาย)
- **ผู้จัดลบความเห็นในทัวร์ตัวเองได้**: `DELETE /tournaments/:id/comments/:cid` (guard `requireOrganizer`) → 204
  - แตะได้เฉพาะ `comment` · รีวิวจากผู้ลงแข่ง / โหวต MVP → 403 `FEEDBACK_NOT_REMOVABLE_BY_ORGANIZER` (ลบการประเมินตัวเองไม่ได้ ไม่งั้นค่าเฉลี่ยเชื่อถือไม่ได้) · ไม่ใช่ของทัวร์นี้/ไม่มี → 404 `FEEDBACK_NOT_FOUND` · ลบซ้ำ → 409 `FEEDBACK_ALREADY_REMOVED`
- **กันลบคำวิจารณ์เงียบ ๆ 3 ชั้น**: `reason` บังคับ 1–255 ตัวอักษร · audit แยก action `comment_removed_by_organizer` (`details: {reason, tournamentId, authorUserId}` — แอดมินไล่ดูได้ว่าผู้จัดลบอะไรไปบ้าง) · **แจ้งเจ้าของความเห็น** (C1 type `comment_removed` พร้อมเหตุผล · ผู้จัดลบของตัวเองไม่ต้องแจ้งตัวเอง)
- **แอดมินคืนได้**: `POST /admin/feedback/:id/restore` → 200 `{id, restored}` · audit `feedback_restored` · ล้าง `is_reported` ด้วย (แอดมินตรวจแล้ว = เคลียร์เรื่อง ไม่งั้นธงค้างให้ผู้จัดมาลบซ้ำ) · ไม่ได้ถูกลบอยู่ → 409 `FEEDBACK_NOT_REMOVED`
- **แอดมินก็ต้องอยู่ในกติกาเดียวกัน** (แก้ 30 ก.ย. 2569 — เจอตอนทบทวนว่า ORG กับแอดมินทำอะไรได้บ้าง): สามชั้นข้างบนเคยบังคับกับผู้จัดเท่านั้น ส่วนแอดมินที่ลบได้กว้างกว่ากลับไม่ต้องอธิบายอะไรเลย — กลับหัวกับหลักของเราเอง
  - `DELETE /admin/feedback/:id` — **`reason` บังคับ** (เดิม `optional` ที่ทำให้ audit เก็บ `reason: null` ได้) · **breaking change กับ FE**
  - **แจ้งเจ้าของทั้งตอนลบและตอนคืน** (`feedback_removed_by_admin` / `feedback_restored`) — เดิมแอดมินลบแล้วเงียบ เจ้าของรู้ตอนส่งใหม่แล้วเจอ 409 `COMMENT_REMOVED` เท่านั้น (และรีวิว/โหวต MVP ไม่มีแม้ช่องทางนั้น)
  - ข้อความแยกคำนามตามประเปท (`feedbackNoun`) — โหวต MVP ไม่มีข้อความ จะเขียนว่า "ความเห็นของคุณถูกลบ" ไม่ได้ · คนกดลบเองไม่แจ้งตัวเอง (กติกาเดียวกับ ORG)
  - **restore แจ้งคนที่ลบไว้ด้วย** (`feedback_restore_overridden`, จาก `removed_by`) — restore คือการกลับคำตัดสินของผู้จัด แต่เจ้าตัวคำตัดสินไม่มีช่องทางรู้เลย: restore ล้าง `is_reported` ⇒ หลุดจากคิว `?reported=true` · กลับมาโผล่ปนของใหม่ · `audit_logs` ผู้จัดเปิดไม่ได้
    - ถ้าไม่แจ้ง ผู้จัดจะเข้าใจว่าเจ้าของโพสต์ซ้ำแล้วลบอีก (คอมเมนต์ที่ restore ลบซ้ำได้ทันที) ⇒ ลบ–อุทธรณ์–คืน วนได้ไม่จบ โดยทุกคนคิดว่าตัวเองทำถูก — ชนหลัก "คนตัดสินต้องมีข้อมูล"
    - ข้อความบอกให้ติดต่อแอดมินก่อนลบซ้ำ · ข้ามเมื่อ `removed_by` เป็นแอดมินคนที่ restore เอง หรือเป็นเจ้าของเอง (กันสองใบ)
    - **`restore` ยังไม่มี `reason`** (ตัดสิน 30 ก.ย.) — จะใส่ก็เป็น breaking change กับ FE อีกจุด เก็บไว้เป็นของรอบหน้า
- **ผู้จัดลบ ≠ แบนถาวร** (23 ก.ย. ทาง **ก** — เจอตอนรีวิว `backend_shokun_2`): `postTournamentComment` เดิมห้ามคนที่ความเห็นถูกลบเขียนใหม่ตลอดไป ซึ่งออกแบบไว้ตอนที่มีแต่แอดมินลบได้ · พอผู้จัดลบได้ด้วย กฎเดิมจะกลายเป็น "ผู้จัดกดปุ่มเดียว = ปิดปากคนนั้นในทัวร์นั้นถาวร" ซึ่งสวนทางกับ 3 ชั้นข้างบน
  - แยกด้วย `removed_by`: **ผู้จัดลบ → เขียนใหม่ได้** (`upsertComment(.., revive = true)` คืน `removed_at/removed_by` เป็น NULL ใช้แถวเดิม ไม่ผิด UNIQUE) · **แอดมินลบ → ห้ามเขียนใหม่เหมือนเดิม** (409 `COMMENT_REMOVED`) · `canComment` ใน E14 ตอบตามกฎเดียวกัน
  - เขียนใหม่แล้วยังไม่เหมาะสม ผู้จัดลบซ้ำได้ (เจ้าของถูกแจ้งทุกครั้ง + audit ทุกครั้ง) · ถ้ากวนซ้ำ ๆ เป็นเรื่องที่แอดมินจัดการที่ระดับผู้ใช้ ไม่ใช่ให้ผู้จัดแบนเอง
  - ธง `is_reported` ไม่ถูกล้างตอน revive (ต่อเนื่องกับ OD-23 ข้อ 3) — ล้างเฉพาะตอนแอดมิน restore
- **ผู้จัดมีปุ่ม "ตรวจแล้ว ไม่เป็นไร"** (มติ 30 ก.ย. 2569 · `POST /tournaments/:id/comments/:cid/dismiss` → 200 `{id, isReported:false}`)
  - เดิม `is_reported` ล้างได้ที่เดียวคือ `restore` ของแอดมิน ⇒ ของที่ผู้จัดตรวจแล้วเห็นว่าปกติ **ค้างในคิวตลอดไป** ⇒ ทางเดียวที่คิวจะว่างคือลบ ซึ่งเป็นแรงกดให้ลบของที่ไม่ควรลบ — สวนทางกันกับ 3 ชั้นที่กันลบพร่ำเพรื่อข้างบน
  - **ไม่ต้องใส่เหตุผล** — การปล่อยผ่านคือด้านอนุรักษ์ เหตุผลบังคับมีไว้กันการลบเงียบ ๆ ไม่ใช่การไม่ลบ · แต่ audit มีทุกครั้ง แอดมินไล่ดูได้ว่าผู้จัดปล่อยอะไรผ่าน
  - **★ ไม่แจ้งเจ้าของคอมเมนต์** — ธง report เป็นความลับของคนที่ลบได้ (ข้อ 6.4 ข้างบน) การแจ้งตอนปล่อยผ่านเท่ากับเปิดเผยว่าเคยมีคนรายงาน
  - เงื่อนไข `is_reported = TRUE` อยู่ใน `UPDATE` เอง ⇒ สองคนกดพร้อมกัน คนที่สองได้ 409 ไม่ใช่ audit ซ้ำสองแถว
  - **ปิดช่องแล้ว (30 ก.ย. — FE ขอ)**: path เป็น `/dismiss-report` ตามที่ FE ขอ และ**แอดมิน `university_wide` กดได้ด้วย**
    ด่านย้ายจาก `requireOrganizer` มาอยู่ใน service ใช้**เงื่อนไขเดียวกับ `canModerate` ของ E14** — คนที่เห็นคิวกับคนที่กดได้จึงแยกกันไม่ได้
    (เป็นสาเหตุเดิมของ `FE-admin-queue-shows-undecidable-rows`: คิวกับด่านใช้เงื่อนไขคนละชุด)
- **จำว่าตรวจแล้ว ไม่ใช่จำแค่ว่าค้างอยู่** (มติ 30 ก.ย. 2569 · migration 032 `report_cleared_at`)
  - ปัญหาของ dismiss เพียงล้างธง: `is_reported` ตอบได้แค่ว่า **ตอนนี้มีเรื่องค้างหรือไม่** ⇒ พอปล่อยผ่านแล้วใครกด report ใหม่ ธงขึ้นอีก ผู้จัดถูกแจ้งอีก
    คนกลุ่มเดิมส่งเรื่องเดิมซ้ำได้ไม่จำกัด ทั้งที่ตัดสินไปแล้วว่าไม่มีมูล — ปุ่ม dismiss จึงเกือบไม่มีความหมาย
  - **ทุกความเห็นตั้งต้นที่ "ยังไม่ตรวจ"** (`report_cleared_at IS NULL`) · dismiss → จำว่าตรวจแล้ว · report ซ้ำตอนตรวจแล้ว = ไม่ส่งเรื่องใหม่
  - **เจ้าของแก้ข้อความ → กลับเป็นยังไม่ตรวจ** (`upsertComment` ล้าง) — สิ่งที่ผู้จัดตรวจผ่านคือข้อความนั้น ไม่ใช่แถวนั้น
    ไม่กลับ = เขียนดี → ถูก report → ผู้จัดปล่อยผ่าน → แก้เป็นข้อความแย่ ⇒ **รายงานไม่ขึ้นอีกตลอดกาล** — ช่องเดียวกันกับที่มติ 23 ก.ย. ข้อ 5-ก กันไว้ตอนนั้น
  - **คืนค่า `{ id, isReported: true }` เสมอ แม้เรื่องจะไม่ขึ้น** — คนกดต้องแยกสองกรณีไม่ออก ไม่งั้นกลายเป็นการบอกสถานะกำกับดูแลให้คนนอก (ต่อเนื่องข้อ 6.4)
    คุ้มกว่าเปลี่ยนเป็น `isReported: false` ที่ตรงตามซี่งจะบอกคนกดว่าเรื่องนี้ผ่านการตรวจไปแล้ว · นัดนั้นหมายว่า "รับเรื่องแล้ว"
  - **ที่ตัดสินเอง (บอกไว้)**: `restore` ของแอดมินก็ตั้ง `report_cleared_at` ด้วย — แอดมินคืนของที่ผู้จัดลบ คือการตรวจแล้วว่าข้อความอยู่ต่อได้ ถ้าไม่จำ คนที่เคย report ส่งเรื่องเดิมซ้ำได้ทันที วนกลับเข้าลูป ลบ–อุทธรณ์–คืน อีกครั้ง
  - ผู้จัดที่เป็นแอดมินด้วย แล้วลบผ่านเส้นแอดมินในทัวร์ตัวเอง จะนับเป็น "ผู้จัดลบ" เพราะ `removed_by` ตรงกับ `requested_by_user_id` — ยอมรับได้ (ผ่อนปรนฝั่งผู้ใช้)
- **report แล้วแจ้งผู้จัด**: `POST /feedback/:id/report` ของ `comment` → แจ้ง ORG ของทัวร์ (C1 type `comment_reported`) **เฉพาะครั้งแรกที่ธงถูกตั้ง** (คนที่ 2, 3 กดซ้ำไม่แจ้งอีก) · ผู้จัดกด report เอง ไม่แจ้งกลับหาตัวเอง · ธง `is_reported` ยังเก็บไว้ให้แอดมินเหมือนเดิม
- **ผู้จัดต้องเห็นว่าอันไหนถูกรายงาน** (23 ก.ย. ทาง **ข** — เจอตอนรีวิว: แจ้งเตือนไปแล้วแต่รายการคอมเมนต์ไม่มีอะไรบอกว่าอันไหน ผู้จัดต้องไล่อ่านเองทั้งหน้า)
  - `isReported` โผล่ใน item ของ E14 **เฉพาะผู้จัดของทัวร์นั้นกับแอดมิน `university_wide`** (ตอบ `canModerate` มาด้วย) · คนทั่วไปไม่มีฟิลด์นี้ — ไม่งั้นกลายเป็นตราประจานที่ใครก็ตั้งให้คนอื่นได้ด้วยการกด report
  - `?reported=true` = คิวตรวจ (กรองที่ SQL ทั้ง rows และ COUNT) · คนอื่นเรียก → 403 `NOT_ORGANIZER`
  - **แจ้งเตือน `comment_reported` ยังชี้ที่ทัวร์ ไม่ใช่ที่คอมเมนต์**: ตาราง `notifications` มี `related_entity_type/id` คู่เดียว ถ้าเปลี่ยนไปชี้ `tournament_feedback` FE จะไม่มี tournamentId ไว้สร้างลิงก์ และไม่มี `GET /feedback/:id` ให้ถามต่อ → ให้ FE เปิดหน้าทัวร์แล้วต่อ `?reported=true` เอา

**Pick'em**
- **cutoff**: แมตช์ออกจาก `scheduled` (เปิดเช็คอิน) **หรือ** ถึง `scheduled_time` อย่างไหนถึงก่อน → 409 `PICKEM_CLOSED {reason}` · ยังไม่รู้คู่ → 409 `PICKEM_TEAMS_NOT_SET` · ผู้จัดปิดเช็คอิน (M18) แมตช์กลับเป็น scheduled → ทายได้อีก
- **แต้ม**: ถูก 10 · ผิด 0 · ให้แต้มเฉพาะผลที่ยืนยันแล้ว (spec 08 §6) — settle ใน `applyOutcomeTx` / คืนแต้มใน `undoOutcomeTx` (ทรานแซกชันเดียวกับผล) จึงถูกต้องทั้ง S02 verify, S04 uphold/reject/amend, ส่งผลใหม่หลัง reject · ชนะบาย/ปรับแพ้/แมตช์ตาย = **void** (ไม่ได้ไม่เสีย)
- **ห้ามทาย**: คนในทัวร์ทั้งหมด (ผู้เล่นในรายชื่อ · สมาชิกทีมที่ผ่าน · กรรมการ · ผู้จัด) → 403 `PICKEM_CONFLICT` — กฎเดียวกับโหวต MVP
- ทาย/เปลี่ยน/ยกเลิกได้จนถึง cutoff (คนละ 1 การทายต่อแมตช์) · แต้มรวมเก็บที่ `users.total_points` · อันดับในทัวร์เสมอได้ (1,1,3)
- **ทัวร์ต้อง `public`** (22 ก.ย.): ORG unpublish กลับเป็น private แล้ว ทาย/ยกเลิก → 409 `TOURNAMENT_NOT_PUBLIC` · summary `closedReason: 'tournament_not_public'` (เหตุผลของแมตช์มาก่อน เช่นแมตช์จบแล้วบอก `match_started`) · อ่านสรุปได้เหมือนหน้าแมตช์
- ไม่แจ้งเตือนผลทาย (ถูก/ผิด) — ดูได้ที่ `GET /me/pickem` (ตัดสิน 22 ก.ย. กันแจ้งเตือนรก)
- **จับสายใหม่** (22 ก.ย.): การทายของแมตช์เดิมถูกลบตามแมตช์ (เหมือนเดิม) + **แจ้ง `pickem_cancelled` ให้ทุกคนที่ทายไว้ในทัวร์นั้น** (คนละ 1 อัน) ว่าทายใหม่ได้ในสายใหม่ — อ่านรายชื่อใน tx ก่อนลบ ส่งหลัง commit
- ไม่แตะตาราง `rewards` (ยังไม่มี spec)

## OD-25 — More notifications (C1 follow-up) — ✅ Resolved 2026-09-22

ทวน C1 แล้วพบ event ที่คนควรรู้แต่ยังเงียบ — ตัดสิน 22 ก.ย.: เพิ่ม 2 เรื่อง (ปิดเช็คอิน / ปิดทัวร์ ยังไม่เพิ่ม)

- **`match_walkover`** — ทุกแมตช์ที่จบโดยไม่มีการแข่ง **รวมลูกโซ่**: ถอนตัว (P08), ถอนทั้งคู่, เช็คอินไม่ครบตอนกรรมการกด start (M10), ORG ตัดสินไม่มาตามนัด ฝั่งเดียว/แพ้ทั้งคู่ (M17), บายต่อเนื่อง (dead slot), แมตช์ตาย
  - ผู้รับ: **สมาชิกทุกคนของทั้งสองทีมในแมตช์** (`team_members` + หัวหน้า — ไม่ใช่แค่รายชื่อลงแข่ง) + **ORG** + กรรมการที่รับแมตช์นั้น (จะได้ไม่มาเก้อ) · ตัดคนซ้ำ · **ไม่ส่งหาคนที่กดเอง** (กรรมการที่กด start / ORG ที่กด forfeit) · บายต่อเนื่องที่ตามมา ORG ได้ด้วย (ไม่ได้กดเอง) · หัวหน้าทีมที่ถอนได้ด้วย (รู้ว่าแมตช์ไหนถูกตัดสิน)
  - ข้อความใส่ชื่อทีม + เหตุผล · ชี้ไปแมตช์ (`related_entity_type = 'match'`) · ส่งเฉพาะเมื่อ walkover บันทึกจริง (`applyWalkover` คืน `false` ถ้าแมตช์เริ่มไปก่อน) · แจ้งพังไม่ทำให้ walkover พัง
- **`referee_removed`** — ถอดกรรมการ
  - ออกจากแมตช์ (F13): รับแมตช์แล้ว → "คุณถูกถอดจากกรรมการแมตช์" · แค่ถูกเสนอ (pending) → "ผู้จัดถอนแมตช์ออกจากคำเชิญ" · ปฏิเสธแมตช์ไปแล้ว → ไม่แจ้ง
  - ออกจากทัวร์ (F03): ตอบรับแล้ว → "คุณถูกถอดจากกรรมการทัวร์นาเมนต์" · ยังไม่ตอบ → "คำเชิญเป็นกรรมการถูกยกเลิก" · ปฏิเสธไปแล้ว → ไม่แจ้ง
- **`bracket_redrawn`** (ตามมาจาก `referee_removed`) — จับสายใหม่ลบ `match_referees` ของแมตช์เดิม → กรรมการที่รับ/ถูกเสนอแมตช์เดิม (ยังไม่ถูกถอด) ได้แจ้งว่าแมตช์ถูกยกเลิก รอมอบหมายใหม่
- **`bracket_created` / `bracket_redrawn` ถึงทีม** (ตัดสินเพิ่ม 22 ก.ย.) — สายออกครั้งแรก และจับสายใหม่ (คู่แข่งเปลี่ยน · เวลาที่นัดไว้เดิมหาย) → ผู้เล่นในรายชื่อลงแข่ง + หัวหน้าทีม ของทุกทีมที่ผ่าน · ORG (คนกด) ไม่ได้ · ส่งหลังสร้างสายสำเร็จเท่านั้น
- **`pickem_cancelled`** — ดู OD-24 (จับสายใหม่)

## OD-26 — ปิดจุดที่แมตช์/ทัวร์ค้างในระบบส่งผล–ยืนยันผล — ✅ Resolved 2026-09-27 (ตัดสินครบ 25–27 ก.ย. 2569 · ทำครบ 4 ก้อน)

ระบบมีจุดที่ทำให้ทัวร์ปิดไม่ได้ถาวร 3 จุด — `in_progress` ไม่มีใครส่งผล · `submitted` ไม่มีใคร verify · `disputed` ผู้จัดไม่ตัดสิน — โดยจุดแรกวันนี้ไม่มีทางออกใด ๆ แม้แต่แอดมิน
หลักที่ยึดตลอดการตัดสิน 2 ข้อ: **การนิ่งเฉยต้องไม่มีอำนาจยับยั้ง** และ **คนตัดสินต้องมีข้อมูลและไม่ใช่คู่กรณี** (จึงไม่ให้ผู้จัดกรอกผลแบบไม่มีเงื่อนไขนำ และไม่ใช้ชั้นสำรองที่ต้องรอทีมแพ้กดยอมรับ เพราะทีมแพ้ได้ประโยชน์จากการถ่วง)

**ทำแล้ว (ก้อนที่ 1)**
- **ข้อ 1 · ห้ามเดินหน้าทับแมตช์ต้นทางที่ยังไม่สรุป** — M09 บล็อกเมื่อทีมไม่ครบ (`MATCH_TEAMS_INCOMPLETE`) และเมื่อต้นทางยัง `disputed` (`PREDECESSOR_DISPUTED`) พร้อม `blockedBy` บอกว่าติดแมตช์ไหนเพราะอะไร · เหตุผลของเงื่อนไขที่สอง: เดิมพอเปิดเช็คอินแมตช์ถัดไป ผู้จัดจะเสียสิทธิ์ `reject`/`amend` ต้นทางทันที (`NEXT_MATCH_STARTED`) ทั้งที่ยังตัดสินไม่เสร็จ · S12 เพิ่ม `isProvisional` + `pendingMatches` เพราะ round robin ทุกแมตช์ป้อนตารางเดียวกัน แมตช์เดียวที่ค้างสลับอันดับได้ทั้งตาราง
- **ข้อ 3 · เส้นตายการค้านที่เป็นความจริง** — S05 คืน `disputeClosesAt` + `resultChangeable` · เดิมสัญญา 24 ชม.แต่ใน elimination ตายทันทีที่แมตช์ถัดไปเปิดเช็คอิน ผู้ใช้ไม่มีทางรู้จนกดแล้วเจอ 409
- **ข้อ 9 · `dispute_window_hours` ที่ตั้งค่าไม่ได้** — C01 รับ `disputeWindowHours` 6–72 ชม. (คอลัมน์มีอยู่แล้ว ไม่มี migration) · เดิมทุกทัวร์ติดค่า default 24 เพราะไม่มี endpoint ไหนเซ็ตได้เลย

**ทำแล้ว (ก้อนที่ 2 · migration 026)**
- **ข้อ 4 · ขั้น "จบการแข่งขัน" แบบบังคับ** — สถานะใหม่ `finished` + `started_at`/`actual_end_time` · `POST /matches/:id/finish` กดได้ทั้งกรรมการของแมตช์และ ORG (Q4b — ข้อนี้คือสิ่งที่ทำให้การบังคับไม่กลายเป็นจุดค้างใหม่เมื่อกรรมการหายไป) · เลือกแบบบังคับแทนแบบนุ่มเพราะ MVP รายแมตช์และนาฬิกาของข้อ 6/7 ต้องมีเวลาจบจริงเสมอ ถ้าไม่บังคับจะมีแมตช์ที่ไม่มีค่านี้ตลอดไป
- **ข้อ 2 · ส่งผลก่อนแข่ง** — S01 ต้องอยู่ที่ `finished` (หรือ `result_rejected` ที่แข่งจบไปแล้วจริง) · เดิมด่านนี้ไม่เช็ค `match_status` เลย ส่งผลแมตช์ที่ยัง `scheduled` ก็ยังได้ และไม่เคยมีเทสคุมด่านนี้
- **ข้อ 5 · `submitted_at`** — `created_at` ไม่ขยับตอนส่งซ้ำหลัง reject (ON DUPLICATE KEY UPDATE ไม่แตะ) นาฬิกา auto-verify จะนับจากครั้งแรกซึ่งผิด
- ไล่แก้จุดที่เช็ค `in_progress` ตรง ๆ: ถอนตัวระหว่าง `finished` ก็ยังทำไม่ได้ (`hasInProgressMatch`) · `finished` นับว่า "แข่งจริงแล้ว" สำหรับสิทธิ์รีวิว (`hasPlayedMatch`) · ตรวจเช็คอินยังจำกัดที่ `checkin_open`/`in_progress` เหมือนเดิม (จบแล้วตรวจย้อนไม่ได้)
- **ก้อน 3** ข้อ 6: ไม่มีใครส่งผล → บันได กรรมการส่งแทน → ORG เลือก `แพ้ทั้งคู่` หรือ `กรอกผล + ป้าย "กรอกโดยผู้จัด"` (ช่องว่างในสายใช้ `dead_slot`/`dead_match` เดิม) · ข้อ 7: auto-verify เมื่อไม่มีใครค้านภายใน Y แบบ lazy ไม่ต้องมี scheduler · ข้อ 10: ORG มี 48 ชม.ตัดสิน ครบแล้ว**แอดมินกดได้ด้วย** (เพิ่มคนที่กดได้ ไม่ใช่โอนอำนาจ) จำเป็นเพราะรอบชิง/round robin ไม่มีแมตช์ถัดไปให้บล็อก ถ้า ORG หายไปทัวร์ค้างตลอดกาล พ่วง MVP ไม่เปิด รีวิวไม่ปิด ไม่มีแชมป์ `championships` ไม่ขึ้น
- **ก้อน 4** ข้อ 8: ค้านหลังสายเดินแล้ว **ไม่เข้า `disputed`** เป็น "เรื่องร้องเรียน" ที่ไม่เปลี่ยนผล · ยื่นได้เฉพาะก่อนปิดทัวร์ · ORG แนบความเห็นได้ 48 ชม. **ปัดตกไม่ได้** แล้วขึ้นแอดมินอัตโนมัติ · เรื่องผูกกับผลแมตช์ ไม่ใช่ตัว ORG · บันทึกเฉพาะคนยื่นเมื่อแอดมินตัดสินว่าไม่มีมูล · (ทำแล้วในก้อนที่ 4 — ดูท้ายหัวข้อ)

**ทำแล้ว (ก้อนที่ 3 · migration 027)**
- **ข้อ 6 · ไม่มีใครส่งผลเลย** — บันได 2 ขั้น: พ้น `SUBMIT_ESCALATION_HOURS` (24 ชม.นับจากเวลาจบจริง) → **กรรมการของแมตช์ส่งแทนได้** รวมโหมด online ที่ปกติมีแต่หัวหน้าทีมส่งได้ (ยังเป็นกรรมการส่ง–อีกฝ่ายยืนยัน ไม่เสียหลัก "คนส่ง ≠ คนยืนยัน") → ยังเงียบ → `POST /matches/:id/result/organizer` ผู้จัดเลือก `result` (ติดป้าย `submittedRole:'organizer'` ถาวร + เหตุผลลง audit) หรือ `double_forfeit` (สมมาตร ไม่มีใครได้ประโยชน์ จึงไม่มีประเด็นความโปร่งใส) · **แก้ 27 ก.ย.: `double_forfeit` ใช้ได้เฉพาะโหมด online** — onsite มีกรรมการที่ผู้จัดแต่งตั้งและอยู่หน้างานตาม BR-10 การไม่มีผลส่งจึงเป็นความบกพร่องของฝั่งผู้จัด/กรรมการ ไม่ใช่ของทีมที่ลงแข่งครบแล้ว จะเอาความผิดของตัวเองไปปรับแพ้ทั้งสองทีมไม่ได้ ต้องบันทึกผลตามที่แข่งจริง (กรอกผิดทีมยังโต้แย้งได้) · online คนส่งคือหัวหน้าทีมและกรรมการก็ส่งแทนได้แล้วตั้งแต่ขั้นแรก เงียบทั้งคู่จึงเป็นความบกพร่องของทีมเอง · ช่องว่างในสายใช้ `dead_slot`/`dead_match` เดิม
- **ข้อ 7 · ไม่มีใคร verify** — auto-verify เมื่อพ้น `min(ก่อนแมตช์ถัดไปเริ่ม 15 นาที, 24 ชม.หลัง submitted_at)` เช็คแบบ lazy ตอนเปิดเช็คอินแมตช์ถัดไปและตอนปิดทัวร์ **ไม่ต้องมี scheduler** · ★ **ใช้เฉพาะแมตช์ที่กรรมการเป็นคนส่งผล** — โหมด online คนส่งคือหัวหน้าทีมซึ่งเป็นคู่กรณี ถ้า auto ให้ด้วยจะเท่ากับรับรองคำอ้างของฝ่ายหนึ่งโดยไม่มีคนกลางรับรองเลย (เคสนั้นให้ไปใช้บันไดข้อ 6) · `verified_by_user_id = NULL` คือร่องรอยว่าระบบยืนยันให้ (ไม่เขียน audit_logs เพราะ user_id เป็น NOT NULL + FK ไป users)
- **ข้อ 10 · ผู้จัดไม่ตัดสินข้อโต้แย้ง** — `requireCanResolveDispute`: ผู้จัดกดได้เสมอ · แอดมิน `university_wide` กดได้เมื่อพ้น `ORG_RESOLVE_HOURS` (48 ชม.นับจากเวลาที่ยื่นค้าน) ก่อนหน้านั้น 403 `ORGANIZER_STILL_HAS_TIME` พร้อม `availableAt` · **เพิ่มคนที่กดได้ ไม่ใช่โอนอำนาจ** — ผู้จัดยังกดได้ตลอด ใครถึงก่อนได้ก่อน · ส่วนด่านกันสายเดินทับข้อโต้แย้งอยู่ในข้อ 1 แล้ว
- **คุณภาพของข้อโต้แย้ง** (เพิ่มระหว่างทาง) — `reason` บังคับ 1–1000 ตัวอักษร (เดิมสตริงว่างก็ผ่าน) · เสนอผลที่ถูกต้องมาด้วยได้ (`dispute_claimed_winner_team_id` / `dispute_claimed_score` ตรวจด้วย `ensureScoreData` ตัวเดียวกับตอนส่งผล) · แนบหลักฐานได้ ≤5 ไฟล์ (`dispute_evidence`, upload purpose ใหม่ `dispute_evidence`, คืนเป็น presigned URL เสมอ) · เพิ่ม `GET /matches/:id/result/dispute` เพราะข้อมูลชุดนี้เดิมเก็บลงฐานข้อมูลแต่ **ไม่มี endpoint ไหนคืนออกมาเลย** ผู้จัดเห็นแค่ข้อความในแจ้งเตือน
- **การถอนตัวกับประวัติรายชื่อ** (เพิ่มระหว่างทาง) — ถอนตัวตอนทัวร์ยังไม่เริ่มแข่ง (`hasPlayedMatch` เป็น false) ลบ `application_players` เหมือนเดิมเพื่อปลด UNIQUE ให้สมัครใหม่/ย้ายทีมได้ (A1) · **ถอนหลังทัวร์เริ่มแข่งแล้ว เก็บรายชื่อไว้** เพราะมีประวัติเกิดขึ้นแล้ว และ UNIQUE ที่ค้างอยู่ไม่ทำร้ายใคร (ตอนนั้นสมัครใหม่ไม่ได้อยู่แล้ว และคนที่ลงแข่งให้ทีมหนึ่งไปแล้วก็ไม่ควรไปเล่นให้อีกทีมในทัวร์เดียวกัน) · `findLineupsByMatch` รวมใบที่ `withdrawn` ด้วยและตอบ `withdrawn: true` ให้ FE ติดป้าย — ไม่งั้นต่อให้เก็บแถวไว้รายชื่อก็ยังหายจากหน้าแมตช์ · UNIQUE ผูกกับทัวร์ จึงไม่กระทบการลงทัวร์อื่น

**ทำแล้ว (ก้อนที่ 4 · migration 028)**
- **ข้อ 8 · ค้านตอนที่สายเดินไปแล้ว** — เส้นใหม่ "เรื่องร้องเรียนผลแมตช์" (`match_result_complaints`) คนละเส้นกับ dispute เดิม · เปิดเฉพาะเมื่อประตู S03 ปิดสนิทแล้ว (ผลบายเปิดได้เสมอเพราะ S03 ค้านผลบายไม่ได้เลย) จึงไม่มีสองประตูซ้อนกัน · **ไม่แตะ `match_status` และไม่แตะ `match_results`** — นี่คือเหตุผลทั้งหมดที่ต้องมีตารางใหม่ ถ้าใช้ `disputed` เรื่องเดียวจะแช่ทั้งทัวร์ที่จบไปแล้ว · ยื่นได้เฉพาะก่อนปิดทัวร์ (บังคับด้วยการวาง route ใต้ `/matches/:id` ให้ `lockCompletedTournament` ปิดเอง) ส่วน route แนบความเห็น/วินิจฉัยอยู่นอก prefix นั้น จึงเดินต่อได้หลังทัวร์ปิด — ไม่ต้องแก้ middleware เลย
- **นาฬิกาเรือนเดียว** — `created_at + ORG_RESOLVE_HOURS` (48 ชม.) คือทั้งเส้นที่ผู้จัดควรเขียนความเห็นให้ทันและเส้นที่แอดมินเข้ามาวินิจฉัยได้ จึง**ไม่มีสถานะ `escalated`** ในตารางและไม่ต้องมี scheduler · `stage` (`organizer` / `admin` / `decided`) คิดจากเวลาตอนอ่าน ไม่มีคอลัมน์ให้ใครลืมอัปเดต
- **ผู้จัดปัดตกไม่ได้โดยดีไซน์** — ไม่มีคอลัมน์และไม่มี route ไหนให้ผู้จัดปิดเรื่อง มีแค่ `organizer_statement` · ถ้าปัดตกได้ ผู้จัดที่เป็นคู่กรณีเองก็ปัดทิ้งทุกเรื่อง · ผู้จัดเขียนช้ากว่า 48 ชม.ได้ แต่ติดป้าย `organizerStatement.late` — ความเห็นที่มาช้ายังมีประโยชน์กับผู้วินิจฉัยมากกว่าไม่มีเลย
- **ใครยื่นได้ / ใครอ่านได้** — ยื่นได้: หัวหน้าทีมสองฝ่าย + กรรมการของแมตช์ (ชุดเดียวกับผู้ที่โต้แย้งได้) · 1 คน 1 เรื่องต่อผล ยื่นซ้ำ = แก้ของเดิม (`uq_complaint_result_filer`) แต่รีเซ็ตเรื่องที่ตัดสินแล้วไม่ได้ · อ่านได้: คู่กรณี + ผู้จัด + แอดมิน เท่านั้น ไม่ใช่ของสาธารณะเพราะพกหลักฐานและข้อกล่าวหาถึงตัวบุคคล
- **ผลของคำวินิจฉัย (มติ 27 ก.ย.)** — แอดมินเลือก `record_only` (บันทึกไว้เป็นหลักฐาน ไม่แก้ผล) หรือ `amend_result` (แก้จริงผ่านเส้นทาง amend เดิมทั้งเส้น) เอง เพราะเป็นคนเดียวที่เห็นว่าสายเดินไปไกลแค่ไหน — บังคับแก้หรือบังคับไม่แก้ทั้งสองทางมีเคสที่พัง · `amend_result` ถูกปฏิเสธด้วย `RESULT_NOT_CHANGEABLE` + `blockedBy` เมื่อแมตช์ถัดไปขยับแล้ว (`NEXT_MATCH_STARTED`) · ทัวร์ปิดแล้ว (`TOURNAMENT_COMPLETED` — มีแชมป์และนับ `championships` ไปแล้ว แก้ย้อนจะทำให้ตัวเลขนั้นโกหก) · หรือผลเป็นบาย (`RESULT_NOT_AMENDABLE` — ไม่มีสกอร์จริงให้แก้) · S13b/S13c คืน `canAmendResult` ให้ผู้ตัดสินรู้ล่วงหน้า ไม่ใช่ให้กดแล้วเจอ 409
- **เรื่องค้างกับการปิดทัวร์ (มติ 27 ก.ย.)** — เรื่องค้างไม่บล็อกการปิดทัวร์ (นั่นคือจุดประสงค์ของเส้นนี้) แต่ C07 ติดธง `hasOpenComplaints` ไว้ ไม่งั้นทัวร์ที่ยังมีเรื่องค้างดูเหมือนจบเรียบร้อยทั้งที่ยังไม่เรียบร้อย
- **บันทึกเฉพาะคนยื่น** — `filer_flagged` ติดเฉพาะเมื่อแอดมินวินิจฉัยว่า `no_merit` · ไม่ติดผู้จัดและไม่ติดกรรมการ เพราะเรื่องผูกกับ**ผลแมตช์** ไม่ใช่ตัวบุคคล · schema กันไว้ว่าเรื่องที่ไม่มีมูลจะแก้ผลไปด้วยไม่ได้ (ขัดกันเอง)
- **ไม่ใช้ `user_reports`** — ถามแล้ว (27 ก.ย.): ตารางนั้นทำไว้สำหรับรายงาน**ผู้ใช้**อย่างเดียว `target_user_id` เป็น NOT NULL + FK ไป `users` ถ้ายัดลงไปต้องใส่ user ของผู้จัดเป็นเป้า = ขัดมติ "เรื่องผูกกับผลแมตช์" ตรง ๆ และไม่มีที่เก็บผลที่เสนอ/ความเห็นผู้จัด

## OD-68 — เทส 27 ไฟล์ล้มทั้งไฟล์ถ้าไม่มี `backend/.env` — ✅ ทำแล้ว 2026-10-05

**มีอยู่ก่อนงานเหรียญ ไม่เกี่ยวกับใคร** — เจอเพราะไปรวม branch ใน worktree แยก ซึ่งไม่มี `.env`
ซึ่งเป็นสภาพเดียวกับ **clone ใหม่** เป๊ะ

### อาการ

```
Error: Missing require environment variable DB_HOST
 ❯ requireEnv  src/config/env.ts:6
 ❯ src/services/upload.service.ts:5
 ❯ src/services/team.service.ts:6
```

`config/env.ts` เรียก `requireEnv()` **ตอน import** ⇒ โมดูลโหลดไม่ผ่าน

```
⇒ เทส 27 ไฟล์ "ล้มทั้งไฟล์" (0 test รัน) ไม่ใช่ล้มเป็นเทส ๆ
⇒ ไฟล์ที่ล้มไม่เกี่ยวกับ env เลย เช่น team.service.test — มันแค่ import ต่อ ๆ กันไปถึง env.ts
⇒ ข้อความไม่ได้บอกว่าต้องสร้าง .env ก่อน
```

🔴 `.env` อยู่ใน `.gitignore` ⇒ **เพื่อนร่วมทีมที่ clone ใหม่แล้วรัน `npm test` เจอทันที 27 ไฟล์แดง**
และจะเข้าใจว่าโค้ดพัง ไม่ใช่เข้าใจว่าตัวเองยังไม่ได้ตั้งค่า

### ✅ ที่ทำ — เติมค่า env ขั้นต่ำในไฟล์ setup ของ vitest

```
import 'dotenv/config';          ← อยู่บนสุด: เครื่องที่มี .env ค่าจริงถูกโหลดก่อน
process.env[key] ??= fallback;   ← เติมแค่ช่องที่ยังว่าง
```

★ **เครื่องที่ตั้งค่าไว้แล้วไม่เปลี่ยนพฤติกรรมเลยแม้แต่ตัวเดียว** — `??=` ไม่ทับของเดิม
และ `dotenv` ถูกเรียกก่อน ไม่ใช่หลัง (ถ้าสลับลำดับ ค่าปลอมจะชนะค่าจริง เพราะ dotenv ไม่ override)

ค่าที่ใส่ตั้งใจให้ดู **ปลอมอย่างชัดเจน** (`no-db.invalid`, `test-user-never-used`)
ไม่ใช่ `localhost` ที่อ่านแล้วเข้าใจผิดว่าเป็นค่าใช้งานจริง

🔴 ไม่ได้แปลว่าเทสต่อฐานได้ — ด่าน OD-62 ยังบล็อก MySQL/S3/SMTP ทั้งหมด
สองอย่างนี้แก้ปัญหาต่างกัน: **อันนี้ทำให้ "โหลดโมดูลได้" · อันนั้นทำให้ "ออกไปข้างนอกไม่ได้"**

### ยืนยัน

```
ลบ .env ออกชั่วคราว  →  148 ไฟล์ / 2876 เทส ผ่าน   (เดิม 27 ไฟล์ล้มทั้งไฟล์)
คืน .env กลับ        →  148 ไฟล์ / 2876 เทส ผ่าน   เลขเท่ากัน = ไม่กระทบเครื่องที่ตั้งค่าแล้ว
```

`.env.example` ตรวจแล้วมีตัวแปรที่ `requireEnv` ต้องใช้ครบทั้ง 13 ตัว ⇒ ไม่ต้องแก้

## OD-67 — เหรียญสายสถิติต้องประเมินที่ amend ด้วย ไม่ใช่แค่ตอนปิดทัวร์ — ✅ ทำแล้ว 2026-10-05

ต่อยอดจาก OD-64 (งานของ Punnawich) · เจ้าของงานถามว่า "ถ้ากลับไปแจกตอนปิดทัวร์เฉย ๆ จะจบทุกปัญหาไหม"

### คำตอบ: จบ 4 จาก 5 กรณี

```
ปฏิเสธผล (wins 10→9)   ✅ จบ — เกิดก่อนปิดทัวร์ ⇒ ยังไม่เคยแจก ไม่มีอะไรค้าง
amend สลับผู้ชนะ        ✅ จบ — เหมือนกัน ตอนปิดทัวร์อ่านสถิติสุดท้ายซึ่งถูกแล้ว
championships ลด        ✅ ไม่มีทางเกิด — ไม่มี endpoint ยกเลิกการปิดทัวร์
แอดมินปิดเหรียญ          ✅ ไม่เกี่ยวกับจังหวะแจก
```

★ เหตุผลที่มันจบ: **ปิดทัวร์ได้ต้องให้ทุกแมตช์ `completed` ก่อน** ⇒ ตอนประเมิน สถิติเป็นค่าสุดท้ายแล้ว

### 🔴 กรณีที่เหลือ — S13e ทำงานหลังปิดทัวร์ได้ **โดยเจตนา**

`matchResultComplaint.routes.ts` เขียนบอกไว้เองว่า `/match-result-complaints/:id` อยู่นอก prefix
ของ `lockCompletedTournament` → **ทำได้แม้ทัวร์ปิดแล้ว** (มติ: เรื่องที่ค้างต้องเดินต่อให้จบ)

```
POST /match-result-complaints/:id/decision   remedy = 'amend_result'
  → amendFromComplaint() → amendMatchResult() → เดินเส้น amend เดิมทั้งเส้น (ลด player_profile_stats)
```

```
ผู้ชนะเดิม wins -1   ← ถือเหรียญ "ชนะ 10 แมตช์" ค้างทั้งที่เหลือ 9
ผู้ชนะใหม่ wins +1   ← ครบเกณฑ์แต่ไม่มีใครแจก และ จะไม่มีใครแจกตลอดไป (ทัวร์ปิดแล้ว ไม่มี hook เหลือ)
```

★ อันหลังหนักกว่า — เหรียญค้างยังแก้ทีหลังได้ แต่เหรียญที่ควรได้แล้วไม่มีใครแจกคือ **หายถาวร**

### ✅ ที่ทำ — ทางเลือก ก (มติ 5 ต.ค.)

```
grantStatRewardsForTournamentTx  →  evaluateStatRewardsForTournamentTx(conn, tournamentId)
   แจก + ริบ ในฟังก์ชันเดียว · ตัด sportTypeId ออก (ดู ★ ข้างล่าง)
เรียกจาก 2 จุด: completeTournament (จังหวะปกติ) · amendMatchResult (จังหวะซ่อม)
```

ไม่เลือก "ประเมินทุกแมตช์" เพราะต้องยิง query ถี่กว่าโดยได้ผลเท่ากัน
🔴 ข้อแลกที่รับไว้: ผู้ใช้เห็นเหรียญช้า — ชนะครบ 10 กลางทัวร์ต้องรอทัวร์ปิด

### 🔴 ★ กับดักที่เจอตอนทำ — ริบข้ามกีฬา

ของเดิมกรอง `s.sport_type_id = ?` ด้วยกีฬาของทัวร์ที่กำลังประเมิน · ถ้าเอามาใช้ริบตรง ๆ:

```
คนได้เหรียญ "ชนะ 10 แมตช์" จากฟุตบอล  →  จบทัวร์บาส  →  สถิติบาสชนะ 2  →  ถูกริบ
```

เหรียญเป็นของ**ระดับบัญชี** (`UNIQUE user_id, reward_id`) ไม่ใช่รายกีฬา ⇒ เงื่อนไขต้องเป็น
"มีกีฬาใดกีฬาหนึ่งถึงเกณฑ์" = `EXISTS (... >= gte)` โดยไม่ล็อก `sport_type_id`

คำว่า "ในกีฬาเดียวกัน" ในคำอธิบายเหรียญยังจริง เพราะแต่ละแถวของ `player_profile_stats` คือกีฬาเดียว

```
มีเทสตรึงไว้ 2 ตัว: SQL ต้องมี EXISTS และ **ต้องไม่มีคำว่า sport_type_id**
                    ริบต้องจำกัดวงแค่ผู้เล่นในทัวร์นี้ (คนนอกทัวร์ไม่ถูกแตะ)
```

---

### ★ ตรวจ `evaluatePickemRewardsTx` กับฐานจริง (ฐานชั่วคราว `od64c` · rollback)

ตัวนี้เป็น query เดียวของก้อนนี้ที่เทสทั้งหมด mock pool ⇒ ไม่มีอะไรยืนยันว่า SQL วิ่งผ่าน MySQL จริง
(`DELETE ... WHERE user_id NOT IN (SELECT ... GROUP BY ... HAVING ...)` — ถูกไวยากรณ์แต่ควรเห็นมันวิ่ง)

```
① 9001 มี spot_on 4 ใบ · 9002 มี close 5 ใบ   {granted:0, revoked:0}
   9001 ไม่ได้ (ยังไม่ถึง 5)  ·  9002 ไม่ได้ (คนละชั้น)        ✅
② ใบที่ 5 ของ 9001                            {granted:1}   ✅
③ เรียกซ้ำจังหวะเดิม                          {0, 0}        ✅ ไม่แจกซ้ำ ไม่ริบมั่ว
④ ถอนผล 1 แมตช์ (tier→NULL) เหลือ 4 ใบ        {revoked:1}   ✅ ริบจริง
⑤ 9003 ครบเกณฑ์จากแมตช์อื่น แล้วประเมินแมตช์ที่ 9003 ไม่ได้ทาย
   9003 ยังถือเหรียญ                                          ✅ คนนอกแมตช์นี้ไม่ถูกแตะ
```

★ เคส ① ของ 9002 คือเคสที่ **พิสูจน์ว่า OD-65 คุ้ม** — `close` ได้ 7 แต้ม ไม่ใช่ 10
จึงยังไม่โผล่เป็นปัญหาวันนี้ · แต่ถ้าวันหนึ่งทีมตั้ง `close = 10` และยังชี้ชั้นด้วยแต้ม
9002 จะได้เหรียญ "นักทายแม่น" ทั้งที่ไม่เคยทายแม่นเลย · ตอนนี้ SQL เทียบ `tier = 'spot_on'` ⇒ ไม่เกิด

## OD-66 — เหรียญที่ได้มาต้องเห็นตั้งแต่แรก — ✅ ทำแล้ว 2026-10-05

```
เดิม  user_rewards.is_displayed DEFAULT FALSE · RW02 กรอง is_displayed = TRUE
⇒ เหรียญที่ระบบแจกไม่โผล่ที่ไหนเลยนอกจาก RW03 (หน้าของตัวเอง)
⇒ ผู้ใช้ไม่มีทางรู้ว่าได้เหรียญ จนกว่าจะเข้าไปหาเองแล้วกดเปิดทีละอัน
```

**มติ: ได้แล้วขึ้นเลย** · สวิตช์ RW04 เปลี่ยนความหมายจาก "เลือกโชว์" เป็น **"เลือกซ่อน"**

★ ตัวแจกเหรียญ `INSERT` แค่ `(user_id, reward_id)` ไม่ระบุ `is_displayed`
⇒ **เปลี่ยน DEFAULT พอ ไม่ต้องแตะโค้ดแม้แต่บรรทัดเดียว** (migration 043)

🔴 ข้อแลก: เหรียญอย่าง "ลงแข่งครั้งแรก" จะขึ้นโปรไฟล์ทุกคนอัตโนมัติ
⇒ ถ้าไม่อยากให้รก FE ควรโชว์เฉพาะ N อันล่าสุด — บันทึกไว้ใน GUIDE/06 แล้ว

---

## OD-65 — เก็บชั้นของใบทายเป็นคอลัมน์ ไม่ใช่เดาย้อนจากแต้ม — ✅ ทำแล้ว 2026-10-05

### ปัญหา

```
pickem_predictions เก็บแต่ points_earned  ⇒ ใครอยากรู้ว่าใบนี้ชั้นไหนต้องเทียบเลขกับ config เอง
เหรียญ "นักทายแม่น" (OD-64) ทำแบบนั้น:  WHERE points_earned = SPOT_ON_POINTS   -- 10
```

🔴 ถูกเฉพาะตอนที่แต้ม 3 ชั้นไม่ซ้ำกัน · วันที่ทีมตั้ง `close = 10`:

```
① เหรียญจะนับใบชั้น close เป็น spot_on เงียบ ๆ
② และ แถวเก่าจะแปลงย้อนไม่ได้อีกเลย — ข้อมูลที่แยกสองชั้นออกจากกันหายไปแล้ว
```

★ **หน้าต่างของการ backfill ให้แม่น 100% คือ "ตอนนี้" เท่านั้น** — นี่คือเหตุผลที่ทำก่อน ไม่รอ

### ✅ ที่ทำ

```
migration 042  ADD COLUMN tier ENUM('spot_on','close','side_only','wrong_side') NULL
               backfill จาก points_earned (10/7/4/0) ของแถวที่ตัดสินแล้ว
settleTx       เขียน points_earned กับ tier **ในคำสั่งเดียว** ⇒ ไม่มีจังหวะที่สองคอลัมน์ไม่ตรงกัน
unsettleTx     ล้างทั้งคู่พร้อมกัน ⇒ NULL หรือไม่ NULL ไปด้วยกันเสมอ
reward.repo    WHERE tier = 'spot_on'  (ลบ SPOT_ON_POINTS ทิ้ง ไม่เหลือโค้ดตาย)
```

★ `pickemScoreFor()` คืน `{ points, tier }` มาให้อยู่แล้ว — โค้ดเดิมรับแล้ว**ทิ้ง `tier` ทันที**
⇒ ฝั่งโค้ดแทบไม่มีอะไรเพิ่ม มีแต่เลิกทิ้งของที่คำนวณไว้แล้ว

★ เปลี่ยนการจับกลุ่มใน `settleTx` จาก "ตามแต้ม" เป็น **"ตามชั้น"**
ถ้าจับตามแต้มแล้ววันหนึ่งสองชั้นแต้มเท่ากัน สองชั้นจะยุบรวมเป็นกลุ่มเดียว แล้ว `tier` จะได้ค่าสุ่ม

★ เลข 10/7/4/0 ที่เขียนตรง ๆ ใน migration **ถูกต้อง** เพราะเป็นค่า ณ วันที่แถวเก่าถูกตัดสิน
migration ต้องบันทึกอดีต ไม่ใช่อ่าน config วันนี้

### 🔴 ★ ของที่เกือบพลาด — แถวเก่ามีสองยุค แปลงด้วยกฎเดียวไม่ได้

เจอตอนรีวิว diff ก่อน merge · ไล่ git history ดูว่าแต้ม pickem ก่อน OD-56 เป็นเท่าไร

```
ยุคก่อน OD-56 (ก่อน migration 038)   PICKEM_POINTS = 10 แบนราบ · ทายแค่ "ฝั่ง" ไม่มีสกอร์เลย
⇒ "10" ของยุคนั้นหมายถึง ทายฝั่งถูก เท่านั้น ไม่ได้หมายถึงทายสกอร์แม่น
```

🔴 ถ้าแปลงตามเลขตรง ๆ (10 → `spot_on`) เหรียญ "นักทายแม่น" จะนับใบที่ **ไม่เคยทายสกอร์** ด้วย
⇒ ให้เครดิตเกินจริง และ**ไม่มีใครจับได้** เพราะตัวเลขดูถูกต้องทุกทาง

```
แยกยุคด้วย predicted_score_data IS NULL  ← ร่องรอยเดียวที่บอกยุคของแถวได้
แถวยุคเก่า → 'side_only' (สิ่งเดียวที่เรารู้จริงเกี่ยวกับแถวนั้น)
```

🔴 ผลข้างเคียงที่ยอมรับ: แถวยุคเก่าจะมี `points_earned = 10` คู่กับ `tier = 'side_only'`
ซึ่งไม่ตรงกับตารางแต้มวันนี้ · **ตั้งใจ** — แต้มที่ให้ไปแล้วอยู่ใน `users.total_points` แล้ว ห้ามแก้ย้อน
ส่วน `tier` ต้องบอกความจริงว่าแถวนั้นพิสูจน์อะไรได้

```
ตรวจแล้วบนฐาน od65 — ปั้นแถวสองยุคแล้วรัน 042:
  9001  ยุคเก่า  points=10  tier=side_only    ✅
  9002  ยุคเก่า  points= 0  tier=wrong_side   ✅
  9003  ยุคใหม่  points=10  tier=spot_on      ✅
  9004  ยุคใหม่  points= 7  tier=close        ✅
```

★ `ltms` มี 0 แถว ⇒ บนเครื่องนี้ backfill เป็น no-op · แต่ฐานของคนอื่นอาจมีแถวยุคเก่า

### ตรวจแล้วจริง (ฐานชั่วคราว `od67` · rollback ทุกอย่าง)

```
ตั้งบาส tolerance (5,10) · ผลจริง 50-47 · ทาย 4 ใบ
  ทาย 52-45  คลาด 2/2   → points=10 tier=spot_on     ✅
  ทาย 58-40  คลาด 8/7   → points= 7 tier=close       ✅
  ทาย 99-10  ฝั่งถูก     → points= 4 tier=side_only   ✅
  ทายฝั่งผิด            → points= 0 tier=wrong_side  ✅
unsettle → แถวที่ยังมี points หรือ tier ค้าง = 0      ✅
```

## OD-64 — เหรียญ Badge/Achievement มีรายการและมีคนแจก — ✅ Resolved 2026-10-04

RW01-RW04 กับตาราง `rewards`/`user_rewards` เสร็จและ merge ตั้งแต่ 1 ต.ค. **แต่ `rewards` ว่าง 0 แถว
และไม่มีโค้ดไหนเรียก `grantReward` เลยทั้งโปรเจกต์** ⇒ `GET /rewards` คืนลิสต์ว่างตลอดไป
ฟีเจอร์สร้างครบ 100% แต่ใช้ได้ 0% · คนทำรอบแรกหยุดไว้ถูกแล้ว (SDS ไม่ได้กำหนดว่ามีเหรียญอะไร
และได้มายังไง จึงไม่เดาแทนทีม — บันทึกไว้ใน `docs/handoff/rewards-match-history.md`)
OD นี้คือคำตอบของคำถามที่เขาฝากไว้

**ไม่มี endpoint ใหม่** — RW01-RW04 รองรับอยู่แล้ว · ของที่เพิ่มคือ **ข้อมูล** (migration 041) กับ **คนเรียก**

| # | เรื่อง | มติ |
|---|---|---|
| 1 | รายการเหรียญ | 6 อันตามที่เสนอในใบแจ้งทีม 4 ต.ค. — ลงแข่งครั้งแรก · ชนะครั้งแรก · ชนะ 10 แมตช์ · แชมป์ครั้งแรก · แชมป์ 3 สมัย · นักทายแม่น · ทุกอันอ่านจากข้อมูลที่ระบบเก็บอยู่แล้ว ไม่ต้องเก็บอะไรใหม่ |
| 2 | เกณฑ์เก็บที่ไหน | **ใน `rewards.criteria` (JSON)** ไม่ใช่ฝังในโค้ด · คอลัมน์นี้มีมาแต่แรกแต่ไม่เคยมีใครอ่าน — ถ้าฝังเกณฑ์ไว้ในโค้ด มันจะกลายเป็นคอลัมน์ที่เขียนแล้วไม่มีใครใช้ซ้ำรอย OD-29/OD-30 |
| 3 | รูปของ `criteria` | รองรับ **2 รูปเท่านั้น** `{"stat":"<col>","gte":n}` และ `{"pickem":"spot_on","gte":n}` · เหรียญมี 6 อัน ไม่คุ้มทำภาษาเงื่อนไข (AND/OR/ช่วงเวลา) ที่ต้องมีตัวแปลและเทสของตัวเอง · รูปที่ 3 ค่อยเพิ่มเมื่อมีเหรียญที่ต้องใช้จริง |
| 4 | ★ ความปลอดภัย | ชื่อคอลัมน์จาก `criteria` ถูกต่อเป็น SQL ตรง ๆ จึงผ่าน **allowlist** (`STAT_COLUMNS`) ทุกครั้ง ไม่งั้นแอดมินที่แก้แถว `rewards` ได้จะยิง SQL อะไรก็ได้ |
| 5 | เกณฑ์อ่านไม่ออก | **ไม่แจกให้ใครเลย** (ไม่ใช่แจกให้ทุกคน) — เกณฑ์พังแล้วไม่มีใครได้ สังเกตง่ายกว่าเกณฑ์พังแล้วทุกคนได้ และย้อนกลับได้โดยไม่ต้องริบของใคร |
| 6 | แจกตอนไหน | เหรียญสายสถิติ 5 อัน → **ในทรานแซกชันของการปิดทัวร์** (`TournamentRepo.completeTournament` ซึ่งเป็น tx อยู่แล้ว) · ★ ต้องอยู่ **หลัง** การบวก `championships` ไม่งั้นเหรียญแชมป์อ่านค่าก่อนบวกแล้วช้าไปหนึ่งทัวร์เสมอ |
| 7 | เหรียญ Pick'em | "นักทายแม่น" ผูกกับ **ทุกจุดที่แต้มเปลี่ยน** (`settleTx` / `unsettleTx` ใน `applyOutcomeTx`/`undoOutcomeTx`/`amendMatchResult`) ไม่ใช่ตอนปิดทัวร์ — ตามที่ใบแจ้งทีมเขียนไว้ |
| 8 | ★ ริบเหรียญได้ | **ได้ · ประเมินใหม่ทุกครั้งที่แต้มเปลี่ยน** · ผลแมตช์ถอนได้ (`undoOutcomeTx` ล้าง `points_earned`) เหรียญจึงต้องถอนได้ด้วย ไม่งั้นคนถือเหรียญค้างทั้งที่เงื่อนไขไม่จริงแล้ว · ★ ไม่ใช่แค่ `DELETE` ของแมตช์นั้น ต้อง**นับใหม่ทั้งหมด**ว่ายังครบเกณฑ์ไหม เพราะเกณฑ์เป็นยอดรวมข้ามแมตช์ |
| 9 | เรียกซ้ำ | `INSERT IGNORE` + UNIQUE `(user_id, reward_id)` ⇒ แจกซ้ำไม่ได้เหรียญซ้ำ · ปิดทัวร์ซ้ำไม่ได้อยู่แล้ว (409) |
| 10 | `points_required` | **ยังไม่ตัดสิน** ว่าจะมี "แลกของด้วยแต้ม" ไหม — ปล่อย NULL ทุกแถว ไม่ใช้งาน · คำถามนี้ยังค้าง ไม่ได้ปิด (ต่างจาก OD-37/OD-52 ที่ตัดออกชัดเจน) · ถ้าจะทำต้องคิดด้วยว่าผู้ใช้เห็นแต้มตัวเองที่ไหน เพราะ **OD-51 ถอด `total_points` ออกจากโปรไฟล์สาธารณะไปแล้ว** |
| 11 | ★ โชว์บนโปรไฟล์ | **ไม่โชว์เอง** — `user_rewards.is_displayed` ตั้งต้น 0 และ RW02 กรองเฉพาะที่เปิดโชว์ (พฤติกรรมเดิมของ RW01-RW04 ไม่ได้เปลี่ยน) ⇒ **โปรไฟล์สาธารณะจะยังว่างจนกว่าเจ้าตัวจะกด RW04 เปิดทีละอัน** · เจตนาคือให้เจ้าตัวเลือกเองว่าจะโชว์อะไร · **FE ต้องทำหน้าให้กดเปิด ไม่งั้นผู้ใช้ไม่มีทางรู้ว่าตัวเองมีเหรียญ** |

**ความยากของ "นักทายแม่น" ต่างกันตามกีฬาโดยเจตนา** — เกณฑ์คือชั้น `spot_on` ของ OD-56 ซึ่งอิง
`pickem_tolerance_exact` ต่อกีฬา · แบด/RoV/VALORANT ตั้ง 0 ต้องทายสกอร์เป๊ะ · บาสคลาดได้ 5 แต้มต่อฝั่ง
โค้ดอ้าง `PICKEM_TIER_POINTS.spot_on` ไม่ hardcode 10 ⇒ ทีมปรับแต้มรายชั้นวันหลังแล้วเกณฑ์ตามไปเอง

- **migration 041 เป็นตัวแรกของโปรเจกต์ที่ INSERT "ข้อมูล" ภาษาไทย** (ของเดิมมีไทยแค่ในคอมเมนต์ เพี้ยนแล้วไม่มีผล)
  `npm run migrate` ตั้ง charset utf8mb4 ให้อยู่แล้ว แต่คนที่โหลดด้วย `docker exec ... mysql < ไฟล์` จะได้ไทยเพี้ยน
  จึงประกาศ `SET NAMES utf8mb4;` ไว้ในไฟล์เองแบบเดียวกับ `qa-baseline.sql` ให้ถูกทั้งสองทาง
- ตาราง `rewards` ไม่มี UNIQUE บน `name` migration จึงกันซ้ำด้วย `WHERE NOT EXISTS` (รันซ้ำไม่ได้แถวเพิ่ม)
- `grantReward` ตัวเดิมที่ใช้ `pool` **ไม่ถูกลบ** — คงไว้ให้คนที่เรียกนอกทรานแซกชันใช้ต่อ ของใหม่เป็น `*Tx` แยกต่างหาก
## OD-63 — `GET /sport-types` ไม่บอกกฎ Pick'em ⇒ FE อธิบายกฎให้ผู้ใช้ไม่ได้ — ✅ ทำแล้ว 2026-10-04

**ไม่มีใครขอ** — ผมเสนอเอง เพราะ OD-56 ทำให้เส้นความคลาดเป็นค่าต่อกีฬา แต่ลืมทางออก

### ปัญหา

```
sport_types.pickem_tolerance_exact / _close   อยู่ในฐาน (migration 040) ผู้จัดแก้ได้
SportTypeDto                                   ไม่ส่งออกเลย
```

หน้าทายผลต้องบอกว่า "ทายแล้วได้แต้มเท่าไร" **ก่อน** ผู้ใช้กดส่ง — ตัวเลข 5/10 ของบาส
หรือ 0/1 ของฟุตบอล **FE ไม่มีทางรู้** ⇒ ทางเลือกของเขาเหลือสองทางและแย่ทั้งคู่

```
① hardcode เลขไว้ใน FE   ⇒ วันไหนมีคนแก้ในฐาน หน้าจอโกหกทันที
                            🔴 และโกหกแบบไม่มีใครรู้ เพราะแต้มยังคิดถูกฝั่ง BE
                               ⇒ ผู้ใช้เห็นกฎอย่างหนึ่ง ได้แต้มตามอีกอย่างหนึ่ง
② ไม่บอกกฎเลย            ⇒ ผู้ใช้ทายโดยไม่รู้ว่าคลาดได้เท่าไร = ฟีเจอร์เสียความหมาย
```

★ เหตุผลที่เสนอไม่ใช่ "FE ขอ" (เขาไม่ได้ขอ) แต่เพราะ **ถ้าไม่ให้ เขาจะเลือกข้อ ① โดยปริยาย**
แล้วเลขจะแยกร่างเป็นสองชุดทันที

### ✅ ที่ทำ

```ts
SportTypeDto += pickemTolerance : { spotOn , close }
                pickemPoints    : { spotOn , close , sideOnly }
```

query เป็น `SELECT * FROM sport_types` อยู่แล้ว ⇒ **ไม่ต้องแตะ SQL** · แก้ mapper ที่เดียว

### ★ คีย์ชื่อ `spotOn` ไม่ใช่ `exact` — เจ้าของงานทักเอง

รอบแรกผมส่งเป็น `{ exact , close }` ตามชื่อคอลัมน์ `pickem_tolerance_exact`

```
🔴 แต่ scoring.ts เขียนห้ามคำนี้ไว้เองตอนตั้งชื่อชั้น:
   "ชื่อไม่ใช่ exact เพราะในบาส (เส้น 5) คลาดได้ถึง 5 แต้มต่อฝั่งแล้วยังอยู่ชั้นนี้
    ถ้าเรียก exact จะหลอกคนอ่านโค้ดว่าต้องตรงเก๊ะ"
⇒ แล้วผมก็เอาคำที่ตัวเองเขียนห้ามไว้ ไปเป็นชื่อคีย์ที่ส่งออก API
```

เจ้าของงานทักเองว่า "เราไม่ใช้คำว่า exact นิ" · อาการหนึ่งที่พิสูจน์ว่าชื่อนี้ผิด:

```
md ที่ร่างไว้ต้องมีหัวข้อเต็ม ๆ ว่า "exact ไม่ได้หมายถึงตรงเป๊ะ"
⇒ คำเตือนนั้นไม่ได้เกิดจากความยุ่งของกฎ มันเกิดจากชื่อคีย์ที่ตั้งผิด
⇒ แก้ชื่อ แล้วคำเตือนหายไปทั้งหัวข้อ
```

และปัญหาที่ใหญ่กว่า — **สองก้อนที่ต้องใช้คู่กัน ตั้งชื่อไม่ตรงกัน**

```
ก่อน  tolerance { exact  , close }            ← ไม่ตรง
      points    { spotOn , close , sideOnly }
หลัง  tolerance { spotOn , close }            ← tolerance[tier] / points[tier] วนลูปได้
```

**ไม่ rename คอลัมน์ในฐาน** (`pickem_tolerance_exact` คงเดิม) — migration ที่แก้แค่ชื่อ
ไม่คุ้มความเสี่ยง · ชื่อ `exact` เหลืออยู่แค่ "ข้างใน" ไม่โผล่ออก API

```
+1 เทส: ตรึงว่าทุกคีย์ของ tolerance มีชั้นที่ตรงกันใน points
         และไม่มีคีย์ `exact` หลุดออกไป ⇒ กันคนเปลี่ยนกลับตามชื่อคอลัมน์
```

### ที่ตัดสินเอง (บอกไว้) — ส่ง `pickemPoints` ไปด้วย

เจ้าของงานสั่ง "เอาทั้งสอง" แต่ไม่ได้ตอบข้อย่อยนี้ · ผมเลือกส่ง เพราะ

```
10/7/4 อยู่ใน config/scoring.ts ของ BE ⇒ ถ้าไม่ส่ง FE ก็ต้อง hardcode = ปัญหาเดิมย้ายที่
และเส้นไม่มีประโยชน์ถ้าไม่รู้แต้ม · แต้มไม่มีประโยชน์ถ้าไม่รู้เส้น ⇒ ต้องมีทั้งคู่จึงประกอบประโยคอธิบายได้
```

🔴 **สิ่งที่สัญญาไปด้วยคือ "เลขนี้มาจาก BE ตลอดไป"** — ถ้าวันหนึ่งทีมอยากให้แต้มต่างกันตามกีฬา
ต้องย้าย 10/7/4 ลงฐาน ไม่ใช่กลับไป hardcode ฝั่ง FE · **ถอนออกได้ด้วยการลบคีย์เดียว** ถ้าไม่เอา

### เทส

```
+3 ตัว  reference.mapper.test
        เส้นของบาส 5/10 ไม่สลับ exact↔close
        เส้น 0 ออกไปเป็น 0 ← ★ ถ้าเขียน `row.x || DEFAULT` เคสนี้เพี้ยนเงียบ ๆ เพราะ 0 เป็น falsy
        แต้มผูกกับ config ไม่ใช่เลขที่พิมพ์ซ้ำใน mapper ← ตรวจ "ผูกกับ config" ไม่ใช่ตรวจว่าเป็น 10/7/4
อัปเดต  fixture 2 ตัวให้มีคอลัมน์จริงเหมือนที่ query คืนมา (ไม่ใช่แก้ค่าที่คาดหวังให้ตรงผล)
```

### ตรวจแล้วจริงกับระบบที่รันอยู่ (ฐานชั่วคราว `od62` · ลบแล้ว)

```
GET /sport-types
  id 1 ฟุตบอล     tol { spotOn: 0 , close: 1  }   points { 10 , 7 , 4 }
  id 2 บาสเกตบอล  tol { spotOn: 5 , close: 10 }   points { 10 , 7 , 4 }
  id 3 แบดมินตัน   tol { spotOn: 0 , close: 0  }   points { 10 , 7 , 4 }
```

⇒ ตรงกับค่าในฐานทุกแถว · `0` ออกไปเป็น `0` จริง ไม่หาย

`ltms` ยืนยันไม่ถูกแตะ: 4 users · 40 migrations

## OD-62 — ด่านกันเทสออกไปแตะของจริง (MySQL · S3 · SMTP) — ✅ ทำแล้ว 2026-10-04

**ไม่ใช่งานฟีเจอร์** — เป็นการปิดรูที่ทำให้ "เทสผ่าน" เชื่อถือไม่ได้ · เจอตอนทำ OD-61

### ปัญหาที่เกิดขึ้นจริงแล้ว ไม่ใช่ความกังวลล่วงหน้า

```
OD-58 ทำให้ canSeeUnfinishedResult() เรียก adminScope.repo เพิ่มมาหนึ่งที่
เทส 9 ไฟล์ที่เดินผ่านเส้นนั้น mock แต่ repo ที่ "เห็นว่าเกี่ยว" ⇒ repo ตัวใหม่ไม่ถูก mock
⇒ ไปต่อ MySQL 127.0.0.1:3307 จริง และ ผ่าน เพราะเครื่องมี docker รันอยู่
```

**อาการคือเทส "ผ่าน" ไม่ใช่ "แดง" ⇒ ไม่มีสัญญาณให้จับ** · จับได้เพราะ docker ดับเองกลางทาง
แล้วเทสที่ผ่านเมื่อครึ่งชั่วโมงก่อนกลายเป็น `ECONNREFUSED` ⇒ เลข "3458 ผ่าน" ของคอมมิตก่อนหน้า
**พึ่งโชคอยู่บางส่วน**

ของที่เสียไปไม่ใช่แค่ "เทสต้องมี docker" แต่คือ **เทสเลิกทดสอบสิ่งที่มันเขียนไว้ว่าทดสอบ**
— มันไปอ่านข้อมูลในฐานของเครื่องคนรัน ⇒ ผลขึ้นกับว่าใครเพิ่ง seed อะไรไว้ ไม่ใช่ขึ้นกับโค้ด

```
🔴 รูนี้กลับมาได้ทุกครั้งที่มีคนเพิ่ม repo call เข้า service/middleware ที่มีเทสเดินผ่านอยู่แล้ว
   ⇒ การ "ไปใส่ mock ให้ 9 ไฟล์" ปิดเคสนี้ แต่ไม่ปิดเคสหน้า
```

### ✅ ที่ทำ — `src/__tests__/setup/noRealIO.ts` เป็น `setupFiles` ของทุกไฟล์เทส

mock `config/db.js` ให้เป็น pool ที่ **ระเบิดทุกเมธอด** เป็นค่าตั้งต้น (`query` / `execute` /
`getConnection` / `end`) · ข้อความ error บอกวิธีแก้ทั้งสองทางและบอกว่า **ห้ามแก้ด้วยการสั่งให้ docker รัน**

```
ไฟล์ที่ vi.mock('.../config/db.js') เองอยู่แล้ว (เทส repo ที่ตรวจตัว SQL · 19 ไฟล์) ทับด่านนี้ได้ตามปกติ
เพราะ vi.mock ในไฟล์เทสลงทะเบียนหลัง setupFiles ⇒ ของในไฟล์ชนะ · ยืนยันแล้วว่าทั้ง 19 ไฟล์ยังผ่าน
```

### ★ พิสูจน์ว่าด่านทำงาน — ทดลองย้อนกลับ ไม่ใช่แค่ "รันแล้วเขียว"

ลบ `vi.mock` ของ `adminScope.repo` ออกจาก `matchResult.disputeWindow.test.ts` **ทั้งที่ MySQL รันอยู่**

```
(ก) ไม่มีด่าน (สภาพก่อนวันนี้)   16 passed   ← ผ่าน ทั้งที่กำลัง query ฐานจริง = รูเดิมเป๊ะ
(ข) มีด่าน                        3 failed    ← [no-real-db] พร้อม stack trace ชี้ที่ต้นเหตุ
                                              ❯ Module.findAdminByUserId src/repositories/adminScope.repo.ts:10:33
```

⇒ ด่านไม่ได้แค่ทำให้แดง มันบอก **ชื่อ repo และบรรทัด** ที่ขาด mock ⇒ แก้ได้โดยไม่ต้องสืบ

### 🔴 ของที่เจอพ่วงมา — `npm test` รันเทสของโค้ดวันที่ 19 ก.ย. อยู่ 51 ไฟล์

`exclude` เดิมไม่มี `dist/**` และ include ตั้งต้นของ vitest จับ `.js` ด้วย

```
dist/ คอมไพล์ไว้ 19 ก.ย. (15 วันก่อน) · มี *.test.js 51 ไฟล์ · vitest เก็บมารันทุกครั้ง
⇒ เลข "197 ไฟล์ / 3463 เทสผ่าน" รวมเทสของโค้ดเวอร์ชันเก่าที่ไม่มีใครแก้แล้ว
⇒ และเทสใน dist import dist/config/db.js ⇒ ด่าน noRealIO (mock src/config/db.ts) กันไม่ถึง
```

**ที่ตัดสินเอง** — ใส่ `'**/dist/**'` ใน `exclude` · ผลคือเลขเทสเปลี่ยน และนี่คือเลขจริง

```
ก่อน   197 ไฟล์ / 3463 เทส   ← 51 ไฟล์ / 612 เทส เป็นสำเนาเก่าของ dist
หลัง   146 ไฟล์ / 2851 เทส   ← ของจริงทั้งหมด
```

`vitest.slow.config.ts` ไม่ต้องแก้ — `include` ของมันระบุ `.ts` ⇒ ไม่เคยเก็บ `dist/*.js` อยู่แล้ว

### ก้าวที่ 2 (คอมมิตถัดมา) — คลุม S3/MinIO และ SMTP ด้วย

ตอนทำก้าวที่ 1 ยังไม่คลุมสองตัวนี้ เพราะ**ไม่มีอาการจริงให้ยึด** (รันทั้งชุดตอน `ltms-minio` ดับก็ผ่าน)
แต่เจ้าของงานสั่งทำต่อ และเหตุผลที่ทำให้มันคุ้มคือ **กลไกที่ทำให้รูของ MySQL เกิด มีครบทั้งสามทาง**

```
รูของ MySQL เกิดจาก: มีคนเพิ่ม repo call เข้า service ที่มีเทสเดินผ่านอยู่แล้ว
S3  มีเส้นเดียวกันเป๊ะ: ใครเพิ่ม s3.send() เข้า service ที่มีเทสอยู่ ⇒ ทะลุไป MinIO
SMTP เช่นกัน:          ใครเพิ่ม "ส่งเมลแจ้ง" เข้า flow ที่มีเทสอยู่ ⇒ ทะลุไป transport
```

**และสองตัวนี้พังแรงกว่า MySQL เพราะมันไม่ใช่การ *อ่าน***

```
MySQL ทะลุ → อ่านฐานในเครื่องตัวเอง      เสียความน่าเชื่อถือของเทส
S3 ทะลุ    → เขียนไฟล์ขึ้นถังจริง         เทสทิ้งขยะไว้ในที่เก็บจริง
SMTP ทะลุ  → ส่งเมลจริงออกไปหาคนจริง  ← 🔴 ย้อนกลับไม่ได้
```

> 🔴 **SMTP คือเหตุผลที่ด่านนี้ต้องมาก่อน ไม่ใช่ตามหลัง** — ตามลำดับที่ตกลงไว้เรื่อง OTP (OD-53)
> จะมีการใส่ SMTP จริงลง `backend/.env` ⇒ ตั้งแต่วินาทีนั้น เทสที่ทะลุจะไม่ใช่ "ต่อ mailpit
> ใน localhost" อีกต่อไป มัน **ยิงเมลออกจากบัญชีจริงทุกครั้งที่ใครรัน `npm test`**

เปลี่ยนชื่อไฟล์ `noRealDb.ts` → `noRealIO.ts` เพราะไม่ใช่เรื่องฐานข้อมูลอย่างเดียวแล้ว

### ★ ใช้ `Proxy` ไม่ใช่รายการเมธอด

```ts
new Proxy({}, { get(_t, prop){ ... return () => blocked(...) } })
```

`getSignedUrl(s3, cmd)` **ไม่เรียก `s3.send()`** — มันไปอ่าน `.config` / `.middlewareStack`
ของ client เอง (presign ทำในเครื่อง ไม่ออกเน็ต แต่ก็อ่าน credential จาก `.env`)
⇒ ถ้าดักแต่ `send` เคสนั้นจะพังด้วย error ของ AWS SDK ที่อ่านไม่รู้เรื่อง แทนที่จะเป็นข้อความของด่าน

ยกเว้นชื่อที่ runtime แตะเพื่อ "ส่อง" object (`then` / `__esModule` / `toJSON` / symbol ฯลฯ)
ต้องคืน `undefined` ไม่ระเบิด ไม่งั้น error จะกลายเป็นเรื่องอื่นไปเลย

### 🔴 ของที่เจอตอนพิสูจน์ — ด่าน "จับได้" แต่ "สื่อสารไม่ได้"

ลบ mock ของ S3 ออกจาก `upload.service.test.ts` แล้วได้

```
AssertionError: expected 503 to be 422     ← เทสแดงจริง แต่ไม่มีคำว่า S3 เลย
```

เพราะ `upload.service` ครอบ `s3.send()` ด้วย `try/catch` แล้วแปลงทุก error เป็น 503
⇒ ข้อความของด่านถูกกลืน · **ด่านทำงาน แต่คนอ่านไม่รู้ว่าต้นเหตุคือลืม mock S3**

```
✅ แก้: console.error ข้อความออก stderr ก่อน throw
⇒ ถึง catch จะกลืน error ไป ข้อความก็ยังโผล่ใน output ของ vitest
```

★ นี่คือเหตุผลที่ต้องพิสูจน์ด่านด้วยการสร้างรูขึ้นมาจริง — ถ้าดูแค่ "เทสแดงไหม" จะไม่เห็นข้อนี้เลย

### พิสูจน์ครบทั้งสามทาง

ลบ mock ของแต่ละตัวออกจากไฟล์เทสที่เกี่ยวข้อง แล้วดูว่าด่านจับได้และชี้ต้นเหตุถูก

```
MySQL  ❯ Module.findAdminByUserId      src/repositories/adminScope.repo.ts:10:33
S3     ❯ Module.validateSoftFilterDocuments  src/services/upload.service.ts:130:34
SMTP   ❯ Module.sendPasswordResetEmail  src/services/mail.service.ts:8:21
```

⇒ 9 เทสแดงใน 3 ไฟล์ · ทุกอันมี `[no-real-io]` และชี้ไฟล์:บรรทัดของต้นเหตุ
คืน mock กลับแล้วผ่านครบเหมือนเดิม

### ยืนยัน

```
MySQL ดับ   146 ไฟล์ / 2851 เทส ผ่าน
MySQL รัน   146 ไฟล์ / 2851 เทส ผ่าน   ← เลขเท่ากัน = ไม่มีเทสไหนพึ่งฐานจริงแล้ว
```

★ **"เลขเท่ากันทั้งสองสภาพ" คือหลักฐานที่ต้องการ** — ไม่ใช่ "รันแล้วเขียว" ซึ่งสภาพเดิมก็เขียว

## OD-61 — โลโก้ทีมหายทุกที่นอกจากหน้ารายละเอียดทีม — ✅ ทำแล้ว 2026-10-04

**ปิดข้อ 4a/4b ของ `TO-BACKEND-2026-10-01-*`** (FE แจ้งมา 1 ต.ค. · ตรวจแล้วยังจริงเมื่อ 4 ต.ค.)

> ⚠️ **ไม่ใช่โมดูลของผม** — ส่ง `TO-TEAM-2026-10-04-logoUrl-missing.md` ให้เจ้าของโมดูลทีมแล้ว
> แต่เจ้าของงานสั่งให้ทำแทนเมื่อ 4 ต.ค. เพราะรอคำตอบไม่ได้ · **เป็นการเพิ่มฟิลด์ ไม่แตะพฤติกรรมเดิม**

### ปัญหา

```
teams.logo_key            ✅ มี
M16 อัปโหลด purpose 'team_logo'  ✅ มี
toPublicImageUrl()        ✅ มี
TeamDto.logoUrl           ✅ มี  ← ที่เดียวของทั้งระบบ
```

⇒ **อัปโลโก้ขึ้นได้ ไฟล์อยู่ในถังจริง แต่แสดงได้แค่หน้ารายละเอียดทีม**
หน้าแชมป์ · ตารางอันดับ · คิวแอดมิน · โปรไฟล์ · ทีมของฉัน · คำเชิญเข้าทีม ไม่มีโลโก้เลย

### ✅ ที่ทำ — เพิ่ม `logoUrl` ใน `TeamRef` และ `MyTeam`

**FE ขอ 2 ที่ · ของจริงมี 6 จุดที่สร้าง `TeamRef`** (เจอครบเพราะ `tsc` ไล่ให้ หลังเพิ่มฟิลด์ใน type)

| จุดที่สร้าง TeamRef | โผล่ที่หน้าไหน | query ต้องเติม `t.logo_key` |
|---|---|---|
| `toTeamRef` ← `findApprovedTeamsByTournament` | ทีมที่อนุมัติแล้วในทัวร์ | ✅ เติม |
| `toTeamRef` ← `TeamRepo.findById` / `checkTeam` | **แชมป์ / รองแชมป์** | `SELECT *` อยู่แล้ว |
| `toTeamRef` ← `TeamRepo.findTeamsByUser` | ทีมในโปรไฟล์สาธารณะ | `SELECT t.*` อยู่แล้ว |
| `toStandingDto` ← `findStandings` | **ตารางอันดับ** | ✅ เติม |
| `adminScope.mapper` ×2 | คิวทีม Official / คำขอโอนหัวหน้า | ✅ เติม (ดู 🔴 ข้างล่าง) |
| `user.mapper.toGetMyInvitation` | คำเชิญเข้าทีมของฉัน | ✅ เติม |

`MyTeam` ← `findTeamsByUser` (`SELECT t.*`) ⇒ เพิ่มแค่ฟิลด์ในมappers

### ★ ทำไมเพิ่มฟิลด์ใน type ก่อน แล้วให้ `tsc` ไล่

```
เพิ่ม logoUrl ใน TeamRef  ⇒  ทุกจุดที่ประกอบ TeamRef เองพังทันที
เพิ่ม logo_key ใน Pick<>  ⇒  ทุก query ที่ไม่ SELECT คอลัมน์นี้พังทันที
```

⇒ ได้รายการจุดที่ต้องแก้จาก compiler ไม่ใช่จากการเดา · **เจอ 2 จุดที่ FE ไม่ได้แจ้งและผมก็ไม่ได้นึกถึง**
(ตารางอันดับ กับ คำเชิญเข้าทีม)

และเปลี่ยนจุดที่ประกอบ object เองให้เรียก `toTeamRef(rows)` ทั้งหมด ⇒ โลโก้มาจากที่เดียวกันหมด

### 🔴 รูที่ `tsc` จับไม่ได้ และเจอด้วยการไล่มือ

```ts
// adminScope.repo.ts — query ใช้ "type assertion" ไม่ใช่การ map ที่ถูกตรวจ
const [rows] = await pool.query<(getOfficialRequest & RowDataPacket)[]>(`SELECT t.team_id , t.name , t.sport_type_id , ...`)
```

⇒ เปลี่ยน type ของ `getOfficialRequest` แล้ว **`tsc` เงียบ** เพราะไม่มีใครตรวจว่า SQL คืนคอลัมน์ครบ
⇒ ถ้าไม่ไล่มือ คิวแอดมินจะโชว์ "ไม่มีโลโก้" ทุกทีมตลอดไป โดย API ตอบ 200 ปกติ

```
บทเรียน: query ที่ cast ผลลัพธ์เป็น type เอง = จุดที่ compiler ช่วยไม่ได้
         ⇒ เวลาเพิ่มคอลัมน์ใน type ของ row ต้องไล่ query ที่ cast ด้วยมือทุกครั้ง
```

กวาดแล้วว่าไม่มีที่อื่นเหลือ (ที่เจอเพิ่มเป็น `t` = `tournaments` ไม่ใช่ `teams`)

### 🔴 แก้ `toPublicImageUrl` ให้รับ `undefined` ด้วย

```ts
// เดิม
if (objectKey === null) return null;                      // undefined หลุด ⇒ ".../undefined"
// ใหม่
if (objectKey === null || objectKey === undefined) return null;
```

เจอเพราะ fixture ของเทสที่ไม่มีคอลัมน์ ทำให้ได้ `logoUrl: "https://cdn.test/undefined"`
ซึ่งเป็นอาการเดียวกับที่จะเกิดจริงถ้า query ลืม SELECT ⇒ หน้าจอได้ URL ที่โหลดไม่ขึ้น
แทนที่จะได้ "ไม่มีรูป" และไล่ต้นตอยากเพราะ API ตอบ 200 พร้อม string ที่ดูเหมือนถูก

### 🔴 ของที่เจอพ่วงมา และสำคัญกว่าตัวงาน — เทสบางไฟล์เคยต่อฐานจริง

```
OD-58 ทำให้ canSeeUnfinishedResult() ถาม AdminRepo ด้วย
แต่เทส 9 ไฟล์ที่เรียก matchResult.service ไม่ได้ mock adminScope.repo
⇒ เทสพวกนั้นไปต่อ MySQL ที่ port 3307 จริง
⇒ "ผ่าน" เฉพาะตอนที่เครื่องมี docker รันอยู่
```

**จับได้เพราะ Docker ดับระหว่างทำงานนี้** แล้วเทสที่เพิ่งผ่านเมื่อครึ่งชั่วโมงก่อนกลายเป็น
`ECONNREFUSED 127.0.0.1:3307` ⇒ แปลว่าเลข "3458 ผ่าน" ของคอมมิตก่อนหน้า**พึ่งโชคอยู่บางส่วน**

```
✅ แก้แล้ว: ใส่ mock ของ adminScope.repo ให้ทั้ง 9 ไฟล์ พร้อมคอมเมนต์บอกเหตุผล
✅ ยืนยัน: รันเทสทั้งชุดตอน Docker ดับ → 3461 ผ่านทั้งหมด = ไม่มีเทสไหนพึ่งฐานจริงแล้ว
```

> 🙋 **ข้อเสนอที่ยังไม่ทำ** — ใส่ setup ของ vitest ที่ทำให้ "การต่อฐานจริงในเทส" พังทันที
> (mock `config/db.js` ทั้งโปรเจกต์) เพื่อให้รูแบบนี้ไม่กลับมาเงียบ ๆ อีก · รอมติ

### ก้าวที่ 2 (คอมมิตถัดมา) — `teamA` / `teamB` ของแมตช์และสาย

**ก้าวที่ 1 ตั้งใจไม่แตะไว้** เพราะเป็น inline type คนละตัวกับ `TeamRef` ⇒ `tsc` ไม่ไล่ให้
เจ้าของงานสั่งทำต่อทันทีด้วยทางเลือก ① คือ **เปลี่ยนไปใช้ `TeamRef` เลย** ไม่ใช่เติมฟิลด์ใน inline type

```
เดิม  teamA: { id: number; name: string; sportTypeId: number } | null     ← หน้าตาเหมือน TeamRef แต่ไม่ใช่
ใหม่  teamA: TeamRef | null
⇒ ครั้งหน้าที่ TeamRef เพิ่มอะไร มันตามไปเองทุกที่ ไม่ต้องมานั่งไล่อีก
```

**🔴 ไล่แล้วเจอ 3 จุด ไม่ใช่ 2** — จุดที่สามคือ **สายการแข่งขัน** ซึ่งไม่มีใครนึกถึง

| DTO | เส้น | หน้า |
|---|---|---|
| `MatchListItemDto` | `GET /tournaments/:id/matches` · `GET /me/matches` | ตารางแมตช์ |
| `MatchDetailItemDto` | `GET /matches/:id` | รายละเอียดแมตช์ |
| **`BracketNodeDto`** | `GET /tournaments/:id/bracket` | **สายการแข่งขัน** |

query ที่เติม `logo_key`: `MatchListRow` · `MatchDetailRow` (`match.repo`) · `BracketNodeListRow` (`bracketNode.repo`)
ทั้งสาม `LEFT JOIN teams ta / tb` อยู่แล้ว ⇒ เติมคอลัมน์ละสองตัวจบ

#### ★ `toMatchTeamRef()` — helper เดียวสำหรับทั้งสามจุด

แถวของแมตช์เก็บสองทีมใน **แถวเดียว** (`team_a_*` / `team_b_*`) ไม่ใช่แถวละทีม
⇒ เรียก `toTeamRef(row)` ตรง ๆ ไม่ได้ ต้องแยกคอลัมน์เป็น "ทีม" ก่อน

**🔴 และที่สำคัญกว่า — helper นี้แยกสองความหมายของ `null` ที่ปนกันง่ายมาก**

```
คืน null        = ช่องนั้นไม่มีทีม — bye / dead slot / สายยังไม่ถูกเติม
logoUrl: null   = มีทีมจริง แต่ทีมนั้นยังไม่ได้อัปโลโก้
```

ตัดสินด้วย `teamId` อย่างเดียว **ห้ามตัดสินด้วย `logoKey`** — ถ้าใครเผลอสลับ
ช่องสายจะว่างทั้งที่มีทีมอยู่ แล้วหน้าสายจะโชว์ "ยังไม่มีทีม" ทั้งทัวร์ โดย API ตอบ 200 ปกติ
⇒ มีเทสตรึงเคสนี้ไว้โดยเฉพาะ

#### ตรวจแล้วจริง (ฐานชั่วคราว `od61b` · ลบแล้ว)

ตั้งโลโก้ให้ทีม 9003 ทีมเดียว

```
GET /tournaments/1/matches   9001 logo=null · 9002 null · 9003 URL · 9004 null       ✓
GET /matches/2               teamA id9003 logo=URL · teamB id9004 logo=null          ✓
GET /matches/10              teamA id9003 logo=URL · teamB = null (ไม่มีทีม — bye)    ✓ แยกสองเคสถูก
GET /tournaments/1/bracket   node 14: 9003 URL / 9004 null
                             node 15: 9001 logo=null · teamB = null (ช่องว่าง)        ✓ แยกสองเคสถูก
```

★ แมตช์ 10 กับ node 15 คือเคสที่พิสูจน์ว่า *"ทีมไม่มีโลโก้"* ไม่ถูกปนกับ *"ช่องไม่มีทีม"*

### ตรวจแล้วจริงกับระบบที่รันอยู่ (ฐานชั่วคราว `od61` · ลบแล้ว)

ตั้ง `teams.logo_key = 'teams/9001/logo.png'` ให้ทีม 9001 แล้วไล่ทุกเส้นที่ `TeamRef` โผล่

```
GET /me/teams                      logoUrl = http://localhost:9000/ltms/teams/9001/logo.png  ✓
GET /users/9001                    logoUrl = (เดียวกัน)                                      ✓
GET /tournaments/2/standings       null · null · URL  ← ทีมที่ไม่มีโลโก้ได้ null ไม่ใช่สตริงว่าง ✓
GET /tournaments/2/teams           มีคีย์ logoUrl ครบทุกทีม (null เพราะยังไม่ได้อัป)           ✓
GET /admin/team-requests           URL  ← 🔴 เส้นที่ tsc จับไม่ได้ ตรวจแล้วมาจริง             ✓
GET /admin/team-requests/transfers URL                                                        ✓
GET /me/invitations                URL                                                        ✓
```

★ สองเส้นของคิวแอดมินคือจุดที่สำคัญที่สุดของการตรวจรอบนี้ — เป็นจุดที่ `tsc` เงียบ
ถ้าไม่ยิงจริงจะไม่มีทางรู้ว่า `t.logo_key` ที่เติมด้วยมือนั้นถูกหรือไม่

### เทส

```
+4 ตัว  team.mapper.test     logo_key → URL สาธารณะ (ไม่ใช่ key ดิบ) · ไม่มีโลโก้ → null ไม่ใช่สตริงว่าง
                             MyTeam มี logoUrl · รายการคีย์ของ TeamRef เป็น 4 ตัว
อัปเดต  fixture ของ 6 ไฟล์ให้มี logo_key เหมือน query จริง (ไม่ใช่แก้ค่าที่คาดหวังให้ตรงผล)
```

## OD-60 — ยอด MVP ในโปรไฟล์: ส่งทั้ง "จำนวนครั้งที่เป็น MVP" และ "ยอดโหวต" — ✅ ตัดสินแล้ว 2026-10-04 (ทำแล้ว)

**ปิดครึ่งหลังของข้อ 5 ใน `TO-BACKEND-2026-10-01-frontend-workflows.md`**
(*"Profile ยอด MVP ที่ได้รับ — ต้องตกลง metric"*) · ครึ่งแรก (team follow) ยังพักไว้

### ที่มา — FE ถูกที่ทักว่า "ต้องตกลง metric ก่อน"

`mvpVotes` มีอยู่แล้วใน U04 และกรองแมตช์ที่ปิดโหวตแล้วถูกต้องตั้งแต่ OD-23 ข้อ 10
**แต่มันไม่ใช่ตัวเลขที่คนอ่านคิดว่ามันคือ**

```
นาย ก  ทีมดัง คนดู 100 · ได้ 40 / 38 / 50 โหวต แต่เพื่อนร่วมทีมนำสองนัด
       ⇒ 128 โหวต · เป็น MVP 1 ครั้ง
นาย ข  ทีมเล็ก คนดู 5  · ได้  4 /  3 /  5 โหวต และนำทุกนัด
       ⇒  12 โหวต · เป็น MVP 3 ครั้ง
```

| โชว์อะไร | อันดับที่ได้ |
|---|---|
| ยอดโหวต | **ก (128) ชนะ ข (12)** ขาดลอย 10 เท่า |
| จำนวนครั้งที่เป็น MVP | **ข (3) ชนะ ก (1)** |

⇒ **สองตัวเลขเรียงอันดับกลับทางกันสนิท** · ยอดโหวตบวกตาม **จำนวนคนดู** ไม่ได้บวกตามฝีมือ
คนที่ลงทัวร์ใหญ่ 20 แมตช์ชนะคนที่ลงทัวร์เล็ก 3 แมตช์โดยอัตโนมัติ แม้เล่นแย่กว่าทุกนัด

> 🔴 และ *"ได้ MVP กี่ครั้ง"* คือสิ่งที่คนทั่วไปหมายถึงเมื่อเห็นเลขนี้บนโปรไฟล์
> ถ้าโชว์ยอดโหวตแล้วตั้งป้ายว่า "MVP" คนอ่านผิดทันที

### ✅ มติ — ส่งทั้งคู่ · `mvpTimes` เป็นตัวหลัก `mvpVotes` เป็นตัวรอง

```jsonc
// GET /users/:id/stats (U04)
{ "mvpVotes": 3,      // ยอดโหวตที่ได้รับ — เดิม ไม่เปลี่ยนความหมาย
  "mvpTimes": 2 }     // 🆕 จำนวนครั้งที่ได้โหวตมากสุดในแมตช์นั้น
```

ทั้งคู่เป็น `null` เมื่อเจ้าของโปรไฟล์ปิดสถิติ (OD-46) — ไม่ใช่ 0

### มติย่อย 3 ข้อที่ต้องตัดสินก่อนเขียน (และคำตอบ)

#### ① เสมอที่อันดับหนึ่ง = **ได้ทั้งคู่** (co-MVP)

```sql
RANK() OVER (PARTITION BY tf.match_id ORDER BY COUNT(*) DESC)   -- rnk = 1 ให้ทุกคนที่เท่ากัน
```

ตรงกับกีฬาจริงที่มี co-MVP และ **ไม่ต้องมีกฎตัดสินลับที่ผู้เล่นมองไม่เห็น**
ทางเลือกที่ไม่เอา: *"เสมอ = ไม่มีใครได้"* ⇒ คนที่ได้โหวตมากสุดแต่ไม่ได้ MVP อธิบายยากกว่า
🔴 **ห้ามเปลี่ยนไปใช้ `ROW_NUMBER()` หรือ `LIMIT 1`** — จะเลือกคนเดียวแบบสุ่มเมื่อเสมอ
(มีเทสตรึงไว้ว่า SQL ต้องไม่มีคำว่า `ROW_NUMBER`)

#### ①b ไม่มีใครโหวตเลย = **ไม่มีใครได้** (ไม่ใช่ "ทุกคนเสมอที่ 0 แล้วได้ทุกคน")

ข้อนี้มาจาก**โครงข้อมูล** ไม่ใช่จากเงื่อนไขที่เขียนเพิ่ม

```
แต่ละแถวใน tournament_feedback = 1 โหวต
⇒ COUNT(*) ของทุกกลุ่ม ≥ 1 เสมอ · คนที่ไม่มีโหวตไม่มีแถวให้จัดอันดับ
⇒ แมตช์ที่ไม่มีโหวต (หรือโหวตถูกลบหมด) ไม่มีกลุ่มใดเลย ⇒ ไม่มี rnk = 1
```

🔴 **สิ่งที่จะทำให้พัง** — เปลี่ยนไปจัดอันดับจาก *"รายชื่อผู้เล่นในแมตช์"* แล้ว `LEFT JOIN` โหวตเข้ามา
ซึ่งเป็นสิ่งที่คนจะทำถ้าวันหนึ่งอยากโชว์ผู้เล่นทุกคนพร้อมยอดโหวต

```
คนที่ไม่มีโหวตจะได้ COUNT(*) = 0 แล้ว **กลายเป็น rnk = 1 พร้อมกันทุกคน**
⇒ แมตช์ที่ไม่มีใครโหวตจะแจก MVP ให้ผู้เล่นทั้งสองทีม
```

⇒ เทสตรึงไว้ว่าคิวรีนี้ **ห้ามมี `LEFT JOIN` เลย** และต้องจัดอันดับจากตัวตารางโหวตเอง
ตรวจจริงแล้วบนฐานชั่วคราว `od60b` (ลบแล้ว)

```
แมตช์ปิดโหวตแล้วแต่ไม่มีใครโหวต   → ไม่มีใครได้ MVP ✓
แมตช์ที่โหวตถูกลบหมด (removed_at) → ไม่มีใครได้ MVP ✓
แมตช์ที่มีโหวตจริง 1 ใบ            → คนนั้นได้ MVP (mvpTimes 1 · mvpVotes 1)
คนที่ไม่เคยถูกโหวต                 → 0 / 0 ไม่ใช่ rnk 1
```

#### ④ ต้องได้โหวตอย่างน้อย **3 ใบ** ถึงจะนับเป็น MVP (เพิ่ม 4 ต.ค. หลังรีวิว)

```ts
// config/scoring.ts
export const MVP_MIN_VOTES = 3;
// repositories/playerStat.repo.ts — countMvpTimes()
HAVING COUNT(*) >= ?
```

**ที่มา** — มติ ①/①b ยังเหลือสองเคสที่ *"ได้โหวตมากสุด"* ไม่ได้แปลว่า *"เด่น"*

```
โหวตทั้งแมตช์ 1 ใบ        → คนนั้นได้ MVP จากเสียงคนเดียว
โหวต 5 ใบ ให้คนละคน      → ทุกคนได้ 1 ใบ = เสมอที่อันดับหนึ่ง → MVP 5 คนจากโหวตคนละใบ
```

#### ★ ทำไม "จำนวนนับ" ไม่ใช่ "สัดส่วน 20%"

ข้อเสนอแรกในรีวิวคือ *"ต้องได้โหวตมากสุด **และ** ได้ ≥ 20% ของโหวตในแมตช์นั้น"*
ไล่ดูแล้ว **ไม่เอา** ด้วยเหตุผล 2 ข้อ

```
① ไม่แก้เคสที่เป็นต้นเรื่อง — โหวต 1 ใบ คิดเป็น 100% ผ่าน 20% สบาย
   สัดส่วนยิ่งสูงเมื่อโหวตยิ่งน้อย ⇒ กฎสัดส่วนไม่มีทางกันเคสโหวตน้อยได้เลย

② สร้างหน้าผาที่อธิบายไม่ได้
   เสมอ 5 คน = 1/5 = 20% พอดี  → ผ่านหมด → MVP 5 คน
   เสมอ 6 คน = 1/6 = 16.7%     → ไม่ผ่าน  → MVP 0 คน
   ทั้งสองคือ "ไม่มีใครเด่น" เหมือนกันเป๊ะ แต่ได้ผลตรงข้าม
```

และ 20% จะมีผลเฉพาะกีฬาที่ผู้เข้าชิงเยอะ (ผู้เข้าชิง = ผู้เล่นที่เช็คอินของสองทีม)

| กีฬา | ผู้เข้าชิง | สัดส่วนต่ำสุดที่คนนำได้ | 20% มีผล |
|---|---|---|---|
| แบดมินตันเดี่ยว | 2 | 50% | ไม่มีผลเลย |
| แบดมินตันคู่ | 4 | 25% | ไม่มีผลเลย |
| RoV · VALORANT · บาส | ~10 | 10% | มีผล |
| ฟุตบอล | ~22 | ~4.5% | มีผลบ่อย |

⇒ เป็นกฎที่ออกฤทธิ์ไม่เท่ากันข้ามกีฬา ขณะที่ขั้นต่ำแบบจำนวนนับออกฤทธิ์เหมือนกันทุกกีฬา

| เคส | ไม่มีกฎ | 20% | **ขั้นต่ำ 3** |
|---|---|---|---|
| โหวต 1 ใบ | ได้ 🔴 | ได้ 🔴 | **ไม่ได้** ✅ |
| โหวต 5 ใบ คนละคน | MVP 5 คน 🔴 | MVP 5 คน 🔴 | **ไม่มีใครได้** ✅ |
| โหวต 6 ใบ คนละคน | MVP 6 คน 🔴 | ไม่มีใครได้ ✅ | **ไม่มีใครได้** ✅ |
| ฟุตบอล 20 โหวต คนนำได้ 3 จากสนาม 12 คน | ได้ | ไม่ได้ | ได้ |

แถวสุดท้ายคือแถวเดียวที่สองกฎให้คำตอบต่างกัน — คนนั้นคือผู้เล่นที่ได้เสียงมากสุดจริง
และรางวัลในกีฬาจริงก็ตัดสินด้วยเสียงมากสุดแบบนี้ ⇒ ให้เขาไปไม่ผิด

#### ★ `HAVING` อยู่ก่อน window function — ไม่ทำให้ลำดับเพี้ยน

```
HAVING คัดกลุ่มที่ไม่ถึงขั้นต่ำออกก่อน แล้ว RANK() จึงจัดอันดับเฉพาะคนที่ผ่าน
⇒ ไม่มีเคส "คนอันดับสองได้ MVP เพราะอันดับหนึ่งถูกตัด"
  เพราะถ้าคนที่มากสุดยังไม่ถึงขั้นต่ำ คนที่ต่ำกว่าก็ไม่ถึงอยู่แล้ว
```

#### ⚠️ ขอบเขตของขั้นต่ำ — ใช้กับ `mvpTimes` เท่านั้น ไม่ใช้กับ `mvpVotes`

```
แมตช์ที่โหวตไม่ถึง 3 ใบ  →  ไม่มี MVP  แต่โหวตพวกนั้น **ยังนับใน mvpVotes**
```

ตั้งใจแบบนี้: `mvpVotes` คือ *"มีคนโหวตให้เท่าไร"* ซึ่งเป็นความจริงไม่ว่าจะถึงขั้นต่ำหรือไม่
ขั้นต่ำเป็นเงื่อนไขของ **การได้รางวัล** ไม่ใช่ของการถูกโหวต

#### ⚠️ ราคาที่ยอมรับ

ผู้โหวตคือคนที่ **ไม่ได้อยู่ในทีมที่ลงแข่ง** (`MVP_VOTER_NOT_ELIGIBLE`)
⇒ แมตช์รอบแรกของทัวร์เล็กอาจมีโหวต 0-2 ใบจริง แล้วไม่มี MVP เลย
ถือว่าถูกกว่าการแจก MVP จากเสียงเดียว · ปรับที่ `MVP_MIN_VOTES` ที่เดียวถ้าทีมเห็นต่าง

#### ตรวจจริง (ฐานชั่วคราว `od60c` · ลบแล้ว)

```
แมตช์ 1  9003 ได้ 2 ใบ (ไม่ถึง 3) · 9004 ได้ 1   →  ไม่มีใครได้ MVP      ✓
แมตช์ 2  9003 ได้ 3 ใบ (ถึงพอดี)  · 9004 ได้ 1   →  9003 ได้ (ขอบในนับ)  ✓
แมตช์ 3  เสมอ 3-3 ทั้งคู่ถึงขั้นต่ำ                →  ได้ทั้งคู่            ✓

9003  mvpVotes=8  mvpTimes=2     (8 = 2+3+3 — โหวตของแมตช์ 1 ยังนับในยอดโหวต)
9004  mvpVotes=5  mvpTimes=1
```

#### ② นับเฉพาะแมตช์ที่ **ปิดโหวตแล้ว** — เงื่อนไขชุดเดียวกับ `mvpVotes` เป๊ะ

```sql
m.actual_end_time IS NOT NULL AND m.actual_end_time <= DATE_SUB(NOW(), INTERVAL ? HOUR)
```

เหตุผลเดิมของ OD-23 ข้อ 10 ใช้ได้กับ `mvpTimes` ทุกคำ: U04 เป็น endpoint สาธารณะไม่มี middleware
ถ้านับแมตช์ที่ยังเปิดโหวต ใครก็ poll โปรไฟล์ดูว่าใครนำอยู่ได้ ทั้งที่ `GET /matches/:id/mvp-votes`
ตั้งใจไม่ส่งจำนวนโหวตออกไปเลยเพื่อกันคนแห่โหวตตามคนที่นำ

🔴 **ถ้าแก้เงื่อนไขเวลาที่ใดที่หนึ่ง ต้องแก้ทั้งสองที่** ไม่งั้นสองตัวเลขบนหน้าจอเดียวกัน
จะนับจากชุดแมตช์ต่างกันโดยไม่มีใครรู้ (เช่นขึ้นว่า *"MVP 3 ครั้ง · 2 โหวต"* ซึ่งเป็นไปไม่ได้)

#### ③ ผลแมตช์ถูกแก้/ยกทิ้งทีหลัง (S04 amend/reject) → **MVP ไม่กระทบ**

โหวตคือความเห็นเรื่อง **การเล่น** ไม่ใช่เรื่องผลแพ้ชนะ
⇒ query **ไม่มีเงื่อนไขเกี่ยวกับ `match_results` เลยโดยเจตนา** (มีเทสตรึงว่าต้องไม่มีคำนั้นใน SQL)
ผลข้างเคียงที่ตามมาและยอมรับ: แมตช์ที่ยังไม่มีผลยืนยันเลยก็นับ MVP ได้ ถ้าปิดหน้าต่างโหวตแล้ว

### ที่ตั้งใจไม่ทำ — ไม่เพิ่มตารางเก็บผู้ชนะ MVP

```
MySQL 8 มี window function ⇒ นับได้ด้วย query เดียว ไม่ต้องมีที่เก็บใหม่
```

> ⚠️ **แก้คำที่ผมประเมินผิดไว้ตอนแรก** — ผมเคยบอกว่าทางนี้ "ต้องเพิ่มที่เก็บผู้ชนะก่อน = งานใหญ่กว่า"
> ซึ่งเกินจริง · ต้นทุนการเขียนใกล้เคียงกับยอดโหวต ที่ต่างกันจริงคือ **มติย่อย 3 ข้อข้างบน**
> เก็บไว้เป็นบันทึกว่าการประเมินผิดอยู่ที่ไหน

★ `tf.match_id IN (SELECT ...)` ไม่ได้เป็นแค่การกรอง — มันคือสิ่งที่ทำให้ **ไม่ต้องจัดอันดับ
ทุกแมตช์ในระบบ** เพื่อตอบโปรไฟล์คนเดียว · จัดอันดับเฉพาะแมตช์ที่คนนั้นมีโหวตอยู่

⚠️ โหวตระดับทัวร์ของเก่า (`tf.match_id IS NULL` · ก่อนมติ 26 ก.ย. ที่ย้ายโหวตมาเป็นรายแมตช์)
**ไม่นับใน `mvpTimes`** เพราะ "เด่นสุดในแมตช์ไหน" ไม่มีความหมายเมื่อไม่มีแมตช์
ของพวกนั้นยังนับใน `mvpVotes` ตามเดิม (`JOIN` ปกติ ไม่ใช่ `LEFT JOIN` — มีเทสตรึง)

### ตรวจแล้วจริงกับระบบที่รันอยู่ (ฐานชั่วคราว `od60` · ลบแล้ว)

```
แมตช์ 1  ปิดโหวตแล้ว (จบไป 30 ชม.)   9003 ได้ 2 โหวต · 9004 ได้ 1   → 9003 เป็น MVP
แมตช์ 2  ปิดโหวตแล้ว                 9003 ได้ 1 · 9004 ได้ 1 (เสมอ) → ได้ MVP ทั้งคู่
แมตช์ 3  ยังเปิดโหวต (จบไป 1 ชม.)     9004 ได้ 3 โหวต                → ต้องไม่นับเลย
```

```
user 9003   mvpVotes=3  mvpTimes=2   ✓ (แมตช์ 1 + แมตช์ 2 ที่เสมอ)
user 9004   mvpVotes=2  mvpTimes=1   ✓ (เสมอในแมตช์ 2 · โหวต 3 ของแมตช์ 3 ไม่เข้าทั้งสองช่อง)
user 9001   mvpVotes=0  mvpTimes=0   ✓ (เป็นคนโหวต ไม่ใช่คนถูกโหวต)
ปิดสถิติ (OD-46)  mvpVotes=null  mvpTimes=null  ✓ ไม่ใช่ 0
```

★ และแมตช์ 1-3 **ไม่มีแถว `match_results` เลย** (0 แถว) แต่ MVP ยังนับ ⇒ ยืนยันมติ ③ ว่า
การนับไม่ผูกกับผลการแข่งจริง ๆ ไม่ใช่แค่ในคอมเมนต์

### เทส

```
+5 ตัว  playerStat.profileTotals.test.ts  ตรึง RANK ไม่ใช่ ROW_NUMBER · เงื่อนไขเวลาชุดเดียวกับ
        mvpVotes · ห้ามมีคำว่า match_results · JOIN ไม่ใช่ LEFT JOIN · จัดอันดับเฉพาะแมตช์ของคนนั้น
+1      stat.mapper.test.ts  ตรึงว่า mvpTimes กับ mvpVotes ต้องไม่ชี้ค่าเดียวกัน
```

## OD-59 — ตัวตนผู้บันทึกผล (S05) + รายชื่อปลายทางของกรรมการ (F02b) — ✅ ตัดสินแล้ว 2026-10-04 (ทำแล้ว)

**ปิดข้อ 2 และข้อ 8 ของ `TO-BACKEND-2026-10-01-frontend-workflows.md`**
(ข้อ 3 ของเอกสารเดียวกันปิดไปแล้วที่ OD-58 · ข้อ 4 logoUrl ไม่ใช่โมดูลนี้ ส่งต่อเจ้าของแล้ว)

---

### ① S05 คืน `submittedBy` / `submittedAt` — **แบบมีเงื่อนไข**

FE ขอมาเพราะ `toVerifiedResult` มี `submittedRole` แต่ไม่มีตัวคนและเวลา
⇒ หน้าผลแมตช์แสดงได้แค่ *"กรรมการบันทึกผล"* และหลัง reload ก็ไม่มีเวลาจริงให้แสดง
(ตัว `POST` ตอบ `submittedBy` เป็นเลข id อยู่แล้ว แต่ไม่พอสำหรับชื่อและไม่รอดการ reload)

#### ✅ มติ — ทางเลือก ก (ส่งแบบมีเงื่อนไข)

```
S05 เป็น endpoint สาธารณะเมื่อผลเป็น verified/walkover
⇒ ใส่ชื่อแบบไม่มีเงื่อนไข = เปิด "กรรมการคนไหนตัดสินแมตช์นี้" และ
  "หัวหน้าทีมคนไหนเป็นคนกรอก" ให้คนนอกเห็นทุกแมตช์ของทุกทัวร์
  ซึ่งไม่เคยมีใครตัดสินว่าเป็นข้อมูลสาธารณะ
```

| ใคร | เห็นอะไร |
|---|---|
| ORG / กรรมการของแมตช์ / หัวหน้า 2 ทีม / แอดมินที่ถึงคิว (OD-58) | `submittedBy` + `submittedAt` |
| ผู้เล่นในรายชื่อลงแข่ง | **ไม่เห็น** (ดูเหตุผลข้างล่าง) |
| คนนอก / ไม่ล็อกอิน | เห็นแค่ `submittedRole` เหมือนเดิมเป๊ะ |

**ใช้กลุ่มเดียวกับ "ตัวคำค้าน" ไม่ใช่กลุ่มของ "คำวินิจฉัย"** — คำวินิจฉัย (มติ 30 ก.ย.)
ขยายถึงผู้เล่นทุกคนเพราะมันเป็นข้อความที่ผู้จัด **เขียนให้ผู้เล่นอ่าน**
ส่วนชื่อคนกรอกผลไม่ใช่ข้อความที่เขียนให้ใครอ่าน จึงไม่มีเหตุให้ขยายตาม

#### ★ ไม่มีคีย์ ≠ ได้ `null`

```
ไม่มีคีย์เลย   = คุณไม่มีสิทธิ์รู้
submittedBy: null = บัญชีผู้ส่งถูกลบไปแล้ว (LEFT JOIN ไม่เจอ)
```

ถ้าใช้ `null` แทนทั้งสองความหมาย FE จะแยกไม่ออกว่า *"ไม่มีสิทธิ์"* กับ *"คนหายไปจากระบบ"*
⇒ ใช้ conditional spread แบบเดียวกับ 6 ฟิลด์ข้อโต้แย้ง (มีคอมเมนต์เดิมกำกับหลักนี้ไว้อยู่แล้ว)
และ `submittedAt` ยังมีค่าแม้ `submittedBy` เป็น null — **คนหาย ไม่ใช่เวลาหาย**

#### ที่ตั้งใจทำแยก — query ใหม่ ไม่เติม JOIN ของเดิม

```
findResultWithSubmitter()    ← ใหม่ · ใช้โดย S05 เท่านั้น · LEFT JOIN users
findmatchResultByMatchId()   ← เดิม · ถูกเรียกจาก middleware ด่านสิทธิ์ · autoVerify · amend ฯลฯ
```

ถ้าไปเติม JOIN ในตัวเดิม ทุกการเช็คสิทธิ์ของทุกคำขอจะจ่าย JOIN เพิ่มเพื่อฟีเจอร์ของ endpoint เดียว

---

### ② F02b `GET /tournaments/:id/referees/assignable`

```
ปัญหา: F02 (GET /tournaments/:id/referees) ติด requireOrganizer
       ⇒ หน้าของกรรมการเรียกไม่ได้ · FE จึงไปรวบรวมปลายทางจาก F12 ของแมตช์อื่นในทัวร์
       ⇒ **กรรมการที่ active แต่ยังไม่ได้รับแมตช์เลย ไม่โผล่ในตัวเลือกปลายทาง**
          ซึ่งเป็นคนที่ควรโผล่ที่สุด เพราะว่างที่สุด
```

#### ✅ มติ — ทางเลือก ก (เส้นใหม่) ไม่ใช่ ข (ผ่อน `requireOrganizer` ของ F02)

```
F02 คืน isExternal · externalApprovalStatus · awaitingAdminCount
    = เรื่องเอกสารตัวตนของคน และข้อมูลการจัดการของผู้จัด
⇒ เปิด F02 ให้กรรมการ = เปิดเกินที่งานนี้ต้องใช้ ⇒ ทำเส้นใหม่ที่คืนเท่าที่ต้องใช้พอดี
```

```jsonc
{ "items": [ { "id": 25, "user": { "id": 9003, "fullName": "...", "avatarUrl": null },
               "upcomingMatchCount": 1 } ] }
```

| ตัดสินใจ | เหตุผล |
|---|---|
| กรอง "ใช้งานได้จริง" **ในSQL** | คนที่รอตอบ/ถูกปฏิเสธ/ถูกถอดไม่หลุดออกไปถึงปลายทางเลย แม้ FE เผลอไม่กรอง · นิยามตรงกับ `toRefereeStatus()==='active'` และ UNIQUE ของ migration 036 ⇒ **ไม่เกิน 1 แถวต่อคนโดยฐานการันตี ไม่ใช่โดย MAX(id)** |
| `id` = `tournamentRefereeId` | เป็นตัวที่ `POST` ของ FR01/FR03 ต้องใช้ · FE ขอมาเองว่าไม่เดาจาก userId |
| ตัดผู้เรียกเองออก | ไม่มีใครขอโอนแมตช์ให้ตัวเอง · ฝั่ง POST ปฏิเสธอยู่แล้ว แต่ไม่ควรให้กดไปถึงตรงนั้น |
| `upcomingMatchCount` | FE ขอ "สถานะพร้อมรับงาน" · นี่คือวิธีตอบที่ไม่เปิดข้อมูลส่วนตัวอะไรเลย — นับแมตช์ของทัวร์นี้ที่ยัง `scheduled` · เรียงจากว่างสุด |
| คนนอกได้ **403 ไม่ใช่ลิสต์ว่าง** | ลิสต์ว่างทำให้ FE เข้าใจว่า "ทัวร์นี้ไม่มีกรรมการ" ซึ่งเป็นคำตอบที่ผิด |
| ด่านสิทธิ์อยู่ที่ service ไม่ใช่ middleware | ต้องถามฐานว่า "คนนี้เป็นกรรมการที่ใช้งานได้จริงของทัวร์นี้ไหม" ซึ่งเป็นคำถามเดียวกับที่ service ตอบอยู่แล้ว (`findActiveRefereeRow`) — ไม่ควรมีสองที่ที่ตอบคำถามเดียวกัน |

---

### ตรวจแล้วจริงกับระบบที่รันอยู่ (ฐานชั่วคราว `od59` · ลบแล้ว)

**F02b — ทัวร์ 1 มีแถว `removed_at IS NULL` อยู่ 3 แถว ซึ่งเป็นเคสทดสอบที่ดีมาก**

```
tr 14  user 9002  internal accepted            → active  ✓ อยู่ในผล
tr 24  user 9003  external accepted + rejected → ไม่ active ✗ ไม่อยู่ในผล  ← SQL กรองถูก
tr 25  user 9003  external accepted + approved → active  ✓ อยู่ในผล
```

```
ผู้จัด          200  [{id:25,user:9003,upcoming:1},{id:14,user:9002,upcoming:2}]
กรรมการ 9002    200  [{id:25,user:9003,upcoming:1}]          ← ไม่เห็นตัวเอง
กรรมการ 9003    200  [{id:14,user:9002,upcoming:2}]          ← ไม่เห็นตัวเอง (ทั้ง tr 24 และ 25)
แอดมินคณะ(คนนอกทัวร์)  403 NOT_TOURNAMENT_REFEREE
ไม่ล็อกอิน      401 NO_TOKEN
```

**S05 — แมตช์ 10 (walkover = ผลสาธารณะ)**

```
ไม่ล็อกอิน      200  submittedRole=organizer · ไม่มีคีย์ submittedBy/submittedAt
คนนอกที่ล็อกอิน 200  เหมือนกันเป๊ะ
ผู้จัด           200  submittedBy={id:9001,fullName:...,avatarUrl:null}
                      submittedAt=2026-09-18T07:56:18.000Z
```

### ③ F02 `MAX(id)` — ตรวจแล้ว **ไม่แก้ query** ติดคอมเมนต์เตือนไว้แทน (ข้อ 7 ของเอกสาร FE)

FE รายงานว่า `findLatestPerUserByTournament` เลือก `MAX(id)` ก่อนแล้วค่อยกรอง `removed_at`
ซึ่งตอบผิดถ้า **ใบเก่า active + ใบใหม่ไม่ active** · ตรวจแล้ว **สถานะนั้นสร้างไม่ได้แล้ว**

```
ด่าน 1  การเชิญอ่าน "ทุกใบที่ยังมีผล" (1 ต.ค. · หลัง baseline ของเอกสาร FE)
        มีใบ active อยู่ → เชิญใบใหม่ไม่ได้ (409) ⇒ ใบใหม่เกิดได้เฉพาะตอนใบเก่าไม่ active
ด่าน 2  migration 036 — ฐานบังคับ 1 คน = ไม่เกิน 1 ใบที่ใช้งานได้ต่อทัวร์
ด่าน 3  rejectUser() ตัดสิน "ต่อคน" — UPDATE ทุกใบของคนนั้น ไม่กรองทัวร์ ไม่กรอง removed_at
        ⇒ ไม่มีทางเหลือใบ approved เก่าค้างคู่กับใบใหม่ที่ rejected
```

⇒ ลำดับที่เกิดได้จริงคือ **ใบที่ใช้งานได้มี id มากกว่าเสมอ**
ยืนยันกับข้อมูลจริง: ทัวร์ 1 user 9003 มี `tr 24` (external rejected) คู่กับ `tr 25` (approved)
ทั้งคู่ `removed_at IS NULL` · `MAX(id)` = 25 = ใบที่ active ⇒ ตอบถูก

**🔴 แต่ความถูกต้องไม่ได้อยู่ในตัว query — มันยืมมาจากด่าน 1-3**
⇒ ใครรื้อด่านการเชิญหรือกฎ re-invite ของ F-15 แล้ว F02 จะเพี้ยนเงียบ ๆ
**ไม่มีเทสไหนแดง** เพราะเทสของ F02 ทดสอบ "คืนอะไร" ไม่ได้ทดสอบสถานะที่ด่านอื่นห้ามไว้

```
✅ มติ: ติดคอมเมนต์เตือนที่หัว query (พร้อมวิธีแก้ที่เตรียมไว้) · ไม่แตะ SQL
   เหตุผลที่ไม่แก้เลย: ทางแก้ (ย้าย removed_at IS NULL เข้า subquery) เปลี่ยนพฤติกรรม 1 เคส
   — ใบใหม่ถูกถอด + ใบเก่า declined ยังอยู่ · เดิมคนนั้นหายจาก F02 · ใหม่โชว์เป็น declined
   ซึ่งถูกกว่าแต่เป็นการเปลี่ยนสัญญาที่ FE อ่านอยู่ ⇒ ไม่ควรเปลี่ยนเงียบ ๆ พร้อมงานอื่น
```

**🔴 fixture ที่ FE ขอในข้อเดียวกันสร้างไม่ได้แล้ว** — *"old approved active + newer rejected/removed"*
ขัดกับด่าน 1+2 โดยการออกแบบ ⇒ ต้องบอกเขาว่าเลิกรอ fixture นั้น
(*"private tournament + pending invitee"* ยังสร้างได้ และยังไม่มีใครทำ)

### เทส

```
+6 ตัว  matchResult.adminDisputeRead.test.ts  (คนนอกไม่มีคีย์ · ผู้จัด/หัวหน้าทีม/แอดมินเห็น
        · บัญชีถูกลบ → null แต่เวลายังมี · ไม่มี submitted_at → null ไม่ระเบิด)
+9 ตัว  referee.assignable.test.ts            (ใครเรียกได้ · ตัดตัวเอง · คืนแค่ 3 คีย์
        · id เป็น tournamentRefereeId · COUNT() ที่มาเป็น string ต้องกลายเป็น number)
```

★ เทสที่ตรึงว่า DTO มี **แค่ 3 คีย์** (`Object.keys().sort()`) มีไว้เพื่อให้การเผลอเพิ่ม
ฟิลด์เอกสารตัวตนเข้าไปในอนาคตทำให้เทสแดง ไม่ใช่หลุดออกไปเงียบ ๆ

## OD-58 — แอดมินที่ตัดสินข้อโต้แย้งได้ แต่อ่านเรื่องไม่ได้ — ✅ ตัดสินแล้ว 2026-10-04 (แก้แล้ว)

**มาจาก `TO-BACKEND-2026-10-01-frontend-workflows.md` ข้อ 3** (FE แจ้งมา 1 ต.ค. · ตรวจแล้วยังจริงเมื่อ 4 ต.ค.)

### ปัญหา — ทางตันจริง ไม่ใช่แค่ไม่สะดวก

```
requireCanResolveDispute   university_wide admin กด S04 ได้หลัง ORG_RESOLVE_HOURS (48 ชม.)
                           ← OD-26 ข้อ 10 · จำเป็นเพราะรอบชิง/round robin ไม่มีแมตช์ถัดไปมากดดันผู้จัดที่หายไป

canSeeUnfinishedResult     รับแค่ ORG / กรรมการของแมตช์ / หัวหน้า 2 ทีม
                           ← ไม่มีแอดมิน ⇒ S05 ของผลที่ยังไม่ final ตอบ 404 · S03b ตอบ 403
```

⇒ **แอดมินมีอำนาจตัดสิน แต่อ่านสกอร์ที่ถูกค้าน คำค้าน และหลักฐานไม่ได้เลย**
FE จึงไม่เปิดปุ่มตัดสินให้ (ถูกต้องแล้ว — ปุ่มที่กดโดยไม่มีข้อมูลคือปุ่มที่ทำให้ตัดสินมั่ว)
= บันไดสำรองของ OD-26 ข้อ 10 **ไม่เคยใช้งานได้จริง**

> ★ รูปแบบเดียวกับ OD-55 ที่เจอเมื่อ 4 ต.ค. — **ให้อำนาจกดแต่ไม่ให้ของที่ต้องใช้กด**
> สองครั้งในสองวันแปลว่าเป็นรูปแบบความผิดพลาดของเรา ไม่ใช่อุบัติเหตุเดี่ยว
> ⇒ **เพิ่มด่านกด ต้องถามทุกครั้งว่า "คนนี้อ่านของที่ต้องใช้ได้หรือยัง"**

### ✅ มติ — ขอบเขตการอ่าน **ผูกกับขอบเขตการกดเป๊ะ ๆ**

```ts
// services/matchResult.service.ts — canSeeUnfinishedResult()
const admin = await AdminRepo.findAdminByUserId(userId);
if(!admin || admin.scope_type !== 'university_wide') return false;
const result = await MatchResRepo.findmatchResultByMatchId(matchId);
return isAdminTakeoverOpen(result?.dispute_raised_at ?? null);
```

**ไม่กว้างกว่าและไม่แคบกว่าด่านกด** — ใช้ `isAdminTakeoverOpen` ตัวเดียวกัน

| | ก่อน | หลัง |
|---|---|---|
| S05 ผลที่ยังไม่ final (แอดมิน · ครบ 48 ชม.) | 404 | ✅ อ่านได้ พร้อม 6 ฟิลด์ข้อโต้แย้ง |
| S03b (แอดมิน · ครบ 48 ชม.) | 403 | ✅ อ่านได้ พร้อมหลักฐาน presigned |
| แอดมิน แต่ยังไม่ครบ 48 ชม. | 404 / 403 | **ยัง 404 / 403** (ผู้จัดยังมีเวลาของเขา) |
| แอดมินคณะ (faculty) | 404 / 403 | **ยัง 404 / 403** |
| คนนอกทั่วไป | 404 / 403 | **ยัง 404 / 403** |

### ★ สูตรเวลาย้ายไปอยู่ที่เดียว — นี่คือส่วนที่สำคัญกว่าตัวสิทธิ์

```
utils/disputeTakeover.ts    adminTakeoverOpensAt() · isAdminTakeoverOpen()
  ใช้โดย  requireCanResolveDispute  (ด่านกด — คงข้อความ error เฉพาะของตัวเองไว้)
          canSeeUnfinishedResult    (ด่านอ่าน)
```

เดิม middleware คำนวณ `raisedAt + ORG_RESOLVE_HOURS` เองในบรรทัดของมัน
ถ้าปล่อยไว้แล้วเพิ่มการคำนวณชุดที่สองในฝั่ง service จะได้ **สองนาฬิกาที่ต้องตรงกันเอง**
⇒ วันหนึ่งมีคนแก้ที่เดียว จะได้ *"อ่านได้แต่กดไม่ได้"* หรือ *"กดได้แต่อ่านไม่ได้"* กลับมา
**ซึ่งเป็นบั๊กที่ไม่มี error ฟ้องและไม่มีเทสไหนแดง** (แบบเดียวกับที่เพิ่งแก้)

### ที่ตั้งใจไม่ทำ

**ไม่เช็คว่าเรื่องถูกตัดสินไปแล้วหรือยัง** — `requireCanResolveDispute` ก็ไม่เช็ค
มันดูแค่ `dispute_raised_at` กับเวลา ⇒ แอดมินอ่านเรื่องที่ตัดสินแล้วได้ด้วย
ถ้าเห็นว่ากว้างเกิน **ต้องแคบทั้งสองที่พร้อมกัน** ไม่ใช่แคบฝั่งอ่านฝั่งเดียวแล้วกลับไปไม่ตรงกันอีก
(เป็นคำถามที่มีมาก่อน OD-58 ไม่ได้เกิดจากงานนี้ — ยกมาบอกไว้ ไม่ได้แก้)

**ไม่แตะ `requireCanResolveDispute`** นอกจากให้มันเรียกสูตรกลาง — พฤติกรรมและข้อความ error เดิมทุกตัว

### เทส

```
11 ตัวใหม่  services/__tests__/matchResult.adminDisputeRead.test.ts
  S05  แอดมิน+ครบเวลา อ่านได้และเห็นตัวคำค้าน · ยังไม่ครบเวลา 404 · faculty 404
       ไม่มีข้อโต้แย้งเลย 404 · คนนอก 404 · ผู้จัดอ่านได้และ **ไม่ไปถาม AdminRepo เลย**
  S03b แอดมินอ่านคำค้าน + ได้หลักฐานเป็น presigned URL · ยังไม่ถึงคิว 403
  utils ขอบเวลา: ตรงเวลาพอดี = เปิดแล้ว · ก่อนหน้า 1 ms = ยังไม่เปิด · null = ไม่เปิดตลอด
```

★ เทส *"ผู้จัดอ่านได้และไม่ไปถาม AdminRepo"* ตรึงไว้ว่าเส้นทางปกติไม่ยิง query เพิ่ม —
การเพิ่มสิทธิ์ให้แอดมินไม่ควรทำให้ทุกคำขอของทุกคนแพงขึ้น

### ยังเหลือจากเอกสารฉบับเดียวกัน (ไม่ได้ทำในรอบนี้)

```
ข้อ 2  S05 ขาด submittedBy / submittedAt    ← ต้องตัดสินเรื่องสิทธิ์ก่อน (ผลที่ verified เป็นสาธารณะ)
ข้อ 8  ไม่มี read API ให้กรรมการเห็นกรรมการ active คนอื่น  ← ต้องตัดสิน route/DTO/permission
ข้อ 5  team follow · ยอด MVP สะสม           ← ต้องตกลง contract/metric
ข้อ 4  logoUrl ใน MyTeam/TeamRef            ← ไม่ใช่โมดูลนี้ ส่งต่อเจ้าของแล้ว
```

## OD-57 — AV02 resend-verification เลิกตอบ 429 — ✅ ตัดสินแล้ห้า 2026-10-04 (แก้แล้ว)

**กลับมติของ OD-54 ที่เขียนไว้ว่า "429 ของ AV02 ไม่ผิด เก็บไว้"**

### ที่มา — เจอตอนทดสอบ OTP จริงทั้งเส้น (ไม่ใช่จากการอ่านโค้ด)

ตั้ง mailpit + ฐานชั่วคราว `otp_check` + เซิร์ฟเวอร์จริง แล้วไล่ทั้งเส้น ได้ผลนี้

```
resend ไปอีเมลที่ "มีจริงและยังไม่ยืนยัน"   200 · 200 · 429 · 429
resend ไปอีเมลที่ "ไม่มีในระบบ"             200 · 200 · 200 · 200
```

⇒ **ยิง 3 ครั้งแล้วดูว่าได้ 429 มั้ย = คัดกรองบัญชีที่ "มีจริงและยังไม่ยืนยัน" ได้**

### ★ ทำไมเหตุผลเดิมถึงไม่พอ — ทั้งที่ตอนนั้นคิดแล้วและเขียนกำกับไว้ 3 ที่

เหตุผลเดิม: *"`A01 register` บอกอยู่แล้วว่าอีเมลไหนซ้ำ ⇒ ไม่มีความลับให้รักษา"*

```
register  บอกว่า  "อีเมลนี้มีบัญชี"                 ← จริง และเลี่ยงไม่ได้ (ต้องบอกคนสมัคร)
AV02 429  บอกว่า  "อีเมลนี้มีบัญชี + ยังไม่ยืนยัน"   ← register ไม่ได้บอกข้อหลัง
```

**บิตที่เพิ่มมาไม่ใช่บิตเปล่า** — บัญชีที่ยังไม่ยืนยันอีเมลคือบัญชีที่เจ้าตัว
**ยังไม่ได้พิสูจน์ว่าคุมอีเมลนั้นอยู่จริง** ⇒ เป็นกลุ่มที่น่าสนใจเป็นพิเศษสำหรับคนที่จะไปลองยึดบัญชี
การให้ใครคัดกรองกลุ่มนี้ออกมาได้ด้วย 3 request จึงไม่ใช่ "ไม่ให้สิทธิ์อะไรกับใคร" อย่างที่ประเมินไว้

> 🔴 **ไม่ใช่การลืม** — ตอน OD-53 ชั่งน้ำหนักแล้วและเขียนกำกับไว้ใน 3 ที่
> (คอมเมนต์หัวฟังก์ชัน · OD-54 · `GUIDE/06` §หมายเหตุใต้ตาราง A)
> ที่ผิดคือ**การประเมินน้ำหนักของบิตนั้น** ไม่ใช่การมองไม่เห็นมัน
> ⇒ บันทึกไว้แบบนี้เพราะ "เคยคิดแล้วแต่คิดผิด" กับ "ไม่เคยคิด" ต้องแก้ด้วยวิธีต่างกัน

### ✅ มติ — คืน 200 เหมือนกันหมดทุกเคส

```ts
// backend/src/services/auth.service.ts
if(issuedCount >= OTP_RATE_LIMIT_PER_HOUR){
    return SUCCESS;        // เดิม: throw new AppError(429 , 'RATE_LIMITED' , ...)
}
```

**กลไกกัน rate limit ไม่ได้ถูกถอด** — ยังไม่ออกใบใหม่และไม่ส่งเมลเหมือนเดิม
ที่เอาออกคือ**การประกาศ**ว่าถูกกันไว้ เท่านั้น (มีเทสตรึงทั้งสองข้อ)

### 🔴 ราคาที่ต้องจ่าย และวิธีชดใช้ที่ตกลงกันแล้ว

ผู้ใช้จริงที่เกินโควตาจะได้ `200` แล้วนั่งรอเมลที่ไม่มา — **แย่กว่าเดิมในมุม UX**
และปัญหานี้ไม่ได้เพิ่งเกิด: ผิดรหัสครบ 5 ครั้งใบนั้นตาย ต้องขอใหม่ แต่ขอได้แค่ 3 ครั้ง/ชม.
(ใบที่ register ออกให้นับเป็นใบที่ 1) ⇒ คนที่ซวยจริงติดล็อกได้ถึง 1 ชั่วโมง

```
✅ มติ 4 ต.ค. — ชดใช้ที่ฝั่ง FE ไม่ใช่ที่ response
   ① หน่วงปุ่ม "ขอรหัสใหม่" 60 วินาทีทุกครั้งที่กด
   ② เขียนกติกาไว้ข้างปุ่ม "ขอรหัสใหม่ได้ 3 ครั้งต่อชั่วโมง"
   ⇒ คนที่รู้กติกาล่วงหน้าไม่ต้องให้ response มาบอก
      คนสอดรู้ก็ไม่ได้อะไรจากคำตอบ เพราะทุกคำตอบเหมือนกันหมด
```

**แจ้ง FE แล้ว** · ยังรอเขายืนยันว่าทำสองข้อนี้

### ที่ยังไม่ปิด และไม่ควรอ้างว่าปิด

```
"อีเมลนี้มีบัญชีหรือไม่"  ยังรู้ได้จาก A01 register ด้วย 1 request  ← ตั้งใจ เลี่ยงไม่ได้
เวลาตอบของ A04/AV02      ยังต่างกันตามธรรมชาติ (bcrypt + SMTP ของบัญชีจริง)
```

ปิดไปเฉพาะบิต *"ยืนยันอีเมลแล้วหรือยัง"* ซึ่งเป็นบิตที่ไม่มีเหตุผลให้คนนอกรู้

## OD-56 — Pick'em ทายเป็นสกอร์ · คิดแต้ม 3 ชั้น — ✅ ตัดสินแล้วครบ 2026-10-04 (ทำแล้ว)

**ทำครบแล้วทั้งสามก้าว**
ก้าวที่ 1 · เก็บสกอร์ที่ทาย + อนุมานผู้ชนะ (migration 038 · E26)
ก้าวที่ 2 · แต้ม 3 ชั้น + `tolerance` ต่อกีฬา (migration 039 · `utils/pickemScore.ts`)
ก้าวที่ 3 · เปลี่ยน `tolerance` เป็น **เส้นสองเส้นต่อฝั่ง** (migration 040) — ดูมติข้อ ⑦

### ที่มา

อยากให้คนที่ทายไม่ถูกแต่ใกล้เคียงได้คะแนนด้วย · แต่ของเดิมเก็บแค่ `predicted_winner_team_id`
ซึ่งเป็นค่าสองทาง

```
ทาย A ชนะ   ผลจริง B ชนะ   →  ผิด
ทาย B ชนะ   ผลจริง B ชนะ   →  ถูก
                               ไม่มีสถานะที่สาม ไม่มีอะไรวัดระยะห่างได้
```

⇒ **"ใกล้เคียง" ไม่ได้อยู่ในข้อมูลเลย** ต้องเก็บสกอร์ก่อนจึงจะมีอะไรให้คิดคะแนน
(ทำตอนนี้ถูกจังหวะ: `pickem_predictions` มี **0 แถว** — ไม่มีข้อมูลเก่าให้ย้าย)

### ✅ มติข้อ ① — บังคับทายสกอร์ · ผู้ชนะมาจากการอนุมาน

```
request   { scoreData: { "<teamId>": n, "<teamId>": n } }
          ★ ไม่มี teamId อีกแล้ว — ฝั่งที่แต้มมากกว่าคือผู้ชนะที่ทาย
```

**ทำไมไม่ให้ส่งทั้งสองอย่าง** — จะเปิดช่องให้ `teamId` กับ `scoreData` ขัดกันเอง
แล้วต้องมีกฎว่าเชื่ออันไหน ซึ่งเป็นกฎที่ไม่มีใครจำได้และผิดได้เงียบ ๆ

`predicted_winner_team_id` **ยังอยู่และยังเป็น NOT NULL** แต่เปลี่ยนที่มาเป็น derived column
ที่ materialize ไว้ — เหตุผลที่ไม่ลบอยู่ในหัว migration 038 (5 ที่อ่านคอลัมน์นี้อยู่)

### ✅ มติข้อ ② — ทายฝั่งผิด = 0 เสมอ ไม่ว่าสกอร์จะใกล้แค่ไหน

**ข้อนี้ลบปัญหา 3 ข้อที่เตรียมจะเกิดไปพร้อมกัน**

```
① SUM(points_earned > 0) AS correct   ใน E28/E29
   ถ้าฝั่งผิดได้แต้มด้วย ช่องนี้จะกลายเป็น "ได้แต้มบ้าง" ไม่ใช่ "ทายถูก"
   ⇒ คนที่ทายฝั่งผิดทุกนัดจะโชว์ว่า "ทายถูก N นัด" และ rank ก็ใช้ช่องนี้ตัดการเสมอด้วย
   ⇒ อันดับเพี้ยนทั้งตาราง · กฎข้อ ② ทำให้ไม่ต้องแก้และไม่ต้องเพิ่มคอลัมน์

② pickStatus() คืน won เมื่อ points_earned > 0
   ถ้าฝั่งผิดได้แต้ม คนทายผิดจะเห็นคำว่า "ทายถูก" ในประวัติตัวเอง
   ⇒ กฎข้อ ② ทำให้ไม่ต้องมีสถานะที่สาม

③ ความไม่ยุติธรรมข้ามกีฬา
   score_data ไม่มีเพดาน (ฟุตบอล 2-1 · บาส 98-95 · แบด 21-19)
   ถ้าให้คะแนนคนทายฝั่งผิดตามระยะห่าง คนทายฟุตบอลได้เปรียบตั้งแต่ฐาน
   ⇒ กฎข้อ ② ทำให้ทุกคนได้ "คะแนนพื้น" เท่ากันจากการทายฝั่งถูก
      ส่วนที่ต่างตามกีฬาเหลือแค่โบนัสที่ทับลงไป ไม่แตะฐาน
```

> 🔴 **ถ้าวันหนึ่งเปลี่ยนใจให้ฝั่งผิดได้แต้มด้วย ต้องกลับไปแก้ ① กับ ② พร้อมกัน**
> ไม่งั้นช่อง "ทายถูก" กับสถานะ won/lost จะโกหกเงียบ ๆ โดยไม่มีเทสไหนแดง
> (เขียนกำกับไว้บน `PICKEM_POINTS` ใน `pickem.repo.ts` แล้ว)

### ✅ มติข้อ ③ — ทายเสมอ → 422 `PICK_SCORE_TIE`

`ensureScoreData` ของผลการแข่งบังคับว่าผู้ชนะต้องแต้มมากกว่าอยู่แล้ว ⇒ ระบบไม่รองรับผลเสมอ
ถ้าทายเท่ากันก็อนุมานผู้ชนะไม่ได้ · ใช้กฎ key ชุดเดียวกับ `ensureScoreData` โดยเจตนา
ถ้าสองฝั่งใช้กฎไม่ตรงกัน จะมีเคสที่ "ทายได้แต่ผลจริงใส่ไม่ได้" แล้วการเทียบสกอร์จะเจอรูปร่างที่ไม่คาด

### ✅ มติข้อ ④ — คอลัมน์ใหม่ NULL ได้

ฐานผมมี 0 แถว **แต่เครื่องเพื่อนอาจมีการทายค้างจากที่เทสไว้** ถ้าใส่ `NOT NULL`
(JSON ใส่ default ตรง ๆ ไม่ได้ใน MySQL 8) migration จะล้มบนเครื่องพวกนั้น

⇒ `NULL = แถวก่อน migration 038` · ตอนคิดคะแนนถือว่า "ทายแค่ฝั่ง" ได้คะแนนพื้นถ้าฝั่งถูก
ไม่มีสิทธิ์ได้โบนัสสกอร์ · **ของใหม่บังคับมีสกอร์ ด่านอยู่ที่ schema ไม่ใช่ที่ฐาน**

### 🔴 ค่าใช้จ่ายที่รับไว้ — พังของที่ FE ทำไปแล้ว

**เป็นครั้งแรกในรอบนี้ที่งานฝั่ง BE พังของที่ FE เขียนเสร็จแล้ว**

```
origin/feat/1  frontend/src/api/liveEngagement.ts:30
  apiFetch<{ matchId; teamId; changed }>(`/matches/${id}/predictions`,
    { method: 'POST', ...json({ teamId }) })        ← ส่ง teamId
  SocialBar.tsx:109  "predict the winner"           ← ข้อความบนหน้าจอ
```

**ลดแรงกระแทกด้วยการคง `teamId` ไว้ใน response** (= ผู้ชนะที่อนุมานได้)
⇒ type ที่ FE รับกลับยังใช้ได้ **แก้แค่ฟอร์มขาส่ง** · แจ้งไว้ใน `FE-Notice-2026-10-04-pickem-score.md`

### ✅ มติข้อ ⑤ — สูตร 3 ชั้น + `tolerance` ต่อกีฬา

```
ฝั่งถูก + ทุกฝั่งคลาด ≤ pickem_tolerance_exact    spot_on     10
ฝั่งถูก + ทุกฝั่งคลาด ≤ pickem_tolerance_close    close        7
ฝั่งถูก                                           side_only    4
ฝั่งผิด                                           wrong_side   0
```

**ความคลาดวัด "ต่อฝั่ง" และชั้นถูกตัดสินด้วยฝั่งที่แย่กว่า** (แก้ในก้าวที่ 3 · มติข้อ ⑦)
เช่นบาส ทาย 50-39 ได้จริง 52-45 → คลาด 2 กับ 6 → ยึด 6

> ★ ชื่อชั้นสูงสุดคือ `spot_on` ไม่ใช่ `exact` — เพราะในบาส (เส้น 5) คลาดได้ถึง 5 แต้มต่อฝั่ง
> แล้วยังอยู่ชั้นนี้ · ถ้าเรียก `exact` จะหลอกคนอ่านโค้ดว่าต้องตรงเป๊ะ
> (ชื่อนี้ไม่เคยออก API — FE เห็นแค่ `pointsEarned` ⇒ เปลี่ยนได้ไม่กระทบใคร)

ตัวเลขอยู่ที่ `config/scoring.ts` (`PICKEM_TIER_POINTS`) · สูตรอยู่ที่ `utils/pickemScore.ts`

**สเกล: ตัวเลือก ก — เพดานคงที่ 10 · spot_on : side_only = 2.5 เท่า**
เพดานเดิมไม่เปลี่ยน ⇒ เอกสารกับคอมเมนต์แก้น้อยสุด และ 2.5 เท่าเป็นอัตราที่ pool ฟุตบอลจริง
ใช้กันมากสุด — ไม่ใจดีเกินไปกับคนทายลั่วเดา และไม่ทุ่มคนที่ทายแค่ฝั่งถูก
(มีเทสตรึงอัตรานี้ไว้ กันการขยับโดยไม่ตั้งใจ)

### ★ ทำไมชั้นกลางเป็น "คลาดไม่เกิน tolerance" ไม่ใช่ "ผลต่างตรง" ตามที่คุยไว้ตอนแรก

ไล่กีฬาจริงทั้ง 5 ของระบบแล้วพบว่าข้อเสนอเดิมใช้ไม่ได้

| กีฬา | สากลนับเป็น | ช่วงจริง | `walkover_score` |
|---|---|---|---|
| ฟุตบอล | **แต้มจริง** (ประตู) | 0–5 | 3-0 |
| บาสเกตบอล | **แต้มจริง** | 50–120 | 20-0 |
| แบดมินตัน | **เกมที่ชนะ** (2 ใน 3 เกม เกมละ 21) | 0–2 | 2-0 |
| E-Sport: RoV | **เกมที่ชนะ** (Bo3/Bo5) | 0–2 | 2-0 |
| E-Sport: VALORANT | **แมปที่ชนะ** (Bo1/Bo3) | 0–2 | 2-0 |

**① ในกีฬาที่นับเป็นเกม ชั้น "ผลต่างตรง" ซ้ำกับชั้น "สกอร์เป๊ะ" 100%**

```
Bo3 ผู้ชนะต้องได้ 2 เกม  ⇒  สกอร์ที่เป็นไปได้มีแค่  2-0 (ผลต่าง 2)  กับ  2-1 (ผลต่าง 1)
                            รู้ว่าใครชนะ + รู้ผลต่าง = รู้สกอร์เป๊ะทันที
```

⇒ ชั้นนั้น **ไม่ให้คะแนนใครเพิ่มเลยใน 3 จาก 5 กีฬา** (มีเทสตรึงว่ากีฬานับเกมมีได้แค่ 2 ชั้น)

**② ความยากของชั้น "สกอร์เป๊ะ" ต่างกันคนละโลก**

```
แบด/RoV/VALORANT   ทายฝั่งถูกแล้วเหลือ 2 ทางเลือก   →  ลุ้นได้ ~50%
ฟุตบอล             สกอร์ที่เจอจริงราว ๆ 10 แบบ      →  ~10-20%
บาสเกตบอล          98-95 ต้องเป๊ะทั้งสองตัว         →  **แทบ 0%**
```

⇒ ถ้าใช้กฎเดียวกันหมด **โบนัสจะแจกตามกีฬา ไม่ใช่ตามฝีมือ** — คนทายบาสไม่มีสิทธิ์ได้ตลอดชีวิต

### ✅ มติข้อ ⑥ — `tolerance` เป็นคอลัมน์ใหม่ ไม่ยืม `walkover_score`

คอลัมน์ในตาราง `sport_types` ไม่ใช่ค่าคงที่ในโค้ด (ค่าปัจจุบันอยู่ในมติข้อ ⑦)

**ทำไมไม่ยืม `walkover_score` ทั้งที่มันพอใช้ได้ (3 / 20 / 2)** — ความหมายของมันคือ
"สกอร์ที่ให้เมื่อปรับแพ้บาย" · ถ้าเอามาคิดโบนัส pick'em ด้วย วันหนึ่งมีคนแก้สกอร์บาย
ของบาสจาก 20-0 เป็น 2-0 โบนัส pick'em จะเปลี่ยนตามไปโดยไม่มีใครรู้ว่าแตะอะไรไป
⇒ **คอลัมน์ที่มีความหมายเดียวชัดเจน ดีกว่าคอลัมน์ที่ถูกอ่านสองความหมาย**

`DEFAULT 0` = "ต้องเป๊ะ" ปลอดภัยที่สุดสำหรับกีฬาใหม่ที่ยังไม่มีใครตั้งค่า —
ให้โบนัสยากเกินไปแก้ง่ายกว่าแจกโบนัสฟรีแล้วค่อยรู้ตัว

### 🔴 ช่องว่างที่งานนี้สร้างขึ้นเอง และแก้ไปแล้วในคอมมิตเดียวกัน

**`amendMatchResult` กิ่ง "ผู้จัดแก้สกอร์ แต่ผู้ชนะคนเดิม" ไม่เคยแตะ Pick'em**

ซึ่ง**ถูกต้องก่อน OD-56** เพราะแต้มขึ้นกับ "ใครชนะ" เท่านั้น ⇒ แก้สกอร์ไม่กระทบใคร
แต่ตอนนี้แต้มขึ้นกับสกอร์ ⇒ ถ้าไม่คิดใหม่:

```
คนที่ทายสกอร์เดิมเป๊ะ      ถือแต้ม 10 ค้างไว้ ทั้งที่สกอร์นั้นถูกแก้ไปแล้ว
คนที่ทายตรงกับสกอร์ใหม่    ไม่ได้โบนัสที่ควรได้
```

🔴 **เพี้ยนแบบไม่มี error ฟ้องเลย** — endpoint ตอบ 200 ปกติ ตารางอันดับคืนตัวเลขปกติ
แก้โดยเรียก `unsettleTx` แล้ว `settleTx` ด้วยสกอร์ใหม่ในกิ่งนั้น + เทส regression 5 ตัว
(ตรึงลำดับ unsettle→settle ด้วย เพราะสลับลำดับจะทำให้แต้มเก่าค้างใน `users.total_points`)

### ที่ตั้งใจไม่ทำ

**ไม่คิดสูตรใน SQL** — เขียนเป็นฟังก์ชันบริสุทธิ์ที่ `utils/pickemScore.ts` แล้วให้
`settleTx` อ่านแถวที่ยังไม่ตัดสินมาคิดในโค้ด จับกลุ่มตามแต้ม (มีได้แค่ 4 ค่า) แล้วยิง
ไม่เกิน 4 รอบ · เหตุผล: สูตรนี้คาดว่าจะถูกปรับอีก ต้องอ่านง่ายและตรึงด้วยเทสได้โดยไม่ต้องมีฐาน
ส่วน `CASE WHEN` + `JSON_EXTRACT` กับ key ที่เป็นรหัสทีม อ่านยากและทดสอบไม่ได้

**`utils` ไม่ใช่ `services`** — คนเรียกคือ `pickem.repo.settleTx()` ที่ถูกเรียกจาก
`matchResult.repo.applyOutcomeTx()` · repository เรียก service ไม่ได้ (ชั้นผิดทาง)

### ✅ มติข้อ ⑦ (ก้าวที่ 3) — `tolerance` เป็น **เส้นสองเส้น** และวัด **ต่อฝั่ง**

```sql
-- migration 040 · แทน pickem_score_tolerance ของ 039 (ลบคอลัมน์นั้นทิ้ง)
pickem_tolerance_exact INT NOT NULL DEFAULT 0
pickem_tolerance_close INT NOT NULL DEFAULT 0
CONSTRAINT chk_sport_pickem_tolerance CHECK (pickem_tolerance_close >= pickem_tolerance_exact)
```

| กีฬา | exact | close | เหตุผล |
|---|---|---|---|
| แบดมินตัน · RoV · VALORANT | **0** | **0** | ชั้นกลางไม่ยิง **โดยเจตนา** — ชั้นเต็มง่ายอยู่แล้ว (2 ทางเลือก) |
| ฟุตบอล | **0** | **1** | ทายสกอร์เป๊ะเกิดได้จริง (~15%) ⇒ ชั้นเต็มควรหมายถึง "เป๊ะ" · คลาดฝั่งละ 1 ประตู = ชั้นกลาง |
| บาสเกตบอล | **5** | **10** | เป๊ะทั้งสองตัวแทบเป็นไปไม่ได้ ⇒ **จำเป็น**ต้องเป็นแถบ ไม่งั้นเพดานจริงของคนทายบาสคือ 7 ตลอดชีวิต |

**หลักที่ใช้ตั้งค่า: ชั้นสูงสุดควรเป็นแถบที่แคบที่สุดที่ยังเอื้อมถึงได้จริงในกีฬานั้น**
⇒ บาสเป็นกีฬาเดียวที่จำเป็นต้องขยาย · อีก 4 กีฬาชั้นเต็มยังหมายถึง "เป๊ะ" ตามเดิม

#### ★ ① ทำไมเลิกบวกความคลาดสองฝั่งเข้าด้วยกัน

039 คิด `drift = |คลาดซ้าย| + |คลาดขวา|` เทียบเส้นเดียว ซึ่งมีผลข้างเคียงที่ไม่ได้ตั้งใจ 2 อย่าง

```
ก) ลงโทษกีฬาแต้มสูงสองเท่า — ยิ่งสกอร์สูง ทั้งสองฝั่งยิ่งคลาดพร้อมกัน
   บาสคลาดฝั่งละ 1 แต้มจาก ~100 (แม่นมาก)  ได้ drift 2
   ฟุตบอลคลาดฝั่งละ 1 ประตูจาก 3           ได้ drift 2   ← ถือเท่ากัน

ข) มองข้ามว่า "อ่านผลต่างถูก" คือการทายที่ดี
   ทาย 2-1 ได้จริง 3-2   ผลต่าง +1 ถูกเป๊ะ · แค่ประเมินประตูต่ำไป 1   drift 2 → side_only (4)
   ทาย 2-1 ได้จริง 3-1   ผลต่างผิดไป 1                                drift 1 → close (7)
   = ให้รางวัลการทายที่แย่กว่ามากกว่า — กลับหัวกลับหาง
```

⇒ เปลี่ยนเป็น **worst-link: ดูทีละฝั่ง แล้วยึดฝั่งที่แย่กว่า**
ค่า `tolerance` จึงมีความหมายเดียวตลอด = "คลาดได้เท่าไรต่อฝั่ง"
ไม่ขึ้นกับว่าความคลาดกระจุกฝั่งเดียวหรือกระจายสองฝั่ง

#### ★ ② ทำไมสองคอลัมน์ ไม่ใช่คอลัมน์เดียวแล้วคูณสอง

ข้อเสนอตอนแรกคือเก็บ tol เดียวแล้วให้ `exact = ±tol` · `close = ±2tol` แต่

```
ฟุตบอลต้องการ (เป๊ะ 0 , ใกล้ 1)   ซึ่ง 2 × 0 = 0 เขียนไม่ได้ ⇒ ต้องใช้ tol = 0.5
                                   ⇒ ต้องเปลี่ยนคอลัมน์เป็น DECIMAL ทั้งที่สกอร์เป็นจำนวนเต็มเสมอ
                                     (ความคลาดเป็นเศษไม่มีจริง — 0.5 คือการเขียน (0,1) ด้วยวิธีที่อ่านยากกว่า)
อัตราส่วน ×2 ถูกบังคับ             วันหนึ่งอยากได้บาส (5 , 8) จะทำไม่ได้
```

⇒ สองคอลัมน์จำนวนเต็มพูดทั้งสองเส้นตรง ๆ · อ่านตารางแล้วรู้ทันทีว่ากีฬานั้นให้คลาดได้เท่าไร

#### ★ ③ ทำไมลบ `pickem_score_tolerance` ทิ้ง ไม่เก็บไว้

คอลัมน์นั้นเกิดใน 039 **วันเดียวกัน** และยังไม่มีข้อมูลจริงของใครผูกอยู่
ถ้าเก็บไว้จะมีคอลัมน์ tolerance สามตัวในตารางเดียว โดยสองตัวเท่านั้นที่โค้ดอ่าน
⇒ คนที่มาอ่านทีหลังต้องเดาว่าตัวไหนจริง — **แหล่งความจริงต้องมีที่เดียว**

#### ★ ④ `CHECK` กันค่าที่ทำให้ชั้นกลางหายเงียบ ๆ

ถ้า `close < exact` ชั้น `close` จะไม่มีทางยิงเลย (อะไรที่ ≤ close ก็ ≤ exact ไปแล้ว)
= ผู้เล่นเสียชั้น 7 แต้มไปโดยไม่มี error ฟ้อง ⇒ ให้ฐานปฏิเสธตั้งแต่ตอนเขียน
สูตรใน `utils/pickemScore.ts` บีบค่าซ้ำอีกชั้น (ติดลบ → 0 · close < exact → ยกให้เท่า exact)
เผื่อค่ามาจากทางอื่น — มีเทสตรึงทั้งสองเคส

#### 🔴 สิ่งที่ก้าวที่ 3 **ไม่ได้** แก้ — ต้องรู้ไว้

```
Bo3 เส้น (0 , 0) ⇒ ไม่เปลี่ยนอะไรเลย · ยังได้ 10 จากการเลือกใน 2 ทางเลือก (~50%)
```

แต้มคาดหวังต่อการทายฝั่งถูก (ประมาณหยาบ) · ก่อน → หลังก้าวที่ 3

```
แบด/RoV/VALORANT   7.0  →  7.0     ← ยังสูงสุด
ฟุตบอล             5.8  →  ~6.5    (ผลข้างเคียงของการเลิกบวกสองฝั่ง: 3-1 vs 2-0 ขึ้นจาก 4 เป็น 7)
บาสเกตบอล          4.5  →  ~5.5    ← เป้าหมายของก้าวนี้
```

⇒ ช่องว่างแคบลงจาก 7.0–4.5 เป็น 7.0–5.5 แต่ยังไม่หมด
ต้นเหตุที่เหลือคือ **Bo3 มีสกอร์ให้เลือกแค่ 2 แบบ** ซึ่งไม่มี tolerance อะไรแก้ได้
แก้ได้ทางเดียวคือแต้มรายกีฬา (ลดชั้นเต็มของกีฬานับเกม) ซึ่ง**ยังไม่ทำ** เพราะ
*"ทำไมแบดทายเป๊ะได้ 6 แต่ฟุตบอลได้ 10"* อธิบายผู้เล่นยากกว่าปัญหาที่แก้

★ และความไม่เท่านี้**ไม่โผล่ในตารางอันดับ** — `tournaments.sport_type_id` เป็น `INT NOT NULL`
(หนึ่งทัวร์ = หนึ่งกีฬา) และ E28 กรอง `WHERE m.tournament_id = ?` ⇒ การเทียบอันดับเป็นกีฬาเดียวกันเสมอ
มันโผล่ได้ที่ `users.total_points` เท่านั้น ซึ่ง OD-51 ถอดออกจากโปรไฟล์สาธารณะไปแล้ว

### ตรวจแล้วจริงกับระบบที่รันอยู่ (ฐานชั่วคราว `pk2` · ลบแล้ว)

ทัวร์ฟุตบอล (`tolerance` 1) · ผลจริง 3-1 · ทาย 4 แบบครบทั้ง 4 ชั้น

```
ทาย 3-1  คลาด 0        →  10  exact       users.total_points = 10  ✓
ทาย 2-1  คลาด 1        →   7  close                           = 7   ✓
ทาย 1-0  คลาด 3 > 1    →   4  side_only                       = 4   ✓
ทายอีกฝั่ง              →   0  wrong_side                      = 0   ✓
```

**แล้วให้ผู้จัด amend สกอร์เป็น 3-2 (ผู้ชนะคนเดิม)** — แต้มคิดใหม่ถูกต้องและ `total_points` ปรับตาม

```
ทาย 3-1  คลาด 1  →  7  (เดิม 10)     total_points 10 → 7   ✓ ไม่ค้าง ไม่บวกซ้ำ
ทาย 2-1  คลาด 2  →  4  (เดิม 7)      total_points  7 → 4   ✓
```

### ตรวจก้าวที่ 3 จริงกับระบบที่รันอยู่ (ฐานชั่วคราว `pk3` · ลบแล้ว)

migration 040 รันผ่าน `npm run migrate` · คอลัมน์เก่าหายไปจริง (0 แถวใน `information_schema`)
และ `UPDATE sport_types SET pickem_tolerance_close = 2` บนบาส (exact 5) ถูกฐานปฏิเสธ
ด้วย `ERROR 3819 Check constraint 'chk_sport_pickem_tolerance' is violated` ✓

เรียก `settleTx` จริงด้วยผลจริง **52-45** แล้วอ่าน `points_earned` + `users.total_points`

```
                              บาส เส้น (5,10)      ฟุตบอล เส้น (0,1)
ทาย 52-45  (คลาด 0 , 0)          10  spot_on          10  spot_on       ✓
ทาย 50-39  (คลาด 2 , 6)           7  close             4  side_only     ✓  ← เคสต้นเรื่อง
ทาย 70-45  (คลาด 18 , 0)          4  side_only         4  side_only     ✓
ทายอีกฝั่ง                        0  wrong_side        0  wrong_side    ✓
```

`users.total_points` ตรงกับ `points_earned` ทุกแถว (ไม่บวกซ้ำ ไม่ค้าง)
และคอลัมน์เดียวกันให้คำตอบต่างกันตามกีฬาจริง = เส้นต่อกีฬาทำงาน

### ⚠️ ยังควรให้ทีมรับรู้ ถึงจะตัดสินไปแล้ว

สูตรกับสเกลเป็น **กติกาที่ผู้เล่นเห็น** ไม่ใช่เรื่องภายใน — ถ้าอาจารย์ถามว่า
*"ทำไมทายไม่เป๊ะยังได้คะแนน"* หรือ *"ทำไมบาสกับแบดใช้กฎไม่เหมือนกัน"* ต้องมีคนตอบได้

ตัวเลขทั้งหมด**แก้ได้ที่เดียว**ถ้าทีมเห็นต่าง
```
สเกลแต้ม     config/scoring.ts   PICKEM_TIER_POINTS
เส้น tolerance  sport_types.pickem_tolerance_exact / _close
                (UPDATE ได้เลย ไม่ต้อง migration ใหม่ · ฐานบังคับ close >= exact)
```

## OD-55 — กรรมการเขียนผลทับได้เองในโหมด online — ✅ ตัดสินแล้ว 2026-10-04 (ทำแล้ว)

**มติ: ทำ** · `POST /matches/:id/result/override` (S02b) · **ผลลงที่ `submitted` ไม่ใช่ `verified`**

### ปัญหา

โหมด online คนส่งผลคือ **หัวหน้าทีม** (ฝ่ายไหนก็ได้ รวมฝ่ายที่แพ้ — `isTeamLeaderOfMatch`
เช็คทั้งทีม A และ B) และคนยืนยันคือ **กรรมการของแมตช์**

กรรมการที่เห็นว่าผลผิดเดิมทำได้ทางเดียว:

```
กรรมการ dispute (S03)  →  รอผู้จัดมากด amend (S04)  →  จบ
```

⇒ **ผู้จัดต้องลงมือทุกครั้งแม้ไม่มีใครเถียงอะไรกันเลย** ซึ่งขัดกับที่ OD-26 ตั้งใจให้ผู้จัด
เป็น**คนตัดสินข้อพิพาท ไม่ใช่เสมียนกรอกผล**

### ★ เหตุผลที่ให้กรรมการเขียนได้ — ไม่ใช่อำนาจใหม่

```
onsite วันนี้   กรรมการเขียนผล (S01) → หัวหน้าทีมที่ชนะยืนยัน หรือ เงียบ → auto-verify
```

**"กรรมการเขียนผล" เป็นสิ่งที่ระบบอนุญาตอยู่แล้วในโหมด onsite** · OD-55 แค่ให้เขาทำสิ่งเดียวกัน
ในโหมดที่เขาเป็นคนยืนยันแทน และในโหมด online เขาเป็น **คนกลาง** ส่วนคนส่งเป็น **คู่กรณี**
⇒ ให้คนกลางแก้ของคู่กรณีไม่ใช่การเอื้อประโยชน์ตัวเอง

### 🔴 จุดที่เกือบพลาด — ทำไมต้องเป็น `submitted` ไม่ใช่ `verified`

ข้อเสนอตั้งต้นคือ *"ให้กรรมการใส่ผลเองแล้ว verify ในก้าวเดียว"* ซึ่ง**เร็วกว่าและจบในคลิกเดียว**
แต่แลกกับ:

```
คนเดียวเป็นทั้งคนเขียนและคนรับรอง  =  ล้มหลัก SAME_PERSON_CANNOT_VERIFY
online จะมีคนรับรอง 1 คน            แต่ onsite มี 2  ⇒ โหมดที่กรรมการไม่ได้อยู่หน้างาน
                                      กลับถูกเชื่อมากกว่าโหมดที่อยู่หน้างาน
```

**ลงที่ `submitted` แล้วเส้นทางเดินตามรูปเดียวกับ onsite**

| | ใครเขียน | ใครรับรอง | ถ้าเงียบ |
|---|---|---|---|
| onsite | กรรมการ (S01) | หัวหน้าทีมที่ชนะ (S02) | auto-verify |
| online **หลัง OD-55** | กรรมการ (S02b) | **หัวหน้าทีมฝ่ายไหนก็ได้** (S02) | auto-verify |

### ⚠️ รอบแรกยังไม่ครบ — ต้องแก้ด่าน verify ตามไปด้วย (แก้แล้ววันเดียวกัน)

ฉบับแรกของข้อนี้เขียนว่า *"เส้นทางเท่ากับโหมด onsite เป๊ะ"* ซึ่ง **ยังไม่จริงตอนนั้น**

`requireCanVerifyResult` บังคับ `isRefereeOfMatch` ตายตัวในโหมด online
เพราะเขียนไว้ตอนที่สมมติฐานคือ *"online ทีมเป็นคนส่งผลเสมอ"* ⇒ หลัง S02b แล้ว:

```
กรรมการคนที่เขียนทับ      ติด SAME_PERSON_CANNOT_VERIFY
หัวหน้าทีมทั้งสองฝ่าย      ติดด่านบังคับกรรมการ
ผู้จัด                    ไม่มีปุ่ม (resolve ต้อง disputed · organizerDecide ต้องไม่มีผล)
กรรมการคนที่สอง           มีได้ แต่ online ต้องการแค่ 1 คน ⇒ ปกติไม่มี
```

⇒ **ไม่มีใครกดยืนยันได้เลย เหลือแต่ `auto-verify`** · ปิดผลเร็วไม่ได้แม้ทั้งสองทีมเห็นด้วย
และผลค้างอาจไปขวางการเดินสายต่อ

**กฎที่ถูกคือ "ฝ่ายที่ไม่ได้เขียน" ไม่ใช่ "ต้องเป็นกรรมการ"**

```
submitted_role = 'team_leader'  →  กรรมการของแมตช์รับรอง   (เหมือนเดิม)
submitted_role = 'referee'      →  หัวหน้าทีมรับรอง         ← เพิ่ม
```

★ แก้แล้วยังได้ของแถม: **บันไดข้อ 6** (กรรมการส่งผลแทนเมื่อทั้งสองทีมเงียบพ้นกำหนด)
ก็ติดปัญหาเดียวกันมาก่อนแล้ว — มาก่อน S02b ด้วยซ้ำ · ตอนนี้หายไปพร้อมกัน

### มติ: "หัวหน้าทีมฝ่ายไหนก็ได้" ไม่ใช่เฉพาะฝ่ายที่ชนะ

ต่างจาก onsite ที่บังคับฝ่ายที่ชนะโดยเจตนา

| | ผลที่รอรับรองมาจาก | ⇒ ใครควรรับรอง |
|---|---|---|
| onsite | กรรมการ | ฝ่ายที่ชนะ — ให้คนที่ได้ประโยชน์ยืนยันว่าตรงกับที่เกิดขึ้น |
| online หลัง S02b | กรรมการ (คนกลาง) | **ฝ่ายไหนก็ได้** |

เหตุผล: ผลที่รอรับรองมาจาก**คนกลาง ไม่ใช่คู่กรณี** ⇒ ฝ่ายที่แพ้กดรับรองก็คือการ
**ยอมรับผลที่ตัวเองเสียเปรียบ** ซึ่งไม่มีเหตุให้ต้องกันไว้ · และถ้าไม่ยอมก็ไม่ต้องกด
ไปโต้แย้ง (S03) ได้ตามปกติ · ถ้าบังคับฝ่ายที่ชนะ จะกลายเป็นว่าฝ่ายที่แพ้ซึ่ง
**เห็นด้วยกับการแก้ของกรรมการ** ช่วยปิดเรื่องให้เร็วไม่ได้ ทั้งที่เป็นคนเดียวที่มีแรงจูงใจจะทำ

> ทดสอบจริงแล้ว (ดูท้ายข้อ): หัวหน้าทีมที่ **แพ้หลังการแก้** กดยืนยันได้ 200 และผลเป็น `verified`

★ `autoVerifyDue()` กรองด้วย `submitted_role === 'referee'` **อยู่แล้วก่อน OD-55**
⇒ ของชิ้นนี้รับช่วงผลที่กรรมการเขียนได้เองโดยไม่ต้องแก้อะไรเลย

### ขอบเขต — 3 ด่าน ตรวจตามลำดับนี้

```
① mode ต้องเป็น online          onsite → 409 OVERRIDE_ONSITE_NOT_ALLOWED
② ผลต้องอยู่ที่ submitted         อื่น    → 409 RESULT_NOT_OVERRIDABLE
③ ต้องเป็นกรรมการของแมตช์นี้      ไม่ใช่  → 403 WRONG_SUBMITTER_ROLE
```

**ด่าน ① มาก่อนเสมอ** — คนที่ยิงผิดโหมดต้องได้ข้อความเรื่องโหมด ไม่ใช่ 403 ว่าไม่ใช่กรรมการ
ซึ่งจะทำให้ไปหาสาเหตุผิดทาง (ตรึงด้วยเทส "ลำดับด่าน")

**ทำไมห้ามแตะผลที่ `verified` (มติข้อ ①)** — เส้นนี้ **ไม่มีกลไกถอนผล** (`undoOutcomeTx` มีแต่ใน S04)
ผลที่ verified แล้วเดินเข้าสาย (`next_match_id`) และตารางคะแนนไปแล้ว ถ้าเขียนทับตรงนั้น
จะได้ผลใหม่โดยที่ของเดิมไม่เคยถูกถอนออก ⇒ **ข้อมูลเพี้ยนแบบไม่มี error ฟ้องเลย**
ของที่ verified แล้วต้องไป S03/S04 ซึ่งมีทั้งกลไกถอนและด่าน `NEXT_MATCH_STARTED`

### `reason` บังคับ (มติข้อ ②)

ทีมที่ถูกเขียนทับต้องรู้ว่าเพราะอะไร · `reason` ถูกส่งต่อไปอยู่ใน**ข้อความแจ้งเตือน**ด้วย
ไม่ได้เก็บไว้แต่ใน audit — ถ้าบังคับกรอกแล้วไม่ส่งต่อ การบังคับก็ไร้ความหมาย (ตรึงด้วยเทส)

### 🔴 audit_logs เป็นข้อบังคับ ไม่ใช่ของแถม

`match_results` มี **แถวเดียวต่อแมตช์** (`ON DUPLICATE KEY UPDATE`)
⇒ เขียนทับแล้ว **ผลที่ทีมส่งมาหายจากฐานถาวร**

จึงเก็บ `action_type = 'match_result_overridden'` ไว้ **ใน transaction เดียวกับการเขียนทับ**
พร้อม `previous` (ผู้ชนะ · สกอร์ · คนส่ง · บทบาท) + `next` + `reason`
ถ้าแยกสองคำสั่งแล้วคำสั่งหลังล้ม จะได้ผลใหม่ที่ไม่มีหลักฐานว่าทับอะไรไป แล้วเถียงกันไม่จบ

> `audit_logs.action_type` เป็น `VARCHAR(100)` ⇒ ชนิดใหม่ไม่ต้องมี migration

### แจ้งเตือนชนิดใหม่ `result_overridden` = `critical`

ปิดไม่ได้ เพราะ **นาฬิกาค้านเริ่มใหม่ตรงนี้** — ถ้าปิดได้แล้วไม่เห็น จะกลายเป็น
"ถูกเปลี่ยนผลโดยไม่รู้ตัวจนหมดเวลาค้าน" ซึ่งเป็นเคสที่ร้ายที่สุดของฟีเจอร์นี้

★ **ไม่ใส่ `exceptUserId`** ต่างจาก S01/S02 — คนกดคือกรรมการซึ่งไม่ได้อยู่ในกลุ่มผู้รับอยู่แล้ว
(`notifyMatchResultParties` ส่งให้หัวหน้าสองทีม) และ **ทีมที่ส่งผลมาเองคือคนที่ต้องรู้ที่สุด**

### การรีแฟคเตอร์ที่มาด้วยกัน

SQL upsert ของ S01 ถูกดึงออกเป็น `SUBMIT_RESULT_UPSERT_SQL` แล้วใช้ร่วมกันสองเส้น
ถ้าแยกเป็นสองชุด วันหนึ่งแก้กฎการรีเซ็ตนาฬิกาที่ชุดเดียว อีกเส้นจะเพี้ยนแบบเงียบ ๆ

### ตรวจแล้วจริงกับระบบที่รันอยู่ (ฐานชั่วคราว `ovr_check` · ลบแล้ว)

```
หัวหน้าทีม A ส่งผล  ชนะ 9003  สกอร์ 3-1   submitted_role = team_leader
กรรมการเขียนทับ     ชนะ 9004  สกอร์ 1-3   submitted_role = referee   status = submitted ✓
กรรมการคนเดิม verify เอง  →  403 SAME_PERSON_CANNOT_VERIFY  ✓ หลักเดิมไม่พัง
audit_logs           เก็บ previous + next + reason + ผู้แก้ ครบ ✓

ด่าน    ไม่ล็อกอิน 401 · หัวหน้าทีมยิง 403 · onsite 409 · ผลที่ verified 409
กฎผล    ไม่ใส่ reason 400 · reason ช่องว่าง 400 · ผู้ชนะไม่ใช่ทีมในแมตช์ 400 · คะแนนขัดกับผู้ชนะ 400
```

**วงจรเต็มหลังแก้ด่าน verify**

```
หัวหน้าทีม A ส่งผล         ชนะ 9003  3-1   role = team_leader   submitted
กรรมการเขียนทับ            ชนะ 9004  1-3   role = referee       submitted      ✓
กรรมการคนเดิมกด verify  →  403 SAME_PERSON_CANNOT_VERIFY                        ✓
หัวหน้าทีม A กด verify   →  200  (ฝ่ายที่แพ้หลังการแก้)          verified       ✓
   ฐาน: verified_by_user_id = 9001 (หัวหน้าทีม) · verified_at มีค่า · matches = completed
หลัง verified: กรรมการขอทับอีก 409 RESULT_NOT_OVERRIDABLE · ยืนยันซ้ำ 409 ALREADY_VERIFIED
audit_logs    2 แถว (overridden + verified)
```

### 🔴 dispute ของกรรมการยังต้องมีอยู่ — อ่านก่อนคิดว่าซ้ำซ้อนกับ S02b

**ถ้าคุณกำลังจะลบ `requireCanDisputeResult` ส่วนที่ยอมให้กรรมการค้าน หรือลบปุ่มค้านของกรรมการ
ออกจาก FE เพราะ "S02b ทำแทนได้แล้ว" — หยุดอ่านข้อนี้ก่อน**

หลังมี S02b ทั้งสองเส้นทำได้พร้อมกัน **แค่สถานะเดียว** คือ `submitted` + `online`
นอกจากสถานะนั้น **override ทำไม่ได้เลย** และเหลือ dispute ทางเดียว

| กรรมการเจอว่าผลผิดตอน | override | dispute |
|---|---|---|
| `submitted` + online | ✅ | ✅ (ทับกันแค่ช่องนี้) |
| `verified` (รวมที่ auto-verify ปิดให้) | ❌ 409 `RESULT_NOT_OVERRIDABLE` | ✅ ภายใน `dispute_window_hours` |
| โหมด onsite ทุกสถานะ | ❌ 409 `OVERRIDE_ONSITE_NOT_ALLOWED` | ✅ |

### ★ และในช่องที่ทับกัน มันก็ยังไม่ซ้ำ — แบ่งตาม "รู้คำตอบหรือเปล่า"

```
override   winnerTeamId + scoreData   บังคับทั้งคู่   ⇒ ต้องรู้ผลที่ถูกจึงทำได้
dispute    claimedWinnerTeamId / claimedScoreData   optional (ต้องมาคู่กันถ้าส่ง)
           evidenceKeys   แนบได้ 5 ไฟล์   ← override ไม่มีช่องแนบไฟล์เลย
```

คอมเมนต์ใน `disputeSchema` เขียนเหตุผลไว้ **ก่อน OD-55 เกิด** ว่า
*"ค้านบางแบบไม่ได้เถียงสกอร์ (เช่น 'ผู้เล่นไม่มีสิทธิ์ลงแข่ง')"*

**เคสจริงที่ override ทำไม่ได้เพราะไม่มีเลขที่ถูกให้กรอก**

```
ผู้เล่นไม่มีสิทธิ์ลงแข่ง        สกอร์ไม่ผิด แต่ผลไม่ควรนับ
สงสัยโกง / ใช้โปรแกรมช่วย     ต้องมีคนสอบ ไม่ใช่แก้เลข
เน็ตหลุดกลางเกม ควรแข่งใหม่    ไม่มี "ผู้ชนะที่ถูกต้อง" อยู่จริง
```

ของพวกนี้ต้องให้ **ผู้จัด** ตัดสิน (uphold / reject / amend) · กรรมการกรอกแทนไม่ได้

### สรุปการแบ่งงานหลัง OD-55

| กรรมการเจอว่า | ใช้ | ใครตัดสิน |
|---|---|---|
| ผลผิด **และรู้ผลที่ถูก** · ยัง `submitted` · online | **S02b override** | จบที่กรรมการ + ทีมรับรอง |
| ผลผิด **แต่ไม่รู้ผลที่ถูก** / ปัญหาไม่ใช่สกอร์ | **S03 dispute** | ผู้จัด |
| ผลผิด แต่ `verified` ไปแล้ว | **S03 dispute** | ผู้จัด |
| ผลผิด ในโหมด onsite | **S03 dispute** | ผู้จัด |
| ต้องแนบหลักฐาน | **S03 dispute** | ผู้จัด |

⇒ **ตัด dispute ของกรรมการออก = 4 เคสบนไม่มีทางออกเลย** โดยเฉพาะ "ผู้เล่นไม่มีสิทธิ์ลงแข่ง"
ซึ่งในทัวร์มหาวิทยาลัยเกิดบ่อยกว่า "สกอร์กรอกผิด"

### ⚠️ ปัญหาที่เหลือไม่ได้อยู่ที่ backend — อยู่ที่หน้าจอ

ในช่องที่ทับกัน กรรมการจะเห็น **2 ปุ่มที่ทำได้ทั้งคู่** และ BE ไม่ได้บอกว่าควรใช้อันไหน

```
ถ้า FE วางสองปุ่มข้างกันเฉย ๆ        กรรมการจะกดมั่ว
ถ้ากดค้านทั้งที่รู้คำตอบอยู่แล้ว      ผู้จัดต้องมาทำงานโดยไม่จำเป็น
                                     = ปัญหาเดิมที่ OD-55 ตั้งใจแก้ กลับมาทั้งดุ้น
```

**ที่แจ้ง FE ไป** (`FE-Notice-2026-10-04-referee-override.md`)

```
ปุ่มหลัก   "แก้ผลให้ถูกต้อง"        S02b   ฟอร์ม: ผู้ชนะ + สกอร์ + เหตุผล
ปุ่มรอง    "ส่งให้ผู้จัดตรวจสอบ"     S03    เหตุผลบังคับ · สกอร์ไม่บังคับ · แนบไฟล์ได้
          พร้อมคำกำกับ "ใช้เมื่อไม่รู้ผลที่ถูก หรือปัญหาไม่ใช่เรื่องสกอร์"
```

**เป็นเรื่องการจัดลำดับปุ่ม ไม่ใช่การปิดสิทธิ์** — ด่านฝั่ง BE ยอมทั้งสองเส้นโดยเจตนา

### ที่ยังไม่ทำ

**ไม่มีเพดานจำนวนครั้งที่ทับได้** — ทับซ้ำได้ตราบที่ยัง `submitted` และนาฬิกา auto-verify
เริ่มใหม่ทุกครั้ง ⇒ ในทางทฤษฎีกรรมการเลื่อน auto-verify ออกไปได้เรื่อย ๆ ด้วยการทับซ้ำ
ไม่ปิดเพราะทุกครั้งมี audit + แจ้งเตือนทั้งสองทีม และทีมค้านได้ทุกเมื่อ ⇒ ไม่ใช่ช่องที่ทำเงียบได้
**ถ้าวันหนึ่งอยากปิด** ให้นับจาก `audit_logs` ไม่ต้องเพิ่มคอลัมน์

## OD-54 — A04 forgot-password เลิกตอบ 429 เมื่อเกินโควตา — ✅ ตัดสินแล้ว 2026-10-04 (แก้แล้ว)

**มติ: เกินโควตาแล้วคืน 200 เหมือนเดิม ไม่โยน 429** · การกันยังอยู่ครบทุกอย่าง

### ช่องที่ปิด

`A04` สัญญาไว้ว่า **"ตอบ 200 เหมือนกันเป๊ะทุกกรณี (มีอีเมล / ไม่มี / ถูกระงับ)"**
เพื่อไม่ให้ใครใช้ endpoint นี้กวาดหาว่าอีเมลไหนมีอยู่ในระบบ

แต่ `429 RATE_LIMITED` อยู่ **หลัง** `if(!user || isCurrentlySuspended(user)) return SUCCESS`

```
ยิง 4 ครั้งติดกัน  →  ได้ 429        = อีเมลนั้นมีจริงและไม่ถูกระงับ
                     ได้ 200 ทั้ง 4  = ไม่มีในระบบ
```

⇒ **เป็นช่องเดียวกับที่สัญญาข้อนั้นมีไว้เพื่อปิด** และราคาถูกกว่าการวัดเวลาตอบด้วย
(ดูข้อจำกัดเรื่องเวลาด้านล่าง) เพราะอ่านจากรหัสสถานะตรง ๆ ไม่ต้องวัดอะไรเลย

### ★ ทำไมแก้ด้วย "เงียบ" ไม่ใช่ "ย้ายตัวนับขึ้นไปก่อน"

ทางเลือกที่พิจารณา

| | ต้องทำอะไร | ผล |
|---|---|---|
| **① คืน 200 เงียบ** ← เลือกอันนี้ | ไม่ต้องแตะฐานเลย | ปิดช่องสนิท การกันยังอยู่ครบ |
| ② นับตามอีเมลดิบก่อน lookup | ต้องมีตาราง/counter ใหม่ที่เก็บอีเมลที่ไม่มีในระบบ | ได้ตอบ 429 ได้ แต่สร้างกองอีเมลที่ไม่ใช่ของผู้ใช้เราไว้ในฐาน |
| ③ นับตาม IP | ต้องมี middleware + semantics ใหม่ | ไม่กันการถล่มเมลใส่เหยื่อรายคน ซึ่งเป็นงานหลักของเพดานนี้ |

**★ ตัวตัดสิน: 429 ไม่ได้ให้การป้องกันอะไรเลย มันเป็นแค่คำประกาศ**
สิ่งที่ป้องกันจริงคือ "ไม่ออก token และไม่ส่งเมล" ซึ่งอยู่ครบทั้งก่อนและหลังแก้
⇒ การเอา 429 ออกจึงไม่เสียการป้องกันแม้แต่นิดเดียว เสียแค่ข้อความที่รั่วข้อมูล

### ไม่ทำให้ผู้ใช้จริงสับสน

คนที่ติดเพดานคือคนที่ **ได้รับเมลไปแล้ว 3 ฉบับในชั่วโมงนั้น**
⇒ ข้อความ *"ถ้าอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์ไปให้แล้ว"* ยัง**จริงสำหรับเขา**
สิ่งที่เขาต้องทำคือไปเปิดกล่องเมล ไม่ใช่รู้ว่าถูกจำกัดจำนวนครั้ง

### ไม่กระทบ FE

```
git grep RATE_LIMITED ใน origin/feat/1 → ไม่มีเลย
```
และ `FE-Q-2026-10-04-reset-password-link.md` ที่ส่งไปก่อนหน้านี้เขียนสัญญาของ A04 ว่า
**"→ 200 { message } เสมอ"** อยู่แล้ว ⇒ **พฤติกรรมใหม่ตรงกับที่แจ้ง FE ไปพอดี** ของเดิมคือฝั่งที่ไม่ตรง

### ~~AV02 ยังตอบ 429 อยู่ — ไม่ใช่ความไม่สอดคล้อง~~ → **กลับมติแล้ว 4 ต.ค. (ดู OD-57)**

| | สัญญาว่าปิดการมีอยู่ของอีเมล? | 429 |
|---|---|---|
| A04 `forgot-password` | **ใช่** | ผิดสัญญา ⇒ เอาออก (OD-54) |
| AV02 `resend-verification` | ไม่ | ~~ไม่ผิด ⇒ เก็บไว้~~ → **เอาออกด้วย (OD-57)** |

**เหตุผลเดิมของการเก็บไว้ ถูกครึ่งเดียว** — เก็บไว้เป็นบันทึกว่าพลาดตรงไหน:
`A01 register` บอกว่า *"อีเมลนี้มีบัญชี"* จริง (`EMAIL_ALREADY_REGISTERED`) แต่ **ไม่ได้บอกสถานะยืนยัน**
⇒ 429 ของ AV02 เพิ่มบิต *"ยังไม่ยืนยัน"* ซึ่งตอนนั้นผมประเมินว่า *"ไม่ให้สิทธิ์อะไรกับใคร"*
แต่มันคือ**ตัวคัดกรองกลุ่มเป้าหมาย** — บัญชีที่มีจริงและยังไม่ยืนยันคือกลุ่มที่น่าสนใจที่สุด
สำหรับคนที่จะไปลองยึดบัญชี (เจ้าตัวยังไม่ได้พิสูจน์ว่าคุมอีเมลนั้นอยู่จริง)
⇒ รายละเอียดการกลับมติและราคาที่ต้องจ่ายอยู่ที่ **OD-57**

### ⚠️ ข้อจำกัดที่ยังเหลือ — ไม่ได้แก้ และไม่ควรอ้างว่าแก้แล้ว

**เวลาตอบยังต่างกัน** อีเมลที่มีจริงต้องทำ `bcrypt` (cost 10) + คุยกับ SMTP
อีเมลที่ไม่มีคืนทันที ⇒ คนที่วัดเวลาละเอียดยังแยกออกได้

ปิดจริงต้องทำงานหลอกให้ครบ (dummy hash + หน่วงเวลาคงที่) ซึ่งเกินความจำเป็นของโปรเจกต์นี้
**บันทึกไว้เพื่อไม่ให้เอกสารอ้างเกินจริงว่า "แยกไม่ออกทุกทาง"** — ที่ปิดคือช่องที่อ่านได้ฟรีจากรหัสสถานะ

### ตรวจแล้วจริงกับระบบที่รันอยู่

```
ยิง forgot-password 5 ครั้ง  อีเมลมีจริง  →  200 เหมือนกันทั้ง 5
ยิง forgot-password 5 ครั้ง  อีเมลไม่มี    →  200 เหมือนกันทั้ง 5
ทั้ง 10 คำตอบเหมือนกันเป๊ะทุกตัวอักษร       ⇒ แยกจากกันไม่ออก

เมลที่ mailpit ได้รับ  3 ฉบับ (ไม่ใช่ 5)   ⇒ เพดานยังทำงาน
token ในฐาน          3 แถว (ไม่ใช่ 5)    ⇒ ครั้งที่ 4-5 ไม่ออก token เลย
```

## OD-53 — ยืนยันอีเมลตอนสมัครด้วย OTP 6 หลัก — ✅ ตัดสินแล้ว 2026-10-04 (ทำแบบไม่บล็อก)

**มติ: ทำ แบบ "ไม่บล็อกการใช้งาน"** · migration 037 · AV01/AV02 ใน `GUIDE/06`

### ที่มา — ไม่ใช่ของที่สัญญาไว้ แต่เป็นรูที่ A04/A05 เปิดทิ้งไว้

ไม่มีคำว่า "ยืนยันอีเมล" หรือ "OTP" ใน `docs/` หรือ `GUIDE/` เลยแม้ที่เดียว (ค้นแล้ว 4 ต.ค.)
⇒ **เป็นของใหม่ ไม่ใช่ของที่เขียนไว้ในเอกสารแล้วยังไม่ทำ**

แต่ `register` ไม่เคยตรวจว่าอีเมลมีจริง ⇒ สมัครด้วย `aaa@bbb.ccc` ได้
แล้ววันที่ลืมรหัสผ่าน `forgot-password` จะตอบ `200` ตามปกติ (A04 ตั้งใจให้ตอบเหมือนกันทุกเคส)
แต่เมลไปตกที่ไม่มีใครอ่าน ⇒ **กู้คืนบัญชีไม่ได้ตลอดไป และระบบไม่มีทางรู้ว่าเกิดขึ้นกับใคร**

### ★ ตัวที่ตัดสินว่า "ไม่บล็อก" ไม่ใช่ "บล็อก"

| | เมลส่งไม่ออก | ผลที่เกิด |
|---|---|---|
| บล็อกตอนล็อกอิน | สมัครแล้วเข้าไม่ได้ | 🔴 **ทั้งระบบใช้ไม่ได้** |
| ไม่บล็อก (ที่เลือก) | ธงยังเป็น 0 | ใช้งานได้ครบทุกอย่าง |

**ตอนนี้เรายังไม่มี SMTP จริง** — `SMTP_HOST` default = `localhost:1025` = mailpit
เมลของระบบ**ยังไม่เคยออกไปถึงอีเมลจริงเลยแม้ครั้งเดียว** ⇒ เอาประตูหน้าของระบบไปผูกกับของที่ยังไม่เคยทดสอบในสภาพจริง **ก่อนวันเดโม** คือความเสี่ยงที่แลกไม่คุ้ม

### 🔴 ข้อเสียที่รับไว้โดยรู้ตัว — ไม่มีแรงจูงใจให้ใครเข้ามายืนยัน

ยืนยันแล้ว**ไม่ได้สิทธิ์อะไรเพิ่ม** และไม่ยืนยันก็**ไม่เสียสิทธิ์อะไร**
ประโยชน์เดียวคือ "วันหน้าลืมรหัสผ่านจะกู้ได้" ซึ่ง**มองไม่เห็นตอนสมัคร**

⇒ **คาดว่า `users.email_verified` จะเป็น `0` แทบทุกแถว** และนั่นคือผลที่ยอมรับไว้แล้ว ไม่ใช่ความผิดพลาด

เลือกแบบนี้เพราะของทุกชิ้นที่ทำไว้ **ใช้ได้ทั้งแบบบล็อกและไม่บล็อก** ⇒ วันที่ตัดสินจะบล็อก
**ไม่ต้องแก้ฐานอีกเลย** เติมด่านเดียวในโค้ด แล้วสิ่งที่ทำวันนี้กลายเป็นของที่ใช้งานได้ทันที

### ทางที่จะใช้ถ้าวันหนึ่งอยากให้มีแรงจูงใจ — เรียงจากเสี่ยงน้อยไปมาก

```
① บล็อกเฉพาะ POST /referee-requests + POST /tournaments
   ขัดตอนที่คนนั้น "กำลังอยากทำ" พอดี ⇒ มีแรงจูงใจจริง
   และของสองอย่างนี้ต้องผ่าน admin อยู่แล้ว ⇒ เมลพังก็แค่ช้าไปอีกขั้น ไม่ใช่พัง
   เข้าชุดกับเรื่องตรวจตัวตนที่สองเส้นนี้มีอยู่แล้ว (refereeIdentity · request-docs)

② บล็อก login()  ← ปลอดภัยสุด เสี่ยงเดโมสุด ต้องมี SMTP จริงก่อน
```

ทั้งสองทางเติมแค่ด่าน ไม่แตะฐาน ไม่แตะ endpoint ที่มีอยู่

### ทำไมเป็น OTP 6 หลัก ไม่ใช่ลิงก์ในเมล

ลิงก์ลอกจาก A04/A05 ได้ทั้งดุ้น (BE ง่ายกว่า) **แต่ต้องมี route ฝั่ง FE** และ `feat/1`
**ยังไม่มีแม้หน้า `/reset-password`** · และมี `<Route path="*" element={<Navigate to="/" replace />} />`
ที่จะเด้งลิงก์ในเมลไปหน้าแรกเงียบ ๆ

⇒ ตัวตัดสินคือ **FE เป็นคอขวด** · เลขกรอกบนหน้าเดิมไม่ต้องมี route ใหม่เลยแม้หน้าเดียว
และ**ไม่พึ่ง `FRONTEND_URL`** ⇒ ไม่ต้องรอคำตอบเรื่อง path ที่ A04/A05 ยังรออยู่

### ของที่ต้องเพิ่มเพราะเป็น OTP ไม่ใช่ token — ไม่ใช่ของฟรี

`token` ของ A04 คือ 64 hex (`randomBytes(32)`) เดาไม่ได้ในทางปฏิบัติ
**แต่ 6 หลัก = 1,000,000 แบบ เดาได้จริง** ⇒ ต้องมีของที่ reset token ไม่ต้องมี

```
attempt_count   กรอกผิดครบ 5 = ใบนั้นตาย  (กรองที่ SQL ไม่ใช่ที่ service)
TTL 10 นาที      สั้นลงจาก 1 ชม.
randomInt       ไม่ใช่ randomBytes % 1000000 — modulo bias ทำให้เลขช่วงต้นออกบ่อยกว่า
padStart(6,'0') ไม่งั้นพื้นที่เดาเหลือ 9 แสนแทน 1 ล้าน
```

> ⚠️ `attempt_count` ไม่ได้มีไว้กันเดาอย่างเดียว — กรอกผิด 1 ครั้ง = `bcrypt.compare` 1 ครั้ง (cost 10)
> ถ้าไม่จำกัด ก็เปิดช่องให้ยิงรัว ๆ ให้เครื่องทำ bcrypt ไม่หยุด

### ที่ต่างจาก A04 โดยเจตนา

**A04 กลืน error ตอนส่งเมลพังเงียบ ๆ** เพราะที่นั่นการบอกว่าส่งไม่สำเร็จ = บอกว่าอีเมลนี้มีในระบบ
**แต่ `register` บอกอยู่แล้ว**ว่าอีเมลซ้ำ (`EMAIL_ALREADY_REGISTERED`) ⇒ ไม่มีความลับให้รักษาตรงนี้

⇒ **A01 register** จึงบอกตรง ๆ ว่าเมลไม่ออก (`emailVerificationSent:false`) — ข้อนี้ยังคงเดิม
เพราะตอน register คนที่ยิงคือเจ้าของอีเมลเองอยู่แล้ว (ถ้าซ้ำจะได้ `EMAIL_ALREADY_REGISTERED` ไปก่อน)

⚠️ **แต่ AV02 เลิกตอบ 429 แล้วเมื่อ 4 ต.ค. — ดู OD-57** เหตุผลเดิมที่เขียนไว้ตรงนี้
(*"การเงียบไว้จะกลายเป็นรอเมลที่ไม่มาโดยไม่รู้ว่าไม่มา"*) **ยังเป็นราคาจริงที่ต้องจ่าย**
และทางออกคือให้ FE บอกกติกาล่วงหน้า ไม่ใช่ให้ response มาบอกย้อนหลัง

### ⚠️ ของที่เจอตอนทำ แต่ยังไม่ได้แก้ — rate limit ของ A04 รั่วว่าอีเมลมีจริง

`forgotPassword()` สัญญาว่า **"ตอบ 200 เหมือนกันเป๊ะทุกกรณี"** แต่ `429 RATE_LIMITED`
อยู่**หลัง** `if(!user || isCurrentlySuspended(user)) return SUCCESS`

⇒ ยิง 4 ครั้งติดกัน **ได้ 429 = อีเมลนั้นมีจริงและไม่ถูกระงับ · ได้ 200 ทั้ง 4 = ไม่มี**
เป็นช่องกวาดหาอีเมลที่สัญญาข้อนั้นตั้งใจปิด

**เป็นของที่มีมาก่อน OD-53 ไม่ได้เกิดจากงานนี้**

✅ **แก้แล้ววันเดียวกัน — ดู OD-54** (ตัดสินเป็นมติแยก เพราะเปลี่ยนพฤติกรรมของ endpoint
ที่ส่งสัญญาให้ FE ไปแล้ว จึงไม่ควรเป็นการแก้เงียบ ๆ ที่ซ่อนอยู่ในคอมมิตของเรื่องอื่น)

## OD-52 — individual multi-entrant formats ตัดออกจากขอบเขต — ✅ ตัดสินแล้ว 2026-10-04 (ไม่ทำ)

**มติ: ไม่ทำ** · ตัดออกจาก Sprint #2 · ถ้ามีคนเจอรายการนี้ในลิสต์ `README.md` แล้วสงสัย ให้อ่านข้อนี้
(รูปแบบเดียวกับ OD-37 ที่ตัด report export ออกเมื่อ 30 ก.ย.)

### สิ่งที่เอกสารเคยเขียนไว้ — ทั้งหมดเท่านี้

`docs/spec/README.md` §6 ลิสต์ "Sprint #2 / Future" — บรรทัดเดียวว่า
*"individual multi-entrant formats ที่ไม่ใช่ head-to-head"* **ไม่มีคำอธิบายต่อที่ไหนเลย**
`08-engagement.md` ไม่มี · `GUIDE/` ไม่มี · **ไม่มีตารางไหนในฐานรองรับ**

หมายถึงกีฬาที่ลงแข่งหลายคน/หลายทีมพร้อมกันในหนึ่งนัดแล้ววัดกันที่**อันดับ** ไม่ใช่ "ใครชนะใคร"
เช่น วิ่ง ว่ายน้ำ ยิงธนู

### เหตุผลที่ตัดออก — วัดจากโค้ดจริง ไม่ใช่ความรู้สึก

สมมติฐาน "หนึ่งนัดมีสองฝ่าย" **ไม่ได้อยู่ที่ชั้นใดชั้นเดียว** มันกระจายทั้งระบบ

```
team_a_id / team_b_id              19 ไฟล์ · 126 จุด
winner_team_id / winnerTeamId                118 จุด
คอลัมน์ในฐานที่พึ่งสองฝ่าย                    17 จุด
```

| ชั้น | ไฟล์ที่พึ่งสองฝ่าย |
|---|---|
| `repositories` | **12** — SQL ทุกตัวเขียนบนสองคอลัมน์ |
| `services` | 5 |
| `mappers` | 4 |
| `middlewares` | 1 — ด่านสิทธิ์ก็ถามว่า "คุณอยู่ทีม a หรือ b" |

### ★ ที่เป็นตัวตัดสิน — ไม่ใช่ "คิดคะแนนใหม่" แต่เป็น "มีสองระบบคู่กัน"

กีฬาหนึ่งต่อหนึ่งยังต้องทำงานเหมือนเดิมทั้งหมด ⇒ ของใหม่จะ**เพิ่มเข้ามาคู่กัน ไม่ได้แทนที่**
และ "ใครชนะ" ต้องกลายเป็น "อันดับ" ซึ่งลาก **7 ฟีเจอร์** ไปด้วย แต่ละอันต้องมีตรรกะที่สอง

| ฟีเจอร์ | พึ่ง "ใครชนะ" ยังไง |
|---|---|
| ส่งผล/ยืนยันผล (8 ไฟล์) | สองฝ่ายยืนยันกันเอง · ค้านผล · ผู้จัดตัดสินแทน |
| สาย (bracket) | `next_match_id` เดินผู้ชนะไปนัดถัดไป · `loser_next_match_id` สำหรับ DE |
| ปรับแพ้บาย (walkover) | "ฝ่ายที่ไม่มา" แพ้ให้ "ฝ่ายที่มา" |
| Pick'em | ทายว่า**ทีมไหน**ชนะ — มีสองตัวเลือกเสมอ |
| ประวัติแมตช์ / career | ชนะ–แพ้ นับจาก `winner_team_id` |
| MVP / feedback | โหวตคนในสองทีมของแมตช์นั้น |
| เช็คอิน | เช็คอินแยกเป็นทีม a / ทีม b |

ฐานต้องแก้ด้วย: ตารางผู้ลงแข่งต่อแมตช์แบบ **N คน** (ไม่ใช่สองคอลัมน์) · `score_data` ต้องเก็บอันดับ
· สายแบบแพ้คัดออกใช้กับรูปแบบนี้ไม่ได้เลย

⇒ **เป็นงานระดับสถาปัตยกรรม ไม่ใช่การเพิ่ม endpoint** และอยู่ใน "Sprint #2 / Future" ตั้งแต่ต้น
ไม่ใช่ของที่สัญญาไว้ใน MVP

### ผลของการตัด

```
ไม่กระทบอะไรเลย   ไม่มีโค้ด ไม่มีตาราง ไม่มี endpoint ที่สร้างไว้รอ
                  ไม่มีข้อไหนใน BACKEND-GAPS.md ของ FE พูดถึงเรื่องนี้
```

**ถ้าวันหนึ่งจะทำจริง ให้ถือว่าเป็นโปรเจกต์ใหม่** ไม่ใช่การต่อเติมของเดิม —
และควรตัดสินใจ**ก่อน**เขียนโค้ดบนสมมติฐานสองฝ่ายเพิ่มอีก เพราะยิ่งนานยิ่งแก้ยาก (นั่นคือเหตุผลที่ตัดสินตอนนี้)

## OD-51 — แต้ม Pick'em โชว์ที่ไหน — ✅ ตัดสินแล้ว 2026-10-04 (เอาออกจากโปรไฟล์)

**ที่มา** — design ที่เสนออาจารย์ไว้บอกว่าจะ "แสดงอันดับผู้ชมที่ได้แต้มจาก Pick'em มากที่สุดในแต่ละทัวร์"
ไล่ของจริงแล้วพบว่าส่วนนั้น **ทำเสร็จแล้ว** (E28) แต่มีของเกินอยู่ที่อื่น

| ที่ | เดิม | ตอนนี้ |
|---|---|---|
| ตารางอันดับในทัวร์ (E28) | แต้ม**ของทัวร์นั้น** + อันดับ | ✅ คงไว้ — ตรงกับ design |
| โปรไฟล์สาธารณะ (U04) | `pickemPoints` = แต้ม**รวมทุกทัวร์** | ❌ **เอาออก** |
| `GET /me/pickem` (E27) | แต้มรวมของตัวเอง | ✅ คงไว้ — เจ้าตัวดูของตัวเองได้ |
| `GET /me` (MeDto `totalPoints`) | แต้มรวมของตัวเอง | ✅ คงไว้ |

### ทำไมเอาออก

**แต้มมาจากการ "ทายผล" ไม่ใช่ผลงานกีฬาของคนนั้น** แต่เดิมมันอยู่ใน `GET /users/:id/stats`
ก้อนเดียวกับ `overall` (ลงแข่ง/ชนะ/แพ้/แชมป์) · `bySport` · `mvpVotes` ⇒ **คนอ่านเข้าใจว่าเป็นตัวเลขวัดฝีมือการเล่น**

★ และมันขัดกับหลักที่ตั้งไว้ใน **OD-47** เอง: *"สถิติในทัวร์เปิดเสมอ · สถิติรวมทุกทัวร์ปิดได้"*
แต้มใน E28 เป็น "ของทัวร์" ⇒ เปิดเสมอถูกต้อง · แต่ `pickemPoints` ใน U04 เป็น "รวมทุกทัวร์"
ที่ไปนั่งอยู่ในก้อนที่ปิดได้ ⇒ **ตัวเลขเดียวกันสองความหมายคนละที่** ซึ่งเป็นแบบที่ OD-47 พยายามเลิก

### ที่เสียไป และที่ไม่เสีย

```
เสีย      คนอื่นดู "แต้มรวมทุกทัวร์" ของเราไม่ได้อีก
ไม่เสีย   เจ้าตัวยังดูแต้มรวมของตัวเองได้ (E27 · MeDto)
          แต้มต่อทัวร์ยังดูได้ของทุกคน ผ่าน E28 ซึ่งเป็นที่ที่ design ต้องการ
```

### 🔴 เป็น breaking change กับ FE

ฟิลด์ `pickemPoints` **หายจาก response ของ U04** ไม่ใช่กลายเป็น `null`
⇒ ถ้า FE อ่านฟิลด์นี้อยู่จะได้ `undefined` · แจ้งไปใน `FE-Notice-2026-10-04-pickem-points.md`

**ไม่แตะฐานข้อมูล** — `users.total_points` ยังอยู่และยังถูกอัปเดตตามปกติ แค่ไม่ส่งออกทาง U04
ถ้าวันหลังทีมเห็นว่าควรโชว์กลับ เอากลับได้โดยไม่ต้อง migration

### E29 — `GET /tournaments/:id/me/pickem` (ทำพร้อมกัน)

E28 คืนมา**ทั้งทัวร์ ไม่มี pagination** ⇒ FE ที่อยากโชว์แค่ "ของฉัน" ต้องโหลดทั้งก้อนมาหาแถวตัวเอง
และถ้ายังไม่มีแต้ม จะ**หาไม่เจอ** เพราะ E28 กรอง `points_earned IS NOT NULL` ⇒ FE ต้องเดาเองว่าแปลว่า 0

```
GET /tournaments/:id/me/pickem   →  { tournamentId, points, correct, settled, rank|null }
```

**🔴 ความเสี่ยงของ endpoint นี้ไม่ใช่ SQL พัง — คืออันดับไม่ตรงกับ E28**

ซึ่งจะเงียบมาก: ทั้งสองหน้าตอบ 200 เหมือนกัน แค่เลขอันดับไม่เท่ากัน
E28 คิดอันดับที่ **ชั้น service** (วนลิสต์ที่เรียงแล้ว ขึ้นอันดับใหม่เมื่อ `points` หรือ `correct` ต่างจากแถวก่อน)
E29 ต้องคิดที่ **ชั้น SQL** เพราะไม่มีลิสต์ให้วน ⇒ เขียนเป็น

```sql
(SELECT COUNT(*) FROM totals o
  WHERE o.points > t.points
     OR (o.points = t.points AND o.correct > t.correct)) + 1 AS rank_no
```

★ `settled` **ต้องไม่มีผลกับอันดับ** — E28 ก็ไม่ใช้มันตัดสินการเสมอ (คนทาย 3 นัดได้ 20 แต้ม
กับคนทาย 2 นัดได้ 20 แต้ม ถูกเท่ากัน ⇒ อันดับเดียวกัน) · มีเทสตรึงไว้ว่า SQL ไม่แตะ `o.settled`

**ตรวจกับฐานจริง ไม่ใช่แค่เทสที่ mock** — ใส่ข้อมูลที่ตั้งใจให้เสมอสามคน (20 แต้ม ถูก 2 เท่ากัน
แต่ `settled` ต่างกัน 2/2/3) แล้วเทียบผลสองฝั่ง

```
E28 (service)   9003=1 · 9002=1 · 9001=1 · 9004=4
E29 (SQL)       9001=1 · 9002=1 · 9003=1 · 9004=4      ตรงกัน รวมถึงการข้ามไป 4
```

และยิง API จริงทั้งสามเคส: มีแต้ม → `{points:10, rank:4}` · ทัวร์ที่ไม่เคยทาย → `{points:0, rank:null}`
· ทัวร์ไม่มีจริง → **404** · ไม่มี token → **401** (ไม่ใช่ 404 ซึ่งจะหมายความว่า route ไม่ติด)
ลบข้อมูลทดสอบออกจากฐานแล้ว

**`rank: null` ไม่ใช่เลขท้ายตาราง** — ถ้าส่งเลขอะไรไปด้วยจะกลายเป็นโกหกว่าอยู่อันดับสุดท้าย
ทั้งที่ไม่ได้อยู่ในตารางเลย · แต่ `points` เป็น **0 ไม่ใช่ null** เพราะ 0 แต้มเป็นความจริง
(ต่างจาก U04 ที่ซ่อนสถิติแล้ว null แปลว่า "ไม่บอก")

alias ใช้ `rank_no` เพราะ **`RANK` เป็น reserved word ของ MySQL 8** — ถ้า alias ตรง ๆ จะพังตอนรันจริง
แต่เทสที่ mock pool มองไม่เห็น ⇒ มีเทสตรึงชื่อ alias ไว้ด้วย

### ของที่ยังไม่มี (ไม่ได้ทำในรอบนี้)

- ~~**`GET /tournaments/:id/me/pickem`** — แต้ม+อันดับของตัวเองในทัวร์เดียว ก้อนเดียว~~
  → **ทำแล้วในคอมมิตเดียวกัน (E29)** · รายละเอียดด้านล่าง
- **การเอาแต้มไปแลกของ** — ตาราง `rewards`/`user_rewards` มี แต่ `points_required` ไม่ถูกเอาไปเทียบกับแต้มจริงที่ไหนเลย
  ไม่มี endpoint แลก ไม่มีการหักแต้ม · `reward_type` เป็น `ENUM('badge','achievement')` **ไม่มีประเภทที่เป็นของ**
- 🔴 **`point_transactions` มีในฐานแต่ไม่มีโค้ดบรรทัดไหนเขียนลงไปเลย** ⇒ แต้มเก็บเป็นยอดรวมอย่างเดียว
  ไม่มีประวัติว่าได้/เสียมาจากไหน · **ถ้าจะทำการแลกของ ต้องทำ ledger นี้ก่อน** ไม่งั้นหักแต้มพลาดแล้วไล่ย้อนไม่ได้

## OD-49 — จัดหมวดให้ชนิดแจ้งเตือนที่เกิดหลังแยกสาขา — ✅ ทำครบแล้ว 2026-10-03

**ปัญหา** — ตาราง `NOTIFICATION_CATEGORY` (OD-43) อยู่บนสาขา `backend_shokun_2` ตั้งแต่ 30 ก.ย. 20:20
ระหว่างที่รอ merge ผมเพิ่มชนิดแจ้งเตือนใหม่ไป 3 ตัว ซึ่งไม่มีในตาราง ⇒ **เป็น `critical` โดยปริยาย ปิดไม่ได้**
(ไม่มีแจ้งเตือนไหนหาย ตามที่สาขาเขาออกแบบไว้ — ดู OD-43 ข้อ 10) · **ไม่ใช่ความผิดของใคร — สองคนเขียนคู่ขนานกันคืนเดียวกัน**

| ชนิด | หมวด | เหตุผล |
|---|---|---|
| `team_deleted` (TM-07 + หัวหน้าลบทีม) | **`critical`** | เส้นตายคือ `registration_end` ของทัวร์ที่ใบสมัครค้างอยู่ — ทีมหายแล้วต้องไปหาทีมใหม่สมัครให้ทัน |
| `comment_rewritten_after_removal` (OD-41) | `community` | ไม่มีเส้นตาย ผู้จัดรู้ช้าก็ตรวจได้ และแถวค้างในคิว `?reported=true` อยู่แล้ว |
| `tournament_announcement` (OD-45) | **แยกเป็น 2 ชนิด** | `tournament` + `critical` — ดูข้อถัดไป |

### `team_deleted` — ทำไมจึง `critical` ทั้งที่ `team_member_removed` เป็น `team`

สองกรณีเสียสิทธิ์เหมือนกันจริง (หลุดจากทีม) **แต่ต่างกันที่ว่ามีคนกดหรือเปล่า**

- ถูกหัวหน้าเตะออก = มีคนกด รู้จักกัน ถามได้ ⇒ ปิดแจ้งเตือนก็ยังรู้ทางอื่น → `team` ปิดได้
- **การกวาดทีมร้าง (TM-07) ไม่มีใครกดเลย** — lazy sweep ไม่มี cron ทีมหายจากลิสต์ตอนที่ใครก็ไม่รู้ตัว
  ⇒ ปิดหมวดนี้แล้ว ทีมหาย**เงียบ 100%** ไม่เหลือร่องรอยอะไรเลย ซึ่งเป็น**บั๊กที่แจ้งเตือนนี้ถูกเพิ่มมาเพื่อแก้**
- ต้นทุนของการปิดไม่ได้ต่ำมาก: ยิงอย่างมาก**ครั้งเดียวต่อหนึ่งทีม** แล้วทีมนั้นก็จบไปเลย — กลายเป็นสแปมไม่ได้

★ ตรงกับหลักของ OD-43 เอง: *"ลืมจัดหมวดแล้วแจ้งเตือนหายเงียบ แย่กว่าลืมจัดหมวดแล้วปิดไม่ได้"*

### ข้อที่สาม `tournament_announcement` — ✅ ตัดสินแล้ว: **แยกชนิดตอนยิง** (ทางเลือก ก)

ชนิดเดียวคุมสองความหมายที่คนละขั้วกัน และการเปิด/ปิดทำงานที่ระดับ **`type`** ไม่ใช่ระดับข้อความ
⇒ เดิมปิดหรือเปิดได้แค่ยกชุด `announcement_type` ทั้ง 5 แบบพร้อมกัน

```
schedule_change / venue_change   ไม่รู้ = ไปผิดวัน/ผิดสนาม = แพ้บาย (M10)   ⇒ ต้องปิดไม่ได้
general / result / livestream    ไม่รู้ก็ไม่เสียสิทธิ์                        ⇒ ต้องปิดได้
```

🔴 **ที่หนักกว่าที่คิดตอนแรก — กรรมการโดนด้วย** · กรรมการได้ `content` ก้อนเดียวกับผู้เล่นผ่าน
`notifyTournamentReferees` แต่เข้ามาทางหมวด `tournament` ไม่ใช่ `referee` ⇒ กรรมการที่ปิด `tournament`
เพราะคิดว่า *"ฉันไม่ใช่นักแข่ง"* **จะพลาดข่าวเปลี่ยนสนามของแมตช์ที่ตัวเองต้องไปตัดสิน**
ซึ่งสวนกับเหตุผลที่ยิงถึงกรรมการตั้งแต่ต้น (*"`schedule_change`/`venue_change` กรรมการต้องรู้ก่อนใคร"*)

| | เลือก | ผลที่เกิดจริง |
|---|---|---|
| **ก** | ✅ | แยกเป็น 2 ชนิดตอนยิง — ได้ทั้งสองอย่าง ต้นทุนคือโค้ด ~3 บรรทัด + FE เพิ่มไอคอน 1 เคส |
| ข | | ปิดไม่ได้ทั้งหมด (= สถานะเดิม) — ปิดข่าวถ่ายทอดสด/ประกาศทั่วไปไม่ได้เลย คนจะไปปิดหมวดอื่นที่สำคัญกว่าแทน |
| ค | | ปิดได้ทั้งหมด — ขัดเกณฑ์ `critical` ของทีมตรง ๆ และกรรมการพลาดสนามที่ย้าย |

**แยกที่ชั้นยิง ไม่ใช่ชั้นตั้งค่า** เพราะคนที่รู้ว่าประกาศไหนด่วนคือ `announcement.service.ts`
⇒ ตารางหมวดแค่บอกว่า "ชนิดนี้ปิดได้หรือไม่ได้" **ไม่ต้องแตะตรรกะการตั้งค่าของ `backend_shokun_2` เลย**

`result` ไม่นับว่าด่วน เพราะผลออกไปแล้ว รู้ช้าก็เปลี่ยนอะไรไม่ได้ (เหตุผลเดียวกับ `match_walkover`)

**ไม่ต้องมี migration** — `notifications.type` เป็น `VARCHAR(50)` ไม่ใช่ ENUM

⚠️ **ข้อเสียที่มีจริง** — การกรองทำ **ตอนอ่าน** (OD-43) ⇒ ประกาศที่ยิงไป**ก่อน 3 ต.ค.** ถูกเก็บเป็น
`tournament_announcement` ทั้งหมด **รวมของที่เลื่อนเวลา** ⇒ ของเก่ากลุ่มนั้นกลายเป็นปิดได้ย้อนหลัง
**ตั้งใจไม่ backfill** (ทำได้ด้วยการ join `announcements` เทียบ `announcement_type`) เพราะประกาศเก่า
คือเรื่องที่ผ่านไปแล้ว ไม่มีใครต้องไปแข่งตามนั้นอีก — ถ้าใครเห็นว่าควร backfill บอกได้

### ✅ ปิดช่องที่ทำให้เรื่องนี้เกิด — `tsc` จับแทนที่จะมาเจอตอน merge

ปัญหาจริงไม่ใช่ "ลืมเติม 3 ช่อง" — คือ `NotificationInput.type` เป็น `string` เฉย ๆ
และเพราะตารางถือว่า "ไม่อยู่ในตาราง = `critical`" ⇒ **มันไม่พัง มันแค่เงียบ ๆ กลายเป็นปิดไม่ได้**
ซึ่งดูเหมือนทำงานปกติจนไม่มีใครสังเกต — นี่คือเหตุผลที่หลุดไป 3 ตัวพร้อมกัน ไม่ใช่เพราะใครไม่รอบคอบ

```ts
export type NotificationType = keyof typeof NOTIFICATION_CATEGORY;   // 40 ชนิด
type: NotificationType;                                              // เดิม: string
```

⇒ เพิ่มชนิดแจ้งเตือนใหม่โดยไม่เติมตาราง = **compile ไม่ผ่านทันที**

**พิสูจน์แล้วว่ากันได้จริง ไม่ใช่เชื่อว่าควรกันได้** — ลองเปลี่ยน `team_deleted` เป็นชื่อที่ไม่มีในตาราง
แล้ว `tsc` ฟ้อง `TS2322` ที่บรรทัดนั้นทันที (แล้วคืนไฟล์กลับ)

**ตารางต้องประกาศด้วย `satisfies` ไม่ใช่ `: Record<string , NotificationCategory>`** — ต้องได้ทั้ง
ตรวจว่าทุกค่าเป็นหมวดที่มีจริง **และ** เก็บชื่อคีย์ไว้เป็น literal · ถ้าใส่เป็น type annotation
คีย์จะกลายเป็น `string` แล้ว union จะไม่กันอะไรเลย (เป็นกับดักที่เขียนเตือนไว้ในไฟล์แล้ว)

**`categoryOf()` ยังรับ `string` โดยเจตนา** และยังคืน `critical` เป็นค่าสุดท้าย — เพราะตัวเรียกคือฝั่งที่
อ่าน**แถวเก่าจากฐาน** ซึ่งเป็น VARCHAR ⇒ ชนิดที่เลิกใช้ไปแล้วยังมีในฐานได้ ต้องไม่คืน `undefined`

blast radius เล็กกว่าที่ประเมินไว้: **ไฟล์เดียว** (`announcement.service.ts`) ต้องใส่ type annotation
เพราะเก็บ `content` เป็นตัวแปรก่อนส่ง ⇒ ternary กว้างเป็น `string` · อีก 20 ไฟล์ส่ง object literal
ตรง ๆ ผ่านเองไม่ต้องแก้ (ตอนประเมินผมนับ `match.service.ts` มาด้วย แต่ `payload` ในนั้นเป็น
payload ของการเช็คอิน ไม่ใช่แจ้งเตือน)

## OD-48 — ห้ามกรรมการคนเดิมมีแถวที่ใช้งานได้หลายแถวในทัวร์เดียว — ✅ ทำแล้ว 2026-10-02

**ของค้างจาก OD-42** — ตอนเก็บ baseline ใหม่พบแถวซ้ำใน `tournament_referees` แล้วบันทึกไว้ว่า
"ถ้าจะทำ constraint ต้องเป็นแถวที่นับเป็นกรรมการได้ ห้ามเกินหนึ่งแถวต่อ (ทัวร์, คน) ผ่าน
generated column + UNIQUE ซึ่งต้องล้างแถวซ้ำในฐานของทุกคนก่อน จึงยังไม่ทำ" — คอมมิตนี้ทำครบทั้งสองส่วน

### สำรวจก่อนทำ — ขอบเขตเล็กกว่าที่บันทึกไว้

| ฐาน | แถวซ้ำ |
|---|---|
| `database/qa-baseline.sql` (เก็บใหม่ 1 ต.ค.) | **0 กลุ่ม** (33 แถว active) — การเก็บใหม่ผ่านสคริปต์ของ FE ล้างไปแล้ว |
| ฐาน dev ของผม | 1 กลุ่มจริง (ทัวร์ 2 ผู้ใช้ 9002 · id 27/29/30) |

⇒ ปัญหาเหลือแค่ **ฐาน dev ของคนที่เคยเจอบั๊กก่อน `dabe9e3`** · แต่ถ้าใส่ UNIQUE เฉย ๆ
`npm run migrate` จะล้มบนเครื่องพวกนั้น ⇒ ต้องล้างให้ในไฟล์เดียวกัน ไม่ใช่ปล่อยให้ไปแก้มือเอง

### นิยาม "ใช้งานได้" ต้องตรงกับโค้ดเป๊ะ

`toRefereeStatus() === 'active'` ⇒ `removed_at IS NULL` · `invitation_status = 'accepted'` ·
และถ้า `is_external = 1` ต้องเป็น `not_required`/`approved` (ไม่ใช่ pending/needs_docs/rejected)
**ถ้าเงื่อนไขในฐานกับในโค้ดไม่ตรงกัน จะได้ฐานที่ปฏิเสธของที่โค้ดถือว่าถูก หรือกลับกัน**

MySQL 8 ไม่มี partial index ⇒ generated column `active_user_id` ที่เป็น **NULL เมื่อแถวใช้งานไม่ได้**
(UNIQUE ไม่นับ NULL ซ้ำกัน) แล้ว `UNIQUE (tournament_id, active_user_id)`
⇒ แถว pending · declined · rejected_by_admin · removed **มีได้ไม่จำกัด** ซึ่งจำเป็น
เพราะตารางเป็น soft delete เก็บประวัติ และ F-15 ตั้งใจให้แถว rejected_by_admin ค้างข้างแถวที่ใช้งานได้

### ล้างแถวซ้ำ — เก็บ id น้อยสุด และย้ายการมอบหมายแมตช์ก่อน

เก็บ **id น้อยสุด** เพราะ `findActiveRefereeRow()` เลือกแถวนั้นอยู่แล้ว ⇒ **พฤติกรรมของระบบไม่เปลี่ยนเลย**
แถวที่ถูกปิดคือแถวที่โค้ดไม่เคยหยิบมาใช้ตั้งแต่ `dabe9e3`

⚠️ **ต้องย้าย `match_referees` ก่อนปิดแถว** — F03 ตั้งใจไม่ล้าง `match_referees` ตอนถอดกรรมการ
("แถวใน match_referees คงไว้ — F12/coverage กรองด้วย removed_at เอง") ⇒ ถ้าปิดแถวทิ้งเฉย ๆ
แมตช์ที่เคยมอบหมายผ่านแถวนั้นจะกลายเป็น**ขาดคนเงียบ ๆ** ทั้งที่กรรมการคนเดิมยังอยู่ในทัวร์
`UPDATE IGNORE` ย้ายไปแถวที่เก็บไว้ · ที่ย้ายไม่ได้เพราะชน `UNIQUE (match_id, tournament_referee_id)`
คือแถวที่ปลายทางมีอยู่แล้ว จึงลบได้โดยไม่เสียข้อมูล

`removed_by` เป็น NULL = "ระบบล้างข้อมูล" ไม่ใช่คนกดถอน · **ไม่ยิงแจ้งเตือน `referee_removed`**
เพราะกรรมการคนนั้นยังเป็นกรรมการอยู่ แค่เหลือใบเดียว ถ้าแจ้งจะเป็นการบอกข้อมูลเท็จว่าถูกถอด

### 🔴 ที่เจอเพราะทดสอบ UNIQUE จริง — ต้องปิดช่อง 500

ด่านในโค้ด (`inviteReferee` หลัง `dabe9e3`) เป็น **read-then-write ไม่มีล็อก**
⇒ คำเชิญสองใบที่ยิงพร้อมกันผ่านด่านได้ทั้งคู่ แล้วมาชน UNIQUE ที่**จังหวะที่ผู้ใช้เป็นคนกด**

| จังหวะ | เดิม | ตอนนี้ |
|---|---|---|
| F05 กดรับคำเชิญ | **500** `ER_DUP_ENTRY` ดิบ | **409** `REFEREE_ALREADY_ACTIVE` |
| AR02 แอดมินอนุมัติคนนอก | **500** · อนุมัติล้มทั้งก้อนโดยไม่รู้สาเหตุ | **409** `REFEREE_DUPLICATE_ROWS` บอกให้ถอดใบเกินก่อน |

AR02 อนุมัติ "คน" = UPDATE ทุกแถวของคนนั้นข้ามทัวร์ ⇒ ถ้ามีสองแถวรออยู่ในทัวร์เดียวกัน
ทั้งคู่จะกลายเป็นใช้งานได้พร้อมกัน · ตัวดักเช็ค**ชื่อ index** ด้วย ไม่ใช่เช็คแค่ `ER_DUP_ENTRY`
ไม่งั้นวันที่ตารางนี้มี UNIQUE อื่นเพิ่ม เราจะกลืน error ของกฎที่ไม่เกี่ยวกันไปตอบข้อความผิดเรื่อง
`create()` (F01 เชิญ) ไม่ต้องดัก เพราะแถวใหม่เป็น `pending` ⇒ `active_user_id` NULL ⇒ ไม่เคยชน

### ตรวจกับฐานจริง 4 สถานะ

```
ฐานจาก schema.sql (ใหม่)         up to date (36 migrations) · มี index ครบ
ฐานจาก qa-baseline (สะอาด)       applied 036 ผ่าน
ฐานที่มีแถวซ้ำ + มอบหมายแมตช์      ล้างถูก · แมตช์ที่ย้ายได้ถูกย้าย · ที่ชนถูกลบ · 0 กลุ่มซ้ำ
ฐาน dev ของผม (ซ้ำจริง + F-15)    ปิด 29/30 เก็บ 27 · F-15 (24/25) ไม่ถูกแตะเลย
รันซ้ำ                           up to date ไม่ล้ม
```

ทดสอบ UNIQUE ทีละเคส: เชิญซ้ำคนที่ active → **ถูกปฏิเสธ** · pending ซ้อน / rejected_by_admin ค้าง /
เจ้าตัวปฏิเสธเอง / แถวที่ถูกถอดแล้ว → **ผ่านทั้งหมด** (ของที่ต้องทำได้ยังทำได้)

## OD-47 — แยก "สถิติในทัวร์" ออกจาก "สถิติโปรไฟล์" — ✅ ตัดสินแล้ว 2026-10-02 (ทำ)

**ต่อจาก OD-46** — พอมีสวิตช์ปิดสถิติแล้ว คำถามถัดมาคือ *ปิดแล้วหน้าทัวร์ที่ตัวเองลงแข่งควรหายด้วยไหม*
มติ: **ไม่หาย** · แยกของสองอย่างออกจากกันให้ชัด

| | ขอบเขต | ปิดได้ไหม |
|---|---|---|
| **สถิติในทัวร์** (RW06 ใหม่) | ทัวร์นี้ทัวร์เดียว | ❌ เปิดเสมอ |
| **สถิติโปรไฟล์** (U04 · U14 · RW05) | รวมทุกทัวร์ของไอดีนั้น | ✅ ปิดได้ตาม OD-46 |

**เหตุผลที่ RW06 ไม่ถูกปิด** — สายการแข่ง ผลแมตช์ รายชื่อลงสนาม และ `GET /matches/:id/stats`
เป็นสาธารณะอยู่แล้วทั้งหมด ⇒ ใครก็ไล่บวกสถิติของคนหนึ่งในทัวร์หนึ่งเองได้
**เส้นนี้ไม่ได้เปิดเผยอะไรใหม่ แค่บวกให้** · สิ่งที่ OD-46 กันคือ**การรวมข้ามทัวร์มาไว้หน้าเดียว**

ถ้าเอาด่าน OD-46 มาใส่ RW06 คนที่ปิดสถิติโปรไฟล์จะหายจากหน้าทัวร์ที่ตัวเองลงแข่ง
ซึ่งเกินกว่าที่มติกำหนด และทำให้หน้าทัวร์ของผู้จัดมีช่องว่างที่อธิบายไม่ได้

**พูดตรง ๆ ไว้: ปิดสถิติโปรไฟล์ไม่ใช่การหายตัว** คนยังไล่ทัวร์ทีละทัวร์เอาเองได้
(ทัวร์เป็นสาธารณะ) แก้ด้วยสวิตช์ไม่ได้และไม่ควรแก้ · เจตนาคือ *"อย่ารวมผมไว้หน้าเดียว"*
ตรงกับที่รางวัลที่ปิดไว้ก็ยังโชว์ในบริบทของทัวร์ได้

### สองข้อที่ตัดสินพร้อมกัน

**1 · `career` (U14) ปิดต่อ** — มันคือ *"X ลงทัวร์อะไรมาบ้างในชีวิต"* พร้อม played/wins/losses รายทัวร์
⇒ ใครก็บวกเองได้เป็นสถิติรวมใน 10 วินาที **ถ้าเปิดไว้ สวิตช์ OD-46 จะไม่มีความหมาย**
และปิดมันไม่กระทบ flow ของหน้า "โปรไฟล์ในทัวร์" เพราะหน้านั้นใช้ RW06 ซึ่งรู้ `tournamentId` อยู่แล้ว

**2 · ทำเป็น endpoint ใหม่ ไม่ใช่ `?tournamentId=` ใน RW05** — ทางหลังทำให้ **สิทธิ์ขึ้นกับ query param**
(มี param = ข้ามด่าน) ซึ่งพลาดง่ายและเจอมาแล้วสองรอบในสัปดาห์เดียว (`dabe9e3` · `d5bda6d`)
วันที่มีคนเพิ่ม filter ใหม่แล้วลืมเงื่อนไขนั้น สถิติที่ปิดไว้จะรั่วทั้งเส้น
**1 เส้น = 1 กฎ** เขียนในเอกสารจบในบรรทัดเดียว · และไม่ได้ประหยัดงานจริง เพราะยังต้องเขียนเทสเคสไขว้ทั้งหมด

### ที่ทำ

- `career.repo` และ `matchHistory.repo` รับ `tournamentId` เพิ่มแบบ optional (`(? IS NULL OR t.tournament_id = ?)`)
  ⇒ **RW06 ใช้ SQL ชุดเดียวกับ U14/RW05** ไม่ใช่ query ใหม่ที่จะเพี้ยนกันเองวันที่มีใครแก้นิยาม played/wins
- `playerStats` รวมยอดในทัวร์จากสถิติรายแมตช์ · ช่องที่กรรมการไม่กรอก (`value_int` null)
  ถือว่า**ไม่มีข้อมูล ไม่ใช่ 0** ⇒ ว่างทุกแมตช์ = `null` · กรอกบางแมตช์ = บวกเฉพาะที่กรอก
- **404 `PLAYER_NOT_IN_TOURNAMENT`** เมื่อไม่เคยอยู่ในรายชื่อที่ผ่านของทัวร์นี้
  ต่างจากอยู่ในรายชื่อแต่ยังไม่ลงสนาม ซึ่งได้ **200** + `played: 0` (มีแถวอยู่จริง)

### ตรวจจริงกับฐาน (ไม่ใช่แค่เทส)

โหลด `qa-baseline.sql` ลงฐานชั่วคราว → migrate ถึง 035 → ยิงจริงทั้ง 9 เคส
แล้ว `UPDATE users SET show_profile_stats = 0` ของ 9002 แล้วยิงซ้ำ

```
RW06 t2/u9002         200  ← ยังเห็น (นี่คือใจความของ OD-47)
U04 · U14 · RW05      200  statsHidden: true · ข้อมูลเป็น null
U03 โปรไฟล์           statsHidden: true แต่ชื่อ/ทีม/ผู้ติดตามยังอยู่
GET /tournaments/2    200  ← route ใหม่ไม่ทับ path เดิม
t1/u9002              404  PLAYER_NOT_IN_TOURNAMENT
```

### แก้เพิ่ม 2 ต.ค. — 404 เกิดได้จริง และเปิดช่องว่างที่ใหญ่กว่า

ถามกันว่า `PLAYER_NOT_IN_TOURNAMENT` มีทางเกิดไหม เพราะ flow ปกติไม่มีชื่อให้กดถ้าไม่ได้อยู่ในทัวร์
**ถูกสำหรับ flow ปกติ แต่เกิดได้ทางหนึ่ง** และทางนั้นชี้ปัญหาที่ใหญ่กว่า

`M19 รายชื่อผู้เล่นในแมตช์` **ตั้งใจแสดงคนของทีมที่ถอนตัวด้วย** (มติ 26 ก.ย. — `match.repo`:
"แมตช์ที่แข่งไปแล้วต้องบอกได้เสมอว่าใครลงสนาม แม้ทีมจะถอนตัวทีหลัง") แต่ `career.repo`
และ `matchHistory.repo` รับแค่ `approved` ⇒ **ชื่อกดได้ แต่กดไปเจอ 404**

และตัวกรองเดียวกันนั้นทำให้ **แมตช์ที่ลงแข่งจริงและผลยืนยันแล้ว หายจากประวัติของคนนั้นทั้งหมด**
ทั้งที่ผลยังอยู่ในระบบและตารางคะแนนยังนับ · **เป็นพฤติกรรมเดิม ไม่ใช่ของที่เพิ่งเพิ่ม** แต่ RW06 สืบทอดมาเต็ม

**พิสูจน์กับฐานจริง** (baseline ลงฐานชั่วคราว · t13 ทีม 9008 ผู้ใช้ 9101 มี 2 นัด verified
แล้ว `UPDATE` ใบสมัครเป็น `withdrawn`):

```
                      ก่อนถอน        หลังถอน
RW06 t13/u9101        played 2       played 2 · withdrawn true   ← แก้แล้ว (เดิมจะเป็น 404)
RW05 match-history    3 items        1 items     ← 2 นัดที่แข่งจริงหาย
U14 career            5 items        4 items     ← ทัวร์นั้นหายจากรายการ
M19 lineups           เห็นชื่อ        เห็นชื่อ      ← ยังเห็น ตามมติ 26 ก.ย.
```

**ตัดสินแล้ว ทำไปแล้ว** — RW06 นับใบที่ `withdrawn` ด้วย + ธง `withdrawn: true`
`includeWithdrawn` เป็น parameter ที่ **ค่าเริ่มต้นปิด** ⇒ U14/RW05 ไม่เปลี่ยนพฤติกรรมเลย

**ยังไม่ตัดสิน — ต้องเป็นมติทีม** (ส่งคำถามไปแล้วใน `TO-TEAM-2026-10-02-withdrawn-stats.md` · **ข้อ ก ของไฟล์นั้น**)

> ⚠️ **อย่าอ้างด้วยตัวอักษรลอย ๆ** — คำถามนี้ถูกตั้งตัวเลือก 2 รอบด้วยชุด ก/ข/ค คนละความหมาย
> รอบแรก (ตอนเลือกว่าจะแก้ RW06 ไหม): ก = แก้แค่ RW06 · ข = นับทุกที่ · ค = ไม่ทำอะไร
> รอบสอง (ไฟล์ที่ส่งทีม): **ก = นับทุกที่** · ข = คงไว้แบบนี้ · ค = นับแต่ไม่รวมยอด
> ⇒ เวลาอ้างถึง ให้เขียนเป็นคำว่า "ให้ U14/RW05 นับใบที่ถอนด้วยไหม" ไม่ใช่ตัวอักษร
ให้ `U14`/`RW05` นับใบที่ `withdrawn` ด้วยไหม · ความจริงครบที่สุดคือ "นับ" เพราะเขาลงแข่งจริง
แต่มันจะ **ขยับตัวเลขในหน้าโปรไฟล์ของทุกคนที่ทีมเคยถอนตัว** และเป็นโค้ดที่คนอื่นเขียน
FE อาจแสดงอยู่แล้ว ⇒ ไม่ตัดสินเอง · ผลข้างเคียงที่ต้องรับไว้ก่อน: **ตัวเลขหน้าในทัวร์กับหน้าโปรไฟล์
จะไม่เท่ากันเฉพาะเคสทีมถอนตัว** (RW06 นับ · U14/RW05 ไม่นับ)

หมายเหตุที่ทำให้การ "นับทุกที่" ปลอดภัยกว่าที่คิด: นัดที่เป็น**ชนะบายจากการถอน**ไม่ถูกนับให้อยู่ดี
เพราะ walkover เก็บเป็น `match_result_status = 'walkover'` แต่ทั้งสอง query รับแค่ `'verified'`
⇒ เปิดรับ `withdrawn` ไม่ได้แถมความพ่ายแพ้ที่ไม่ได้ลงแข่งให้ใคร

**ถอนแล้วสมัครใหม่** (A1) มีได้สองใบต่อทัวร์ ⇒ service เลือกใบที่ยัง `approved` ก่อนเสมอ
`has_approved` คิดเป็น `MAX()` ไม่ใส่ใน `GROUP BY` เพื่อให้ยังได้หนึ่งแถวต่อ (ทัวร์, ทีม) เหมือนเดิม
ตัวเลขของทั้งสองใบเท่ากันอยู่แล้วเพราะแมตช์ผูกกับ (ทัวร์, ทีม) ไม่ได้ผูกกับใบสมัคร

### 🔴 FE ต้องไม่เข้าใจผิด

`statsHidden` ใน `GET /users/:id` หมายถึง **สถิติโปรไฟล์ถูกซ่อน** เท่านั้น
**ไม่ได้แปลว่าห้ามแสดงสถิติในทัวร์** — ถ้า FE อ่านธงนี้แล้วซ่อนทุกอย่างรวมหน้าในทัวร์ จะปิดเกินมติ

## OD-46 — ปิดการแสดงสถิติในหน้าโปรไฟล์ของตัวเองได้ — ✅ ตัดสินแล้ว 2026-10-01 (ทำ · สวิตช์เดียว)

**ที่มา** — merge `feat/rewards-match-history` เข้ามาพร้อม `GET /users/:id/match-history` ที่เปิดสาธารณะ
ทำให้มีของสองอย่างอยู่ข้างกันแต่กฎคนละแบบ

| | เปิดสาธารณะ | เจ้าตัวปิดได้ไหม |
|---|---|---|
| รางวัล `GET /users/:id/rewards` | ✅ | ✅ ปิดได้รายชิ้น (`user_rewards.is_displayed`) |
| สถิติ `GET /users/:id/stats` | ✅ | ❌ (มาตั้งแต่แรก) |
| ประวัติแมตช์ `GET /users/:id/match-history` | ✅ | ❌ (ของใหม่) |

**ไม่ใช่ข้อบกพร่อง** — `GET /users/:id/stats` ก็ public มาตั้งแต่แรก ของใหม่จึงตรงกับแนวเดิม
แต่ "ปิดได้/ปิดไม่ได้" ของเส้นที่อยู่ข้างกันควรเป็นมติ ไม่ใช่ผลข้างเคียงของการที่ใครทำทีหลัง

### 4 ข้อที่ตัดสิน

| เรื่อง | ตัดสิน | เหตุผล |
|---|---|---|
| **ละเอียดแค่ไหน** | **สวิตช์เดียว** คุม U04 (stats) · U14 (career) · RW05 (match-history) | ปิดแค่ยอดรวมแล้วยังอ่านสถิติรายแมตช์ได้ = ปิดไม่จริง · หน้าตั้งค่าที่มีสามสวิตช์ซึ่งต้องปิดให้ครบจึงได้ผล เป็นการผลักภาระความเข้าใจไปให้ผู้ใช้ |
| **ปิดแล้วคืนอะไร** | **200 + `statsHidden: true`** และข้อมูลเป็น **`null`** | 403 จะทำให้หน้าโปรไฟล์พังทั้งหน้าเพราะ FE เรียกพร้อมกันหลายเส้น · และเป็น `null` ไม่ใช่ `0`/`[]` เพราะ 0 อ่านได้ว่า "ลงแข่งแล้วไม่เคยชนะ" และ `[]` ว่า "ไม่เคยลงแข่ง" — คำตอบที่ผิดซึ่งหน้าจอแยกจากของจริงไม่ออก |
| **ค่าเริ่มต้น** | **เปิด** (`DEFAULT 1`) | ไม่มีใครถูกซ่อนเงียบ ๆ จาก migration · ถ้า default 0 หน้าโปรไฟล์ของทุกคนจะว่างทันทีที่ deploy โดยไม่มีใครกดอะไรเลย |
| **ใครทะลุได้** | **เจ้าตัว + แอดมินทุกระดับ** | เจ้าตัวไม่ทะลุ = ปิดแล้วตัวเองก็ดูไม่ได้ ซึ่งไม่ใช่สิ่งที่ผู้ใช้ขอ · แอดมินต้องทะลุเพราะคิวคำร้องขอระงับตัดสินจากพฤติกรรมในสนาม ถ้ามองไม่เห็น การซ่อนจะกลายเป็นเครื่องมือหนีการตรวจ · **ผู้จัด/กรรมการไม่ทะลุ** — ดูผลและสถิติของแมตช์ในทัวร์ตัวเองได้อยู่แล้วทางเส้นของทัวร์ |

### ขอบเขต — ปิดได้แค่หน้าโปรไฟล์

**ตารางคะแนน · ผลแมตช์ · โหวต MVP ไม่แตะ** เพราะนั่นเป็นข้อมูลของ**การแข่งขัน** ไม่ใช่ของโปรไฟล์
ถ้าให้ปิดตรงนั้นได้ จะกลายเป็นคนซ่อนผลการแข่งของตัวเองในทัวร์ที่คนอื่นต้องใช้ตัดสิน

### ของที่ต้องทำเพราะตัดสินแบบนี้

- `U04` กับ `RW05` **ไม่รับ token เลยมาก่อน** ⇒ ต้องเพิ่ม `optionalAuth` ไม่งั้นระบบไม่รู้ว่าใครดู
  และเจ้าตัวจะดูของตัวเองไม่ได้ · **ยังเป็นเส้นสาธารณะเหมือนเดิม ไม่ใช่ `requireAuth`**
- ด่านอยู่ที่ `utils/profileStats.canSeeProfileStats()` **ที่เดียว** ⇒ สามเส้นตอบเหมือนกันแน่นอน
  ถ้าเขียนซ้ำสามที่ จะเพี้ยนกันเองเมื่อแก้ที่หนึ่งแล้วลืมอีกสองที่ (บั๊กคลาสเดียวกับสามด่านกรรมการใน `d5bda6d`)
- ค้นสิทธิ์แอดมินเฉพาะตอนจำเป็น (ปิดอยู่ + ไม่ใช่เจ้าตัว) ⇒ เส้นปกติไม่มี query เพิ่มเลย
- `MeDto.showProfileStats` = ค่าสวิตช์ของตัวเอง (หน้าตั้งค่าต้องรู้สถานะปัจจุบัน)
  คนละความหมายกับ `statsHidden` ใน DTO สาธารณะ ซึ่งหมายถึง "response นี้ซ่อนข้อมูลไว้"
  ⇒ เจ้าตัวที่ปิดสถิติแล้วเปิดดูโปรไฟล์ตัวเองจะได้ `statsHidden: false` เพราะเขาเห็นข้อมูล

### 🔴 ไม่สอดคล้องที่ยังเหลือ — FE ต้องรู้

รางวัลปิดได้**รายชิ้น** แต่สถิติเป็น**สวิตช์เดียว** ⇒ หน้าตั้งค่าจะมีของสองแบบที่ทำงานคนละอย่าง
ไม่ผิด (ธรรมชาติข้อมูลต่างกัน — รางวัลเป็นชิ้น ๆ สถิติเป็นตัวเลขรวม) แต่ต้องบอก FE ล่วงหน้า
ไม่ใช่ให้ไปเจอตอนทำหน้า

## OD-45 — ประกาศของผู้จัดไม่มีแจ้งเตือน และทีมที่ถอนตัวไม่มีใครบอกสมาชิก — ✅ ทำแล้ว 2026-10-01

**สองเรื่องในก้อนเดียว** เพราะเป็นอาการเดียวกัน: เขียนลงฐานสำเร็จ แต่ไม่มีทางไปถึงคนที่ต้องรู้

### 1 · ประกาศ (E08) — FE แจ้งมาใน `backend_task_announcement_notification_fix.md`

`createAnnouncement` บันทึกลงฐานแล้ว `return` ⇒ ประกาศขึ้นค้างในหน้าทัวร์ คนต้องเข้าไปเปิดดูเองถึงจะเห็น
ผู้จัดเลื่อนเวลาแข่ง/เปลี่ยนสนามแล้ว **ไม่มีใครรู้**

ไฟล์ของ FE เสนอให้เรียก `notifyTournamentSquads` ซึ่งถูกแล้ว แต่ไม่ได้ตอบ 3 เรื่อง ตัดสินเพิ่มดังนี้

| เรื่อง | ตัดสิน | เหตุผล |
|---|---|---|
| **กรรมการได้รับไหม** | **ได้รับ** — ยิง `notifyTournamentReferees` ด้วย | `notifyTournamentSquads` ครอบแค่ผู้เล่นในรายชื่อลงแข่ง + หัวหน้าทีม · `schedule_change`/`venue_change` เป็นเรื่องที่กรรมการต้องรู้ก่อนใคร · สองกลุ่มไม่ทับกันเพราะ CoI ห้ามคนในทีมที่ลงแข่งเป็นกรรมการทัวร์เดียวกัน |
| **ใช้ `announcement_type` ไหม** | **ใช้** — คำนำหน้าหัวข้อตามประเภท | ตารางมีคอลัมน์นี้มาตั้งแต่ schema แรก คนเห็นใน Inbox แล้วรู้ว่าด่วนไหมโดยไม่ต้องเปิดอ่าน |
| **แก้/ลบประกาศแจ้งซ้ำไหม** | **ไม่แจ้ง** (E10/E11) | แก้คำผิดคำเดียวจะกลายเป็นยิงใหม่ทั้งทัวร์ · ถ้าสำคัญพอ ผู้จัดโพสต์ใหม่ได้ |

### 2 · ทีมถอนตัว (P08)

`withdrawApplication` แจ้ง **ORG คนเดียว** ทั้งที่คนเสียสิทธิ์ลงแข่งคือ**สมาชิกทีม**

⚠️ **ส่วนที่ขอเพิ่มมาว่า "แจ้งทุกคนในแมตช์ ทั้งผู้เล่นที่เหลือ กรรมการ ORG" — มีอยู่แล้ว**
มติ 22 ก.ย. ทำไว้ครบ: ทุกแมตช์ที่จบโดยไม่มีการแข่ง (รวมลูกโซ่) ยิง `match_walkover` ถึง
สมาชิกทุกคนของทีมที่เกี่ยว + กรรมการของแมตช์ + ORG ผ่าน `notifyMatchDecidedWithoutPlay`
⇒ **ไม่ทำซ้ำ** เพราะจะกลายเป็นยิงสองใบเรื่องเดียวกัน

ช่องที่เหลือจริงคือ **ระดับทีม ไม่ใช่ระดับแมตช์** จึงเพิ่ม `notifyTeamMembers` ยิงถึงสมาชิกทุกคนของทีมที่ถอน
(ยกเว้นหัวหน้าทีมที่กดเอง) — คนละเรื่องกับแจ้งเตือนรายแมตช์: อันนี้ "ทีมคุณถอนจากทัวร์"
อันนั้น "แมตช์นี้จบด้วยผลอะไร" · และ **ทัวร์ที่ยังไม่จัดสาย (`matchCount = 0`) นี่เป็นทางเดียวที่ทีมได้รู้**
เพราะไม่มีแมตช์ให้ยิงเลย

ส่งถึงสมาชิก**ทุกคน** ไม่ใช่แค่คนในรายชื่อลงแข่ง เพราะคนที่ไม่ได้ถูกส่งชื่อลงรอบนี้ก็เสียโอกาสของทัวร์นี้เหมือนกัน

### 🔴 ค้างอยู่ 1 ขั้น → **ย้ายไปอยู่ OD-49** (3 ต.ค.)

ชนิด `tournament_announcement` **ยังไม่มีในตารางหมวดแจ้งเตือน (OD-43)** ⇒ ปิดไม่ได้
merge ตารางเข้ามาแล้ว (2 ต.ค.) และเติมหมวดไป 2 จาก 3 ตัว (3 ต.ค.) — **ตัวนี้ยังค้างอยู่**
เพราะชนิดเดียวคุมทั้ง "เลื่อนเวลาแข่ง" (ควรปิดไม่ได้) กับ "ประกาศทั่วไป" (ควรปิดได้) ⇒ **ดู OD-49**

## OD-44 — หลักฐานของคำร้องขอระงับผู้ใช้ ส่งออกเป็น S3 key ดิบ — ✅ ทำแล้ว 2026-10-01

> **เลข 43 เว้นไว้ให้ OD ของ `backend_shokun_2`** ที่เลขชนกับ OD-38 ของไฟล์นี้ จึงข้ามมา 44 เพื่อไม่เลื่อนเลขของคนอื่นเอง
> → **ใช้ไปแล้ว 2 ต.ค.**: merge สาขานั้นเข้ามาและเลื่อนของเขาเป็น OD-43 ตามที่เว้นไว้
> → **3 ต.ค.** สาขา `backend_step9-10` เอาเลข 43 ไปใช้ด้วยเพราะยังไม่เห็นการจองนี้ ⇒ เลื่อนของเขาเป็น **OD-50** ตอน merge (อยู่ท้ายไฟล์)

**FE รออยู่ (B1 ใน `TASK-vimsd-outstanding`)** — คิวคำร้องขอระงับผู้ใช้คืน `evidence` เป็น **S3 key ดิบ** FE เอาไปแสดงเป็นรูปไม่ได้
⇒ แอดมินอนุมัติ/ปฏิเสธคำร้องระงับคนโดยไม่เคยเห็นหลักฐานที่เป็นเหตุของคำร้อง
(รูปแบบเดียวกับ `supporting_docs` ของคิวทีม Official ที่แก้ไป 27 ก.ย. และ `rejection_reason` ที่แก้ 30 ก.ย. — คอลัมน์ที่เขียนแล้วไม่มีใครอ่าน)

**เจอเพิ่มระหว่างทำ — ช่องที่ให้อ่านไฟล์คนอื่นได้**

เดิม `evidence` เป็น `z.array(z.string())` เปล่า ไม่มีการตรวจเลยว่า key เป็นของใคร
ถ้าเพิ่ม presign ที่ขาออกเพียงอย่างเดียว จะกลายเป็นว่า **ใครก็ยื่นคำร้องแนบ key ของคนอื่นได้**
แล้วคิวแอดมินจะเซ็นลิงก์ไฟล์นั้นออกมาให้ ⇒ กลายเป็นช่องอ่านไฟล์ในถังผ่านคำร้องปลอม
ยิ่งกว่านั้น ระบบยังไม่มี upload purpose สำหรับหลักฐานชุดนี้เลย ⇒ ผู้แจ้งอัปหลักฐานไม่ได้มาตั้งแต่แรก

**ที่ทำ — คู่กันทั้งสองขา ไม่ทำข้างเดียว**

| ชั้น | ทำอะไร |
|---|---|
| M16 | เพิ่ม purpose `report_evidence` · key เป็น `report_evidence/{userId จาก token}/{uuid}.{jpg\|png}` ไม่รับ userId จาก body |
| schema คำร้อง | เพดาน 5 ไฟล์ (เท่า S03/S13) · key ยาวสุด 512 ตัวอักษร · ห้ามสตริงว่าง |
| service ขาเข้า | ทุก key ต้องขึ้นต้นด้วย `report_evidence/{ผู้แจ้ง}/` ไม่งั้น **400** `VALIDATION_FAILED` (กฎเดียวกับ `dispute_evidence`) |
| service ขาออก | คืน presigned URL ทั้งคิวแอดมินและ response ตอนยื่นสำเร็จ (สองที่ที่เดิมส่ง key ดิบทั้งคู่) |
| mapper | `evidence` กลายเป็นพารามิเตอร์**บังคับ** ไม่มี default `[]` |

**ทำไม mapper ไม่มีค่า default**

mapper เรียก service เองไม่ได้ (ชั้นล่างห้ามพึ่งชั้นบน) และการเซ็นลิงก์ต้อง await ⇒ รับมาเป็นอาร์กิวเมนต์
ถ้าให้ default เป็น `[]` แบบ `supporting_docs` endpoint ใหม่ที่ลืมส่งเข้ามาจะกลายเป็น "ไม่มีหลักฐาน" เงียบ ๆ
แทนที่จะพังตอน tsc — เป็นบั๊กคลาสเดียวกับที่กำลังแก้อยู่นี่เอง

**ที่ยังไม่ได้ทำ** — ไม่ได้เช็คว่าไฟล์มีอยู่จริงบน S3 (HeadObject) ก่อนบันทึก ต่างจาก avatar/team_logo/soft filter
เพราะหลักฐานที่หายไปไม่ทำให้คำร้องเสีย (ยังมี `reason` ชี้เสมอ) และ presign ของที่ไม่มีไฟล์ก็ไม่รั่ว
อยากสรุปไว้เป็นข้อเลือกถ้าทีมอยากให้คิวแอดมินไม่มีรูปเสียเลย

### ⚠️ ทำซ้ำกันสองสาขา — merge แล้ว 3 ต.ค. (เก็บด่านไว้)

`backend_step9-10` (`9e7fd64`, 3 ต.ค.) ทำ B1 เรื่องเดียวกันขึ้นมาอีกชุด — **ไม่ใช่ใครพลาด**
B1–B4 เป็นงานของเขาตาม `TASK-vimsd-outstanding` ส่วนผมทำ B1 ไปก่อนเมื่อ 1 ต.ค. ตอนที่ยังไม่มีคนรับ

สองฝั่งได้ `toUserReportDto(row , presignedEvidence)` รูปเดียวกันเป๊ะ ⇒ conflict แค่ชื่อพารามิเตอร์
**แต่ฝั่งเขามีแค่ขาออก (presign) ไม่มีขาเข้า** — ไม่มี purpose `report_evidence` และไม่มีด่านเช็คเจ้าของ key

| | ฝั่งเขา | หลัง merge |
|---|---|---|
| presign ตอนอ่าน (คิวแอดมิน + response ตอนยื่น) | ✅ มี | ✅ |
| purpose `report_evidence` ให้อัปโหลด | ❌ ไม่มี ⇒ **FE ไม่มีทางได้ key มาใส่** | ✅ เก็บของ `BE_KN` |
| ด่าน `report_evidence/{ผู้แจ้ง}/` | ❌ ไม่มี ⇒ แนบ key ของคนอื่นแล้วได้ลิงก์ที่เซ็นแล้วคืนมา | ✅ เก็บของ `BE_KN` |
| เพดาน 5 ไฟล์ / key ≤ 512 ตัวอักษร | ❌ `z.array(z.string())` เปล่า | ✅ เก็บของ `BE_KN` |

⚠️ **ความแรงของข้อ 3 ตามจริง** — key มี `randomUUID()` อยู่ ⇒ **เดาสุ่มไม่ได้** ต้องเคยเห็น key ดิบมาก่อน
ซึ่งเกิดได้จริง (OD-44 นี้คือเรื่องที่ API เคยส่ง key ดิบออกมา) ⇒ เป็นการ**ยกระดับจาก "รู้ key" เป็น "อ่านไฟล์ได้"**
ไม่ใช่รูที่เปิดให้ใครก็กวาดไฟล์ในถังได้ · แต่ปิดแล้วเพราะด่านของ `BE_KN` รอดมาทั้งชุด

ส่วนที่เก็บของเขา: คอมเมนต์เตือน "ห้ามใช้ `toPublicImageUrl` กับ evidence" ใน mapper · เหตุผลอ้าง OD-36
ใน `adminScope.service` · และเทส pass-through สองค่าใน `userReport.mapper.test`

## OD-43 — ผู้ใช้ปิด/เปิดการแจ้งเตือนเป็นหมวดได้ (Sprint #2 · advanced notifications ก้อนแรก) — ✅ Resolved 2026-09-30

> **เดิมเขียนไว้เป็น OD-38 บนสาขา `backend_shokun_2`** — เลขชนกับ OD-38 ของไฟล์นี้
> (`ผู้แจ้งใน user_reports ไม่ได้รับแจ้งผล`) เพราะสองคนเขียนคู่ขนานกันคืนเดียวกัน 30 ก.ย.
> เลื่อนเป็น OD-43 ตอน merge (2 ต.ค.) โดย **ไม่แตะเนื้อหาหรือข้อสรุปของเจ้าของเลยแม้แต่คำเดียว**
> เลข 43 เพราะ 39–42 ถูกใช้ไปแล้วระหว่างที่สาขานี้รออยู่

`08-engagement.md` §3 เขียนไว้ตั้งแต่ต้นว่า *"ผู้ใช้เปิด/ปิด notification category ได้ แต่การปิด preference ไม่ควรลบ notification history ที่ระบบจำเป็นต้องเก็บ"*
แต่ไม่เคยมีใครทำ · ที่หนักกว่าคือ **`users.notification_prefs` (JSON) มีอยู่ใน schema แล้ว และ `user.mapper` ส่งค่าออกไปให้ FE ด้วย
แต่ไม่มี endpoint ไหนเซ็ตได้ และไม่มีโค้ดตรงไหนอ่านมันก่อนส่งแจ้งเตือน** — คอลัมน์ที่คืนออกไปแต่ไม่มีใครเขียนและไม่มีอะไรเคารพ
(กลับด้านกับ OD-29/OD-30 ที่กวาดหาคอลัมน์ที่เขียนแล้วไม่มีใครอ่าน จึงรอดสายตารอบนั้นไป)

**ไม่มี migration** — คอลัมน์มีอยู่แล้ว · ระบบส่งแจ้งเตือนอยู่ **36 ชนิด** จาก 12 service และทุกชนิดวิ่งผ่าน `notify()` จุดเดียวก่อนลงฐาน

| # | เรื่อง | มติ |
|---|---|---|
| 1 | ขอบเขต | ทำเฉพาะ **เปิด/ปิดรายหมวด** · ยังไม่ทำ push/email (ต้องพึ่งผู้ให้บริการนอกระบบ + งานฝั่ง FE) และยังไม่ทำ digest (ต้องออกแบบกฎรวบ + คอลัมน์นับ) — สองอันนั้นเป็น OD แยกถ้าทีมจะทำต่อ |
| 2 | แบ่งหมวดยังไง | สองชั้น — ชั้นบนแบ่งตาม **"มีเส้นตายไหม"** ได้ `critical` (ปิดไม่ได้) · ที่เหลือแบ่งตามโดเมนเป็น 6 หมวดให้หน้าตั้งค่าอ่านรู้เรื่อง: `team` `tournament` `match` `referee` `result` `community` |
| 3 | ★ เกณฑ์ของ `critical` | **"มีเส้นตายที่วัดได้ ไม่รู้แล้วเสียสิทธิ์ถาวร"** ไม่ใช่ "สำคัญไหม" ซึ่งเถียงกันไม่จบ · ทุกตัวอ้างของจริงได้: `team_invitations.expires_at` · `tournaments.dispute_window_hours` (6–72 ชม.) · `AUTO_VERIFY_HOURS` · `ORG_RESOLVE_HOURS` (48 ชม.) · `SUBMIT_ESCALATION_HOURS` · ช่วงรับสมัคร · เวลาแข่ง · หน้าต่างเช็คอิน |
| 4 | ทำไมไม่ใช้เกณฑ์ "กระทบสิทธิ์" | ลองแล้วได้ **บังคับ 27 / ปิดได้ 9** — หน้าตั้งค่าที่ปิดอะไรแทบไม่ได้ ไม่แก้ปัญหาของคนที่รำคาญ · เกณฑ์เส้นตายได้ **บังคับ 17 / ปิดได้ 19** และเวลามีคนถามว่าทำไมอันนี้ปิดไม่ได้ ตอบด้วยข้อเท็จจริงในฐานได้ |
| 5 | ปิดแล้วแปลว่าอะไร | **ยังบันทึกลงฐานเหมือนเดิม** ไม่หายไปไหน · แต่ไม่โผล่ในกล่องและไม่ถูกนับใน `unreadCount` · ตรงกับสเปคที่ห้ามลบ history และทำให้เปิดกลับแล้วของเก่ากลับมาครบ |
| 6 | ดูย้อนหลัง | `GET /me/notifications?includeMuted=true` คืนของที่ปิดไว้ด้วย — FE ทำเมนู "ดูที่ปิดไว้" ได้ถ้าอยาก |
| 7 | ★ `unreadCount` | ใช้ลิสต์ที่ปิดไว้ **เสมอ ไม่ขึ้นกับ `includeMuted`** — กระดิ่งแปลว่า "ของที่คุณสนใจและยังไม่อ่าน" ถ้าเลขกระพริบตาม query ผู้ใช้จะเห็นเลขเด้งไปมาโดยไม่มีอะไรเปลี่ยนจริง |
| 8 | เปลี่ยนค่าแล้วย้อนหลังไหม | **มีผลย้อนหลัง** — กรองตอนอ่าน ไม่ประทับตอนเขียน · ปิดหมวดชุมชนแล้วของเก่าในกล่องหายไปด้วย ซึ่งตรงกับที่คนคาดหวังตอนกดปิด · ทางที่ไม่เอา: ประทับ flag ตอน insert (ต้อง migration + ต้องตัดสินว่าแถวเก่าก่อน migration นับเป็นอะไร) |
| 9 | ค่าเริ่มต้น | `notification_prefs` เป็น NULL หรือ JSON เพี้ยน = **เปิดทุกหมวด** · มีแต่ค่า `false` เท่านั้นที่แปลว่าปิด |
| 10 | ชนิดที่ยังไม่ได้จัดหมวด | นับเป็น `critical` โดยปริยาย — "ลืมจัดหมวดแล้วแจ้งเตือนหายเงียบ" แย่กว่า "ลืมจัดหมวดแล้วปิดไม่ได้" · คนเพิ่ม type ใหม่จะเจอว่ามันปิดไม่ได้ แล้วค่อยมาเติมตาราง |
| 11 | endpoint | `GET /me/notification-prefs` + `PATCH /me/notification-prefs` · แยกเส้นจาก `/notifications` ตั้งใจ ไม่ให้ `prefs` ไปชนกับ `/notifications/:id/read` (กับดักเดียวกับ `/comments/me` ใน OD-24) |
| 12 | GET คืนอะไร | ทุกหมวดพร้อมธง `locked` รวม `critical` ด้วย — **FE ไม่ต้อง hardcode รายชื่อหมวด** เพิ่มหมวดใหม่ทีหลังแล้วหน้าตั้งค่าโผล่ให้เอง |
| 13 | PATCH | ส่งเฉพาะหมวดที่อยากเปลี่ยน ที่ไม่ส่งมาคงค่าเดิม · ส่ง `critical` หรือชื่อที่ไม่รู้จัก → **400 ตั้งแต่ชั้น schema** ไม่ปล่อยผ่านเงียบ ๆ เพราะคนที่กดปิดแล้วยังได้รับอยู่จะคิดว่าระบบพัง · object ว่างก็ 400 |

**หมวดที่ปิดไม่ได้ (17) พร้อมเส้นตายที่อ้างได้** — เหตุผลรายตัวอยู่ในคอมเมนต์ของ `config/notificationCategories.ts`
`team_invited` · `squad_below_minimum` · `registration_toggled` · `application_decided` · `match_scheduled` · `checkin_opened` · `match_finished` · `bracket_redrawn` · `referee_invited` · `referee_change_request` · `referee_external_decided` · `result_submitted` · `result_verified` · `result_auto_verified` · `result_decided_by_organizer` · `result_disputed` · `match_result_complaint_filed`

**สามตัวที่ก้ำกึ่ง — ติดป้ายไว้ในโค้ดแล้ว ถ้าทีมไม่เห็นด้วยย้ายได้ทันทีโดยไม่ต้องแก้ตรรกะ**
- `match_abandoned` → `match` — ล้างเช็คอินจริง แต่เวลานัดใหม่จะมาทาง `match_scheduled` ซึ่งบังคับอยู่แล้ว
- `match_walkover` → `match` — ผลตัดสินไปแล้ว รู้ช้าก็เปลี่ยนอะไรไม่ได้
- `referee_removed` → `referee` — สิทธิ์เปลี่ยนจริง แต่ไม่มีอะไรให้ทำทันเวลา

- `notify()` **ไม่ถูกแตะเลย** — การกรองอยู่ฝั่งอ่านทั้งหมด จึงไม่มีทางที่แจ้งเตือนจะหายจากฐานเพราะบั๊กของ OD นี้
- ยังไม่ได้แตะ `related_entity_type/id` ที่มีคู่เดียว (ข้อจำกัดที่ OD-24 บันทึกไว้) — คนละเรื่องกับ preference

## OD-42 — `qa-baseline.sql` ใหม่ ที่ schema ปัจจุบันและไม่มีเคสผิดกฎ — ✅ ทำแล้ว 2026-10-01

**FE ขอมาใน `TO-BACKEND-2026-09-30` §3 ข้อ 2** · baseline เดิมเก็บไว้ 21 ก.ย. และค้างมาตลอด

**สามปัญหาที่ซ้อนกันอยู่**

| | อาการ |
|---|---|
| **1** | `schema_migrations` ในไฟล์หยุดที่ **020** ทั้งที่ตัวตารางมีคอลัมน์ของ 021+ อยู่แล้ว |
| **2** | restore **ไม่ล้างตารางที่ไม่อยู่ในไฟล์** ⇒ ตารางของ migration ใหม่กว่ารอดมา |
| **3** | เคสผิดกฎบทบาท **12 เคส** ฝังอยู่ตั้งแต่ก่อนมติ 18 ก.ย. (OD-10) |

**(1) + (2) รวมกันคือตัวที่ทำให้ฐานพัง** — restore แล้ว `schema_migrations` ถูกทับเป็นของเก่า
แต่ตารางใหม่ยังอยู่ ⇒ `npm run migrate` พยายาม `CREATE TABLE` ตารางที่มีอยู่แล้ว แล้ว **ล้มกลางทาง**
ที่ 024 · 028 · 029 · **migration ที่เหลือหลังจุดที่ล้มจึงไม่เคยถูกสร้างเลย**
ฐานดูเหมือนย้อนสำเร็จ แต่ schema ไม่ครบ — FE เจอหน้าแมตช์กับตารางคะแนน `500`

### ที่ทำ

- **เก็บ baseline ใหม่ที่ schema 034** · `schema_migrations` ครบ 34 แถว ⇒ `npm run migrate` หลัง restore ตอบ `up to date`
- **`qa-baseline.py restore` ล้างทุกตารางก่อนโหลด** (ฟังก์ชัน `wipe()`) — ลบจาก `information_schema`
  ไม่ใช่ `DROP DATABASE` เพราะสิทธิ์ `CREATE DATABASE` อาจไม่มีในบางเครื่อง และชื่อฐาน/collation เดิมต้องไม่เปลี่ยน
- **024 · 028 เป็น `CREATE TABLE IF NOT EXISTS`** — ป้องกันซ้ำอีกชั้นสำหรับคนที่ `mysql ltms < qa-baseline.sql`
  ด้วยมือ ไม่ผ่านสคริปต์ (ซึ่งเป็นวิธีที่ FE ใช้) · แก้ไฟล์ที่ push แล้วโดยอาศัยเหตุผลเดียวกับ 029
  ฐานที่รันไปแล้วไม่รันอีก · ฐานที่ยังไม่รันได้ตารางเดิม
- **เพิ่ม env override** `LTMS_MYSQL_DB` / `LTMS_MYSQL_CONTAINER` / `LTMS_MYSQL_PASSWORD` ใน `qa-baseline.py`
  ชื่อเดียวกับ `frontend/scripts/*.py` ⇒ โหลด baseline ลงฐานชั่วคราวได้โดยไม่แตะฐาน dev ของตัวเอง

### (3) แก้ด้วยการรัน `frontend/scripts/restore-qa.py` ของ FE ไม่ใช่เขียน SQL เอง

**ที่ตัดสินเอง (บอกไว้)** — ตั้งใจไม่เขียน `UPDATE`/`DELETE` ด้วยมือ เพราะสคริปต์นั้นแก้**ผ่าน API**
⇒ ได้ audit log · แจ้งเตือน · และ state ที่ระบบคำนวณต่อ (ถอดกรรมการแล้วล้าง `match_referees` ให้ ·
กดจบแมตช์แล้วลงเวลาจบ) ครบตามเส้นทางจริง · เขียน SQL เองจะได้ฐานที่ "หน้าตาถูก" แต่ไม่มีร่องรอยว่าใครทำ
ซึ่งเป็นความไม่สอดคล้องแบบเดียวกับที่งานนี้ตั้งใจกำจัด

รันด้วย `--no-restore` บนฐานชั่วคราว `qa_build` + backend ชั่วคราวที่ port 8001 แล้ว `mysqldump` ออกมา

**รายการแก้ (ทั้งหมดเป็นมติของผู้ใช้ 29–30 ก.ย. ที่ FE บันทึกไว้ในสคริปต์)**

| | แก้อะไร |
|---|---|
| ผู้จัดลงแข่งทัวร์ตัวเอง (3) | **ย้ายผู้จัด** t22 · t23 → 9001 · t14 → 9201 — ไม่ถอดคนออกจากรายชื่อลงแข่ง |
| ผู้จัดเป็นกรรมการทัวร์ตัวเอง (2) | ถอด 9001 ออกจาก t2 · t4 |
| กรรมการอยู่ในทีมที่สมัคร (7) | ถอด 9002 · 9003 ตามทัวร์ |
| กรรมการไม่ถึงขั้นต่ำหลังถอด | เติม **9051 · 9052** (staff ภายใน ไม่ต้องรอแอดมินยืนยัน) 8 ที่นั่ง ⇒ ห้าทัวร์กลับมา 2 คน |
| แมตช์ 1 เปิดเช็คอินโดยไม่มีนัด | ถอยกลับ จัดนัด + สนาม + กรรมการ แล้วเปิดเช็คอินใหม่ |
| แมตช์ 12 มีผลก่อนกดจบ | กรรมการกดจบผ่าน M11 |
| t12 ปิดแล้วไม่มีแชมป์ | เติมแชมป์ = ทีม 9008 จากผลนัดชิงที่ยืนยันแล้ว |

**ยืนยันกับ FE ก่อนทำ** — `somying@ku.th` (9002) ถูกถอดจาก t2/t6/t16 แต่ยังเป็นกรรมการ match 1/13
FE ตอบว่า match 1 อยู่ **t10** · match 13 อยู่ **t23** ⇒ ไม่ขัดกัน · ตรวจซ้ำกับฐานแล้วตรง

**ตรวจผล:** ฐานเปล่า → โหลด baseline ใหม่ → `up to date (34 migrations)` → `audit-roles.py` **C1–C8 ผ่านครบ**
และทดสอบกรณีที่ FE เจอโดยตรง: สร้างตารางปลอมทิ้งไว้แล้ว restore ⇒ ตารางปลอมหาย เหลือ 42 ตาราง 34 migrations

### เจอเพิ่มระหว่างทาง — ไม่ได้อยู่ในรายงานของใคร

- **`tournament_referees` มีแถวซ้ำ** `(t2, 9003)` สองแถว สถานะ `accepted` ทั้งคู่
  ⇒ การนับกรรมการของ t2 เกินจริงไป 1 · ตารางนี้**ไม่มี UNIQUE (tournament_id, user_id)**
  หายไปเองเพราะทั้งสองแถวติดกฎ C2 และถูกถอด แต่ **ช่องที่ให้สร้างซ้ำยังเปิดอยู่**
  → **✅ ปิดแล้ว 2 ต.ค. (OD-48)** generated column + UNIQUE ที่ระดับฐาน + migration 036 ล้างแถวค้างให้
- **`actual_end_time` เป็น NULL** ในแมตช์ที่ `completed` อยู่ 6 แมตช์ (2–6, 9) เพราะ migration 026
  เพิ่มคอลัมน์โดยไม่ backfill · `audit-roles.py` ไม่จับเพราะ C8 ดูแค่แมตช์ที่ยังไม่จบ
  → **ตัดสิน 2 ต.ค.: ไม่แก้** · migration 026 เขียนไว้ตรง ๆ ว่า "แมตช์เก่าที่ completed ไปแล้วไม่ต้อง
  backfill — ไม่มีข้อมูลจริงให้เติม และไม่มีกฎไหนย้อนไปใช้กับแมตช์ที่จบแล้ว" ซึ่งเป็นการตัดสินใจ ไม่ใช่ลืม
  เติมได้แค่เวลาที่เดาเอา (เช่นใช้ `scheduled_end_time`) = ใส่ตัวเลขที่ไม่ใช่ความจริงลงฐาน
  ผลที่เสียจริงมีแค่ FE ไม่มีเวลาจบให้โชว์ และหน้าต่างโหวต MVP ของแมตช์นั้นเปิดไม่ได้
  (ซึ่งปิดไปนานแล้วอยู่ดี เพราะหน้าต่างนับเป็นชั่วโมงจาก `actual_end_time`)

## OD-41 — แถวที่ revive กลับเข้าคิวเองโดยไม่มีใครรายงาน — ✅ ตัดสินแล้ว 2026-10-01 (คงไว้ในคิว แต่ต้องแจ้ง)

**FE รายงานมา 30 ก.ย.** (`TO-BACKEND-2026-09-30` §1 คำถามเล็ก) — เจอระหว่างรันเทสซ้ำบนแถวเดิม:
ความเห็นที่ **ผู้จัด**ลบ แล้วเจ้าของเขียนใหม่ (revive ตามมติ 23 ก.ย. ข้อ 6.6 ทาง ก)
จะใช้แถวเดิม และ `is_reported` ยังเป็น 1 ⇒ **ข้อความใหม่ขึ้นในคิว `?reported=true` ทันที
โดยไม่มีใครรายงานข้อความนั้น และไม่มีใครได้รับแจ้ง**

**FE ตั้งข้อสังเกตว่าสองกฎดูคนละทิศ** — `is_reported` ไม่ล้างตอนแก้ (23 ก.ย. 5-ก)
แต่ `report_cleared_at` ล้างตอนแก้ (30 ก.ย.) · **ตรงนี้ FE เทียบผิดคู่: สองกฎนั้นไปทางเดียวกัน**
ทั้งคู่บังคับว่า "แก้ข้อความแล้วต้องไม่ถูกตรวจ *น้อยลง*" — ธงค้างไว้ = ยังต้องตรวจ · ล้างตรายกเว้น = ตรวจได้อีก

**ที่ขัดจริงเป็นอีกเรื่อง** — แถวโผล่ในคิวที่ชื่อว่า "ถูกรายงาน" ทั้งที่ไม่มีใครรายงานข้อความนี้
⇒ คิวพูดสิ่งที่ไม่จริง และเพราะไม่มีแจ้งเตือน ผู้จัดอาจไม่เคยเปิดดูเลย
แถวนั้นจึงนิ่งอยู่ในคิวได้ตลอดไป ซึ่งเป็นรูปแบบเดียวกับที่หลัก **"การนิ่งเฉยต้องไม่มีอำนาจยับยั้ง"** ห้ามไว้

**สองทางที่พิจารณา**

| | ทำอะไร | ผล |
|---|---|---|
| ก | revive แล้วล้าง `is_reported` เป็น 0 | ❌ **ไม่เลือก** |
| **ข** | คงไว้ในคิว **แต่แจ้งผู้จัดว่าของที่เขาลบถูกเขียนใหม่** | ✅ **เลือก** |

**ทำไมไม่เอา ก** — ถ้าเขียนใหม่แล้วธงหาย เจ้าของก็พลิกคำตัดสินของผู้จัดได้เงียบ ๆ ด้วยการแก้ข้อความ
ซึ่งเป็น **รูเดียวกับที่มติ 23 ก.ย. ข้อ 5-ก ปิดไปแล้ว** แค่เปลี่ยนจาก "แก้" เป็น "ถูกลบแล้วเขียนใหม่"
และคนที่เคยถูกลบแล้วเขียนใหม่คือกลุ่มที่ *ควร* ถูกดูซ้ำมากที่สุด ไม่ใช่กลุ่มที่ควรได้เริ่มใหม่หมด

**ที่ทำจริง** — แจ้งเตือนชนิดใหม่ `comment_rewritten_after_removal` ถึง **ผู้จัดที่ลบ**

- ข้อความบอกด้วยว่า **ธงเก่ายังค้าง** และแถวอยู่ในคิว — ไม่งั้นผู้จัดเปิดคิวมาแล้วหาไม่เจอว่าใครแจ้ง
- **เกิดได้ครั้งเดียวต่อการลบหนึ่งครั้ง** — revive แล้ว `removed_at` เป็น NULL การแก้ครั้งถัดไปไม่ใช่ revive
  จึงไม่มีทางกลายเป็นสแปมใส่ผู้จัด
- ผู้จัดลบความเห็นของตัวเองแล้วเขียนใหม่ = ไม่แจ้ง (กฎเดียวกับ `removeFeedback` / `restoreFeedback`)

✅ **จัดหมวดแล้ว 3 ต.ค. → `community`** (OD-49) — ก่อนหน้านี้ชนิดใหม่นี้ไม่อยู่ในตาราง
`NOTIFICATION_CATEGORY` จึงเป็น `critical` (ปิดไม่ได้) โดยปริยาย · อันนี้ไม่มีเส้นตาย ⇒ `community`

## OD-40 — บอกคนที่ถูกระงับว่าเพราะอะไร — ✅ ตัดสินแล้ว 2026-10-01 (ทางเลือก ข · ส่งประเภท ไม่ส่งข้อความดิบ)

**ปัญหา (เดิมคือ B5 ในหนี้ของ vimsd):** `suspended_reason` ถูกบังคับให้แอดมินกรอกและเก็บลงฐาน
แอดมินเห็นแล้ว (`toAdminUserDto`) **แต่ตัวคนที่ถูกระงับไม่เคยเห็น และไม่มีทางเห็นทางอื่น**
เพราะโดน `403` ทุกเส้น เปิดกล่องแจ้งเตือนไม่ได้ ⇒ ถ้าไม่ฝากมากับ error ก็คือไม่บอกเลย

**สามทางที่เสนอ**

| | ทำอะไร | ผล |
|---|---|---|
| ก | ส่ง `suspended_reason` ดิบออกไป | ❌ **ไม่เลือก** |
| **ข** | ส่งเฉพาะ **ประเภท** ของโทษ จากชุดปิดที่เขียนถ้อยคำไว้แล้ว | ✅ **เลือก** |
| ค | ไม่บอกเลย แต่บันทึกว่าจงใจ | ❌ ไม่เลือก |

**ทำไมไม่เอา ก** — ตอนแอดมินพิมพ์ช่องนั้น เขาเขียนให้**แอดมินคนถัดไป**อ่าน ไม่ได้เขียนให้คู่กรณีอ่าน
การเปลี่ยนใจส่งออกทีหลังคือการ **เปลี่ยนความหมายของข้อมูลที่เก็บมาแล้วย้อนหลัง** — ข้อความที่เขียนไว้เมื่อวาน
โดยเข้าใจว่าเป็นบันทึกภายใน จะกลายเป็นคำประกาศถึงเจ้าตัวโดยที่คนเขียนไม่ได้ตกลง
(หลักเดียวกับที่ OD-38 ไม่ส่ง `rejection_reason` ให้ผู้แจ้ง แม้จะส่งให้แอดมิน)

**ทำไมไม่เอา ค** — คนที่ถูกระงับไม่รู้ว่าทำอะไรผิด ก็แก้พฤติกรรมไม่ได้ และอุทธรณ์ไม่ถูกจุด
การลงโทษที่ไม่บอกข้อกล่าวหาไม่ใช่การลงโทษ เป็นแค่การปิดประตู

**ที่ทำจริง (migration 034)**

```
suspended_reason   = บันทึกภายในของแอดมิน  ← ไม่ส่งออกเหมือนเดิม ไม่เปลี่ยนอะไร
suspended_category = ประเภทที่เจ้าตัวเห็น   ← ENUM 5 ค่า ถ้อยคำไทยอยู่ใน utils/suspension.ts
```

- **`403` แนบ `suspendedCategory` + `suspendedCategoryLabel`** และ **ต่อถ้อยคำเข้าไปใน `message` ด้วย**
  เพื่อให้ client ที่แสดงแค่ `message` (ซึ่งมีอยู่จริง) ได้ประโยชน์โดยไม่ต้องแก้อะไร
- **`GET /suspension-categories`** เปิดสาธารณะ ให้ FE ทำ dropdown โดยไม่ hardcode —
  ถ้อยคำนี้คือสิ่งที่ผู้ใช้จะอ่านใน `403` ตัวเลือกของแอดมินกับข้อความของผู้ใช้จึงต้องมาจากชุดเดียวกัน
- แถวเก่าทุกแถวเป็น `NULL` ⇒ `403` ตอบข้อความกลาง ๆ เหมือนเดิม **ไม่มีแถวไหนเปลี่ยนความหมาย**

**ที่ตัดสินเอง (บอกไว้):**
- **บังคับกรอกเมื่อระงับ** → `400 SUSPEND_CATEGORY_REQUIRED` · ถ้าไม่บังคับ แอดมินจะข้ามทุกครั้ง
  แล้วฟีเจอร์นี้กลายเป็นของตกแต่งที่ไม่มีผลจริง (เหตุผลเดียวกับที่ `reason` ถูกทำให้บังคับตอนแอดมินลบความเห็น)
  **นี่เป็น breaking change ของ `PATCH /admin/users/:id/suspend`** — รับได้เพราะ FE กำลังทำจอนี้อยู่รอบนี้
- **`POST /admin/user-reports/:id/approve` ก็บังคับด้วย** เพราะเป็น `performSuspend` ตัวเดียวกัน
  ⇒ endpoint นี้ **ต้องมี body แล้ว** ต่างจากที่แจ้ง FE ไว้เมื่อ 30 ก.ย. ว่ายิงเปล่าได้ · แจ้งแก้ไปแล้ว
  และ **ไม่หยิบ `report.reason` (ข้อความที่ผู้แจ้งพิมพ์) มาใช้เป็นประเภทโดยอัตโนมัติ** — คำของผู้แจ้ง
  ไม่ใช่คำวินิจฉัยของแอดมิน การให้ระบบแปลงให้เท่ากับให้ผู้แจ้งเขียนข้อกล่าวหาที่เจ้าตัวจะอ่าน
- **ENUM ในฐาน ไม่ใช่ VARCHAR** — ชุดปิดเหมือน `user_report_status` · ฐานปฏิเสธค่าที่ไม่รู้จัก
  (ยิงจริงแล้ว: `'nope'` → `ERROR 1265`) ไม่ให้ schema ชั้น API เป็นด่านเดียว
  เพิ่มประเภทใหม่ = migration ใหม่ ซึ่งถูกแล้ว เพราะต้องมาพร้อมถ้อยคำไทยที่ผู้ใช้จะอ่าน
- **`other` ไม่ว่างเปล่า** — ถ้อยคำคือ "ละเมิดกฎการใช้งานระบบ" · คนอ่านต้องรู้ว่ามีกฎข้อหนึ่งถูกละเมิด
  แม้จะไม่รู้ข้อไหน ไม่ใช่เห็นช่องว่างแล้วเดาเอง

**ยังไม่ทำ:** ไม่มีช่องทางอุทธรณ์ในระบบ · `403` บอกว่าให้ติดต่อผู้ดูแลระบบ แต่ไม่มีปุ่มให้กด
และยังไม่มีแจ้งเตือนถึงคนที่ถูกระงับ (ส่งไปก็เปิดอ่านไม่ได้ ต้องเป็นอีเมล ซึ่งผูกกับงาน password recovery ที่ยังไม่มีเจ้าภาพ)

## OD-39 — ระงับบัญชีแบบมีกำหนดเวลา — ✅ ตัดสินแล้ว 2026-10-01 (ทำ · เพดาน 90 วัน)

**ปัญหา:** `is_suspended` เป็น BOOLEAN ⇒ ทุกการระงับคือ **ถาวรจนกว่าจะมีคนจำได้ว่าต้องกลับมาปลด**
แอดมินที่ตั้งใจแบน 7 วันไม่มีที่ให้บันทึกเจตนานั้น ต้องจดใส่กระดาษแล้วกลับมากดเอง ซึ่งในทางปฏิบัติไม่มีใครทำ
⇒ โทษที่ตั้งใจให้ชั่วคราวกลายเป็นถาวรโดยไม่มีใครตั้งใจ และไม่มีใครรู้ตัวว่าเกิดขึ้น

**มติ — เพิ่มคอลัมน์เดียว `users.suspended_until DATETIME NULL` (migration 033)**

```
NULL   = ถาวร  ← พฤติกรรมเดิมทั้งหมด แถวเก่าทุกแถวไม่เปลี่ยนความหมาย ไม่ใช่ breaking change
มีเวลา = พ้นเองเมื่อถึงเวลา
```

**ทางเลือกที่พิจารณาและที่เลือก (คนตัดสิน: เจ้าของโมดูล 1 ต.ค.)**

| ประเด็น | เลือก | เหตุผล |
|---|---|---|
| API รับอะไร | `days` เป็นจำนวนเต็ม | FE ทำปุ่ม 1/7/30 วันได้ตรงๆ · ส่ง ISO datetime มาเองเปิดช่องพลาดเรื่อง timezone |
| เพดาน | **90 วัน** เกินกว่านั้นใช้ถาวร | "ระงับ 3650 วัน" คือถาวรที่แอบซ่อนอยู่ ทำให้ลิสต์ของแอดมินอ่านไม่ออกว่าใครโดนถาวรจริง |
| บอกผู้ใช้ไหม | ใส่ `suspendedUntil` ใน `403` เลย | คนโดนระงับเปิดกล่องแจ้งเตือนไม่ได้ (โดน 403 ทุกเส้น) ⇒ ถ้าไม่ฝากมากับ error ก็ไม่มีทางรู้ว่าต้องรอถึงเมื่อไร |

**หมดอายุแบบ "ประเมินตอนอ่าน" ไม่ใช่ job มาล้างธง** — ระบบนี้ไม่มี cron (หลักเดียวกับ TM-07 ที่กวาดทีมตอนอ่าน)
เช็คที่ `requireAuth` ซึ่งวิ่งทุก request อยู่แล้ว ⇒ พ้นกำหนดปุ๊บ request ถัดไปผ่านทันที ไม่ต้องรอ job รอบถัดไป

⚠️ **ผลข้างเคียงที่ต้องระวังตลอดไป** — `is_suspended` ค้างเป็น 1 ได้ทั้งที่พ้นแล้ว
การอ่าน `is_suspended = 0` ตรงๆ จึงตอบผิดตั้งแต่ migration 033 เป็นต้นไป · รวมศูนย์ไว้ที่ `utils/suspension.ts` ที่เดียว
จุดที่แก้ตามไปด้วย: `requireAuth` · `login` · `countActiveUniversityWideAdmins` · `countActiveFacultyAdmins` ·
`countUniversityAdmins` (oversight) · `searchByName` · ฟิลเตอร์ `?suspended=` ของ `GET /admin/users` · `toAdminUserDto`

**จุดที่อันตรายที่สุดคือ `LAST_UNIVERSITY_ADMIN`** — ถ้านับจากธงดิบ ระบบจะคิดว่าไม่เหลือแอดมินมหาวิทยาลัย
ทั้งที่คนนั้นพ้นโทษแล้ว แล้วล็อกทั้งระบบตามกฎ "ต้องมีอย่างน้อย 1 คน" ที่ตั้งใจให้ปกป้องระบบเอง

**ที่ตัดสินเอง (บอกไว้):**
- `POST /admin/user-reports/:id/approve` รับ `days` ด้วย เพราะการอนุมัติคำร้องคือการระงับ ใช้ `performSuspend` ตัวเดียวกัน —
  ถ้าไม่ให้ จะเกิดสภาพที่ระงับตรงๆ เลือกเวลาได้ แต่ระงับผ่านคำร้องเลือกไม่ได้ ทั้งที่เป็นการกระทำเดียวกัน
  schema เป็น `.optional()` ทั้งก้อน ⇒ client เดิมที่ยิงมาโดยไม่มี body ยังผ่านเหมือนเดิม
- ปลดระงับล้าง `suspended_until` ไปด้วย ไม่ปล่อยค้าง — ไม่งั้นโทษรอบหน้าที่ตั้งใจให้ถาวรจะสืบทอดกำหนดเก่ามาเงียบๆ
- `toAdminUserDto.isSuspended` คืนสถานะ **ที่คิดเวลาแล้ว** ไม่ใช่ธงดิบ แต่ยังคืน `suspendedUntil` ที่เป็นอดีตไว้
  เพื่อให้จอบอกได้ว่า "เพิ่งพ้นเมื่อ..." · audit log เก็บทั้ง `days` (เจตนา) และ `until` (ผลจริง) แยกกัน

**ยังไม่ทำ:** ไม่แจ้งเตือนคนที่ถูกระงับ (แจ้งเตือนในระบบส่งไปก็เปิดอ่านไม่ได้) — ยังเป็น **B5 ในหนี้ของ vimsd** เหมือนเดิม
ตอนนี้ `403` บอกแค่ *เมื่อไรพ้น* ไม่บอก *เพราะอะไร* เพราะถ้อยคำของเหตุผลต้องตัดสินก่อนว่าจะเปิดเผยแค่ไหน

## OD-38 — ผู้แจ้งใน `user_reports` ไม่ได้รับแจ้งผล — ✅ ตัดสินแล้ว 2026-09-30 (ไม่แจ้ง)

**คำถาม:** อนุมัติ/ปฏิเสธคำร้องขอระงับผู้ใช้แล้ว ควรแจ้งคนที่ยื่นไหม

**มติ: ไม่แจ้ง** — หลักที่ระบบใช้อยู่แล้วคือ **แจ้งคนที่ถูกกระทำ ไม่แจ้งคนที่ยื่นเรื่อง**

- คอมเมนต์ถูกลบ → แจ้งเจ้าของ · ทีมถูกปิด → แจ้งลูกทีม · คำตัดสินลบถูกกลับ → แจ้งผู้จัดที่ลบ
- กด report คอมเมนต์ → **ไม่มีใครได้รับแจ้ง** — ผู้แจ้งไม่มีอะไรเกิดขึ้นกับเขา เขาเป็นคนให้ข้อมูล ไม่ใช่คู่กรณี

**และการแจ้งจะขัดกับมติวันเดียวกัน** — dismiss ต้องไม่แจ้งเจ้าของคอมเมนต์ เพราะจะเป็นการเปิดเผยว่ามีคนรายงาน
แจ้งผู้แจ้งว่า "คำร้องของคุณได้รับอนุมัติ" = บอกคนนอกว่าคนนี้ถูกระงับเพราะเรื่องที่คุณยื่น
⇒ กลายเป็นข้อมูลที่เอาไปข่มกันได้ และยิงเป็นชุดเพื่อดูว่าใครโดนได้ · ตอบว่า "ปฏิเสธ" ก็บอกอีกทางว่าเป้าหมายรอด

**แต่เจอของที่ควรแก้จริงระหว่างทาง — แก้แล้ววันนี้**

- `rejection_reason` ถูกบังคับให้แอดมินพิมพ์ เก็บลงฐาน แล้ว **ไม่มี endpoint ไหนคืนออกมาเลย แม้แต่ของแอดมินเอง**
  รูปแบบเดียวกับที่ FE จับได้มาแล้วสามครั้ง (`FE-replay-link-write-only` · `FE-checkin-reject-reason-not-listed` · `FE-dispute-resolution-not-returned`)
  ⇒ เติม `reviewedBy` / `reviewedByName` / `reviewedAt` / `rejectionReason` ใน DTO ของคิวแอดมิน
  **ไม่รั่วออกนอก** — `GET /admin/user-reports` ใช้ `requireAdmin` อยู่แล้ว ผู้แจ้งไม่เห็นชุดนี้
  เหตุผล: แอดมินคนถัดไปต้องรู้ว่าเรื่องคล้ายกันเคยถูกปฏิเสธเพราะอะไร ไม่งั้นตัดสินสวนกันเอง
- `avatarUrl` ของทั้งผู้แจ้งและเป้าหมายเคย hardcode `null` — รอบไล่แก้ avatar (`49faf77`) ไปไม่ถึงไฟล์นี้
  เพราะ mapper สร้าง `UserRefDto` ด้วยมือ ไม่ได้เรียก `toUserRef`

**ที่ยังค้าง (คนละเรื่อง):** `performSuspend` ไม่แจ้ง **คนที่ถูกระงับ** เหมือนกัน
และแจ้งเตือนในระบบแก้ไม่ได้ — คนถูกระงับได้ `403 ACCOUNT_SUSPENDED` ทุกเส้น เปิดกล่องแจ้งเตือนไม่ได้
ต้องฝาก `suspended_reason` ไว้ใน payload ของ 403 หรือส่งอีเมล — เป็น **B5 ในหนี้ของ vimsd** ยังไม่ตัดสิน

## OD-37 — report export ตัดออกจากขอบเขต — ✅ ตัดสินแล้ว 2026-09-30 (ไม่ทำ)

**มติ: ไม่ทำ** · ตัดออกจาก Sprint #1 · ถ้ามีคนเจอรายการนี้ในลิสต์ `README.md` แล้วสงสัย ให้อ่านข้อนี้

### สิ่งที่เอกสารเคยเขียนไว้ — ทั้งหมดเท่านี้

- `docs/spec/README.md` ลิสต์ Sprint #1 — บรรทัดเดียวว่า `report export` **ไม่มีคำอธิบายต่อ**
- `LTMS_Database_ERD_TH.md` — ลูกศร `MySQL tournaments -. export .-> S3 "reports/"` ในไดอะแกรม
  ซึ่งไฟล์นั้น**กำกับตัวเองว่าเป็น legacy reference ไม่ใช่ source of truth**

ตรวจแล้วไม่มีที่อื่นพูดถึงเรื่องนี้เลย — `09-nonfunctional.md` ไม่มี · `08-engagement.md` ไม่มี ·
`GUIDE/` ไม่มี · **ไม่มีตารางไหนในฐานรองรับ** (ไม่มี `reports` ไม่มี `exports`)

### เหตุผลที่ตัดออก

1. **ฝั่งที่จะใช้ไม่เคยขอ** — `BACKEND-GAPS.md` ของ FE ทั้งสองฉบับ (15 ข้อ) **ไม่มีข้อนี้เลย**
   ทุกข้ออื่นที่ FE ต้องใช้จริงเขาเขียนมาครบ ข้อนี้ไม่มีแปลว่าไม่มีจอไหนวางแผนใช้
2. **ไม่มีใครขยายความมาตั้งแต่ต้น** — เขียนไว้บรรทัดเดียวและอยู่แบบนั้นมาตลอด
   คำถามพื้นฐานอย่างรูปแบบไฟล์ ใครกดได้ มีข้อมูลอะไร ไม่มีคำตอบที่ไหน
3. **ไม่มี requirement จริงให้ยึด** ⇒ ทำไปก็ต้องเดาทั้งหมด และเดาผิดคือเสียเวลาเปล่า

### ข้อที่ทำให้ตัดสินง่ายขึ้น — มันไม่ได้บล็อกอะไรเลย

ข้อมูลที่รายงานจะใช้ **ออกทาง API ครบอยู่แล้ว** ⇒ ใครอยากได้ไฟล์ก็ copy จากหน้าเว็บหรือดึง API ไปทำเองได้

- **S12** `GET /tournaments/:id/standings` — ตารางคะแนน + `isProvisional`
- **S11** `GET /tournaments/:id/dashboard` — `{ teamCount, playerCount, matchCount, matchesCompleted }`
- ผลทุกแมตช์ · รายชื่อผู้เล่นรายแมตช์ (M21)

**ที่ขาดคือการห่อเป็นไฟล์ ไม่ใช่ตัวข้อมูล**

### ★ ถ้าจะกลับมาทำ ข้อที่ต้องตัดสินก่อนคือเรื่องข้อมูลส่วนตัว ไม่ใช่รูปแบบไฟล์

```
ตารางคะแนน (ทีม แต้ม ชนะ แพ้)          → สาธารณะอยู่แล้ว ปลอดภัย
ผลทุกแมตช์ (คู่ สกอร์ เวลา สนาม)        → สาธารณะอยู่แล้ว ปลอดภัย
สถิติรายผู้เล่น (ชื่อ ทีม)               → ⚠️ ชื่อคนจริง
รายชื่อผู้เข้าแข่งทั้งหมด (ชื่อ คณะ ชั้นปี) → ⚠️⚠️ ข้อมูลส่วนตัว
```

**ไฟล์ที่ดาวน์โหลดแล้วหลุดออกนอกระบบ ต่างจาก API ที่มีด่านสิทธิ์คุมทุกครั้งที่เรียก** —
API คืนชื่อคนได้เพราะยังคุมได้ว่าใครเรียก แต่ไฟล์ที่มีชื่อ+คณะ+ชั้นปีของนักศึกษาทั้งทัวร์
ส่งต่อทางแชทได้ไม่จำกัด · **ข้อนี้ต้องเป็นมติของทีม ไม่ใช่การตัดสินใจของคนเขียนโค้ด**

เก็บไว้เป็น Sprint #2 / Future ถ้าวันหนึ่งมีคนขอจริงและบอกได้ว่าเอาไปทำอะไร

## OD-35 — `/me` ไม่บอกสิทธิ์แอดมินของตัวเอง (FE-viewer-admin-scope-unknown) — ✅ Resolved 2026-09-28

**ข้อนี้เคยถูกปิดผิด** · OD-31 บันทึกไว้ว่า "FE ปลดล็อกได้โดยไม่ต้องรู้ scope ตัวเอง" — จริงเฉพาะ
**หน้าคิวแอดมิน** ที่ได้ `canDecide` รายแถวไป · แต่เรื่องที่ FE เขียนมาคือ **ฟอร์มสร้างทัวร์** คนละจอกัน
พอ merge `backend_step9-10` เข้ามาก็ยังไม่ปิด เพราะ `adminScope` ที่เขาเพิ่มอยู่บน `AdminUserDto`
(จอที่แอดมินดู **ผู้ใช้คนอื่น**) ไม่ใช่ `toMeDto`

**ปัญหาจริง:** `autoApproveIfOwnScope` ทำให้ผลของการกด Send ต่างกันตามคนกด · ค่า default ของฟอร์มคือ
"ทุกคณะ" ซึ่งเกินขอบเขตแอดมินคณะ ⇒ แอดมินคณะที่กรอกแบบปกติจะเข้าคิวทุกครั้ง **และไม่มีทางรู้ว่า
นั่นคือกฎหรือระบบพัง** — จอเดียวที่ต้องตั้งความคาดหวังให้ผู้ใช้ กลับอ่านข้อมูลชิ้นเดียวที่ตัดสินเรื่องนี้ไม่ได้

เติม `adminScope : { id, scopeType, facultyId } | null` ลง `MeDto` · อ่านเพิ่มหนึ่งแถวจาก `admin_scopes`
ด้วยคีย์ที่ `/me` มีอยู่แล้ว ใช้ `findAdminByUserId` และ `AdminScopeRefDto` ที่มีอยู่แล้วทั้งคู่

★ **`adminScope.facultyId` ไม่ใช่ `facultyId`** — ตัวหนึ่งคือคณะที่ **ดูแล** อีกตัวคือคณะที่ **สังกัด**
เป็นคนละค่ากันได้จริง · มีเทสยืนยันว่าสองค่านี้ไม่ปนกัน เพราะเป็นกับดักที่คนอ่านโค้ดจะเผลอใช้แทนกัน
(เป็นเหตุผลเดียวกับที่ FE ระบุไว้ว่า `facultyId` ที่มีอยู่ "unrelated")

- **คนทั่วไปได้ `null` ไม่ใช่คีย์หาย** — FE จะได้ไม่ต้องแยกเคส undefined
- **การประกอบ DTO ย้ายจาก controller ไป service** — `getMe` เดิมเรียก `toMeDto` ในคอนโทรลเลอร์
  ซึ่งเป็นที่เดียวในโปรเจกต์ที่ทำแบบนั้น · ตอนนี้ต้องอ่าน DB เพิ่ม จึงย้ายให้ตรงกับที่อื่นทั้งระบบ
  `PATCH /me` (U02) คืนรูปเดียวกับ U01 จึงได้ `adminScope` ไปด้วยโดยอัตโนมัติ

## OD-34 — root ทำอะไรได้บ้าง — ✅ Resolved 2026-09-28

> เลข 33 ถูก `backend_shokun_2` ใช้ไปพร้อมกัน (กฎ double elimination 4 ทีม) จึงข้ามมาใช้ 34
> — merge เข้ามาแล้ว อยู่ถัดลงไปในไฟล์นี้

ตั้งต้นจากบันทึกของ vimsd (27 ก.ย.) ที่เสนอลำดับชั้น root / university_wide / faculty
**เห็นด้วยกับโครง ไม่เห็นด้วยกับตารางสิทธิ์** — และปรากฏว่าโค้ดที่เขาเขียนจริงก็ไม่ตรงกับตารางนั้นเหมือนกัน

### มติ: root = คนแต่งตั้ง + คนตรวจ ไม่ใช่คนปฏิบัติงาน

| root ทำได้ | root ทำไม่ได้ |
|---|---|
| แต่งตั้ง/ถอน University Admin (เท่านั้น ข้ามชั้นไปตั้ง faculty ไม่ได้) | ตัดสินข้อโต้แย้ง · วินิจฉัยเรื่องร้องเรียน |
| อ่าน scope + audit log ทั้งระบบ | ดูรายชื่อผู้ใช้ · ระงับผู้ใช้ · user report |
| **เห็นว่าอะไรค้างอยู่ (read-only · ของใหม่ในมตินี้)** | อนุมัติทีม official · กรรมการภายนอก · ลบความเห็น |

**สามเหตุผลที่ไม่ให้ root กดแทนตอนงานค้าง** (ตารางบรรทัด 261–270 ของบันทึกนั้นกา ✅ ให้ root ทุกช่อง)

1. **root คือคนอ่าน audit** — ถ้ากดด้วย คนตรวจกับคนถูกตรวจเป็นคนเดียวกัน · root ถอนไม่ได้
   (`CANNOT_REVOKE_ROOT_SCOPE`) ระงับไม่ได้ ไม่มีชั้นไหนเหนือกว่า ⇒ **ไม่มีใครในระบบตรวจ root ได้เลย**
   เป็นหลัก "คนตัดสินต้องไม่ใช่คู่กรณี" ที่ใช้ทั้งโมดูล เอามาใช้กับชั้นกำกับดูแล
2. **root มีคนเดียว** — ย้าย backstop ไปที่ root = ย้ายจาก "อย่างน้อย 1 คน เพิ่มได้" (`LAST_UNIVERSITY_ADMIN`)
   ไปเป็น "1 คนตายตัว เพิ่มไม่ได้" · single point of failure แย่ลง ไม่ได้ดีขึ้น
3. **break-glass ที่ใช้ทุกวันไม่ใช่ break-glass** — วันหนึ่งจะกลายเป็นบัญชีทำงานประจำที่ถอนไม่ได้
   และตรวจไม่ได้ โดยไม่มีใครตัดสินใจให้เป็นอย่างนั้น มันแค่ค่อย ๆ กลายเอง

**"การนิ่งเฉยต้องไม่มีอำนาจยับยั้ง" ยังอยู่ แต่แก้ด้วยโครงสร้างไม่ใช่ตัวบุคคล**
univ admin เงียบ/หาย → root **แต่งตั้งคนใหม่** → คนใหม่กด มีชื่อ มีขอบเขต ถอนได้ ตรวจได้
`LAST_UNIVERSITY_ADMIN` ไม่ยกเว้น root ⇒ **ลำดับที่ถูกคือตั้งคนใหม่ก่อน แล้วค่อยถอนคนเดิม**
(ถ้ารอบหน้ามีคนเจอแล้วคิดว่าเป็นบั๊ก — ไม่ใช่บั๊ก นี่คือทางที่ตั้งใจ)

### สองจุดที่บันทึกของ vimsd ขัดกันเอง — ยึดตามโค้ด ไม่ใช่ตาราง

- บรรทัด 70/81 บอก root เป็น break-glass ไม่ทำงานประจำวัน · ตารางให้ root ทั้ง manage/suspend users
  และ approval — **โค้ดจริงเลือกข้าง break-glass แล้ว** (`assertNotRoot` → `ROOT_NO_DAILY_OPERATIONS`)
- บรรทัด 29 บอก "แต่งตั้งได้เฉพาะระดับที่ต่ำกว่าตัวเอง" · ตารางให้ root ตั้ง faculty admin ซึ่งข้ามชั้น
  — **`assertCanGrant` เลือกข้าง strict hierarchy แล้ว** (root → university_wide เท่านั้น)

ถือว่าตารางนั้นเผลอกา ✅ ให้ root ทุกช่องเพราะ "เป็นคนสูงสุด" ซึ่งเป็นตรรกะ rank ล้วน
ที่ตัวบันทึกเองเตือนไว้บรรทัด 221–227 ว่าอย่าใช้ (ต้องตรวจ authority + scope คู่กัน)

### ของใหม่ 1 — `GET /admin/oversight/stalled` (root + university_wide)

**ช่องที่ต้องปิด:** root อ่าน `audit_logs` ได้ แต่ audit log บอกว่า *เกิดอะไรขึ้นแล้ว* ไม่ได้บอกว่า
*อะไรยังไม่เกิด* — และเรื่องที่ค้างคือเรื่องที่ **ไม่มี** log · คิวข้อโต้แย้ง/เรื่องร้องเรียนถูก
`requireAdmin_U` ปิด คิว user report ถูก `ROOT_NO_DAILY_OPERATIONS` ปิด
⇒ เราออกแบบให้ root ทุบกระจกฉุกเฉิน แต่ไม่ให้เห็นกระจก

คืน **ตัวเลขกับ id เท่านั้น** ไม่มีเหตุผล ไม่มีหลักฐาน ไม่มีชื่อคู่กรณี (มีเทสยืนยัน) —
ถ้าอยากอ่านเนื้อหาแปลว่ากำลังจะเข้าไปตัดสินเอง ซึ่งผิดมติ · **รายชื่อผู้ใช้ยังปิดต่อไป**
root ไม่มีเหตุผลต้องเปิดดูข้อมูลส่วนตัวนักศึกษา และเป็นข้อมูลที่รั่วแล้วรั่วเลย

★ `universityAdmins.active` คือตัวเลขที่สำคัญที่สุด — `LAST_UNIVERSITY_ADMIN` รับประกันว่า **มี**
แอดมินเหลือ แต่ไม่ได้รับประกันว่าคนนั้น **ใช้งานได้** · `active = 0` ทั้งที่มีของค้าง = ระบบตัน
→ ธง `needsAttention` บอกตรง ๆ ไม่ให้ root ต้องเดาเอง

**`requireAdminOversight` เป็น middleware ตัวใหม่ ไม่ใช่การแก้ `requireAdmin_U`** — ตัวนั้นเป็นด่าน
**"กดได้"** ของ 4 route file ถ้าเติม root เข้าไปเพื่อให้ "เห็น" root จะได้อำนาจ **กด** มาด้วยทั้งชุด
มีเทส regression ล็อกไว้ว่าสองด่านนี้ต้องตอบ root ต่างกัน

### ของใหม่ 2 — migration 030 บังคับ root คนเดียวที่ระดับฐาน

migration 025 เขียนคอมเมนต์ว่า "Root มีได้คนเดียว" แต่ไม่มี constraint บังคับ · กันแค่ทาง API
(`grantScopeSchema` รับแค่ `'faculty'`/`'university_wide'`) ⇒ seed หรือ SQL ตรงใส่คนที่สองได้
และถ้าเกิดขึ้น **ถอนทั้งคู่ไม่ได้เลย** เพราะ `CANNOT_REVOKE_ROOT_SCOPE` ตอบ root ทุกคน
— กู้คืนได้ทางเดียวคือแก้ฐานตรง จึงคุ้มที่จะกันไว้

MySQL ไม่มี partial unique index → generated column ที่เป็น 1 เฉพาะ root และ NULL สำหรับแถวอื่น
(UNIQUE ยอมให้ NULL ซ้ำได้ไม่จำกัด) ⇒ faculty/university_wide หลายแถวไม่ถูกแตะเลย

### ตัดสินว่า "ไม่ทำ"

- **quota ที่ configurable ตอน runtime** (`admin_scope_limits` ตามที่เสนอ) — ถ้า root แก้ limit ของ
  university_wide ได้ **root ก็ขยายอำนาจตัวเองได้โดยอ้อม** (ตั้งคนที่ภักดี 10 คน) · ถ้าจะมีเพดาน
  ควรเป็นค่าคงที่ในโค้ดที่เปลี่ยนต้องผ่าน code review ไม่ใช่ปุ่มใน API · ตอนนี้ยังไม่มี requirement จริง
- **เปลี่ยนชื่อ `root`** — ชื่อนี้ยืมความหมาย "ทำได้ทุกอย่าง" มาจาก Unix ซึ่งไม่ตรงกับพฤติกรรม
  (คนที่ "ดูแลระบบ" จริงคือคนถือ credential ฐานข้อมูล ซึ่งอยู่นอกระบบ permission และเป็นคนสร้าง root เอง)
  ชื่ออย่าง `registrar` ตรงกว่า แต่แตะ migration 025 + ทุกจุดที่เทียบ `scope_type === 'root'`
  **ไม่คุ้มกับเวลาที่เหลือ** — future rename
- **Department Admin** — vimsd เสนอไว้เป็น future extension เห็นด้วย ยังไม่มี requirement

**ข้อเสียที่ยอมรับเอง:** งานซ่อมหนัก (แก้ผลแมตช์ที่เสีย · schema เพี้ยน) ไปอยู่ที่ฐานข้อมูล
ซึ่ง **ไม่มี audit ในแอป** · ยอมได้เพราะในโปรเจกต์ขนาดนี้คนถือ DB กับคนถือบัญชี root เป็นคนเดียวกัน
การเพิ่มปุ่มไม่ได้ลดโอกาสเขาไปแก้ DB ตรง แค่เพิ่มทางที่สะดวกกว่า · **ถ้าวันหนึ่งแยกคนสองคนได้จริง
ให้กลับมาทบทวน** — นั่นคือเหตุผลเดียวที่ควรเปลี่ยนเป็นทางเลือก ข (root กดแทนได้ แต่บังคับกรอกเหตุผล
+ log แยก action `root_override`)

**เก็บระหว่างทาง:** `backend_step9-10` เข้ามาพร้อมไฟล์ใหม่ 9 ไฟล์ +1098 บรรทัด **โดยไม่มีเทสเลย**
(จำนวนเทสก่อน/หลัง merge เท่ากันเป๊ะที่ 2159) รวมถึง `requireAdmin.ts` และ `adminScope.service.ts`
ที่เป็นชั้นสิทธิ์ล้วน ๆ · มตินี้เขียนเทสคลุมเฉพาะส่วนที่ตัวเองแตะ ที่เหลือยังเป็นหนี้ของเจ้าของ

## OD-33 — double elimination ต้องมี 4 ทีมก่อนจับสาย (จาก BACKEND-GAPS ของ FE) — ✅ Resolved 2026-09-27

FE-double-elimination-four-team-minimum · **ไม่มี migration**

`createBracket` เช็คจำนวนทีมแค่ `< 2` กับ `< min_teams` โดย**ไม่ดู `bracket_format` เลย** · ทัวร์ `double_elimination`
ที่ตั้ง `minTeams: 2` จึงจับสาย 2 ทีมได้ ทั้งที่รูปแบบนี้ต้องมี 4 ทีมเป็นอย่างน้อย — 2 ทีมแปลว่าสายแพ้ไม่มีใครมาเจอกัน
รูปแบบจึงไม่ได้เกิดขึ้นจริง ได้แต่สายบนที่หน้าตาเหมือน single elimination
FE ปิดปุ่ม Draw ไว้แล้วเมื่อทีมไม่ถึง 4 และซ่อนสายที่ผิดรูปแบบ แต่ **client ที่ยิง API ตรงยังทำได้** — ด่านจริงต้องอยู่ที่ service

| # | เรื่อง | มติ |
|---|---|---|
| 1 | กฎ | ทีม approved ต้องถึง `max(4, min_teams)` เมื่อ `bracket_format = 'double_elimination'` · `max(2, min_teams)` รูปแบบอื่นและกรณียังไม่ตั้งรูปแบบ (พฤติกรรมเดิม) |
| 2 | ทำไมเป็น `max` ไม่ใช่ 4 ตายตัว | ผู้จัดที่ตั้ง `minTeams: 6` ประกาศเงื่อนไขของตัวเองไว้สูงกว่าขั้นต่ำของรูปแบบ ถ้าใช้ 4 ตายตัวจะกลายเป็นระบบอนุญาตให้จับสายต่ำกว่าที่ผู้จัดประกาศไว้เอง |
| 3 | ใช้กับทางไหน | ทั้ง `seedingMethod: 'random'` และ `'manual'` และ **`replace: true`** — ทางที่คนใช้จริงตอนมีทีมถอนตัวคือ replace ถ้าเว้นไว้ก็เท่ากับไม่ได้ปิดช่อง |
| 4 | error | ใช้ code เดิม **`TEAM_COUNT_MISMATCH`** (422) ไม่ตั้งใหม่ — สาเหตุเดียวกันคือจำนวนทีมไม่พอสำหรับรูปแบบที่เลือก และ FE มี renderer อยู่แล้ว · แนบ `extra {bracketFormat, required, approved}` เพื่อให้ FE บอกได้ว่า**ขาดอีกกี่ทีม** ไม่ใช่ข้อความลอย ๆ |
| 5 | เคสเดิมด้วย | เคส `< 2` และ `< min_teams` แนบ `extra` ชุดเดียวกัน — ไม่อยากมี error รูปร่างสองแบบใต้ code เดียว |
| 6 | ข้อความ | `double_elimination` บอกเหตุเฉพาะ ("ต้องมีทีมที่อนุมัติแล้วอย่างน้อย N ทีม") · รูปแบบอื่นคงข้อความเดิมไว้ กันการเปลี่ยนสิ่งที่ FE อาจอ่านอยู่โดยไม่จำเป็น |
| 7 | ★ สายเดิมที่ผิดรูปแบบ | **ไม่ลบ ไม่แก้** — ทัวร์ที่จับสาย 2 ทีมไปก่อนกฎนี้มีผลต้องอยู่เฉย ๆ · เส้นทางกู้คืนที่มีอยู่แล้วเพียงพอ: มีทีม approved ครบ 4 แล้วยิง `replace: true` ตามปกติ |
| 8 | ตำแหน่งของด่าน | ด่านอยู่**ก่อน** `pool.getConnection()` / `clearBracketTx` — ปฏิเสธการ redraw แล้วสายเดิมยังอยู่ครบโดยไม่ต้องพึ่ง rollback · เทส `bracket.minTeams.test.ts` ล็อกลำดับนี้ไว้ (assert ว่า `clearBracketTx` และ `beginTransaction` ไม่ถูกเรียก) |

- ขั้นต่ำเป็นเรื่องของ**รูปแบบ** ไม่ใช่ของ `min_teams` จึงแยกเป็น `minTeamsToDraw()` (pure · export ไว้ให้เทสและที่อื่นเรียกได้) ไม่ฝังตัวเลขไว้ในเงื่อนไข `if`
- `round_robin` กับ `single_elimination` ยังจับสาย 2 ทีมได้เหมือนเดิม — 2 ทีมของสองรูปแบบนั้นคือนัดเดียวจบซึ่งสมเหตุสมผล มีเทสคุมไว้กันแก้กว้างเกิน
- ไม่ได้แตะ `BRACKET_FORMAT_NOT_SET` (422 ตอน `bracket_format` เป็น NULL) — ด่านนั้นอยู่หลังด่านจำนวนทีม ลำดับเดิมจึงไม่เปลี่ยน

## OD-32 — สองข้อของโมดูลกรรมการจาก BACKEND-GAPS — ✅ Resolved 2026-09-27

### กรรมการคนที่สองรับแมตช์ไม่ได้ (FE-second-referee-request-cancelled · ทางเลือก ก)

`apply()` ปิดคำขอ open **ทุกชนิด** ที่อ้างแมตช์เดียวกัน · เหตุผลที่คอมเมนต์เขียนไว้คือ "ข้อมูลเก่าแล้ว"
ซึ่งหมายถึงสมมติฐาน "กรรมการ X ถือแมตช์ M อยู่" กลายเป็นเท็จ — **จริงกับ 3 ชนิดที่ย้ายคน แต่ไม่จริงกับ
`org_add_match`** ที่แค่ INSERT แถวของกรรมการคนเดียวผ่าน `insertAccepted` ไม่แตะใครเลย
การเพิ่มคน B เข้าแมตช์ M จึงไม่ทำให้การเพิ่มคน C เข้าแมตช์ M เป็นโมฆะ สองเรื่องเป็นอิสระต่อกัน

**ผลของบั๊กเดิมคือทางตัน ไม่ใช่ความน่ารำคาญ:** BR-10 บังคับกรรมการ accepted 2 คนสำหรับแมตช์ onsite
ที่เก็บสถิติ · ORG เชิญสองคนพร้อมกัน (ซึ่ง UI ชวนให้ทำ) → คนแรกกดรับ → ใบของคนที่สองกลายเป็น `cancelled`
→ คนที่สองกดรับแล้วไม่มีอะไรเกิดขึ้น (`answer` ต้องการ `request_status = 'open'`) → `startMatch` ตอบ
`INSUFFICIENT_REFEREES` ตลอดกาล · และ **F11 ที่เคยให้ ORG ใส่กรรมการเข้าแมตช์ตรง ๆ ถูกถอดไปแล้ว FR02 คือทางเดียว**
⇒ แมตช์นั้นแข่งไม่ได้เลย · ทางอ้อมที่มีแต่ไม่มีใครรู้: เชิญทีละคน รอรับแล้วค่อยเชิญคนถัดไป

แก้: `AND request_type IN ('ref_transfer','ref_swap','org_swap')` · ใบซ้ำของกรรมการคนเดิมบนแมตช์เดิม
ไม่ต้องพึ่งการยกเลิกนี้อยู่แล้ว เพราะ `insertAccepted` คืน false เมื่อแถวนั้น accepted แล้ว → `apply()` คืน false
→ service เป็นฝ่าย cancel เอง

### กรรมการอ่านทัวร์ที่ถูกเชิญไม่ได้ (FE-referee-cannot-read-invited-tournament · ทางเลือก ก)

`getVisibleTournament` มีผู้อ่าน 3 กลุ่ม (สาธารณะ/completed · ผู้ยื่นคำขอ · แอดมินในขอบเขต) ไม่มีกรรมการ
แต่**ลำดับที่ตัวสินค้ากำหนดเองคือ approve → แต่งตั้งกรรมการ → publish** คำเชิญจึงมาถึงตอนทัวร์ยัง `private`
เกือบทุกครั้ง · แจ้งเตือน C1 "คุณได้รับเชิญเป็นกรรมการ" ลิงก์ไปหน้านั้นตรง ๆ แล้วได้ 404 —
จอบอกว่า "ไม่มีทัวร์นี้" ทั้งที่จดหมายในมือเพิ่งเอ่ยชื่อทัวร์นั้น และกรรมการต้องตัดสินใจรับ/ไม่รับ
โดยไม่เห็นว่าจะไปตัดสินอะไร ไม่รู้กีฬา วันแข่ง หรือสนาม

เงื่อนไข: มีแถวใน `tournament_referees` และ `removed_at IS NULL` → อ่านได้ทุกสถานะทัวร์ยกเว้น `auto_deleted`
· **ไม่กรอง `invitation_status`** เพราะคนที่ยัง `pending` คือคนที่ต้องเห็นที่สุด
· เดิมใช้ `findLatestByTournamentAndUser` (แถวล่าสุด) เพราะคนหนึ่งอาจถูกเชิญ–ถอด–เชิญใหม่
  (ฐาน dev มีคู่ tournament+user ที่มีถึง 5 แถว)
  → **แก้ 1 ต.ค. เป็น `findActiveByTournamentAndUser`** เพราะ "แถวล่าสุด" ตอบผิดเมื่อแถวล่าสุด
  ถูกถอด/ถูกประเฟทแต่แถวเก่ายังใช้งานได้ (F-15) · **ลบตัวเก่าออกจาก repo แล้ว 4 ต.ค.** ถ้าหาไม่เจอคือเพราะอย่างนั้น
· วางเป็นด่านสุดท้ายเพราะเป็นคิวรีเพิ่ม และเส้นที่พบบ่อยกว่าจบไปก่อนแล้ว (มีเทสยืนยันว่าทัวร์ public
  ผู้ยื่นคำขอ และ `auto_deleted` ไม่เสียคิวรีนี้เลย)

★ **ตัวนี้กั้น 2 เส้น** ไม่ใช่เส้นเดียว: `GET /tournaments/:id` (C07) และ `GET /tournaments/:id/eligibility-rules`
(C17) · เปิดทั้งคู่โดยเจตนา — กฎว่าใครลงแข่งได้เป็นข้อมูลที่กรรมการควรรู้ก่อนรับงาน

**เก็บระหว่างทาง:** การเพิ่มคิวรีนี้ทำให้ `tournament.eligibility.test.ts` ไปแตะฐานข้อมูลจริงเงียบ ๆ
(ไม่ได้ mock repo ตัวใหม่) เทสผ่านเพราะเครื่องมี MySQL รันอยู่ — เติม mock แล้ว และพิสูจน์ด้วยการ
**ปิด MySQL แล้วรันทั้งชุด 109 ไฟล์ / 2159 เทสผ่านหมด** ยืนยันว่าไม่มีเทสไหนพึ่งฐานจริง

## OD-31 — อำนาจของแอดมินคณะไม่ตรงกับคิวและไม่สมมาตร (จาก BACKEND-GAPS ของ FE) — ✅ Resolved 2026-09-27

สองข้อนี้มาจากกฎเดียวกัน (OD-15 Q2-ข: แอดมินคณะตัดสินได้เฉพาะทัวร์ที่กฎคณะชี้มาคณะตัวเองเท่านั้น)
**กฎไม่ผิด** ที่ผิดคือรอบ ๆ กฎ — คิวไม่สะท้อนกฎ และด่านใส่ไว้ข้างเดียว

### ปฏิเสธได้ทั้งที่อนุมัติไม่ได้ (FE-reject-skips-eligibility-scope · ทางเลือก ก)

`approveTournament` เช็ค `adminCoversEligibility` · `rejectTournament` ไม่เช็ค → แอดมินคณะ "ปฏิเสธ" คำขอที่ตัวเอง
"อนุมัติ" ไม่ได้ (403) คือคำขอที่ระบบตั้งใจส่งให้แอดมินมหาวิทยาลัย · FE ยิงจริงบนทัวร์เดียวกันได้
`approve → 403` แต่ `reject → 200`

ที่ทำให้ต้องแก้ไม่ใช่ความไม่สมมาตรเปล่า ๆ แต่เพราะ **`rejected` เป็นปลายทางถาวร** — ไล่ทุก route แล้ว
ไม่มีตัวไหนตั้งสถานะกลับเป็น `pending_approval` ได้ (`deleteTournament` รับ `rejected` ได้แต่คือลบทิ้ง ไม่ได้พากลับคิว)
ทางออกเดียวของผู้จัดคือลบทิ้งแล้วกรอกฟอร์มใหม่ทั้งใบ พร้อมได้แจ้งเตือน "คำขอไม่ได้รับการอนุมัติ"
จากแอดมินที่ไม่มีสิทธิ์อนุมัติ · หลักที่ยึดตลอด OD-26 คือ **"การนิ่งเฉยต้องไม่มีอำนาจยับยั้ง"** —
ข้อนี้คืออีกด้านของเหรียญเดียวกัน: **คนที่ไม่มีอำนาจพูดว่า "ใช่" ต้องไม่มีอำนาจพูดว่า "ไม่" ที่ย้อนไม่ได้**

ปฏิเสธข้อเสนอ "ปล่อยไว้เพราะปฏิเสธ = ส่งกลับไปแก้" เพราะถ้าเชื่อแบบนั้นต้องทำทางกลับจาก `rejected` ให้จริงก่อน
ไม่งั้นข้ออ้างไม่ตรงกับพฤติกรรม · และปฏิเสธ "ถอดด่านออกจาก approve แทน" เพราะขัด OD-15 Q2-ข ที่เคาะแล้ว

พบระหว่างทาง: **ไม่มีเทส `rejectTournament` เลยมาก่อน** จึงไม่มีอะไรจับความไม่สมมาตรนี้ได้ — เพิ่มแล้ว
รวมเทสที่ยืนยันว่าแถวเดียวกันถูกปฏิเสธทั้งสองทางสำหรับแอดมินคนเดียวกัน

### คิวโชว์แถวที่กดไม่ได้ทุกแถว (FE-admin-queue-shows-undecidable-rows · ทางเลือก ข)

คิวกรองด้วย `organizing_faculty_id = ?` เงื่อนไขเดียว · ด่านอนุมัติเช็คเพิ่มว่าต้องมีกฎคณะ**อย่างน้อย 1 ข้อ**
และ**ทุกข้อชี้มาคณะตัวเอง** → คิวเป็น superset ของด่านโดยโครงสร้าง
★ และค่า default ของฟอร์มฝั่ง FE คือ "ทุกคณะ" = ไม่ใส่กฎคณะเลย ⇒ **คำขอที่กรอกตามปกติที่สุดจะเข้าคิวของ
แอดมินคณะแล้วกดไม่ได้** · FE ยิงจริง: 3 แถว pending ทั้งหมดจัดโดยคณะ 1 ทั้งหมดไม่มีกฎ → 403 ทั้ง 3 แถว

**เลือก "คืนแถวพร้อมเหตุผล" ไม่ใช่ "กรองออก"** — ถ้ากรองออก แอดมินคณะจะไม่รู้เลยว่าคณะตัวเองมีคำขอค้างอยู่
และไปตามแอดมินมหาวิทยาลัยก็ไม่ได้ · หลักเดียวกับทั้ง OD-26/28: ซ่อนแถวทำให้ปัญหามองไม่เห็น
โชว์พร้อมเหตุผลทำให้มีคนรับผิดชอบ · FE เสนอทางนี้มาเองด้วย

รายละเอียดที่ไม่ชัดจนลงมือ:
- `AdminTournamentRequestRow` **ไม่มี `organizing_faculty_id`** คิด `canDecide` ด้วยข้อมูลเดิมไม่ได้เลย — เติมทั้ง Pick และ SELECT
- `findEligibilityRules` เป็นรายทัวร์ เรียกต่อแถวคือ N+1 ทันที → เพิ่ม `findEligibilityRulesOfMany(ids[])` คิวรีเดียว
  ★ ทัวร์ที่ไม่มีกฎต้องได้ `[]` ไม่ใช่ `undefined` เพราะ "ไม่มีกฎ" = เปิดทุกคณะ ซึ่งเป็นเคสที่พบมากที่สุด
- `university_wide` short-circuit ไม่ยิงหากฎเลย (ได้ `canDecide: true` เสมอ) — และเป็นคนที่คิวยาวที่สุด
- `cannotDecideReason` ใช้ code เดียวกับที่ด่านโยน (`ELIGIBILITY_OUT_OF_SCOPE`) FE จึงใช้ข้อความเดิมที่ render อยู่แล้ว
- ผลพลอยได้: FE ปลดล็อกหน้านี้ได้**โดยไม่ต้องรอ merge `backend_step9-10`** เพราะไม่ต้องรู้ scope ตัวเองอีก (ข้อ FE-viewer-admin-scope-unknown)

พบระหว่างทาง: **ไม่มีเทส `getPendingTournamentRequests` ระดับ service เลยมาก่อน** เพิ่มไฟล์ใหม่คุมทั้ง canDecide,
short-circuit และการันตีว่าเรียกคิวรีกฎครั้งเดียวต่อหน้า

**ยืนยันกับฐานจริงแล้ว:** ทัวร์ pending 2 ใบของคณะเดียวกัน ใบที่ไม่มีกฎคณะ → แอดมินคณะเห็น `canDecide: false`
+ `ELIGIBILITY_OUT_OF_SCOPE` และทั้ง approve/reject ตอบ 403 เหมือนกัน · ใบที่มีกฎคณะตรง → `canDecide: true`
· แอดมินมหาวิทยาลัยเห็นทั้งสองใบเป็น `true`

## OD-30 — กวาดทั้งระบบหาคอลัมน์ที่เขียนแล้วไม่มีใครอ่านกลับ — ✅ Resolved 2026-09-27

เจอรูปแบบนี้มา 3 รอบ (`removed_by` · `is_reported` · 3 ฟิลด์ใน OD-29) จึงกวาดทั้ง 41 ตาราง / 394 คอลัมน์
เทียบ "เขียนลงฐาน" กับ "ไปถึง mapper/service/controller" · ตัวสคริปต์เก็บไว้ที่ scratchpad ไม่ commit

**บทเรียนเรื่องวิธีตรวจ:** รอบแรกเขียนเงื่อนไข "ถูกอ่าน" กว้างเกินไป (นับการปรากฏใน `types/db.ts` ด้วย)
ผลคือ **มันจะไม่เจอ `livestream_url` ซึ่งเป็นตัวที่เพิ่งแก้ไปเอง** — ต้องนับเฉพาะการอ่านใน mappers/services/controllers
ซึ่งเป็นจุดที่ค่าจะกลายเป็น response จริง

### เจอของจริง 2 เรื่อง

- **`announcements.announcement_type`** — หนักกว่า "เขียนแล้วไม่มีใครอ่าน" คือ **ไม่ได้ทำอะไรเลย**: คอลัมน์มี 5 ค่าและ
  NOT NULL มาตั้งแต่ schema แรก แต่ `createAnnouncementSchema` ไม่มีฟิลด์นี้ · INSERT ฮาร์ดโค้ด `'general'` ทุกครั้ง ·
  `toAnnouncementDto` ไม่คืนออกมา → ผู้จัดเลือกชนิดไม่ได้ และ FE ติดป้าย "เปลี่ยนเวลา"/"เปลี่ยนสนาม"/"ผลการแข่งขัน" ไม่ได้
  แก้ครบเส้น (schema → controller → service → repo → mapper) และแก้ผ่าน E10 ได้ด้วย · ไม่ส่ง `type` = `general` เหมือนเดิม ของเก่าไม่พัง
- **`team_admin_requests.supporting_docs`** — คิวของแอดมินไม่เคย SELECT มา แอดมินจึงอนุมัติ/ปฏิเสธ "ทีม Official"
  โดยไม่มีทางเห็นเอกสารที่เป็นเหตุผลทั้งหมดของคำขอ (และเป็นเอกสารที่ระบบบังคับให้ยื่น) · คืนเป็น presigned URL เสมอ
  ★ **แต่ของจริงหนักกว่านั้น — เป็น schema drift:** คอลัมน์อยู่ใน `schema.sql` แต่**ไม่มี migration ไหนเพิ่มให้**
  ฐานที่เดินด้วย `npm run migrate` จึงไม่มีคอลัมน์นี้ และ `createOfficialRequest` ที่ INSERT ลงไปตรง ๆ **ล้มทั้งฟีเจอร์**
  ด้วย ER_BAD_FIELD_ERROR (ยืนยันกับฐาน dev แล้ว) → เพิ่ม **migration 029** · ฐานที่สร้างจาก schema.sql ข้ามเอง
  เพราะ schema.sql ลงชื่อ migration ทั้งหมดไว้ที่ท้ายไฟล์

### ที่เหลือไม่ใช่ปัญหา (บันทึกไว้ไม่ให้ไล่ซ้ำ)

- `audit_logs.*` — ยังไม่มีใครอ่านโดยเจตนา · endpoint `/admin/audit-logs` อยู่บน `backend_step9-10`
- `rewards` · `user_rewards` · `point_transactions` · `tournament_questions` · `password_reset_tokens` — **ฟีเจอร์ที่ยังไม่ได้ทำ** ไม่มี spec
- `tournament_feedback.match_key` — generated column มีไว้ให้ UNIQUE ใช้ ไม่ต้องอ่าน
- `bracket_nodes.node_code` — ป้ายภายใน · DTO มี `round` + `matchNumber` + `nodeId` พอวาดสายแล้ว
- `teams.last_competed_at` — input ของ sweep TM-07 ไม่ใช่ข้อมูลที่ใครต้องอ่าน
- `player_match_stat_values.value_int` — false positive ของสคริปต์ (คิวรี alias เป็น `value`)
- `tournaments.organizer_external_*` (5 คอลัมน์) — SELECT มาแต่ไม่มีใครเขียนและไม่มีใครอ่าน **ฟีเจอร์ที่ออกแบบไว้แล้วไม่ได้ทำ** — ควรตัดสินว่าจะทำหรือลบทิ้ง
- `users.suspended_reason` — ผู้ใช้ที่ถูกระงับได้ข้อความกลาง ๆ ไม่มีเหตุผล · แต่ปุ่มระงับอยู่บน `backend_step9-10` ให้ไปพร้อมกัน
- `teams.deleted_reason` — เขียน `'leader_deleted'` / `'inactive_6_months'` แต่ไม่มีใครอ่าน · ทีมที่ถูกลบอัตโนมัติเพราะไม่ใช้งาน หัวหน้าทีมจึงไม่เคยรู้เหตุผล — เป็นงานของ TM-07 บน `backend_step9-10`

## OD-29 — สามฟิลด์ที่เขียนลงฐานแล้วไม่มีใครอ่านกลับ (จาก BACKEND-GAPS ของ FE) — ✅ Resolved 2026-09-27

รูปแบบเดียวกันทั้งสามข้อ: คอลัมน์มีอยู่ · route เขียนค่าลงไปจริง · แต่ read route ไม่เคยคืนออกมา
ฟีเจอร์จึงดูเหมือนพังจากข้างนอกทั้งที่ข้อมูลนั่งอยู่ในฐาน · เป็นรูปแบบที่เจอมาแล้วสองรอบก่อนหน้า
(`removed_by` และ `is_reported` ของ C6/C7) — คุ้มที่จะกวาดทั้งระบบหาแบบเดียวกันอีก

- **`livestreamUrl` บน M04 + M05** — FE เขียนว่า *"One line in `toMatchDetailDto`"* แต่**ไม่ใช่**: คอลัมน์ไม่เคยถูก SELECT
  มาด้วย ต้องแก้ 3 จุดต่อ endpoint (row type · SELECT · mapper) = 6 จุด · **สาธารณะโดยเจตนา** ไม่ผูกกับ `canSeeRoomCode`
  ที่อยู่บรรทัดข้าง ๆ — ลิงก์ถ่ายทอด/รีเพลย์มีไว้ให้คนดู ต่างจากรหัสห้องที่เปิดให้เฉพาะคนในแมตช์ (มีเทสล็อกข้อนี้ไว้)
- **`rejectionReason` บน M13** — คนละคอลัมน์กับ `note` (migration 015): `note` = เหตุผลที่กรรมการอนุโลมให้ผ่าน ·
  `rejection_reason` = เหตุผลที่ปฏิเสธ/ถอน · M15 บังคับให้กรอกและ M20 คืนให้เจ้าตัวอยู่แล้ว แต่ M13 ไม่เคยคืน
  กรรมการจึงไม่เห็นเหตุผลของแถวไหนเลย **รวมถึงเหตุผลที่ตัวเองเพิ่งพิมพ์** · ปลอดภัยเพราะ M13 เปิดให้เฉพาะ ORG/กรรมการของแมตช์อยู่แล้ว
- **6 ฟิลด์ข้อโต้แย้งบน S05** — ★ **ส่งแบบมีเงื่อนไข ไม่ใช่ตามที่ FE ขอตรง ๆ**
  - FE ขอให้ใส่ลง S05 เฉย ๆ แต่ **S05 เป็น endpoint สาธารณะ** เมื่อผลเป็น `verified`/`walkover` ขณะที่
    `GET /matches/:id/result/dispute` (S03b) กันข้อมูล**ชุดเดียวกัน**ไว้ที่ ORG / กรรมการของแมตช์ / หัวหน้า 2 ทีม
  - ใส่แบบไม่มีเงื่อนไข = ปิดประตูหน้าเปิดหลังบ้าน · `disputeReason` เป็นข้อความที่คู่กรณีเขียน อาจระบุชื่อและกล่าวหาผู้เล่นตรง ๆ
    และ `disputeRaisedBy` บอกว่าหัวหน้าทีมคนไหนเป็นคนค้าน — **รูปแบบเดียวกับรูรั่วจำนวนโหวต MVP ที่แก้ไปวันเดียวกัน**
  - เหตุผลที่ FE เขียนมาเองก็ไม่ได้ขอให้เป็นสาธารณะ: *"both squads learn why a result was upheld"* — squads ไม่ใช่ทุกคน
  - ใช้ `canSeeUnfinishedResult` ที่มีอยู่แล้ว ไม่ต้องเขียน guard ใหม่ · ผลที่ยังไม่ final ผ่านด่านนั้นมาแล้ว จึงไม่ถามซ้ำ
  - **คนที่ไม่มีสิทธิ์ไม่มีคีย์เหล่านี้เลย ไม่ใช่ได้ `null`** — `null` แปลว่า "ไม่มีข้อโต้แย้ง" ซึ่งเป็นคนละความหมาย
  - ค่าเริ่มต้นของพารามิเตอร์คือ **ไม่ส่ง** เพื่อให้การลืมส่งกลายเป็นการปิด ไม่ใช่การเปิดเผย (มีเทสล็อกข้อนี้)

**เก็บระหว่างทาง:** test factory ของ mapper หลายตัวขาดคอลัมน์ที่เพิ่มในงานก่อน ๆ (`started_at`, `actual_end_time`,
`submitted_at`, `dispute_claimed_*`) จน `tsc` ฟ้องอยู่ก่อนแล้ว — เติมให้ครบเฉพาะตัวที่งานนี้แตะ · เหลือ `makeLineupRow`
(ขาด `application_status`) ยังฟ้องอยู่ เป็นของงานอื่น

## OD-28 — ใครเปิด/ปิดเช็คอินได้ (จาก BACKEND-GAPS ของ FE) — ✅ Resolved 2026-09-27

FE รายงานว่า `POST /matches/:id/open-checkin` เป็น ORG เท่านั้น ทั้งที่คนที่ยืนอยู่หน้าโต๊ะคือกรรมการ

**ปัญหาจริงกว่าที่รายงาน:** `checkin_open` เป็น**ทางออกทางเดียว**ของ `scheduled` ทั้งวงจรแมตช์จึงเริ่มที่ปุ่มนี้เท่านั้น
และกรรมการคุมทุกอย่างที่เกิดขึ้น "ข้างใน" หน้าต่างนี้อยู่แล้ว (เช็คอินด้วยมือ · อนุมัติ · ปฏิเสธ · กดเริ่มแข่ง · กดจบ · ยกเลิกแมตช์)
มีเครื่องมือครบมือแต่ไขประตูเองไม่ได้ · ผู้จัดที่ติดอยู่อีกสนามจึงหยุดแมตช์ที่ทั้งกรรมการและผู้เล่นพร้อมแล้วได้
เป็นตระกูลเดียวกับ OD-26 แต่อยู่ที่**ขั้นแรกสุด** ถ้าค้างตรงนี้ไม่มีอะไรหลังจากนั้นเกิดขึ้นได้เลย

- **M09 เปิดเช็คอิน** — กรรมการของแมตช์ **หรือ** ผู้จัด · ใช้กฎเดียวกับ M10/M10b/M10c ที่กรรมการกดได้อยู่แล้ว
  (ย้ายด่านจาก route `requireOrganizerOfMatch` มาไว้ที่ service เหมือน M10b/M10c) · คนอื่น 403 `NOT_MATCH_PARTICIPANT`
- **M18 ปิดเช็คอิน** — กรรมการปิดได้ **เฉพาะเมื่อยังไม่มีใครเช็คอิน** · มีแล้ว → 409 `CHECKIN_NOT_EMPTY` + `extra.checkins`
  - เหตุผลที่ต้องให้ปิดได้: ตั้งแต่กรรมการเปิดเองได้ก็ต้องถอนความพลาดของตัวเองได้ (เปิดผิดแมตช์ตอนคอร์ตติดกัน) ไม่งั้นจุดค้างแค่ย้ายที่
  - เหตุผลที่ต้องจำกัด: **M18 ไม่ใช่ขั้นถัดไป มันคือการถอน M09 กลับ** (`checkin_open → scheduled`) และมัน `DELETE FROM match_checkins`
    ทุกแถว ผู้เล่นที่เช็คอินแล้วต้องทำใหม่หมด · การให้อำนาจล้างงานของผู้เล่น 10 คนโดยไม่มีขั้นยืนยันใด ๆ ไม่สมกับ
    "ถอนความพลาดของตัวเอง" — มีคนเช็คอินแล้วให้เป็นเรื่องของผู้จัด ซึ่งรับผิดชอบตารางทั้งทัวร์อยู่แล้ว
  - ★ ชื่อ "ปิดเช็คอิน" ทำให้เข้าใจผิดว่าเป็น "ปิดหน้าต่างแล้วไปต่อ" · ตัวที่แปลว่าอย่างนั้นคือ **M10 เริ่มแมตช์**
- **audit `match_checkin_closed`** (เพิ่มระหว่างทาง) — เดิม `closeCheckin` ลบเช็คอินทุกแถวโดย**ไม่เขียน audit เลยและไม่รับ `userId` ด้วยซ้ำ**
  เป็นช่องเดียวในวงจรแมตช์ที่ลบข้อมูลของผู้ใช้แล้วไม่บันทึกอะไร ผู้เล่นมาบอกว่า "เช็คอินแล้วหาย" ก็ไล่ไม่ได้ว่าใครกดเมื่อไร
  (เทียบกับ M10c ยกเลิกแมตช์ ที่ลบเช็คอินเหมือนกันแต่เขียน `match_abandoned` ไว้) · ตอนนี้บันทึกผู้กด + `deletedCheckins`

- **ด่านตารางที่ M09 + M10** (FE-open-checkin-has-no-fixture-gate · ทำ 27 ก.ย. เช่นกัน) — ต้องมี `scheduled_time` + `scheduled_end_time` + `venue` ครบ
  - ที่มา: แมตช์ที่ `createBracket` สร้างมา**เกิดมาว่างทั้งสามช่อง** และ**ไม่มีจุดไหนในระบบบังคับให้ผู้จัดกรอก** (`publishTournament` ก็ไม่บังคับ เพราะตอน publish ยังไม่มีแมตช์)
  - FE รายงานว่าเป็น "ประตูทางเดียว" — **จุดนี้เขาพูดเกินไป** M18 ปิดเช็คอินพากลับ `scheduled` ได้และไม่ต้องการตารางอะไรเลย · แต่หลังกฎ M18 ใหม่ข้างบน ทางออกนั้นแคบลงเมื่อมีคนเช็คอินแล้ว
  - ความเสียหายจริง 3 อย่าง: (1) `notifyMatchAudience` ยิงแจ้งเตือน "เปิดเช็คอินแล้ว" ไปแล้วเรียกคืนไม่ได้ · (2) ผู้เล่นเช็คอินจริงแล้วต้องถูกลบทิ้ง · (3) **หนักสุด** `startMatch` ก็ไม่เคยเช็คตารางเหมือนกัน แมตช์จึงเดินได้ตลอดสาย `checkin_open → in_progress → finished → completed` โดยไม่มีบันทึกว่าแข่งเมื่อไรที่ไหน แล้วแก้ย้อนไม่ได้อีกเพราะ M06 รับแต่ `scheduled`
  - **เกิดขึ้นจริงในฐาน dev แล้ว**: แมตช์ 10/11/12 `completed` โดย `scheduled_time`/`scheduled_end_time`/`venue` เป็น NULL ทั้งสามช่อง — เสียถาวร
  - ใส่ทั้งสองจุด: **M09 เป็นด่านหลัก** (กันทางเข้า) · **M10 เป็นตะแกรง** (กันแมตช์ที่เปิดเช็คอินค้างไว้ก่อนกฎนี้มีผล) · ยืนยันกับฐานจริงแล้ว: ยิง M09 ที่แมตช์ 13 ได้ `409 SCHEDULE_INCOMPLETE {"missing":["scheduledTime","scheduledEndTime","venue"]}` และสถานะไม่ขยับ
  - ★ ที่ M10 ด่านนี้อยู่**ก่อน**การตัดสินไม่มาตามนัด — ไม่งั้นทีมที่เช็คอินไม่ถึงขั้นต่ำจะถูกปรับแพ้บายในแมตช์ที่ไม่ควรเริ่มตั้งแต่ต้น คือเสียสิทธิ์จากความบกพร่องของผู้จัด
  - ใช้ code `SCHEDULE_INCOMPLETE` + `extra.missing[]` ตัวเดียวกับ M06 (FE มีตัวแสดงข้อความอยู่แล้ว) แต่เป็น **409** ไม่ใช่ 400 เพราะไม่มี payload ให้ผิด เป็นปัญหาสถานะ
  - พบระหว่างทาง: **ไม่มีเทส `startMatch` ในระดับ service เลยมาก่อน** ด่าน 4 ชั้นของมัน (สถานะ · ทีมครบ · BR-10 · เช็คอินถึงขั้นต่ำ) ไม่เคยถูกคุมด้วยเทส — เพิ่มไฟล์ `match.startFixture.test.ts` คุมด่านใหม่พร้อมกันด่านเดิมไม่ให้หาย

## OD-27 — แมตช์ที่เริ่มแล้วแต่แข่งไม่จบ (abandoned match) — ✅ Resolved 2026-09-27

เจอระหว่างอธิบายระบบเลื่อนเวลาของผู้จัด: สถานะ `in_progress` มีทางออกทางเดียวคือ "มีคนส่งผล" แต่เคสฝนตก/ไฟดับ/คนเจ็บหนัก **ไม่มีผลให้ส่ง** เพราะการแข่งขันไม่ได้เกิดจนจบ · เลื่อนเวลา (M06) รับเฉพาะ `scheduled` · ปิดเช็คอิน (M18) และปรับแพ้ (M17) รับเฉพาะ `checkin_open` → แมตช์ค้างถาวร ทัวร์ปิดไม่ได้

**ไม่ใช้ทางของ OD-26 ข้อ 6** (ผู้จัดกรอกผลหลัง 24 ชม.) เพราะทางนั้นแปลว่า "แข่งจบแล้วไม่มีใครรายงาน" ซึ่งคนละเรื่องกับ "แข่งไม่จบ" — ถ้าเอาไปใช้ จะได้ผลการแข่งขันของแมตช์ที่ไม่เคยแข่งจบ

- **ทางที่เลือก**: `POST /matches/:id/abandon` ถอย `in_progress → scheduled` แล้วผู้จัดตั้งเวลาใหม่ด้วย M06 ตามปกติ — **ไม่เพิ่มสถานะใหม่ ไม่มี migration** · ทางเลือกที่ไม่เอา: เพิ่มสถานะ `abandoned` (ต้อง migration + ไล่แก้ทุกจุดที่เช็คสถานะ และกลายเป็นจุดค้างใหม่ถ้าผู้จัดไม่ตัดสิน) · แข่งต่อจากสกอร์เดิม (ระบบไม่มีที่เก็บสกอร์ระหว่างทางเลย `score_data` เกิดตอนส่งผลเท่านั้น)
- **ใครกดได้**: กรรมการของแมตช์ **หรือ** ผู้จัด (เกณฑ์เดียวกับปุ่มจบการแข่งขัน — คนหน้างานรู้ว่าเกิดอะไร ผู้จัดคุมตาราง)
- **ล้างอะไรบ้าง**: เช็คอิน (ผู้เล่นต้องยืนยันตัวใหม่วันแข่งจริง เหตุผลเดียวกับ M18) · `started_at`/`actual_end_time` (ต้องเป็นของรอบที่แข่งจริงเท่านั้น ไม่งั้นนาฬิกาของ OD-26 ข้อ 6/7 เริ่มเดินผิดรอบ) · **สถิติผู้เล่นของรอบที่ยกเลิก** เพราะ `requireCanRecordStats` ไม่เช็คสถานะแมตช์ กรรมการกรอกสถิติระหว่างแข่งได้ ถ้าไม่ล้างจะถูกนับซ้ำตอนแข่งรอบใหม่
- **บันทึกที่ `audit_logs`** (`match_abandoned` + เหตุผล) ไม่เพิ่มคอลัมน์ในตาราง `matches` · **ไม่จำกัดจำนวนครั้ง** — ฝนตกซ้ำสองวันเป็นไปได้จริง
- **ไม่ใช้เส้นนี้เมื่อแข่งเกือบจบแล้วและผลใช้ได้** — กดจบการแข่งขัน (M10b) แล้วส่งผลตามปกติ เส้นนี้มีไว้เฉพาะตอนที่ผลยังไม่ควรนับ

## OD-36 — Avatar/Team Logo URL Delivery — ✅ Resolved 2026-09-29

`FE-avatar-and-team-logo-uploads` — `avatarUrl` เดิมคืน S3 key ดิบ ไม่ใช่ URL ที่ client เปิดดูได้ (`toUserRef()` ใช้เกือบทุก endpoint ที่คืนข้อมูลคน) และ `teams` ไม่มีคอลัมน์โลโก้เลย

**เลือก public-read bucket** ตั้ง MinIO bucket policy ให้ prefix `avatar/` และ `team_logo/` อ่านได้สาธารณะ (`mc anonymous set download`) แล้ว mapper ประกอบ URL ตรงจาก `S3_PUBLIC_BASE` ไม่ต้อง presign เลย — เหตุผล: cache ได้ ไม่มีวันหมดอายุ list ยาวกี่คนก็ไม่มีต้นทุนเพิ่ม (แค่ string concat ไม่ยิง S3)

**ทำไมไม่ใช้กฎเดียวกับเอกสารเช็คอิน/หลักฐานค้านผล** (ที่ต้อง presign ทุกครั้ง หมดอายุ 20 นาที) — สองอย่างนั้นเป็นเรื่อง PDPA (NF-SE-03) เห็นได้เฉพาะกรรมการของแมตช์ ส่วนรูปโปรไฟล์/โลโก้ทีมเป็นของที่ตั้งใจให้ทุกคนเห็นอยู่แล้วโดยธรรมชาติ (เหมือนหลุมพรางเดียวกับที่เกือบเกิดกับ `livestreamUrl` vs `roomCode` — อย่าลอกกฎของอีกฝั่งมาใช้ข้ามกัน)

**อื่นๆ ที่ตัดสินไปพร้อมกัน**: avatar ผูก `entityId=userId` จาก token เสมอ (ไม่รับจาก body) · team_logo ต้องเป็นหัวหน้าทีม · บันทึก key ก่อนต้องตรวจ 2 ชั้น (regex ownership + `HeadObject` มีไฟล์จริง) ไม่ผ่าน → 422 · ส่ง `null` = ล้างรูป/โลโก้ · รูปเดิมตอนเปลี่ยนใหม่ลบแบบ best-effort ไม่ทำให้ request ล้มถ้าลบไม่สำเร็จ

### เก็บตอน merge เข้า `BE_KN` (30 ก.ย.) — policy ถูกเขียนไว้แต่ไม่มีใครตั้งจริง

ตอนรีวิวยิงจริงพบว่าทั้งวงทำงานถูกหมดจนถึงขั้นสุดท้าย แล้ว**เปิด URL ที่ระบบคืนมาไม่ได้**

```
1) presign avatar        200  avatar/9003/6ca688af-….png
2) PUT ไฟล์ขึ้น MinIO     200
3) PATCH /me             200  avatarUrl = http://localhost:9000/ltms/avatar/9003/….png
4) เปิด avatarUrl         403 Forbidden      ← ตรงนี้
```

`mc anonymous set download` ที่ย่อหน้าข้างบนอ้างถึง **ไม่มีอยู่ในไฟล์ไหนเลย** — `minio-init` ใน
`docker-compose.yml` ทำแค่ `mc alias set` กับ `mc mb` · ดีไซน์ไม่ผิด แต่ไม่มีใครตั้งค่าตามดีไซน์
⇒ ใครที่ `docker compose up` ใหม่จะได้ URL ที่เปิดแล้ว 403 · **รูปยังแตกเหมือนเดิม แค่คนละสาเหตุ**

แก้โดยเติมสองคำสั่งลง `minio-init` ให้ dev ทุกเครื่องได้ policy เองตอน `up` ไม่ต้องจำไปทำมือ

```yaml
mc anonymous set download local/${S3_BUCKET:-ltms-uploads}/avatar;
mc anonymous set download local/${S3_BUCKET:-ltms-uploads}/team_logo;
```

**ยืนยันแล้วว่าแยกของสาธารณะกับของลับได้ถูก** — หลัง `minio-init` รันใหม่: `avatar/` และ `team_logo/`
เปิดได้ **200** ส่วน `dispute_evidence/` `checkin_document/` `referee_identity/` `soft_filter_document/`
ยัง **403** ทั้งหมด (ยิงจริงทั้ง 4 prefix)

**และ `minio` ไม่มี `ports:` ใน compose เลย** — เจอเพราะ `docker compose up minio-init` recreate
`minio` ตามและพอร์ตที่โฮสต์เคยเข้าถึงได้ก็หายไป ⇒ `npm run dev` บนเครื่องยิง MinIO ไม่ได้อีก
เติม `127.0.0.1:9000-9001` ให้แล้ว · จำเป็นเพราะ dev รัน backend บนโฮสต์ **และ** เพราะ
URL ของรูปถูกส่งไปให้เบราว์เซอร์เปิด ซึ่งเข้าชื่อ `minio` ในเน็ตเวิร์ก docker ไม่ได้

### ⚠️ production ยังต้องทำมือ — ไม่มี `mc` บน AWS S3

`mc anonymous set download` เป็นคำสั่งของ MinIO client ใช้กับ S3 จริงไม่ได้ · ตอน deploy
ต้องใส่ bucket policy เองและ **ต้องจำกัดเฉพาะสอง prefix เท่านั้น ห้ามเปิดทั้ง bucket**

```jsonc
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": [
      "arn:aws:s3:::<bucket>/avatar/*",
      "arn:aws:s3:::<bucket>/team_logo/*"
    ]
  }]
}
```

พร้อมกับตั้ง `S3_PUBLIC_BASE` ให้ชี้โดเมนที่เบราว์เซอร์เปิดได้ (CDN หรือ bucket endpoint)
ถ้าไม่ตั้ง ค่า fallback คือ `S3_ENDPOINT + S3_BUCKET` ซึ่งใน docker จะเป็น `http://minio:9000`
**ที่เบราว์เซอร์เปิดไม่ได้** — จุดนี้เป็นกับดักของโหมด dockerized ที่ต้องระวังตอน deploy

---

## OD-50 — Password recovery (A04/A05) — ✅ ทำแล้ว 2026-10-03

> **เดิมเขียนไว้เป็น OD-43 บนสาขา `backend_step9-10`** — เลขชนกับ OD-43 ของไฟล์นี้
> (การตั้งค่าแจ้งเตือนรายหมวด ของสาขา `backend_shokun_2`) เพราะสองสาขาเขียนคู่ขนานกัน — ไม่ใช่ความผิดของใคร
> เลื่อนบล็อกนี้เป็น OD-50 ตอน merge (3 ต.ค.) เพราะ**บล็อกนี้ไม่ถูกอ้างถึงที่ไหนเลย** (โค้ด 0 จุด · GUIDE 0 จุด)
> ส่วนอีกอันถูกอ้าง 23 จุด ⇒ เลื่อนอันนี้คือแก้บรรทัดเดียว · **ไม่แตะเนื้อหาข้างในเลยแม้แต่คำ**

ตั้งต้นจาก `TASK-password-recovery.md` (ฐาน `BE_KN` 7a4499c) ซึ่งตัดสินรายละเอียดไว้ให้เกือบหมดแล้ว
มตินี้บันทึกเฉพาะ **เหตุผล** เบื้องหลังจุดที่คนอ่านโค้ดเฉย ๆ เดาไม่ออกว่าทำไมต้องทำแบบนี้
(ตามสไตล์ OD-34) ไม่ใช่สรุปว่าทำอะไรซ้ำกับที่ GUIDE/06 (A04/A05) เขียนไว้แล้ว

### ทำไมตอบ 200 เหมือนกันเป๊ะตอนไม่พบอีเมล (แทนที่จะตอบ 404 ตามความเคยชินของ REST)

`forgot-password` เป็น endpoint ที่**ไม่ต้อง login** — ใครก็ยิงได้ไม่จำกัด ถ้าตอบ 404 เมื่อไม่พบอีเมล
endpoint นี้จะกลายเป็นเครื่องมือกวาดหาว่า "อีเมลไหนมีบัญชีในระบบบ้าง" (email enumeration) โดยอัตโนมัติ
แค่ยิงอีเมลเป็นชุดแล้วดู status code ต่างกัน — เป็นช่องโหว่เดียวกับที่ `login` เคยแก้ไปแล้วด้วย
`INVALID_CREDENTIALS` ข้อความเดียวทั้ง "ไม่มีอีเมลนี้" กับ "รหัสผิด" (`auth.service.ts` เดิม)
มตินี้แค่ขยายหลักเดิมมาใช้กับ endpoint ใหม่ ไม่ใช่การตัดสินใจใหม่

ผลคือ `forgotPassword()` แยกพฤติกรรมภายใน (สร้าง token/ส่งเมลจริงเฉพาะอีเมลที่มีจริงและไม่ถูกระงับ)
แต่ **คืนค่าที่สังเกตได้จากภายนอกเหมือนกันทุกเคส** — ข้อยกเว้นเดียวที่ยอมให้ต่างคือ rate limit (429)
ซึ่งยอมรับได้เพราะไม่รั่วว่าอีเมลมีจริงหรือไม่ (ต้องขอซ้ำเกิน 3 ครั้งก่อนถึงจะเห็นความต่าง ไม่ใช่ครั้งแรก)

### ทำไม error ของ token เหมือนกันทุกเคส (ไม่แยก "หมดอายุ" / "ถูกใช้แล้ว" / "ไม่มีจริง")

หลักการเดียวกับข้อบน แต่เป้าหมายต่างกัน — ที่นี่ไม่ได้กันการรู้ว่า "อีเมลมีจริงไหม" แต่กัน
**การ brute-force เดา token ดิบ** (64 hex char จาก `randomBytes(32)`) ถ้า error message ต่างกัน
ตามเหตุผล (เช่น "หมดอายุ" ต่างจาก "ไม่มีในระบบ") ผู้โจมตีจะรู้ว่าเดา "ใกล้" แค่ไหนในแต่ละรอบ —
แม้ในทางปฏิบัติ token 256 บิตจะเดาไม่ได้อยู่แล้ว หลักการ "อย่าให้ feedback ที่ไม่จำเป็น" ยังคุ้มที่จะถือไว้
เพราะไม่มีต้นทุนฝั่ง UX ที่เสียไป (ผู้ใช้ปกติไม่มีทางเจอ 3 เคสหลังโดยไม่ได้ตั้งใจพิมพ์ผิดอยู่แล้ว)

**ทำไมใช้ `verifyPassword`/`hashPassword` (bcrypt) หา token แทน `WHERE token_hash = ?` ตรง ๆ**
ไม่ใช่เพราะ bcrypt ปลอดภัยกว่า — แต่เพราะ bcrypt **non-deterministic** (salt สุ่มทุกครั้ง) จึง hash
เดิมสองครั้งจาก plain เดียวกันได้คนละ string กัน ⇒ ไม่มีทาง `WHERE` ตรงด้วย hash ได้เลย ต้อง
ดึงผู้สมัคร (`findAllActive()`) มาเทียบทีละแถวด้วย `verifyPassword` เสมอ (`passwordReset.repo.ts`)
ทางเลือกที่เร็วกว่าคือ hash token ดิบด้วย SHA-256 (deterministic) แล้ว `WHERE token_hash = ?` ได้ตรง ๆ
แต่ `TASK-password-recovery.md` สั่งให้ใช้ `utils/password.ts` ที่มีอยู่แล้วแทนการลงไลบรารีใหม่ —
ยอมแลกความเร็ว (ตารางนี้แถวไม่เยอะ ไม่ใช่คอขวดจริง) เพื่อไม่เพิ่มโค้ด crypto เส้นใหม่ในโปรเจกต์

### ทำไม env ของเมล (`SMTP_*`/`MAIL_FROM`/`FRONTEND_URL`) เป็น optional ทั้งหมด ห้าม `requireEnv`

`config/env.ts` ใช้ `requireEnv()` โยน error ทันทีตอน boot ถ้าตัวแปรหาย — ใช้ถูกกับ `DB_*`/`JWT_SECRET`
เพราะไม่มีค่าเหล่านั้นแอปทำงานไม่ได้เลยจริง ๆ แต่ฟีเจอร์นี้เป็นงานของคนเดียว (ไม่ใช่ทั้งทีม) ส่วน
เพื่อนร่วมทีมอีก 10+ คนที่ไม่ได้แตะ auth ไม่ควรต้องรู้จัก/ตั้งค่า SMTP เพื่อแค่ `npm run dev` ให้ขึ้น
ถ้าใช้ `requireEnv` ตรงนี้ **ทั้งทีมรันไม่ขึ้นทันทีที่ merge** แม้จะไม่ได้แตะฟีเจอร์นี้เลยก็ตาม
⇒ ไม่ตั้งค่าอะไรเลย = fallback ไปที่ mailpit (`localhost:1025`) อัตโนมัติ ไม่มีใครพังเพราะ merge นี้

### ทำไมแบ่งงานเป็น "ก้อน 1" (โค้ด+mailpit) กับ "ก้อน 2" (ต่อ SMTP จริง)

สิ่งที่ติดในงานนี้จริง ๆ ไม่ใช่โค้ด — เป็นบัญชี SMTP จริง/โดเมน/การแชร์ credential ในทีม ซึ่งเป็น
เรื่ององค์กรที่ใช้เวลาหลายวันหรือทำไม่ได้เลยในกรอบวิชานี้ ถ้ารวมเป็นก้อนเดียว ฟีเจอร์ทั้งหมดจะ
ค้างรอสิ่งที่ไม่เกี่ยวกับโค้ดเลย ทั้งที่ตรรกะ/เทส/endpoint ทำเสร็จได้ภายในวันเดียว การแบ่งก้อนทำให้
**ก้อน 1 เดโมได้จริงและถือว่าเสร็จสมบูรณ์** (เปิด mailpit เห็นเมลออกจริง กดลิงก์ ตั้งรหัสใหม่ login ได้)
โดยไม่ต้องรอก้อน 2 ซึ่งเป็นแค่เปลี่ยนค่า `.env` ไม่แตะโค้ดแม้แต่บรรทัดเดียว

### เก็บระหว่างทาง

- ใช้ `429 RATE_LIMITED` (มีอยู่แล้วใน Part4 §ทั่วไป) สำหรับ rate limit ของ `forgot-password` —
  ไม่ใช่โค้ดใหม่ที่ต้องขอเพิ่ม
- Part4 เดิมมี `RESET_TOKEN_EXPIRED` (410)/`RESET_TOKEN_ALREADY_USED` (409) แยกกันสำหรับ A05 แต่
  `TASK-password-recovery.md` สั่งรวมเป็น `INVALID_RESET_TOKEN` (400) เดียวด้วยเหตุผล anti-enumeration
  ข้างบน — ยังไม่ได้ยืนยันกับทีมเอกสารว่าเป็นการแก้ไขที่ตั้งใจหรือ Part4 เขียนไว้ก่อนคิดเรื่องนี้ทะลุ
  (เหมือนเคส `EMAIL_TAKEN` vs `EMAIL_ALREADY_REGISTERED` ที่เคยเจอ — โค้ดยึดตามเอกสารที่ตัดสินล่าสุด
  แต่ต้องขอ confirm กับทีมอีกที)
- GUIDE/06 (A04 `POST /admin/scopes`, A05 `DELETE /admin/scopes/:id` ในหมวด 11 Admin) ชนรหัสกับ
  A04/A05 ของหมวด Auth ที่เพิ่มรอบนี้ — ไม่ได้แก้ในรอบนี้เพราะ A05 (Admin) ถูกอ้างอิงไขว้จาก A06
  แล้วในไฟล์เดียวกัน เสี่ยงพังจุดอื่นถ้าเปลี่ยนเลขโดยไม่ตรวจทั้งไฟล์ — ควรเลือกสคีมา ID ใหม่ทั้งไฟล์
  เป็นงานแยกต่างหาก ไม่ใช่งานของมตินี้

