"""One-off: copy Zoho Books credentials from Books_by_Rudra .env into this backend/.env."""

from __future__ import annotations

import re
from pathlib import Path


def parse_env(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, rest = line.partition("=")
        k = k.strip()
        v = rest.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        out[k] = v
    return out


def main() -> None:
    rudra_path = Path(r"D:\ROCRE\softwares\Books_by_Rudra\.env")
    out_path = Path(__file__).resolve().parent.parent / ".env"
    data = parse_env(rudra_path.read_text(encoding="utf-8"))

    def pick(intl: str, primary: str) -> str:
        v = data.get(intl, "").strip()
        if v and not v.startswith("your_"):
            return v
        return data.get(primary, "").strip()

    cid = pick("ZOHO_INTL_CLIENT_ID", "ZOHO_CLIENT_ID")
    sec = pick("ZOHO_INTL_CLIENT_SECRET", "ZOHO_CLIENT_SECRET")
    rt = pick("ZOHO_INTL_REFRESH_TOKEN", "ZOHO_REFRESH_TOKEN")
    org = pick("ZOHO_INTL_ORGANIZATION_ID", "ZOHO_ORGANIZATION_ID")
    base = (pick("ZOHO_INTL_BASE_URL", "") or "https://www.zohoapis.com/books/v3").strip()
    oauth = (pick("ZOHO_INTL_OAUTH_URL", "") or "https://accounts.zoho.com/oauth/v2/token").strip()

    clearing = data.get("ZOHO_WALMART_CLEARING_ACCOUNT_ID", "").strip()
    if not clearing:
        clearing = data.get("ZOHO_ONBUY_CLEARING_ACCOUNT_ID", "").strip()
    contact = data.get("ZOHO_WALMART_CONTACT_ID", "").strip()
    if not contact:
        contact = data.get("ZOHO_AMAZON_USA_CONTACT_ID_BOOKS", "").strip()

    text = f"""# Zoho: imported from Books_by_Rudra (ZOHO_INTL_* when set, else ZOHO_*)
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5433/zoho_mapping_studio
REDIS_URL=redis://localhost:6379/0

ZOHO_API_BASE={base}
ZOHO_OAUTH_URL={oauth}
ZOHO_ACCESS_TOKEN=
ZOHO_CLIENT_ID={cid}
ZOHO_CLIENT_SECRET={sec}
ZOHO_REFRESH_TOKEN={rt}
ZOHO_ORGANIZATION_ID={org}
ZOHO_DEFAULT_CONTACT_ID={contact}
ZOHO_CLEARING_ACCOUNT_ID={clearing}
"""
    out_path.write_text(text, encoding="utf-8")
    print(f"Wrote {out_path} (org={bool(org)}, client_id={bool(cid)}, clearing={bool(clearing)}, contact={bool(contact)})")


if __name__ == "__main__":
    main()
