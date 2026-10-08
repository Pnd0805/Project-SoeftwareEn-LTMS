-- OD-26 (มติ 26 ก.ย. 2569) — ให้ "การโต้แย้งผล" พกข้อมูลพอให้ตัดสินได้
--
-- เดิมค้านได้ด้วยข้อความเปล่า ๆ อย่างเดียว (และสตริงว่างก็ผ่าน) ผู้จัดเปิดเรื่องมาเห็นแค่
-- "กรรมการนับคะแนนผิด" แล้วต้องไปไล่ถามเองว่าผิดตรงไหนควรเป็นเท่าไร ทั้งที่ตอนกด amend
-- ต้องกรอก winnerTeamId + scoreData ให้ครบอยู่ดี — ข้อมูลอยู่ในหัวคนค้าน แต่ระบบไม่เคยเก็บ
--
-- claimed_* ไม่บังคับกรอก เพราะการค้านบางแบบไม่ได้เถียงสกอร์ (เช่น "ผู้เล่นไม่มีสิทธิ์ลงแข่ง")
-- ถ้ากรอกมา ผู้จัดกด amend ได้เลยโดยไม่ต้องพิมพ์ใหม่
ALTER TABLE match_results
  ADD COLUMN dispute_claimed_winner_team_id INT NULL AFTER dispute_raised_at,
  ADD COLUMN dispute_claimed_score JSON NULL AFTER dispute_claimed_winner_team_id,
  ADD COLUMN dispute_evidence JSON NULL AFTER dispute_claimed_score,   -- อาร์เรย์ของ S3 object key (ส่งออกเป็น presigned URL เสมอ)
  ADD CONSTRAINT fk_match_results_dispute_claimed_team
      FOREIGN KEY (dispute_claimed_winner_team_id) REFERENCES teams(team_id);
