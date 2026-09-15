# 04 — Teams and Applications

**Status:** Current  
**Last reviewed:** 2026-09-15

## 1. Team Model

Team ถูกสร้างแยกจาก Tournament และใช้สมัครหลาย Tournament ได้ตาม eligibility/schedule rules

ประเภทเชิงองค์กร:

- **Unofficial Team** — ไม่ต้อง Admin approve
- **Official Team** — ต้องผ่าน Admin approval

Readiness:

```text
Forming → Ready
```

Ready หมายถึงสมาชิกครบตาม sport roster rule และสมาชิกที่จำเป็นตอบรับแล้ว ไม่ได้หมายความว่า Team ถูก approve เข้า Tournament แล้ว

## 2. Team Membership Rules

- Team creator เป็น Team Leader
- invitation ต้องมี explicit response
- pending invitation ไม่นับเป็น confirmed roster
- User อยู่ Unofficial Team ได้สูงสุด 5 ทีมตาม SRS BR-05
- User อยู่ Official Team ได้สูงสุด 1 ทีมต่อ sport
- Official Team leader transfer ต้องผ่าน Admin approval
- Team ที่เริ่มแข่งขันแล้วห้าม hard-delete; ใช้ withdrawal/archive/history-preserving flow

## 3. Team Lifecycle Aging

ตาม SRS:

- Unofficial Team ต้องยื่น Tournament application ครั้งแรกภายใน 14 วันหลังสร้าง
- หลังมีประวัติแข่งขันแล้ว หากไม่มี activity ตามช่วง policy 6 เดือน ระบบสามารถทำให้ inactive/archive ตาม lifecycle rule

งาน background/notification ที่ใช้บังคับกฎนี้เป็น implementation requirement

## 4. Tournament Application

การสมัคร Tournament ใช้ **existing Ready Team เท่านั้น**; ไม่มี individual registration สำหรับ head-to-head MVP

Flow:

```text
Team Leader selects public/open Tournament
→ submit Team application
→ system Hard Filter
→ pending Organizer review
→ Organizer Soft Filter
→ approved | rejected
```

ก่อน accept application ต้องตรวจ:

- Tournament public และ registration เปิด
- Team Ready
- Team ยังไม่เคยสมัคร Tournament นี้ใน active application state
- capacity ยังไม่เต็ม
- Hard Filter ผ่าน

## 5. Hard Filter

Hard Filter เป็น system decision และต้องแสดง failure เป็นรายสมาชิก/ราย rule

อย่างน้อยครอบคลุมตาม SRS/SDS:

- gender requirement
- age
- year
- faculty / department เมื่อกำหนด
- roster-related eligibility ที่เป็น hard rule

Age ใช้ boundary ตาม [03-tournaments.md](03-tournaments.md): วันปิดรับสมัคร จนกว่าจะมี explicit change decision

## 6. Soft Filter

Soft Filter เป็น Organizer decision จากข้อมูล/เอกสารเพิ่มเติม

- approve หรือ reject ต้องมี actor/timestamp
- rejection ต้องมีเหตุผลที่ Team Leader เห็นได้
- document access ต้องใช้ object-storage access control ไม่ expose raw private data สาธารณะ

## 7. Cancellation and Withdrawal

- Pending application: Team Leader ยกเลิกได้
- Approved application: Team Leader ถอนตัวได้ตาม policy
- ถอนตัวต้องคืน capacity และแจ้ง Organizer
- เพราะ bracket skeleton มีอยู่ก่อน registration การถอนตัว **ไม่จำเป็นต้อง rebuild topology โดยอัตโนมัติ**; ต้อง update participant slot/BYE state ตาม bracket rules

ข้อความ legacy ที่บอกว่า “withdraw หลังสร้าง bracket ต้องจัดสายใหม่” ถูก supersede ในส่วน topology แต่การ reseed/reassignment ของทีมที่เหลือยังต้องทำตาม policy ที่ทีมกำหนด

## 8. Capacity Concurrency

การ approve application ที่ช่องสุดท้ายต้อง atomic/concurrency-safe เพื่อไม่ให้ approved teams เกิน `maxTeams`

การลด `maxTeams` ผ่าน amendment ห้ามต่ำกว่าจำนวน approved teams

## 9. Match Slot Placement

หลัง Team application ถูก finalized สำหรับการแข่งขัน:

- Team ถูกวางลง participant slot ที่ว่างตาม seeding/draw rule
- bracket topology ไม่เปลี่ยนเพียงเพราะ entrants ไม่เต็ม capacity
- empty slot ใช้ BYE/unused semantics ตาม format

Exact seeding timing และการ reseed หลัง withdrawal อยู่ใน [OPEN_DECISIONS.md](OPEN_DECISIONS.md) หากยังไม่มีมติที่ชัดเจน

