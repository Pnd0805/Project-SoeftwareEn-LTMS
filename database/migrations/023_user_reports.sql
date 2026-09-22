-- C2 — ระบบแจ้งเรื่องขอระงับผู้ใช้/แอดมิน (user ธรรมดาก็ยื่นได้ ไม่ใช่แค่แอดมิน)
-- ผู้ใช้ทั่วไป: ส่งไปให้แอดมินคณะของเป้าหมาย (หรือ university_wide เห็นหมดอยู่แล้ว)
-- เป้าหมายเป็นแอดมิน (ทุกระดับ): ส่งไปให้ university_wide เท่านั้น เพราะมีแค่ university_wide ที่ระงับแอดมินได้
CREATE TABLE user_reports (
  user_report_id INT PRIMARY KEY AUTO_INCREMENT,
  reported_by INT NOT NULL,
  target_user_id INT NOT NULL,
  reason TEXT NOT NULL,
  evidence JSON NULL,   -- array ของ S3/MinIO key รูป/ไฟล์หลักฐาน (ไม่บังคับ) — pattern เดียวกับ team_admin_requests.supporting_docs
  user_report_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  rejection_reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reported_by) REFERENCES users(user_id),
  FOREIGN KEY (target_user_id) REFERENCES users(user_id),
  FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
