-- walkover (ชนะบาย) — GUIDE/11 §10.4 · มติ 17 ก.ย. 2569
--   1. ทีมถอนตัว (P08) หลังมีสาย → แมตช์ที่ยังไม่เริ่มของทีมนั้น อีกฝั่งชนะบาย
--   2. ตอนกรรมการกด start (M10) ทีมไหนเช็คอินไม่ถึง sport_types.min_members → แพ้บาย
-- ผลถูกบันทึกเป็นแถว match_results เหมือนแมตช์ปกติ แต่ status = 'walkover' (ไม่ต้อง verify, dispute ไม่ได้)
ALTER TABLE match_results
  MODIFY match_result_status ENUM('submitted','verified','disputed','rejected','walkover') NOT NULL DEFAULT 'submitted';

-- สกอร์ที่บันทึกเมื่อชนะบาย ต่อกีฬา {"winner": n, "loser": n} — ใช้ใส่ score_data ให้ tie-break ด้วยผลต่างสกอร์ทำงานได้ในอนาคต
-- NULL = กีฬานั้นไม่กำหนด → score_data ของแมตช์ walkover เป็น NULL แต่ยังนับ won/lost/points ปกติ
ALTER TABLE sport_types
  ADD COLUMN walkover_score JSON NULL AFTER default_mode;

UPDATE sport_types SET walkover_score = JSON_OBJECT('winner', 3,  'loser', 0) WHERE sport_type_id = 1;  -- ฟุตบอล (FIFA 3–0)
UPDATE sport_types SET walkover_score = JSON_OBJECT('winner', 20, 'loser', 0) WHERE sport_type_id = 2;  -- บาสเกตบอล (FIBA 20–0)
UPDATE sport_types SET walkover_score = JSON_OBJECT('winner', 2,  'loser', 0) WHERE sport_type_id = 3;  -- แบดมินตัน 2–0 เกม
UPDATE sport_types SET walkover_score = JSON_OBJECT('winner', 2,  'loser', 0) WHERE sport_type_id = 4;  -- RoV BO3 2–0
UPDATE sport_types SET walkover_score = JSON_OBJECT('winner', 2,  'loser', 0) WHERE sport_type_id = 5;  -- VALORANT BO3 2–0 แมพ
