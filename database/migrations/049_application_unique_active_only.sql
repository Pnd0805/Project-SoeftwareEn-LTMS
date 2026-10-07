-- =====================================================================
-- 049 — ทีมที่ถอนตัวแล้วต้องสมัครทัวร์เดิมใหม่ได้ (FE blocker 7 ต.ค. 2569 · มติ ① ก)
-- =====================================================================
--
-- ปัญหาที่ FE ทำซ้ำได้จริง (เวลา 2026-10-07T08:18:41Z · ทัวร์ 27 ทีม 9034 ใบ 36):
--   ทีมสมัคร → อนุมัติ → ถอนตัว → สมัครใหม่ด้วยทีมและผู้เล่นชุดเดิม
--   ⇒ 409 PLAYER_ALREADY_REGISTERED "มีผู้เล่นที่ถูกส่งลงแข่งกับทีมอื่นไปแล้ว"
--     ทั้งที่ตอนนั้น `application_players` ว่างเปล่า และทัวร์นั้นไม่มีแมตช์เลย
--
-- 🔴 สาเหตุจริงอยู่ที่ฐาน ไม่ใช่ที่ผู้เล่น — ยืนยันกับ information_schema ของ ltms แล้ว
--   schema.sql มี `UNIQUE (tournament_id, team_id)` (MySQL ตั้งชื่อ index ให้ว่า
--   `tournament_id` ตามคอลัมน์แรก) ซึ่ง **ครอบทุกสถานะ** รวม withdrawn/rejected/cancelled
--   ⇒ ใบที่ตายแล้วยังกินที่ของคู่ (ทัวร์, ทีม) ไว้ตลอดกาล
--
-- 🔴 ชั้น service เชื่อตรงกันข้าม — `findExistingApplication` นับเฉพาะ pending/approved
--   พร้อมคอมเมนต์ว่า "cancel/withdraw/reject แล้วสมัครใหม่ได้ (FE gaps 19 ก.ย.)"
--   ⇒ มีมติแล้วว่าต้องสมัครใหม่ได้ · ฐานกับ service ขัดกันเอง นี่คือบั๊ก ไม่ใช่ดีไซน์
--   (รอบก่อน BE ตอบว่า "ตั้งใจล็อก ผิดแค่ข้อความ" — ผิด เพราะดูแต่ชั้น service)
--
-- ★ วิธีแก้ใช้รูปแบบเดียวกับ migration 048 เป๊ะ: generated column ที่เป็น NULL
--   เมื่อใบไม่ได้ใช้งานอยู่ + UNIQUE บนคอลัมน์นั้น (UNIQUE ของ MySQL ยอมให้ NULL ซ้ำ
--   ได้ไม่จำกัด ⇒ ได้ผลเท่ากับ partial index ที่ MySQL ไม่มี)
--   ⇒ ① ประวัติใบที่ถอน/ถูกปฏิเสธยังอยู่ครบ ② ยังกันการกดสองแท็บพร้อมกันที่ระดับฐาน
--   สถานะที่ถือว่า "ใช้งานอยู่" = pending, approved — ต้องตรงกับ `findExistingApplication`
--
-- 🔴 ลำดับสำคัญ: index ชื่อ `tournament_id` เป็น index ที่ FK ของ `tournament_id`
--   อาศัยอยู่ด้วย ⇒ DROP ตรง ๆ จะล้มด้วย errno 150
--   ต้องสร้าง index ธรรมดาให้ FK ยืนก่อน แล้วค่อย DROP ตัวเดิม
--
-- 🙋 ข้อมูลเดิม: ไม่มีอะไรต้องเก็บกวาดก่อน ALTER — UNIQUE เดิมเข้มกว่าอันใหม่
--   ⇒ ข้อมูลที่ผ่าน UNIQUE เดิมมาได้ ย่อมผ่านอันใหม่ด้วยเสมอ
--   (ฐาน dev ตรวจแล้ว 7 ต.ค. 2569: approved 2 ใบ · withdrawn 1 ใบ · ไม่มีคู่ซ้ำ)
-- =====================================================================

-- ① ให้ FK ของ tournament_id มี index ของตัวเองก่อน
ALTER TABLE tournament_applications
  ADD KEY idx_application_tournament (tournament_id);

-- ② ปลด UNIQUE เดิมที่ครอบทุกสถานะ
ALTER TABLE tournament_applications
  DROP INDEX tournament_id;

-- ③ UNIQUE ใหม่ที่นับเฉพาะใบที่ยังใช้งานอยู่
ALTER TABLE tournament_applications
  ADD COLUMN active_key VARCHAR(32)
      GENERATED ALWAYS AS (IF(tournament_application_status IN ('pending', 'approved'),
                              CONCAT_WS(':', tournament_id, team_id), NULL)) VIRTUAL,
  ADD UNIQUE KEY uq_application_active (active_key);
