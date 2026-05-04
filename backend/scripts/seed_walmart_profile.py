"""POST /api/admin/seed-walmart-profile (avoids needing curl)."""

from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request


def main() -> None:
    base = os.environ.get("API_BASE", "http://127.0.0.1:8000").rstrip("/")
    url = f"{base}/api/admin/seed-walmart-profile"
    # `data` is required or some platforms treat the request as GET → 405 Method Not Allowed.
    req = urllib.request.Request(url, data=b"", method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            print(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(e.read().decode(), file=sys.stderr)
        raise SystemExit(1) from e
    except urllib.error.URLError as e:
        print(f"Request failed: {e}", file=sys.stderr)
        raise SystemExit(1) from e


if __name__ == "__main__":
    main()
