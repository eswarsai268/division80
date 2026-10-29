-- Add "D" checkbox field to voter visit details.
ALTER TABLE citizens
  ADD COLUMN IF NOT EXISTS d_flag TINYINT(1) NOT NULL DEFAULT 0;