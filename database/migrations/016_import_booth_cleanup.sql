-- Track booths first created by roster imports for safe cleanup on import deletion.
ALTER TABLE booths
  ADD COLUMN source_import_job_id CHAR(36) NULL;

ALTER TABLE booths
  ADD KEY idx_booth_source_import (source_import_job_id);

ALTER TABLE households
  ADD COLUMN address_source_import_job_id CHAR(36) NULL;

ALTER TABLE households
  ADD KEY idx_house_address_source_import (address_source_import_job_id);
