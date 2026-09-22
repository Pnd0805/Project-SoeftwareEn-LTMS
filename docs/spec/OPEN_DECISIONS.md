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

## OD-23 — Tournament feedback / rating / MVP vote (C6) — ✅ Resolved 2026-09-21

FE-tournament-feedback: Community tab (ให้คะแนนการจัดทัวร์) และหน้าโหวต MVP ทำงานเฉพาะ mock · ใช้ตาราง `tournament_feedback` เดิม ไม่มี migration

- **1 ใครให้คะแนน**: เฉพาะคนที่เกี่ยวข้อง — ผู้เล่นในรายชื่อลงแข่ง (`application_players` ของใบสมัคร approved) · หัวหน้าทีม approved · **ไม่รวมกรรมการ** (แก้ 21 ก.ย. — กรรมการอาจเป็นคนฝั่งผู้จัด) · ORG ให้คะแนนตัวเองไม่ได้ (`ORGANIZER_CANNOT_REVIEW_OWN`) · คนอื่น → 403 `FEEDBACK_NOT_ALLOWED`
- **2 เมื่อไร** (แก้ 21 ก.ย. · แก้อีกครั้ง 22 ก.ย.): **เปิดตั้งแต่ทัวร์เริ่ม** = ถึง `event_start_date` 00:00 เวลาไทย **หรือ** มีแมตช์ที่แข่งจริงแล้ว (in_progress / disputed / result_rejected / completed ที่มีผลไม่ใช่ walkover) อย่างไหนถึงก่อน — ชนะบายไม่นับว่าเริ่ม (ทีมถอนก่อนวันแข่งก็เกิดได้) · ก่อนหน้า → 409 `TOURNAMENT_NOT_STARTED {opensAt}` · **ปิดรับพร้อม MVP** = 7 วันหลัง `completed_at` (พ้น → 409 `FEEDBACK_CLOSED`) · GET คืน `status` (`not_started` / `open` / `closed`) + `opensAt` + `closesAt` · **แก้คะแนน** = ส่งซ้ำระหว่างเปิด (เขียนทับ ข้อ 3) · MVP เริ่มโหวตหลังทัวร์ `completed` เท่านั้น (ก่อนหน้า → 409 `TOURNAMENT_NOT_COMPLETED`) โหวตได้ 7 วัน (พ้น → 409 `MVP_VOTING_CLOSED`) · ปิดโหวตแล้วค่อยประกาศ `winners` (เสมอได้หลายคน) · `lockCompletedTournament` ยกเว้น `/feedback` และ `/mvp-votes`
- **ทีมถอนตัว** (ตัดสิน 21 ก.ย.): หัวหน้า/ผู้เล่นทีมที่ถอนให้คะแนนไม่ได้อีกหลังถอน (FE ถามให้คะแนนก่อนยืนยันถอนตัว — **เฉพาะเมื่อทัวร์เริ่มแล้ว** `status: open` · ความเห็นที่ให้ไว้แล้วยังนับ) · โหวต MVP ได้เหมือนคนนอก · ผู้เล่นทีมที่ถอนไม่เป็นผู้ถูกโหวต
- **กรรมการที่ถูกถอด** (ตัดสิน 21 ก.ย.): โหวต MVP ได้ · กรรมการที่ยังรอตอบ/ตอบรับแล้วโหวตไม่ได้
- **ทัวร์ที่ completed ก่อนมี `completed_at`** (ข้อมูลเก่าก่อน migration 022 เท่านั้น — ระบบจริงใส่ให้ตอนกด B1 เสมอ): ถือว่าปิดทั้งให้คะแนนและ MVP
- **3 ส่งซ้ำ**: เขียนทับของเดิม (คนละ 1 อันต่อทัวร์ ใช้ UNIQUE เดิมของตาราง) ทั้ง feedback และโหวต MVP · แก้ข้อความแล้วล้างธง report
- **4 ใครโหวต MVP**: เฉพาะคนที่ไม่ได้ลงแข่ง (spec 08 §5) — ห้ามผู้เล่นในรายชื่อ, สมาชิกทีม approved, กรรมการ (pending/accepted), ORG → 403 `MVP_VOTER_NOT_ELIGIBLE` · ผู้ถูกโหวต = ผู้เล่นในรายชื่อลงแข่งเท่านั้น · ไม่ใช่ → 422 `MVP_CANDIDATE_NOT_ELIGIBLE`
- **การมองเห็น** (ตามข้อเสนอในเอกสารแบ่งงาน): ค่าเฉลี่ย/จำนวน/การกระจายเป็นสาธารณะ · ORG เห็นข้อความแต่ไม่เห็นชื่อ · แอดมิน `university_wide` เห็นชื่อ (ใช้ตรวจ report)
- **report / ลบ**: `POST /feedback/:id/report` — organizer_feedback report ได้เฉพาะ ORG ของทัวร์ (คนที่มองเห็น) · โหวต MVP report ไม่ได้ · `DELETE /admin/feedback/:id` soft delete + audit `feedback_removed` · คนที่ถูกลบส่งใหม่ไม่ได้ (409 `FEEDBACK_REMOVED`) · ค่าเฉลี่ย/คะแนนโหวตไม่นับแถวที่ถูกลบ

## OD-24 — Tournament comments + Pick'em (C7) — ✅ Resolved 2026-09-22

FE-match-comments-pick-em: SocialBar ในหน้าแมตช์ (คอมเมนต์ + ทายผล) ทำงานเฉพาะ mock

**คอมเมนต์ — ระดับทัวร์** (แก้ 22 ก.ย.: เดิมทำเป็นรายแมตช์ หลายอันต่อคน ในตาราง `match_comments` migration 024 → **เอาออกทั้งหมด** · migration 024 ถูกลบ ไม่เคยเข้า BE_KN)
- อยู่ใน `tournament_feedback` แบบ `feedback_type = 'comment'` (enum มีอยู่แล้ว · **ไม่มี migration**) · เหมือน feedback แต่ **ทุกคนเห็น** (feedback ให้ ORG เห็นคนเดียว)
- **คนละ 1 อันต่อทัวร์** (UNIQUE เดิม) · **ส่งซ้ำ = แก้** (201 ครั้งแรก / 200 แก้ · แก้แล้วล้างธง report) · ≤ 500 ตัวอักษร
- **ใครก็ได้ที่ล็อกอิน** (รวมผู้เล่น/ORG — เป็นแค่การพูดคุย) · อ่านเป็นสาธารณะ พร้อม `mine` + `canComment`
- ทัวร์ต้อง `public` หรือ `completed` — อื่น ๆ (private / รออนุมัติ / ถูกปฏิเสธ / ถูกลบ) → 409 `TOURNAMENT_NOT_PUBLIC` · อ่าน: คนนอกได้ 404 เหมือนหน้าทัวร์ (ORG กับแอดมินทั้งมหาวิทยาลัยยังอ่านได้)
- เจ้าของลบเอง (`DELETE /tournaments/:id/comments/me`) = ลบจริง โพสต์ใหม่ได้ · report ใครก็ได้ยกเว้นของตัวเอง (`POST /feedback/:id/report` → 400 `CANNOT_REPORT_OWN_COMMENT`) · **ลบของคนอื่นได้เฉพาะแอดมิน** `university_wide` (`DELETE /admin/feedback/:id` + audit `feedback_removed`) — ORG ลบไม่ได้ กันลบคำติ · ถูกแอดมินลบแล้วโพสต์/ลบเองไม่ได้อีก (409 `COMMENT_REMOVED`)
- คอมเมนต์ได้แม้ทัวร์ปิดแล้ว (`lockCompletedTournament` ยกเว้น `/comments` และ `/comments/me`) · จับสายใหม่ไม่กระทบคอมเมนต์ (ไม่ผูกแมตช์)
- **กันสแปม 5 ครั้ง/นาที ถูกเอาออก** — คนละ 1 อัน ส่งซ้ำเป็นการแก้ ไม่เพิ่มแถว จึงท่วมรายการไม่ได้อยู่แล้ว

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
