-- B2 (รายงาน FE 19 ก.ย. 2569): ก่อนหน้านี้ verify/walkover วางทีมลง matches อย่างเดียว bracket_nodes รอบถัดไปจึงว่างตลอด
-- ตั้งแต่ commit นี้ทุกจุดที่วางทีมจะ sync ลง bracket_nodes ด้วย (bracketNode.repo.syncNodeTeamsFromMatchTx) — ไฟล์นี้ backfill ข้อมูลเก่า
-- matches คือแหล่งความจริง: คัดลอกช่อง a/b ของทุกแมตช์ที่มี node ชี้อยู่ (idempotent)
UPDATE bracket_nodes n JOIN matches m ON n.match_id = m.match_id
SET n.team_a_id = m.team_a_id, n.team_b_id = m.team_b_id;
