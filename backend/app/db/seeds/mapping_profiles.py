"""Seed default Walmart mapping profile from WALMART_LINE_DEFS."""

from __future__ import annotations

import os
import uuid

from sqlalchemy.orm import Session

from app.db.models.mapping import MappingProfile, MappingRule
from app.db.seeds.walmart_line_defs import WALMART_LINE_DEFS


def _def_to_document_kind(d: dict) -> str:
    kind = (d.get("mapping_document_kind") or "invoice").lower()
    if kind == "invoice":
        return "invoice_line"
    if kind == "journal":
        et = (d.get("entry_type") or "Debit").lower()
        return "journal_debit" if et == "debit" else "journal_credit"
    return "invoice_line"


def _account_id_from_def(d: dict) -> str:
    setting = d.get("default_setting") or ""
    return (os.environ.get(setting, "") or "").strip() or "PLACEHOLDER_SET_" + setting


def seed_walmart_default_profile(db: Session) -> uuid.UUID:
    existing = (
        db.query(MappingProfile)
        .filter(MappingProfile.source_key == "walmart", MappingProfile.is_default.is_(True))
        .first()
    )
    if existing:
        return existing.id

    profile = MappingProfile(
        source_key="walmart",
        profile_name="Walmart CA (seeded)",
        description="Seeded from v0 WALMART_LINE_DEFS — set real Zoho account IDs via UI or env.",
        is_default=True,
    )
    db.add(profile)
    db.flush()

    for i, d in enumerate(WALMART_LINE_DEFS):
        keys = d.get("mapped_amount_keys") or ()
        canonical = str(keys[0]) if keys else d.get("key", "")
        rule = MappingRule(
            profile_id=profile.id,
            canonical_key=canonical,
            label=d.get("label") or canonical,
            zoho_account_id=_account_id_from_def(d),
            zoho_account_name=str(d.get("default_account_name") or ""),
            document_kind=_def_to_document_kind(d),
            formula_expr=None,
            tax_rate=None,
            sign_hint="auto",
            condition_expr=None,
            sort_order=i,
        )
        db.add(rule)

    db.commit()
    db.refresh(profile)
    return profile.id
