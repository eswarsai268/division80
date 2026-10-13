# Samasya Meedi Parishkaram Maadi

Community issue tracking + booth/household verification platform.
Folders: `backend/` (Express API, plain JavaScript), `frontend/` (React + Vite + Tailwind), `worker/` (outbox + maintenance), `database/` (migrations), `docs/`.

## Quick start
```bash
cp .env.example .env            # fill DATABASE_*, REDIS_URL, JWT_ACCESS_SECRET, SEED_ADMIN_*
npm install
export $(grep -v '^#' .env | xargs)   # or use your own env loader
npm run migrate                 # creates DB + tables
npm run seed                    # default organisation + first admin
npm run dev:backend               # http://localhost:4000
npm run dev:frontend                 # http://localhost:5173  (proxies /api)
npm run dev:worker
```
Docker (dev): `JWT_ACCESS_SECRET=<32+ chars> docker compose up --build`, then run migrate/seed against TiDB on `127.0.0.1:4001`.
The frontend calls `/api/v1` on the same origin by default. For local development, Vite proxies `/api` to `http://localhost:4000` (override with `VITE_API_PROXY`). For a separately hosted API, set the frontend build variable `VITE_API_BASE_URL` to the full API base URL ending in `/api/v1`.

Production API, worker and migration processes require `DATABASE_SSL=true`; database TLS certificate validation is enabled and cannot be disabled in production.

## Tests
```bash
npm test -w backend                       # unit tests (no DB needed)
TEST_DB=1 npm test -w backend             # + authorization tests (needs a migrated TEST database, synthetic data only)
```
Covers: cross-booth IDOR (T1/T2), citizen dataset denial (T3), other user's complaint (T4), revoked assignment (T5), expired grant (T6), self-approval (T7), role/user_id injection (T8/T9), approval replay (T10), CSRF.
Race tests (T-5.4) and load tests are **not** included yet — see docs/security/threat-model.md.

## Using it
1. Admin logs in → creates a booth and can optionally create its first member login in the same form (`/admin/booths`). For existing booths, use Booth details or Users to create a booth-member account and assign it immediately. Share the email and temporary password securely; the member signs in at `/booth/login`. Admins can also assign existing members from Booth details or Assignments.
2. Booth member searches `G-24`, opens the household, records the 6 verification steps in order.
3. Cross-booth: a booth member requests verification access using the exact voter ID and a reason. An approver for the target booth approves it for four hours. Only then can the visiting member view the household roster and record the six verification steps; each cross-booth step is linked to the approval and visible in the admin cross-booth report and audit log.
4. Citizens register, submit complaints, track the timeline.

## API summary (`/api/v1`)
auth: register, login, refresh, logout, me, login-media · public: events, announcements · complaints: create, mine, :id, :id/timeline ·
booth: dashboard, households(+search/cursor), households/:id(/citizens), complaints, verifications · cross-booth: requests (+approve/reject) ·
admin: dashboard, booths, assignments, users, complaints, audit-logs, cross-booth report, login-video settings, events (+publish/archive). Health: `/health`, `/ready`.
Responses: `{ success, data | error:{code,message}, requestId }`.

## Frontend structure (`frontend/src`)
```
app/         App, providers (React Query + Router), queryClient, service-worker registration
api/         client.js  (fetch wrapper: cookies, CSRF header, single refresh retry, error normalising)
auth/        useMe, RoleRoute (UX-only guard), paths, navConfig
components/  Badge, Skeleton, Empty, ErrorBox, Async, Title, Field, StatCard, Feed, AppHeader, BottomNav
layouts/     AppLayout (header + bottom nav), AuthLayout
routes/      index.jsx (all routes), RootRedirect
forms/       LoginForm, RegisterForm, ComplaintForm, ProfileForm, schemas.js (zod)
hooks/       useGet, useAct
services/    authService, complaintService, profileService
utils/       format.js, constants.js
pages/       auth/ (2)  citizen/ (6)  booth/ (6)  admin/ (13)  + AccessDenied, NotFound
public/      manifest.webmanifest, sw.js (never caches /api), favicon.svg
```

## Pages
**Citizen** `/login /register /home /complaints /complaints/new /complaints/:id /events /profile`
**Booth member** `/booth/login /booth/dashboard /booth/households /booth/households/:id (+/citizens) /booth/verifications /booth/cross-booth /booth/complaints`
**Admin** `/admin/login /admin/dashboard /admin/booths /admin/booths/:boothId /admin/assignments /admin/users /admin/complaints /admin/complaints/:id /admin/citizens /admin/import /admin/exports /admin/events /admin/audit-logs /admin/cross-booth /admin/settings`

## Loading your data
Admin → Import → download the CSV template → upload booth voter rows → review the preview → Confirm. The worker (`npm run dev:worker`) must be running to commit imports and generate exports. On Render, deploy a separate Background Worker from the repository root, build with `npm ci`, and start it with `node worker/src/index.js`. Configure its database environment variables to match the API (including `DATABASE_SSL=true`). A job left at `QUEUED` with zero processed rows means the worker has not claimed it. After it reaches `COMMITTED`, booth members see only rosters for booths to which their account is actively assigned. Admins can delete a tracked import from Recent imports; its imported roster entries are archived and verification history is retained. Imports created before roster tracking was added cannot be safely deleted there. Voters in another booth use the approved cross-booth workflow.

Upload one CSV at a time (combine files into a single CSV if needed), up to 50 MiB and 50,000 data rows. The roster CSV requires one row per person and these exact headers: `booth_code,house_code,full_name,relation`. Optional headers are `address,roll_serial,voter_id,age,gender,life_status`. `booth_code` must match an active booth. Reuse the same `house_code` and address for all people in one household. Age is a whole number from 0 to 130; gender is `MALE`, `FEMALE`, `OTHER`, or `UNKNOWN`; life status is `ALIVE`, `DECEASED`, or `UNKNOWN`. Leave unavailable optional values blank rather than guessing. Voter IDs must be unique. Do not include voter portraits or images in the CSV. The import preview validates rows before confirmation.

Admins can add a single person from Admin → Citizens & households without re-uploading a CSV. “Remove from active roster” archives that person: they disappear from booth work and new exports, while verification history and the voter ID record remain stored for audit/history. The original uploaded CSV file is not retained as a downloadable document after processing; imported roster rows are database records.

Admin → Exports provides three verification roster exports: no passed steps, 1–5 passed steps, and all 6 passed steps. Exports can be limited to a booth; voter IDs are masked and generated files expire after 24 hours.

Admins can optionally set a login welcome video in Settings by pasting an HTTPS Cloudinary `res.cloudinary.com/<cloud>/video/upload/...` delivery URL. The video is public, muted and looping on sign-in pages; no Cloudinary secret is stored in the app.

Admins can change their own password in Settings by entering their current password and confirming a new password (at least 8 characters). The current session stays active and all other sessions for that account are revoked. Password changes are rate-limited and written to the audit log without storing password values.
Endpoint index: `docs/api/openapi.json`.

## Status
Read `docs/security/threat-model.md` for assumptions and the list of NOT-yet-implemented items before any production use.
Validation: `npm run build` and `npm test -w backend`. The database-backed authorization tests are skipped unless `TEST_DB=1` is set against a dedicated synthetic test database; never point them at real citizen data.
