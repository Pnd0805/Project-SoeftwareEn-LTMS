-- Badge rewards are purchased with points (OD-71); criteria-based rewards are achievements.
-- Correct the earned rewards seeded by 041 without changing IDs or existing ownership.
-- Safe to rerun and independent of reward IDs across databases.
UPDATE rewards
SET reward_type = 'achievement'
WHERE reward_type = 'badge'
  AND points_required IS NULL
  AND criteria IS NOT NULL;
