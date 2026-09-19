-- ตัดตัวจริง/ตัวสำรองออกจากทีม (มติทีม 19 ก.ย. 2569)
--   ทีม = คลังผู้เล่น ไม่มีตำแหน่งถาวรอีกต่อไป · ใครลงแข่งดูจาก application_players (migration 014)
--   endpoint PATCH /teams/:id/members/:uid ถูกถอดออกพร้อมกัน
ALTER TABLE team_members DROP COLUMN position;
