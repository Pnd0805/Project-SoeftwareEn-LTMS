-- =====================================================================
-- 048 — กันคำขอซ้ำที่ระดับฐานข้อมูล (BE-10 · BE-38 · มติ 7 ต.ค. 2569 ข้อ ⑦ ค)
-- =====================================================================
--
-- ปัญหา: ไม่มีด่านกันคำขอซ้ำทั้งที่ service และที่ฐาน ⇒ ส่งใบเดิมสองครั้งได้ 201 ทั้งคู่
--   คำเชิญเข้าทีม      ใบที่ซ้ำยังเป็น pending หลังคนนั้นเข้าทีมแล้ว
--   ขอเป็นทีม Official  ใบที่ซ้ำค้างในคิวแอดมินหลังทีมเป็น Official แล้ว
--   ขอโอนหัวหน้าทีม     ได้ 201 ทั้งสองครั้ง
--   ขอแก้ Hard Filter   baseline ทัวร์ 14 มี 3 ใบเหมือนกันค้างอยู่ · ใบที่สองยังค้างหลังใบแรกอนุมัติ
--   รายงานผู้ใช้        คนเดิมรายงานเป้าหมายเดิมซ้ำได้
-- ⇒ คิวแอดมินมีงานปลอม และคนตรวจเสียเวลาอ่านเรื่องเดิมหลายรอบ
--
-- 🔴 ทำไมต้องมีด่านที่ฐาน ไม่ใช่แค่ที่ service (มติ ⑦ ค = ทั้งสองชั้น)
--   ด่านที่ service คือ SELECT แล้ว INSERT ซึ่งมีช่องว่างระหว่างสองคำสั่ง
--   ⇒ กดปุ่มรัว ๆ / เปิดสองแท็บ จะผ่านด่านทั้งคู่แล้วเขียนทั้งคู่ (เคสเดียวกับ BE-03)
--   ด่านที่ service มีไว้ให้ "ข้อความดี" · ด่านที่ฐานมีไว้ให้ "ถูกต้องจริง"
--
-- 🔴 ทำไมใช้ generated column ไม่ใช่ UNIQUE ธรรมดา
--   ต้องการ "หนึ่งใบ pending ต่อคู่" แต่ใบที่ตัดสินแล้วมีได้หลายใบ (ประวัติ)
--   MySQL ไม่มี partial index (WHERE) แบบ Postgres ⇒ ใช้คอลัมน์คำนวณที่เป็น NULL
--   เมื่อสถานะไม่ใช่ pending แล้วใส่ UNIQUE บนคอลัมน์นั้น — UNIQUE ของ MySQL
--   ยอมให้มี NULL ซ้ำกันได้ไม่จำกัด ⇒ ได้ผลเท่ากับ partial index
--   ★ VIRTUAL ไม่ STORED — ค่าคำนวณตอนอ่าน/ตอนตรวจ index ไม่กินที่เก็บเพิ่ม
--
-- ⚠️ คำเชิญที่หมดอายุ: `team_invitations.team_invitation_status` ยังเป็น 'pending' อยู่
--   แม้เลย `expires_at` แล้ว (ระบบไม่มี scheduler) ⇒ ถ้าปล่อยไว้ UNIQUE จะบล็อก
--   การเชิญคนเดิมใหม่ตลอดไป ซึ่งผิดเจตนา
--   ★ แก้ที่ service: ก่อน INSERT ให้ปิดใบที่หมดอายุเป็น 'expired' ก่อน (ดู team.service.ts)
--     ตรงนี้จึงกันได้เฉพาะใบที่ยัง "มีชีวิตจริง" ซึ่งคือสิ่งที่ต้องการ
--   migration นี้ปิดใบที่หมดอายุค้างอยู่ให้ด้วย ไม่งั้น ALTER จะชนกับข้อมูลเดิม
--
-- 🙋 ข้อมูลเดิมที่ซ้ำอยู่แล้ว — **ตัดสินใจเอง บอกไว้ตรงนี้**
--   ALTER จะล้มถ้ามีคู่ที่ซ้ำกันค้างอยู่ (เช่น baseline ทัวร์ 14 ที่มี 3 ใบ)
--   เลือก "เก็บใบที่เก่าที่สุดไว้ ที่เหลือตั้งเป็น rejected พร้อมเหตุผลที่อธิบายตัวเอง"
--   เพราะ ① ใบแรกคือใบที่คนตั้งใจยื่น ② ไม่ลบประวัติทิ้ง ③ คนที่เห็นในจอจะรู้ว่าเกิดอะไร
--   ฐาน dev ของกฤษณ์ตรวจแล้ว **ไม่มีคู่ที่ซ้ำ** (7 ต.ค. 2569) ⇒ ส่วนนี้จะไม่แตะอะไรเลย
--   แต่เครื่องที่ restore qa-baseline.sql จะโดน
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- ① เก็บกวาดข้อมูลเดิมก่อน ALTER
-- ─────────────────────────────────────────────────────────────────────

-- คำเชิญที่เลยวันหมดอายุแล้วแต่ยังค้างเป็น pending
UPDATE team_invitations
   SET team_invitation_status = 'expired'
 WHERE team_invitation_status = 'pending'
   AND expires_at < NOW();

-- คำเชิญ pending ที่ซ้ำคู่ (team, invited_user) — เก็บใบที่เก่าที่สุด
UPDATE team_invitations t
  JOIN (SELECT team_id, invited_user_id, MIN(team_invitation_id) AS keep_id
          FROM team_invitations
         WHERE team_invitation_status = 'pending'
         GROUP BY team_id, invited_user_id
        HAVING COUNT(*) > 1) d
    ON d.team_id = t.team_id AND d.invited_user_id = t.invited_user_id
   SET t.team_invitation_status = 'expired'
 WHERE t.team_invitation_status = 'pending'
   AND t.team_invitation_id <> d.keep_id;

-- คำขอของทีม (ขอเป็น Official / ขอโอนหัวหน้า) ที่ซ้ำคู่ (team, request_type)
UPDATE team_admin_requests r
  JOIN (SELECT team_id, request_type, MIN(team_admin_request_id) AS keep_id
          FROM team_admin_requests
         WHERE team_admin_request_status = 'pending'
         GROUP BY team_id, request_type
        HAVING COUNT(*) > 1) d
    ON d.team_id = r.team_id AND d.request_type = r.request_type
   SET r.team_admin_request_status = 'rejected',
       r.rejection_reason = 'ปิดอัตโนมัติ (migration 048) — เป็นใบซ้ำของคำขอที่ยื่นไว้ก่อนแล้ว'
 WHERE r.team_admin_request_status = 'pending'
   AND r.team_admin_request_id <> d.keep_id;

-- คำขอแก้ไขทัวร์ที่ซ้ำ (หนึ่งใบ pending ต่อทัวร์)
UPDATE tournament_amendment_requests a
  JOIN (SELECT tournament_id, MIN(tournament_amendment_request_id) AS keep_id
          FROM tournament_amendment_requests
         WHERE tournament_amendment_request_status = 'pending'
         GROUP BY tournament_id
        HAVING COUNT(*) > 1) d
    ON d.tournament_id = a.tournament_id
   SET a.tournament_amendment_request_status = 'rejected',
       a.rejection_reason = 'ปิดอัตโนมัติ (migration 048) — เป็นใบซ้ำของคำขอที่ยื่นไว้ก่อนแล้ว'
 WHERE a.tournament_amendment_request_status = 'pending'
   AND a.tournament_amendment_request_id <> d.keep_id;

-- รายงานผู้ใช้ที่ซ้ำคู่ (ผู้รายงาน, เป้าหมาย)
UPDATE user_reports u
  JOIN (SELECT reported_by, target_user_id, MIN(user_report_id) AS keep_id
          FROM user_reports
         WHERE user_report_status = 'pending'
         GROUP BY reported_by, target_user_id
        HAVING COUNT(*) > 1) d
    ON d.reported_by = u.reported_by AND d.target_user_id = u.target_user_id
   SET u.user_report_status = 'rejected',
       u.rejection_reason = 'ปิดอัตโนมัติ (migration 048) — เป็นใบซ้ำของรายงานที่ยื่นไว้ก่อนแล้ว'
 WHERE u.user_report_status = 'pending'
   AND u.user_report_id <> d.keep_id;

-- ─────────────────────────────────────────────────────────────────────
-- ② คอลัมน์คำนวณ + UNIQUE
--    ★ CONCAT_WS ไม่ใช่ CONCAT — CONCAT คืน NULL ถ้ามีช่องไหนเป็น NULL
--      (target_user_id ของ team_admin_requests เป็น NULL ได้สำหรับ official_status)
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE team_invitations
  ADD COLUMN pending_key VARCHAR(32)
      GENERATED ALWAYS AS (IF(team_invitation_status = 'pending',
                              CONCAT_WS(':', team_id, invited_user_id), NULL)) VIRTUAL,
  ADD UNIQUE KEY uq_invitation_pending (pending_key);

ALTER TABLE team_admin_requests
  ADD COLUMN pending_key VARCHAR(48)
      GENERATED ALWAYS AS (IF(team_admin_request_status = 'pending',
                              CONCAT_WS(':', team_id, request_type), NULL)) VIRTUAL,
  ADD UNIQUE KEY uq_team_admin_request_pending (pending_key);

ALTER TABLE tournament_amendment_requests
  ADD COLUMN pending_key VARCHAR(16)
      GENERATED ALWAYS AS (IF(tournament_amendment_request_status = 'pending',
                              tournament_id, NULL)) VIRTUAL,
  ADD UNIQUE KEY uq_amendment_pending (pending_key);

ALTER TABLE user_reports
  ADD COLUMN pending_key VARCHAR(32)
      GENERATED ALWAYS AS (IF(user_report_status = 'pending',
                              CONCAT_WS(':', reported_by, target_user_id), NULL)) VIRTUAL,
  ADD UNIQUE KEY uq_user_report_pending (pending_key);
