-- =====================================================================
-- ยก schema ของฐานเดโมให้เท่าโค้ดปัจจุบัน — รันต่อจาก demo-seed.sql ทันที (DEPLOY.md ขั้นที่ 4)
-- =====================================================================
--
-- ทำไมต้องมี: demo-seed.sql เป็น dump ตอน migration ถึง 050 แต่โค้ดตอนนี้ต้องการ 051–054
--   051 คอลัมน์เตือนผู้จัดล่วงหน้า (งานเบื้องหลังรันทุกชั่วโมง — ไม่มีคอลัมน์ = error ทุกชั่วโมง)
--   052 user_type ของแอดมิน · 053 ยกเลิกทัวร์ (ไม่มี = ปุ่มยกเลิกทัวร์พัง)
--   054 ลบภาพยืนยันตัวตนกรรมการ (ไม่มี = งานเบื้องหลังลบภาพ error ทุกชั่วโมง + อนุมัติ/ปฏิเสธกรรมการพัง)
--
-- ★ ต้อง `docker cp ../database/migrations/. ltms-mysql:/tmp/migrations` ก่อน (ไฟล์นี้อ่านจากที่นั่น)
-- ★ เป็นไฟล์แยก ไม่ใช่พิมพ์ SQL ในคำสั่ง docker exec เพราะเครื่องหมายคำพูดซ้อนกันพังใน PowerShell/cmd
-- ★ รันได้ครั้งเดียวต่อการโหลด demo-seed.sql หนึ่งครั้ง (053 · 054 เพิ่มคอลัมน์ รันซ้ำจะ error Duplicate column)
--   อยากรันใหม่ ให้โหลด demo-seed.sql ก่อนแล้วค่อยรันไฟล์นี้
-- ★ บันทึกลง schema_migrations ด้วย — ใครรัน `npm run migrate` กับฐานนี้ทีหลังจะไม่รันซ้ำจนพัง
-- ★ มี migration ใหม่เพิ่ม ⇒ เติม SOURCE + INSERT คู่ใหม่ต่อท้าย (หรือ dump demo-seed.sql ใหม่แล้วลบไฟล์นี้)
-- =====================================================================

SOURCE /tmp/migrations/051_tournament_auto_delete_warning.sql;
INSERT INTO schema_migrations (name) VALUES ('051_tournament_auto_delete_warning.sql');

SOURCE /tmp/migrations/052_user_type_from_admin_scope.sql;
INSERT INTO schema_migrations (name) VALUES ('052_user_type_from_admin_scope.sql');

SOURCE /tmp/migrations/053_tournament_cancellation.sql;
INSERT INTO schema_migrations (name) VALUES ('053_tournament_cancellation.sql');

SOURCE /tmp/migrations/054_referee_identity_docs_purged.sql;
INSERT INTO schema_migrations (name) VALUES ('054_referee_identity_docs_purged.sql');
