import uuid

from sqlalchemy.orm import Session

from app.db.models.core import CsvRow


def get_clean_rows(db: Session, pipeline_run_id: uuid.UUID) -> list[CsvRow]:
    return (
        db.query(CsvRow)
        .filter(CsvRow.pipeline_run_id == pipeline_run_id, CsvRow.status == "clean")
        .all()
    )


def get_row(db: Session, row_id: uuid.UUID) -> CsvRow | None:
    return db.query(CsvRow).filter(CsvRow.id == row_id).first()
