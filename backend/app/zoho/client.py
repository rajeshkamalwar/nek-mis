"""Zoho Books HTTP client with optional OAuth refresh and contact resolution."""

from __future__ import annotations

from typing import Any

import httpx

from app.core.config import get_settings
from app.core.exceptions import ZohoAPIException
from app.services.marketplace_schemas import normalize_source_key

_MEMORY_ACCESS_TOKEN: str | None = None

_MARKETPLACE_CONTACT_NAME: dict[str, str] = {
    "walmart": "Walmart CA Customer",
    "amazon_usa": "Amazon USA Customer",
    "amazon_ca": "Amazon CA Customer",
    "onbuy": "OnBuy Customer",
}

_CONTACT_ID_CACHE: dict[str, str] = {}


def _effective_access_token() -> str:
    s = get_settings()
    return (_MEMORY_ACCESS_TOKEN or s.zoho_access_token or "").strip()


def _refresh_configured() -> bool:
    s = get_settings()
    return bool(
        (s.zoho_refresh_token or "").strip()
        and (s.zoho_client_id or "").strip()
        and (s.zoho_client_secret or "").strip()
    )


def refresh_access_token() -> str:
    global _MEMORY_ACCESS_TOKEN
    s = get_settings()
    rt = (s.zoho_refresh_token or "").strip()
    cid = (s.zoho_client_id or "").strip()
    sec = (s.zoho_client_secret or "").strip()
    if not (rt and cid and sec):
        raise ZohoAPIException(
            "OAuth refresh not configured: set ZOHO_REFRESH_TOKEN, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET"
        )
    url = (s.zoho_oauth_url or "https://accounts.zoho.com/oauth/v2/token").strip()
    params = {
        "grant_type": "refresh_token",
        "client_id": cid,
        "client_secret": sec,
        "refresh_token": rt,
    }
    with httpx.Client(timeout=60.0) as client:
        r = client.post(url, params=params)
    try:
        body = r.json()
    except Exception:
        body = {"raw": r.text}
    if r.status_code >= 400:
        raise ZohoAPIException(str(body))
    token = body.get("access_token")
    if not token:
        raise ZohoAPIException(str(body))
    _MEMORY_ACCESS_TOKEN = str(token)
    return _MEMORY_ACCESS_TOKEN


def _zoho_request(
    method: str,
    path: str,
    *,
    json_body: dict | None = None,
    query: dict | None = None,
    _retried: bool = False,
) -> dict[str, Any]:
    s = get_settings()
    token = _effective_access_token()
    if not token or not s.zoho_organization_id:
        raise ZohoAPIException("Zoho not configured: set ZOHO_ACCESS_TOKEN and ZOHO_ORGANIZATION_ID")
    url = f"{s.zoho_api_base.rstrip('/')}/{path.lstrip('/')}"
    headers = {"Authorization": f"Zoho-oauthtoken {token}"}
    params = {"organization_id": s.zoho_organization_id, **(query or {})}
    with httpx.Client(timeout=60.0) as client:
        r = client.request(method, url, headers=headers, params=params, json=json_body)
    try:
        body = r.json()
    except Exception:
        body = {"raw": r.text}
    if r.status_code == 401 and not _retried and _refresh_configured():
        refresh_access_token()
        return _zoho_request(method, path, json_body=json_body, query=query, _retried=True)
    if r.status_code >= 400:
        raise ZohoAPIException(str(body))
    return body


def zoho_post(path: str, payload: dict) -> dict[str, Any]:
    return _zoho_request("POST", path, json_body=payload)


def zoho_get(path: str, query: dict | None = None) -> dict[str, Any]:
    return _zoho_request("GET", path, query=query)


def get_or_create_contact(db, source_key: str) -> str:  # noqa: ARG001 — API parity with callers
    s = get_settings()
    cid = (s.zoho_default_contact_id or "").strip()
    if cid:
        return cid

    sk = normalize_source_key(source_key)
    name = _MARKETPLACE_CONTACT_NAME.get(sk)
    if not name:
        raise ZohoAPIException(f"No contact name configured for source_key={source_key!r}")

    if sk in _CONTACT_ID_CACHE:
        return _CONTACT_ID_CACHE[sk]

    resp = zoho_get("contacts", {"contact_name": name})
    for c in resp.get("contacts") or []:
        if (c.get("contact_name") or "").strip() == name:
            found = (c.get("contact_id") or "").strip()
            if found:
                _CONTACT_ID_CACHE[sk] = found
                return found

    resp = zoho_post("contacts", {"contact_name": name, "contact_type": "customer"})
    contact = resp.get("contact") or {}
    created = (contact.get("contact_id") or "").strip()
    if not created:
        raise ZohoAPIException(str(resp))
    _CONTACT_ID_CACHE[sk] = created
    return created
