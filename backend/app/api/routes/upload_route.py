from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.csv_ingest import ingest_csv_text

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("")
async def upload_csv(
    file: UploadFile = File(...),
    source_key: str = Form(...),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Expected a .csv file")
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        raise HTTPException(400, "CSV must be UTF-8") from e
    try:
        result = ingest_csv_text(db, text, source_key)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return result
