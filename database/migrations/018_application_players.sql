-- รายชื่อผู้เล่นที่ทีมส่งลงแข่งในทัวร์นั้น (มติทีม 19 ก.ย. 2569)
--   ทีม = คลังผู้เล่น (ไม่มีตัวจริง/สำรองอีกต่อไป) · ใบสมัคร = รายชื่อที่ส่งลงแข่ง
--   จำนวนต้องอยู่ใน [sport_types.min_members, max_members] · ส่งแล้วล็อก แก้ไม่ได้
--   uq_tournament_player = คนเดียวมีชื่อได้ทีมเดียวต่อหนึ่งทัวร์ (กันสองทีมสมัครพร้อมกันที่ระดับ DB)
--   ใบสมัครตาย (cancelled/rejected/withdrawn) → ลบแถวทิ้ง ผู้เล่นถูกปลดล็อกไปทีมอื่นได้
CREATE TABLE IF NOT EXISTS application_players (
  application_player_id INT PRIMARY KEY AUTO_INCREMENT,
  tournament_application_id INT NOT NULL,
  tournament_id INT NOT NULL,             -- ซ้ำกับใบสมัคร แต่ต้องมีเพื่อทำ UNIQUE ระดับทัวร์
  user_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_application_id) REFERENCES tournament_applications(tournament_application_id) ON DELETE CASCADE,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  UNIQUE KEY uq_tournament_player (tournament_id, user_id),
  UNIQUE KEY uq_application_player (tournament_application_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
