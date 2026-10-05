-- OD-66 — เหรียญที่ได้มาต้องเห็นตั้งแต่แรก
--
-- เดิม user_rewards.is_displayed DEFAULT FALSE และ RW02 (โปรไฟล์สาธารณะ) กรอง is_displayed = TRUE
-- ⇒ เหรียญที่ระบบแจกให้เองไม่โผล่ที่ไหนเลยนอกจาก RW03 (หน้าของตัวเอง)
-- ⇒ ผู้ใช้ไม่มีทางรู้ว่าตัวเองได้เหรียญ จนกว่าจะเข้าไปหาเอง แล้วกดเปิดทีละอัน
--
-- มติ: ได้แล้วขึ้นเลย · สวิตช์ RW04 เปลี่ยนความหมายจาก "เลือกโชว์" เป็น "เลือกซ่อน"
--
-- ★ ตัวแจกเหรียญ (reward.repo) INSERT แค่ (user_id, reward_id) ไม่ระบุ is_displayed
--   ⇒ เปลี่ยน DEFAULT พอ ไม่ต้องแตะโค้ดแม้แต่บรรทัดเดียว
-- ★ RW02 ยังกรอง is_displayed = TRUE เหมือนเดิม — คนที่กดซ่อนยังซ่อนได้จริง

ALTER TABLE user_rewards ALTER COLUMN is_displayed SET DEFAULT TRUE;

-- แถวที่มีอยู่ก่อน migration นี้ (ยังไม่มีใครเคยได้เหรียญเลย — เผื่อฐานที่แจกไปแล้ว)
UPDATE user_rewards SET is_displayed = TRUE WHERE is_displayed = FALSE;
