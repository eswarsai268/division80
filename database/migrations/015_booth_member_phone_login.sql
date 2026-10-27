-- Existing admin and booth accounts keep their email login. New booth accounts can use phone only.
-- Normalize blank optional phone values before adding uniqueness. Resolve any duplicate
-- nonblank phone values before deployment; the unique index must not permit ambiguous logins.
UPDATE users SET phone = NULL WHERE phone IS NOT NULL AND TRIM(phone) = '';
ALTER TABLE users MODIFY email VARCHAR(255) NULL;
CREATE UNIQUE INDEX uq_users_phone ON users (phone);
