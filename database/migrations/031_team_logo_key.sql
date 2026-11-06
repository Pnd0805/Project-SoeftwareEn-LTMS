-- FE-avatar-and-team-logo-uploads — โลโก้ทีม
ALTER TABLE teams
  ADD COLUMN logo_key VARCHAR(512) NULL AFTER name;
