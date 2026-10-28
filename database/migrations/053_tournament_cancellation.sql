-- =====================================================================
-- 053 — ยกเลิกทัวร์นาเมนต์ (มติ 28 ต.ค. 2569 — ผู้จัดหรือแอดมินมหาวิทยาลัยกดยกเลิก · แอดมินกู้คืนได้)
-- =====================================================================
--
-- ทำไมต้องมี: ทัวร์ที่มีทีมสมัครหรือจับสายแล้วแต่จัดต่อไม่ได้ ก่อนหน้านี้ **ไม่มีทางออกเลย**
--   ลบไม่ได้ (DELETE ติด TOURNAMENT_HAS_ACTIVITY) · ปิดไม่ได้ (complete ต้องแข่งครบทุกแมตช์)
--   ⇒ ได้แค่ unpublish ให้หายจากหน้าสาธารณะ แล้วค้างอยู่แบบนั้นตลอด ทีมที่สมัครก็ไม่รู้ว่าจะได้แข่งไหม
--
-- ★ เป็นสถานะใหม่ ไม่ใช่ soft delete — ทัวร์ยังอยู่ให้ทุกคนเปิดดูย้อนหลังได้พร้อมเหตุผล
--   และไม่ใช่ `auto_deleted` — อันนั้นคือระบบปิดเอง ถ้าใช้ร่วมกันจะแยกไม่ออกว่าใครปิด เพราะอะไร
--
-- ★ `cancelled_from_status` = สถานะก่อนยกเลิก (public/private) — ไว้ให้แอดมินกู้คืนกลับไปที่เดิมได้
--   ไม่ต้องเก็บสถานะของแมตช์ เพราะยกเลิกแล้ว "แช่แข็ง" ทุกอย่างไว้ตามเดิม ไม่แก้แถวแมตช์เลย
--   (กู้คืนแล้วทุกแมตช์เดินต่อจากจุดเดิมได้ทันที)
--
-- ★ ไม่ตั้งค่าให้แถวเดิม — ทัวร์ที่มีอยู่ไม่มีอันไหนถูกยกเลิก คอลัมน์ใหม่ทั้งหมดเป็น NULL ถูกต้องแล้ว
-- =====================================================================

ALTER TABLE tournaments
  MODIFY tournament_status ENUM('pending_approval','rejected','private','public','completed','auto_deleted','cancelled')
         NOT NULL DEFAULT 'pending_approval',
  ADD COLUMN cancelled_at DATETIME NULL AFTER completed_by,
  ADD COLUMN cancelled_by INT NULL AFTER cancelled_at,
  ADD COLUMN cancel_reason VARCHAR(255) NULL AFTER cancelled_by,
  ADD COLUMN cancelled_from_status ENUM('private','public') NULL
      COMMENT 'สถานะก่อนถูกยกเลิก — แอดมินกู้คืนกลับไปสถานะนี้ · NULL = ไม่ได้ถูกยกเลิก' AFTER cancel_reason,
  ADD CONSTRAINT fk_tournaments_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(user_id);
