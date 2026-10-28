# Security design and threat model

This document describes implemented controls and known gaps. It does not establish that the application is free of vulnerabilities.

| Threat | Current control |
|---|---|
| Cross-organization roster access | Household and citizen queries are scoped to the authenticated user’s organization; active booths and archived records are filtered. |
| Excess booth write access | Visit updates and verification writes require a current active assignment to the target booth. |
| Privilege escalation | The server loads role and assignments from the database for each authenticated request. Only admins and booth members can authenticate; admin APIs create booth-member accounts only. |
| Stolen or replayed refresh token | Refresh rotation and reuse detection revoke the session. |
| CSRF | HttpOnly, SameSite=Strict cookies, `X-Requested-With` header and Origin checks. |
| Credential stuffing | Argon2id password hashes, generic errors and timing equalization. Login rate limits are disabled; repeated password guesses are not throttled by this application. |
| Evidence tampering and duplicate writes | Verification history is append-only, passed steps are unique, steps are ordered, and idempotency keys are supported. |
| Data leakage | Voter IDs are masked outside assigned booths and in exports; API query strings are omitted from request logs. |
| Injection | Parameterized SQL, escaped search patterns and Zod validation at API boundaries. |

## Data and scope

Booth members can view active household rosters and people across their organization. Voter IDs are masked outside assigned booths. Visit updates, verification writes, and verification history remain limited to booths where the member has an active assignment. Organization boundaries remain in effect.

Imported citizens are roster records, not login accounts. Citizen account, complaint, cross-booth approval and audit-log features are removed by migration 009, which also deletes their stored records and complaint attachment files referenced by the database.

## Known gaps

- No password reset or OTP flow.
- No SMS, email or push provider is configured.
- No metrics endpoint, error tracking, or load and end-to-end test suite.
- Database-backed authorization tests require a dedicated synthetic database and are skipped otherwise.
- Import and export content is held in the database; larger workloads may need private object storage.
- The 100-concurrent-user target has not been load tested.
