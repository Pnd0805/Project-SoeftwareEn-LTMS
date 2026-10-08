-- OD-26 ข้อ 4+2+5 (มติ 25-26 ก.ย. 2569) — ขั้น "จบการแข่งขัน" และเวลาจริงของแมตช์
--
-- ทำไมต้องมี: ระบบไม่เคยรู้ว่าแมตช์เริ่มและจบจริงเมื่อไร มีแต่ scheduled_time/scheduled_end_time
-- ซึ่งเป็นเวลาที่วางแผนไว้ กีฬาจบเร็วหรือช้ากว่าตารางก็ได้ ทุกกฎที่นับเวลาหลังแมตช์จบจึงเขียนไม่ได้เลย
--
-- finished = แข่งจบแล้ว รอส่งผล · บังคับผ่านสถานะนี้ก่อนถึงส่งผลได้ (เดิมส่งผลตอนแมตช์ยัง scheduled ก็ยังได้)
-- กรรมการหรือผู้จัดกดก็ได้ (Q4b) — ผู้จัดกดแทนได้คือสิ่งที่ทำให้การ "บังคับ" ไม่กลายเป็นจุดค้างใหม่
ALTER TABLE matches
  MODIFY match_status ENUM('scheduled','checkin_open','in_progress','finished','completed','disputed','result_rejected')
         NOT NULL DEFAULT 'scheduled',
  ADD COLUMN started_at DATETIME NULL AFTER checkin_open_at,
  ADD COLUMN actual_end_time DATETIME NULL AFTER started_at;

-- เวลาที่ส่งผล "ครั้งล่าสุด" — created_at ใช้แทนไม่ได้เพราะส่งซ้ำหลัง reject แล้วไม่ขยับ
-- (INSERT ... ON DUPLICATE KEY UPDATE ไม่แตะ created_at) นาฬิกาของกฎ auto-verify จะนับจากครั้งแรกซึ่งผิด
ALTER TABLE match_results
  ADD COLUMN submitted_at DATETIME NULL AFTER submitted_role;

UPDATE match_results SET submitted_at = created_at WHERE submitted_at IS NULL;

-- แมตช์เก่าที่ completed ไปแล้วไม่ต้อง backfill started_at/actual_end_time — ไม่มีข้อมูลจริงให้เติม
-- และไม่มีกฎไหนย้อนไปใช้กับแมตช์ที่จบแล้ว
