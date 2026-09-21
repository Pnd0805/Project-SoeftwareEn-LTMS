-- C7 คอมเมนต์ใต้แมตช์ (มติทีม 22 ก.ย. 2569 · OD-24)
--   ตารางแยกจาก tournament_feedback เพราะตารางนั้น UNIQUE (tournament_id, match_key, user_id, feedback_type)
--   = คนละ 1 อันต่อแมตช์ แต่คอมเมนต์ต้องโพสต์ได้หลายอัน (หน้า FE ทำไว้แบบนั้น)
--   ห้ามแก้เนื้อหา (ไม่มี updated_at) · เจ้าของลบเองได้ / แอดมินลบได้ = soft delete (removed_at, removed_by)
--   เลข 024 เพราะ 023 เอกสารแบ่งงานกลุ่ม C จองไว้ให้ C5 (entry_notes)
CREATE TABLE IF NOT EXISTS match_comments (
  match_comment_id INT PRIMARY KEY AUTO_INCREMENT,
  match_id INT NOT NULL,
  user_id INT NOT NULL,
  content VARCHAR(500) NOT NULL,
  is_reported BOOLEAN NOT NULL DEFAULT FALSE,
  removed_at DATETIME NULL,
  removed_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (removed_by) REFERENCES users(user_id),
  INDEX idx_match_comments_match (match_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
