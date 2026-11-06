# 05 — Referee Specification

**Status:** Current + explicit Open Decisions  
**Last reviewed:** 2026-09-15

## 1. Two-Level Referee Model

LTMS แยก referee ออกเป็นสองระดับ:

1. **Tournament Referee** — บุคคลที่ตอบรับการแต่งตั้งให้ทำหน้าที่ใน Tournament นั้น
2. **Match Referee Assignment** — การมอบหมาย Tournament Referee ให้ Match เฉพาะ

สองระดับนี้มีหน้าที่ต่างกันและไม่ควรถูกรวมเป็น state เดียว

## 2. Tournament Referee Invitation

Organizer สามารถเชิญ User มาเป็น Referee ของ Tournament ในช่วง `private preparation` ได้ แม้ Tournament ยังไม่ public

Invitation ต้องมีอย่างน้อย:

- tournament
- invited user
- inviter
- invitation state
- internal/external classification
- external approval state เมื่อเกี่ยวข้อง

Referee ที่ยังไม่ตอบรับหรือถูกถอดแล้วไม่ถือเป็น active capacity

## 3. External Referee

Current invariant จาก SRS/SDS:

- external referee ต้องได้รับ Admin approval ก่อนมี operational authority
- invitation accepted อย่างเดียวไม่พอ
- referee ที่ `pending/rejected` external approval ห้ามถูกนับเป็น active referee สำหรับ publication readiness หรือ match authorization

แนวทางเอกสาร verification ที่ทีมกำลังออกแบบคือ:

```text
Admin defines required verification documents
→ Organizer invites external Referee
→ Referee accepts invitation
→ system shows required documents
→ Referee submits documents
→ Admin reviews
→ approved = active Referee
```

โครงสร้าง table/field สำหรับ document requirement ยังเป็น Open Decision; invariant เรื่อง Admin approval เป็น Current

## 4. Publication Referee Capacity — Team Decision 2026-09-15 (supersedes peak-demand rule)

Publish เกิด**ก่อน**เปิดรับสมัคร → ตอน publish ยังไม่มีทีม/สาย/แมตช์ ดังนั้นกฎที่อิงตารางแข่ง (peak concurrent, per-match coverage) ใช้เป็น publication gate ไม่ได้ BR-10 จึงแยกเป็น 2 ด่าน:

| ด่าน | เมื่อไหร่ | กฎ |
|---|---|---|
| 1 | C13 publish | active referee pool ≥ `refereesNeededPerMatch(sport)(default_mode)` — 1 คน หรือ 2 คนถ้า on-site และกีฬามี stat definition (BR-11) |
| 2 | M10 start (รายแมตช์) | แมตช์นั้นมี active referee ≥ needed(mode) → ไม่ครบ `409 INSUFFICIENT_REFEREES` — ORG หาคน (FR02) หรือเลื่อน (M06) |

ระหว่างสองด่าน `GET /tournaments/:id/referees/coverage` (F14) เตือน `uncovered[]` / `conflicts[]` โดยไม่ block · ADR-0005 (ขั้นต่ำ 1) ยังใช้เป็นฐานของด่าน 1 · ดู `GUIDE/11 §10.2`

## 5. Required Referee Count Per Match

Current team decision แบ่ง Match ตาม operational mode ดังนี้:

```text
requiredRefereeCount(match) =
  1  if match.mode = online
  2  if match.mode = on-site
```

ความหมายของแต่ละ mode:

- **online / e-sport Match**: ต้องมี active Referee อย่างน้อย 1 คน
- **on-site / physical-sport Match**: ต้องมี active Referee อย่างน้อย 2 คนที่เป็นคนละคนกัน

สำหรับ on-site Match ต้องครอบคลุมอย่างน้อยสอง operational responsibilities:

1. **Match Referee / Adjudicator**
   - ตัดสินการแข่งขันตามกติกา
   - จัดการเหตุการณ์หรือข้อโต้แย้งที่เกิดขึ้นระหว่างการแข่งขัน
2. **Score / Statistics Referee**
   - บันทึกคะแนน
   - บันทึกสถิติและข้อมูลการแข่งขันที่ระบบต้องเก็บ

กฎนี้เป็น **minimum staffing rule** ไม่ได้จำกัดจำนวนสูงสุด; Tournament/Sport สามารถกำหนดมากกว่า 1 หรือ 2 ได้หากการแข่งขันต้องการ

กฎนี้ supersede baseline เดิมของ SRS BR-11 ที่บังคับ 2 คนเฉพาะ on-site Match ที่บันทึก participant statistics; Current Spec กำหนดให้ on-site Match ทุก Match ใช้ขั้นต่ำ 2 คน

## 6. Match Assignment

Match Referee Assignment ต้องอ้าง Tournament Referee ที่ active ใน Tournament เดียวกัน

Referee permission บน Match เช่น check-in verification, result submission/verification และ statistic entry ต้องตรวจ match assignment จริง ไม่ใช่แค่ tournament membership

สำหรับ on-site Match ระบบต้องสามารถระบุได้ว่า assignment ใดรับผิดชอบ adjudication และ assignment ใดรับผิดชอบ score/statistics หรือมีข้อมูลเทียบเท่าที่ทำให้ตรวจ coverage ของสองหน้าที่นี้ได้

## 7. Match-Specific Invitation / Partial Acceptance

ทีมมี proposal ให้ invitation ระบุ Match ที่เสนอให้ Referee และให้ Referee เลือกตอบรับบาง Match ได้ โดยเปลี่ยน `match_referees` ให้มี assignment state เช่น `pending/accepted/declined`

เพราะ proposal นี้มีผลต่อ API/schema/request workflow หลายส่วน Current Spec จึงแยกเป็นสองระดับ:

- **Current invariant:** Tournament Referee และ Match Assignment แยกกัน; Match Assignment ต้องมีสถานะที่สะท้อนว่า Referee รับหน้าที่จริงก่อนนับเป็น match-level authority เมื่อ flow นี้ถูกใช้
- **Open implementation contract:** exact endpoint/body/state transition ของ partial acceptance ดู `OPEN_DECISIONS.md`

## 8. Reassignment, Transfer, and Swap

Direction จาก team discussion รองรับทั้ง:

- **transfer** — Referee A ส่ง Match X ให้ Referee B
- **swap** — Referee A/B แลก Match X/Y
- **Organizer add-match request** — Organizer ขอให้ Referee รับ Match เพิ่ม

เมื่อ Referee ที่เกี่ยวข้องตอบรับครบ การเปลี่ยนสามารถ apply แล้วแจ้ง Organizer โดยไม่เพิ่ม Organizer-approval gate อีกชั้น; Organizer ยังมีสิทธิ์ถอด/จัด assignment ใหม่ตาม policy

อย่างไรก็ตาม request schema, expiry, buffer time และ race-handling อยู่ใน `OPEN_DECISIONS.md` จนกว่าจะ finalize API contract

## 9. Conflict and Double Booking

Assignment ใหม่ต้องตรวจว่า Referee ไม่ถูกมอบหมายให้ Match ที่ overlap กันในช่วงเวลาเดียวกัน

เมื่อ Organizer แก้ schedule ของ Match แล้วเกิด overlap ภายหลัง แนวทางล่าสุดคือ **allow schedule change แต่สร้าง warning ให้ Organizer** ไม่ทำ silent reassignment

ระบบต้องสามารถระบุ affected Referee/Matches เพื่อให้ Organizer แก้ก่อน Match start

## 10. Removing a Referee

- Organizer สามารถถอด Referee ก่อน Match เริ่มตาม operational rule
- การถอดที่ทำให้ coverage ลดลงไม่ควร auto-unpublish Tournament ที่ public ไปแล้ว
- ระบบต้องสร้าง warning/readiness issue ให้ Organizer หา replacement
- public Tournament ยังคง public จนกว่าจะมี explicit policy อื่น

## 11. Implementation Status (2026-09-15)

gap ที่เคยระบุปิดแล้วทั้งหมดบน `BE_KN`:

- `match_referees.assignment_status` (pending/accepted/declined) — migration 002
- `referee_change_requests` + FR01–FR08 — migration 003
- external verification docs + per-person identity review (AR01–AR04, U11–U12) — migration 004–005

รายละเอียด endpoint: `GUIDE/06 §6` · การตัดสินใจ: `GUIDE/10 §8`, `GUIDE/11`
