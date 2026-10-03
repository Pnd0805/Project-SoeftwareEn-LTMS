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
  หายไปเองเพราะทั้งสองแถวติดกฎ C2 และถูกถอด แต่ **ช่องที่ให้สร้างซ้ำยังเปิดอยู่** — ยังไม่ได้แก้
- **`actual_end_time` เป็น NULL** ในแมตช์ที่ `completed` อยู่ 6 แมตช์ (2–6, 9) เพราะ migration 026
  เพิ่มคอลัมน์โดยไม่ backfill · `audit-roles.py` ไม่จับเพราะ C8 ดูแค่แมตช์ที่ยังไม่จบ — ยังไม่ได้แก้

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

⚠️ **ต้องจัดหมวดตอน merge `backend_shokun_2`** — ชนิดใหม่นี้ไม่อยู่ในตาราง `NOTIFICATION_CATEGORY`
ของงานตั้งค่าแจ้งเตือน และของที่ไม่อยู่ในตารางถือเป็น `critical` (ปิดไม่ได้) โดยปริยาย
อันนี้ไม่มีเส้นตาย ⇒ ต้องเป็น `community` · เป็นตัวที่ **สาม** ที่ตกหล่นแบบนี้ (คู่กับ `team_deleted`
และ `tournament_announcement` ที่ FE ขอ) — จะต้องเติมทั้งสามตัวตอน merge

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
· ใช้ `findLatestByTournamentAndUser` ที่มีอยู่แล้ว (แถวล่าสุด) เพราะคนหนึ่งอาจถูกเชิญ–ถอด–เชิญใหม่
  และเป็น helper ตัวเดียวกับที่โฟลว์คำเชิญใช้อยู่ จึงไม่ได้ตั้งกฎใหม่ (ฐาน dev มีคู่ tournament+user ที่มีถึง 5 แถว)
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

## OD-43 — Password recovery (A04/A05) — ✅ ทำแล้ว 2026-10-03

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

