-- GUIDE/07 A1 (ทางเลือก A): team_invitations ไม่มี expires_at แต่โค้ด T09/T12/T13 ใช้ → คำเชิญเข้าทีม 500 ทุกครั้ง
-- อายุคำเชิญ = 7 วัน (team.service.createInvitation) · แถวเก่า (ถ้ามี) นับจาก created_at
ALTER TABLE team_invitations
  ADD COLUMN expires_at DATETIME NULL AFTER team_invitation_status;

UPDATE team_invitations SET expires_at = DATE_ADD(created_at, INTERVAL 7 DAY) WHERE expires_at IS NULL;

ALTER TABLE team_invitations
  MODIFY expires_at DATETIME NOT NULL;
