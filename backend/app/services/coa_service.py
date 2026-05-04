"""Chart of accounts cache (1h) — live Zoho or dev fallback."""

from __future__ import annotations

import time

from app.core.config import get_settings
from app.core.exceptions import ZohoAPIException
from app.zoho import client as zoho_client

_coa_cache: tuple[float, list[dict]] = (0.0, [])
_TTL = 3600.0


def clear_chart_of_accounts_cache() -> None:
    global _coa_cache
    _coa_cache = (0.0, [])


def fetch_chart_of_accounts_cached() -> list[dict]:
    global _coa_cache
    now = time.time()
    if _coa_cache[1] and now < _coa_cache[0]:
        return _coa_cache[1]
    s = get_settings()
    has_access_token = bool((s.zoho_access_token or "").strip())
    has_refresh = bool(
        (s.zoho_refresh_token or "").strip()
        and (s.zoho_client_id or "").strip()
        and (s.zoho_client_secret or "").strip()
    )
    if not has_access_token:
        if has_refresh:
            try:
                zoho_client.refresh_access_token()
            except ZohoAPIException:
                pass
        else:
            fallback = [
                {"account_id": "demo_sales", "account_name": "Sales", "account_type": "income"},
                {"account_id": "demo_expense", "account_name": "Marketplace Fees", "account_type": "expense"},
                {"account_id": "demo_tax", "account_name": "Sales Tax", "account_type": "sales"},
            ]
            _coa_cache = (now + _TTL, fallback)
            return fallback
    out: list[dict] = []
    page = 1
    per_page = 200
    while True:
        try:
            data = zoho_client.zoho_get(
                "chartofaccounts",
                {"page": page, "per_page": per_page},
            )
        except ZohoAPIException:
            _coa_cache = (now + 120.0, out or _coa_cache[1])
            return out or (_coa_cache[1] if _coa_cache[1] else [])
        chunk = data.get("chartofaccounts") or []
        for a in chunk:
            out.append(
                {
                    "account_id": a.get("account_id") or "",
                    "account_name": (a.get("account_name") or "").strip(),
                    "account_type": (a.get("account_type") or "").strip(),
                }
            )
        if len(chunk) < per_page:
            break
        page += 1
        if page > 50:
            break
    _coa_cache = (now + _TTL, out)
    return out
