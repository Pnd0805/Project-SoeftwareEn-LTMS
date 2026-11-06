-- M12 ต้อง idempotent (กดเช็คอินซ้ำ = 200 พร้อมข้อมูลเดิม) — กันแถวซ้ำที่ระดับ DB
-- เดิมมีแค่เช็คฝั่ง service (select ก่อน insert) ถ้ายิงพร้อมกันเป๊ะยังเกิดแถวซ้ำได้
-- ⚠️ ถ้าเครื่องไหนมีแถวซ้ำอยู่แล้ว ไฟล์นี้จะล้ม ให้ลบแถวซ้ำก่อน:
--   SELECT match_id, user_id, COUNT(*) FROM match_checkins GROUP BY match_id, user_id HAVING COUNT(*) > 1;
ALTER TABLE match_checkins
  ADD UNIQUE KEY uq_match_checkins_match_user (match_id, user_id);
