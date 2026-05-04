"""Read/write key=value pairs in `backend/.env`."""

from __future__ import annotations

import re
from pathlib import Path

# Match KEY=VALUE (KEY is [A-Z0-9_]+)
_LINE_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$")


def project_root() -> Path:
    # backend/app/core/env_file.py → backend/
    return Path(__file__).resolve().parent.parent.parent


def env_path() -> Path:
    return project_root() / ".env"


def read_env_file(path: Path | None = None) -> dict[str, str]:
    p = path or env_path()
    out: dict[str, str] = {}
    if not p.is_file():
        return out
    for line in p.read_text(encoding="utf-8").splitlines():
        m = _LINE_RE.match(line.strip())
        if m:
            key, val = m.group(1), m.group(2)
            if val.startswith('"') and val.endswith('"'):
                val = val[1:-1].replace('\\"', '"')
            elif val.startswith("'") and val.endswith("'"):
                val = val[1:-1]
            out[key] = val
    return out


def _format_env_value(value: str) -> str:
    if any(c in value for c in ' "\n\\'):
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    return value


def upsert_env_vars(updates: dict[str, str], path: Path | None = None) -> None:
    """Create or update lines in `.env`. Only keys present in `updates` are written."""
    p = path or env_path()
    keys_set = set(updates.keys())
    lines: list[str] = []
    seen: set[str] = set()

    if p.is_file():
        for line in p.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            m = _LINE_RE.match(stripped) if stripped and not stripped.startswith("#") else None
            if m and m.group(1) in keys_set:
                k = m.group(1)
                lines.append(f"{k}={_format_env_value(updates[k])}")
                seen.add(k)
            else:
                lines.append(line)
    else:
        p.parent.mkdir(parents=True, exist_ok=True)

    for k in keys_set:
        if k not in seen:
            lines.append(f"{k}={_format_env_value(updates[k])}")

    p.write_text("\n".join(lines) + "\n", encoding="utf-8")
