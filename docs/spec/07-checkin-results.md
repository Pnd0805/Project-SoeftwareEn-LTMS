# 07 — Check-in and Results

**Status:** Current  
**Last reviewed:** 2026-09-15

## 1. Participant Verification

Player ที่จะลง Match ต้องอยู่ใน approved roster ของ Team ที่อยู่ใน Match นั้น

### On-site

- Player login ด้วย account ตนเอง
- ใช้ QR/check-in flow ของ Match
- ระบบตรวจว่า Player อยู่ใน approved roster ของ Match
- Referee ตรวจรายชื่อและ identity ตามหน้างาน
- duplicate/wrong-match/out-of-window check-in ต้องถูกปฏิเสธด้วยเหตุผล

### Online

- Player ส่ง identity evidence ตาม Tournament rule
- evidence เก็บใน private object storage
- assigned Referee ตรวจและ approve/reject
- evidence access จำกัดเฉพาะ authorized Referee/Admin

เมื่ออุปกรณ์/อินเทอร์เน็ตขัดข้อง Referee สามารถใช้ manual verification เป็น exception ที่ต้องบันทึกได้

## 2. Check-in State

Check-in เปิดตาม configured window ของ Match

ระบบต้องแยก:

- not checked in
- verified/success
- rejected/ineligible
- recorded exception เมื่อมี manual fallback

Match ห้ามเริ่มด้วย participant state ที่ไม่ผ่าน minimum rule ของ sport/tournament

## 3. On-Site Result Flow

On-site / physical-sport Match ต้องมี active Referee อย่างน้อย 2 คน โดยเป็นคนละคนกันและครอบคลุมอย่างน้อย:

- **Match Referee / Adjudicator** — ตัดสินการแข่งขันและจัดการเหตุการณ์เชิงกติกา
- **Score / Statistics Referee** — บันทึกคะแนน สถิติ และข้อมูลการแข่งขัน

กฎสองคนนี้เป็น minimum staffing rule และไม่แทนที่ two-party result confirmation ระหว่าง Referee side กับ winning Team Leader ตาม result flow เดิม

```text
Referee submits score/result/statistics
→ result submitted
→ winning Team Leader reviews
→ Team Leader confirms or disputes
→ verified
```

on-site Match ทุก Match ต้องผ่าน referee-count และ responsibility-coverage rule ตาม [05-referees.md](05-referees.md)

## 4. Online Result Flow

Online / e-sport Match ต้องมี active Referee อย่างน้อย 1 คน; Referee คนเดียวสามารถทำ operational referee duties ของ Match นั้นได้ เว้นแต่ Tournament/Sport กำหนดจำนวนมากกว่านี้

```text
winning Team Leader submits result/evidence
→ result submitted
→ assigned Referee reviews
→ Referee confirms or disputes/rejects
→ verified
```

Actor เดียวกันห้ามทำทั้งสอง required confirmation sides

## 5. Validation

ก่อนรับ result ระบบต้องตรวจอย่างน้อย:

- Match อยู่ใน state ที่รับ result ได้
- submitter มี role/scope ที่ถูกต้อง
- winner อยู่ใน Match
- score structure สอดคล้อง Sport Definition
- tie ถูกปฏิเสธเมื่อ sport rule ต้องมี winner
- required referee state/assignment ผ่าน

## 6. Dispute

เมื่อมี dispute:

- verified transition ต้องหยุด
- เก็บ reason/evidence/requester
- Organizer เป็นผู้ resolve ตาม SRS baseline; Admin override ได้ตาม governance policy
- resolution ต้อง audit ได้
- หากต้อง submit result ใหม่ต้องรักษาประวัติเดิม ไม่ overwrite แบบไร้ร่องรอย

## 7. Atomic Verification

เมื่อ result verified ระบบต้องทำเป็น logical transaction:

- mark verified result
- resolve Match winner
- update bracket progression
- update standings
- update player/team statistics
- update dependent public data
- create required audit/notifications

ถ้าส่วน critical ใดล้มเหลว ห้าม expose state ที่ result verified แต่ bracket/standing ยังไม่ตรงกัน

## 8. Public Result Semantics

Public UI ต้องแยก provisional/submitted/disputed ออกจาก verified result อย่างชัดเจน

เฉพาะ verified result เท่านั้นที่:

- advance bracket
- update historical statistics
- update leaderboard/standing ที่ถือเป็น official
- close Pick'em scoring

## 9. Completion

Tournament completion ต้องอาศัย required Matches มี final competition outcome ครบ รวม verified result หรือ explicit BYE/walkover/cancellation outcome ตาม format/policy
