import uuid

from sqlalchemy.orm import Session

from app.db.models.core import Source
from app.services.marketplace_schemas import normalize_source_key


def get_or_create_source(db: Session, source_key: str) -> Source:
    sk = normalize_source_key(source_key)
    existing = db.query(Source).filter(Source.source_key == sk).first()
    if existing:
        return existing
    row = Source(id=uuid.uuid4(), source_key=sk)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
