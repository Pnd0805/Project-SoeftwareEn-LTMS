-- ข้อมูลทดสอบเพิ่มเติมของ LTMS (สร้างโดยสคริปต์)
-- รหัสผ่านของทุกบัญชี: abcd1234
--
-- ⚠️ รันบนฐานข้อมูลที่ยังไม่มีใบสมัคร/แมตช์ที่อ้างถึงทีม 9020–9040 เท่านั้น
--    (บล็อกข้างล่างลบทีมช่วงนั้นทิ้งก่อน ถ้ามีใบสมัครค้างอยู่จะติด foreign key)
--
-- กติกาของข้อมูลชุดนี้: สมาชิกในทีมเดียวกันต้องอยู่คณะเดียวกันทั้งทีม
-- เพราะ hard filter ของ backend ตรวจคณะเป็นรายคน (tournament_eligibility_rules)
-- ทีมที่คละคณะจะสมัครรายการที่จำกัดคณะไม่ได้เลยแม้แต่ทีมเดียว
SET FOREIGN_KEY_CHECKS = 1;

-- ลบของชุดนี้ก่อน เพื่อให้รันซ้ำได้โดยไม่ชนคีย์
DELETE FROM team_invitations WHERE team_id BETWEEN 9020 AND 9040;
DELETE FROM team_admin_requests WHERE team_id BETWEEN 9020 AND 9040;
DELETE FROM team_members WHERE team_id BETWEEN 9020 AND 9040;
DELETE FROM team_members WHERE user_id BETWEEN 9201 AND 9260;
DELETE FROM teams WHERE team_id BETWEEN 9020 AND 9040;
DELETE FROM team_invitations WHERE invited_user_id BETWEEN 9201 AND 9260;
DELETE FROM users WHERE user_id BETWEEN 9201 AND 9260;
DELETE FROM users WHERE user_id BETWEEN 9051 AND 9053;

-- ผู้ใช้
INSERT INTO users (user_id, full_name, email, password_hash, gender, birth_date, user_type,
                   faculty_id, department_id, year, is_suspended, suspended_reason) VALUES
  (9051, 'วีระชัย นกหวีดทอง', 'referee3@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '1990-04-12', 'staff', 1, 1, NULL, 0, NULL),
  (9052, 'อรทัย กฎกติกา', 'referee4@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '1992-08-03', 'staff', 2, 6, NULL, 0, NULL),
  (9053, 'สมเกียรติ ภายนอก', 'referee.ext@outside.org', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '1988-01-20', 'external', NULL, NULL, NULL, 0, NULL),
  (9201, 'ปกรณ์ ใจดี', 'p9201@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2005-01-01', 'student', 1, 1, 1, 0, NULL),
  (9202, 'ธนวัฒน์ วัฒนกุล', 'p9202@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2004-02-02', 'student', 1, 2, 2, 0, NULL),
  (9203, 'ศุภโชค มณีรัตน์', 'p9203@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2003-03-03', 'student', 1, 3, 3, 0, NULL),
  (9204, 'กิตติพงศ์ รุ่งเรือง', 'p9204@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2002-04-04', 'student', 1, 4, 4, 0, NULL),
  (9205, 'อนุชา ธารารักษ์', 'p9205@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2005-05-05', 'student', 1, 5, 1, 0, NULL),
  (9206, 'ณัฐพล ทองคำ', 'p9206@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2004-06-06', 'student', 1, 1, 2, 0, NULL),
  (9207, 'วรินทร ปัญญาดี', 'p9207@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2003-07-07', 'student', 1, 2, 3, 0, NULL),
  (9208, 'ชัยวัฒน์ พงษ์ไพบูลย์', 'p9208@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2002-08-08', 'student', 1, 3, 4, 0, NULL),
  (9209, 'พีรพล จันทร์เพ็ญ', 'p9209@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2005-09-09', 'student', 1, 4, 1, 0, NULL),
  (9210, 'สหรัฐ บุญมา', 'p9210@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2004-10-10', 'student', 1, 5, 2, 0, NULL),
  (9211, 'ภูมิพัฒน์ เกษมสุข', 'p9211@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2003-11-11', 'student', 1, 1, 3, 0, NULL),
  (9212, 'รัชชานนท์ ศรีสุข', 'p9212@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2002-12-12', 'student', 1, 2, 4, 0, NULL),
  (9213, 'กันตพงศ์ อินทรีย์', 'p9213@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2006-01-01', 'student', 2, 6, 1, 0, NULL),
  (9214, 'ธีรเดช แสงทอง', 'p9214@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2005-02-02', 'student', 2, 7, 2, 0, NULL),
  (9215, 'อัครเดช สุวรรณโชติ', 'p9215@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2004-03-03', 'student', 2, 8, 3, 0, NULL),
  (9216, 'วชิรวิทย์ ใจดี', 'p9216@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2003-04-04', 'student', 2, 9, 4, 0, NULL),
  (9217, 'นภัสกร วัฒนกุล', 'p9217@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2006-05-05', 'student', 2, 10, 1, 0, NULL),
  (9218, 'ปิยะพงษ์ มณีรัตน์', 'p9218@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2005-06-06', 'student', 2, 6, 2, 0, NULL),
  (9219, 'จิรายุ รุ่งเรือง', 'p9219@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2004-07-07', 'student', 2, 7, 3, 0, NULL),
  (9220, 'ศิวกร ธารารักษ์', 'p9220@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2003-08-08', 'student', 2, 8, 4, 0, NULL),
  (9221, 'ปกรณ์ ทองคำ', 'p9221@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2006-09-09', 'student', 2, 9, 1, 0, NULL),
  (9222, 'ธนวัฒน์ ปัญญาดี', 'p9222@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2005-10-10', 'student', 2, 10, 2, 0, NULL),
  (9223, 'ศุภโชค พงษ์ไพบูลย์', 'p9223@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2004-11-11', 'student', 2, 6, 3, 0, NULL),
  (9224, 'กิตติพงศ์ จันทร์เพ็ญ', 'p9224@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2003-12-12', 'student', 2, 7, 4, 0, NULL),
  (9225, 'ณัฐธิดา ใจดี', 'p9225@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2005-01-01', 'student', 1, 1, 1, 0, NULL),
  (9226, 'พิมพ์ชนก วัฒนกุล', 'p9226@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2004-02-02', 'student', 1, 2, 2, 0, NULL),
  (9227, 'กัญญาณัฐ มณีรัตน์', 'p9227@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2003-03-03', 'student', 1, 3, 3, 0, NULL),
  (9228, 'ศิรประภา รุ่งเรือง', 'p9228@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2002-04-04', 'student', 1, 4, 4, 0, NULL),
  (9229, 'ชนิกานต์ ธารารักษ์', 'p9229@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2005-05-05', 'student', 1, 5, 1, 0, NULL),
  (9230, 'วรรณิดา ทองคำ', 'p9230@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2004-06-06', 'student', 1, 1, 2, 0, NULL),
  (9231, 'ธัญชนก ปัญญาดี', 'p9231@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2003-07-07', 'student', 1, 2, 3, 0, NULL),
  (9232, 'อริสรา พงษ์ไพบูลย์', 'p9232@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2002-08-08', 'student', 2, 9, 4, 0, NULL),
  (9233, 'อนุชา ธารารักษ์', 'p9233@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2008-05-14', 'student', 3, 11, 1, 0, NULL),
  (9234, 'วรรณิดา ทองคำ', 'p9234@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2008-09-30', 'student', 3, 12, 1, 0, NULL),
  (9235, 'วรินทร ปัญญาดี', 'p9235@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2001-02-11', 'student', 3, 13, 4, 0, NULL),
  (9236, 'อริสรา พงษ์ไพบูลย์', 'p9236@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2000-11-05', 'student', 3, 11, 4, 0, NULL),
  (9237, 'พีรพล จันทร์เพ็ญ', 'p9237@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2004-06-18', 'student', 3, 12, 3, 0, NULL),
  (9238, 'สุพิชญา บุญมา', 'p9238@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2003-03-22', 'student', 3, 13, 4, 0, NULL),
  (9239, 'ภูมิพัฒน์ เกษมสุข', 'p9239@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2006-07-09', 'student', 3, 11, 2, 0, NULL),
  (9240, 'รัชชานนท์ ศรีสุข', 'p9240@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2005-12-01', 'student', 3, 12, 3, 1, 'ทดสอบบัญชีที่ถูกระงับ'),
  (9241, 'กิตติพงศ์ รุ่งเรือง', 'p9241@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2004-01-01', 'student', 1, 2, 1, 0, NULL),
  (9242, 'อนุชา ธารารักษ์', 'p9242@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2005-02-02', 'student', 1, 3, 2, 0, NULL),
  (9243, 'ณัฐพล ทองคำ', 'p9243@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2006-03-03', 'student', 1, 4, 3, 0, NULL),
  (9244, 'วรินทร ปัญญาดี', 'p9244@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2007-04-04', 'student', 1, 5, 4, 0, NULL),
  (9245, 'ชัยวัฒน์ พงษ์ไพบูลย์', 'p9245@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2004-05-05', 'student', 1, 1, 1, 0, NULL),
  (9246, 'พีรพล จันทร์เพ็ญ', 'p9246@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2005-06-06', 'student', 1, 2, 2, 0, NULL),
  (9247, 'สหรัฐ บุญมา', 'p9247@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2006-07-07', 'student', 1, 3, 3, 0, NULL),
  (9248, 'ภูมิพัฒน์ เกษมสุข', 'p9248@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2007-08-08', 'student', 1, 4, 4, 0, NULL),
  (9249, 'รัชชานนท์ ศรีสุข', 'p9249@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2004-09-09', 'student', 1, 5, 1, 0, NULL),
  (9250, 'กันตพงศ์ อินทรีย์', 'p9250@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2005-10-10', 'student', 1, 1, 2, 0, NULL),
  (9251, 'ธีรเดช แสงทอง', 'p9251@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2006-11-11', 'student', 1, 2, 3, 0, NULL),
  (9252, 'อัครเดช สุวรรณโชติ', 'p9252@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'male', '2007-12-12', 'student', 1, 3, 4, 0, NULL),
  (9253, 'ศิรประภา ใจดี', 'p9253@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2004-01-13', 'student', 1, 4, 1, 0, NULL),
  (9254, 'ชนิกานต์ วัฒนกุล', 'p9254@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2005-02-14', 'student', 1, 5, 2, 0, NULL),
  (9255, 'วรรณิดา มณีรัตน์', 'p9255@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2006-03-15', 'student', 2, 6, 3, 0, NULL),
  (9256, 'ธัญชนก รุ่งเรือง', 'p9256@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2007-04-16', 'student', 2, 7, 4, 0, NULL),
  (9257, 'อริสรา ธารารักษ์', 'p9257@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2004-05-17', 'student', 2, 8, 1, 0, NULL),
  (9258, 'ปรียานุช ทองคำ', 'p9258@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2005-06-18', 'student', 2, 9, 2, 0, NULL),
  (9259, 'สุพิชญา ปัญญาดี', 'p9259@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2006-07-19', 'student', 2, 10, 3, 0, NULL),
  (9260, 'เบญญาภา พงษ์ไพบูลย์', 'p9260@ku.th', '$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e', 'female', '2007-08-20', 'student', 2, 6, 4, 0, NULL);

-- ทีมใหม่
INSERT INTO teams (team_id, name, sport_type_id, leader_id, readiness_status, official_status) VALUES
  (9020, 'วิศวกรรม ฟุตบอล A', 1, 9201, 'Ready', 'Official'),
  (9021, 'วิทยาศาสตร์ ฟุตบอล B', 1, 9213, 'Ready', 'Unofficial'),
  (9022, 'ฟุตบอล ทีมกำลังรวมคน', 1, 9233, 'Forming', 'Unofficial'),
  (9023, 'ฟุตซอล วิศวกรรม', 2, 9201, 'Ready', 'Unofficial'),
  (9024, 'ฟุตซอล วิทยาศาสตร์', 2, 9213, 'Ready', 'Unofficial'),
  (9025, 'บาสเกตบอล วิศวกรรม', 3, 9207, 'Ready', 'Unofficial'),
  (9026, 'บาสเกตบอล วิทยาศาสตร์', 3, 9219, 'Ready', 'Unofficial'),
  (9027, 'วอลเลย์บอลหญิง วิศวกรรม', 4, 9225, 'Ready', 'Unofficial'),
  (9028, 'วอลเลย์บอลชาย วิทยาศาสตร์', 4, 9213, 'Ready', 'Unofficial'),
  (9029, 'ตะกร้อ วิศวกรรม', 5, 9203, 'Ready', 'Unofficial'),
  (9030, 'ตะกร้อ วิทยาศาสตร์', 5, 9215, 'Ready', 'Unofficial'),
  (9031, 'RoV ทีมแดง', 8, 9201, 'Ready', 'Unofficial'),
  (9032, 'RoV ทีมน้ำเงิน', 8, 9213, 'Ready', 'Unofficial'),
  (9033, 'เทเบิลเทนนิส คู่ผสม', 7, 9225, 'Ready', 'Unofficial');

-- สมาชิกของทีมใหม่ (ตัวจริง/ตัวสำรอง สลับให้มีทั้งสองแบบ)
INSERT INTO team_members (team_id, user_id, position) VALUES
  (9020, 9201, 'starter'),
  (9020, 9202, 'starter'),
  (9020, 9203, 'starter'),
  (9020, 9204, 'starter'),
  (9020, 9205, 'starter'),
  (9020, 9206, 'starter'),
  (9020, 9207, 'starter'),
  (9020, 9208, 'starter'),
  (9020, 9209, 'starter'),
  (9020, 9210, 'starter'),
  (9020, 9211, 'starter'),
  (9020, 9212, 'substitute'),
  (9021, 9213, 'starter'),
  (9021, 9214, 'starter'),
  (9021, 9215, 'starter'),
  (9021, 9216, 'starter'),
  (9021, 9217, 'starter'),
  (9021, 9218, 'starter'),
  (9021, 9219, 'starter'),
  (9021, 9220, 'starter'),
  (9021, 9221, 'starter'),
  (9021, 9222, 'starter'),
  (9021, 9223, 'starter'),
  (9021, 9224, 'substitute'),
  (9022, 9233, 'starter'),
  (9022, 9234, 'starter'),
  (9022, 9235, 'starter'),
  (9022, 9236, 'starter'),
  (9022, 9237, 'starter'),
  (9023, 9201, 'starter'),
  (9023, 9202, 'starter'),
  (9023, 9203, 'starter'),
  (9023, 9204, 'starter'),
  (9023, 9205, 'starter'),
  (9023, 9206, 'substitute'),
  (9024, 9213, 'starter'),
  (9024, 9214, 'starter'),
  (9024, 9215, 'starter'),
  (9024, 9216, 'starter'),
  (9024, 9217, 'starter'),
  (9024, 9218, 'substitute'),
  (9025, 9207, 'starter'),
  (9025, 9208, 'starter'),
  (9025, 9209, 'starter'),
  (9025, 9210, 'starter'),
  (9025, 9211, 'starter'),
  (9025, 9212, 'substitute'),
  (9026, 9219, 'starter'),
  (9026, 9220, 'starter'),
  (9026, 9221, 'starter'),
  (9026, 9222, 'starter'),
  (9026, 9223, 'starter'),
  (9026, 9224, 'substitute'),
  (9027, 9225, 'starter'),
  (9027, 9226, 'starter'),
  (9027, 9227, 'starter'),
  (9027, 9228, 'starter'),
  (9027, 9229, 'starter'),
  (9027, 9230, 'starter'),
  (9027, 9231, 'starter'),
  (9028, 9213, 'starter'),
  (9028, 9214, 'starter'),
  (9028, 9215, 'starter'),
  (9028, 9216, 'starter'),
  (9028, 9217, 'starter'),
  (9028, 9218, 'starter'),
  (9028, 9219, 'starter'),
  (9029, 9203, 'starter'),
  (9029, 9204, 'starter'),
  (9029, 9205, 'starter'),
  (9029, 9206, 'substitute'),
  (9030, 9215, 'starter'),
  (9030, 9216, 'starter'),
  (9030, 9217, 'starter'),
  (9031, 9201, 'starter'),
  (9031, 9202, 'starter'),
  (9031, 9203, 'starter'),
  (9031, 9204, 'starter'),
  (9031, 9205, 'starter'),
  (9032, 9213, 'starter'),
  (9032, 9214, 'starter'),
  (9032, 9215, 'starter'),
  (9032, 9216, 'starter'),
  (9032, 9217, 'starter'),
  (9033, 9225, 'starter'),
  (9033, 9201, 'starter');

-- เติมสมาชิกให้ทีมที่มากับ seed เดิม แล้วปรับสถานะความพร้อมให้ตรงกับจำนวนจริง
-- (ทีม 9003 กับ 9005 ถูกลบไปแล้ว จึงไม่เติมให้)
-- ทุกทีมต้องอยู่คณะเดียวกันทั้งทีม ไม่งั้นติด hard filter ข้อคณะทันทีที่รายการไหนตั้งเงื่อนไขคณะ
--   9001 ทีมวิศวะ FC (คณะ 1) · 9002 ทีมบาสวิศวะ (คณะ 1) · 9004 ทีมวอลเลย์วิทยา (คณะ 2)
DELETE FROM team_members WHERE team_id IN (9001, 9002, 9004) AND user_id BETWEEN 9241 AND 9260;
DELETE FROM team_members WHERE team_id = 9002 AND user_id = 9002;   -- สมหญิง (คณะ 2) ไม่ใช่ผู้เล่นของทีมวิศวะ
DELETE FROM team_members WHERE team_id = 9004 AND user_id = 9001;   -- สมชาย (คณะ 1) ไม่ใช่ผู้เล่นของทีมวิทยา
INSERT INTO team_members (team_id, user_id, position) VALUES
  (9001, 9241, 'starter'), (9001, 9242, 'starter'), (9001, 9243, 'starter'), (9001, 9244, 'substitute'),
  (9001, 9245, 'starter'), (9001, 9246, 'starter'), (9001, 9247, 'starter'), (9001, 9248, 'substitute'),
  (9001, 9249, 'starter'), (9001, 9250, 'starter'), (9001, 9251, 'starter'),
  (9002, 9252, 'starter'), (9002, 9253, 'starter'), (9002, 9254, 'starter'), (9002, 9257, 'starter'),
  (9004, 9255, 'starter'), (9004, 9256, 'starter'), (9004, 9258, 'starter'),
  (9004, 9259, 'substitute'), (9004, 9260, 'starter');
UPDATE users SET faculty_id = 1, department_id = 3 WHERE user_id = 9257;
UPDATE users SET faculty_id = 2, department_id = 8 WHERE user_id = 9258;

UPDATE teams t
JOIN sport_types s ON s.sport_type_id = t.sport_type_id
JOIN (SELECT team_id, COUNT(*) AS n FROM team_members GROUP BY team_id) c ON c.team_id = t.team_id
SET t.readiness_status = IF(c.n >= s.min_members, 'Ready', 'Forming'), t.updated_at = NOW()
WHERE t.deleted_at IS NULL;

-- คำเชิญที่ยังรอคนตอบ (ใช้ทดสอบหน้า Inbox) และคำเชิญที่หมดอายุแล้ว
INSERT INTO team_invitations (team_id, invited_user_id, invited_by_user_id, team_invitation_status, expires_at) VALUES
  (9020, 9003, 9201, 'pending', DATE_ADD(NOW(), INTERVAL 7 DAY)),
  (9021, 9003, 9213, 'pending', DATE_ADD(NOW(), INTERVAL 3 DAY)),
  (9027, 9238, 9225, 'pending', DATE_ADD(NOW(), INTERVAL 7 DAY)),
  (9025, 9239, 9207, 'pending', DATE_ADD(NOW(), INTERVAL 1 DAY)),
  (9022, 9239, 9233, 'expired', DATE_SUB(NOW(), INTERVAL 1 DAY));

-- คำร้องขอสถานะ Official: อนุมัติแล้ว 1 · รอแอดมินตัดสิน 1
INSERT INTO team_admin_requests (team_id, request_type, requested_by, team_admin_request_status,
                                 supporting_docs, reviewed_by, reviewed_at) VALUES
  (9020, 'official_status', 9201, 'approved', JSON_ARRAY('official/9020-approval.jpg'), 9001, NOW()),
  (9021, 'official_status', 9213, 'pending', JSON_ARRAY('official/9021-club-letter.jpg'), NULL, NULL);
