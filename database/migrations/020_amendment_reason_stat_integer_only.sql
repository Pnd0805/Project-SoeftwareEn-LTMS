-- 20 ก.ย. 2569 — ปิด 2 ข้อจากรายการ FE (BACKEND-GAPS.md)
--
-- FE-change-request-has-nowhere: คำขอแก้ไข (C09) มีที่ให้ผู้ขอบอกเหตุผล (บังคับ — มติ 20 ก.ย.)
--   แถวเก่าที่สร้างก่อน migration นี้ไม่มีเหตุผล จึงต้อง NULL ได้ที่ระดับตาราง · schema บังคับที่ API
ALTER TABLE tournament_amendment_requests
  ADD COLUMN request_reason TEXT NULL AFTER requested_changes;

-- FE-s06-accepts-whole-numbers: sport_stat_definitions.data_type โฆษณา decimal/boolean
--   แต่ player_match_stat_values มีแค่ value_int และ S06 บวกสะสม (ไม่เหมาะกับเวลา/bool)
--   มติ 20 ก.ย. (ทาง ค): MVP 93 รองรับเฉพาะ integer · จะเปิด decimal/boolean ต้องตัดสิน semantics ก่อน (OD-18)
ALTER TABLE sport_stat_definitions
  MODIFY COLUMN data_type ENUM('integer') NOT NULL DEFAULT 'integer';
