from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.csv_ingest import ingest_csv_text

logger = logging.getLogger(__name__)

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
    # Try common encodings in order
    text: str | None = None
    for enc in ("utf-8-sig", "utf-8", "windows-1252", "latin-1"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise HTTPException(400, "Could not decode CSV — please save the file as UTF-8 and retry.")
    try:
        result = ingest_csv_text(db, text, source_key)
    except ValueError as e:
        logger.error("Upload rejected — source=%s file=%s error=%s", source_key, file.filename, e)
        raise HTTPException(400, str(e)) from e
    except Exception as e:
        logger.exception("Unexpected error during upload — source=%s file=%s", source_key, file.filename)
        raise HTTPException(500, f"Upload failed: {e}") from e
    return result
