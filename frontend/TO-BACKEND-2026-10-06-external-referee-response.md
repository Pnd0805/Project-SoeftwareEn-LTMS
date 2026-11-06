# FE response — External referee changes, 6 October 2026

ตอบ `FE-Notice/TO-FE-2026-10-06-external-referee-changes.md`.
ตรวจ remote และ fetch `BE_KN@29a6aec895438f5986a1e28f7c28e1c5e694cde4`
(รวม `4703e35`) แล้ว อ่าน F01 service/schema และ AR01/AR02 service/routes.
แก้เฉพาะ frontend; ไม่แก้ working tree หรือฐานข้อมูลของ BE.

## จุดที่แก้แล้ว

- [x] **หน้าเชิญเลือก ก:** ไม่มี checkbox ให้เลือกภายใน/ภายนอก โหมดจริง
  ไม่อ่านคณะหรือเดาจาก userType เพื่อกำหนดสถานะแล้ว ก่อนส่งคำเชิญบอกว่าระบบ
  จะกำหนดสถานะให้; หลัง F01 สำเร็จแสดง Internal/External จาก `response.isExternal`.
  รายชื่อกรรมการที่เชิญแล้วก็อ่านค่าที่ BE ส่งกลับตามเดิม.
- [x] External success copy แจ้งว่าต้องส่งเอกสารและผ่านการตรวจตัวตนก่อนคุมแมตช์.
  ยังคงคำเตือนจำนวนงานนอกทัวร์จาก `crossTournamentWarnings` โดยไม่เปิดข้อมูลทัวร์อื่น.
- [x] **AR01:** DTO/adapter เก็บ `docsSubmitted` ทุกแถวคน × ทัวร์โดยตรง
  ไม่อนุมานจาก `docs.length`. แสดงป้าย `รอตรวจ` / `รอเอกสารจากผู้สมัคร` ในคิวเดียวกัน.
- [x] **AR02:** Approve กดได้เฉพาะ `docsSubmitted === true`; false ยังอยู่ในคิว
  และกด Request documents/Reject ได้. ถ้าไม่มี field (เช่น server เก่า) ให้ป้าย
  `ตรวจสถานะเอกสารไม่ได้`, ปิด Approve และมี Retry; ไม่ถือว่าแนบเอกสารแล้ว.
- [x] **409 DOCS_NOT_SUBMITTED:** แสดงเหตุผลและทางแก้ว่าให้รอ/ทวงเอกสาร
  พร้อม refetch AR01 เพื่อปิดปุ่มจากสถานะล่าสุดเมื่อข้อมูลเดิมค้าง.
- [x] Developer focused tests: 35 tests ผ่าน ครอบคลุมค่าตอบกลับต่างจาก request,
  flags true/false/absent, ปุ่มที่อนุญาต, stale 409/refetch และ approve/reject refresh.
- [x] Full suite 80 files / 494 tests, lint, build และ diff check ผ่าน.
  Vite พอร์ต 5191 ตอบ Admin/Manage และโมดูล UI ที่แก้ HTTP 200 แล้วปิด server
  ที่เปิดทดสอบเอง; ยังมีคำเตือน main bundle >500 kB เดิม.
- [ ] Live acceptance: เชิญ @ku.th และอีเมลภายนอก; ตรวจค่าหลัง reload;
  accept โดยไม่มีเอกสาร -> Approve disabled -> ส่งเอกสาร -> ตรวจคิว/Approve;
  request-docs/reject เมื่อไม่มีเอกสาร และ race 409. Developer tests ไม่ปิดรายการนี้.

## ตอบคำถาม BE ทั้ง 5 ข้อ

1. **isExternal checkbox: เลือก ก.** ขอให้ schema ทำ `isExternal` เป็น optional
   หรือเลิกบังคับฟิลด์นี้ได้ไหม เพื่อให้ FE ไม่ต้องส่ง placeholder?
   ระหว่างรอ FE ยังส่ง `false` ในโหมดจริงเพื่อรองรับ schema ปัจจุบัน และใช้
   response เป็นค่าจริงเสมอ การเปลี่ยนไปอ่าน user_type ใน BE ภายหลังไม่กระทบจอนี้.
2. **คิวแอดมิน: คงคิวเดียวและติดป้ายรายแถว.** ไม่ซ่อนคนรอเอกสาร ไม่มีตัวนับใหม่
   เพราะ adapter ปัจจุบันแสดงคนเดียวได้หลายทัวร์; จำนวนแถวไม่เท่าจำนวนคน.
3. **BO capability flag: ต้องการ.** ขอ server-owned capability ใน sport-types
   พร้อมตกลงชื่อ/ความหมายของ field เพื่อเลิกจับคู่ชื่อกีฬาใน FE.
   ยังไม่เรียกหรือใช้ field ที่ยังไม่ได้ส่งมอบ; ปัจจุบัน BO ยังใช้ implementation เดิม.
4. **ยกเลิกทัวร์: FE เห็นด้วยให้มีสถานะเฉพาะถ้าทีมอนุมัติ.** ขอ contract ระบุ
   transition/สิทธิ์, เหตุผลและเวลายกเลิก, ผลต่อแมตช์/คำเชิญ/การสมัคร/สถิติ/รางวัล
   และ notifications ก่อนทำ UI. แนะนำเก็บประวัติและเหตุผลให้ทุกฝ่ายอ่านได้.
   อ้าง inventory ใน `TO-BACKEND-2026-10-06-frontend-checklist-response.md`;
   ข้อนี้เป็นข้อเสนอ ไม่ใช่มติทีม และยังไม่เพิ่มสถานะ cancellation ใน FE.
5. **อายุเอกสาร 1 ปี: เสนอให้แยกผลต่อแมตช์ที่เริ่มแล้วกับงานใหม่.** แนะนำเตือน
   ก่อนหมดอายุ, กันรับงานใหม่เมื่อหมดอายุ และให้ผู้จัดเห็นแมตช์ที่ต้องหาคนแทน;
   หลีกเลี่ยงการถอดคนจากแมตช์กำลังแข่งโดยเงียบ ๆ. ถ้าทีมเลือกหยุดทันที ขอ BE
   ระบุสถานะ/reason, impacted match IDs ของทัวร์ผู้จัด, permissions และ notifications.
   ยังไม่เพิ่มการถอด assignment หรือคาดเดาการหมดอายุจากเวลาฝั่ง browser.

## ข้อค้างเดิมที่ยังเกี่ยวข้อง

- [ ] Admin ยังเปิดไฟล์ยืนยันตัวตนไม่ได้: AR01 ให้ private object keys แต่ยังไม่มี
  authorized read/download URL ใน contract ที่ตรวจ. `docsSubmitted: true` คือส่งแล้ว
  ไม่ใช่หลักฐานว่าแอดมินอ่านเอกสารผ่าน UI ได้ ขอเส้นอ่านที่ตรวจสิทธิ์ก่อนปิด live acceptance.
- [ ] OTP login bypass ยังแยกค้างใน `TO-BACKEND-2026-10-06-otp-login-bypass.md`.
  External referee delivery ไม่ปิดการตรวจ email_verified ตอน login/ใช้ token.
