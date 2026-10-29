-- =====================================================================
-- ยก schema ของฐานเดโมให้เท่าโค้ดปัจจุบัน — รันต่อจาก demo-seed.sql ทันที (DEPLOY.md ขั้นที่ 4)
-- =====================================================================
--
-- ทำไมต้องมี: demo-seed.sql เป็น dump ตอน migration ถึง 050 แต่โค้ดตอนนี้ต้องการ 051–057
--   051 (สองไฟล์) คิวอีเมลแจ้งเตือน + คอลัมน์ตั้งค่าอีเมล (ไม่มี = เปิด EMAIL_NOTIFICATIONS_ENABLED แล้ว error ทุก 30 วินาที · หน้าตั้งค่าอีเมลได้ 500)
--       · คอลัมน์เตือนผู้จัดล่วงหน้า (งานเบื้องหลังรันทุกชั่วโมง — ไม่มีคอลัมน์ = error ทุกชั่วโมง)
--   052 user_type ของแอดมิน · 053 ยกเลิกทัวร์ (ไม่มี = ปุ่มยกเลิกทัวร์พัง)
--   054 ลบภาพยืนยันตัวตนกรรมการ (ไม่มี = งานเบื้องหลังลบภาพ error ทุกชั่วโมง + อนุมัติ/ปฏิเสธกรรมการพัง)
--   055 ปลดล็อกบัญชีเก่าสำหรับด่านยืนยันอีเมล · 056 เหรียญที่ซื้อด้วยแต้มได้
--       🔴 ไม่มี 056 = หน้าร้านว่างเปล่า ปุ่มแลกแต้มไม่มีอะไรให้ซื้อ (demo-seed.sql DROP ตาราง rewards ทิ้งทุกครั้ง)
--   057 กระดิ่งรายคนของการติดตาม (ไม่มี = ดูโปรไฟล์คนอื่น · กดติดตาม · รายชื่อที่ติดตาม ได้ 500 · ผู้ติดตามไม่ได้แจ้งเตือน)
--
-- ★ ต้อง `docker cp ../database/migrations/. ltms-mysql:/tmp/migrations` ก่อน (ไฟล์นี้อ่านจากที่นั่น)
-- ★ เป็นไฟล์แยก ไม่ใช่พิมพ์ SQL ในคำสั่ง docker exec เพราะเครื่องหมายคำพูดซ้อนกันพังใน PowerShell/cmd
-- ★ รันได้ครั้งเดียวต่อการโหลด demo-seed.sql หนึ่งครั้ง (051 · 053 · 054 · 057 เพิ่มคอลัมน์/ตาราง รันซ้ำจะ error Duplicate column)
--   ★ 055 · 056 เป็น migration เติมข้อมูล รันซ้ำเองไม่พัง แต่ INSERT ลง schema_migrations ด้านล่างจะชน primary key
--   อยากรันใหม่ ให้โหลด demo-seed.sql ก่อนแล้วค่อยรันไฟล์นี้
-- ★ บันทึกลง schema_migrations ด้วย — ใครรัน `npm run migrate` กับฐานนี้ทีหลังจะไม่รันซ้ำจนพัง
-- ★ มี migration ใหม่เพิ่ม ⇒ เติม SOURCE + INSERT คู่ใหม่ต่อท้าย (หรือ dump demo-seed.sql ใหม่แล้วลบไฟล์นี้)
-- =====================================================================

-- ★ เรียงตามชื่อไฟล์เหมือนตัวรัน migration (051_email มาก่อน 051_tournament)
SOURCE /tmp/migrations/051_email_notification_outbox.sql;
INSERT INTO schema_migrations (name) VALUES ('051_email_notification_outbox.sql');

SOURCE /tmp/migrations/051_tournament_auto_delete_warning.sql;
INSERT INTO schema_migrations (name) VALUES ('051_tournament_auto_delete_warning.sql');

SOURCE /tmp/migrations/052_user_type_from_admin_scope.sql;
INSERT INTO schema_migrations (name) VALUES ('052_user_type_from_admin_scope.sql');

SOURCE /tmp/migrations/053_tournament_cancellation.sql;
INSERT INTO schema_migrations (name) VALUES ('053_tournament_cancellation.sql');

SOURCE /tmp/migrations/054_referee_identity_docs_purged.sql;
INSERT INTO schema_migrations (name) VALUES ('054_referee_identity_docs_purged.sql');

SOURCE /tmp/migrations/055_require_email_verification.sql;
INSERT INTO schema_migrations (name) VALUES ('055_require_email_verification.sql');

-- 🔴 ต้องมาหลัง demo-seed.sql เสมอ — ไฟล์ seed DROP ตาราง rewards แล้วใส่เฉพาะเหรียญแจกอัตโนมัติ 6 ใบ
--   ⇒ เหรียญที่ขายด้วยแต้มจะหายทุกครั้งที่โหลด seed ใหม่ ไฟล์นี้เติมกลับให้
SOURCE /tmp/migrations/056_purchasable_badges.sql;
INSERT INTO schema_migrations (name) VALUES ('056_purchasable_badges.sql');

SOURCE /tmp/migrations/057_follow_notify_bell.sql;
INSERT INTO schema_migrations (name) VALUES ('057_follow_notify_bell.sql');
