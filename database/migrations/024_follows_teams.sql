-- C8 ติดตามได้ทั้งผู้เล่นและทีม (มติทีม 21 ก.ย. 2569 · OD-24)
--   เดิม follows เก็บได้แค่ผู้ใช้ → เพิ่ม followed_team_id · แถวหนึ่งต้องชี้อย่างใดอย่างหนึ่งพอดี
--   UNIQUE เดิม (follower_user_id, followed_user_id) ยังกันซ้ำฝั่งผู้ใช้ได้ (NULL ไม่ชนกัน)
--   เลข 024 เพราะ 023 เอกสารแบ่งงานกลุ่ม C จองไว้ให้ C5 (entry_notes)
ALTER TABLE follows
  MODIFY followed_user_id INT NULL,
  ADD COLUMN followed_team_id INT NULL AFTER followed_user_id,
  ADD CONSTRAINT fk_follows_team FOREIGN KEY (followed_team_id) REFERENCES teams(team_id),
  ADD CONSTRAINT uq_follow_team UNIQUE (follower_user_id, followed_team_id),
  ADD CONSTRAINT chk_follow_one_target CHECK ((followed_user_id IS NULL) <> (followed_team_id IS NULL));
