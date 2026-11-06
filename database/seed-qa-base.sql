-- ข้อมูลทดสอบชั้นแรกของ LTMS (สร้างโดยสคริปต์)
-- รหัสผ่านของทุกบัญชี: abcd1234
--
-- ไฟล์นี้คือชั้นที่ `seed-qa-matches.py`, `seed-qa-flows.py` และ
-- `seed-qa-allinone.py` อ้างถึงแต่ไม่ได้สร้างเอง — ทีมแบดมินตัน 9008–9011
-- กับผู้เล่น playerA1–playerD2 ที่สคริปต์พวกนั้นใช้จัดสาย และกรรมการ
-- referee3/referee4/referee.ext ที่ใช้ทดสอบเอกสารกรรมการภายนอก (AR01–AR04)
--
-- เดิมชั้นนี้เกิดจากการยิง API ทีละคำสั่งตอน 17 ก.ย. ไม่มีสคริปต์เก็บไว้ จึงมีอยู่
-- แค่ในเครื่องเดียว ใครก็ตามที่ clone มาใหม่แล้วรัน seed อื่นต่อจะได้บัญชีครบ
-- แต่ความสัมพันธ์หายหมด เพราะทีมกับผู้เล่นที่สคริปต์อ้างถึงไม่มีอยู่จริง
--
-- ⚠️ ต้องรันก่อน seed-qa-teams.sql และก่อนสคริปต์ .py ทุกตัว
--    รันซ้ำได้ — ลบเฉพาะช่วง id ของตัวเองก่อนเสมอ (ทีม 9005–9011, ผู้ใช้
--    9051–9054 และ 9101–9108) ถ้ามีใบสมัคร/แมตช์ค้างอ้างถึงของพวกนี้จะติด
--    foreign key ให้ล้างข้อมูลแข่งขันก่อน
SET FOREIGN_KEY_CHECKS = 1;

-- ลบของชุดนี้ก่อน เพื่อให้รันซ้ำได้โดยไม่ชนคีย์
DELETE FROM team_members WHERE team_id BETWEEN 9005 AND 9011;
DELETE FROM teams        WHERE team_id BETWEEN 9005 AND 9011;
DELETE FROM users        WHERE user_id IN (9051,9052,9053,9054,9101,9102,9103,9104,9105,9106,9107,9108);

-- กรรมการสำหรับทดสอบ: referee3/referee4 เป็นกรรมการในระบบ ส่วน referee.ext
-- เป็นคนนอกมหาวิทยาลัย ใช้ทดสอบเส้นทางที่ต้องแนบเอกสารให้แอดมินตรวจ
-- ผู้เล่น playerA1–playerD2 จับคู่เป็นทีมแบดมินตัน 4 ทีมตามลำดับ
--
-- 🆕 7 ต.ค. 2569 (FE ขอ · ทางเลือก ข) — กรรมการภายนอก **คนที่สอง** 9054
--    มีไว้ให้มีเอกสารที่ "เปิดดูได้จริง" คู่กับของ 9053 ที่ "เปิดไม่ได้"
--      9053  referee.ext@outside.org   เอกสารชี้ไป object ที่ **ไม่มีใน MinIO** → 404 โดยเจตนา
--            (ไว้ทดสอบจอกู้สถานการณ์ตอนไฟล์หาย — 🔴 ห้ามอัปไฟล์ให้มันมี)
--      9054  referee.ext2@outside.org  เอกสารชี้ไป object ที่ **มีจริง** (minio-init อัปให้)
--            → ทดสอบลิงก์ presigned ที่เปิดได้ และทดสอบว่าหมดอายุตามเวลาจริง
--    ⚠️ ของ 9054 ใช้ได้เฉพาะเมื่อ minio-init รันแล้ว — ดู database/fixtures/README.md

INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `gender`, `birth_date`, `user_type`, `faculty_id`, `department_id`, `year`, `profile_image_key`, `contact_info`, `address`, `is_suspended`, `suspended_reason`, `total_points`, `notification_prefs`, `profile_edit_log`, `created_at`, `updated_at`) VALUES (9051,'วีระชัย นกหวีดทอง','referee3@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','1990-04-12','student',1,1,NULL,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL);
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `gender`, `birth_date`, `user_type`, `faculty_id`, `department_id`, `year`, `profile_image_key`, `contact_info`, `address`, `is_suspended`, `suspended_reason`, `total_points`, `notification_prefs`, `profile_edit_log`, `created_at`, `updated_at`) VALUES (9052,'อรทัย กฎกติกา','referee4@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','1992-08-03','student',2,6,NULL,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL);
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `gender`, `birth_date`, `user_type`, `faculty_id`, `department_id`, `year`, `profile_image_key`, `contact_info`, `address`, `is_suspended`, `suspended_reason`, `total_points`, `notification_prefs`, `profile_edit_log`, `created_at`, `updated_at`) VALUES (9053,'สมเกียรติ ภายนอก','referee.ext@outside.org','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','1988-01-20','external',NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-18 03:08:30',NULL);
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `gender`, `birth_date`, `user_type`, `faculty_id`, `department_id`, `year`, `profile_image_key`, `contact_info`, `address`, `is_suspended`, `suspended_reason`, `total_points`, `notification_prefs`, `profile_edit_log`, `created_at`, `updated_at`) VALUES (9054,'ประเสริฐ เอกสารครบ','referee.ext2@outside.org','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','1986-03-09','external',NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-10-07 00:00:00',NULL);
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `gender`, `birth_date`, `user_type`, `faculty_id`, `department_id`, `year`, `profile_image_key`, `contact_info`, `address`, `is_suspended`, `suspended_reason`, `total_points`, `notification_prefs`, `profile_edit_log`, `created_at`, `updated_at`) VALUES (9101,'ผู้เล่น เอหนึ่ง','playerA1@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-01-01','student',1,1,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 15:29:46',NULL);
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `gender`, `birth_date`, `user_type`, `faculty_id`, `department_id`, `year`, `profile_image_key`, `contact_info`, `address`, `is_suspended`, `suspended_reason`, `total_points`, `notification_prefs`, `profile_edit_log`, `created_at`, `updated_at`) VALUES (9102,'ผู้เล่น เอสอง','playerA2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-02-01','student',1,1,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 15:29:46',NULL);
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `gender`, `birth_date`, `user_type`, `faculty_id`, `department_id`, `year`, `profile_image_key`, `contact_info`, `address`, `is_suspended`, `suspended_reason`, `total_points`, `notification_prefs`, `profile_edit_log`, `created_at`, `updated_at`) VALUES (9103,'ผู้เล่น บีหนึ่ง','playerB1@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-03-01','student',1,1,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 15:29:46',NULL);
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `gender`, `birth_date`, `user_type`, `faculty_id`, `department_id`, `year`, `profile_image_key`, `contact_info`, `address`, `is_suspended`, `suspended_reason`, `total_points`, `notification_prefs`, `profile_edit_log`, `created_at`, `updated_at`) VALUES (9104,'ผู้เล่น บีสอง','playerB2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-04-01','student',1,1,3,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 15:29:46',NULL);
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `gender`, `birth_date`, `user_type`, `faculty_id`, `department_id`, `year`, `profile_image_key`, `contact_info`, `address`, `is_suspended`, `suspended_reason`, `total_points`, `notification_prefs`, `profile_edit_log`, `created_at`, `updated_at`) VALUES (9105,'QA C1','playerC1@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-01-01','student',1,1,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 15:41:35',NULL);
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `gender`, `birth_date`, `user_type`, `faculty_id`, `department_id`, `year`, `profile_image_key`, `contact_info`, `address`, `is_suspended`, `suspended_reason`, `total_points`, `notification_prefs`, `profile_edit_log`, `created_at`, `updated_at`) VALUES (9106,'QA C2','playerC2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-01-01','student',1,1,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 15:41:35',NULL);
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `gender`, `birth_date`, `user_type`, `faculty_id`, `department_id`, `year`, `profile_image_key`, `contact_info`, `address`, `is_suspended`, `suspended_reason`, `total_points`, `notification_prefs`, `profile_edit_log`, `created_at`, `updated_at`) VALUES (9107,'QA D1','playerD1@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-01-01','student',1,1,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 15:41:35',NULL);
INSERT INTO `users` (`user_id`, `full_name`, `email`, `password_hash`, `gender`, `birth_date`, `user_type`, `faculty_id`, `department_id`, `year`, `profile_image_key`, `contact_info`, `address`, `is_suspended`, `suspended_reason`, `total_points`, `notification_prefs`, `profile_edit_log`, `created_at`, `updated_at`) VALUES (9108,'QA D2','playerD2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-01-01','student',1,1,2,NULL,NULL,NULL,0,NULL,0,NULL,NULL,'2026-09-17 15:41:35',NULL);

-- ทีมที่สคริปต์อื่นใช้: 9005–9007 ไว้ทดสอบชื่อซ้ำ/ทีมที่ยังไม่พร้อม
-- ส่วน 9008–9011 คือสี่ทีมแบดมินตันที่ seed-qa-matches.py เอาไปจับสาย

INSERT INTO `teams` (`team_id`, `name`, `sport_type_id`, `leader_id`, `readiness_status`, `official_status`, `created_at`, `updated_at`, `last_competed_at`, `deleted_at`, `deleted_reason`) VALUES (9005,'QA Squad',1,9002,'Forming','Unofficial','2026-09-17 14:00:41',NULL,NULL,'2026-09-17 14:02:10','leader_deleted');
INSERT INTO `teams` (`team_id`, `name`, `sport_type_id`, `leader_id`, `readiness_status`, `official_status`, `created_at`, `updated_at`, `last_competed_at`, `deleted_at`, `deleted_reason`) VALUES (9006,'QA Dup',1,9002,'Forming','Unofficial','2026-09-17 14:03:09','2026-09-18 04:15:54',NULL,NULL,NULL);
INSERT INTO `teams` (`team_id`, `name`, `sport_type_id`, `leader_id`, `readiness_status`, `official_status`, `created_at`, `updated_at`, `last_competed_at`, `deleted_at`, `deleted_reason`) VALUES (9007,'QA FC B',1,9003,'Forming','Unofficial','2026-09-17 14:04:01','2026-09-18 04:15:54',NULL,NULL,NULL);
INSERT INTO `teams` (`team_id`, `name`, `sport_type_id`, `leader_id`, `readiness_status`, `official_status`, `created_at`, `updated_at`, `last_competed_at`, `deleted_at`, `deleted_reason`) VALUES (9008,'QA Badminton A',3,9101,'Ready','Unofficial','2026-09-17 15:30:48','2026-09-18 04:15:54',NULL,NULL,NULL);
INSERT INTO `teams` (`team_id`, `name`, `sport_type_id`, `leader_id`, `readiness_status`, `official_status`, `created_at`, `updated_at`, `last_competed_at`, `deleted_at`, `deleted_reason`) VALUES (9009,'QA Badminton B',3,9103,'Ready','Unofficial','2026-09-17 15:30:50','2026-09-18 04:15:54',NULL,NULL,NULL);
INSERT INTO `teams` (`team_id`, `name`, `sport_type_id`, `leader_id`, `readiness_status`, `official_status`, `created_at`, `updated_at`, `last_competed_at`, `deleted_at`, `deleted_reason`) VALUES (9010,'QA Badminton C',3,9105,'Ready','Unofficial','2026-09-17 15:42:26','2026-09-18 04:15:54',NULL,NULL,NULL);
INSERT INTO `teams` (`team_id`, `name`, `sport_type_id`, `leader_id`, `readiness_status`, `official_status`, `created_at`, `updated_at`, `last_competed_at`, `deleted_at`, `deleted_reason`) VALUES (9011,'QA Badminton D',3,9107,'Ready','Unofficial','2026-09-17 15:42:27','2026-09-18 04:15:54',NULL,NULL,NULL);

-- คนละสองคนต่อทีม พอให้ผ่านเงื่อนไขจำนวนผู้เล่นขั้นต่ำของแบดมินตันคู่

INSERT INTO `team_members` (`team_member_id`, `team_id`, `user_id`, `position`, `joined_at`) VALUES (9006,9005,9002,'starter','2026-09-17 14:00:41');
INSERT INTO `team_members` (`team_member_id`, `team_id`, `user_id`, `position`, `joined_at`) VALUES (9007,9006,9002,'starter','2026-09-17 14:03:09');
INSERT INTO `team_members` (`team_member_id`, `team_id`, `user_id`, `position`, `joined_at`) VALUES (9008,9007,9003,'starter','2026-09-17 14:04:01');
INSERT INTO `team_members` (`team_member_id`, `team_id`, `user_id`, `position`, `joined_at`) VALUES (9009,9008,9101,'starter','2026-09-17 15:30:48');
INSERT INTO `team_members` (`team_member_id`, `team_id`, `user_id`, `position`, `joined_at`) VALUES (9010,9008,9102,'starter','2026-09-17 15:30:49');
INSERT INTO `team_members` (`team_member_id`, `team_id`, `user_id`, `position`, `joined_at`) VALUES (9011,9009,9103,'starter','2026-09-17 15:30:50');
INSERT INTO `team_members` (`team_member_id`, `team_id`, `user_id`, `position`, `joined_at`) VALUES (9012,9009,9104,'starter','2026-09-17 15:30:50');
INSERT INTO `team_members` (`team_member_id`, `team_id`, `user_id`, `position`, `joined_at`) VALUES (9013,9010,9105,'starter','2026-09-17 15:42:26');
INSERT INTO `team_members` (`team_member_id`, `team_id`, `user_id`, `position`, `joined_at`) VALUES (9014,9010,9106,'starter','2026-09-17 15:42:26');
INSERT INTO `team_members` (`team_member_id`, `team_id`, `user_id`, `position`, `joined_at`) VALUES (9015,9011,9107,'starter','2026-09-17 15:42:27');
INSERT INTO `team_members` (`team_member_id`, `team_id`, `user_id`, `position`, `joined_at`) VALUES (9016,9011,9108,'starter','2026-09-17 15:42:27');


-- =====================================================================
-- OD-53 (29 ต.ค. 2569) — ติดธงยืนยันอีเมลให้บัญชีที่ไฟล์นี้สร้าง
-- =====================================================================
-- 🔴 ต้องมีบรรทัดนี้ ไม่ใช่พึ่ง migration 055
--   migration รัน **ก่อน** seed ⇒ บัญชีที่ไฟล์นี้เพิ่งสร้างจะเป็น email_verified = 0 (DEFAULT ของ migration 037)
--   ⇒ เมื่อเปิดสวิตช์ REQUIRE_EMAIL_VERIFIED **บัญชีเดโม/ทดสอบทุกใบจะล็อกอินไม่ได้**
-- ★ ตั้งทุกแถวโดยไม่กรองวันที่ — ไฟล์นี้เป็นข้อมูลทดสอบ/สาธิตทั้งก้อน ไม่ใช่ข้อมูลผู้ใช้จริง
-- ★ รันซ้ำได้ ไม่มีผลข้างเคียง
UPDATE users SET email_verified = 1 WHERE email_verified = 0;


-- =====================================================================
-- OD-71 (29 ต.ค. 2569) — แจกแต้มตั้งต้นให้บัญชีที่ไฟล์นี้สร้าง เพื่อให้ "แลกแต้มซื้อ Badge" สาธิตได้
-- =====================================================================
-- ทำไมต้องมี: migration 056 เติม Badge ที่ขายได้ (30 / 100 / 300 แต้ม) แต่ **ทุกบัญชีมี total_points = 0**
--   ⇒ กดแลกในหน้าจอจะได้ 409 INSUFFICIENT_POINTS ทุกครั้ง · ฟีเจอร์ทำงานถูกแต่ **สาธิตไม่ได้**
--   แต้มจริงได้จากการทาย Pick'em เท่านั้น (10/7/4 แต้มต่อใบ) ⇒ ต้องเดินหลายแมตช์ก่อนจะซื้อได้ใบเดียว
--
-- 🔴 ต้องอยู่ในไฟล์ seed ไม่ใช่ใน migration — seed รัน **หลัง** migrate
--   บัญชีที่ไฟล์นี้เพิ่งสร้างจะเป็น 0 ตาม DEFAULT ของตาราง ⇒ migration ครอบไม่ถึง
--   (กับดักเดียวกับธง email_verified ของ OD-53)
--
-- ★ ทำไม 150 — ให้สาธิตได้ "ทั้งซื้อสำเร็จและแต้มไม่พอ" ด้วยบัญชีเดียว
--     บรอนซ์ 30 + ซิลเวอร์ 100 = 130 ⇒ ซื้อได้ทั้งสองใบ
--     โกลด์ 300 ⇒ ซื้อไม่ได้ ⇒ เห็นข้อความ "ขาดอีก N แต้ม" ของจริง
--
-- ★ ลงรายการใน point_transactions ด้วย ไม่ใช่แก้ยอดลอย ๆ
--   source 'admin_adjustment' เป็นค่าที่ฐานมีไว้อยู่แล้ว ⇒ ตรวจย้อนได้ว่าแต้มมาจากไหน
--   และยอดในกระเป๋ากับสมุดบัญชีไม่ขัดกัน
--
-- ★ รันซ้ำได้ — ทั้งสองคำสั่งใช้เงื่อนไขเดียวกัน (ยังไม่มีรายการ admin_adjustment ของคนนั้น)
--   ⇒ รอบที่สองไม่ทำอะไรเลย ไม่มีการแจกซ้ำ
--
-- 🔴 ไฟล์นี้เป็นข้อมูลทดสอบ/สาธิตทั้งก้อน จึงแจกทุกแถวโดยไม่กรอง — **ห้ามรันกับฐานที่มีผู้ใช้จริง**
-- =====================================================================

UPDATE users u
   SET u.total_points = u.total_points + 150
 WHERE NOT EXISTS (SELECT 1 FROM point_transactions pt
                    WHERE pt.user_id = u.user_id AND pt.source = 'admin_adjustment');

INSERT INTO point_transactions (user_id, amount, source, ref_id)
SELECT u.user_id, 150, 'admin_adjustment', NULL
  FROM users u
 WHERE NOT EXISTS (SELECT 1 FROM point_transactions pt
                    WHERE pt.user_id = u.user_id AND pt.source = 'admin_adjustment');
