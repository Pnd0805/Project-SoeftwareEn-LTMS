-- คำขอเปลี่ยนแปลงกรรมการหลังเชิญ (GUIDE/11 §3.2, §5)
--   org_add_match : ORG ขอให้กรรมการ A รับแมตช์ match_a เพิ่ม           → A ตอบ
--   ref_transfer  : กรรมการ A ขอโอน match_a ให้ B                        → B ตอบ
--   ref_swap      : กรรมการ A ขอแลก match_a ของตนกับ match_b ของ B      → B ตอบ
--   org_swap      : ORG ขอสลับ match_a ของ A กับ match_b ของ B           → A และ B ตอบ
-- apply เมื่อทุกฝ่ายที่ต้องตอบกด accept — ORG แค่รับแจ้ง (Q3)
CREATE TABLE referee_change_requests (
  request_id      INT PRIMARY KEY AUTO_INCREMENT,
  tournament_id   INT NOT NULL,
  request_type    ENUM('org_add_match','ref_transfer','ref_swap','org_swap') NOT NULL,
  requested_by    INT NOT NULL,                      -- user_id ผู้สร้างคำขอ
  referee_a_id    INT NOT NULL,                      -- tournament_referee_id
  referee_b_id    INT NULL,
  match_a_id      INT NOT NULL,
  match_b_id      INT NULL,
  a_status        ENUM('not_required','pending','accepted','declined') NOT NULL,
  b_status        ENUM('not_required','pending','accepted','declined') NOT NULL,
  request_status  ENUM('open','applied','declined','cancelled') NOT NULL DEFAULT 'open',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at     DATETIME NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (requested_by)  REFERENCES users(user_id),
  FOREIGN KEY (referee_a_id)  REFERENCES tournament_referees(tournament_referee_id),
  FOREIGN KEY (referee_b_id)  REFERENCES tournament_referees(tournament_referee_id),
  FOREIGN KEY (match_a_id)    REFERENCES matches(match_id),
  FOREIGN KEY (match_b_id)    REFERENCES matches(match_id),
  INDEX idx_rcr_tournament_status (tournament_id, request_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
