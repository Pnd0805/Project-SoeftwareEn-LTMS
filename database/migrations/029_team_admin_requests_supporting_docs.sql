-- แก้ schema drift (พบ 27 ก.ย. 2569 ระหว่างกวาดหาคอลัมน์ที่เขียนแล้วไม่มีใครอ่านกลับ)
--
-- `team_admin_requests.supporting_docs` ถูกเพิ่มเข้า `database/schema.sql` ไว้ แต่**ไม่มี migration ไหนเพิ่มให้**
-- ฐานข้อมูลที่สร้างจาก schema.sql จึงมีคอลัมน์นี้ ส่วนฐานที่เดินมาด้วย `npm run migrate` ไม่มี
--
-- ผลคือไม่ใช่แค่ "อ่านกลับไม่ได้": `team.repo.createOfficialRequest` INSERT ลงคอลัมน์นี้ตรง ๆ
-- การยื่นขอสถานะ "ทีม Official" จึงล้มด้วย ER_BAD_FIELD_ERROR ทั้งฟีเจอร์บนฐานที่ไม่มีคอลัมน์
-- (ยืนยันกับฐาน dev เมื่อ 27 ก.ย.: SHOW COLUMNS ไม่มี supporting_docs และคิวของแอดมินยิงไม่ผ่าน)
--
-- ตำแหน่งคอลัมน์วางตาม schema.sql (หลัง team_admin_request_status)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- แก้ 30 ก.ย. 2569 — ทำให้รันบนฐานที่มีคอลัมน์อยู่แล้วได้ (FE-migration-029-fails-on-baseline)
--
-- เดิมไฟล์นี้ ADD COLUMN แบบไม่มีเงื่อนไข โดยคิดว่า "ฐานที่สร้างจาก schema.sql จะข้ามเอง
-- เพราะ schema.sql ลงชื่อไฟล์ทั้งหมดไว้ใน schema_migrations ตอนท้าย" ซึ่งจริงเฉพาะฐานที่
-- สร้างจาก schema.sql ล่าสุด · `database/qa-baseline.sql` (21 ก.ย.) เป็น dump ที่ **มีคอลัมน์นี้อยู่แล้ว**
-- แต่ schema_migrations บันทึกถึงแค่ 020 → migrate หยุดที่ไฟล์นี้ด้วย ER_DUP_FIELDNAME
-- และ migration ที่อยู่ถัดไปจะไม่ถูกรันเลยสักตัว (ตอนพบ ค้างอยู่ 030–032)
--
-- ★ ปกติห้ามแก้ไฟล์ migration ที่ push ไปแล้ว (ดูหัวไฟล์ migrate.ts) — ที่แก้ตรงนี้ได้เพราะ
--   ฐานที่รันไฟล์นี้สำเร็จไปแล้วจะไม่รันซ้ำอยู่ดี (ชื่ออยู่ใน schema_migrations) และเงื่อนไขใหม่
--   ให้ผลเหมือนเดิมทุกกรณีที่เคยผ่าน ต่างกันแค่ "ไม่ระเบิด" ตอนคอลัมน์มีอยู่แล้ว
--
-- MySQL 8 ไม่มี ADD COLUMN IF NOT EXISTS (MariaDB มี) จึงต้องถาม information_schema
-- แล้วประกอบคำสั่งเอง · `DO 0` คือ statement ที่ไม่ทำอะไร ใช้เป็นทางว่างตอนข้าม
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'team_admin_requests'
     AND COLUMN_NAME  = 'supporting_docs'
);

SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE team_admin_requests ADD COLUMN supporting_docs JSON NULL AFTER team_admin_request_status',
  'DO 0'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
