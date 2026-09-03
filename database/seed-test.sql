-- =====================================================================
-- LTMS — ข้อมูลทดสอบ (Test Fixture)  ⚠️ ห้ามขึ้น production
-- =====================================================================
-- ต่างจาก seed.sql ตรงไหน:
--   seed.sql       = ข้อมูลจริงที่ระบบต้องมีถึงจะทำงานได้ (คณะ/กีฬา)  → ขึ้น production
--   seed-test.sql  = ข้อมูลปลอมไว้ทดสอบ endpoint                      → ลบทิ้งได้ตลอด
--
-- ทุก id ใช้เลข 9000+ เพื่อไม่ชนกับข้อมูลจริง และลบง่าย
-- รหัสผ่านของทุก user ทดสอบ = abcd1234
--
-- วิธีรัน:
--   docker exec -i ltms-mysql mysql --default-character-set=utf8mb4 -uroot -psecret ltms < database/seed-test.sql
--
-- วิธีลบทิ้ง (อยู่ท้ายไฟล์ ให้ copy ไปรันแยก):
--   DELETE FROM team_members WHERE team_id >= 9000;
--   DELETE FROM teams        WHERE team_id >= 9000;
--   DELETE FROM player_profile_stats WHERE user_id >= 9000;
--   DELETE FROM users        WHERE user_id >= 9000;
-- =====================================================================


-- ---------------------------------------------------------------------
-- ผู้ใช้ทดสอบ 3 คน (รหัสผ่านทุกคน = abcd1234)
-- ---------------------------------------------------------------------
INSERT INTO users
  (user_id, full_name, email, password_hash, gender, birth_date, user_type, faculty_id, department_id, year, profile_image_key)
VALUES
  (9001, 'สมชาย ใจดี',    'somchai@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male',   '2004-05-01', 'student', 1, 1, 3, 'avatars/9001.jpg'),
  (9002, 'สมหญิง รักเรียน','somying@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2005-02-14', 'student', 2, 6, 2, NULL),
  (9003, 'มานะ ไร้ทีม',    'mana@ku.th',    '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male',   '2003-11-30', 'student', 8, 30, 4, NULL)
AS new
ON DUPLICATE KEY UPDATE full_name = new.full_name;


-- ---------------------------------------------------------------------
-- ทีมทดสอบ 4 ทีม
--   9001 ทีมปกติ · 9002 ทีมปกติ (คนละกีฬา) · 9003 ทีมที่ถูกลบแล้ว · 9004 ทีมของ 9002
-- ---------------------------------------------------------------------
INSERT INTO teams (team_id, name, sport_type_id, leader_id, readiness_status, deleted_at, deleted_reason)
VALUES
  (9001, 'ทีมวิศวะ FC',     1, 9001, 'Ready',   NULL, NULL),
  (9002, 'ทีมบาสวิศวะ',      3, 9001, 'Forming', NULL, NULL),
  (9003, 'ทีมเก่าที่ถูกลบ',   2, 9001, 'Forming', NOW(), 'leader_deleted'),
  (9004, 'ทีมวอลเลย์วิทยา',  4, 9002, 'Ready',   NULL, NULL)
AS new
ON DUPLICATE KEY UPDATE name = new.name, deleted_at = new.deleted_at, deleted_reason = new.deleted_reason;


-- ---------------------------------------------------------------------
-- สมาชิกทีม
--   สมชาย(9001) อยู่ 3 ทีม แต่ทีม 9003 ถูกลบ → U03 ต้องคืนแค่ 2 ทีม
--   สมหญิง(9002) อยู่ 2 ทีม (ทีมของตัวเอง + ทีมบาสของสมชาย)
--   มานะ(9003)  ไม่อยู่ทีมไหนเลย → U03 ต้องคืน teams: []
-- ---------------------------------------------------------------------
INSERT INTO team_members (team_member_id, team_id, user_id, position)
VALUES
  (9001, 9001, 9001, 'starter'),
  (9002, 9002, 9001, 'starter'),
  (9003, 9003, 9001, 'starter'),
  (9004, 9004, 9002, 'starter'),
  (9005, 9002, 9002, 'substitute')
AS new
ON DUPLICATE KEY UPDATE position = new.position;


-- ---------------------------------------------------------------------
-- สถิติผู้เล่น — เตรียมไว้สำหรับ U04 GET /users/:id/stats
--   สมชาย(9001) มีสถิติ 2 กีฬา · สมหญิง(9002) มี 1 กีฬาแต่ยังไม่เคยลงแข่ง (matches_played = 0)
--   มานะ(9003)  ไม่มีแถวเลย → U04 ต้องคืน overall 0 ทั้งหมด + bySport []
--   ★ 9002 คือเคสทดสอบ winRate หารด้วยศูนย์
-- ---------------------------------------------------------------------
INSERT INTO player_profile_stats
  (player_profile_stat_id, user_id, sport_type_id, matches_played, wins, losses, championships)
VALUES
  (9001, 9001, 1, 10, 7, 3, 1),
  (9002, 9001, 3,  4, 1, 3, 0),
  (9003, 9002, 4,  0, 0, 0, 0)
AS new
ON DUPLICATE KEY UPDATE
  matches_played = new.matches_played, wins = new.wins,
  losses = new.losses, championships = new.championships;
