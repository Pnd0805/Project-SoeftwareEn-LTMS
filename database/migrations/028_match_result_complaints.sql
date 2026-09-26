-- OD-26 ข้อ 8 (มติ 26–27 ก.ย. 2569) — "เรื่องร้องเรียนผลแมตช์" คนละเส้นกับการโต้แย้งผล
--
-- ปัญหา: การโต้แย้ง (dispute) ใช้ได้แค่ในหน้าต่างเวลาสั้น ๆ พ้นแล้วปิดประตูสนิท ทีมที่ได้หลักฐาน
-- มาทีหลัง (เช่น คลิปที่พิสูจน์ว่าอีกฝ่ายส่งคนที่ไม่ได้อยู่ในใบสมัครลงเล่น) ยื่นอะไรไม่ได้เลย
-- แต่จะเปิดให้ค้านย้อนหลังด้วยกลไกเดิมก็ไม่ได้ เพราะ match_status = 'disputed' บล็อกทั้งแมตช์ถัดไป
-- และการปิดทัวร์ — เรื่องเดียวจะแช่ทัวร์ที่จบไปแล้วทั้งทัวร์
--
-- ทางออก: ตารางนี้ไม่แตะ match_status และไม่แตะ match_results เลย ทัวร์เดินต่อและปิดได้ปกติ
-- เรื่องผูกกับ match_result_id (ผลแมตช์) ไม่ใช่ผูกกับตัวผู้จัด — คนผิดอาจเป็นกรรมการ ทีม หรือผู้จัดก็ได้
--
-- นาฬิกาเรือนเดียว: created_at + ORG_RESOLVE_HOURS (48 ชม.) คือเส้นที่แอดมินมหาวิทยาลัยเข้ามาตัดสินได้
-- จึงไม่มีสถานะ 'escalated' และไม่ต้องมี scheduler — คิวของแอดมินเป็นการ query ด้วยเวลาตรง ๆ
-- ผู้จัดแนบความเห็นได้แต่ "ปัดตกไม่ได้" โดยดีไซน์: ไม่มีคอลัมน์ไหนให้ผู้จัดปิดเรื่อง
CREATE TABLE match_result_complaints (
  match_result_complaint_id INT PRIMARY KEY AUTO_INCREMENT,
  match_id INT NOT NULL,
  match_result_id INT NOT NULL,
  filed_by INT NOT NULL,
  reason TEXT NOT NULL,
  claimed_winner_team_id INT NULL,             -- ผลที่ผู้ยื่นเสนอว่าถูกต้อง (ไม่บังคับ) — pattern เดียวกับ dispute_claimed_*
  claimed_score JSON NULL,
  evidence JSON NULL,                          -- อาร์เรย์ของ S3 object key — ส่งออกเป็น presigned URL เสมอ ไม่ส่ง key ดิบ
  complaint_status ENUM('open','upheld','no_merit') NOT NULL DEFAULT 'open',
  organizer_statement TEXT NULL,               -- ความเห็นผู้จัด — แนบได้ ปัดตกไม่ได้
  organizer_statement_by INT NULL,
  organizer_statement_at DATETIME NULL,
  remedy ENUM('record_only','amend_result') NULL,   -- แอดมินเลือกว่าจะแก้ผลจริงด้วยไหม (มติ 27 ก.ย.)
  decided_by INT NULL,
  decision_note TEXT NULL,
  decided_at DATETIME NULL,
  filer_flagged BOOLEAN NOT NULL DEFAULT FALSE,     -- ติดเฉพาะเมื่อแอดมินตัดสินว่า "ไม่มีมูล" — กันยื่นพล่อย ๆ โดยไม่ทำให้คนมีเรื่องจริงกลัวยื่น
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  -- 1 คน 1 เรื่องต่อผลแมตช์ · ยื่นซ้ำ = แก้ของเดิม (มติ 27 ก.ย.)
  UNIQUE KEY uq_complaint_result_filer (match_result_id , filed_by),
  KEY idx_complaint_match (match_id),
  KEY idx_complaint_queue (complaint_status , created_at),   -- คิวของแอดมิน: open ที่เลย 48 ชม.
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (match_result_id) REFERENCES match_results(match_result_id),
  FOREIGN KEY (filed_by) REFERENCES users(user_id),
  FOREIGN KEY (claimed_winner_team_id) REFERENCES teams(team_id),
  FOREIGN KEY (organizer_statement_by) REFERENCES users(user_id),
  FOREIGN KEY (decided_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
