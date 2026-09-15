# 06 — Brackets and Matches

**Status:** Current  
**Last reviewed:** 2026-09-15

## 1. Supported Competition Formats

Current head-to-head formats:

- Single Elimination
- Double Elimination
- Round Robin

Bracket/seeding algorithm ต้องอยู่ในโมดูลที่ทดสอบแยกได้และไม่ผูกกับ HTTP layer

## 2. Pre-Created Bracket Skeleton — Current Team Decision

Bracket topology ถูกสร้างระหว่าง `private preparation` **ก่อน Tournament public และก่อนรู้จำนวนทีมสุดท้าย**

Input หลัก:

- `bracketFormat`
- `maxTeams`
- planned event schedule constraints

Bracket skeleton กำหนด:

- participant slots
- rounds/groups
- Match nodes
- winner/loser progression links ตาม format
- planned Match time ranges
- planned venue/channel
- Match operational mode (`online` / `on-site`) ที่ใช้ derive referee staffing requirement

Team IDs ใน slot สามารถ `NULL` ได้จนกว่าจะรู้ accepted entrants

## 3. Why the Skeleton Exists Before Registration

Tournament public หมายถึงรายการผ่าน readiness check และพร้อมให้ผู้เล่นสมัคร

การมี topology และ schedule ล่วงหน้าทำให้ระบบสามารถ:

- แสดงจำนวน Match/ช่วงเวลาโดยประมาณที่แน่นอนตาม capacity
- ตรวจ venue/time conflicts ก่อน publication
- คำนวณ peak concurrent referee demand ก่อน publication
- เชิญ/เตรียม Referee ใน private Tournament

Referee demand ของแต่ละ Match derive จาก mode:

```text
online  → minimum 1 active referee
on-site → minimum 2 active referees
```

จึงต้องรู้ Match mode ก่อน publication readiness calculation

## 4. Filling Entrants

เมื่อ applications ถูก approve/finalize ระบบนำ Teams ไปใส่ใน participant slots ตาม seeding/draw policy

Topology ไม่ต้อง regenerate เพียงเพราะจำนวนทีมจริงน้อยกว่า `maxTeams`

## 5. Empty Slots and BYE

Current team decision สำหรับ elimination-style progression:

- slot ที่ไม่มี Team ถือเป็น BYE/empty entrant
- Team ฝั่งตรงข้ามผ่านไปตาม progression rule โดยไม่ต้องเล่น Match จริง
- BYE ต้องไม่สร้าง fake Result/statistics
- downstream slot ต้อง resolve deterministically

Exact semantics ของ Round Robin empty slots และ Double Elimination edge cases อยู่ใน `OPEN_DECISIONS.md` หาก algorithm ยังไม่ได้ finalize

## 6. Match Time Range

ทุก planned Match ที่ใช้ในการ readiness calculation ต้องมี **ช่วงเวลา** ไม่ใช่เพียง start timestamp

Canonical product requirement คือมี:

- `scheduled_time` — เวลาเริ่ม
- `scheduled_end_time` — เวลาสิ้นสุด

Overlap calculation ใช้ interval `[scheduled_time, scheduled_end_time)` ดังนั้น Match ที่จบตรงเวลาเดียวกับอีก Match เริ่มไม่ถือว่า overlap กัน

## 7. Schedule Conflict Rules

ก่อนบันทึก initial/private schedule ต้องตรวจอย่างน้อย:

- venue เดียวกันใช้ซ้อนเวลาไม่ได้ ถ้า venue เป็น exclusive resource
- Team เดียวกันไม่ควรมี Match overlap เมื่อ Team ถูกเติมแล้ว
- Referee assignment ใหม่ต้องไม่ overlap กับ assignment ที่ accepted อยู่

เมื่อ schedule เปลี่ยนภายหลัง:

- affected actors ต้องถูกแจ้ง/warn
- Referee conflict จาก schedule edit ไม่ถูกแก้ด้วย silent reassignment
- exact block-vs-warning policy สำหรับแต่ละชนิด conflict อยู่ใน Open Decisions ถ้าไม่มี team decision

## 8. Match Lifecycle

Conceptual lifecycle:

```text
planned/scheduled
→ check-in open
→ in progress
→ result submitted
→ disputed | verified
→ completed
```

Storage enum อาจรวม/แยก state มากกว่านี้ได้ แต่ UI/API ต้องไม่ทำให้ provisional result ดูเหมือน verified result

## 9. Bracket Progression

เฉพาะ verified/confirmed competition outcome เท่านั้นที่เปลี่ยน progression

Outcome อาจเป็น:

- verified Match winner
- BYE progression
- explicit walkover/administrative outcome ตาม approved rule

การ update result + bracket progression + standings/statistics ที่เกี่ยวข้องต้องเป็น logical atomic operation

## 10. Public Views

Guest/User ต้องดูได้อย่างน้อย:

- bracket structure
- Team/TBD/BYE slot state
- schedule
- Match status
- verified result

Private preparation data เปิดให้เฉพาะ authorized Organizer/Admin/Referee ตาม scope ที่จำเป็น

## 11. Superseded SRS/SDS Behavior

ข้อความเดิมที่กำหนด:

```text
registration closed
→ generate bracket from approved teams
→ schedule matches
```

ถูก supersede ในส่วน **การสร้าง topology และ initial schedule**

สิ่งที่ยังเกิดหลัง/ระหว่าง registration คือการเติม Team ลง slot, final seeding/placement และ handling ของ empty slots ไม่ใช่การสร้าง topology จากศูนย์
