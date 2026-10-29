-- Prices provide short, medium, and long saving goals without changing Pick'em awards.
-- Purchased badges have no criteria, so automatic achievement evaluation cannot grant or revoke them.
SET NAMES utf8mb4;

INSERT INTO rewards (reward_type, name, description, points_required, criteria, is_active)
SELECT * FROM (SELECT 'badge', 'ผู้สนับสนุนบรอนซ์', 'เหรียญผู้สนับสนุนระดับบรอนซ์', 30, NULL, TRUE)
    AS t (reward_type, name, description, points_required, criteria, is_active)
WHERE NOT EXISTS (SELECT 1 FROM rewards r WHERE r.name = t.name);

INSERT INTO rewards (reward_type, name, description, points_required, criteria, is_active)
SELECT * FROM (SELECT 'badge', 'ผู้สนับสนุนซิลเวอร์', 'เหรียญผู้สนับสนุนระดับซิลเวอร์', 100, NULL, TRUE)
    AS t (reward_type, name, description, points_required, criteria, is_active)
WHERE NOT EXISTS (SELECT 1 FROM rewards r WHERE r.name = t.name);

INSERT INTO rewards (reward_type, name, description, points_required, criteria, is_active)
SELECT * FROM (SELECT 'badge', 'ผู้สนับสนุนโกลด์', 'เหรียญผู้สนับสนุนระดับโกลด์', 300, NULL, TRUE)
    AS t (reward_type, name, description, points_required, criteria, is_active)
WHERE NOT EXISTS (SELECT 1 FROM rewards r WHERE r.name = t.name);
