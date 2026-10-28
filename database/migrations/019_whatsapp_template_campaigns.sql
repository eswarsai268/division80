CREATE TABLE whatsapp_campaign_jobs (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  created_by CHAR(36) NOT NULL,
  template_name VARCHAR(512) NOT NULL,
  template_language VARCHAR(32) NOT NULL,
  template_parameters JSON NOT NULL,
  status ENUM('PENDING','PROCESSING','COMPLETED','COMPLETED_WITH_ERRORS','FAILED') NOT NULL DEFAULT 'PENDING',
  recipient_count INT UNSIGNED NOT NULL DEFAULT 0,
  invalid_phone_count INT UNSIGNED NOT NULL DEFAULT 0,
  accepted_count INT UNSIGNED NOT NULL DEFAULT 0,
  failed_count INT UNSIGNED NOT NULL DEFAULT 0,
  skipped_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  finished_at DATETIME(3) NULL,
  KEY idx_wa_campaign_org (organization_id, created_at),
  KEY idx_wa_campaign_status (status, created_at)
);

CREATE TABLE whatsapp_campaign_recipients (
  id CHAR(36) PRIMARY KEY,
  job_id CHAR(36) NOT NULL,
  phone_contact_id CHAR(36) NULL,
  recipient_phone VARCHAR(16) NULL,
  status ENUM('PENDING','PROCESSING','ACCEPTED','FAILED','SKIPPED') NOT NULL DEFAULT 'PENDING',
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  locked_by CHAR(36) NULL,
  locked_at DATETIME(3) NULL,
  provider_message_id VARCHAR(255) NULL,
  error_code VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_wa_recipient_queue (status, next_attempt_at, created_at),
  KEY idx_wa_recipient_job (job_id, status),
  KEY idx_wa_recipient_contact (phone_contact_id, status)
);

-- Recipient snapshots are nullable so source-import deletion can scrub them immediately.
