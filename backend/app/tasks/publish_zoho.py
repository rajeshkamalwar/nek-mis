import uuid

from celery.utils.log import get_task_logger

from app.db.repositories import run_repo
from app.db.session import SessionLocal
from app.tasks.celery_app import celery_app
from app.zoho.unified_publisher import publish_run

logger = get_task_logger(__name__)


@celery_app.task(
    name="publish_zoho_run",
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 3},
    retry_backoff=True,
    retry_backoff_max=120,
)
def publish_zoho_task(self, run_id: str) -> dict:
    """Single entry: unified publisher only (Books by Rudra v2)."""
    db = SessionLocal()
    try:
        rid = uuid.UUID(run_id)
        sk = run_repo.get_source_key_for_run(db, rid)
        if not sk:
            run_repo.set_zoho_status(db, rid, "failed")
            return {"ok": False, "published": 0, "failed": 0, "error": "Run not found"}
        result = publish_run(db, rid, sk)
        return {"ok": result["zoho_status"] != "failed", **result}
    except Exception as exc:
        logger.exception("publish_zoho_task failed run_id=%s attempt=%s", run_id, self.request.retries)
        db2 = SessionLocal()
        try:
            run_repo.set_zoho_status(db2, uuid.UUID(run_id), "failed")
        finally:
            db2.close()
        raise
    finally:
        db.close()
