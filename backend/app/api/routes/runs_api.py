import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.repositories import run_repo
from app.zoho.unified_publisher import dry_run_run, publish_run

router = APIRouter(prefix="/runs", tags=["runs"])


class ApplyProfileBody(BaseModel):
    profile_id: str


class DryRunBody(BaseModel):
    max_rows: int = Field(default=50, ge=1, le=500)


@router.get("")
def list_runs(db: Session = Depends(get_db), limit: int = 20):
    lim = max(1, min(limit, 100))
    pairs = run_repo.list_recent_runs_with_source(db, lim)
    runs = []
    for run, source_key in pairs:
        runs.append(
            {
                "id": str(run.id),
                "status": run.status,
                "source_key": source_key,
                "total_rows": run.total_rows,
                "processed_rows": run.processed_rows,
                "profile_id": str(run.profile_id) if run.profile_id else None,
                "started_at": run.started_at.isoformat() if run.started_at else None,
            }
        )
    return {"runs": runs}


@router.get("/{run_id}")
def get_run_detail(run_id: str, db: Session = Depends(get_db)):
    try:
        rid = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(400, "Invalid run_id")
    run = run_repo.get_run(db, rid)
    if not run:
        raise HTTPException(404, "Run not found")
    source_key = run_repo.get_source_key_for_run(db, rid)
    if not source_key:
        raise HTTPException(404, "Run source not found")
    return {
        "id": str(run.id),
        "status": run.status,
        "source_key": source_key,
        "total_rows": run.total_rows,
        "processed_rows": run.processed_rows,
        "profile_id": str(run.profile_id) if run.profile_id else None,
        "started_at": run.started_at.isoformat() if run.started_at else None,
    }


@router.post("/{run_id}/apply-profile")
def apply_profile(run_id: str, body: ApplyProfileBody, db: Session = Depends(get_db)):
    try:
        rid = uuid.UUID(run_id)
        pid = uuid.UUID(body.profile_id)
    except ValueError:
        raise HTTPException(400, "Invalid UUID")
    run = run_repo.set_run_profile(db, rid, pid)
    if not run:
        raise HTTPException(404, "Run or profile not found")
    return {"ok": True, "run_id": str(run.id), "profile_id": str(run.profile_id)}


@router.post("/{run_id}/dry-run")
def dry_run(run_id: str, body: DryRunBody | None = None, db: Session = Depends(get_db)):
    try:
        rid = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(400, "Invalid run_id")
    run = run_repo.get_run(db, rid)
    if not run:
        raise HTTPException(404, "Run not found")
    source_key = run_repo.get_source_key_for_run(db, rid)
    if not source_key:
        raise HTTPException(404, "Run source not found")
    max_rows = (body or DryRunBody()).max_rows
    try:
        previews = dry_run_run(db, rid, source_key, max_rows=max_rows)
    except Exception as e:
        raise HTTPException(400, str(e)) from e
    return {"run_id": run_id, "source_key": source_key, "rows": previews}


@router.delete("/{run_id}")
def delete_run(run_id: str, db: Session = Depends(get_db)):
    try:
        rid = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(400, "Invalid run_id")
    ok = run_repo.delete_run_and_upload(db, rid)
    if not ok:
        raise HTTPException(404, "Run not found")
    return {"ok": True, "deleted_run_id": run_id}


@router.post("/{run_id}/publish")
def publish_run_ep(run_id: str, db: Session = Depends(get_db)):
    try:
        rid = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(400, "Invalid run_id")
    source_key = run_repo.get_source_key_for_run(db, rid)
    if not source_key:
        raise HTTPException(404, "Run not found")
    try:
        n = publish_run(db, rid, source_key)
    except Exception as e:
        raise HTTPException(400, str(e)) from e
    return {"published": n}


@router.post("/{run_id}/publish-async")
def publish_run_async_ep(run_id: str, db: Session = Depends(get_db)):
    """Enqueue a Celery task for background publish. Returns immediately."""
    try:
        rid = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(400, "Invalid run_id")
    source_key = run_repo.get_source_key_for_run(db, rid)
    if not source_key:
        raise HTTPException(404, "Run not found")
    try:
        from app.tasks.publish_zoho import publish_zoho_task
        task = publish_zoho_task.delay(run_id)
    except Exception as e:
        raise HTTPException(503, f"Could not enqueue task (is Redis running?): {e}") from e
    return {"queued": True, "task_id": task.id, "run_id": run_id}
