# FE ตอบ `TO-FE-2026-10-08-breaking-changes-round7.md` (ฉบับแก้ 27 ต.ค.)

**ถึง** กฤษณ์ (BE, `BE_KN`)
**จาก** FE (slice 3/4)
**วันที่** 28 ต.ค. 2569

**สรุป** ทั้ง 4 ข้อ + FE-39 ทำครบแล้วฝั่ง FE และ**ลองบนหน้าเว็บจริงแล้ว**
ไม่มีข้อไหนต้องให้ BE แก้เพิ่ม · มีคำขอเล็ก ๆ 2 ข้อท้ายไฟล์ (ไม่ด่วน ไม่ breaking)

---

## ทดสอบบนอะไร

- branch `Final_Present` @ `eeef1a3` (รวม `BE_KN` ถึง migration 052) + ข้อมูลเดโม `database/demo-seed.sql`
- ก่อนทดสอบ: `npm run migrate` → applied `051`, `052` · audit-roles C1–C8 ไม่เจอเคส
- ยิงผ่านหน้าเว็บจริง (Vite + backend dev) ไม่ใช่ยิง SQL

## ผลรายข้อ

| ข้อ | ฝั่ง FE | ผลบนหน้าเว็บ |
|---|---|---|
| 🔴 ① `pickem-leaderboard` แบ่งหน้า | `getPickemLeaderboard(id, page, pageSize)` ส่ง `?page=&pageSize=` · `PickemLeaderboardPanel` อ่าน `pagination` + แสดง `#{rank}` จาก server | `/t/9/community` ขอ `?page=1&pageSize=20` → 200 · ขึ้น "Page 1 of 1 · 3 players" · ยิงตรง `pageSize=2` หน้า 2 ได้ `rank: 3` (อันดับทั้งทัวร์ ไม่นับใหม่ในหน้า) ✅ |
| 🔴 ② สมัคร 2 ขั้นสำหรับ `@ku.th` | `isKuEmail()` เทียบโดเมนหลัง `@` ทั้งก้อน · ขั้นสองเป็นหน้าจอ FE ล้วน · มีข้อความเตือน "Email cannot be changed after registration." | `@ku.th` → ปุ่ม "Next: Student details" → ขั้นสองโหลดคณะได้ · **ไม่มีคำขอ `/auth/register` จนกดสร้างจริง** · `@notku.th` / `@gmail.com` → สร้างบัญชีขั้นเดียว ✅ |
| 🟡 ③ แจ้งเตือน 2 ชนิดใหม่ | `tournament_auto_delete_warning` → หมวด Critical (ปิดไม่ได้) · `tournament_auto_deleted` → หมวด Tournament updates · มีชื่อ + ไอคอน | ใส่แถวทดสอบชั่วคราวให้ `org1` แล้วลบทิ้ง: ขึ้นถูกหมวด · กด Open ไป `/t/1` · หน้า `/me` สวิตช์ Critical "always on" กดไม่ได้ ✅ |
| ⚪ ④ ทีม/ทัวร์หายช้าได้ถึง 1 ชม. | ไม่ต้องแก้ | รับทราบ — บันทึกไว้ในเอกสารถึงทีม FE ว่าไม่ใช่บั๊ก |
| ✅ FE-39 `GET /admin/amendment-requests/:id/impact` | `AmendmentApprovalDialog` อ่าน impact ก่อนกดยืนยัน · แสดง `blockers[]` · `selfRequested` · ปุ่มยืนยันปิดเมื่อ `canApprove` ไม่จริง · กดแล้วพังก็ refetch impact | `admin@ku.th` → Rule changes → เปิดหน้าต่างยืนยัน → ยิง impact 200, `canApprove: true` → **กด Cancel ไม่ได้อนุมัติจริง** คำขอยัง pending ✅ |
| ✅ fixture 9054 | — | รับทราบ ใช้ตอนกลับไปข้อมูล QA (`docker compose up -d minio-init` หนึ่งครั้ง) · ไม่อัปไฟล์ให้ 9053 |

**ที่ยังไม่ได้ลอง (ข้อมูลเดโมไม่มีเคส):** เลื่อนหน้าตารางอันดับจริงบนจอ (ต้องมีคนทายเกิน 20 คน) · สร้างบัญชีจริง + OTP · impact ที่มี blocker

---

## 🙋 ขอ 2 ข้อ (ไม่ด่วน)

**1. `database/demo-seed.sql` อยู่ที่ migration 050 แต่โค้ดใน `Final_Present` ไปถึง 052 แล้ว**
ใครโหลดข้อมูลเดโมแล้วเปิด backend ทันทีโดยไม่ migrate จะขาด 051/052 (`tournament_auto_delete_warning`, `user_type` จาก admin scope)
ขอ dump ใหม่ที่ 052 หรือเพิ่มบรรทัดใน `DEPLOY.md` ข้อ 4 ว่าต้อง `npm run migrate` หลังโหลด

**2. ข้อความ error / แจ้งเตือนจาก BE เป็นภาษาไทย ขณะที่ UI ส่วนใหญ่ยังเป็นอังกฤษ**
ทีมกำลังตัดสินว่า UI จะเป็นภาษาเดียว (คุณเอนไปทางไทย) — ไม่ต้องเปลี่ยนอะไรตอนนี้
ขอแค่ยืนยันว่า **ทุก error ยังมี `code` คงที่** (FE จะแปลจาก `code` ไม่จับคู่จากเนื้อความ `message`) และถ้าจะเปลี่ยนชื่อ `code` ไหน ช่วยแจ้งล่วงหน้า
