# 08 — Engagement and Public Features

**Status:** Current by delivery phase  
**Last reviewed:** 2026-09-15

## 1. Public Viewing — MVP

Guest ต้องดู public information ได้โดยไม่ login อย่างน้อย:

- Tournament list/detail
- bracket
- schedule
- Match state
- verified results
- Tournament dashboard / standings ที่อยู่ใน MVP
- YouTube livestream embed/link เมื่อ Organizer ตั้งไว้

Private Tournament และ private evidence ห้ามรั่วผ่าน public endpoints

## 2. Announcements

Organizer สามารถสร้างประกาศ Tournament และ schedule/venue change ตาม phase ที่รองรับ

announcement ที่มีผลต่อ participant ต้องแสดงบน Tournament และส่ง notification ตาม capability ที่เปิดใช้

## 3. Notifications — Sprint #1

ระบบ notification ควรรองรับ event สำคัญ เช่น:

- Team invitation/response/removal
- application decision/withdrawal
- Tournament approval/publication/registration state
- external Referee approval
- schedule/venue change
- check-in window
- referee assignment/change request
- result submission/dispute/verification

ผู้ใช้เปิด/ปิด notification category ได้ แต่การปิด preference ไม่ควรลบ notification history ที่ระบบจำเป็นต้องเก็บ

## 4. Community / Review / Feedback — Sprint #1

- signed-in User แสดงความคิดเห็น/review ตาม policy
- private feedback มองเห็นเฉพาะผู้เกี่ยวข้องที่ได้รับอนุญาต
- inappropriate content ต้อง report/moderate ได้
- moderation action ต้อง audit ได้เมื่อเป็น administrative removal

## 5. MVP Voting — Sprint #1

- User ที่ไม่ได้แข่งขันใน Tournament สามารถโหวตตาม configured voting window
- หนึ่งบัญชีหนึ่ง vote ต่อ Tournament
- exact organizer/conflict policy ดู `OPEN_DECISIONS.md`

## 6. Pick'em — Sprint #1

- User ทายผู้ชนะก่อน cutoff
- หลัง cutoff ห้ามเปลี่ยน/submit prediction
- verified result เท่านั้นที่ให้แต้ม
- ไม่มีเงินจริงหรือ cash-equivalent wagering
- entrant/assigned Referee/conflicted actor ต้องถูก block ตาม conflict policy

## 7. YouTube

LTMS เก็บเฉพาะ URL/video identifier และ embed YouTube

- ไม่ ingest video
- ไม่ proxy stream
- YouTube unavailable ต้องไม่ทำให้ core Tournament/result flow fail

## 8. Badge / Achievement — Sprint #2

Badge/Achievement เป็น engagement enhancement ไม่ใช่ dependency ของ Tournament/Match core flow

## 9. Dashboards and Statistics

- Tournament dashboard aggregate เฉพาะ Tournament นั้น
- Athlete historical statistics ต้องมาจาก verified results เท่านั้น
- cross-sport leaderboard ห้ามรวม metric ที่เปรียบเทียบกันไม่ได้โดยไม่มี normalization ที่กำหนดชัด

