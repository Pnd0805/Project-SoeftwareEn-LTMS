# 03 — Tournament Specification

**Status:** Current  
**Last reviewed:** 2026-09-15

## 1. Tournament Creation and Approval

ผู้ใช้ไม่สามารถสร้าง public Tournament โดยข้าม Admin approval ได้

```text
User submits request
→ pending approval
→ Admin approve → private preparation
→ Admin reject → rejected
```

เมื่อ approve:

- Tournament record ต้องมีอยู่ในสถานะ private/preparation
- requester ได้ Organizer permission ของ Tournament นั้น
- general users ยังไม่สามารถ discover/register ได้

## 2. Required Configuration

Tournament ต้องกำหนดอย่างน้อย:

- name
- sport type
- bracket format: Single Elimination / Double Elimination / Round Robin
- organizational scope
- registration window
- event start/end
- `maxTeams` และ minimum participation rule ที่เกี่ยวข้อง
- venue / online channel ตาม mode
- eligibility requirements
- roster rules
- match/result mode ที่จำเป็นต่อการวาง schedule/referee requirement

## 3. Private Preparation — Current Team Decision

`private` มีความหมายเป็น **pre-publication preparation workspace** ไม่ใช่เพียง hidden visibility state

ก่อน publish Organizer ต้องเตรียม:

1. Tournament details และ eligibility ที่จำเป็น
2. fixed bracket structure จาก `bracketFormat` + `maxTeams`
3. planned Match records/slots ตาม structure
4. planned time range และ venue/channel ของ Match
5. Referee capacity และ external approval ตาม [05-referees.md](05-referees.md)
6. readiness constraints อื่นที่ถูกระบุใน domain spec

### Superseded baseline

SRS/SDS เดิมระบุให้ปิด registration แล้วค่อยสร้าง bracket จาก approved teams ข้อกำหนดนั้นถูก **supersede** โดยมติทีมหลังเอกสารดังกล่าว: topology และ planned schedule ต้องมีตั้งแต่ private preparation

## 4. Publication Readiness

Tournament เปลี่ยนจาก private ไป public ได้เมื่อ readiness check ผ่านทั้งหมด

ขั้นต่ำประกอบด้วย:

- required Tournament data valid และไม่ contradictory
- registration dates valid และอยู่ก่อน event
- bracket skeleton exists
- planned Matches มี schedule ที่เพียงพอสำหรับ readiness calculation
- planned Matches ระบุ operational mode (`online` หรือ `on-site`) เพื่อ derive จำนวน Referee ขั้นต่ำต่อ Match
- referee requirement สำหรับ schedule ถูกคำนวณได้
- จำนวน active referees เพียงพอกับ required capacity
- external referees ที่ถูกนับเป็น capacity ได้รับ Admin approval แล้ว

ถ้าไม่ผ่าน ระบบต้อง reject publish พร้อม actionable reason

Referee demand ต่อ Match ใช้กฎปัจจุบันดังนี้:

```text
online / e-sport match      → minimum 1 active referee
on-site / physical match   → minimum 2 active referees
```

ดังนั้น publication readiness ต้องคำนวณจากผลรวมของ requirement ต่อ Match ที่เวลา overlap กัน ไม่ใช่ใช้ค่าคงที่เดียวทั้ง Tournament

## 5. Public and Registration

Public visibility กับ registration เป็น related but distinct controls:

- private Tournament: general users ไม่เห็นและสมัครไม่ได้
- public Tournament: general users ดูได้
- registration รับ application ได้เมื่อ Tournament public และ registration state/window เปิด
- ปิด registration แล้วห้ามรับ application ใหม่ แต่ pending application เดิมยังพิจารณาได้

การ unpublish ต้องไม่สร้าง state `private + registration open`

## 6. Tournament Capacity

`maxTeams` เป็น design input ที่กำหนดขนาด bracket skeleton ก่อน publication

จำนวนทีมสมัครจริงอาจต่ำกว่า `maxTeams`; bracket ไม่ถูก rebuild เพียงเพราะจำนวนทีมไม่เต็ม แต่ participant slots ที่ไม่มีทีมถูกจัดการด้วย BYE/unused-match semantics ตาม [06-brackets-matches.md](06-brackets-matches.md)

ระบบต้องป้องกันการ approve ทีมเกิน capacity และต้องรับมือ concurrency ที่ application approval layer

## 7. Amendments

Organizer แก้ field ทั่วไปที่ไม่เปลี่ยน eligibility/competition contract ได้ตาม allowlist ของ API

การแก้ที่มีผลสำคัญ เช่น:

- registration dates
- event dates
- team capacity
- eligibility limits

ต้องผ่าน Admin approval และห้ามทำให้ state ปัจจุบันขัดแย้ง เช่น ลด `maxTeams` ต่ำกว่าจำนวน approved teams

การเปลี่ยน field ที่กระทบ bracket topology/schedule/referee readiness ต้อง trigger revalidation ของ dependent artifacts

## 8. Scope

SDS ล่าสุดรองรับ Tournament scope ระดับ `department`, `faculty`, และ `university` ใน domain model

Current MVP delivery เปิด C01/API/UI สำหรับ `department` และ `faculty` เท่านั้น ส่วน `university` **deferred** ไว้ก่อน แม้ database/domain model จะรองรับค่าไว้แล้ว การเปิด `university` ภายหลังต้องตรวจ authorization/filter/UI ที่เกี่ยวข้องก่อนเปิดใช้งาน

`scope` บอกระดับหน่วยงาน/ขอบเขตของ Tournament ไม่ใช่ตัวแทน eligibility ทั้งหมด เช่น Tournament ระดับ `faculty` ไม่ได้แปลอัตโนมัติว่าคณะอื่นสมัครไม่ได้; ผู้มีสิทธิ์สมัครให้ตัดสินจาก eligibility rules ของ Tournament

## 9. Eligibility Timing

SDS ล่าสุดระบุ age boundary ของ Tournament ให้คำนวณ ณ **วันปิดรับสมัคร** (`registration_end`) สำหรับ Hard Filter

ถ้า team ต้องการเปลี่ยนไปใช้ `event_start_date` ต้องยืนยันผ่าน change process; implementation ที่คำนวณต่างจากข้อนี้ถือเป็น gap

## 10. Auto-deletion and Retention

- Tournament ที่ยัง private จนถึง event date ต้องเข้า auto-deleted/inactive state ตาม SRS policy
- Tournament/Match/Result transaction data มี retention policy 4 ปีหลัง Tournament จบ ตาม SRS/SDS
- User และ historical participating Team identity ไม่ควรถูกลบเพียงเพราะ Tournament retention หมดอายุ

## 11. Acceptance Criteria

- ไม่มี public route ที่สร้าง Tournament โดยข้าม Admin approval
- ordinary user ไม่สามารถ discover private Tournament ได้
- publish fail เมื่อ bracket/schedule/referee readiness ไม่ผ่าน
- application fail เมื่อ registration ไม่เปิดหรือ capacity เต็ม
- material amendment ถูก revalidate กับ approved teams/bracket/schedule/referee readiness
