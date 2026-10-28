# Samasya Meedi Parishkaram Maadi

Booth and household verification platform for booth members and administrators. Imported voter records remain the application’s roster data; citizens do not have login accounts.

Folders: `backend/` (Express API), `frontend/` (React + Vite + Tailwind), `worker/` (imports, exports and maintenance), `database/` (migrations), `docs/`.

## Quick start

```bash
npm install
npm run migrate
npm run seed
npm run dev:backend
npm run dev:frontend
npm run dev:worker
```

Configure the variables in `.env.example`. Production API, worker and migration processes require `DATABASE_SSL=true` with certificate validation enabled. The frontend calls `/api/v1`; Vite proxies `/api` to `http://localhost:4000` for local development.

Before deploying code that uses new database fields or tables, apply the pending migrations to the intended database and confirm their entries in `schema_migrations`. Review pending migrations before running `npm run migrate` against an existing production database; older unapplied migrations may include data removal.

## Roles and visibility

- Admins manage booths, booth member accounts, assignments, imported rosters, exports, events and settings.
- Booth members can view active households and people across all booths in their organization. Voter IDs remain masked outside the member’s assigned booths.
- Booth members can edit door-to-door visit details only for booths where they have an active assignment. Verification records are visible and can be recorded across the organization.
- Organization boundaries remain enforced for all roster reads.

## Data import and exports

Admins can import one CSV or `.xlsx` worksheet at a time, up to 50 MiB and 50,000 rows. The voter-list headers `Booth number`, `S. No`, `Voter Name`, `Father's Name/ Husband's Name`, `Door No`, and `Voter Id No` are accepted, alongside the existing normalized headers. Relationship defaults to `RESIDENT`; fields absent from a source sheet keep their existing defaults. The worker must be running to commit imports and generate exports. Imported roster rows and verification history are retained independently of login accounts.

Exports include active roster, shifted and deceased people, D2D status, households and verification progress. Voter IDs are masked in exports; generated files expire after 24 hours.

## Removed features and data

Migration `009_remove_citizen_accounts_complaints_cross_booth_and_audit.sql` deletes citizen login accounts and sessions, complaint records and attachments, cross-booth approval requests and grant-linked verification entries, audit log records, complaint exports and complaint notifications. It also removes the related tables, API routes and UI. Referenced complaint attachment files are removed from `UPLOAD_DIR`. Imported citizens, households, booth-member/admin accounts, booth assignments and ordinary verification history are preserved; household verification status is recalculated where grant-linked steps were deleted.

## Verification

```bash
npm test -w backend
npm run build
```

Database-backed authorization tests require `TEST_DB=1` and a dedicated synthetic database. Never point them at production or real citizen data. The API contract is in `docs/api/openapi.json`; security assumptions and known gaps are in `docs/security/threat-model.md`.



