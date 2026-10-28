-- Phone numbers are owned by their source import and are independent of voter IDs.
CREATE TABLE import_phone_contacts (
  id CHAR(36) PRIMARY KEY,
  import_job_id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_import_phone_contact (import_job_id, phone),
  KEY idx_import_phone_org (organization_id, import_job_id),
  KEY idx_import_phone_job_id (import_job_id, id)
);
