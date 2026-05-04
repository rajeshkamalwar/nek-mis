"""Zoho credential UI: read safe fields, write .env, test OAuth + Books API."""

from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.env_file import upsert_env_vars
from app.services.coa_service import clear_chart_of_accounts_cache

router = APIRouter(prefix="/settings", tags=["settings"])

_ENV_KEYS = {
    "zoho_organization_id": "ZOHO_ORGANIZATION_ID",
    "zoho_client_id": "ZOHO_CLIENT_ID",
    "zoho_client_secret": "ZOHO_CLIENT_SECRET",
    "zoho_refresh_token": "ZOHO_REFRESH_TOKEN",
    "zoho_clearing_account_id": "ZOHO_CLEARING_ACCOUNT_ID",
    "zoho_default_contact_id": "ZOHO_DEFAULT_CONTACT_ID",
    "zoho_api_base": "ZOHO_API_BASE",
    "zoho_oauth_url": "ZOHO_OAUTH_URL",
}


class ZohoSettingsBody(BaseModel):
    zoho_organization_id: str | None = None
    zoho_client_id: str | None = None
    zoho_client_secret: str | None = None
    zoho_refresh_token: str | None = None
    zoho_clearing_account_id: str | None = None
    zoho_default_contact_id: str | None = None
    zoho_api_base: str | None = None
    zoho_oauth_url: str | None = None


@router.get("/zoho")
def get_zoho_settings() -> dict[str, Any]:
    s = get_settings()
    return {
        "organization_id": s.zoho_organization_id or "",
        "client_id": s.zoho_client_id or "",
        "client_secret_configured": bool((s.zoho_client_secret or "").strip()),
        "refresh_token_configured": bool((s.zoho_refresh_token or "").strip()),
        "clearing_account_id": s.zoho_clearing_account_id or "",
        "default_contact_id": s.zoho_default_contact_id or "",
        "api_base": s.zoho_api_base or "",
        "oauth_url": s.zoho_oauth_url or "",
    }


@router.post("/zoho")
def save_zoho_settings(body: ZohoSettingsBody) -> dict[str, Any]:
    raw = body.model_dump(exclude_unset=True)
    file_updates: dict[str, str] = {}
    updated_keys: list[str] = []

    for py_key, val in raw.items():
        env_key = _ENV_KEYS.get(py_key)
        if not env_key:
            continue
        if py_key in ("zoho_client_secret", "zoho_refresh_token"):
            if val is not None and str(val).strip():
                file_updates[env_key] = str(val).strip()
                updated_keys.append(env_key)
        else:
            if val is not None:
                file_updates[env_key] = str(val)
                updated_keys.append(env_key)

    if file_updates:
        upsert_env_vars(file_updates)
        get_settings.cache_clear()
        clear_chart_of_accounts_cache()

    return {"status": "saved", "updated_keys": updated_keys}


@router.post("/zoho/test")
def test_zoho_connection() -> dict[str, Any]:
    try:
        s = get_settings()
        org_id = (s.zoho_organization_id or "").strip()
        client_id = (s.zoho_client_id or "").strip()
        client_secret = (s.zoho_client_secret or "").strip()
        refresh_token = (s.zoho_refresh_token or "").strip()
        oauth_url = (s.zoho_oauth_url or "").strip() or "https://accounts.zoho.com/oauth/v2/token"
        api_base = (s.zoho_api_base or "").strip().rstrip("/")

        missing = []
        if not org_id:
            missing.append("Organization ID")
        if not client_id:
            missing.append("Client ID")
        if not client_secret:
            missing.append("Client secret")
        if not refresh_token:
            missing.append("Refresh token")
        if missing:
            return {
                "status": "not_configured",
                "message": "Missing: " + ", ".join(missing),
            }

        with httpx.Client(timeout=20.0) as client:
            r = client.post(
                oauth_url,
                data={
                    "refresh_token": refresh_token,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "refresh_token",
                },
            )
            try:
                token_body = r.json()
            except Exception:
                token_body = {"raw": r.text}

            if r.status_code >= 400:
                return {
                    "status": "failed",
                    "message": f"OAuth HTTP {r.status_code}: {token_body!s}"[:800],
                }

            access_token = token_body.get("access_token")
            if not access_token:
                return {
                    "status": "failed",
                    "message": f"No access_token in OAuth response: {token_body!s}"[:800],
                }

            contacts_url = f"{api_base}/contacts"
            r2 = client.get(
                contacts_url,
                headers={"Authorization": f"Zoho-oauthtoken {access_token}"},
                params={"organization_id": org_id, "per_page": 1},
            )
            try:
                books_body = r2.json()
            except Exception:
                books_body = {"raw": r2.text}

            if r2.status_code >= 400:
                return {
                    "status": "failed",
                    "message": f"Books API HTTP {r2.status_code}: {books_body!s}"[:800],
                }

            code = books_body.get("code")
            if code == 0 or code == "0":
                return {
                    "status": "connected",
                    "org_id": org_id,
                    "message": "Successfully connected to Zoho Books",
                }

            return {
                "status": "failed",
                "message": f"Zoho Books error: {books_body!s}"[:800],
            }
    except Exception as e:
        return {"status": "failed", "message": str(e)[:800]}
