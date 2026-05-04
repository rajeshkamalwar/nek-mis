"""Repository helpers for MappingProfile / MappingRule."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.db.models.mapping import MappingProfile, MappingRule


def get_default_profile_for_source(db: Session, source_key: str) -> MappingProfile | None:
    return (
        db.query(MappingProfile)
        .filter(MappingProfile.source_key == source_key, MappingProfile.is_default.is_(True))
        .first()
    )


def get_profile(db: Session, profile_id: uuid.UUID) -> MappingProfile | None:
    return db.query(MappingProfile).filter(MappingProfile.id == profile_id).first()


def list_profiles(db: Session, source_key: str | None = None) -> list[MappingProfile]:
    q = db.query(MappingProfile)
    if source_key:
        q = q.filter(MappingProfile.source_key == source_key)
    return q.order_by(MappingProfile.source_key, MappingProfile.profile_name).all()


def list_rules_for_profile(db: Session, profile_id: uuid.UUID) -> list[MappingRule]:
    return (
        db.query(MappingRule)
        .filter(MappingRule.profile_id == profile_id)
        .order_by(MappingRule.sort_order, MappingRule.canonical_key)
        .all()
    )


def rules_as_dict(db: Session, profile_id: uuid.UUID) -> dict[str, MappingRule]:
    rules = list_rules_for_profile(db, profile_id)
    return {r.canonical_key: r for r in rules}


def upsert_rule(
    db: Session,
    profile_id: uuid.UUID,
    *,
    canonical_key: str,
    label: str | None,
    zoho_account_id: str,
    zoho_account_name: str | None,
    document_kind: str,
    formula_expr: str | None = None,
    tax_rate: str | None = None,
    sign_hint: str = "auto",
    condition_expr: dict | None = None,
    sort_order: int = 0,
) -> MappingRule:
    existing = (
        db.query(MappingRule)
        .filter(MappingRule.profile_id == profile_id, MappingRule.canonical_key == canonical_key)
        .first()
    )
    if existing:
        existing.label = label or existing.label
        existing.zoho_account_id = zoho_account_id
        existing.zoho_account_name = zoho_account_name or existing.zoho_account_name
        existing.document_kind = document_kind
        existing.formula_expr = formula_expr
        existing.tax_rate = tax_rate
        existing.sign_hint = sign_hint
        existing.condition_expr = condition_expr
        existing.sort_order = sort_order
        db.commit()
        db.refresh(existing)
        return existing
    rule = MappingRule(
        profile_id=profile_id,
        canonical_key=canonical_key,
        label=label or canonical_key,
        zoho_account_id=zoho_account_id,
        zoho_account_name=zoho_account_name or "",
        document_kind=document_kind,
        formula_expr=formula_expr,
        tax_rate=tax_rate,
        sign_hint=sign_hint,
        condition_expr=condition_expr,
        sort_order=sort_order,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def delete_rule(db: Session, profile_id: uuid.UUID, canonical_key: str) -> bool:
    r = (
        db.query(MappingRule)
        .filter(MappingRule.profile_id == profile_id, MappingRule.canonical_key == canonical_key)
        .first()
    )
    if not r:
        return False
    db.delete(r)
    db.commit()
    return True


def delete_profile(db: Session, profile_id: uuid.UUID) -> bool:
    p = get_profile(db, profile_id)
    if not p:
        return False
    db.delete(p)
    db.commit()
    return True
