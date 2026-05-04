from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, ProgrammingError

from app.api.routes.admin_route import router as admin_router
from app.api.routes.connectors_route import router as connectors_router
from app.api.routes.mapping_profiles_route import router as mapping_profiles_router
from app.api.routes.runs_api import router as runs_router
from app.api.routes.settings_route import router as settings_router
from app.api.routes.upload_route import router as upload_router
from app.api.routes.zoho_books_route import router as zoho_router

app = FastAPI(title="Zoho Mapping Studio API", version="0.1.0")


@app.exception_handler(ProgrammingError)
async def db_programming_error_handler(_, exc: ProgrammingError):
    msg = str(exc.orig) if getattr(exc, "orig", None) else str(exc)
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Database schema missing or wrong database. From backend folder run: alembic upgrade head. "
            f"Raw: {msg[:400]}"
        },
    )


@app.exception_handler(OperationalError)
async def db_operational_error_handler(_, exc: OperationalError):
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Database unavailable or credentials rejected. "
            "Set DATABASE_URL in backend/.env (see .env.example). "
            "Docker Compose in this repo exposes Postgres on host port 5433 (not 5432). "
            "After DB is up: alembic upgrade head."
        },
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://[::1]:5173",
        "http://[::1]:5174",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mapping_profiles_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(runs_router, prefix="/api")
app.include_router(zoho_router, prefix="/api")
app.include_router(connectors_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(upload_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
