-- Samasya Medhi schema (TiDB / MySQL compatible). Foreign keys are enforced in
-- application code + unique constraints (TiDB FK support varies by version).
CREATE TABLE organizations (
  id CHAR(36) PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  phone VARCHAR(32) NULL,
  role ENUM('ADMIN','BOOTH_MEMBER','USER') NOT NULL DEFAULT 'USER',
  status ENUM('ACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_users_org (organization_id, role)
);
CREATE TABLE sessions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  refresh_hash CHAR(64) NOT NULL,
  prev_refresh_hash CHAR(64) NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_refresh (refresh_hash),
  KEY idx_prev (prev_refresh_hash),
  KEY idx_sess_user (user_id)
);

CREATE TABLE booths (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(200) NOT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_booth_code (organization_id, code)
);

CREATE TABLE booth_assignments (
  id CHAR(36) PRIMARY KEY,
  booth_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  can_approve_cross_booth TINYINT(1) NOT NULL DEFAULT 0,
  starts_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ends_at DATETIME(3) NULL,
  revoked_at DATETIME(3) NULL,
  revoked_by CHAR(36) NULL,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  active_key VARCHAR(80) AS (IF(revoked_at IS NULL, CONCAT(booth_id, ':', user_id), NULL)) STORED,
  UNIQUE KEY uq_active_assignment (active_key),
  KEY idx_assign_user (user_id, booth_id),
  KEY idx_assign_booth (booth_id)
);

CREATE TABLE households (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  booth_id CHAR(36) NOT NULL,
  house_code VARCHAR(32) NOT NULL,
  address_line VARCHAR(255) NULL,
  verification_status ENUM('PENDING','IN_VERIFICATION','RESOLVED') NOT NULL DEFAULT 'PENDING',
  deleted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_house (booth_id, house_code),
  KEY idx_house_status (booth_id, verification_status)
);

CREATE TABLE citizens (
  id CHAR(36) PRIMARY KEY,
  household_id CHAR(36) NOT NULL,
  booth_id CHAR(36) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  relation VARCHAR(32) NOT NULL,
  voter_id VARCHAR(32) NULL,
  life_status ENUM('ALIVE','DECEASED','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  phone VARCHAR(32) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_voter (voter_id),
  KEY idx_cit_house (household_id),
  KEY idx_cit_booth (booth_id)
);

-- Append-only evidence. Steps: 1 Record, 2 Voter ID, 3 Life status, 4 T+Live circle, 5 Details, 6 Double check
CREATE TABLE verifications (
  id CHAR(36) PRIMARY KEY,
  citizen_id CHAR(36) NOT NULL,
  household_id CHAR(36) NOT NULL,
  booth_id CHAR(36) NOT NULL,
  step TINYINT NOT NULL,
  result ENUM('PASSED','FAILED') NOT NULL,
  verifier_id CHAR(36) NOT NULL,
  notes VARCHAR(500) NULL,
  idempotency_key VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  passed_key VARCHAR(60) AS (IF(result = 'PASSED', CONCAT(citizen_id, ':', step), NULL)) STORED,
  UNIQUE KEY uq_passed (passed_key),
  UNIQUE KEY uq_idem (verifier_id, idempotency_key),
  KEY idx_ver_citizen (citizen_id, step),
  KEY idx_ver_booth (booth_id)
);

CREATE TABLE cross_booth_requests (
  id CHAR(36) PRIMARY KEY,
  requester_id CHAR(36) NOT NULL,
  source_booth_id CHAR(36) NOT NULL,
  target_booth_id CHAR(36) NOT NULL,
  resource_type ENUM('HOUSEHOLD') NOT NULL,
  resource_id CHAR(36) NOT NULL,
  action ENUM('READ') NOT NULL DEFAULT 'READ',
  reason VARCHAR(500) NOT NULL,
  status ENUM('PENDING','APPROVED','REJECTED','EXPIRED','REVOKED') NOT NULL DEFAULT 'PENDING',
  expires_at DATETIME(3) NOT NULL,
  approver_id CHAR(36) NULL,
  decided_at DATETIME(3) NULL,
  grant_expires_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_cb_requester (requester_id, status),
  KEY idx_cb_target (target_booth_id, status),
  KEY idx_cb_resource (resource_id, requester_id)
);

CREATE TABLE complaints (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(64) NOT NULL,
  location VARCHAR(255) NULL,
  status ENUM('SUBMITTED','UNDER_REVIEW','ASSIGNED','IN_VERIFICATION','RESOLVED','REJECTED','REOPENED','CANCELLED') NOT NULL DEFAULT 'SUBMITTED',
  assigned_booth_id CHAR(36) NULL,
  version INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_comp_user (user_id, created_at),
  KEY idx_comp_org (organization_id, status),
  KEY idx_comp_booth (assigned_booth_id, status)
);

CREATE TABLE complaint_status_history (
  id CHAR(36) PRIMARY KEY,
  complaint_id CHAR(36) NOT NULL,
  from_status VARCHAR(32) NULL,
  to_status VARCHAR(32) NOT NULL,
  actor_id CHAR(36) NOT NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_hist (complaint_id, created_at)
);

-- Table ready for the upload pipeline (API for uploads is NOT implemented yet).
CREATE TABLE attachments (
  id CHAR(36) PRIMARY KEY,
  complaint_id CHAR(36) NOT NULL,
  object_key VARCHAR(255) NOT NULL,
  mime_type VARCHAR(64) NOT NULL,
  size_bytes INT NOT NULL,
  scan_status ENUM('PENDING','CLEAN','REJECTED') NOT NULL DEFAULT 'PENDING',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_att (complaint_id)
);

CREATE TABLE events (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  kind ENUM('EVENT','ANNOUNCEMENT') NOT NULL DEFAULT 'EVENT',
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  starts_at DATETIME(3) NULL,
  status ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  created_by CHAR(36) NOT NULL,
  published_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_ev (organization_id, status, starts_at)
);

CREATE TABLE audit_logs (
  id CHAR(36) PRIMARY KEY,
  actor_id CHAR(36) NULL,
  action VARCHAR(64) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(64) NULL,
  scope VARCHAR(100) NULL,
  outcome ENUM('SUCCESS','DENIED','FAILURE') NOT NULL,
  reason VARCHAR(255) NULL,
  request_id VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_audit_actor (actor_id, created_at),
  KEY idx_audit_action (action, created_at)
);

CREATE TABLE notification_outbox (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  type VARCHAR(64) NOT NULL,
  payload JSON NOT NULL,
  status ENUM('PENDING','PROCESSING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  locked_by VARCHAR(64) NULL,
  locked_at DATETIME(3) NULL,
  last_error VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_outbox (status, next_attempt_at)
);
