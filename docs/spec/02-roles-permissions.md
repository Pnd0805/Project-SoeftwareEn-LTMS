# 02 — Roles and Permissions

**Status:** Current  
**Last reviewed:** 2026-09-15

## 1. Role Model

### System-level roles

- **Guest** — ผู้ใช้ที่ยังไม่ login; อ่านเฉพาะ public information
- **User** — account ที่ login แล้ว
- **Admin** — ผู้กำกับดูแลและอนุมัติ; มี scope ตามระดับองค์กร

### Context-level roles

- **Team Leader** — ผู้ดูแล Team หนึ่งทีม
- **Organizer** — ผู้ดูแล Tournament ที่ Admin อนุมัติให้ตนจัด
- **Referee** — กรรมการที่ได้รับแต่งตั้งใน Tournament และ/หรือ Match

User คนเดียวสามารถมีหลาย context role พร้อมกันได้ถ้าไม่เกิด conflict of interest

## 2. Permission Matrix

| Action | Guest | User | Team Leader | Organizer | Referee | Admin |
|---|---:|---:|---:|---:|---:|---:|
| ดู Tournament/Bracket/Result สาธารณะ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| สร้าง Team | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| เชิญ/จัดการสมาชิก Team | — | — | own team | — | — | admin override |
| ยื่น Tournament request | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| อนุมัติ Tournament request | — | — | — | — | — | ✓ |
| แก้รายละเอียด Tournament | — | — | — | own tournament | — | scoped override |
| publish/unpublish/open/close registration | — | — | — | own tournament | — | governance override ตาม spec/API |
| สมัคร Tournament | — | — | own team | — | — | — |
| อนุมัติ/ปฏิเสธ Team application | — | — | — | own tournament | — | audit/override ตาม policy |
| เชิญ/จัดการ Referee | — | — | — | own tournament | — | approve external |
| จัด bracket/schedule | — | — | — | own tournament | — | override ตาม policy |
| check-in/identity verification | — | player action | — | operational fallback | assigned match | admin override |
| submit result | — | — | online winner Team Leader | fallback only | on-site assigned match | emergency override |
| verify result | — | — | on-site winner Team Leader | dispute resolver | online assigned match | emergency override |
| resolve dispute | — | — | — | own tournament | — | override |

## 3. Scope Enforcement

Permission ต้องตรวจที่ server ทั้ง role และ resource scope เช่น:

- Organizer A แก้ Tournament B ไม่ได้
- Team Leader จัดการได้เฉพาะ Team ของตน
- Referee บันทึก/ยืนยันได้เฉพาะ Match ที่ตนมี operational assignment
- Faculty Admin ห้ามอนุมัติ resource นอก faculty scope ของตน

การซ่อนปุ่มใน UI ไม่ถือเป็น authorization

## 4. Admin Scope

SDS รองรับการกำกับดูแลระดับคณะและระดับส่วนกลาง/มหาวิทยาลัย แนวคิด canonical คือ:

- **Faculty-scoped Admin** — ดูแล resource ภายใน faculty ที่ตนรับผิดชอบ รวม department ใต้ faculty นั้น
- **University/Global Admin** — ดูแล resource ข้าม faculty ตามอำนาจที่กำหนด

ชื่อ enum จริงใน implementation สามารถเป็น `faculty`, `university_wide` หรือชื่อเทียบเท่าได้ แต่ semantic scope ต้องตรงกัน

## 5. Organizer

- Organizer เกิดจากการอนุมัติ Tournament request
- role ผูกกับ `tournament_id`
- Organizer จัดการ Tournament config, registration, applications, bracket/schedule, referee และ announcements
- material changes ที่กระทบ eligibility/date/capacity ต้องผ่าน Admin review ตาม [03-tournaments.md](03-tournaments.md)

## 6. Referee

- Referee ต้องถูก Organizer invite/appoint ก่อน
- internal referee active ได้เมื่อตอบรับตาม flow ที่กำหนด
- external referee ต้องมี Admin approval เพิ่มเติมก่อนถือเป็น **active operational referee**
- match-level permission ต้องอ้าง assignment ของ Match นั้น ไม่ใช่แค่เป็น Tournament Referee
- Match มี operational mode หลัก 2 แบบสำหรับ referee staffing:
  - **online / e-sport**: ต้องมี active Referee อย่างน้อย 1 คน
  - **on-site / physical sport**: ต้องมี active Referee อย่างน้อย 2 คนที่เป็นคนละคนกัน
- สำหรับ on-site Match อย่างน้อย 2 หน้าที่ต้องถูกครอบคลุม:
  1. **Match Referee / Adjudicator** — ทำหน้าที่ตัดสินการแข่งขันและจัดการเหตุการณ์เชิงกติกาหน้างาน
  2. **Score / Statistics Referee** — ทำหน้าที่บันทึกคะแนน สถิติ และข้อมูลการแข่งขัน
- หน้าที่สองแบบข้างต้นเป็น match-level responsibility ของ Referee role เดิม ไม่ใช่ system-level role ใหม่

## 7. Conflict of Interest

Current invariant:

- Referee ต้องไม่ใช่ผู้แข่งขันใน Match ที่ตน officiate
- Organizer/Team Leader/Referee ต้องไม่สามารถใช้สิทธิ์ operational เพื่ออนุมัติผลประโยชน์ของตนเอง
- ถ้าบทบาทซ้อนกันในกรณีที่ conflict policy ยังไม่ระบุ ให้ block หรือ escalate ไป Admin แทนการอนุญาตโดยเดา

รายละเอียด edge case ที่ยังไม่ล็อกอยู่ใน `OPEN_DECISIONS.md`

## 8. Audit

อย่างน้อย action ต่อไปนี้ต้อง audit ได้:

- Tournament approve/reject/amendment
- Official Team approve/reject/leader transfer
- external Referee approve/reject
- publication/unpublication ที่เปลี่ยน public visibility
- result verification/dispute resolution/correction
- account suspension
- administrative override
