# 13 · Admin Hierarchy (C2) — สรุปให้ทีมอ่าน

> เขียน 22 ก.ย. 2569 · สถานะ: **เขียนโค้ดเสร็จ + typecheck ผ่าน + vitest เดิม 872 tests ไม่พัง — ยังไม่ได้ยิง HTTP จริงทดสอบ** (MySQL dev ล่มระหว่างทำ) ก่อน merge ต้องทดสอบให้ครบก่อน

## 1. ปัญหาตั้งต้น (C2 — FR-UM-05)

Login ปฏิเสธ `is_suspended` (`403 ACCOUNT_SUSPENDED`) อยู่แล้ว แต่ไม่มีทางที่ใครจะไปตั้งค่านั้นได้จริง — `admin_scopes` ใส่ได้แค่ผ่าน seed มือ ไม่มี endpoint ระงับผู้ใช้ ไม่มี endpoint แต่งตั้งแอดมิน และ `audit_logs` มีการเขียนอยู่แล้ว (`tournament.repo.ts`, `walkover.repo.ts`, `matchResult.repo.ts`) แต่ไม่มีใครอ่านได้เลย

## 2. โครงสร้างสิทธิ์แอดมิน — เปลี่ยนจาก 2 ชั้นเป็น 3 ชั้น

เดิมออกแบบไว้แค่ `faculty` / `university_wide` ระหว่างทางเปลี่ยนใจเป็น **3 ชั้น** เพราะไม่อยากให้แอดมินระดับเดียวกันแต่งตั้งกันเองได้ (เสี่ยงตั้งพวกพ้องไม่มีที่สิ้นสุด):

| ระดับ | จำนวน | Scope | แต่งตั้ง/ถอนใครได้ | ทำงานประจำวันได้ไหม |
|---|---|---|---|---|
| **Root** (`scope_type='root'`) | **1 คนเท่านั้นในระบบ** | ทั้งระบบ | University Admin เท่านั้น | **ไม่ทำเลย** — suspend/approve/reject ทำไม่ได้ (บล็อกไว้ในโค้ด) |
| **University Admin** (`university_wide`) | หลายคนได้ | ทั้งมหาวิทยาลัย | Faculty Admin เท่านั้น (แต่งตั้ง university_wide คนอื่นไม่ได้) | ได้ — suspend/approve/reject ทุกอย่างเหมือนเดิม |
| **Faculty Admin** (`faculty`) | หลายคนได้ต่อคณะ | คณะตัวเอง | **แต่งตั้งใครไม่ได้เลย** | ระงับ user ธรรมดาในคณะตัวเองได้อย่างเดียว — แตะแอดมินคนอื่น (ทุกระดับ) ไม่ได้แม้แต่คณะเดียวกัน |

**Root มีหน้าที่แค่**: แต่งตั้ง/ถอน University Admin · ดู `audit_logs`/`admin_scopes` ทั้งหมด · เป็นกลไก recovery เวลา hierarchy มีปัญหา (เช่น University Admin เหลือ 0 คนเพราะระงับกันเอง — Root แต่งตั้งใหม่ได้เสมอ) — **ไม่แตะงานประจำวันเลย** โค้ดบล็อกไว้ตรงๆ (`assertNotRoot()`) ไม่ใช่แค่ข้อตกลง

**ทำไมห้ามแต่งตั้งระดับเดียวกัน**: ถ้า University Admin แต่งตั้ง University Admin คนอื่นได้ ก็ไม่มีเพดานว่าใครควบคุมใคร — Root เป็นจุดกำเนิดอำนาจจุดเดียวที่ตรวจสอบได้ (audit log ทุกการแต่งตั้งมี `created_by`) และเพราะ Root ไม่ทำงานประจำวัน จึงไม่มีแรงจูงใจจะใช้อำนาจแต่งตั้งพร่ำเพรื่อ

## 3. Root สร้างยังไง — **ไม่มี API สร้าง Root เด็ดขาด**

`POST /admin/scopes` รับแค่ `scopeType: 'faculty' | 'university_wide'` เป็น input โดยโครงสร้าง (schema ไม่รับ `'root'` เข้ามาแม้แต่ตัวเลือก) — จะมี Root ได้ต้อง `INSERT` ตรงเข้า DB ผ่าน seed/deployment เท่านั้น ไม่มีใครในระบบ promote ตัวเองเป็น Root ได้

Dev/test เพิ่ม user `9099 Root ระบบ` (`scope_type='root'`) ไว้ใน `seed-test.sql` แล้ว — **โปรดักชันต้องตัดสินใจเองว่าจะ bootstrap root คนแรกตอน deploy ยังไง** (ยังไม่ได้ตัดสินใจในรอบนี้ ต้องคุยกับทีม infra)

## 4. Endpoints ทั้งหมด (C2)

| Endpoint | ใครเรียกได้ | ทำอะไร |
|---|---|---|
| `GET /admin/users?q&facultyId&suspended&page` | University Admin, Faculty Admin (เห็นแค่คณะตัวเอง) | ค้นหา/กรองผู้ใช้ พร้อม `adminScope` ติดมาถ้ามี |
| `PATCH /admin/users/:id/suspend` | University Admin, Faculty Admin (คณะตัวเอง) | ระงับ/เลิกระงับ — `reason` บังคับตอนระงับ · เช็คห้ามระงับตัวเอง, ห้ามระงับคนมีทัวร์ public/ใบสมัคร approved ค้าง (`409`), ห้ามระงับ University Admin คนสุดท้าย (`409`) |
| `GET/POST /admin/scopes`, `DELETE /admin/scopes/:id` | ตามตารางข้อ 2 | แต่งตั้ง/ถอนสิทธิ์แอดมิน — กัน revoke ตัวเอง, กัน revoke root ผ่าน API |
| `GET /admin/audit-logs?entityType&entityId&userId&actionType&page` | Root, University Admin | ดูประวัติการกระทำทั้งระบบ (join ชื่อผู้กระทำมาให้) |
| `POST /users/:id/report` | user ทุกคน | **ใหม่** — แจ้งเรื่องขอระงับ user/แอดมินคนอื่น (ดูข้อ 5) |
| `GET/POST /admin/user-reports/...` | University Admin, Faculty Admin (ตามเป้าหมาย) | ดู/อนุมัติ/ปฏิเสธคำร้องที่มีคนแจ้งเข้ามา |

## 5. ฟีเจอร์ใหม่ที่เพิ่มเข้ามา — `user_reports` (user ธรรมดาแจ้งเรื่องได้)

เดิม C2 ออกแบบไว้ให้ "แอดมินสั่งระงับตรงๆ" เท่านั้น — เพิ่มช่องทางให้ **user ทั่วไปก็ยื่นคำร้องขอระงับคนอื่นได้** (ตาราง `user_reports` ใหม่ ยังไม่มีมาก่อน ต้อง `CREATE TABLE`):

```sql
CREATE TABLE user_reports (
  user_report_id INT PRIMARY KEY AUTO_INCREMENT,
  reported_by INT NOT NULL,       -- ผู้แจ้ง
  target_user_id INT NOT NULL,    -- ผู้ถูกแจ้ง (user หรือ admin ก็ได้)
  reason TEXT NOT NULL,           -- บังคับเสมอ
  evidence JSON NULL,             -- array ของ S3 key รูป/ไฟล์หลักฐาน ไม่บังคับ
  user_report_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by INT NULL, reviewed_at DATETIME NULL, rejection_reason TEXT NULL,
  ...
);
```

**เส้นทางคำร้องไปหาใคร (routing อัตโนมัติ ไม่ต้องเลือกเอง):**
- แจ้ง **user ธรรมดา** → ไปเข้าคิวของ Faculty Admin ของคณะที่ target สังกัด (University Admin เห็นทุกคำร้องอยู่แล้ว)
- แจ้ง **แอดมิน** (ทุกระดับ) → ไปเข้าคิว **University Admin เท่านั้น** (Faculty Admin เห็นไม่ได้เลย เพราะแตะแอดมินไม่ได้อยู่แล้ว)
- **แอดมินที่ถูกแจ้งพิจารณาคำร้องเรื่องตัวเองไม่ได้** — เช็คตรง ๆ ว่า `target_user_id === ผู้อนุมัติ` ถ้าตรงกัน `403`

**อนุมัติคำร้อง = เรียกกลไกเดียวกับ `PATCH /admin/users/:id/suspend` เป๊ะ** (ฟังก์ชันภายในชื่อ `performSuspend`) ไม่ใช่ path แยก — แปลว่าเช็คภาระค้าง/กัน University Admin เหลือ 0 คน/กัน Faculty Admin แตะแอดมิน ใช้กฎเดียวกันหมดไม่มีช่องโหว่แยก

## 6. สิ่งที่ยังไม่ตัดสินใจ / ยังไม่ทำ

- **Root bootstrap ใน production** — ยังไม่มีมติว่าจะทำตอน deploy ยังไง (seed ตรง / env var / สคริปต์แยก)
- **เพดานจำนวนแอดมิน** (`เช่น max 3-5` University, `max 5 ต่อคณะ` Faculty) — สเปกใช้คำว่า "เช่น" ไม่ใช่ตัวเลขตายตัว ยังไม่ได้ implement การบังคับเพดานจริง
- **`LAST_UNIVERSITY_ADMIN` floor** (ห้ามระงับ/ถอน University Admin คนสุดท้าย) — ของเดิมที่มีอยู่แล้ว **ไม่ได้เอาออก** แม้ตอนนี้ Root เป็น recovery mechanism ได้แล้วก็ตาม (ยังไม่ตัดสินใจว่าจะเอาออกไหม เก็บไว้ก่อนเพราะปลอดภัยกว่า)
- **ทดสอบ HTTP จริง** — ยังไม่ได้ทำเพราะ MySQL dev ล่ม ต้องทำก่อน merge
