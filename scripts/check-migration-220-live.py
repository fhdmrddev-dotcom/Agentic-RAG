"""Phase 304-01 — is migration 220 live in the LOCAL database? SELECT-only.

Run with the backend venv from the repo root:

    backend/venv/Scripts/python scripts/check-migration-220-live.py

Opens ONE asyncpg connection to ``settings.postgres_dsn`` (the backend's local DB URL), runs
read-only catalog checks, prints ``220 live`` and exits 0 — or names each missing item and
exits 1. Exit 2 means the database could not be reached (a harness error, never a pass).

It applies nothing. Migration 220 is applied by pasting it into the Supabase SQL editor
(CLAUDE.md); this script only confirms the paste took.
"""

from __future__ import annotations

import asyncio
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))

CHECKS_304 = (
    "api_keys_kind_check",
    "api_keys_mcp_expiry_check",
    "api_keys_folder_ids_check",
    "api_keys_tools_check",
    "api_keys_scope_kind_check",
)
ALL_COLUMNS = (
    "id", "org_id", "user_id", "label", "key_prefix", "key_hash", "workflows", "expires_at",
    "revoked_at", "revoked_by", "last_used_at", "created_at",
    "kind", "folder_ids", "tools", "include_external",
)
NEW_COLUMNS = ("kind", "folder_ids", "tools", "include_external")


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
                "WHERE table_schema = 'public' AND table_name = 'api_keys'"
            )
        }
        for col in NEW_COLUMNS:
            if col not in cols:
                missing.append(f"api_keys.{col} column")
        if missing:
            return missing

        names = {
            r["conname"]
            for r in await conn.fetch(
                "SELECT conname FROM pg_constraint WHERE conrelid = 'public.api_keys'::regclass"
            )
        }
        for name in CHECKS_304:
            if name not in names:
                missing.append(f"CHECK {name}")
        wf = await conn.fetchval(
            "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
            "WHERE conrelid = 'public.api_keys'::regclass AND conname = 'api_keys_workflows_check'"
        ) or ""
        if "kind" not in wf:
            missing.append("api_keys_workflows_check is not kind-conditional (D-05)")

        for col in ALL_COLUMNS:
            if await conn.fetchval(
                "SELECT has_column_privilege('anon', 'public.api_keys', $1, 'SELECT')", col
            ):
                missing.append(f"anon can SELECT api_keys.{col}")
        if await conn.fetchval(
            "SELECT has_column_privilege('authenticated', 'public.api_keys', 'key_hash', 'SELECT')"
        ):
            missing.append("authenticated can SELECT api_keys.key_hash")
        for col in NEW_COLUMNS:
            if not await conn.fetchval(
                "SELECT has_column_privilege('authenticated', 'public.api_keys', $1, 'SELECT')", col
            ):
                missing.append(f"authenticated cannot SELECT api_keys.{col}")

        for table in ("app_settings", "organizations"):
            row = await conn.fetchrow(
                "SELECT data_type, is_nullable, column_default FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'mcp_enabled'",
                table,
            )
            if row is None:
                missing.append(f"{table}.mcp_enabled column")
            elif not (
                row["data_type"] == "boolean"
                and row["is_nullable"] == "NO"
                and (row["column_default"] or "").strip() == "true"
            ):
                missing.append(f"{table}.mcp_enabled is not boolean NOT NULL DEFAULT true ({dict(row)})")
        if await conn.fetchval(
            "SELECT has_column_privilege('authenticated', 'public.organizations', 'mcp_enabled', 'UPDATE')"
        ):
            missing.append("authenticated may write organizations.mcp_enabled (D-35)")

        origin = await conn.fetchval(
            "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
            "WHERE conname = 'workflow_runs_origin_kind_check'"
        ) or ""
        if "'mcp'" not in origin:
            missing.append("'mcp' in workflow_runs_origin_kind_check")
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
        print("migration 220 is NOT live. Missing:")
        for item in missing:
            print(f"  - {item}")
        return 1
    print("220 live")
    return 0


if __name__ == "__main__":
    sys.exit(main())
