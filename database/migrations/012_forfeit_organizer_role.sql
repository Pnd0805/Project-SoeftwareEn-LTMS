-- ORG ตัดสินแมตช์ที่ทีมไม่มาตามนัด (M17 forfeit) — GUIDE/11 §10.5
--   ทั้งสองทีมมาไม่ครบ = แพ้ทั้งคู่: match_results.winner_team_id = NULL, status = 'walkover', submitted_role = 'organizer'
ALTER TABLE match_results
  MODIFY submitted_role ENUM('team_leader','referee','organizer') NOT NULL;
