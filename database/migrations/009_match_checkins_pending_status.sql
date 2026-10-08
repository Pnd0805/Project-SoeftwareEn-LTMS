-- แยกความหมายสถานะเช็คอินให้ชัด (GUIDE/07 ข้อ B2)
--   pending   = เช็คอินแบบรูป (photo_online) ที่รอกรรมการตรวจ (M14 ผ่าน → success, M15 ไม่ผ่าน → rejected)
--   exception = กรรมการอนุโลมเช็คอินให้เป็นกรณีพิเศษ (manual_by_referee เช่น ลืมบัตร/QR ใช้ไม่ได้)
-- เติม 'pending' ต่อท้าย ENUM เพื่อไม่ให้ลำดับค่าเดิมเปลี่ยน
ALTER TABLE match_checkins
  MODIFY match_checkin_status ENUM('success','rejected','exception','pending') NOT NULL;

-- แถวเดิมที่เคยใช้ exception แทน "รอตรวจ" → ย้ายไปเป็น pending
UPDATE match_checkins
  SET match_checkin_status = 'pending'
  WHERE match_checkin_status = 'exception' AND method = 'photo_online' AND verified_at IS NULL;
