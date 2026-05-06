"""Canonical keys per connector derived from marketplace CSV schema maps."""

from fastapi import APIRouter

from app.services.marketplace_schemas import canonical_keys_for_source, normalize_source_key

router = APIRouter(prefix="/connectors", tags=["connectors"])


@router.get("/{source_key}/canonical-keys")
def canonical_keys(source_key: str):
    sk = normalize_source_key(source_key)
    keys = canonical_keys_for_source(sk)
    return {"source_key": sk, "canonical_keys": keys}
