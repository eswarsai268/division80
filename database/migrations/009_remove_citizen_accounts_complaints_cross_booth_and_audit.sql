-- Remove citizen login accounts and all data for retired complaint, cross-booth,
-- and audit-log features. Imported citizens and verification records remain.
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role = 'USER');
DELETE FROM booth_assignments WHERE user_id IN (SELECT id FROM users WHERE role = 'USER');
DELETE FROM notification_outbox WHERE type = 'COMPLAINT_SUBMITTED'
  OR user_id IN (SELECT id FROM users WHERE role = 'USER');
DELETE FROM users WHERE role = 'USER';

DELETE FROM export_jobs WHERE kind = 'COMPLAINTS';
ALTER TABLE export_jobs MODIFY kind ENUM(
  'CITIZENS',
  'SHIFTED_CITIZENS',
  'DECEASED_CITIZENS',
  'PENDING_D2D',
  'HOUSEHOLDS',
  'PENDING_VERIFICATION',
  'IN_PROGRESS_VERIFICATION',
  'VERIFIED_CITIZENS'
) NOT NULL;

DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS complaint_status_history;
DROP TABLE IF EXISTS complaints;

CREATE TEMPORARY TABLE retired_cross_verified_households
  SELECT DISTINCT household_id AS id FROM verifications WHERE cross_booth_request_id IS NOT NULL;
DELETE FROM verifications WHERE cross_booth_request_id IS NOT NULL;
UPDATE households h
SET verification_status = CASE
  WHEN NOT EXISTS (SELECT 1 FROM citizens ci WHERE ci.household_id = h.id AND ci.deleted_at IS NULL) THEN 'PENDING'
  WHEN EXISTS (
    SELECT 1 FROM citizens ci
    WHERE ci.household_id = h.id AND ci.deleted_at IS NULL
      AND (SELECT COUNT(*) FROM verifications v WHERE v.citizen_id = ci.id AND v.result = 'PASSED') < 6
  ) THEN 'IN_VERIFICATION'
  ELSE 'RESOLVED'
END
WHERE h.id IN (SELECT id FROM retired_cross_verified_households);
DROP TEMPORARY TABLE retired_cross_verified_households;

DROP TABLE IF EXISTS cross_booth_requests;
DROP TABLE IF EXISTS audit_logs;

ALTER TABLE verifications
  DROP INDEX idx_ver_cross_request,
  DROP COLUMN cross_booth_request_id;

ALTER TABLE booth_assignments DROP COLUMN can_approve_cross_booth;
ALTER TABLE users MODIFY role ENUM('ADMIN','BOOTH_MEMBER') NOT NULL DEFAULT 'BOOTH_MEMBER';
