-- OD-48 (2 ต.ค. 2569) — กัน "กรรมการคนเดียวกันใช้งานได้หลายแถวในทัวร์เดียว" ที่ระดับฐาน
--
-- ที่มา: ด่านกันเชิญซ้ำเคยอ่าน "แถวล่าสุดตาม id" แถวเดียว (แก้ไปแล้วใน dabe9e3) ⇒ ระหว่างนั้น
-- เชิญคนเดิมซ้ำได้ และได้แถวที่ใช้งานได้พร้อมกันหลายแถว · โค้ดตอนนี้กันขาเข้าแล้วและเวลาอ่าน
-- ก็เลือกแถว id น้อยสุดที่ใช้งานได้ (findActiveRefereeRow) จึงไม่พังอีก แต่ฐานยังไม่มีอะไรห้าม
--
-- `database/qa-baseline.sql` ที่เก็บใหม่เมื่อ 1 ต.ค. **สะอาดแล้ว** (ตรวจ 2 ต.ค.: 33 แถว active
-- ไม่มีกลุ่มซ้ำเลย) แต่ฐาน dev ของคนที่เคยเจอบั๊กก่อน dabe9e3 ยังมีแถวค้างอยู่
-- (ฐานของผมมี ทัวร์ 2 ผู้ใช้ 9002 สามแถว id 27/29/30) ⇒ ถ้าใส่ UNIQUE เฉย ๆ migration
-- จะล้มบนเครื่องพวกนั้น จึงต้องล้างให้ก่อนในไฟล์เดียวกัน
--
-- ═══ นิยาม "ใช้งานได้" ต้องตรงกับโค้ดเป๊ะ ═══
-- toRefereeStatus() (mappers/referee.mapper.ts) คืน 'active' เมื่อ:
--   removed_at IS NULL · invitation_status = 'accepted'
--   และถ้า is_external = 1 ต้องไม่ใช่ pending/needs_docs/rejected (เหลือ not_required/approved)
-- ถ้าเงื่อนไขในฐานกับในโค้ดไม่ตรงกัน จะได้ฐานที่ปฏิเสธของที่โค้ดถือว่าถูก หรือกลับกัน
--
-- MySQL 8 ไม่มี partial/filtered index จึงใช้ generated column ที่เป็น NULL เมื่อแถวใช้งานไม่ได้
-- (UNIQUE ไม่นับ NULL ซ้ำกัน) ⇒ แถว pending · declined · rejected_by_admin · removed มีได้ไม่จำกัด
-- ซึ่งจำเป็น เพราะ soft delete เก็บประวัติ และ F-15 ตั้งใจให้มีแถว rejected_by_admin ค้างข้างแถวที่ใช้งานได้

-- ─── ขั้น 1: ย้ายการมอบหมายแมตช์จากแถวที่จะถูกปิดไปอยู่กับแถวที่เก็บไว้ ───
--
-- ต้องทำก่อนปิดแถว ไม่ใช่หลัง · F03 ตั้งใจไม่ล้าง match_referees ตอนถอดกรรมการ
-- ("แถวใน match_referees คงไว้ — F12/coverage กรองด้วย removed_at เอง") ⇒ ถ้าปิดแถวทิ้งเฉย ๆ
-- แมตช์ที่เคยมอบหมายผ่านแถวนั้นจะกลายเป็นขาดคนเงียบ ๆ ทั้งที่กรรมการคนเดิมยังอยู่ในทัวร์
--
-- UPDATE IGNORE เพราะ UNIQUE (match_id, tournament_referee_id) — ถ้าแถวที่เก็บไว้มีแมตช์นั้นอยู่แล้ว
-- การย้ายจะชนและถูกข้าม แล้วขั้นถัดไปลบตัวที่ย้ายไม่ได้ออก (ข้อมูลไม่หาย เพราะของเดิมมีอยู่แล้ว)
UPDATE IGNORE match_referees mr
  JOIN tournament_referees tr ON tr.tournament_referee_id = mr.tournament_referee_id
  JOIN ( SELECT tournament_id, user_id, MIN(tournament_referee_id) AS keep_id
           FROM tournament_referees
          WHERE removed_at IS NULL
            AND invitation_status = 'accepted'
            AND (is_external = 0 OR external_approval_status IN ('not_required', 'approved'))
          GROUP BY tournament_id, user_id
         HAVING COUNT(*) > 1 ) dup
    ON dup.tournament_id = tr.tournament_id AND dup.user_id = tr.user_id
   SET mr.tournament_referee_id = dup.keep_id
 WHERE tr.removed_at IS NULL
   AND tr.invitation_status = 'accepted'
   AND (tr.is_external = 0 OR tr.external_approval_status IN ('not_required', 'approved'))
   AND tr.tournament_referee_id <> dup.keep_id;

-- ─── ขั้น 2: ลบการมอบหมายที่ย้ายไม่ได้ (ชน UNIQUE = แถวที่เก็บไว้มีแมตช์นั้นอยู่แล้ว) ───
DELETE mr FROM match_referees mr
  JOIN tournament_referees tr ON tr.tournament_referee_id = mr.tournament_referee_id
  JOIN ( SELECT tournament_id, user_id, MIN(tournament_referee_id) AS keep_id
           FROM tournament_referees
          WHERE removed_at IS NULL
            AND invitation_status = 'accepted'
            AND (is_external = 0 OR external_approval_status IN ('not_required', 'approved'))
          GROUP BY tournament_id, user_id
         HAVING COUNT(*) > 1 ) dup
    ON dup.tournament_id = tr.tournament_id AND dup.user_id = tr.user_id
 WHERE tr.removed_at IS NULL
   AND tr.invitation_status = 'accepted'
   AND (tr.is_external = 0 OR tr.external_approval_status IN ('not_required', 'approved'))
   AND tr.tournament_referee_id <> dup.keep_id;

-- ─── ขั้น 3: ปิดแถวซ้ำแบบ soft delete เก็บแถว id น้อยสุดไว้ ───
--
-- เก็บ id น้อยสุดเพราะ findActiveRefereeRow() เลือกแถวนั้นอยู่แล้ว ⇒ **พฤติกรรมของระบบไม่เปลี่ยนเลย**
-- แถวที่ถูกปิดคือแถวที่โค้ดไม่เคยหยิบมาใช้ตั้งแต่ dabe9e3
--
-- removed_by เป็น NULL โดยเจตนา = "ระบบล้างข้อมูล" ไม่ใช่คนกดถอน (FK ยอม NULL)
-- ไม่ยิงแจ้งเตือน referee_removed เพราะกรรมการคนนั้น **ยังเป็นกรรมการอยู่** แค่เหลือใบเดียว
-- ถ้าแจ้งจะเป็นการบอกข้อมูลเท็จว่าถูกถอด
UPDATE tournament_referees tr
  JOIN ( SELECT tournament_id, user_id, MIN(tournament_referee_id) AS keep_id
           FROM tournament_referees
          WHERE removed_at IS NULL
            AND invitation_status = 'accepted'
            AND (is_external = 0 OR external_approval_status IN ('not_required', 'approved'))
          GROUP BY tournament_id, user_id
         HAVING COUNT(*) > 1 ) dup
    ON dup.tournament_id = tr.tournament_id AND dup.user_id = tr.user_id
   SET tr.removed_at = NOW(), tr.removed_by = NULL
 WHERE tr.removed_at IS NULL
   AND tr.invitation_status = 'accepted'
   AND (tr.is_external = 0 OR tr.external_approval_status IN ('not_required', 'approved'))
   AND tr.tournament_referee_id <> dup.keep_id;

-- ─── ขั้น 4: generated column ───
-- NULL = แถวนี้ใช้งานไม่ได้ (จึงไม่ถูก UNIQUE คุม) · user_id = ใช้งานได้
-- VIRTUAL ไม่ STORED เพราะเป็นนิพจน์สั้น ๆ คิดตอนอ่าน ไม่ต้องกินที่เก็บ และ InnoDB ทำ index ให้ได้
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'tournament_referees'
     AND COLUMN_NAME  = 'active_user_id'
);

SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE tournament_referees
     ADD COLUMN active_user_id INT GENERATED ALWAYS AS (
       CASE WHEN removed_at IS NULL
                 AND invitation_status = ''accepted''
                 AND (is_external = 0 OR external_approval_status IN (''not_required'', ''approved''))
            THEN user_id END
     ) VIRTUAL',
  'DO 0'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ─── ขั้น 5: UNIQUE ───
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'tournament_referees'
     AND INDEX_NAME   = 'uq_tr_active_once'
);

SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE tournament_referees
     ADD UNIQUE KEY uq_tr_active_once (tournament_id, active_user_id)',
  'DO 0'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
