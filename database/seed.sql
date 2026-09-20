-- =====================================================================
-- LTMS — Seed Data (ข้อมูลอ้างอิงตั้งต้น)
-- =====================================================================
-- Part 2 §3: "ข้อมูลอ้างอิงทั้งหมด seed ผ่าน migration ไม่ใช่ผ่าน API"
-- จึงไม่มี POST/PATCH สำหรับตารางกลุ่มนี้ — ต้องใส่ผ่านไฟล์นี้เท่านั้น
--
-- ลำดับใน "ไฟล์นี้เรียงตาม FK" ห้ามสลับ:
--   faculties → departments → sport_types → sport_stat_definitions
--
-- ทุกคำสั่งใช้ AS new ... ON DUPLICATE KEY UPDATE → รันซ้ำได้ไม่พัง (idempotent)
--   "AS new" = ตั้งชื่อเล่นให้แถวที่กำลังจะ insert → new.name คือค่าที่ส่งมาในคำสั่งนี้
--   (ไวยากรณ์เดิม VALUES(col) ถูก MySQL 8.0.20+ ประกาศเลิกใช้ — warning 1287)
-- และระบุ id เองแบบ hardcode เพราะตารางลูกต้องอ้างถึงเลขนี้
--
-- วิธีรัน:
--   docker exec -i ltms-mysql mysql -uroot -psecret ltms < database/seed.sql
--
-- ⚠️⚠️ ค่าทั้งหมดในไฟล์นี้เป็น "ค่าสมมติ" ยังไม่ได้ยืนยันกับทีม/อาจารย์
--      ดู GUIDE/07 ข้อ E1 — ต้องแก้ให้ตรงของจริงก่อนส่งงาน
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. faculties — คณะ
-- ⚠️ สมมติ: ต้องแทนที่ด้วยรายชื่อคณะจริงของมหาวิทยาลัย
-- ---------------------------------------------------------------------
INSERT INTO faculties (faculty_id, name) VALUES
  (1, 'คณะวิศวกรรมศาสตร์'),
  (2, 'คณะวิทยาศาสตร์'),
  (3, 'คณะเกษตร'),
  (4, 'คณะบริหารธุรกิจ'),
  (5, 'คณะมนุษยศาสตร์'),
  (6, 'คณะสังคมศาสตร์'),
  (7, 'คณะศึกษาศาสตร์'),
  (8, 'คณะเศรษฐศาสตร์')
AS new
ON DUPLICATE KEY UPDATE name = new.name;


-- ---------------------------------------------------------------------
-- 2. departments — ภาควิชา (faculty_id ต้องตรงกับข้อ 1)
-- ⚠️ สมมติ: ต้องแทนที่ด้วยรายชื่อภาควิชาจริง
-- ---------------------------------------------------------------------
INSERT INTO departments (department_id, faculty_id, name) VALUES
  -- คณะวิศวกรรมศาสตร์ (1)
  (1,  1, 'วิศวกรรมคอมพิวเตอร์'),
  (2,  1, 'วิศวกรรมไฟฟ้า'),
  (3,  1, 'วิศวกรรมเครื่องกล'),
  (4,  1, 'วิศวกรรมโยธา'),
  (5,  1, 'วิศวกรรมอุตสาหการ'),
  -- คณะวิทยาศาสตร์ (2)
  (6,  2, 'วิทยาการคอมพิวเตอร์'),
  (7,  2, 'คณิตศาสตร์'),
  (8,  2, 'เคมี'),
  (9,  2, 'ฟิสิกส์'),
  (10, 2, 'ชีววิทยา'),
  -- คณะเกษตร (3)
  (11, 3, 'พืชไร่นา'),
  (12, 3, 'สัตวบาล'),
  (13, 3, 'โรคพืช'),
  -- คณะบริหารธุรกิจ (4)
  (14, 4, 'การตลาด'),
  (15, 4, 'การเงิน'),
  (16, 4, 'การจัดการ'),
  (17, 4, 'บัญชี'),
  -- คณะมนุษยศาสตร์ (5)
  (18, 5, 'ภาษาอังกฤษ'),
  (19, 5, 'ภาษาไทย'),
  (20, 5, 'ปรัชญาและศาสนา'),
  -- คณะสังคมศาสตร์ (6)
  (21, 6, 'รัฐศาสตร์'),
  (22, 6, 'นิติศาสตร์'),
  (23, 6, 'จิตวิทยา'),
  (24, 6, 'สังคมวิทยาและมานุษยวิทยา'),
  -- คณะศึกษาศาสตร์ (7)
  (25, 7, 'พลศึกษา'),
  (26, 7, 'การสอนคณิตศาสตร์'),
  (27, 7, 'การสอนวิทยาศาสตร์'),
  -- คณะเศรษฐศาสตร์ (8)
  (28, 8, 'เศรษฐศาสตร์'),
  (29, 8, 'เศรษฐศาสตร์เกษตร'),
  (30, 8, 'สหกรณ์')
AS new
ON DUPLICATE KEY UPDATE name = new.name, faculty_id = new.faculty_id;


-- ---------------------------------------------------------------------
-- 3. sport_types — ประเภทกีฬา
--
-- min_members / max_members ใช้ที่ไหน:
--   - BR-05 / T01  ตอนสร้างทีม (ทีมมีสมาชิกเกิน max ไม่ได้)
--   - BR-09 / P01  ทีมต้อง Ready (สมาชิก >= min) ก่อนสมัครแข่ง
-- default_mode ใช้ที่ไหน:
--   - BR-11 / BR-13  ตัดสินว่าใครส่งผลได้ + ต้องมีกรรมการกี่คน
--     onsite = แข่งในสนามจริง · online = แข่งออนไลน์ (e-sport)
--
-- walkover_score = สกอร์ที่บันทึกเมื่อชนะบาย (migration 011) — ใช้ตอนทีมถอนตัว / เช็คอินไม่ถึง min_members
-- ⚠️⚠️ ตัวเลข min/max ทั้งหมดเป็นค่าสมมติ — GUIDE/07 ข้อ E1 ยังไม่มีคำตอบจริง
--      (min = ผู้เล่นในสนาม · max = รวมตัวสำรองแล้ว)
-- ---------------------------------------------------------------------
-- มติทีม 17 ก.ย. 2569: เหลือ 5 กีฬา id 1–5 (ฟุตบอล, บาสเกตบอล, แบดมินตัน, RoV, VALORANT)
-- ⚠️ เครื่องที่ seed เวอร์ชันเก่า (9 กีฬา id 1–9) ต้อง remap ก่อน — ดู database/migrations/010_sport_types_renumber.sql
INSERT INTO sport_types (sport_type_id, name, min_members, max_members, default_mode, walkover_score) VALUES
  (1, 'ฟุตบอล',           11, 18, 'onsite', JSON_OBJECT('winner', 3,  'loser', 0)),   -- FIFA 3–0
  (2, 'บาสเกตบอล',         5, 12, 'onsite', JSON_OBJECT('winner', 20, 'loser', 0)),   -- FIBA 20–0
  (3, 'แบดมินตัน',         2,  4, 'onsite', JSON_OBJECT('winner', 2,  'loser', 0)),   -- 2–0 เกม
  (4, 'E-Sport: RoV',      5,  7, 'online', JSON_OBJECT('winner', 2,  'loser', 0)),   -- BO3 2–0
  (5, 'E-Sport: VALORANT', 5,  7, 'online', JSON_OBJECT('winner', 2,  'loser', 0))    -- BO3 2–0 แมพ
AS new
ON DUPLICATE KEY UPDATE
  name = new.name,
  min_members = new.min_members,
  max_members = new.max_members,
  default_mode = new.default_mode,
  walkover_score = new.walkover_score;


-- ---------------------------------------------------------------------
-- 4. sport_stat_definitions — สถิติที่แต่ละกีฬาต้องกรอก (R05 / S06)
--
-- data_type มีแค่ 'integer' (migration 020 ตัด decimal/boolean ออก — OD-18)
--    เพราะ player_match_stat_values มีแค่คอลัมน์ value_int และ S06 บวกสะสม
--
-- display_order = ลำดับที่ frontend เรียงฟอร์มให้กรรมการกรอก
-- ---------------------------------------------------------------------
INSERT INTO sport_stat_definitions
  (sport_stat_definition_id, sport_type_id, stat_key, stat_label_th, data_type, display_order) VALUES
  -- ฟุตบอล (1)
  (1,  1, 'goals',        'ประตู',        'integer', 1),
  (2,  1, 'assists',      'แอสซิสต์',     'integer', 2),
  (3,  1, 'yellow_cards', 'ใบเหลือง',     'integer', 3),
  (4,  1, 'red_cards',    'ใบแดง',        'integer', 4),
  -- บาสเกตบอล (2)
  (5,  2, 'points',       'แต้ม',         'integer', 1),
  (6,  2, 'rebounds',     'รีบาวด์',      'integer', 2),
  (7,  2, 'assists',      'แอสซิสต์',     'integer', 3),
  (8,  2, 'fouls',        'ฟาวล์',        'integer', 4),
  -- แบดมินตัน (3)
  (9,  3, 'points',       'แต้ม',         'integer', 1),
  -- E-Sport: RoV (4)
  (10, 4, 'kills',        'สังหาร',       'integer', 1),
  (11, 4, 'deaths',       'ตาย',          'integer', 2),
  (12, 4, 'assists',      'ช่วยสังหาร',   'integer', 3),
  -- E-Sport: VALORANT (5)
  (13, 5, 'kills',        'สังหาร',       'integer', 1),
  (14, 5, 'deaths',       'ตาย',          'integer', 2),
  (15, 5, 'assists',      'ช่วยสังหาร',   'integer', 3)
AS new
ON DUPLICATE KEY UPDATE
  stat_label_th = new.stat_label_th,
  data_type = new.data_type,
  display_order = new.display_order;
