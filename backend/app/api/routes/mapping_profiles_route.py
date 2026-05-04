from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import uuid

from app.db.session import get_db
from app.db.models.mapping import MappingProfile, MappingRule
from app.db.repositories import mapping_profile_repo
from app.zoho.formula_eval import validate_formula_syntax

router = APIRouter(prefix="/mapping-profiles", tags=["mapping-profiles"])


class ProfileCreate(BaseModel):
    source_key: str
    profile_name: str
    description: str | None = None
    is_default: bool = False


class ProfileUpdate(BaseModel):
    profile_name: str | None = None
    description: str | None = None
    is_default: bool | None = None


class RuleUpsert(BaseModel):
    canonical_key: str
    label: str | None = None
    zoho_account_id: str
    zoho_account_name: str | None = None
    document_kind: str
    formula_expr: str | None = None
    tax_rate: str | None = None
    sign_hint: str = "auto"
    condition_expr: dict | None = None
    sort_order: int = 0


def _rule_out(r: MappingRule) -> dict:
    return {
        "id": str(r.id),
        "canonical_key": r.canonical_key,
        "label": r.label,
        "zoho_account_id": r.zoho_account_id,
        "zoho_account_name": r.zoho_account_name,
        "document_kind": r.document_kind,
        "formula_expr": r.formula_expr,
        "tax_rate": r.tax_rate,
        "sign_hint": r.sign_hint,
        "condition_expr": r.condition_expr,
        "sort_order": r.sort_order,
    }


def _profile_out(p: MappingProfile, db: Session) -> dict:
    return {
        "id": str(p.id),
        "source_key": p.source_key,
        "profile_name": p.profile_name,
        "description": p.description,
        "is_default": p.is_default,
        "rules": [_rule_out(r) for r in mapping_profile_repo.list_rules_for_profile(db, p.id)],
    }


@router.get("")
def list_profiles(source_key: str | None = Query(None), db: Session = Depends(get_db)):
    profiles = mapping_profile_repo.list_profiles(db, source_key)
    return {"profiles": [_profile_out(p, db) for p in profiles]}


@router.post("")
def create_profile(body: ProfileCreate, db: Session = Depends(get_db)):
    if body.is_default:
        for p in mapping_profile_repo.list_profiles(db, body.source_key):
            if p.is_default:
                p.is_default = False
        db.commit()
    prof = MappingProfile(
        source_key=body.source_key,
        profile_name=body.profile_name,
        description=body.description,
        is_default=body.is_default,
    )
    db.add(prof)
    db.commit()
    db.refresh(prof)
    return _profile_out(prof, db)


@router.get("/{profile_id}")
def get_profile(profile_id: str, db: Session = Depends(get_db)):
    try:
        pid = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(400, "Invalid profile_id")
    p = mapping_profile_repo.get_profile(db, pid)
    if not p:
        raise HTTPException(404, "Not found")
    return _profile_out(p, db)


@router.put("/{profile_id}")
def update_profile(profile_id: str, body: ProfileUpdate, db: Session = Depends(get_db)):
    try:
        pid = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(400, "Invalid profile_id")
    p = mapping_profile_repo.get_profile(db, pid)
    if not p:
        raise HTTPException(404, "Not found")
    if body.profile_name is not None:
        p.profile_name = body.profile_name
    if body.description is not None:
        p.description = body.description
    if body.is_default is not None and body.is_default:
        for op in mapping_profile_repo.list_profiles(db, p.source_key):
            if op.id != p.id and op.is_default:
                op.is_default = False
        p.is_default = True
    elif body.is_default is not None and not body.is_default:
        p.is_default = False
    db.commit()
    db.refresh(p)
    return _profile_out(p, db)


@router.delete("/{profile_id}")
def delete_profile(profile_id: str, db: Session = Depends(get_db)):
    try:
        pid = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(400, "Invalid profile_id")
    if not mapping_profile_repo.delete_profile(db, pid):
        raise HTTPException(404, "Not found")
    return {"ok": True}


@router.get("/{profile_id}/rules")
def list_rules(profile_id: str, db: Session = Depends(get_db)):
    try:
        pid = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(400, "Invalid profile_id")
    if not mapping_profile_repo.get_profile(db, pid):
        raise HTTPException(404, "Not found")
    rules = mapping_profile_repo.list_rules_for_profile(db, pid)
    return {"rules": [_rule_out(r) for r in rules]}


@router.post("/{profile_id}/rules")
def upsert_rule(profile_id: str, body: RuleUpsert, db: Session = Depends(get_db)):
    try:
        pid = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(400, "Invalid profile_id")
    if not mapping_profile_repo.get_profile(db, pid):
        raise HTTPException(404, "Not found")
    try:
        validate_formula_syntax(body.formula_expr)
        if body.formula_expr:
            from types import SimpleNamespace

            tmp = SimpleNamespace(
                formula_expr=body.formula_expr,
                sign_hint=body.sign_hint or "auto",
            )
            from app.zoho.formula_eval import eval_formula

            eval_formula(0, tmp)
    except Exception as e:
        raise HTTPException(400, f"Invalid formula: {e}") from e
    r = mapping_profile_repo.upsert_rule(
        db,
        pid,
        canonical_key=body.canonical_key,
        label=body.label,
        zoho_account_id=body.zoho_account_id,
        zoho_account_name=body.zoho_account_name,
        document_kind=body.document_kind,
        formula_expr=body.formula_expr,
        tax_rate=body.tax_rate,
        sign_hint=body.sign_hint or "auto",
        condition_expr=body.condition_expr,
        sort_order=body.sort_order,
    )
    return _rule_out(r)


@router.delete("/{profile_id}/rules/{canonical_key:path}")
def delete_rule_route(profile_id: str, canonical_key: str, db: Session = Depends(get_db)):
    try:
        pid = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(400, "Invalid profile_id")
    if not mapping_profile_repo.delete_rule(db, pid, canonical_key):
        raise HTTPException(404, "Not found")
    return {"ok": True}
