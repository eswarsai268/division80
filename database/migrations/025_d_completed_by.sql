-- Track who completed the D flag for each citizen.
ALTER TABLE citizens
  ADD COLUMN d_completed_by CHAR(36) NULL,
  ADD COLUMN d_completed_at DATETIME NULL;