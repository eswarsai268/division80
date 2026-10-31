-- Freeze (lock) deceased citizens so booth members cannot modify them.
ALTER TABLE citizens
  ADD COLUMN is_frozen TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN frozen_at DATETIME NULL,
  ADD COLUMN frozen_by CHAR(36) NULL;