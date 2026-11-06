-- OD-64 — รายการเหรียญชุดแรก (Badge/Achievement)
--
-- RW01-RW04 กับตาราง rewards/user_rewards สร้างเสร็จตั้งแต่ 1 ต.ค. แต่ `rewards` ว่างเปล่า
-- และไม่มีโค้ดไหนเรียก grantReward เลย ⇒ GET /rewards คืนลิสต์ว่างตลอดไป
-- migration นี้เติม "ข้อมูล" ส่วนที่ขาด · ตัวแจกเหรียญอยู่ในโค้ด (reward.repo evaluate*Tx)
--
-- เกณฑ์เก็บใน `criteria` ซึ่งเป็นคอลัมน์ที่มีอยู่แล้วแต่ไม่เคยมีใครอ่าน — รูปที่รองรับมี 2 แบบ
--   {"stat": "<matches_played|wins|losses|championships>", "gte": n}   อ่านจาก player_profile_stats
--   {"pickem": "spot_on", "gte": n}                                    นับแมตช์ที่ทายได้ชั้นสูงสุด
-- รายละเอียดและเหตุผลอยู่ใน backend/src/config/rewardCriteria.ts และ OD-64
--
-- `points_required` ปล่อย NULL ทุกแถว — ทีมยังไม่ตัดสินว่าจะมี "แลกของด้วยแต้ม" ไหม (OD-64)
--
-- ★ migration ตัวแรกของโปรเจกต์ที่ INSERT "ข้อมูล" ภาษาไทย (ของเดิมมีไทยแค่ในคอมเมนต์)
--   `npm run migrate` ตั้ง charset utf8mb4 ให้อยู่แล้ว แต่คนที่โหลดด้วย
--   `docker exec -i ltms-mysql mysql ... < ไฟล์นี้` จะได้ภาษาไทยเพี้ยนถ้าไม่ใส่ flag
--   จึงประกาศ SET NAMES ไว้ในไฟล์เองแบบเดียวกับ qa-baseline.sql ให้ถูกทั้งสองทาง
--
-- ★ ตาราง rewards ไม่มี UNIQUE บน name จึงกันซ้ำด้วย WHERE NOT EXISTS
--   ฐานที่เคยรันแล้วรันซ้ำจะไม่ได้แถวเพิ่ม (ไม่งั้นเหรียญโผล่ซ้ำในหน้าโปรไฟล์)

SET NAMES utf8mb4;

INSERT INTO rewards (reward_type, name, description, points_required, criteria, is_active)
SELECT * FROM (SELECT
    'badge', 'ลงแข่งครั้งแรก', 'ลงแข่งขันแมตช์แรกสำเร็จ', NULL,
    CAST('{"stat":"matches_played","gte":1}' AS JSON), TRUE
) AS t (reward_type, name, description, points_required, criteria, is_active)
WHERE NOT EXISTS (SELECT 1 FROM rewards r WHERE r.name = t.name);

INSERT INTO rewards (reward_type, name, description, points_required, criteria, is_active)
SELECT * FROM (SELECT
    'badge', 'ชนะครั้งแรก', 'ชนะแมตช์แรกในชีวิต', NULL,
    CAST('{"stat":"wins","gte":1}' AS JSON), TRUE
) AS t (reward_type, name, description, points_required, criteria, is_active)
WHERE NOT EXISTS (SELECT 1 FROM rewards r WHERE r.name = t.name);

INSERT INTO rewards (reward_type, name, description, points_required, criteria, is_active)
SELECT * FROM (SELECT
    'achievement', 'ชนะ 10 แมตช์', 'ชนะรวม 10 แมตช์ในกีฬาเดียวกัน', NULL,
    CAST('{"stat":"wins","gte":10}' AS JSON), TRUE
) AS t (reward_type, name, description, points_required, criteria, is_active)
WHERE NOT EXISTS (SELECT 1 FROM rewards r WHERE r.name = t.name);

INSERT INTO rewards (reward_type, name, description, points_required, criteria, is_active)
SELECT * FROM (SELECT
    'achievement', 'แชมป์ครั้งแรก', 'คว้าแชมป์ทัวร์นาเมนต์ครั้งแรก', NULL,
    CAST('{"stat":"championships","gte":1}' AS JSON), TRUE
) AS t (reward_type, name, description, points_required, criteria, is_active)
WHERE NOT EXISTS (SELECT 1 FROM rewards r WHERE r.name = t.name);

INSERT INTO rewards (reward_type, name, description, points_required, criteria, is_active)
SELECT * FROM (SELECT
    'achievement', 'แชมป์ 3 สมัย', 'คว้าแชมป์ทัวร์นาเมนต์รวม 3 ครั้งในกีฬาเดียวกัน', NULL,
    CAST('{"stat":"championships","gte":3}' AS JSON), TRUE
) AS t (reward_type, name, description, points_required, criteria, is_active)
WHERE NOT EXISTS (SELECT 1 FROM rewards r WHERE r.name = t.name);

-- ชั้น spot_on คือชั้นสูงสุดของ OD-56 (ทายฝั่งถูก + สกอร์คลาดไม่เกิน tolerance ของกีฬานั้น)
-- ความยากจึงต่างกันตามกีฬาโดยเจตนา — แบด/RoV ตั้ง tolerance 0 ต้องเป๊ะ · บาสคลาดได้ 5 ต่อฝั่ง
INSERT INTO rewards (reward_type, name, description, points_required, criteria, is_active)
SELECT * FROM (SELECT
    'achievement', 'นักทายแม่น', 'ทายสกอร์ได้ชั้นสูงสุดครบ 5 แมตช์', NULL,
    CAST('{"pickem":"spot_on","gte":5}' AS JSON), TRUE
) AS t (reward_type, name, description, points_required, criteria, is_active)
WHERE NOT EXISTS (SELECT 1 FROM rewards r WHERE r.name = t.name);
