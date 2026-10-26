"""Phase 296-01 — is migration 216 live in the LOCAL database? SELECT-only.

Run with the backend venv from the repo root:

    backend/venv/Scripts/python scripts/check-migration-216-live.py

Opens ONE asyncpg connection to ``settings.postgres_dsn`` (the backend's local DB URL), refuses any
host other than 127.0.0.1 / localhost, reads ``pg_get_functiondef`` of ``public.handle_new_user()``,
prints ``216 live`` and exits 0 when the body names the org ``My organization`` and no longer reads
``new.email`` — or names what is missing and exits 1. Exit 2 means the database could not be reached
(a harness error, never a pass).

It applies nothing. Migration 216 is applied by pasting it into the Supabase SQL editor
(CLAUDE.md); this script only confirms the paste took.
"""

from __future__ import annotations

import asyncio
import pathlib
import sys
from urllib.parse import urlparse

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))

LOCAL_HOSTS = {"127.0.0.1", "localhost"}


async def _check() -> list[str]:
    import os

    import asyncpg

    # Settings reads backend/.env relative to the working directory, as uvicorn does.
    os.chdir(REPO_ROOT / "backend")
    from app.config import settings

    host = urlparse(settings.postgres_dsn).hostname or ""
    if host not in LOCAL_HOSTS:
        raise SystemExit(f"FATAL: refusing a non-local DSN host {host!r} (this check is LOCAL only)")

    conn = await asyncpg.connect(settings.postgres_dsn)
    missing: list[str] = []
    try:
        definition = await conn.fetchval(
            "SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure)"
        ) or ""
    finally:
        await conn.close()
    if "My organization" not in definition:
        missing.append("handle_new_user does not name the org 'My organization'")
    if "new.email" in definition.lower():
        missing.append("handle_new_user still reads new.email")
    return missing


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # pragma: no cover
        pass
    try:
        missing = asyncio.run(_check())
    except (OSError, ConnectionError) as exc:
        print(f"FATAL: could not reach the local database: {type(exc).__name__}: {exc}")
        return 2
    if missing:
        print("migration 216 is NOT live. Missing:")
        for item in missing:
            print(f"  - {item}")
        return 1
    print("216 live")
    return 0


if __name__ == "__main__":
    sys.exit(main())
