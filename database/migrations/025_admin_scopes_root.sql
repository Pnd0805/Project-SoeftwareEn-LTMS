-- C2 (แก้ 22 ก.ย. 2569) — เพิ่มระดับ Root/System Owner เหนือ university_wide
-- Root มีได้คนเดียวในระบบ ตั้งได้แค่ผ่าน seed/DB bootstrap เท่านั้น ไม่มี API สร้าง (grantScope schema รับแค่ 'faculty'/'university_wide')
ALTER TABLE admin_scopes MODIFY COLUMN scope_type ENUM('faculty','university_wide','root') NOT NULL;
