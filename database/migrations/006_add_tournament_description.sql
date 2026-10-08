-- Run once against an existing LTMS database. This is additive and preserves all data.
ALTER TABLE tournaments
  ADD COLUMN description VARCHAR(255) NULL AFTER name;
