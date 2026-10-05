# AbujaLifestyle

Abuja-themed browser life simulation starter, designed for Railway.

## Railway deployment

1. Deploy this repository to Railway using the included `Dockerfile`.
2. Add a PostgreSQL service to the same Railway project.
3. Set `DATABASE_URL` on the web service to `${{Postgres.DATABASE_URL}}` (or your database service name).
4. Run `schema.sql` once against the PostgreSQL database.
5. Deploy. The app listens on Railway's `PORT` and uses Next.js standalone output.

## Current game backend

- `POST /api/citizens` creates a persistent citizen when PostgreSQL is configured.
- `GET /api/citizens` returns online/recent citizens.
- `GET /api/jobs` lists starter jobs.
- `POST /api/jobs` assigns a job to a citizen.
- Wallet starts at ₦25,000.
- Six Abuja districts are represented in the first playable slice.

Without `DATABASE_URL`, the frontend remains playable in demo/fallback mode, but citizens are not persistent.

## Next multiplayer layer

The next backend milestone is WebSocket presence/chat, then movement synchronization, inventory, businesses, housing, transactions and authentication/session persistence.
