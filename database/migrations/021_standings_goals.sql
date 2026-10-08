-- B3 (มติ 21 ก.ย. 2569) — ตารางคะแนนเก็บประตูได้/เสีย เพื่อ tie-break แบบ ก: แต้ม → ผลต่างประตู → ประตูได้ → ชนะ → ชื่อทีม
--   ระบบไม่มีผลเสมอ (OD-20) แต้มจึง = ชนะ × WIN_POINTS เสมอ — ทีมที่ชนะเท่ากันต้องแยกด้วยประตู
ALTER TABLE tournament_standings
  ADD COLUMN goals_for INT NOT NULL DEFAULT 0 AFTER points,
  ADD COLUMN goals_against INT NOT NULL DEFAULT 0 AFTER goals_for;

-- backfill จากผลที่นับเข้าตารางแล้ว (verified / walkover) · score_data = {"<teamId>": n, ...}
UPDATE tournament_standings ts
JOIN (
  SELECT tournament_id, team_id, SUM(gf) AS gf, SUM(ga) AS ga FROM (
  SELECT m.tournament_id, m.team_a_id AS team_id,
         SUM(COALESCE(JSON_EXTRACT(r.score_data, CONCAT('$."', m.team_a_id, '"')), 0)) AS gf,
         SUM(COALESCE(JSON_EXTRACT(r.score_data, CONCAT('$."', m.team_b_id, '"')), 0)) AS ga
  FROM match_results r JOIN matches m ON m.match_id = r.match_id
  WHERE r.match_result_status IN ('verified', 'walkover') AND m.team_a_id IS NOT NULL AND m.team_b_id IS NOT NULL
  GROUP BY m.tournament_id, m.team_a_id
  UNION ALL
  SELECT m.tournament_id, m.team_b_id,
         SUM(COALESCE(JSON_EXTRACT(r.score_data, CONCAT('$."', m.team_b_id, '"')), 0)) AS gf,
         SUM(COALESCE(JSON_EXTRACT(r.score_data, CONCAT('$."', m.team_a_id, '"')), 0)) AS ga
  FROM match_results r JOIN matches m ON m.match_id = r.match_id
  WHERE r.match_result_status IN ('verified', 'walkover') AND m.team_a_id IS NOT NULL AND m.team_b_id IS NOT NULL
  GROUP BY m.tournament_id, m.team_b_id
  ) x GROUP BY tournament_id, team_id
) g ON g.tournament_id = ts.tournament_id AND g.team_id = ts.team_id
SET ts.goals_for = ts.goals_for + g.gf, ts.goals_against = ts.goals_against + g.ga;
