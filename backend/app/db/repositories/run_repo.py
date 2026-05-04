import uuid

from sqlalchemy.orm import Session

from app.db.models.core import CsvFile, CsvRow, PipelineRun, Source, ZohoPublish
from app.db.models.mapping import MappingProfile


def get_run(db: Session, run_id: uuid.UUID) -> PipelineRun | None:
    return db.query(PipelineRun).filter(PipelineRun.id == run_id).first()


def set_run_profile(db: Session, run_id: uuid.UUID, profile_id: uuid.UUID) -> PipelineRun | None:
    run = get_run(db, run_id)
    if not run:
        return None
    p = db.query(MappingProfile).filter(MappingProfile.id == profile_id).first()
    if not p:
        return None
    run.profile_id = profile_id
    db.commit()
    db.refresh(run)
    return run


def bump_processed(db: Session, run_id: uuid.UUID, n: int = 1) -> None:
    run = get_run(db, run_id)
    if run:
        run.processed_rows = (run.processed_rows or 0) + n
        db.commit()


def set_processed(db: Session, run_id: uuid.UUID, n: int) -> None:
    """Set processed_rows to an absolute value (avoids double-counting on re-publish)."""
    run = get_run(db, run_id)
    if run:
        run.processed_rows = n
        db.commit()


def get_source_key_for_run(db: Session, run_id: uuid.UUID) -> str | None:
    run = get_run(db, run_id)
    if not run:
        return None
    cf = db.query(CsvFile).filter(CsvFile.id == run.csv_file_id).first()
    if not cf:
        return None
    src = db.query(Source).filter(Source.id == cf.source_id).first()
    return src.source_key if src else None


def list_recent_runs(db: Session, limit: int = 20) -> list[PipelineRun]:
    return (
        db.query(PipelineRun)
        .order_by(PipelineRun.started_at.desc())
        .limit(limit)
        .all()
    )


def list_recent_runs_with_source(db: Session, limit: int = 20) -> list[tuple[PipelineRun, str]]:
    rows = (
        db.query(PipelineRun, Source.source_key)
        .join(CsvFile, PipelineRun.csv_file_id == CsvFile.id)
        .join(Source, CsvFile.source_id == Source.id)
        .order_by(PipelineRun.started_at.desc())
        .limit(limit)
        .all()
    )
    return [(run, sk) for run, sk in rows]


def delete_run_and_upload(db: Session, run_id: uuid.UUID) -> bool:
    """Remove pipeline run, its CSV file, all ingested rows, and local publish audit rows. Does not change Zoho Books."""
    run = get_run(db, run_id)
    if not run:
        return False
    file_id = run.csv_file_id
    row_id_subq = db.query(CsvRow.id).filter(CsvRow.csv_file_id == file_id)
    db.query(ZohoPublish).filter(ZohoPublish.csv_row_id.in_(row_id_subq)).delete(synchronize_session=False)
    db.query(CsvRow).filter(CsvRow.csv_file_id == file_id).delete(synchronize_session=False)
    db.query(PipelineRun).filter(PipelineRun.id == run_id).delete(synchronize_session=False)
    db.query(CsvFile).filter(CsvFile.id == file_id).delete(synchronize_session=False)
    db.commit()
    return True
