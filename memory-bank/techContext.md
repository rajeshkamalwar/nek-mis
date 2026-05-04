# Tech context

| Layer | Stack |
|-------|--------|
| API | FastAPI, Pydantic v2, Uvicorn |
| DB | PostgreSQL, SQLAlchemy 2, Alembic |
| Jobs | Celery + Redis |
| UI | Vite, React 18, TypeScript, Tailwind, TanStack Query v5, Axios, `@xyflow/react` v12 |

Run backend from `backend/` with `uvicorn app.main:app`. Frontend dev server proxies `/api` to port 8000.
