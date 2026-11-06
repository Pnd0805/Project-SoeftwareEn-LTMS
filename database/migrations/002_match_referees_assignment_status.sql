-- เชิญกรรมการพร้อมแมตช์ (GUIDE/11 §3.1)
-- pending  = ORG เสนอแมตช์นี้มาพร้อมคำเชิญ รอ ref เลือก
-- accepted = ref รับแมตช์นี้ (นับเป็นกรรมการของแมตช์ก็ต่อเมื่อ tournament_referees ยัง active ด้วย)
-- declined = ref ไม่รับแมตช์นี้ (เก็บไว้ให้ ORG เห็นว่าต้องหาคนแทน)
ALTER TABLE match_referees
  ADD COLUMN assignment_status ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending' AFTER tournament_referee_id,
  ADD COLUMN responded_at DATETIME NULL AFTER assignment_status;

-- แถวเก่าที่ ORG ใส่ตรง ๆ ผ่าน F11 ถือว่ารับแล้ว
UPDATE match_referees SET assignment_status = 'accepted', responded_at = NOW();
