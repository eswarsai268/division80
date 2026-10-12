# Deployment notes
- **Environments**: separate dev / staging / production, separate DB users, secrets and Redis. Never load real citizen data into dev/staging.
- **Frontend**: build `frontend` (static) behind HTTPS (nginx config included). API and web must share a site (same registrable domain) because cookies are `SameSite=Strict`.
- **API/Worker**: run the `api` and `worker` Docker targets; set `trust proxy` hop count to your load balancer. On Render, create a separate Background Worker from the repository root, build with `npm ci`, and start with `node worker/src/index.js`; provide the same `DATABASE_*` environment settings as the API, with `DATABASE_SSL=true`. The worker processes queued imports/exports. A job that remains `QUEUED` with zero processed rows indicates the worker is not running against that database. Scale API replicas, then size `DATABASE_CONNECTION_LIMIT` = floor(DB max conns × 0.7 / replicas).
- **TiDB**: use TLS (`DATABASE_SSL=true`), a least-privilege DB user (no DDL at runtime), daily backups + PITR, and **test restores** quarterly.
- **Redis**: required in production (rate limits); protect with auth + TLS.
- **Migrations**: `npm run migrate` from a release job after staging verification; never auto-apply untested migrations to production.
- **Secrets**: inject via your platform's secret manager; rotate `JWT_ACCESS_SECRET` by deploying a new value (all access tokens expire in ≤10 min).
- **Load testing**: do not claim capacity until measured. Seed 30k synthetic citizens / 10k+ households, then record p50/p95/p99, RPS, error rate, DB latency, pool utilisation.
