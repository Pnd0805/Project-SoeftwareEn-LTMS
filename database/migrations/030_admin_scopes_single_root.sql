-- OD-34 — บังคับให้ root มีได้คนเดียวจริง ๆ ที่ระดับฐานข้อมูล
--
-- migration 025 เขียนคอมเมนต์ไว้ว่า "Root มีได้คนเดียวในระบบ" แต่ไม่มี constraint ไหนบังคับ
-- ที่กันอยู่มีแค่ทาง API (grantScopeSchema รับแค่ 'faculty'/'university_wide') ⇒ seed หรือ SQL
-- ตรง ๆ ใส่ root คนที่สองได้ และถ้าเกิดขึ้นจะ **ถอนทั้งคู่ไม่ได้เลย** เพราะ revokeScope ตอบ
-- CANNOT_REVOKE_ROOT_SCOPE ให้ root ทุกคน — กู้คืนได้ทางเดียวคือแก้ฐานข้อมูลตรง
--
-- MySQL ไม่มี partial unique index จึงใช้ generated column ที่เป็น 1 เฉพาะแถว root และเป็น NULL
-- สำหรับแถวอื่น · UNIQUE ยอมให้ NULL ซ้ำกันได้ไม่จำกัด ⇒ faculty/university_wide หลายแถวไม่ถูกแตะเลย
ALTER TABLE admin_scopes
  ADD COLUMN root_singleton TINYINT AS (IF(scope_type = 'root', 1, NULL)) STORED,
  ADD UNIQUE KEY uq_admin_scopes_single_root (root_singleton);
