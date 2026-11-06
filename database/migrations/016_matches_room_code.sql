-- B8 / FE-room-code-online-match (20 ก.ย. 2569): แมตช์ออนไลน์ (E-Sport) ต้องมีรหัสห้องล็อบบี้ให้ทั้งสองทีมเข้า
-- ตั้งโดยกรรมการของแมตช์หรือ ORG (PUT /matches/:id/room-code) · เห็นได้เฉพาะสมาชิกทีมในแมตช์/กรรมการ/ORG
ALTER TABLE matches
  ADD COLUMN room_code VARCHAR(50) NULL AFTER livestream_url;
