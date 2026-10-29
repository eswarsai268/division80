-- Add polling station and polling address to voter records.
ALTER TABLE citizens
  ADD COLUMN IF NOT EXISTS polling_station VARCHAR(20) NULL AFTER voter_id,
  ADD COLUMN IF NOT EXISTS polling_address VARCHAR(255) NULL AFTER polling_station;

-- Helpful index for filtering by station within a booth/organization.
ALTER TABLE citizens
  ADD INDEX IF NOT EXISTS idx_citizens_polling_station (booth_id, polling_station);