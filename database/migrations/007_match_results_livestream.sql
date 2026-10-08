-- Step 9-10 (backend_step9-10) แก้ schema.sql ตรง ๆ โดยไม่มี migration — เขียนย้อนหลังตอน merge เข้า BE_KN
-- S03/S04: สถานะผลถูกปฏิเสธ · E12: ลิงก์ถ่ายทอดสด · S06: สถิติผู้เล่นซ้ำต่อแมตช์ไม่ได้
ALTER TABLE matches
  MODIFY COLUMN match_status
    ENUM('scheduled','checkin_open','in_progress','completed','disputed','result_rejected') NOT NULL DEFAULT 'scheduled',
  ADD COLUMN livestream_url VARCHAR(500) NULL;

ALTER TABLE player_match_stats
  ADD UNIQUE KEY uq_player_match_stats_match_user (match_id, user_id);
