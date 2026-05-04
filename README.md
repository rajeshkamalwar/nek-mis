# Zoho Mapping Studio (Books by Rudra v2)

Monorepo: **FastAPI** backend + **Vite/React** mapping studio.

## Prerequisites

- Python 3.11+
- Node 20+
- PostgreSQL 15+
- Redis (optional, for Celery)

## Database (PostgreSQL)

The default `DATABASE_URL` in `.env.example` is `postgres` / `postgres` on `localhost:5432`, database `zoho_mapping_studio`.

**Option A — Docker (recommended; avoids clashing with Postgres already on 5432):**

```bash
# repo root — Postgres listens on host port 5433 → use DATABASE_URL with :5433 in backend/.env
docker compose up -d
cd backend
copy ..\.env.example .env   # first time; ensure DATABASE_URL uses port 5433
alembic upgrade head
# Start the API (another terminal), then seed (no curl):
python scripts/seed_walmart_profile.py
# If the API is on another base URL: API_BASE=http://127.0.0.1:8020 python scripts/seed_walmart_profile.py
```

**Option B — Your own Postgres:** create DB and user, then set `DATABASE_URL` in `backend/.env`, run `alembic upgrade head`, then seed as above.

If the API returns **503** on `/api/...`, read the JSON `detail` — usually the DB is down or the password in `DATABASE_URL` is wrong.

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env   # edit DATABASE_URL, Zoho vars
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Seed default Walmart profile (after DB is up and `uvicorn` is running):

```bash
cd backend
python scripts/seed_walmart_profile.py
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173/mapping-studio/walmart`. The dev server proxies `/api` to `http://127.0.0.1:8020` per `frontend/vite.config.ts` — start `uvicorn` on that port or change the proxy to match your backend.

## Celery

```bash
cd backend
celery -A app.tasks.celery_app worker -l info
```

Trigger publish (after implementing task wiring from your app): `publish_zoho_run.delay(run_id, "walmart")`.

## Environment

See `backend/.env.example`.

## Canonical repo

Push to: `https://github.com/rajeshkamalwar/Zoho-mapping-studio`
