import uuid

from app.db.repositories import run_repo
from app.db.session import SessionLocal
from app.tasks.celery_app import celery_app
from app.zoho.unified_publisher import publish_run


@celery_app.task(name="publish_zoho_run")
def publish_zoho_task(run_id: str) -> dict:
    """Single entry: unified publisher only (Books by Rudra v2)."""
    db = SessionLocal()
    try:
        rid = uuid.UUID(run_id)
        sk = run_repo.get_source_key_for_run(db, rid)
        if not sk:
            return {"ok": False, "published_rows": 0, "error": "Run not found"}
        n = publish_run(db, rid, sk)
        return {"ok": True, "published_rows": n}
    finally:
        db.close()
