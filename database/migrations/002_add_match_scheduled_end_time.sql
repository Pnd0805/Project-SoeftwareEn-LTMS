ALTER TABLE matches
  ADD COLUMN scheduled_end_time DATETIME NULL AFTER scheduled_time;
