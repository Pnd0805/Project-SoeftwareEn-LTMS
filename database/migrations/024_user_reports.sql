-- แก้ 1 ต.ค. 2569 — `CREATE TABLE` → `CREATE TABLE IF NOT EXISTS`
-- แก้ไฟล์ที่ push ไปแล้ว ซึ่งขัดกฎในหัว migrate.ts — ปลอดภัยด้วยเหตุผลเดียวกันกับ 029:
-- ฐานที่รันไฟล์นี้ไปแล้วจะไม่รันอีก · ฐานที่ยังไม่รันได้ตารางเหมือนเดิมเป๊ะ
-- เหตุ: คนที่ restore qa-baseline.sql ทับฐานที่มีตารางนี้อยู่แล้ว เจอ ER_TABLE_EXISTS_ERROR
-- แล้ว migration ทุกตัวหลังจากนี้ไม่เคยรัน (FE รายงาน 30 ก.ย.)
-- C2 — ระบบแจ้งเรื่องขอระงับผู้ใช้/แอดมิน (user ธรรมดาก็ยื่นได้ ไม่ใช่แค่แอดมิน)
-- ผู้ใช้ทั่วไป: ส่งไปให้แอดมินคณะของเป้าหมาย (หรือ university_wide เห็นหมดอยู่แล้ว)
-- เป้าหมายเป็นแอดมิน (ทุกระดับ): ส่งไปให้ university_wide เท่านั้น เพราะมีแค่ university_wide ที่ระงับแอดมินได้
CREATE TABLE IF NOT EXISTS user_reports (
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
