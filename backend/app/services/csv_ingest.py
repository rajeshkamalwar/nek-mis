"""Parse marketplace CSV and persist CsvRow records."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.db.models.core import CsvFile, CsvRow, PipelineRun
from app.db.repositories import mapping_profile_repo
from app.db.repositories import source_repo
from app.services.marketplace_schemas import get_schema_map, map_header_to_canonical, normalize_source_key


def _parse_cell(val: str | None) -> float | None:
    if val is None:
        return None
    s = str(val).strip().replace(",", "").replace("$", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _mapped_cell_value(cell: str | None) -> float | str | None:
    """Prefer numeric amounts; keep non-numeric IDs as strings."""
    if cell is None:
        return None
    stripped = str(cell).strip()
    if not stripped:
        return None
    num = _parse_cell(cell)
    if num is not None:
        return num
    return stripped


def _csv_file_hash(text: str) -> str:
    """SHA-256 of the full CSV text used to detect duplicate uploads."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def ingest_csv_text(db: Session, text: str, source_key: str) -> dict[str, Any]:
    sk = normalize_source_key(source_key)
    if not get_schema_map(sk):
        raise ValueError(f"Unknown or unsupported source_key: {source_key!r}")

    # Duplicate-upload guard: warn if we've seen this exact file before
    file_hash = _csv_file_hash(text)
    existing_dup = (
        db.query(CsvRow)
        .filter(CsvRow.raw_hash == file_hash)
        .first()
    )
    duplicate_run_id: str | None = None
    if existing_dup and existing_dup.pipeline_run_id:
        duplicate_run_id = str(existing_dup.pipeline_run_id)

    source = source_repo.get_or_create_source(db, sk)
    csv_file = CsvFile(id=uuid.uuid4(), source_id=source.id)
    db.add(csv_file)
    db.flush()

    run = PipelineRun(
        id=uuid.uuid4(),
        csv_file_id=csv_file.id,
        status="running",
        total_rows=0,
        processed_rows=0,
    )
    db.add(run)
    db.flush()

    reader = csv.DictReader(io.StringIO(text))
    default_profile = mapping_profile_repo.get_default_profile_for_source(db, sk)
    if default_profile:
        run.profile_id = default_profile.id

    rows_inserted = 0
    for raw_row in reader:
        raw_clean = {k: (v if v is not None else "") for k, v in raw_row.items() if k is not None}
        raw_json = json.dumps(raw_clean, sort_keys=True, default=str)
        raw_hash = hashlib.sha256(raw_json.encode("utf-8")).hexdigest()

        mapped: dict[str, float | str] = {}
        for col_name, cell in raw_clean.items():
            canon = map_header_to_canonical(sk, col_name)
            if not canon:
                continue
            v = _mapped_cell_value(cell)
            if v is not None:
                mapped[canon] = v

        row = CsvRow(
            id=uuid.uuid4(),
            csv_file_id=csv_file.id,
            pipeline_run_id=run.id,
            source_id=source.id,
            raw_hash=raw_hash,
            raw_data=raw_clean,
            mapped_data=mapped if mapped else None,
            status="clean",
        )
        db.add(row)
        rows_inserted += 1

    run.total_rows = rows_inserted
    run.status = "completed"
    db.commit()
    db.refresh(run)

    return {
        "run_id": str(run.id),
        "source_key": sk,
        "total_rows": rows_inserted,
        "profile_id": str(run.profile_id) if run.profile_id else None,
        "duplicate_of": duplicate_run_id,
    }
