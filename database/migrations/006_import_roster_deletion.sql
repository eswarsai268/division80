ALTER TABLE import_jobs
  ADD COLUMN data_tracked TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN deleted_at DATETIME(3) NULL,
  ADD KEY idx_import_visible_org (organization_id, deleted_at, created_at);

ALTER TABLE households
  ADD COLUMN source_import_job_id CHAR(36) NULL,
  ADD KEY idx_house_source_import (source_import_job_id);

ALTER TABLE citizens
  ADD COLUMN source_import_job_id CHAR(36) NULL,
  ADD KEY idx_cit_source_import (source_import_job_id);
