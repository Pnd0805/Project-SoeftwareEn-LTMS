-- B1 (มติ 21 ก.ย. 2569) — ปิดทัวร์: ORG กด POST /tournaments/:id/complete (ทางเลือก 1-ข)
--   เก็บแชมป์ไว้ที่ทัวร์ (รอบชิงสำหรับ elimination · อันดับ 1 ของตารางสำหรับ round robin) และเวลาที่ปิด
ALTER TABLE tournaments
  ADD COLUMN champion_team_id INT NULL AFTER approved_at,
  ADD COLUMN completed_at DATETIME NULL AFTER champion_team_id,
  ADD COLUMN completed_by INT NULL AFTER completed_at,
  ADD CONSTRAINT fk_tournaments_champion FOREIGN KEY (champion_team_id) REFERENCES teams(team_id),
  ADD CONSTRAINT fk_tournaments_completed_by FOREIGN KEY (completed_by) REFERENCES users(user_id);
