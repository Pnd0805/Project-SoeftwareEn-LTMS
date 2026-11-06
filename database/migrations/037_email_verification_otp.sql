-- OD-53 (4 ต.ค. 2569) — ยืนยันอีเมลด้วย OTP 6 หลัก แบบ "ไม่บล็อกการใช้งาน"
--
-- ที่มา: register ไม่เคยตรวจว่าอีเมลมีจริง ⇒ สมัครด้วย aaa@bbb.ccc ได้ แล้ววันที่ลืมรหัสผ่าน
-- forgot-password จะตอบ 200 ตามปกติ (ตั้งใจให้ตอบเหมือนกันทุกเคส) แต่เมลไปตกที่ไม่มีใครอ่าน
-- ⇒ กู้คืนบัญชีไม่ได้ตลอดไป · A04/A05 ที่ทำเสร็จเมื่อ 4 ต.ค. จึงเชื่อถือได้เท่ากับความจริงของอีเมล
--
-- ═══ ขอบเขตของมตินี้: ยืนยันแล้วไม่ได้สิทธิ์อะไรเพิ่ม และไม่ยืนยันก็ไม่เสียสิทธิ์อะไร ═══
-- ไม่แตะ login() · ไม่มี middleware ไหนอ่าน email_verified · เป็น "ธงที่บันทึกความจริง" เท่านั้น
--
-- รู้ตัวว่าแบบนี้ไม่มีแรงจูงใจให้ใครเข้ามายืนยัน และคาดว่าคอลัมน์นี้จะเป็น 0 แทบทุกแถว
-- เลือกแบบนี้โดยเจตนาเพราะ **ยังไม่มี SMTP จริง** (SMTP_HOST default = localhost:1025 = mailpit)
-- ถ้าบล็อกตอนนี้ แล้ววันเดโมเมลส่งไม่ออก จะกลายเป็น "สมัครไม่ได้ทั้งระบบ" ซึ่งแลกไม่คุ้ม
--
-- ของทุกชิ้นในไฟล์นี้ใช้ได้ทั้งแบบบล็อกและไม่บล็อก ⇒ วันที่ตัดสินจะบล็อก ไม่ต้องแก้ฐานอีก
-- เติมแค่ด่านเดียวในโค้ด (login() หรือ middleware หน้า POST /tournaments · POST /referee-requests)
--
-- ───────────────────────────────────────────────────────────────────────────
-- DEFAULT 0 ไม่ใช่ 1 — ต่างจาก migration 035 ที่เลือก DEFAULT 1 เพื่อคงพฤติกรรมเดิม
-- ที่นี่กลับกัน: ของเดิมคือ "ไม่เคยยืนยันเลย" ⇒ 0 คือความจริง ส่วน 1 คือการโกหกว่าตรวจแล้ว
-- และเพราะธงนี้ยังไม่คุมสิทธิ์อะไร การตั้ง 0 ทั้งตารางจึงไม่ทำให้ใครใช้งานอะไรไม่ได้
ALTER TABLE users
  ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER show_profile_stats;

-- ───────────────────────────────────────────────────────────────────────────
-- ตารางนี้ลอกโครงจาก password_reset_tokens (A04/A05) แต่ **ต่างกัน 2 คอลัมน์** ด้วยเหตุผลคนละข้อ
--
-- ① attempt_count — password_reset_tokens ไม่มีและไม่ต้องมี เพราะ token คือ 64 hex (randomBytes(32))
--    เดาไม่ได้ในทางปฏิบัติ · แต่ OTP คือ 6 หลัก = 1,000,000 แบบ **เดาได้จริง**
--    ⇒ ต้องมีตัวนับเพื่อฆ่าใบนั้นเมื่อกรอกผิดครบโควตา
--    และกัน CPU ด้วย: การกรอกผิด 1 ครั้ง = bcrypt.compare 1 ครั้ง (cost 10) ⇒ ถ้าไม่จำกัด
--    ก็เปิดช่องให้ยิงรัว ๆ ให้เครื่องทำ bcrypt ไม่หยุด
--
-- ② created_at — password_reset_tokens ไม่มี เพราะใช้ทริกว่า "TTL 1 ชม. = หน้าต่าง rate limit 1 ชม."
--    ⇒ แถวที่ยังไม่หมดอายุ ก็คือแถวที่ออกภายใน 1 ชม. (ดู countIssuedWithinLastHour)
--    ที่นี่ใช้ทริกนั้นไม่ได้ เพราะ **TTL 10 นาที แต่หน้าต่าง rate limit 1 ชม.** (ตัวเลขไม่เท่ากัน)
--    ถ้าไม่มี created_at จะนับได้แค่ 10 นาทีล่าสุด ⇒ ขอรหัสใหม่ได้ 3 ใบทุก 10 นาที = 18 ใบ/ชม.
--
-- TTL สั้นลงจาก 1 ชม. เหลือ 10 นาที โดยเจตนา — ช่วงเวลาที่เดาได้ยิ่งสั้นยิ่งดีเมื่อของมีแค่ 6 หลัก
-- และผู้ใช้อยู่หน้าจอรอกรอกอยู่แล้ว ไม่ต้องเผื่อเวลาเหมือนลิงก์กู้รหัสที่อาจเปิดเมลพรุ่งนี้
--
-- code_hash VARCHAR(255) เก็บ bcrypt ไม่เก็บเลขดิบ — เลข 6 หลักรั่วจากฐานแล้วใช้ได้ทันที
-- (bcrypt ของ plain เดิมไม่ซ้ำกัน ⇒ WHERE code_hash = ? ตรง ๆ ไม่ได้ ต้องดึงใบที่ใช้ได้มา compare
--  เหมือน passwordReset.repo.ts — แต่ที่นี่รู้ user_id จากอีเมลก่อน จึงกวาดแค่ใบของคนเดียว)
CREATE TABLE email_verification_otps (
  email_verification_otp_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id       INT NOT NULL,
  code_hash     VARCHAR(255) NOT NULL,
  expires_at    DATETIME NOT NULL,
  used_at       DATETIME NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_email_verification_otps_user (user_id),
  CONSTRAINT fk_email_verification_otps_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
