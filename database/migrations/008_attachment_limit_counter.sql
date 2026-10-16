ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS attachment_count INT UNSIGNED NOT NULL DEFAULT 0;

UPDATE complaints c
SET attachment_count = (
  SELECT COUNT(*)
  FROM attachments a
  WHERE a.complaint_id = c.id
);
