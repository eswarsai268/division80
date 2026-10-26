ALTER TABLE import_jobs
  ADD COLUMN skipped_rows INT NOT NULL DEFAULT 0;
