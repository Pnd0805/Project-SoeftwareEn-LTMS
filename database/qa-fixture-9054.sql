-- =====================================================================
-- QA fixture — กรรมการภายนอกคนที่สอง (9054) ที่ "เอกสารเปิดดูได้จริง"
-- =====================================================================
--
-- ใช้เมื่อฐาน QA มีข้อมูลอยู่แล้วและ **ไม่อยาก reseed ทับของที่ทำไว้** (FE ขอมา 8 ต.ค. 2569)
--
--     mysql -h 127.0.0.1 -P 3307 -u root -p ltms < database/qa-fixture-9054.sql
--
-- 🔴 ไฟล์นี้ **รันซ้ำได้** ทุกคำสั่งมีด่านกันของเดิม ⇒ รันสองครั้งไม่พัง ไม่เกิดแถวซ้ำ
-- 🔴 ไฟล์นี้ **ไม่อัปไฟล์ขึ้น MinIO** — object ของ 9054 มาจาก `minio-init` ของ docker compose
--    (ดูขั้นตอนท้ายไฟล์) · และ **ห้ามอัป object ของ 9053 เด็ดขาด**
--
-- สองเคสที่คู่กันและต้องมีทั้งคู่:
--   9053  คีย์ถูกต้องตามรูปแบบ แต่ **ไม่มีไฟล์ใน MinIO** ⇒ ลิงก์ดูเอกสารตอบ 404 โดยเจตนา
--   9054  คีย์ถูกต้อง **และมีไฟล์จริง**                  ⇒ ทดสอบลิงก์ที่เปิดได้
-- ⇒ ถ้าเผลออัปไฟล์ให้ 9053 เคสทดสอบ "เปิดไฟล์ไม่ได้" จะหายไปทั้งเคส
--
-- ★ ทัวร์/ผู้เชิญของแถว 9054 **ลอกมาจากแถวของ 9053** ไม่ฮาร์ดโค้ดเลขทัวร์
--   เพราะเลขทัวร์ในฐานแต่ละเครื่องไม่เหมือนกัน (บางเครื่อง restore baseline บางเครื่อง seed เอง)
--   ⇒ ถ้าเครื่องไหนไม่มีแถวของ 9053 ไฟล์นี้จะไม่สร้างแถว 9054 ให้ และบอกไว้ในผลลัพธ์ท้ายไฟล์
-- =====================================================================

-- ───────── 1. ผู้ใช้ 9054 (กรรมการภายนอก) ─────────
-- รหัสผ่านก้อนเดียวกับบัญชีทดสอบอื่น (abcd1234) · ไม่มีคณะ/ภาควิชา/ชั้นปี ตามมติ 8 ต.ค.
INSERT INTO users
  (user_id, full_name, email, password_hash, gender, birth_date, user_type,
   faculty_id, department_id, year, is_suspended)
VALUES
  (9054, 'ประเสริฐ ภายนอกสอง', 'referee.ext2@outside.org',
   '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e',
   'male', '1991-06-15', 'external', NULL, NULL, NULL, 0) AS new
ON DUPLICATE KEY UPDATE
  user_type     = new.user_type,
  faculty_id    = new.faculty_id,
  department_id = new.department_id,
  year          = new.year;

-- ───────── 2. คีย์เอกสารของ 9053 → รูปแบบ canonical ─────────
-- เดิมเป็น 'referee-identity/9053-id-card.jpg' ซึ่ง **ไม่ผ่านด่าน A1** (8 ต.ค. 2569)
-- ด่านตรวจรูปคีย์ว่าเป็น referee_identity/<userId>/<UUIDv4>.jpg|png ของเจ้าตัวเท่านั้น
-- ★ ยังไม่มีไฟล์ใน MinIO เหมือนเดิม — เปลี่ยนแค่รูปคีย์ ไม่ได้เปลี่ยนเคสทดสอบ
UPDATE tournament_referees
   SET external_verification_docs =
         JSON_ARRAY('referee_identity/9053/00000000-0000-4000-8000-000000009053.jpg')
 WHERE user_id = 9053
   AND external_verification_docs IS NOT NULL
   AND JSON_CONTAINS(external_verification_docs,
         JSON_QUOTE('referee_identity/9053/00000000-0000-4000-8000-000000009053.jpg')) = 0;

-- ───────── 3. แถวคำเชิญ + เอกสารของ 9054 ─────────
-- สถานะ: รับคำเชิญแล้ว (accepted) · เป็นคนนอก · เอกสารรอแอดมินตรวจ (pending)
-- ★ `active_user_id` ของแถวนี้เป็น NULL เพราะ external + pending ⇒ ไม่ชน UNIQUE ของ migration 036
INSERT INTO tournament_referees
  (tournament_id, user_id, invited_by, invitation_status, is_external,
   external_approval_status, external_verification_docs)
SELECT src.tournament_id, 9054, src.invited_by, 'accepted', 1, 'pending',
       JSON_ARRAY('referee_identity/9054/00000000-0000-4000-8000-000000009054.png')
  FROM tournament_referees src
 WHERE src.user_id = 9053
   AND src.removed_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM tournament_referees done
                    WHERE done.user_id = 9054 AND done.tournament_id = src.tournament_id)
 ORDER BY src.tournament_referee_id DESC
 LIMIT 1;

-- ───────── ตรวจผล ─────────
SELECT 'ผู้ใช้ 9054' AS รายการ,
       (SELECT COUNT(*) FROM users WHERE user_id = 9054) AS จำนวน,
       'ต้องเป็น 1' AS ที่ควรได้
UNION ALL
SELECT 'คีย์ของ 9053 ถูกรูปแบบแล้ว',
       (SELECT COUNT(*) FROM tournament_referees
         WHERE user_id = 9053
           AND JSON_CONTAINS(external_verification_docs,
                 JSON_QUOTE('referee_identity/9053/00000000-0000-4000-8000-000000009053.jpg')) = 1),
       'ต้อง >= 1 (ถ้า 0 = ฐานนี้ไม่มีแถวของ 9053 เลย)'
UNION ALL
SELECT 'แถวเอกสารของ 9054 รอแอดมินตรวจ',
       (SELECT COUNT(*) FROM tournament_referees
         WHERE user_id = 9054 AND external_approval_status = 'pending'),
       'ต้องเป็น 1 (ถ้า 0 = ไม่มีแถวของ 9053 ให้ลอกทัวร์มา)';

-- =====================================================================
-- ขั้นตอนฝั่ง MinIO (ทำครั้งเดียว · ไม่เกี่ยวกับไฟล์ SQL นี้)
-- =====================================================================
--
--   git pull                                   # เอา database/fixtures/ + compose ที่อัปไฟล์ให้
--   cd backend && docker compose up -d minio-init
--
-- `minio-init` อัป `database/fixtures/referee-identity-9054.png` ขึ้น bucket ให้เอง
-- 🔴 ถ้า container `minio-init` เคยรันจบไปก่อน `git pull` มันจะไม่รันใหม่เอง
--    ⇒ ต้องสั่ง `docker compose up -d minio-init` อีกครั้งหลัง pull (หรือ --force-recreate)
--
-- ตรวจว่าไฟล์ขึ้นจริง (ควรเห็นชื่อไฟล์ และ **ต้องไม่เห็น** ของ 9053):
--
--   docker exec ltms-minio mc ls --recursive local/ltms-uploads/referee_identity/
--
-- ถ้ายังไม่มี mc alias ในคอนเทนเนอร์ ใช้หน้าเว็บ MinIO ที่ http://127.0.0.1:9001 ดูก็ได้
-- =====================================================================
