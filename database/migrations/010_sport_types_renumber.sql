-- มติทีม 17 ก.ย. 2569: เหลือ 5 กีฬา และเรียง id ใหม่ 1–5
--   ฟุตบอล 1→1 · บาสเกตบอล 3→2 · แบดมินตัน 6→3 · RoV 8→4 · VALORANT 9→5
--   ฟุตซอล(2) วอลเลย์บอล(4) ตะกร้อ(5) เทเบิลเทนนิส(7) ถูกลบ — ทีม/ทัวร์ที่ผูกกีฬาเหล่านี้ย้ายไปฟุตบอล(1) ชั่วคราว ไม่ให้ FK ล้ม
-- sport_stat_definitions เรียงใหม่เป็น 1–15 ตาม seed.sql · player_match_stat_values ตามไปด้วย
-- เครื่องที่ยังไม่เคย seed: ไฟล์นี้ไม่มีผล (ไม่มีแถว) — รัน seed.sql ต่อได้เลย

SET FOREIGN_KEY_CHECKS = 0;

-- 1) ย้ายผู้อ้างอิงกีฬาที่ถูกตัดไปฟุตบอล
UPDATE teams                    SET sport_type_id = 1 WHERE sport_type_id IN (2, 4, 5, 7);
UPDATE tournaments              SET sport_type_id = 1 WHERE sport_type_id IN (2, 4, 5, 7);
UPDATE official_team_memberships SET sport_type_id = 1 WHERE sport_type_id IN (2, 4, 5, 7);
DELETE FROM player_profile_stats WHERE sport_type_id IN (2, 4, 5, 7)
   AND EXISTS (SELECT 1 FROM (SELECT user_id FROM player_profile_stats WHERE sport_type_id = 1) x WHERE x.user_id = player_profile_stats.user_id);
UPDATE player_profile_stats     SET sport_type_id = 1 WHERE sport_type_id IN (2, 4, 5, 7);
DELETE FROM player_match_stat_values WHERE sport_stat_definition_id IN (SELECT sport_stat_definition_id FROM sport_stat_definitions WHERE sport_type_id IN (2, 4, 5, 7));
DELETE FROM sport_stat_definitions WHERE sport_type_id IN (2, 4, 5, 7);
DELETE FROM sport_types WHERE sport_type_id IN (2, 4, 5, 7);

-- 2) remap id กีฬา (ทำผ่านค่าชั่วคราว +100 กันชนกันเอง)
UPDATE sport_types               SET sport_type_id = sport_type_id + 100 WHERE sport_type_id IN (3, 6, 8, 9);
UPDATE sport_types               SET sport_type_id = CASE sport_type_id WHEN 103 THEN 2 WHEN 106 THEN 3 WHEN 108 THEN 4 WHEN 109 THEN 5 END WHERE sport_type_id > 100;
UPDATE teams                     SET sport_type_id = CASE sport_type_id WHEN 3 THEN 2 WHEN 6 THEN 3 WHEN 8 THEN 4 WHEN 9 THEN 5 ELSE sport_type_id END;
UPDATE tournaments               SET sport_type_id = CASE sport_type_id WHEN 3 THEN 2 WHEN 6 THEN 3 WHEN 8 THEN 4 WHEN 9 THEN 5 ELSE sport_type_id END;
UPDATE official_team_memberships SET sport_type_id = CASE sport_type_id WHEN 3 THEN 2 WHEN 6 THEN 3 WHEN 8 THEN 4 WHEN 9 THEN 5 ELSE sport_type_id END;
UPDATE player_profile_stats      SET sport_type_id = CASE sport_type_id WHEN 3 THEN 2 WHEN 6 THEN 3 WHEN 8 THEN 4 WHEN 9 THEN 5 ELSE sport_type_id END;
UPDATE sport_stat_definitions    SET sport_type_id = CASE sport_type_id WHEN 3 THEN 2 WHEN 6 THEN 3 WHEN 8 THEN 4 WHEN 9 THEN 5 ELSE sport_type_id END;

-- 3) remap id stat definitions: บาส 8-11→5-8 · แบด 16→9 · RoV 18-20→10-12 · VALORANT 21-23→13-15
UPDATE sport_stat_definitions    SET sport_stat_definition_id = sport_stat_definition_id + 100 WHERE sport_stat_definition_id >= 8;
UPDATE player_match_stat_values  SET sport_stat_definition_id = sport_stat_definition_id + 100 WHERE sport_stat_definition_id >= 8;
UPDATE sport_stat_definitions    SET sport_stat_definition_id = CASE sport_stat_definition_id
  WHEN 108 THEN 5 WHEN 109 THEN 6 WHEN 110 THEN 7 WHEN 111 THEN 8 WHEN 116 THEN 9
  WHEN 118 THEN 10 WHEN 119 THEN 11 WHEN 120 THEN 12 WHEN 121 THEN 13 WHEN 122 THEN 14 WHEN 123 THEN 15 END
  WHERE sport_stat_definition_id > 100;
UPDATE player_match_stat_values  SET sport_stat_definition_id = CASE sport_stat_definition_id
  WHEN 108 THEN 5 WHEN 109 THEN 6 WHEN 110 THEN 7 WHEN 111 THEN 8 WHEN 116 THEN 9
  WHEN 118 THEN 10 WHEN 119 THEN 11 WHEN 120 THEN 12 WHEN 121 THEN 13 WHEN 122 THEN 14 WHEN 123 THEN 15 END
  WHERE sport_stat_definition_id > 100;

SET FOREIGN_KEY_CHECKS = 1;
