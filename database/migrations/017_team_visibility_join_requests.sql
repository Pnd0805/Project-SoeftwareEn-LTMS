-- มติ 20 ก.ย. 2569 (FE-public-team-list-team): ค้นหาทีม + ทีมส่วนตัว/สาธารณะ + ขอเข้าร่วมทีมสาธารณะ
--   private (default) = เข้าได้ทางคำเชิญ (T09/T13) เท่านั้น · ค้นหาเจอ ดูข้อมูลได้ แต่ขอเข้าไม่ได้
--   public            = ใครก็ส่งคำขอเข้าร่วมได้ (T20) หัวหน้าทีมอนุมัติ/ปฏิเสธ (T22/T23)
ALTER TABLE teams
  ADD COLUMN visibility ENUM('private','public') NOT NULL DEFAULT 'private' AFTER official_status;

CREATE TABLE team_join_requests (
  team_join_request_id INT PRIMARY KEY AUTO_INCREMENT,
  team_id INT NOT NULL,
  user_id INT NOT NULL,
  message VARCHAR(255) NULL,
  team_join_request_status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  reject_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,
  responded_by INT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (responded_by) REFERENCES users(user_id),
  INDEX idx_join_req_team_status (team_id, team_join_request_status),
  INDEX idx_join_req_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
