-- =====================================================================
-- LTMS — MySQL Schema (36 ตาราง)
-- =====================================================================
-- ที่มา: database/ltms_database.md — "LTMS Database Design Document
--        (ฉบับ 2 — MySQL Only)" รอบที่ 4 · 2 สิงหาคม 2569
--        + `rewards.is_active` จากรอบที่ 5
--
-- ไฟล์นี้ถอดจาก DDL ต้นฉบับใน .md โดยตรง ไม่ได้เดาจากรูป ER diagram
-- (ไฟล์เดิมที่แปลงจากรูป เก็บไว้ที่ schema.sql.old — มี ENUM ผิด 22 จุด)
--
-- สิ่งที่เพิ่มจากต้นฉบับ (ต้นฉบับไม่ได้ระบุ แต่จำเป็นตอนรันจริง):
--   - ENGINE=InnoDB + utf8mb4 ทุกตาราง
--   - จัดลำดับ CREATE TABLE ใหม่ให้ FK ไม่ชี้ไปตารางที่ยังไม่มี
--   - FK ของ bracket_nodes.match_id ย้ายไปเป็น ALTER ท้ายไฟล์
--     (เพราะ matches กับ bracket_nodes อ้างถึงกันและกัน)
--   - ย้ายตำแหน่งคอลัมน์ tournament_feedback.match_key ให้อยู่หลัง match_id
--     (generated column — ลำดับคอลัมน์ไม่กระทบความหมาย)
--
-- หมายเหตุ: `updated_at` ทุกตารางเป็น DATETIME NULL ตามต้นฉบับ
--   ไม่ใช่ ON UPDATE CURRENT_TIMESTAMP → backend ต้อง SET เองทุกครั้งที่แก้
-- =====================================================================

SET NAMES utf8mb4;

-- =====================================================================
-- กลุ่ม 1 — ข้อมูลอ้างอิง  (ltms_database.md §1)
-- =====================================================================

CREATE TABLE faculties (
  faculty_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE departments (
  department_id INT PRIMARY KEY AUTO_INCREMENT,
  faculty_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  FOREIGN KEY (faculty_id) REFERENCES faculties(faculty_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sport_types (
  sport_type_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  min_members INT NOT NULL,
  max_members INT NOT NULL,
  default_mode ENUM('onsite','online') NOT NULL DEFAULT 'onsite'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- กลุ่ม 2 — ผู้ใช้และสิทธิ์  (§2)
-- =====================================================================

CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  gender ENUM('male','female','other') NOT NULL,
  birth_date DATE NOT NULL,
  user_type ENUM('student','staff','external') NOT NULL,
  faculty_id INT NULL,
  department_id INT NULL,
  year INT NULL,
  profile_image_key VARCHAR(255) NULL,
  contact_info VARCHAR(255) NULL,
  address TEXT NULL,
  is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  suspended_reason TEXT NULL,
  total_points INT NOT NULL DEFAULT 0,
  notification_prefs JSON NULL,
  profile_edit_log JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  -- ไม่มี created_by/updated_by/deleted_at โดยเจตนา:
  -- สมัครเอง แก้เอง · ใช้ is_suspended + suspended_reason แทน deleted_at
  FOREIGN KEY (faculty_id) REFERENCES faculties(faculty_id),
  FOREIGN KEY (department_id) REFERENCES departments(department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE password_reset_tokens (
  password_reset_token_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE admin_scopes (
  admin_scope_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  scope_type ENUM('faculty','university_wide') NOT NULL,
  faculty_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (faculty_id) REFERENCES faculties(faculty_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- กลุ่ม 3 — ทีม  (§3)
-- =====================================================================

CREATE TABLE teams (
  team_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  sport_type_id INT NOT NULL,
  leader_id INT NOT NULL,
  readiness_status ENUM('Forming','Ready') NOT NULL DEFAULT 'Forming',
  official_status ENUM('Unofficial','Official') NOT NULL DEFAULT 'Unofficial',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  last_competed_at DATETIME NULL,
  deleted_at DATETIME NULL,
  deleted_reason ENUM('no_registration','leader_deleted','inactive_6_months') NULL,
  -- ไม่มี created_by/deleted_by: leader_id แทน created_by,
  -- deleted_reason แทน deleted_by (บอกอยู่แล้วว่า leader ลบเองหรือระบบลบ)
  FOREIGN KEY (sport_type_id) REFERENCES sport_types(sport_type_id),
  FOREIGN KEY (leader_id) REFERENCES users(user_id),
  UNIQUE (name, sport_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE team_members (
  team_member_id INT PRIMARY KEY AUTO_INCREMENT,
  team_id INT NOT NULL,
  user_id INT NOT NULL,
  position ENUM('starter','substitute') NOT NULL DEFAULT 'starter',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  UNIQUE (team_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE team_invitations (
  team_invitation_id INT PRIMARY KEY AUTO_INCREMENT,
  team_id INT NOT NULL,
  invited_user_id INT NOT NULL,
  invited_by_user_id INT NOT NULL,
  team_invitation_status ENUM('pending','accepted','rejected','expired') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,
  -- ⚠️ ไม่มี expires_at ทั้งในต้นฉบับและ ERD แต่ API (T09/T12/T13) ต้องใช้
  --    ดู GUIDE/07 ข้อ 1.3 — ต้องถามทีมก่อนเพิ่ม
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (invited_user_id) REFERENCES users(user_id),
  FOREIGN KEY (invited_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE team_admin_requests (
  team_admin_request_id INT PRIMARY KEY AUTO_INCREMENT,
  team_id INT NOT NULL,
  request_type ENUM('official_status','leader_transfer') NOT NULL,
  requested_by INT NOT NULL,
  target_user_id INT NULL,
  team_admin_request_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  rejection_reason TEXT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (requested_by) REFERENCES users(user_id),
  FOREIGN KEY (target_user_id) REFERENCES users(user_id),
  FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE player_profile_stats (
  player_profile_stat_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  sport_type_id INT NOT NULL,
  matches_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  championships INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (sport_type_id) REFERENCES sport_types(sport_type_id),
  UNIQUE (user_id, sport_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE official_team_memberships (
  official_team_membership_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  sport_type_id INT NOT NULL,
  team_id INT NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (sport_type_id) REFERENCES sport_types(sport_type_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  UNIQUE (user_id, sport_type_id)   -- บังคับ BR-05 ที่ระดับ DB
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- กลุ่ม 4 — ทัวร์นาเมนต์  (§4)
-- =====================================================================

CREATE TABLE tournaments (
  tournament_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  sport_type_id INT NOT NULL,
  bracket_format ENUM('single_elimination','double_elimination','round_robin') NULL,
  scope_type ENUM('department','faculty','university') NOT NULL,  -- ⚠️ 'university' รอ Change Management
  organizing_faculty_id INT NULL,
  organizing_department_id INT NULL,
  requested_by_user_id INT NOT NULL,
  organizer_external_approval_status ENUM('not_required','pending','approved','rejected') NOT NULL DEFAULT 'not_required',  -- ⚠️ external Organizer รอ Change Management
  organizer_external_reviewed_by INT NULL,
  organizer_external_reviewed_at DATETIME NULL,
  organizer_external_rejection_reason TEXT NULL,
  organizer_external_verification_docs JSON NULL,
  tournament_status ENUM('pending_approval','rejected','private','public','completed','auto_deleted') NOT NULL DEFAULT 'pending_approval',
  registration_open BOOLEAN NOT NULL DEFAULT FALSE,
  registration_start DATETIME NULL,
  registration_end DATETIME NULL,
  event_start_date DATE NOT NULL,
  event_end_date DATE NULL,
  max_teams INT NOT NULL,
  min_teams INT NOT NULL,
  venue VARCHAR(255) NULL,
  dispute_window_hours INT NOT NULL DEFAULT 24,
  gender_requirement ENUM('any','male','female') NOT NULL DEFAULT 'any',
  min_age INT NULL,
  max_age INT NULL,
  rejection_reason TEXT NULL,
  approved_by INT NULL,
  approved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  updated_by INT NULL,
  deleted_at DATETIME NULL,
  deleted_by INT NULL,   -- NULL = auto_deleted (ระบบ) · มีค่า = Admin สั่งลบ
  -- Organizer ไม่มีสิทธิ์ลบทัวร์นาเมนต์เอง มีแค่ unpublish (private ↔ public)
  -- ⚠️ ไม่มีคอลัมน์ description แต่ C08 (PATCH /tournaments/:id) รับ field นี้ — ดู GUIDE/07
  FOREIGN KEY (sport_type_id) REFERENCES sport_types(sport_type_id),
  FOREIGN KEY (organizing_faculty_id) REFERENCES faculties(faculty_id),
  FOREIGN KEY (organizing_department_id) REFERENCES departments(department_id),
  FOREIGN KEY (requested_by_user_id) REFERENCES users(user_id),
  FOREIGN KEY (organizer_external_reviewed_by) REFERENCES users(user_id),
  FOREIGN KEY (approved_by) REFERENCES users(user_id),
  FOREIGN KEY (updated_by) REFERENCES users(user_id),
  FOREIGN KEY (deleted_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tournament_eligibility_rules (
  tournament_eligibility_rule_id INT PRIMARY KEY AUTO_INCREMENT,
  tournament_id INT NOT NULL,
  rule_type ENUM('year','faculty') NOT NULL,
  rule_value INT NOT NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  UNIQUE (tournament_id, rule_type, rule_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tournament_amendment_requests (
  tournament_amendment_request_id INT PRIMARY KEY AUTO_INCREMENT,
  tournament_id INT NOT NULL,
  requested_by INT NOT NULL,
  requested_changes JSON NOT NULL,
  tournament_amendment_request_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  rejection_reason TEXT NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (requested_by) REFERENCES users(user_id),
  FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- กลุ่ม 5 — กรรมการ  (§5)
-- =====================================================================

-- "แต่งตั้งเป็นกรรมการของทัวร์นาเมนต์" — ตอบรับครั้งเดียว ใช้ได้ทุกแมตช์ที่มอบหมายภายหลัง
-- ★ เชิญได้ไม่จำกัดจำนวนครั้ง — ไม่มี UNIQUE(tournament_id, user_id) โดยเจตนา
-- ★ ทุก query ตรวจสิทธิ์ต้องดึงแถวล่าสุดเสมอ: ORDER BY created_at DESC LIMIT 1
CREATE TABLE tournament_referees (
  tournament_referee_id INT PRIMARY KEY AUTO_INCREMENT,
  tournament_id INT NOT NULL,
  user_id INT NOT NULL,
  invited_by INT NOT NULL,
  invitation_status ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  is_external BOOLEAN NOT NULL DEFAULT FALSE,
  external_approval_status ENUM('not_required','pending','approved','rejected') NOT NULL DEFAULT 'not_required',
  approved_by INT NULL,
  approved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at DATETIME NULL,
  removed_by INT NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (invited_by) REFERENCES users(user_id),
  FOREIGN KEY (approved_by) REFERENCES users(user_id),
  FOREIGN KEY (removed_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- กลุ่ม 6 — การสมัครแข่งขัน  (§6)
-- =====================================================================

CREATE TABLE tournament_applications (
  tournament_application_id INT PRIMARY KEY AUTO_INCREMENT,
  tournament_id INT NOT NULL,
  team_id INT NOT NULL,
  hard_filter_passed BOOLEAN NULL,
  hard_filter_details JSON NULL,
  soft_filter_documents JSON NULL,   -- array ของ S3 key (รูปบัตรนิสิต/บัตรประชาชนเท่านั้น)
  tournament_application_status ENUM('pending','approved','rejected','cancelled','withdrawn') NOT NULL DEFAULT 'pending',
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  rejection_reason TEXT NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- ไม่มี applied_by: track ผ่าน team_id -> teams.leader_id ได้อยู่แล้ว
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (reviewed_by) REFERENCES users(user_id),
  UNIQUE (tournament_id, team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- กลุ่ม 7 — สายการแข่งขัน  (§7 — แทนที่ MongoDB brackets collection)
-- =====================================================================

-- เก็บ "หน้าตาสำหรับวาดภาพ bracket" เท่านั้น
-- การตัดสินว่าทีมไหนไปแข่งกับใครต่อ อยู่ที่ matches.next_match_id (source of truth เดียว)
CREATE TABLE bracket_nodes (
  bracket_node_id INT PRIMARY KEY AUTO_INCREMENT,
  tournament_id INT NOT NULL,
  node_code VARCHAR(30) NOT NULL,   -- "W-R1-M1" ไว้อ่านง่าย ไม่ใช้อ้างอิงจริง
  bracket_type ENUM('winners','losers','grand_final') NOT NULL,
  -- Single Elimination ใช้แค่ 'winners' · Double Elimination ใช้ครบ 3 ค่า
  -- Round Robin ไม่ใช้ตารางนี้เลย
  round INT NULL,                   -- NULL สำหรับ grand_final
  match_number INT NOT NULL,
  team_a_id INT NULL,
  team_b_id INT NULL,
  match_id INT NULL,                -- เติมทีหลังตอนแมตช์จริงถูกสร้าง · FK เพิ่มท้ายไฟล์
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (team_a_id) REFERENCES teams(team_id),
  FOREIGN KEY (team_b_id) REFERENCES teams(team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- กลุ่ม 8 — แมตช์และผลการแข่งขัน  (§8)
-- =====================================================================

-- ⚠️ match_id เป็น PK ที่ชื่อซ้ำกับ FK ในตารางอื่นที่ชี้มาหา
--    ต้องใช้ table alias เสมอตอน JOIN (m.match_id vs mr.match_id)
CREATE TABLE matches (
  match_id INT PRIMARY KEY AUTO_INCREMENT,
  tournament_id INT NOT NULL,
  bracket_node_id INT NULL,
  next_match_id INT NULL,             -- source of truth ของ "ผู้ชนะไปแข่งต่อที่ไหน"
  loser_next_match_id INT NULL,       -- เฉพาะ Double Elimination
  round_number INT NULL,
  team_a_id INT NULL,
  team_b_id INT NULL,
  scheduled_time DATETIME NULL,
  venue VARCHAR(255) NULL,
  checkin_open_at DATETIME NULL,
  match_status ENUM('scheduled','checkin_open','in_progress','completed','disputed') NOT NULL DEFAULT 'scheduled',
  mode ENUM('onsite','online') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  -- ⚠️ ไม่มี livestream_url แต่ E12 (PUT /matches/:id/livestream) ต้องใช้ — ดู GUIDE/07
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (bracket_node_id) REFERENCES bracket_nodes(bracket_node_id),
  FOREIGN KEY (team_a_id) REFERENCES teams(team_id),
  FOREIGN KEY (team_b_id) REFERENCES teams(team_id),
  FOREIGN KEY (next_match_id) REFERENCES matches(match_id),
  FOREIGN KEY (loser_next_match_id) REFERENCES matches(match_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- มอบหมายกรรมการเข้าแมตช์ — ไม่มี invitation_status ซ้ำ
-- สถานะตอบรับอยู่ที่ tournament_referees เพียงที่เดียว
CREATE TABLE match_referees (
  match_referee_id INT PRIMARY KEY AUTO_INCREMENT,
  match_id INT NOT NULL,
  tournament_referee_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (tournament_referee_id) REFERENCES tournament_referees(tournament_referee_id),
  UNIQUE (match_id, tournament_referee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE match_checkins (
  match_checkin_id INT PRIMARY KEY AUTO_INCREMENT,
  match_id INT NOT NULL,
  user_id INT NOT NULL,
  method ENUM('qr_onsite','photo_online','manual_by_referee') NOT NULL,
  match_checkin_status ENUM('success','rejected','exception') NOT NULL,
  rejection_reason VARCHAR(255) NULL,
  document_type ENUM('student_id','national_id') NULL,
  document_s3_key VARCHAR(255) NULL,
  verified_by_referee_id INT NULL,   -- ★ ชี้ไป users ไม่ใช่ tournament_referees
  checked_in_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at DATETIME NULL,         -- เวลาที่กรรมการตรวจ (โหมด photo_online)
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (verified_by_referee_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ★ match_id เป็น UNIQUE — S01 (POST /matches/:id/result) พึ่งข้อนี้ทำ idempotency
--   ส่งผลซ้ำ = UPDATE แถวเดิม ไม่ใช่สร้างแถวใหม่ (Part 0-1 §1.11)
CREATE TABLE match_results (
  match_result_id INT PRIMARY KEY AUTO_INCREMENT,
  match_id INT NOT NULL UNIQUE,
  winner_team_id INT NULL,
  score_data JSON NULL,              -- โครงสร้างคงที่ ไม่แตกตารางเหมือน player_match_stats
  submitted_by_user_id INT NOT NULL,
  submitted_role ENUM('team_leader','referee') NOT NULL,
  match_result_status ENUM('submitted','verified','disputed','rejected') NOT NULL DEFAULT 'submitted',
  dispute_reason TEXT NULL,
  dispute_raised_by INT NULL,
  dispute_raised_at DATETIME NULL,   -- ใช้เช็ค dispute_window_hours (BR-14)
  dispute_resolved_by INT NULL,
  dispute_resolution TEXT NULL,
  dispute_resolved_at DATETIME NULL,
  verified_by_user_id INT NULL,
  verified_at DATETIME NULL,
  amended_by_user_id INT NULL,
  amend_reason TEXT NULL,
  amended_at DATETIME NULL,          -- isAmended = (amended_at IS NOT NULL)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- กฎระดับ application: เมื่อ status เป็น 'disputed' ต้อง
  -- UPDATE matches SET match_status='disputed' ในทรานแซกชันเดียวกันเสมอ
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (winner_team_id) REFERENCES teams(team_id),
  FOREIGN KEY (submitted_by_user_id) REFERENCES users(user_id),
  FOREIGN KEY (dispute_raised_by) REFERENCES users(user_id),
  FOREIGN KEY (dispute_resolved_by) REFERENCES users(user_id),
  FOREIGN KEY (verified_by_user_id) REFERENCES users(user_id),
  FOREIGN KEY (amended_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- กลุ่ม 9 — สถิติผู้เล่นรายแมตช์  (§9 — แตกจาก JSON เป็น 3 ตาราง)
-- =====================================================================

-- "กติกา" — กีฬาไหนเก็บสถิติอะไรบ้าง
CREATE TABLE sport_stat_definitions (
  sport_stat_definition_id INT PRIMARY KEY AUTO_INCREMENT,
  sport_type_id INT NOT NULL,
  stat_key VARCHAR(50) NOT NULL,        -- 'goals', 'assists', 'yellow_cards'
  stat_label_th VARCHAR(100) NOT NULL,  -- 'ประตู', 'แอสซิสต์', 'ใบเหลือง'
  data_type ENUM('integer','decimal','boolean') NOT NULL DEFAULT 'integer',
  display_order INT NOT NULL DEFAULT 0,
  -- ⚠️ player_match_stat_values มีแค่ value_int → decimal/boolean ยังเก็บไม่ได้จริง
  FOREIGN KEY (sport_type_id) REFERENCES sport_types(sport_type_id),
  UNIQUE (sport_type_id, stat_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- "หัวเรื่อง" — ใครเล่นแมตช์ไหน กรรมการคนไหนบันทึกให้
CREATE TABLE player_match_stats (
  player_match_stat_id INT PRIMARY KEY AUTO_INCREMENT,
  match_id INT NOT NULL,
  user_id INT NOT NULL,
  team_id INT NOT NULL,
  recorded_by_referee_id INT NOT NULL,   -- ★ ชี้ไป users ไม่ใช่ tournament_referees
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- แก้สถิติย้อนหลังบันทึกที่ audit_logs (action_type='stat_corrected')
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (recorded_by_referee_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- "ตัวเลขจริง" แต่ละสถิติ
CREATE TABLE player_match_stat_values (
  player_match_stat_value_id INT PRIMARY KEY AUTO_INCREMENT,
  player_match_stat_id INT NOT NULL,
  sport_stat_definition_id INT NOT NULL,
  value_int INT NULL,
  FOREIGN KEY (player_match_stat_id) REFERENCES player_match_stats(player_match_stat_id),
  FOREIGN KEY (sport_stat_definition_id) REFERENCES sport_stat_definitions(sport_stat_definition_id),
  UNIQUE (player_match_stat_id, sport_stat_definition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- กลุ่ม 10 — Dashboard / Leaderboard  (§10)
-- =====================================================================

CREATE TABLE tournament_standings (
  standing_id INT PRIMARY KEY AUTO_INCREMENT,
  tournament_id INT NOT NULL,
  team_id INT NOT NULL,
  played INT NOT NULL DEFAULT 0,
  won INT NOT NULL DEFAULT 0,
  lost INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  UNIQUE (tournament_id, team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- กลุ่ม 11 — การมีส่วนร่วม  (§11)
-- =====================================================================

CREATE TABLE follows (
  follow_id INT PRIMARY KEY AUTO_INCREMENT,
  follower_user_id INT NOT NULL,
  followed_user_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (follower_user_id) REFERENCES users(user_id),
  FOREIGN KEY (followed_user_id) REFERENCES users(user_id),
  UNIQUE (follower_user_id, followed_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notifications (
  notification_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_entity_type VARCHAR(50) NULL,
  related_entity_id INT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- ไม่มี created_by: ระบบสร้างเองทั้งหมด ไม่มี endpoint ให้ผู้ใช้สร้าง
  FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE announcements (
  announcement_id INT PRIMARY KEY AUTO_INCREMENT,
  tournament_id INT NOT NULL,
  match_id INT NULL,
  created_by INT NOT NULL,
  announcement_type ENUM('general','schedule_change','venue_change','result','livestream') NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  updated_by INT NULL,
  deleted_at DATETIME NULL,
  deleted_by INT NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  FOREIGN KEY (updated_by) REFERENCES users(user_id),
  FOREIGN KEY (deleted_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- match_key เป็น generated column — แก้ปัญหา MySQL ที่ถือว่า NULL แต่ละแถวต่างกัน
-- ทำให้ UNIQUE กันโหวตซ้ำระดับทัวร์นาเมนต์ (match_id IS NULL) ได้จริง
CREATE TABLE tournament_feedback (
  tournament_feedback_id INT PRIMARY KEY AUTO_INCREMENT,
  tournament_id INT NOT NULL,
  user_id INT NOT NULL,
  feedback_type ENUM('comment','organizer_feedback','mvp_vote') NOT NULL,
  content TEXT NULL,
  rating INT NULL,
  voted_for_user_id INT NULL,
  match_id INT NULL,
  match_key INT AS (IFNULL(match_id, 0)) STORED,
  is_reported BOOLEAN NOT NULL DEFAULT FALSE,
  removed_at DATETIME NULL,
  removed_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- ไม่มี updated_at: ห้ามแก้เนื้อหา เขียนครั้งเดียวจบเหมือน ledger
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (voted_for_user_id) REFERENCES users(user_id),
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (removed_by) REFERENCES users(user_id),
  UNIQUE (tournament_id, match_key, user_id, feedback_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tournament_questions (
  tournament_question_id INT PRIMARY KEY AUTO_INCREMENT,
  tournament_id INT NOT NULL,
  asked_by INT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NULL,
  answered_by INT NULL,
  answered_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (asked_by) REFERENCES users(user_id),
  FOREIGN KEY (answered_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- กลุ่ม 12 — Pick'em และรางวัล  (§12)
-- =====================================================================

CREATE TABLE pickem_predictions (
  pickem_prediction_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  match_id INT NOT NULL,
  predicted_winner_team_id INT NOT NULL,
  points_earned INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (predicted_winner_team_id) REFERENCES teams(team_id),
  UNIQUE (user_id, match_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE rewards (
  reward_id INT PRIMARY KEY AUTO_INCREMENT,
  reward_type ENUM('badge','achievement') NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  points_required INT NULL,
  criteria JSON NULL,
  icon_key VARCHAR(255) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,   -- DELETE = UPDATE is_active=false ไม่ใช่ลบจริง
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_rewards (
  user_reward_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  reward_id INT NOT NULL,
  earned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_displayed BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (reward_id) REFERENCES rewards(reward_id),
  UNIQUE (user_id, reward_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE point_transactions (
  point_transaction_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  amount INT NOT NULL,
  source ENUM('pickem_correct','reward_redeem','admin_adjustment','other') NOT NULL,
  ref_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- ห้ามมี updated_at: ledger เขียนครั้งเดียว แก้ผิดต้องสร้างรายการชดเชยใหม่
  FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- กลุ่ม 13 — Audit Log  (§13)
-- =====================================================================

CREATE TABLE audit_logs (
  audit_log_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  details JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- ตัวมันเองคือ audit ไม่ต้องมี audit ซ้อน audit
  FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- FK ที่ต้องเติมท้ายสุด — bracket_nodes กับ matches อ้างถึงกันและกัน
-- =====================================================================

ALTER TABLE bracket_nodes
  ADD FOREIGN KEY (match_id) REFERENCES matches(match_id);
