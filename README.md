# Samasya Medhi – Partskaram Madhi App

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

## Tests
```bash
npm test -w backend                       # unit tests (no DB needed)
TEST_DB=1 npm test -w backend             # + authorization tests (needs a migrated TEST database, synthetic data only)
```
Covers: cross-booth IDOR (T1/T2), citizen dataset denial (T3), other user's complaint (T4), revoked assignment (T5), expired grant (T6), self-approval (T7), role/user_id injection (T8/T9), approval replay (T10), CSRF.
Race tests (T-5.4) and load tests are **not** included yet — see docs/security/threat-model.md.

## Using it
1. Admin logs in → creates booths (`/admin/booths`) → creates booth members (`POST /api/v1/admin/users`) → assigns them (`POST /admin/booths/:id/assignments`, optionally `canApproveCrossBooth`).
2. Booth member searches `G-24`, opens the household, records the 6 verification steps in order.
3. Cross-booth: a booth member requests verification access using the exact voter ID and a reason. An approver for the target booth approves it for four hours. Only then can the visiting member view the household roster and record the six verification steps; each cross-booth step is linked to the approval and visible in the admin cross-booth report and audit log.
4. Citizens register, submit complaints, track the timeline.

## API summary (`/api/v1`)
auth: register, login, refresh, logout, me · public: events, announcements · complaints: create, mine, :id, :id/timeline ·
booth: dashboard, households(+search/cursor), households/:id(/citizens), complaints, verifications · cross-booth: requests (+approve/reject) ·
admin: dashboard, booths, assignments, users, complaints, audit-logs, events (+publish/archive). Health: `/health`, `/ready`.
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
Admin → Import → download the CSV template → upload booth voter rows → review the preview → Confirm. The worker (`npm run dev:worker`) must be running to commit imports and generate exports. Booth members see only rosters for booths assigned to them. Voters in another booth use the approved cross-booth workflow.

Admins can optionally set a login welcome video in Settings by pasting an HTTPS Cloudinary `res.cloudinary.com/<cloud>/video/upload/...` delivery URL. The video is public, muted and looping on sign-in pages; no Cloudinary secret is stored in the app.
Endpoint index: `docs/api/openapi.json`.

## Status
Read `docs/security/threat-model.md` for assumptions and the list of NOT-yet-implemented items before any production use.
This code has not been compiled or run in the build environment (no network) — run `npm install && npm test` first and fix anything surfaced.
