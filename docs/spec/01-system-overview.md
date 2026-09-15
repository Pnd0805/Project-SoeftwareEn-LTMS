# 01 — System Overview

**Status:** Current  
**Owner:** Whole Team / Design  
**Last reviewed:** 2026-09-15

## 1. Product Purpose

LTMS เป็นเว็บแอปสำหรับจัดการวงจรการแข่งขันกีฬาภายในองค์กร ตั้งแต่ขออนุญาตจัดการแข่งขัน จัดทีม สมัครแข่งขัน เตรียม bracket/schedule/referee เช็คอิน บันทึกและยืนยันผล จนถึงเผยแพร่ผลและสถิติ

ระบบเป็น **system of record สำหรับข้อมูลการแข่งขัน** แต่ไม่ตัดสินผลกีฬาเองและไม่บริหารการจองสนามจริง

## 2. In Scope

- Tournament approval โดย Admin
- Team creation, Team invitation, Official/Unofficial Team
- Tournament registration ผ่าน existing Team เท่านั้น
- Hard Filter และ Soft Filter
- Single Elimination, Double Elimination, Round Robin
- pre-created bracket skeleton และ planned match schedule
- Referee management, external referee approval และ match assignment
- on-site QR check-in และ online identity evidence
- two-party result verification + dispute
- bracket/standing/statistics update
- public viewing, dashboard, leaderboard และ YouTube embed
- engagement features ตาม delivery phase

## 3. Out of Scope

- payment / registration fee
- procurement / budgeting
- native iOS/Android application
- automated game/referee decision from video
- LTMS-owned streaming infrastructure
- direct university registry / SSO integration ใน phase ปัจจุบัน
- physical venue reservation system
- gambling หรือ cash-equivalent Pick'em

## 4. System Roles

ระบบใช้สองระดับของ role:

- **System-level:** Guest, User, Admin
- **Context-level:** Team Leader, Organizer, Referee

Player ไม่ใช่ role เพิ่มเติม แต่เป็น User ที่อยู่ใน approved roster ของ Match

รายละเอียด permission ดู [02-roles-permissions.md](02-roles-permissions.md)

## 5. Architectural Boundary

LTMS ใช้สถาปัตยกรรมสามชั้น:

```text
Browser Client
    ↓ HTTPS/JSON + JWT
Application & API Server
    ↓
Amazon RDS / Object Storage / external media services
```

Current canonical data architecture คือ **Amazon RDS สำหรับข้อมูลเชิงสัมพันธ์ทั้งหมดรวม bracket structure**; MongoDB references ใน legacy spec เป็นข้อมูลเก่าและไม่ใช่ current architecture

Frontend ห้ามเข้าถึง database โดยตรง ทุก write/read ที่ต้องการ business rule ต้องผ่าน API Server

## 6. Current Product Phases

### Tournament phase

```text
pending approval
→ private preparation
→ public (registration open/closed เป็น sub-state/control)
→ in progress
→ completed
```

Rejected และ auto-deleted เป็น terminal/alternative state

Storage implementation อาจใช้ enum + boolean ต่างจากชื่อด้านบนได้ แต่ behavior ต้องรักษาความหมายของ phase เหล่านี้

### Team phase

```text
Forming → Ready → Competing / Inactive / Archived
```

ทีมต้อง Ready ก่อนใช้สมัคร Tournament

### Application phase

```text
Pending → Approved | Rejected | Cancelled
Approved → Withdrawn
```

### Match phase

Conceptual lifecycle:

```text
planned/scheduled
→ check-in
→ in progress
→ result submitted
→ disputed or verified
→ completed
```

## 7. Central Invariants

1. Tournament ต้องได้รับ Admin approval ก่อนเข้าสู่ `private`
2. Organizer permission ผูกกับ Tournament ไม่ใช่ global role
3. Public tournament ต้องผ่าน readiness check ก่อนผู้เล่นทั่วไปใช้ registration flow
4. Bracket structure และ planned schedule ถูกสร้างใน private preparation ตาม `maxTeams` และ `bracketFormat`
5. Accepted teams เติมลงใน pre-created participant slots ภายหลัง
6. การสมัครแข่งขันใช้ Team ที่สร้างไว้ล่วงหน้าเท่านั้น
7. External Referee ยังไม่ active จนกว่าจะได้รับ Admin approval
8. ผลการแข่งขันมีผลต่อ bracket/statistics ได้หลัง required confirmations เท่านั้น
9. Frontend state ไม่สามารถแทน server authorization ได้
10. การอนุมัติ ผลแข่งขัน ข้อพิพาท และการเปลี่ยนข้อมูลสำคัญต้อง audit ได้

## 8. Data Ownership

- User/Team/Tournament/Match/Result/Audit metadata: RDS
- temporary identity evidence / uploaded documents: object storage ผ่าน object key/presigned access
- livestream/replay: YouTube URL/embed เท่านั้น
- secrets/passwords: ไม่เก็บ plaintext และห้าม log

## 9. Historical Sources

SRS/SDS ยังคงเป็น formal requirement/design documents ของรายวิชา แต่เมื่อมีมติทีมหลังเอกสารดังกล่าวและถูก promote เข้า `docs/spec/*` แล้ว ให้ Current Spec เป็น behavior reference ของการพัฒนา และ sync กลับ SRS/SDS ในรอบเอกสารต่อไป

