-- Slip settings per organization + audit log for batch prints.
ALTER TABLE organization_settings
  ADD COLUMN ward_number VARCHAR(16) NULL,
  ADD COLUMN polling_date_text VARCHAR(100) NULL,
  ADD COLUMN age_reference_date DATE NULL,
  ADD COLUMN publication_date DATE NULL,
  ADD COLUMN slip_title VARCHAR(200) NULL,
  ADD COLUMN slip_banner_path VARCHAR(255) NULL;

-- New table for batch print audit (audit log table was removed in migration 009).
CREATE TABLE IF NOT EXISTS slip_print_log (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  booth_id CHAR(36) NULL,
  polling_station VARCHAR(20) NULL,
  door_from VARCHAR(255) NULL,
  door_to VARCHAR(255) NULL,
  voter_count INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_slip_print_org (organization_id, created_at),
  KEY idx_slip_print_user (user_id, created_at)
);