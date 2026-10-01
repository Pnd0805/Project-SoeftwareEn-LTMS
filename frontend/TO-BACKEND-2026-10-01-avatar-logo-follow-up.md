# ถึง Backend — avatar/logo Notice follow-up · 1 ต.ค. 2569

อ้างอิง Notice `FE-Notice-BE_KN-avatar-uploads.md` (`49faf77`) และตรวจ remote
`BE_KN@7ea7328` ด้วย `git ls-remote`/fetch วันที่ 1 ต.ค. 2569
ไฟล์นี้เป็น handoff ของ frontend; ยังไม่ได้ส่งข้อความถึงทีมอื่นโดยอัตโนมัติ

## FE ทำแล้วและตรวจจริงแล้ว

- โฟลว์ presign → PUT → PATCH key และลบด้วย null มีทั้ง avatar/โลโก้
- Real mode รับ PNG/JPEG; มีข้อความ error ตาม Notice และ fallback ของรูปที่โหลดไม่ได้
- รัน migrations (34), role audit C1–C8 (0 เคส), และ minio-init ผ่าน
- ทดสอบ API/MinIO: อัปโหลด PNG, เปิด URL แบบ anonymous ได้ 200, reload,
  avatar หลัง login ใหม่, ลบรูปและอ่านซ้ำได้ null; ตรวจ 422 key ผิด/ไฟล์หาย,
  403 nonleader และ 400 GIF ผ่าน ข้อมูลทดสอบกลับเป็น null หลังจบ
- Browser acceptance/CORS/มือถือยังเปิดอยู่ รายละเอียดใน `QA-AVATAR-UPLOADS-2026-10-01.md`

## ขอเพิ่ม logoUrl ใน DTO ที่ FE ใช้งาน

| ลำดับ | Endpoint/DTO | หน้าที่ต้องใช้ | สิ่งที่ขอ |
|---|---|---|---|
| 1 | `GET /me/teams` · `MyTeam` | Teams/My squads และทีมใน `/me` | เพิ่ม `logoUrl` เป็น string หรือ null ต่อรายการ |
| 2 | `GET /users/:id` · `teams[]`/`TeamRef` | ทีมในโปรไฟล์ผู้เล่นสาธารณะ | เพิ่ม `logoUrl` เป็น string หรือ null ต่อทีม |

ให้แปลงจาก `logo_key` เป็น public URL แบบเดียวกับ `toTeamDto` และคืน null เมื่อไม่มีรูป
FE จะ map/render เมื่อ BE ส่งมอบ ไม่ยิง `GET /teams/:id` เพิ่มทีละทีมเพื่อเติมรูป
ไม่ใช้ mock/store เติมข้อมูลที่ API ไม่ส่งมา

ตรวจ source แล้ว `GET /teams` ใช้ `toTeamDto` ซึ่งมี logoUrl อยู่แล้วใน head นี้
FE จึงแก้ Search ให้ใช้ field นี้โดยไม่ขอเพิ่ม endpoint นั้น
โลโก้ในทีมที่ซ้อนใน bracket/standings/ใบสมัครเป็นงานต่อยอด แยกจากสองรายการหลักนี้

### เกณฑ์ตรวจรับ

- ตั้งโลโก้ทีมแล้ว `/me/teams` และ public-profile `teams[]` คืน URL ที่เปิดได้ตรง
- ลบโลโก้แล้วทั้งสองทางคืน null และไม่ค้างรูปเก่า
- ใช้รูปเดียวกับรายละเอียดทีม โดยไม่เปลี่ยนสิทธิ์การเห็นทีมเดิม

## ติดตามแยก: หลักฐาน user report ต้องเป็น URL ส่วนตัว

`src/mappers/userReport.mapper.ts` ที่ `7ea7328` ยังคืน `evidence` เป็น key ดิบ
ขอให้ `GET /admin/user-reports` คืน presigned download URLs ที่ผ่านสิทธิ์ของผู้ดู
พร้อมแจ้งชื่อ field/DTO และอายุ URL หรือ contract สำหรับขอลิงก์ใหม่ก่อนเปิดดู
ห้ามเปลี่ยนหลักฐานนี้เป็น public URL หรือเปิด anonymous policy แบบ avatar/logo
เรื่องนี้ไม่ใช่ตัวกั้นความสามารถอัปโหลด avatar/logo และ FE ยังไม่เดาเส้นทางดาวน์โหลด

## ผลตรวจ remote branches เพิ่มเติม · 1 ต.ค. 2569

ตรวจด้วย `git ls-remote --heads origin` และ `git fetch origin` แล้วอ่าน source ที่ head
ของทุก remote branch; พบ backend source ใน 9 branches ตามตารางนี้

| Branch | Head | MyTeam.logoUrl | TeamRef.logoUrl | User-report download URL |
|---|---|---|---|---|
| BE_KN | 7ea7328 | ยังไม่มี | ยังไม่มี | ยังคืน key |
| backend | 6313a07 | ยังไม่มี | ยังไม่มี | ไม่พบโฟลว์ user report |
| backend_shokun | f222b12 | ยังไม่มี | ยังไม่มี | ไม่พบโฟลว์ user report |
| backend_shokun_2 | 01db599 | ยังไม่มี | ยังไม่มี | ยังคืน key |
| backend_step9-10 | 4813d1f | ยังไม่มี | ยังไม่มี | ยังคืน key |
| feat/be-c4-c5a | 871a681 | ยังไม่มี | ยังไม่มี | ไม่พบโฟลว์ user report |
| feat/be-c8-profile | f0e2c85 | ยังไม่มี | ยังไม่มี | ไม่พบโฟลว์ user report |
| feat/rewards-match-history | bb7ef10 | ยังไม่มี | ยังไม่มี | ยังคืน key |
| feature/tournaments-step-5 | d90893c | ยังไม่มี | ยังไม่มี | ไม่พบโฟลว์ user report |

หลักฐานจาก source:

- `backend/src/mappers/team.mapper.ts`: `toMyTeam` และ `toTeamRef` ของทั้ง 9 branches
  ไม่มี `logoUrl` ใน output; รุ่นใหม่มี field นี้เฉพาะ `toTeamDto`
- `backend/src/services/team.service.ts`: รายการทีมของผู้ใช้เรียก `toMyTeam`
- `backend/src/services/user.service.ts`: public profile ใช้ `teamRows.map(toTeamRef)`
  ใน baseline; repository อ่าน `t.*` ซึ่งมี logo_key แล้ว แต่ mapper ยังไม่ส่งต่อ
- ทั้ง 4 branches ที่มี user report: `adminScope.service.ts` ใช้ `rows.map(toUserReportDto)`
  โดย `userReport.mapper.ts` คืน `evidence: row.evidence ?? []` ไม่มีการเซ็น URL
- `getPresignedDownloadUrl` มีอยู่แล้ว และถูกใช้ในเอกสารสมัคร/คำร้องทีม/ข้อร้องเรียนผลแข่ง
  แต่ยังไม่ได้เชื่อมกับ `GET /admin/user-reports`
- `backend_shokun_2@01db599` และ `feat/rewards-match-history@bb7ef10` ไม่เป็น ancestor
  ของ `BE_KN@7ea7328`; ตรวจ source ของสอง branch นี้โดยตรงแล้ว ยังไม่มีทั้งสามรายการ

สรุป: งานที่ขอทั้งสามรายการยังเปิดอยู่ ไม่พบงานที่พร้อมนำมารวมจาก branch อื่น
ผลนี้ยืนยัน source บน remote ณ เวลาตรวจ ไม่ครอบคลุมงาน local ที่ยังไม่ push
และไม่ได้ถือเป็น runtime/browser acceptance ของ branches อื่น
