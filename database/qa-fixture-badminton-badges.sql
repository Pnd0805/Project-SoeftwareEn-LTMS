-- BEGIN QA BADMINTON DRAW AND BADGE FIXTURE (2026-10-30)
-- Canonical copy: database/qa-fixture-badminton-badges.sql.
-- Test data only. Password for all NEW fixture accounts: abcd1234.
-- Supports schema-034 restore BEFORE migrations and current migrated databases.
-- Natural keys reuse the original local tournament #13; restored IDs may differ.
-- Reapplying preserves existing brackets, applications, passwords and spent points.
SET NAMES utf8mb4;
SET time_zone = '+00:00';
START TRANSACTION;

-- A pre-cutover created_at lets migration 055 verify these seeded QA accounts
-- when restoring the schema-034 snapshot (email_verified does not exist yet).
INSERT INTO users (full_name,email,password_hash,gender,birth_date,user_type,faculty_id,department_id,year,created_at)
VALUES
  ('ปกรณ์ จัดการดี','org1@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-03-12','student',1,1,4,'2026-10-01 00:00:00'),
  ('วีระชัย นกหวีดทอง','ref1@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','1990-04-13','student',7,25,NULL,'2026-10-01 00:00:00'),
  ('อรทัย กฎกติกา','ref2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','1992-05-14','student',7,25,NULL,'2026-10-01 00:00:00'),
  ('ธนวัฒน์ เกษมสุข','b1.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-03-12','student',1,2,2,'2026-10-01 00:00:00'),
  ('ภูมิพัฒน์ พงษ์ไพบูลย์','b1.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-04-13','student',1,1,3,'2026-10-01 00:00:00'),
  ('กฤษณะ มณีรัตน์','b2.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2006-05-14','student',2,7,4,'2026-10-01 00:00:00'),
  ('ณัฐวุฒิ ธารารักษ์','b2.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2003-06-15','student',2,6,1,'2026-10-01 00:00:00'),
  ('พีรพล วงศ์สวัสดิ์','b3.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2004-07-16','student',3,12,2,'2026-10-01 00:00:00'),
  ('ชยพล อินทรีย์','b3.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','male','2005-08-17','student',3,11,3,'2026-10-01 00:00:00'),
  ('ณัฐธิดา สุวรรณภูมิ','b4.lead@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2006-09-18','student',4,15,4,'2026-10-01 00:00:00'),
  ('พิมพ์ลภัส รุ่งเรือง','b4.p2@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','female','2003-01-10','student',4,14,1,'2026-10-01 00:00:00'),
  ('Badge QA Tester','badge.tester@ku.th','$2b$10$eUyNQe7sveuCPEvnbiG0cOEUK3IXaBcfOZn84oV1y2shc2lj0Ys/e','other','2003-01-01','student',1,1,4,'2026-10-01 00:00:00')
ON DUPLICATE KEY UPDATE email = users.email;

SET @qa_org = (SELECT user_id FROM users WHERE email = 'org1@ku.th');
SET @qa_badge = (SELECT user_id FROM users WHERE email = 'badge.tester@ku.th');
SET @qa_admin = (SELECT user_id FROM admin_scopes WHERE scope_type = 'university_wide' ORDER BY user_id LIMIT 1);
SET @qa_sport = (SELECT sport_type_id FROM sport_types WHERE name = 'แบดมินตัน' LIMIT 1);

SET @qa_lead1 = (SELECT user_id FROM users WHERE email = 'b1.lead@ku.th');
SET @qa_player1 = (SELECT user_id FROM users WHERE email = 'b1.p2@ku.th');
INSERT INTO teams (name,sport_type_id,leader_id,readiness_status,visibility)
SELECT 'วิศวะ Smashers',@qa_sport,@qa_lead1,'Ready','public'
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE leader_id = @qa_lead1 AND sport_type_id = @qa_sport AND name = 'วิศวะ Smashers');
SET @qa_team1 = (SELECT team_id FROM teams WHERE leader_id = @qa_lead1 AND sport_type_id = @qa_sport AND name = 'วิศวะ Smashers' ORDER BY team_id LIMIT 1);
INSERT INTO team_members (team_id,user_id)
SELECT @qa_team1,@qa_lead1 WHERE NOT EXISTS (SELECT 1 FROM team_members WHERE team_id=@qa_team1 AND user_id=@qa_lead1);
INSERT INTO team_members (team_id,user_id)
SELECT @qa_team1,@qa_player1 WHERE NOT EXISTS (SELECT 1 FROM team_members WHERE team_id=@qa_team1 AND user_id=@qa_player1);

SET @qa_lead2 = (SELECT user_id FROM users WHERE email = 'b2.lead@ku.th');
SET @qa_player2 = (SELECT user_id FROM users WHERE email = 'b2.p2@ku.th');
INSERT INTO teams (name,sport_type_id,leader_id,readiness_status,visibility)
SELECT 'Sci Shuttle',@qa_sport,@qa_lead2,'Ready','public'
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE leader_id = @qa_lead2 AND sport_type_id = @qa_sport AND name = 'Sci Shuttle');
SET @qa_team2 = (SELECT team_id FROM teams WHERE leader_id = @qa_lead2 AND sport_type_id = @qa_sport AND name = 'Sci Shuttle' ORDER BY team_id LIMIT 1);
INSERT INTO team_members (team_id,user_id)
SELECT @qa_team2,@qa_lead2 WHERE NOT EXISTS (SELECT 1 FROM team_members WHERE team_id=@qa_team2 AND user_id=@qa_lead2);
INSERT INTO team_members (team_id,user_id)
SELECT @qa_team2,@qa_player2 WHERE NOT EXISTS (SELECT 1 FROM team_members WHERE team_id=@qa_team2 AND user_id=@qa_player2);

SET @qa_lead3 = (SELECT user_id FROM users WHERE email = 'b3.lead@ku.th');
SET @qa_player3 = (SELECT user_id FROM users WHERE email = 'b3.p2@ku.th');
INSERT INTO teams (name,sport_type_id,leader_id,readiness_status,visibility)
SELECT 'เกษตรตบสนั่น',@qa_sport,@qa_lead3,'Ready','public'
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE leader_id = @qa_lead3 AND sport_type_id = @qa_sport AND name = 'เกษตรตบสนั่น');
SET @qa_team3 = (SELECT team_id FROM teams WHERE leader_id = @qa_lead3 AND sport_type_id = @qa_sport AND name = 'เกษตรตบสนั่น' ORDER BY team_id LIMIT 1);
INSERT INTO team_members (team_id,user_id)
SELECT @qa_team3,@qa_lead3 WHERE NOT EXISTS (SELECT 1 FROM team_members WHERE team_id=@qa_team3 AND user_id=@qa_lead3);
INSERT INTO team_members (team_id,user_id)
SELECT @qa_team3,@qa_player3 WHERE NOT EXISTS (SELECT 1 FROM team_members WHERE team_id=@qa_team3 AND user_id=@qa_player3);

SET @qa_lead4 = (SELECT user_id FROM users WHERE email = 'b4.lead@ku.th');
SET @qa_player4 = (SELECT user_id FROM users WHERE email = 'b4.p2@ku.th');
INSERT INTO teams (name,sport_type_id,leader_id,readiness_status,visibility)
SELECT 'BBA Birdies',@qa_sport,@qa_lead4,'Ready','public'
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE leader_id = @qa_lead4 AND sport_type_id = @qa_sport AND name = 'BBA Birdies');
SET @qa_team4 = (SELECT team_id FROM teams WHERE leader_id = @qa_lead4 AND sport_type_id = @qa_sport AND name = 'BBA Birdies' ORDER BY team_id LIMIT 1);
INSERT INTO team_members (team_id,user_id)
SELECT @qa_team4,@qa_lead4 WHERE NOT EXISTS (SELECT 1 FROM team_members WHERE team_id=@qa_team4 AND user_id=@qa_lead4);
INSERT INTO team_members (team_id,user_id)
SELECT @qa_team4,@qa_player4 WHERE NOT EXISTS (SELECT 1 FROM team_members WHERE team_id=@qa_team4 AND user_id=@qa_player4);

INSERT INTO tournaments (name,entry_notes,sport_type_id,bracket_format,scope_type,organizing_faculty_id,requested_by_user_id,tournament_status,registration_open,registration_start,registration_end,event_start_date,event_end_date,max_teams,min_teams,venue,gender_requirement,approved_by,approved_at)
SELECT 'Badminton Double Elim - Random Bracket Test (4 Teams)',
       'QA fixture: 4 approved badminton teams, Double Elimination, registration closed, bracket not generated. Ready for organizer random seeding.',
       @qa_sport,'double_elimination','faculty',1,@qa_org,'public',0,
       UTC_TIMESTAMP() - INTERVAL 1 DAY,UTC_TIMESTAMP() + INTERVAL 7 DAY,
       DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR) + INTERVAL 14 DAY,
       DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR) + INTERVAL 15 DAY,4,4,
       'KU Badminton Court - Bracket Randomization Test','any',@qa_admin,UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM tournaments WHERE name='Badminton Double Elim - Random Bracket Test (4 Teams)' AND requested_by_user_id=@qa_org);
SET @qa_tour = (SELECT tournament_id FROM tournaments WHERE name='Badminton Double Elim - Random Bracket Test (4 Teams)' AND requested_by_user_id=@qa_org ORDER BY tournament_id LIMIT 1);

-- Referees are independent of the organizer and all four teams (audit C1-C7).
INSERT INTO tournament_referees (tournament_id,user_id,invited_by,invitation_status,is_external,external_approval_status)
SELECT @qa_tour,u.user_id,@qa_org,'accepted',0,'not_required' FROM users u
WHERE u.email IN ('ref1@ku.th','ref2@ku.th')
  AND NOT EXISTS (SELECT 1 FROM tournament_referees r WHERE r.tournament_id=@qa_tour AND r.user_id=u.user_id);

INSERT INTO tournament_applications (tournament_id,team_id,hard_filter_passed,tournament_application_status,reviewed_by,reviewed_at)
SELECT @qa_tour,@qa_team1,1,'approved',@qa_org,UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM tournament_applications WHERE tournament_id=@qa_tour AND team_id=@qa_team1);
SET @qa_app1 = (SELECT tournament_application_id FROM tournament_applications WHERE tournament_id=@qa_tour AND team_id=@qa_team1 ORDER BY tournament_application_id LIMIT 1);
INSERT INTO application_players (tournament_application_id,tournament_id,user_id)
SELECT @qa_app1,@qa_tour,u.user_id FROM users u WHERE u.user_id IN (@qa_lead1,@qa_player1)
AND NOT EXISTS (SELECT 1 FROM application_players p WHERE p.tournament_id=@qa_tour AND p.user_id=u.user_id);

INSERT INTO tournament_applications (tournament_id,team_id,hard_filter_passed,tournament_application_status,reviewed_by,reviewed_at)
SELECT @qa_tour,@qa_team2,1,'approved',@qa_org,UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM tournament_applications WHERE tournament_id=@qa_tour AND team_id=@qa_team2);
SET @qa_app2 = (SELECT tournament_application_id FROM tournament_applications WHERE tournament_id=@qa_tour AND team_id=@qa_team2 ORDER BY tournament_application_id LIMIT 1);
INSERT INTO application_players (tournament_application_id,tournament_id,user_id)
SELECT @qa_app2,@qa_tour,u.user_id FROM users u WHERE u.user_id IN (@qa_lead2,@qa_player2)
AND NOT EXISTS (SELECT 1 FROM application_players p WHERE p.tournament_id=@qa_tour AND p.user_id=u.user_id);

INSERT INTO tournament_applications (tournament_id,team_id,hard_filter_passed,tournament_application_status,reviewed_by,reviewed_at)
SELECT @qa_tour,@qa_team3,1,'approved',@qa_org,UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM tournament_applications WHERE tournament_id=@qa_tour AND team_id=@qa_team3);
SET @qa_app3 = (SELECT tournament_application_id FROM tournament_applications WHERE tournament_id=@qa_tour AND team_id=@qa_team3 ORDER BY tournament_application_id LIMIT 1);
INSERT INTO application_players (tournament_application_id,tournament_id,user_id)
SELECT @qa_app3,@qa_tour,u.user_id FROM users u WHERE u.user_id IN (@qa_lead3,@qa_player3)
AND NOT EXISTS (SELECT 1 FROM application_players p WHERE p.tournament_id=@qa_tour AND p.user_id=u.user_id);

INSERT INTO tournament_applications (tournament_id,team_id,hard_filter_passed,tournament_application_status,reviewed_by,reviewed_at)
SELECT @qa_tour,@qa_team4,1,'approved',@qa_org,UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM tournament_applications WHERE tournament_id=@qa_tour AND team_id=@qa_team4);
SET @qa_app4 = (SELECT tournament_application_id FROM tournament_applications WHERE tournament_id=@qa_tour AND team_id=@qa_team4 ORDER BY tournament_application_id LIMIT 1);
INSERT INTO application_players (tournament_application_id,tournament_id,user_id)
SELECT @qa_app4,@qa_tour,u.user_id FROM users u WHERE u.user_id IN (@qa_lead4,@qa_player4)
AND NOT EXISTS (SELECT 1 FROM application_players p WHERE p.tournament_id=@qa_tour AND p.user_id=u.user_id);

-- One explicit QA credit, NOT fabricated Pick'em winnings. A dedicated account
-- starts with zero points; wallet = SUM(ledger), including future redemptions.
-- Lock the wallet and credit only once. Never refill spent points on reapply.
SELECT total_points INTO @qa_wallet_before FROM users WHERE user_id=@qa_badge FOR UPDATE;
SET @qa_credit = IF(EXISTS(SELECT 1 FROM point_transactions WHERE user_id=@qa_badge AND source='admin_adjustment' AND ref_id IS NULL),0,5000);
INSERT INTO point_transactions (user_id,amount,source,ref_id)
SELECT @qa_badge,@qa_credit,'admin_adjustment',NULL WHERE @qa_credit > 0;
UPDATE users SET total_points=total_points+@qa_credit WHERE user_id=@qa_badge;

-- Schema-034 lacks both columns. On current schema, configure only fixture users
-- and tournament. PREPARE defers column resolution until after the schema check.
SET @qa_sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name='email_verified'),
  'UPDATE users SET email_verified=1 WHERE email IN (''org1@ku.th'',''ref1@ku.th'',''ref2@ku.th'',''b1.lead@ku.th'',''b1.p2@ku.th'',''b2.lead@ku.th'',''b2.p2@ku.th'',''b3.lead@ku.th'',''b3.p2@ku.th'',''b4.lead@ku.th'',''b4.p2@ku.th'',''badge.tester@ku.th'')','DO 0');
PREPARE qa_fixture_stmt FROM @qa_sql; EXECUTE qa_fixture_stmt; DEALLOCATE PREPARE qa_fixture_stmt;
COMMIT;
-- Deliberately NO INSERT into matches, bracket_nodes or user_rewards.
-- END QA BADMINTON DRAW AND BADGE FIXTURE
