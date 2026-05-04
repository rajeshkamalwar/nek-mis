import uuid

from sqlalchemy.orm import Session

from app.db.models.core import ZohoPublish


def create(db: Session, data: dict) -> ZohoPublish:
    record = ZohoPublish(**data)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_by_idempotency_key(db: Session, key: str) -> ZohoPublish | None:
    return db.query(ZohoPublish).filter(ZohoPublish.idempotency_key == key).first()


def update_success(db: Session, record_id: uuid.UUID, zoho_entity_id: str, response: dict) -> None:
    db.query(ZohoPublish).filter(ZohoPublish.id == record_id).update(
        {"status": "success", "zoho_entity_id": zoho_entity_id, "response_payload": response}
    )
    db.commit()


def update_failed(db: Session, record_id: uuid.UUID, error: str, retry_count: int) -> None:
    db.query(ZohoPublish).filter(ZohoPublish.id == record_id).update(
        {"status": "failed", "error_detail": error, "retry_count": retry_count}
    )
    db.commit()
