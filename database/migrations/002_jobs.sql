CREATE TABLE import_jobs (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  created_by CHAR(36) NOT NULL,
  status ENUM('PREVIEW','QUEUED','COMMITTING','COMMITTED','FAILED','CANCELLED') NOT NULL DEFAULT 'PREVIEW',
  total_rows INT NOT NULL DEFAULT 0,
  valid_rows INT NOT NULL DEFAULT 0,
  skipped_rows INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  processed_rows INT NOT NULL DEFAULT 0,
  errors JSON NULL,
  payload MEDIUMTEXT NULL,
  result JSON NULL,
  last_error VARCHAR(255) NULL,
  locked_by VARCHAR(64) NULL,
  locked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_import_org (organization_id, created_at),
  KEY idx_import_status (status, created_at)
);

CREATE TABLE export_jobs (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  created_by CHAR(36) NOT NULL,
  kind ENUM('CITIZENS','HOUSEHOLDS','COMPLAINTS') NOT NULL,
  booth_id CHAR(36) NULL,
  status ENUM('PENDING','PROCESSING','READY','FAILED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  content MEDIUMTEXT NULL,
  row_count INT NOT NULL DEFAULT 0,
  expires_at DATETIME(3) NULL,
  last_error VARCHAR(255) NULL,
  locked_by VARCHAR(64) NULL,
  locked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_export_org (organization_id, created_at),
  KEY idx_export_status (status, created_at)
);
