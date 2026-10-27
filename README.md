# Booth Verification

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

## Redis caching

When `REDIS_URL` is configured, Redis shares API rate-limit state across instances and caches public event/announcement responses plus admin and booth dashboard counts. Dashboard cache keys are organization-scoped, contain only aggregate counts, and expire after 10 seconds; dashboard totals may briefly lag behind roster changes. Redis is not a source of truth, and dashboard requests fall back to SQL if the cache is unavailable. Redis does not provide phone offline access; the booth roster's encrypted browser storage handles that separately.

## Roles and visibility

- Admins manage booths, booth member accounts, assignments, imported rosters, exports, events and settings.
- Booth members can view active households and people across all booths in their organization. Voter IDs remain masked outside the member’s assigned booths.
- Booth members can edit door-to-door visit details only for booths where they have an active assignment. Verification records are visible and can be recorded across the organization.
- Organization boundaries remain enforced for all roster reads.

## Offline Booth Member search and printing

After a Booth Member signs in online, the app downloads the organization's roster for offline search and printing. The copy is stored encrypted in that browser's IndexedDB and refreshed when it is older than six hours or when the app detects a deleted import on reconnect, foreground, or its once-per-minute online check. A device that remains offline cannot receive deletion updates until it reconnects. The copy remains on that device until refreshed, the member logs out, clears the offline copy, or app/browser data is removed. Logging out removes the local roster and offline identity. The device/browser may still evict stored data, and offline visit changes cannot be submitted until connectivity returns. Full voter IDs remain available only for the member's actively assigned booths; IDs in other booths stay masked, as they do online.

Offline use is read-only: Booth Members can search roster names and print records already marked Verification done. Visit updates, verification actions, and all admin functions require internet. The first sign-in and roster download require internet. Device-level access to the unlocked browser profile can expose locally available records; Web Crypto encryption does not protect an unlocked session or a compromised app origin.

## Voter slip printing

Voter slips use a narrow 52 mm layout. In a regular mobile browser, Print opens the system print flow, where the user can select a printer or save a PDF. In the Android Capacitor app, users can choose a previously paired Bluetooth device for direct thermal printing or use the system print flow instead. Direct printing currently sends monochrome raster images using ESC/POS over Bluetooth Classic (SPP); it does not scan for devices, so the printer must first be paired in Android Bluetooth settings. The printer must support this transport and command format. The SHREYANS 588 product material reviewed for this feature does not confirm those details, so printing to that model needs a real-device check. Other Capacitor platforms and browser sessions use system printing; direct Bluetooth support is not provided there.

## Booth member phone sign-in

New booth-member accounts are created by an Admin with a phone number, a password of at least 12 characters, and a booth assignment. The database enforces unique phone numbers. Existing Admin accounts and existing booth accounts can continue using email sign-in. Apply migration `015_booth_member_phone_login.sql` before deploying the updated backend.

## Data import and exports

Admins can import one CSV or `.xlsx` worksheet at a time, up to 50 MiB and 50,000 rows. The voter-list headers `Booth number`, `S. No`, `Voter Name`, `Father's Name/ Husband's Name`, `Door No`, and `Voter Id No` are accepted, alongside the existing normalized headers. Relationship defaults to `RESIDENT`; fields absent from a source sheet keep their existing defaults. The worker must be running to commit imports and generate exports. Imports fill a missing household address without overwriting a pre-existing address. Deleting a tracked import permanently removes its imported citizens and their verification history, clears addresses first supplied by that import, and recalculates verification status for affected households. It removes an empty household and its booth assignments only when no other citizens or households remain. Existing organization export snapshots are expired because they may contain the removed records. Shared households and booths with remaining roster data are retained. Imports created before source tracking was enabled cannot be safely deleted through this action.

Exports include active roster, shifted and deceased people, D2D status, households and verification progress. Voter IDs are masked in exports; generated files expire after 24 hours.

## Removed features and data

Migration `009_remove_citizen_accounts_complaints_cross_booth_and_audit.sql` deletes citizen login accounts and sessions, complaint records and attachments, cross-booth approval requests and grant-linked verification entries, audit log records, complaint exports and complaint notifications. It also removes the related tables, API routes and UI. Referenced complaint attachment files are removed from `UPLOAD_DIR`. Imported citizens, households, booth-member/admin accounts, booth assignments and ordinary verification history are preserved; household verification status is recalculated where grant-linked steps were deleted.

## Verification

```bash
npm test -w backend
npm run build
```

Database-backed authorization tests require `TEST_DB=1` and a dedicated synthetic database. Never point them at production or real citizen data. The API contract is in `docs/api/openapi.json`; security assumptions and known gaps are in `docs/security/threat-model.md`.
