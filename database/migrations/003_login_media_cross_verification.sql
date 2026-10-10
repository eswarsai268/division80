CREATE TABLE organization_settings (
  organization_id CHAR(36) PRIMARY KEY,
  login_video_url VARCHAR(1000) NULL,
  updated_by CHAR(36) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

ALTER TABLE cross_booth_requests
  MODIFY action ENUM('READ','VERIFY') NOT NULL DEFAULT 'READ';

ALTER TABLE verifications
  ADD COLUMN cross_booth_request_id CHAR(36) NULL,
  ADD KEY idx_ver_cross_request (cross_booth_request_id);
