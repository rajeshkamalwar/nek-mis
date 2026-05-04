"""Canonical keys per connector derived from marketplace CSV schema maps."""

from fastapi import APIRouter

from app.services.marketplace_schemas import canonical_keys_for_source, normalize_source_key

router = APIRouter(prefix="/connectors", tags=["connectors"])


@router.get("/{source_key}/canonical-keys")
def canonical_keys(source_key: str):
    sk = normalize_source_key(source_key)
    keys = canonical_keys_for_source(sk)
    if not keys:
        return {"source_key": source_key, "canonical_keys": ["sample_key_1", "sample_key_2"]}
    return {"source_key": sk, "canonical_keys": keys}
