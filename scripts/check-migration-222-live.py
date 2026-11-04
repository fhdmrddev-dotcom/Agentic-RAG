"""Phase 305-01 — is migration 222 live in the LOCAL database? SELECT-only.

Run with the backend venv from the repo root:

    backend/venv/Scripts/python scripts/check-migration-222-live.py

Opens ONE asyncpg connection to ``settings.postgres_dsn`` (the backend's local DB URL), runs
read-only catalog checks, prints ``222 live`` and exits 0 — or names each missing item and
exits 1. Exit 2 means the database could not be reached (a harness error, never a pass).

It applies nothing. Migration 222 is applied by pasting it into the Supabase SQL editor
(CLAUDE.md); this script only confirms the paste took. ⛔ It never switches role: every privilege
fact is a catalog function called as the connecting role (BUG-261031-01).
"""

from __future__ import annotations

import asyncio
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))

MCP_USAGE_COLUMNS = (
    "id", "org_id", "user_id", "api_key_id", "tool", "model", "provider",
    "input_tokens", "output_tokens", "status", "started_at",
)
CLIENT_ROLES = ("anon", "authenticated")
TABLE_PRIVS = ("SELECT", "INSERT", "UPDATE", "DELETE")


async def _check() -> list[str]:
    import os

    import asyncpg

    # Settings reads backend/.env relative to the working directory, as uvicorn does.
    os.chdir(REPO_ROOT / "backend")
    from app.config import settings

    conn = await asyncpg.connect(settings.postgres_dsn)
    missing: list[str] = []
    try:
        if not await conn.fetchval("SELECT to_regclass('public.mcp_usage') IS NOT NULL"):
            return ["public.mcp_usage table"]
        cols = {
            r["column_name"]
            for r in await conn.fetch(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = 'mcp_usage'"
            )
        }
        for col in MCP_USAGE_COLUMNS:
            if col not in cols:
                missing.append(f"mcp_usage.{col} column")
        if not await conn.fetchval(
            "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.mcp_usage'::regclass"
        ):
            missing.append("RLS on public.mcp_usage")
        if await conn.fetchval(
            "SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mcp_usage'"
        ):
            missing.append("mcp_usage must carry NO policy (deny-all)")
        for role in CLIENT_ROLES:
            for priv in TABLE_PRIVS:
                if await conn.fetchval(
                    "SELECT has_table_privilege($1, 'public.mcp_usage', $2)", role, priv
                ):
                    missing.append(f"{role} holds {priv} on public.mcp_usage")
        for priv in TABLE_PRIVS:
            if not await conn.fetchval(
                "SELECT has_table_privilege('service_role', 'public.mcp_usage', $1)", priv
            ):
                missing.append(f"service_role lacks {priv} on public.mcp_usage")
        if not await conn.fetchval(
            "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' "
            "AND tablename = 'mcp_usage' AND indexdef LIKE '%(org_id, started_at)%')"
        ):
            missing.append("index on mcp_usage (org_id, started_at)")
        fk = await conn.fetchval(
            "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = "
            "'public.mcp_usage'::regclass AND contype = 'f' AND pg_get_constraintdef(oid) LIKE '%api_keys%'"
        ) or ""
        if "ON DELETE SET NULL" not in fk:
            missing.append("mcp_usage.api_key_id FK to api_keys ON DELETE SET NULL")

        knob = await conn.fetchrow(
            "SELECT data_type, is_nullable, column_default FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'app_settings' "
            "AND column_name = 'api_key_searches_per_minute'"
        )
        if knob is None:
            missing.append("app_settings.api_key_searches_per_minute column")
        elif not (knob["data_type"] == "integer" and knob["is_nullable"] == "NO"
                  and (knob["column_default"] or "").strip() == "30"):
            missing.append(f"api_key_searches_per_minute is not integer NOT NULL DEFAULT 30 ({dict(knob)})")
        bound = await conn.fetchval(
            "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
            "WHERE conname = 'app_settings_api_key_searches_per_minute_bound'"
        ) or ""
        if not (">= 1" in bound and "<= 120" in bound):
            missing.append("CHECK app_settings_api_key_searches_per_minute_bound (1..120)")

        col = await conn.fetchrow(
            "SELECT data_type, is_nullable, column_default FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'organizations' "
            "AND column_name = 'pii_redaction_enabled'"
        )
        if col is None:
            missing.append("organizations.pii_redaction_enabled column")
        elif not (col["data_type"] == "boolean" and col["is_nullable"] == "NO"
                  and (col["column_default"] or "").strip() == "false"):
            missing.append(f"pii_redaction_enabled is not boolean NOT NULL DEFAULT false ({dict(col)})")
        else:
            for role in CLIENT_ROLES:
                if await conn.fetchval(
                    "SELECT has_column_privilege($1, 'public.organizations', "
                    "'pii_redaction_enabled', 'UPDATE')",
                    role,
                ):
                    missing.append(f"{role} may UPDATE organizations.pii_redaction_enabled (D-56)")
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
        print("migration 222 is NOT live. Missing:")
        for item in missing:
            print(f"  - {item}")
        return 1
    print("222 live")
    return 0


if __name__ == "__main__":
    sys.exit(main())
