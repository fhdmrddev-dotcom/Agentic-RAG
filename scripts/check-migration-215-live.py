"""Phase 293-01 — is migration 215 live in the LOCAL database? SELECT-only.

Run with the backend venv from the repo root:

    backend/venv/Scripts/python scripts/check-migration-215-live.py

Opens ONE asyncpg connection to ``settings.postgres_dsn`` (the backend's local DB URL), runs
read-only catalog checks, prints ``215 live`` and exits 0 — or names each missing item and
exits 1. Exit 2 means the database could not be reached (a harness error, never a pass).

It applies nothing. Migration 215 is applied by pasting it into the Supabase SQL editor
(CLAUDE.md); this script only confirms the paste took.
"""

from __future__ import annotations

import asyncio
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))

API_KEY_ACTIONS = (
    "api_key.create",
    "api_key.revoke",
    "api_key.start",
    "api_key.read",
    "api_key.refused",
)


async def _check() -> list[str]:
    import os

    import asyncpg

    # Settings reads backend/.env relative to the working directory, as uvicorn does.
    os.chdir(REPO_ROOT / "backend")
    from app.config import settings

    conn = await asyncpg.connect(settings.postgres_dsn)
    missing: list[str] = []
    try:
        cols = {
            r["column_name"]
            for r in await conn.fetch(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = 'workflow_runs' "
                "AND column_name LIKE 'origin_%'"
            )
        }
        for col in ("origin_kind", "origin_label", "origin_ref"):
            if col not in cols:
                missing.append(f"workflow_runs.{col} column")

        if await conn.fetchval("SELECT to_regclass('public.api_keys')") is None:
            missing.append("public.api_keys table")

        for trigger in ("workflow_runs_origin_immutable", "workflow_runs_origin_client_insert"):
            present = await conn.fetchval(
                "SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = $1 "
                "AND tgrelid = 'public.workflow_runs'::regclass AND NOT tgisinternal)",
                trigger,
            )
            if not present:
                missing.append(f"trigger {trigger}")

        definition = await conn.fetchval(
            "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
            "WHERE conname = 'audit_log_action_type_check'"
        ) or ""
        for action in API_KEY_ACTIONS:
            if f"'{action}'" not in definition:
                missing.append(f"audit CHECK literal {action}")

        settings_cols = {
            r["column_name"]
            for r in await conn.fetch(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = 'app_settings' "
                "AND column_name LIKE 'api_key_%'"
            )
        }
        for col in ("api_key_starts_per_minute", "api_key_reads_per_minute"):
            if col not in settings_cols:
                missing.append(f"app_settings.{col} column")
    finally:
        await conn.close()
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
        print("migration 215 is NOT live. Missing:")
        for item in missing:
            print(f"  - {item}")
        return 1
    print("215 live")
    return 0


if __name__ == "__main__":
    sys.exit(main())
