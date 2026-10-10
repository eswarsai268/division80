# Security design & threat model (summary)

No system is "100% secure". This build follows secure-by-design practices; verify with your own review/pentest before production.

| Threat | Mitigation in code |
|---|---|
| IDOR / cross-booth access | Scope derived from DB-loaded active assignments on every request (`middleware/authenticate.ts`); scoped repositories (`repositories/households.ts`); unauthorised == 404 |
| Privilege escalation | Role never read from client; register always creates USER; admin creation not exposed via API; role/suspension changes revoke sessions |
| Stolen/replayed refresh token | Rotation + reuse detection revokes the session (`services/auth.ts`) |
| CSRF | HttpOnly + SameSite=Strict cookies, `X-Requested-With` header + Origin check |
| Credential stuffing | Argon2id, per-IP+email rate limit, generic errors, timing equalisation |
| Cross-booth abuse / replay | Request is PENDING→APPROVED/REJECTED once (row lock + conditional UPDATE), requester can't self-approve, approver rights re-read from DB, grant is per-household, READ-only, time-boxed, dies when source assignment is revoked |
| Evidence tampering | `verifications` is append-only; unique constraint prevents duplicate PASSED per step; strict step order |
| Concurrency | Row locks (`FOR UPDATE`), unique generated keys, optimistic `version` on complaints, idempotency keys |
| Data leakage | Voter ID masked, no citizen data in public/Redis, logs redact secrets, query strings not logged, generic 500s |
| Injection | Parameterised queries only; LIKE input escaped; zod on every input |

## Assumptions made (please confirm)
1. The original "passkey / CID" is replaced by the **server-verified cross-booth approval workflow** (no shared passkey exists to leak).
2. Cross-booth access is **READ-only** on a single household, default 4h grant (max 24h).
3. All active members of a booth may record any verification step; approver rights are a per-assignment flag.
4. Admin = one organisation (`organization_id`). Admins can't be created or modified through the API (use `npm run seed`).
5. Booth members can read assigned complaints but not change them.

## Added in this version
Admin citizens/households, CSV import (validate -> preview -> admin confirm -> worker commit, formula-injection and duplicate checks, booth re-authorised at commit), background exports (masked voter IDs, formula-safe CSV, 24h expiry, audited download),
complaint photo upload (JPEG/PNG magic-byte check, 5 MB, server-generated names, private disk storage, 5-minute HMAC-signed URLs), events edit, profile, audit/settings pages.

## Known gaps
- No antivirus engine is wired in (hook point in `backend/src/services/files.js`). Uploads live on local disk (`UPLOAD_DIR`) — move to S3-compatible private storage for multi-instance deployments.
- No SMS/email/push provider (worker logs notifications only).
- Password reset / OTP, PWA service worker, metrics endpoint, error tracking.
- Race-condition, load and E2E test suites are not written yet; authorization tests need a database to run.
- Exports/imports hold file contents in the database (fine up to ~50k rows; use object storage beyond that).
