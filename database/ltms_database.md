# LTMS — Database Design Document (ฉบับ 2 — MySQL Only)

> **★★★ Changelog ใหญ่ — 2 สิงหาคม 2569 (รอบที่ 4) ★★★**
> เปลี่ยนสถาปัตยกรรมครั้งใหญ่ตามผลตรวจสอบ 17 ข้อ (design review) สรุปการเปลี่ยนแปลงหลัก:
>
> 1. **ยุบ MongoDB Atlas ทิ้งทั้งหมด** — ระบบเหลือ MySQL ตัวเดียว (ขัดกับ DC-04 เดิมของ SRS ที่บังคับใช้ 2 ฐานข้อมูล **ต้องผ่าน Change Management ก่อนใช้งานจริง**)
> 2. **เพิ่มตาราง `bracket_nodes`** แทนที่ MongoDB `brackets` collection — เก็บโครงสร้างสายการแข่งขันเป็นแถวในตาราง SQL ปกติ
> 3. **Primary Key ทุกตารางเปลี่ยนจาก `id` เป็น `{tablename}_id`** เพื่อความสม่ำเสมอทั้งระบบ และให้ JOIN อ่านง่ายขึ้น (API response ยังคงส่ง `id` เหมือนเดิม — mapper ที่ backend แปลงให้ ไม่กระทบ frontend)
> 4. **คอลัมน์ `status` เปลี่ยนชื่อเป็น `{tablename}_status`** ทุกตารางที่มี (ค่า ENUM ข้างในไม่เปลี่ยน)
> 5. **Audit Trail** — เพิ่ม `_at`/`_by` ที่ขาดหายไปใน 11 ตาราง (ดูตารางสรุปหัวข้อ 0.2)
> 6. **`player_match_stats.stats` (JSON) ถูกแตกเป็น 3 ตาราง** เพื่อเลิกใช้ JSON column ตามหลักการ "Relational DB ไม่ควรเก็บ multi-structure JSON"
> 7. **`official_team_memberships`, `tournament_standings`, `player_profile_stats`, `user_rewards`** เปลี่ยนจาก composite PK เป็น PK เดี่ยว + UNIQUE constraint แทน
> 8. **`tournament_referees`** ตัด `UNIQUE(tournament_id, user_id)` ออก — เชิญกรรมการซ้ำได้ไม่จำกัดครั้ง (ทุก query ต้องดึงแถวล่าสุดด้วย `ORDER BY created_at DESC LIMIT 1`) + เพิ่ม soft delete (`removed_at`/`removed_by`)
>
> **สัญลักษณ์ที่ใช้ในเอกสารนี้:**
> - `🆕 ใหม่` = ตาราง/คอลัมน์ที่เพิ่มเข้ามาในรอบนี้ ไม่เคยมีมาก่อน
> - `♻️ เปลี่ยนชื่อ` = คอลัมน์เดิมที่แค่เปลี่ยนชื่อ ไม่เปลี่ยนความหมาย/ชนิดข้อมูล
> - `🔄 ย้ายจาก MongoDB` = ฟีเจอร์ที่เดิมอยู่ MongoDB แล้วย้ายมาเป็นตาราง MySQL ในรอบนี้
> - `⚠️` = จุดที่ต้องผ่าน Change Management ก่อนใช้งานจริง

---

## 0. สรุปภาพรวมก่อนเข้ารายละเอียด

### 0.1 จำนวนตารางเปลี่ยนจาก 33 → 36 ตาราง

| การเปลี่ยนแปลง | ตาราง | เหตุผล |
|---|---|---|
| 🆕 เพิ่มใหม่ | `bracket_nodes` | 🔄 แทนที่ MongoDB `brackets` collection ทั้งหมด |
| 🆕 เพิ่มใหม่ | `sport_stat_definitions` | แยกจาก JSON `stats` — นิยามว่ากีฬาไหนเก็บสถิติอะไร |
| 🆕 เพิ่มใหม่ | `player_match_stat_values` | แยกจาก JSON `stats` — ค่าตัวเลขจริงที่กรรมการบันทึก |
| ❌ ลบ (ย้ายไปตารางใหม่) | ~~`player_match_stats.stats`~~, ~~`player_match_stats.edit_log`~~ | เลิกใช้ JSON column ตามหลักการ |

### 0.2 ตารางที่เพิ่ม Audit Trail (11 ตาราง)

| ตาราง | เพิ่มคอลัมน์ |
|---|---|
| `team_admin_requests` | 🆕 `requested_at` |
| `tournament_amendment_requests` | 🆕 `requested_at` |
| `match_checkins` | 🆕 `verified_at` |
| `announcements` | 🆕 `updated_by`, 🆕 `deleted_by` |
| `match_results` | 🆕 `dispute_raised_at` |
| `tournaments` | 🆕 `updated_at`, 🆕 `updated_by`, 🆕 `deleted_by` |
| `tournament_feedback` | 🆕 `removed_at`, 🆕 `removed_by` (แทนที่ `is_removed` boolean) |
| `rewards` | 🆕 `created_at`, 🆕 `updated_at` |
| `teams` | 🆕 `updated_at` |
| `admin_scopes` | 🆕 `created_at`, 🆕 `created_by` |
| `matches` | 🆕 `updated_at` |

### 0.3 ตารางที่เปลี่ยน PK จาก Composite เป็นเดี่ยว (4 ตาราง)

```
official_team_memberships   PRIMARY KEY (user_id, sport_type_id) → official_team_membership_id + UNIQUE
tournament_standings        PRIMARY KEY (tournament_id, team_id) → standing_id + UNIQUE
player_profile_stats        PRIMARY KEY (user_id, sport_type_id) → player_profile_stat_id + UNIQUE
user_rewards                PRIMARY KEY (user_id, reward_id) → user_reward_id + UNIQUE
```

---

## 1. หมวดข้อมูลอ้างอิง (Reference Data)

```sql
CREATE TABLE faculties (
  faculty_id INT PRIMARY KEY AUTO_INCREMENT,          -- ♻️ เปลี่ยนชื่อจาก id
  name VARCHAR(150) NOT NULL
);

CREATE TABLE departments (
  department_id INT PRIMARY KEY AUTO_INCREMENT,       -- ♻️ เปลี่ยนชื่อจาก id
  faculty_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  FOREIGN KEY (faculty_id) REFERENCES faculties(faculty_id)
);

CREATE TABLE sport_types (
  sport_type_id INT PRIMARY KEY AUTO_INCREMENT,       -- ♻️ เปลี่ยนชื่อจาก id
  name VARCHAR(100) NOT NULL,
  min_members INT NOT NULL,
  max_members INT NOT NULL,
  default_mode ENUM('onsite','online') NOT NULL DEFAULT 'onsite'
);
```
> ไม่เพิ่ม audit trail — ข้อมูลนิ่งมาก แทบไม่เปลี่ยน (ตามผลตรวจ audit trail ข้อ 3)

---

## 2. หมวดผู้ใช้และสิทธิ์

```sql
CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,             -- ♻️ เปลี่ยนชื่อจาก id
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
  -- ไม่มี created_by/updated_by/deleted_at: สมัครเอง แก้เอง, ใช้ is_suspended+suspended_reason แทน deleted_at (ผลตรวจ audit trail)
  FOREIGN KEY (faculty_id) REFERENCES faculties(faculty_id),
  FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

CREATE TABLE password_reset_tokens (
  password_reset_token_id INT PRIMARY KEY AUTO_INCREMENT,  -- ♻️ เปลี่ยนชื่อจาก id
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE admin_scopes (
  admin_scope_id INT PRIMARY KEY AUTO_INCREMENT,      -- ♻️ เปลี่ยนชื่อจาก id
  user_id INT NOT NULL,
  scope_type ENUM('faculty','university_wide') NOT NULL,
  faculty_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 🆕 ใหม่ — ตารางความปลอดภัยสูง ต้องรู้ว่าตั้งเมื่อไหร่
  created_by INT NULL,                                     -- 🆕 ใหม่ — Admin คนไหนเป็นคนแต่งตั้ง Admin คนนี้
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (faculty_id) REFERENCES faculties(faculty_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id)
);
```

---

## 3. หมวดทีม

```sql
CREATE TABLE teams (
  team_id INT PRIMARY KEY AUTO_INCREMENT,             -- ♻️ เปลี่ยนชื่อจาก id
  name VARCHAR(150) NOT NULL,
  sport_type_id INT NOT NULL,
  leader_id INT NOT NULL,
  readiness_status ENUM('Forming','Ready') NOT NULL DEFAULT 'Forming',
  official_status ENUM('Unofficial','Official') NOT NULL DEFAULT 'Unofficial',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,                           -- 🆕 ใหม่ — แก้ชื่อทีมได้ผ่าน PATCH /teams/:id
  last_competed_at DATETIME NULL,
  deleted_at DATETIME NULL,
  deleted_reason ENUM('no_registration','leader_deleted','inactive_6_months') NULL,
  -- ไม่มี created_by/deleted_by: leader_id ทำหน้าที่แทน created_by,
  -- deleted_reason ทำหน้าที่แทน deleted_by (บอกอยู่แล้วว่า leader ลบเองหรือระบบลบอัตโนมัติ)
  FOREIGN KEY (sport_type_id) REFERENCES sport_types(sport_type_id),
  FOREIGN KEY (leader_id) REFERENCES users(user_id),
  UNIQUE (name, sport_type_id)
);

CREATE TABLE team_members (
  team_member_id INT PRIMARY KEY AUTO_INCREMENT,      -- ♻️ เปลี่ยนชื่อจาก id
  team_id INT NOT NULL,
  user_id INT NOT NULL,
  position ENUM('starter','substitute') NOT NULL DEFAULT 'starter',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  UNIQUE (team_id, user_id)
);

CREATE TABLE team_invitations (
  team_invitation_id INT PRIMARY KEY AUTO_INCREMENT,  -- ♻️ เปลี่ยนชื่อจาก id
  team_id INT NOT NULL,
  invited_user_id INT NOT NULL,
  invited_by_user_id INT NOT NULL,
  team_invitation_status ENUM('pending','accepted','rejected','expired') NOT NULL DEFAULT 'pending',  -- ♻️ เปลี่ยนชื่อจาก status
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (invited_user_id) REFERENCES users(user_id),
  FOREIGN KEY (invited_by_user_id) REFERENCES users(user_id)
);

CREATE TABLE team_admin_requests (
  team_admin_request_id INT PRIMARY KEY AUTO_INCREMENT,  -- ♻️ เปลี่ยนชื่อจาก id
  team_id INT NOT NULL,
  request_type ENUM('official_status','leader_transfer') NOT NULL,
  requested_by INT NOT NULL,
  target_user_id INT NULL,
  team_admin_request_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',  -- ♻️ เปลี่ยนชื่อจาก status
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 🆕 ใหม่ — เดิมมีแค่ reviewed_at ไม่มีคู่นี้
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  rejection_reason TEXT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (requested_by) REFERENCES users(user_id),
  FOREIGN KEY (target_user_id) REFERENCES users(user_id),
  FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
);

CREATE TABLE player_profile_stats (
  player_profile_stat_id INT PRIMARY KEY AUTO_INCREMENT,  -- 🆕 ใหม่ — เดิม composite PK (user_id, sport_type_id)
  user_id INT NOT NULL,
  sport_type_id INT NOT NULL,
  matches_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  championships INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (sport_type_id) REFERENCES sport_types(sport_type_id),
  UNIQUE (user_id, sport_type_id)                     -- 🆕 ใหม่ — แทนที่ composite PK เดิม รักษากฎ 1 คน 1 แถวต่อกีฬา
);

CREATE TABLE official_team_memberships (
  official_team_membership_id INT PRIMARY KEY AUTO_INCREMENT,  -- 🆕 ใหม่ — เดิม composite PK (user_id, sport_type_id)
  user_id INT NOT NULL,
  sport_type_id INT NOT NULL,
  team_id INT NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (sport_type_id) REFERENCES sport_types(sport_type_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  UNIQUE (user_id, sport_type_id)                     -- 🆕 ใหม่ — แทนที่ composite PK เดิม รักษา BR-05
);
```

---

## 4. หมวดทัวร์นาเมนต์

```sql
CREATE TABLE tournaments (
  tournament_id INT PRIMARY KEY AUTO_INCREMENT,       -- ♻️ เปลี่ยนชื่อจาก id
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
  tournament_status ENUM('pending_approval','rejected','private','public','completed','auto_deleted') NOT NULL DEFAULT 'pending_approval',  -- ♻️ เปลี่ยนชื่อจาก status
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
  updated_at DATETIME NULL,                           -- 🆕 ใหม่ — Admin แก้แทน Organizer ได้ผ่าน amendment request
  updated_by INT NULL,                                 -- 🆕 ใหม่
  deleted_at DATETIME NULL,
  deleted_by INT NULL,                                 -- 🆕 ใหม่ — NULL = auto_deleted (ระบบ), มีค่า = Admin สั่งลบ
  -- หมายเหตุ: Organizer ไม่มีสิทธิ์ลบทัวร์นาเมนต์เองในดีไซน์นี้ (ยืนยันแล้ว) มีแค่ unpublish (private↔public)
  FOREIGN KEY (sport_type_id) REFERENCES sport_types(sport_type_id),
  FOREIGN KEY (organizing_faculty_id) REFERENCES faculties(faculty_id),
  FOREIGN KEY (organizing_department_id) REFERENCES departments(department_id),
  FOREIGN KEY (requested_by_user_id) REFERENCES users(user_id),
  FOREIGN KEY (organizer_external_reviewed_by) REFERENCES users(user_id),
  FOREIGN KEY (approved_by) REFERENCES users(user_id),
  FOREIGN KEY (updated_by) REFERENCES users(user_id),
  FOREIGN KEY (deleted_by) REFERENCES users(user_id)
);

CREATE TABLE tournament_eligibility_rules (
  tournament_eligibility_rule_id INT PRIMARY KEY AUTO_INCREMENT,  -- ♻️ เปลี่ยนชื่อจาก id
  tournament_id INT NOT NULL,
  rule_type ENUM('year','faculty') NOT NULL,
  rule_value INT NOT NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  UNIQUE (tournament_id, rule_type, rule_value)
);

CREATE TABLE tournament_amendment_requests (
  tournament_amendment_request_id INT PRIMARY KEY AUTO_INCREMENT,  -- ♻️ เปลี่ยนชื่อจาก id
  tournament_id INT NOT NULL,
  requested_by INT NOT NULL,
  requested_changes JSON NOT NULL,
  tournament_amendment_request_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',  -- ♻️ เปลี่ยนชื่อจาก status
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 🆕 ใหม่ — เดิมมีแค่ reviewed_at
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  rejection_reason TEXT NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (requested_by) REFERENCES users(user_id),
  FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
);
```

---

## 5. หมวดกรรมการ

```sql
-- ตารางนี้เก็บ "แต่งตั้งเป็นกรรมการของทัวร์นาเมนต์" — ตอบรับครั้งเดียว ใช้ได้ทุกแมตช์ที่มอบหมายภายหลัง
-- ★ เชิญได้ไม่จำกัดจำนวนครั้ง (ตัดสินใจ 2 ส.ค. 2569 รอบ 4) — ไม่มี UNIQUE(tournament_id, user_id) แล้ว
-- ★ ทุก query ตรวจสิทธิ์ต้องดึงแถวล่าสุดเสมอ: ORDER BY created_at DESC LIMIT 1
CREATE TABLE tournament_referees (
  tournament_referee_id INT PRIMARY KEY AUTO_INCREMENT,  -- ♻️ เปลี่ยนชื่อจาก id
  tournament_id INT NOT NULL,
  user_id INT NOT NULL,
  invited_by INT NOT NULL,
  invitation_status ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  is_external BOOLEAN NOT NULL DEFAULT FALSE,
  external_approval_status ENUM('not_required','pending','approved','rejected') NOT NULL DEFAULT 'not_required',
  approved_by INT NULL,
  approved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at DATETIME NULL,                            -- 🆕 ใหม่ — soft delete แทน DELETE จริง
  removed_by INT NULL,                                  -- 🆕 ใหม่
  -- ❌ ตัด UNIQUE (tournament_id, user_id) ออก — เชิญซ้ำได้ไม่จำกัด (ตัดสินใจ 2 ส.ค. รอบ 4)
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (invited_by) REFERENCES users(user_id),
  FOREIGN KEY (approved_by) REFERENCES users(user_id),
  FOREIGN KEY (removed_by) REFERENCES users(user_id)
);

-- มอบหมายกรรมการเข้าแมตช์ — ไม่มี invitation_status ซ้ำ สถานะตอบรับอยู่ที่ tournament_referees เพียงที่เดียว
CREATE TABLE match_referees (
  match_referee_id INT PRIMARY KEY AUTO_INCREMENT,    -- ♻️ เปลี่ยนชื่อจาก id
  match_id INT NOT NULL,
  tournament_referee_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (tournament_referee_id) REFERENCES tournament_referees(tournament_referee_id),
  UNIQUE (match_id, tournament_referee_id)
);
```

---

## 6. หมวดการสมัครแข่งขัน

```sql
CREATE TABLE tournament_applications (
  tournament_application_id INT PRIMARY KEY AUTO_INCREMENT,  -- ♻️ เปลี่ยนชื่อจาก id
  tournament_id INT NOT NULL,
  team_id INT NOT NULL,
  hard_filter_passed BOOLEAN NULL,
  hard_filter_details JSON NULL,
  soft_filter_documents JSON NULL,                     -- จำกัดเฉพาะรูปบัตรนิสิต/บัตรประชาชน (array ของ S3 key)
  tournament_application_status ENUM('pending','approved','rejected','cancelled','withdrawn') NOT NULL DEFAULT 'pending',  -- ♻️ เปลี่ยนชื่อจาก status
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  rejection_reason TEXT NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- ไม่มี applied_by: track ผ่าน team_id → teams.leader_id ได้อยู่แล้ว (สมัครได้เฉพาะ Team Leader)
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (reviewed_by) REFERENCES users(user_id),
  UNIQUE (tournament_id, team_id)
);
```

---

## 7. หมวดสายการแข่งขัน (🔄 ย้ายจาก MongoDB ทั้งหมวด)

```sql
-- 🆕🔄 ตารางใหม่ทั้งตาราง — แทนที่ MongoDB `brackets` collection ทั้งหมด
-- เก็บ "หน้าตาสำหรับวาดภาพ bracket" เท่านั้น — ไม่ใช่ตัวตัดสินใจว่าทีมไหนไปแข่งกับใครต่อ
-- การตัดสินใจจริงยังอยู่ที่ matches.next_match_id / matches.loser_next_match_id เหมือนเดิม (เลือกทาง B)
CREATE TABLE bracket_nodes (
  bracket_node_id INT PRIMARY KEY AUTO_INCREMENT,
  tournament_id INT NOT NULL,
  node_code VARCHAR(30) NOT NULL,          -- "W-R1-M1" เก็บไว้แค่อ่านง่าย ไม่ใช้อ้างอิงจริง (ไม่ต้องเป็น UUID — ดูข้อ 15)
  bracket_type ENUM('winners','losers','grand_final') NOT NULL,
  -- Single Elimination ใช้แค่ 'winners' / Double Elimination ใช้ครบ 3 ค่า
  -- Round Robin ไม่ใช้ตารางนี้เลย (ไม่มีแนวคิด node — สร้าง matches ตรงๆ)
  round INT NULL,                          -- NULL สำหรับ grand_final
  match_number INT NOT NULL,
  team_a_id INT NULL,
  team_b_id INT NULL,
  match_id INT NULL,                       -- เติมทีหลังตอนแมตช์จริงถูกสร้าง (M01 → schedule)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,                -- แก้ได้ผ่าน "จัดสายใหม่" (PATCH /tournaments/:id/bracket)
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (team_a_id) REFERENCES teams(team_id),
  FOREIGN KEY (team_b_id) REFERENCES teams(team_id),
  FOREIGN KEY (match_id) REFERENCES matches(match_id)
);
```
> **⚠️ ประเด็นที่ต้องผ่าน Change Management:** การยุบ MongoDB Atlas ออกทั้งหมดขัดกับ DC-04 ของ SRS ที่ระบุว่า "โครงสร้าง Bracket และสถิติที่โครงสร้างไม่คงที่ต้องอยู่บน MongoDB Atlas" — ต้องเปิด GitHub Issue แจ้งการเปลี่ยนแปลงนี้ก่อนใช้งานจริง

---

## 8. หมวดแมตช์และผลการแข่งขัน

```sql
CREATE TABLE matches (
  match_id INT PRIMARY KEY AUTO_INCREMENT,             -- ♻️ เปลี่ยนชื่อจาก id (⚠️ ดูหมายเหตุท้ายตาราง)
  tournament_id INT NOT NULL,
  bracket_node_id INT NULL,                            -- 🔄 เปลี่ยนชนิดจาก VARCHAR(50) เป็น INT + FK จริง (เดิมอ้างอิง MongoDB node_id แบบ string)
  next_match_id INT NULL,                               -- self-referencing FK — ยังเป็น source of truth ของ "ไปแข่งต่อที่ไหน" (เลือกทาง B)
  loser_next_match_id INT NULL,                          -- self-referencing FK — เฉพาะ Double Elimination
  round_number INT NULL,
  team_a_id INT NULL,
  team_b_id INT NULL,
  scheduled_time DATETIME NULL,
  venue VARCHAR(255) NULL,
  checkin_open_at DATETIME NULL,
  match_status ENUM('scheduled','checkin_open','in_progress','completed','disputed') NOT NULL DEFAULT 'scheduled',  -- ♻️ เปลี่ยนชื่อจาก status
  mode ENUM('onsite','online') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,                            -- 🆕 ใหม่ — แก้ผ่าน PATCH /matches/:id/schedule, /venue, /mode (Organizer เท่านั้น)
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (bracket_node_id) REFERENCES bracket_nodes(bracket_node_id),
  FOREIGN KEY (team_a_id) REFERENCES teams(team_id),
  FOREIGN KEY (team_b_id) REFERENCES teams(team_id),
  FOREIGN KEY (next_match_id) REFERENCES matches(match_id),
  FOREIGN KEY (loser_next_match_id) REFERENCES matches(match_id)
);
```
> **⚠️ หมายเหตุการตั้งชื่อ:** `matches` เป็นตารางเดียวที่ PK (`match_id`) ชื่อซ้ำกับ FK column ในตารางอื่นที่ชี้มาหา (`match_results.match_id`, `match_checkins.match_id` ฯลฯ) เพราะ FK เหล่านั้นตั้งชื่อสื่อความหมายไว้ตรงกับรูปแบบ `{tablename}_id` อยู่แล้วโดยบังเอิญ **ต้องใช้ table alias เสมอตอนเขียน JOIN** (เช่น `m.match_id` vs `mr.match_id`) เพื่อไม่ให้สับสนว่าตัวไหนคือ PK ตัวไหนคือ FK — ยอมรับความเสี่ยงนี้เพื่อความสม่ำเสมอทั้งระบบ

```sql
CREATE TABLE match_checkins (
  match_checkin_id INT PRIMARY KEY AUTO_INCREMENT,    -- ♻️ เปลี่ยนชื่อจาก id
  match_id INT NOT NULL,
  user_id INT NOT NULL,
  method ENUM('qr_onsite','photo_online','manual_by_referee') NOT NULL,
  match_checkin_status ENUM('success','rejected','exception') NOT NULL,  -- ♻️ เปลี่ยนชื่อจาก status
  rejection_reason VARCHAR(255) NULL,
  document_type ENUM('student_id','national_id') NULL,
  document_s3_key VARCHAR(255) NULL,
  verified_by_referee_id INT NULL,
  checked_in_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at DATETIME NULL,                           -- 🆕 ใหม่ — เวลาที่กรรมการตรวจสอบ (โหมด photo_online) ต่างจาก checked_in_at
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (verified_by_referee_id) REFERENCES users(user_id)
);

CREATE TABLE match_results (
  match_result_id INT PRIMARY KEY AUTO_INCREMENT,     -- ♻️ เปลี่ยนชื่อจาก id
  match_id INT NOT NULL UNIQUE,
  winner_team_id INT NULL,
  score_data JSON NULL,                                -- ยกเว้นไว้ (ไม่แตกตาราง) — คะแนนรวม 2 ทีม โครงสร้างเรียบง่ายคงที่ ไม่เหมือนกรณี player_match_stats
  submitted_by_user_id INT NOT NULL,
  submitted_role ENUM('team_leader','referee') NOT NULL,
  match_result_status ENUM('submitted','verified','disputed','rejected') NOT NULL DEFAULT 'submitted',  -- ♻️ เปลี่ยนชื่อจาก status
  dispute_reason TEXT NULL,
  dispute_raised_by INT NULL,
  dispute_raised_at DATETIME NULL,                     -- 🆕 ใหม่ — สำคัญมาก ใช้เช็ค dispute_window_hours (BR-14)
  dispute_resolved_by INT NULL,
  dispute_resolution TEXT NULL,
  dispute_resolved_at DATETIME NULL,
  verified_by_user_id INT NULL,
  verified_at DATETIME NULL,
  amended_by_user_id INT NULL,
  amend_reason TEXT NULL,
  amended_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (winner_team_id) REFERENCES teams(team_id),
  FOREIGN KEY (submitted_by_user_id) REFERENCES users(user_id),
  FOREIGN KEY (dispute_raised_by) REFERENCES users(user_id),
  FOREIGN KEY (dispute_resolved_by) REFERENCES users(user_id),
  FOREIGN KEY (verified_by_user_id) REFERENCES users(user_id),
  FOREIGN KEY (amended_by_user_id) REFERENCES users(user_id)
);
```
> **Application-level rule:** เมื่อ `match_results.match_result_status` เปลี่ยนเป็น `'disputed'` ต้อง `UPDATE matches SET match_status='disputed'` ในทรานแซกชันเดียวกันเสมอ

---

## 9. หมวดสถิติผู้เล่นรายแมตช์ (🔄 แตกจาก JSON เป็น 3 ตาราง)

```sql
-- 🆕 ตารางใหม่ — "กติกา" ว่ากีฬาไหนเก็บสถิติอะไรบ้าง (แทน JSON ที่โครงสร้างไม่คงที่)
CREATE TABLE sport_stat_definitions (
  sport_stat_definition_id INT PRIMARY KEY AUTO_INCREMENT,
  sport_type_id INT NOT NULL,
  stat_key VARCHAR(50) NOT NULL,           -- 'goals', 'assists', 'yellow_cards' ฯลฯ
  stat_label_th VARCHAR(100) NOT NULL,     -- 'ประตู', 'แอสซิสต์', 'ใบเหลือง'
  data_type ENUM('integer','decimal','boolean') NOT NULL DEFAULT 'integer',
  display_order INT NOT NULL DEFAULT 0,
  -- ★ ข้อมูล (แต่ละกีฬาเก็บอะไรบ้างจริงๆ) รอ seed ทีหลัง — ไม่บล็อกการสร้างโครงสร้างตาราง
  FOREIGN KEY (sport_type_id) REFERENCES sport_types(sport_type_id),
  UNIQUE (sport_type_id, stat_key)
);

-- "หัวเรื่อง" — ใครเล่นแมตช์ไหน กรรมการคนไหนบันทึกให้
CREATE TABLE player_match_stats (
  player_match_stat_id INT PRIMARY KEY AUTO_INCREMENT,  -- ♻️ เปลี่ยนชื่อจาก id
  match_id INT NOT NULL,
  user_id INT NOT NULL,
  team_id INT NOT NULL,
  recorded_by_referee_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- ❌ ตัด stats JSON, edit_log JSON ออก — ย้ายไปตาราง player_match_stat_values + audit_logs กลางแทน
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (recorded_by_referee_id) REFERENCES users(user_id)
);

-- 🆕 ตารางใหม่ — "ตัวเลขจริง" แต่ละสถิติ
CREATE TABLE player_match_stat_values (
  player_match_stat_value_id INT PRIMARY KEY AUTO_INCREMENT,
  player_match_stat_id INT NOT NULL,
  sport_stat_definition_id INT NOT NULL,
  value_int INT NULL,
  FOREIGN KEY (player_match_stat_id) REFERENCES player_match_stats(player_match_stat_id),
  FOREIGN KEY (sport_stat_definition_id) REFERENCES sport_stat_definitions(sport_stat_definition_id),
  UNIQUE (player_match_stat_id, sport_stat_definition_id)
);
```
> **การแก้ไขสถิติย้อนหลัง** ใช้ `audit_logs` กลาง (`action_type='stat_corrected'`, `details={old_value, new_value}`) แทน `edit_log` JSON เดิม

---

## 10. หมวด Dashboard / Leaderboard

```sql
CREATE TABLE tournament_standings (
  standing_id INT PRIMARY KEY AUTO_INCREMENT,          -- 🆕 ใหม่ — เดิม composite PK (tournament_id, team_id)
  tournament_id INT NOT NULL,
  team_id INT NOT NULL,
  played INT NOT NULL DEFAULT 0,
  won INT NOT NULL DEFAULT 0,
  lost INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  UNIQUE (tournament_id, team_id)                      -- 🆕 ใหม่ — แทนที่ composite PK เดิม
);
```

---

## 11. หมวดการมีส่วนร่วม

```sql
CREATE TABLE follows (
  follow_id INT PRIMARY KEY AUTO_INCREMENT,            -- ♻️ เปลี่ยนชื่อจาก id
  follower_user_id INT NOT NULL,
  followed_user_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (follower_user_id) REFERENCES users(user_id),
  FOREIGN KEY (followed_user_id) REFERENCES users(user_id),
  UNIQUE (follower_user_id, followed_user_id)
);

CREATE TABLE notifications (
  notification_id INT PRIMARY KEY AUTO_INCREMENT,      -- ♻️ เปลี่ยนชื่อจาก id
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_entity_type VARCHAR(50) NULL,
  related_entity_id INT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- ไม่มี created_by: ระบบสร้างเองทั้งหมด ไม่มี endpoint ให้ผู้ใช้สร้างเอง
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE announcements (
  announcement_id INT PRIMARY KEY AUTO_INCREMENT,      -- ♻️ เปลี่ยนชื่อจาก id
  tournament_id INT NOT NULL,
  match_id INT NULL,
  created_by INT NOT NULL,
  announcement_type ENUM('general','schedule_change','venue_change','result','livestream') NOT NULL,  -- ♻️ เปลี่ยนชื่อจาก type
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  updated_by INT NULL,                                  -- 🆕 ใหม่
  deleted_at DATETIME NULL,
  deleted_by INT NULL,                                  -- 🆕 ใหม่
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  FOREIGN KEY (updated_by) REFERENCES users(user_id),
  FOREIGN KEY (deleted_by) REFERENCES users(user_id)
);

CREATE TABLE tournament_feedback (
  tournament_feedback_id INT PRIMARY KEY AUTO_INCREMENT,  -- ♻️ เปลี่ยนชื่อจาก id
  tournament_id INT NOT NULL,
  user_id INT NOT NULL,
  feedback_type ENUM('comment','organizer_feedback','mvp_vote') NOT NULL,
  content TEXT NULL,
  rating INT NULL,
  voted_for_user_id INT NULL,
  match_id INT NULL,
  is_reported BOOLEAN NOT NULL DEFAULT FALSE,
  removed_at DATETIME NULL,                            -- 🆕 ใหม่ — แทนที่ is_removed boolean เดิม (ให้ pattern เดียวกับ deleted_at)
  removed_by INT NULL,                                  -- 🆕 ใหม่
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- ไม่มี updated_at: ห้ามแก้ไขเนื้อหาเด็ดขาด (ไม่มี PATCH endpoint เลยตามดีไซน์ที่ตั้งใจ) เขียนครั้งเดียวจบเหมือน ledger
  match_key INT AS (IFNULL(match_id, 0)) STORED,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (voted_for_user_id) REFERENCES users(user_id),
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (removed_by) REFERENCES users(user_id),
  UNIQUE (tournament_id, match_key, user_id, feedback_type)
);

CREATE TABLE tournament_questions (
  tournament_question_id INT PRIMARY KEY AUTO_INCREMENT,  -- ♻️ เปลี่ยนชื่อจาก id
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
);
```

---

## 12. หมวด Pick'em และรางวัล

```sql
CREATE TABLE pickem_predictions (
  pickem_prediction_id INT PRIMARY KEY AUTO_INCREMENT,  -- ♻️ เปลี่ยนชื่อจาก id
  user_id INT NOT NULL,
  match_id INT NOT NULL,
  predicted_winner_team_id INT NOT NULL,
  points_earned INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (predicted_winner_team_id) REFERENCES teams(team_id),
  UNIQUE (user_id, match_id)
);

CREATE TABLE rewards (
  reward_id INT PRIMARY KEY AUTO_INCREMENT,            -- ♻️ เปลี่ยนชื่อจาก id
  reward_type ENUM('badge','achievement') NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  points_required INT NULL,
  criteria JSON NULL,
  icon_key VARCHAR(255) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,              -- 🆕 ใหม่ (รอบ 5) — ทาง A: ปิดใช้งานแทนลบจริง กันพังตอนมีคนแลกไปแล้ว (REWARD_IN_USE)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 🆕 ใหม่ — เดิมไม่มี audit field เลยแม้แต่ตัวเดียว
  updated_at DATETIME NULL                                 -- 🆕 ใหม่
  -- ✅ endpoint ฝั่ง Admin (POST/PATCH/DELETE /admin/rewards) เพิ่มแล้วในตอนที่ 2 รอบ 5 — DELETE คือ UPDATE is_active=false ไม่ใช่ลบจริง
);

CREATE TABLE user_rewards (
  user_reward_id INT PRIMARY KEY AUTO_INCREMENT,       -- 🆕 ใหม่ — เดิม composite PK (user_id, reward_id)
  user_id INT NOT NULL,
  reward_id INT NOT NULL,
  earned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_displayed BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (reward_id) REFERENCES rewards(reward_id),
  UNIQUE (user_id, reward_id)                          -- 🆕 ใหม่ — แทนที่ composite PK เดิม
);

CREATE TABLE point_transactions (
  point_transaction_id BIGINT PRIMARY KEY AUTO_INCREMENT,  -- ♻️ เปลี่ยนชื่อจาก id
  user_id INT NOT NULL,
  amount INT NOT NULL,
  source ENUM('pickem_correct','reward_redeem','admin_adjustment','other') NOT NULL,
  ref_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- ห้ามมี updated_at: ledger เขียนครั้งเดียว แก้ผิดต้องสร้างรายการชดเชยใหม่ ไม่ใช่แก้ของเดิม
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

---

## 13. หมวด Audit Log

```sql
CREATE TABLE audit_logs (
  audit_log_id INT PRIMARY KEY AUTO_INCREMENT,         -- ♻️ เปลี่ยนชื่อจาก id
  user_id INT NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  details JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```
> ตัวมันเองคือ audit ไม่ต้องมี audit ซ้อน audit

---

## 14. สรุปจำนวนตาราง — 36 ตาราง

```
33 ตารางเดิม
+ 1  bracket_nodes                (🆕🔄 แทน MongoDB)
+ 1  sport_stat_definitions       (🆕 แทน JSON stats)
+ 1  player_match_stat_values     (🆕 แทน JSON stats)
= 36 ตาราง
```

---

## 15. Migration SQL สำหรับฐานข้อมูลที่สร้างไปแล้วก่อนหน้า

```sql
-- ⚠️ ต้องรันตามลำดับ ห้ามสลับ เพราะมี FK ผูกกันอยู่
-- ขั้นที่ 1: เปลี่ยนชื่อ PK ทุกตาราง (ตัวอย่างรูปแบบ ต้องทำซ้ำทุกตาราง)
ALTER TABLE faculties CHANGE id faculty_id INT AUTO_INCREMENT;
-- ... (ทำซ้ำแบบเดียวกันกับตารางที่เหลือ ก่อนแก้ FK ที่ชี้มา)

-- ขั้นที่ 2: แก้ FOREIGN KEY ทุกจุดให้ชี้ไปยัง PK ชื่อใหม่
-- (ต้อง DROP FOREIGN KEY เดิมก่อน แล้ว ADD ใหม่ทุกจุดที่มี REFERENCES xxx(id))

-- ขั้นที่ 3: ตารางที่เปลี่ยนจาก composite PK เป็นเดี่ยว (ต้อง DROP PRIMARY KEY เดิมก่อน)
ALTER TABLE tournament_standings DROP PRIMARY KEY;
ALTER TABLE tournament_standings ADD COLUMN standing_id INT AUTO_INCREMENT PRIMARY KEY FIRST;
ALTER TABLE tournament_standings ADD UNIQUE (tournament_id, team_id);
-- ทำซ้ำแบบเดียวกันกับ official_team_memberships, player_profile_stats, user_rewards

-- ขั้นที่ 4: ตัด UNIQUE เดิมของ tournament_referees
ALTER TABLE tournament_referees DROP INDEX <ชื่อ index เดิม ของ UNIQUE(tournament_id, user_id)>;
ALTER TABLE tournament_referees
  ADD COLUMN removed_at DATETIME NULL,
  ADD COLUMN removed_by INT NULL,
  ADD FOREIGN KEY (removed_by) REFERENCES users(user_id);

-- ขั้นที่ 5: เพิ่ม audit field ทั้ง 11 ตาราง (ตัวอย่าง 2 ตารางแรก ที่เหลือ pattern เดียวกัน)
ALTER TABLE team_admin_requests ADD COLUMN requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tournament_amendment_requests ADD COLUMN requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- ... (ทำซ้ำตามตารางหัวข้อ 0.2)

-- ขั้นที่ 6: แตก player_match_stats
CREATE TABLE sport_stat_definitions (...);   -- ตาม DDL หัวข้อ 9
CREATE TABLE player_match_stat_values (...); -- ตาม DDL หัวข้อ 9
-- migrate ข้อมูลจาก stats JSON เดิม → player_match_stat_values (เขียนสคริปต์แยกตอน implement)
ALTER TABLE player_match_stats DROP COLUMN stats, DROP COLUMN edit_log;

-- ขั้นที่ 7: สร้าง bracket_nodes ใหม่ + แก้ matches.bracket_node_id
CREATE TABLE bracket_nodes (...);            -- ตาม DDL หัวข้อ 7
ALTER TABLE matches MODIFY COLUMN bracket_node_id INT NULL;
ALTER TABLE matches ADD FOREIGN KEY (bracket_node_id) REFERENCES bracket_nodes(bracket_node_id);
-- (ข้อมูล MongoDB เดิม migrate เข้า bracket_nodes ด้วยสคริปต์แยกตอน implement — ไม่มีข้อมูลจริงในระบบตอนนี้ ข้ามได้)
```

---

## 16. ประเด็นค้างที่ต้องผ่าน Change Management ก่อนใช้งานจริง

1. **⚠️ ยุบ MongoDB Atlas ทั้งหมด** — ขัดกับ DC-04 ของ SRS
2. **⚠️ Multi-faculty scope (`scope_type='university'`)** — ขัดกับขอบเขตเดิมของ SRS (ค้างมาตั้งแต่รอบก่อน)
3. **⚠️ External Organizer** — ขัดกับ SRS ที่ระบุว่า external เป็นได้แค่ Referee (ค้างมาตั้งแต่รอบก่อน)
4. **⚠️ ขอบเขตการแก้ผลย้อนหลัง (FR-RS-07)** — เงื่อนไข `CANNOT_AMEND_WINNER` เป็นกฎธุรกิจใหม่ที่ SRS ยังไม่ระบุ (ค้างมาตั้งแต่รอบก่อน)

## 17. ประเด็นค้างที่ไม่บล็อกการ implement (ข้อมูล ไม่ใช่โครงสร้าง)

1. ค่า `sport_types.min_members`/`max_members` จริง — รอยืนยันกับทีม/อาจารย์
2. ข้อมูลใน `sport_stat_definitions` — แต่ละกีฬาเก็บสถิติอะไรบ้าง รอคิดทีหลัง
3. Endpoint `/admin/rewards` (CRUD) ที่ยังไม่มีในตอนที่ 2/3.1 ของ API Design — ต้องเพิ่มทีหลัง
