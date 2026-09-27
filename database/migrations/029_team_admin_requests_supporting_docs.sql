-- แก้ schema drift (พบ 27 ก.ย. 2569 ระหว่างกวาดหาคอลัมน์ที่เขียนแล้วไม่มีใครอ่านกลับ)
--
-- `team_admin_requests.supporting_docs` ถูกเพิ่มเข้า `database/schema.sql` ไว้ แต่**ไม่มี migration ไหนเพิ่มให้**
-- ฐานข้อมูลที่สร้างจาก schema.sql จึงมีคอลัมน์นี้ ส่วนฐานที่เดินมาด้วย `npm run migrate` ไม่มี
--
-- ผลคือไม่ใช่แค่ "อ่านกลับไม่ได้": `team.repo.createOfficialRequest` INSERT ลงคอลัมน์นี้ตรง ๆ
-- การยื่นขอสถานะ "ทีม Official" จึงล้มด้วย ER_BAD_FIELD_ERROR ทั้งฟีเจอร์บนฐานที่ไม่มีคอลัมน์
-- (ยืนยันกับฐาน dev เมื่อ 27 ก.ย.: SHOW COLUMNS ไม่มี supporting_docs และคิวของแอดมินยิงไม่ผ่าน)
--
-- ฐานที่สร้างจาก schema.sql จะข้าม migration นี้เอง เพราะ schema.sql ลงชื่อไฟล์ทั้งหมดไว้ใน
-- schema_migrations ตอนท้ายอยู่แล้ว · ตำแหน่งคอลัมน์วางตาม schema.sql (หลัง team_admin_request_status)
ALTER TABLE team_admin_requests
  ADD COLUMN supporting_docs JSON NULL AFTER team_admin_request_status;
