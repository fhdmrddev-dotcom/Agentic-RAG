"""Phase 307-01 — is migration 224 live in the LOCAL database? SELECT-only.

Run with the backend venv from the repo root:

    backend/venv/Scripts/python scripts/check-migration-224-live.py

Opens ONE asyncpg connection to ``settings.postgres_dsn`` (the backend's local DB URL), runs
read-only catalog checks, prints ``224 live`` and exits 0 — or names each missing item and
exits 1. Exit 2 means the database could not be reached (a harness error, never a pass).

It applies nothing. Migration 224 is applied by pasting it into the Supabase SQL editor
(CLAUDE.md); this script only confirms the paste took. ⛔ It never switches role: every privilege
fact is a catalog function called as the connecting role (BUG-261031-01).
"""

from __future__ import annotations

import asyncio
import json
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))

TABLE_COLUMNS = {
    "oauth_clients": (
        "id", "client_id", "kind", "client_name", "client_uri", "redirect_uris",
        "metadata_fetched_at", "metadata_expires_at", "created_at", "last_grant_at",
    ),
    "oauth_tokens": (
        "id", "grant_id", "kind", "token_hash", "resource", "expires_at", "created_at",
        "used_at", "replaced_by", "revoked_at",
    ),
}
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
        for table, columns in TABLE_COLUMNS.items():
            if not await conn.fetchval(f"SELECT to_regclass('public.{table}') IS NOT NULL"):
                missing.append(f"public.{table} table")
                continue
            cols = {
                r["column_name"]
                for r in await conn.fetch(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = $1",
                    table,
                )
            }
            for col in columns:
                if col not in cols:
                    missing.append(f"{table}.{col} column")
            if not await conn.fetchval(
                f"SELECT relrowsecurity FROM pg_class WHERE oid = 'public.{table}'::regclass"
            ):
                missing.append(f"RLS on public.{table}")
            if await conn.fetchval(
                "SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = $1",
                table,
            ):
                missing.append(f"{table} must carry NO policy (deny-all)")
            for role in CLIENT_ROLES:
                for priv in TABLE_PRIVS:
                    if await conn.fetchval(
                        f"SELECT has_table_privilege($1, 'public.{table}', $2)", role, priv
                    ):
                        missing.append(f"{role} holds {priv} on public.{table}")
            for priv in TABLE_PRIVS:
                if not await conn.fetchval(
                    f"SELECT has_table_privilege('service_role', 'public.{table}', $1)", priv
                ):
                    missing.append(f"service_role lacks {priv} on public.{table}")

        def_of = lambda name: conn.fetchval(  # noqa: E731
            "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = $1", name
        )

        if await conn.fetchval(
            "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' "
            "AND table_name = 'api_keys' AND column_name = 'oauth_client_id'"
        ) != 1:
            missing.append("api_keys.oauth_client_id column")
        else:
            for role in CLIENT_ROLES:
                if await conn.fetchval(
                    "SELECT has_column_privilege($1, 'public.api_keys', 'oauth_client_id', 'SELECT')",
                    role,
                ):
                    missing.append(f"{role} may SELECT api_keys.oauth_client_id (D-33)")
            fk = await conn.fetchval(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = "
                "'public.api_keys'::regclass AND contype = 'f' "
                "AND pg_get_constraintdef(oid) LIKE '%oauth_clients%'"
            ) or ""
            if "ON DELETE RESTRICT" not in fk:
                missing.append("api_keys.oauth_client_id FK to oauth_clients ON DELETE RESTRICT")
        kind_check = await def_of("api_keys_oauth_kind_check") or ""
        if "oauth_client_id IS NULL" not in kind_check or "'mcp'" not in kind_check:
            missing.append("CHECK api_keys_oauth_kind_check (oauth_client_id IS NULL OR kind = 'mcp')")

        label_idx = await conn.fetchval(
            "SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' "
            "AND indexname = 'api_keys_owner_label_active_uq'"
        ) or ""
        if "UNIQUE" not in label_idx or "oauth_client_id IS NULL" not in label_idx \
                or "revoked_at IS NULL" not in label_idx:
            missing.append("api_keys_owner_label_active_uq WHERE revoked_at IS NULL AND oauth_client_id IS NULL")
        org_idx = await conn.fetchval(
            "SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' "
            "AND indexname = 'api_keys_oauth_org_idx'"
        ) or ""
        if "oauth_client_id IS NOT NULL" not in org_idx:
            missing.append("api_keys_oauth_org_idx WHERE oauth_client_id IS NOT NULL")
        for idx in ("oauth_tokens_grant_idx", "oauth_tokens_replaced_by_idx"):
            if not await conn.fetchval(
                "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1)",
                idx,
            ):
                missing.append(f"index {idx}")
        for fk_like, rule in (("api_keys", "ON DELETE CASCADE"), ("oauth_tokens(id)", "ON DELETE SET NULL")):
            fk = await conn.fetchval(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = "
                "'public.oauth_tokens'::regclass AND contype = 'f' AND pg_get_constraintdef(oid) LIKE $1",
                f"%REFERENCES {fk_like}%",
            ) or ""
            if rule not in fk:
                missing.append(f"oauth_tokens FK to {fk_like} {rule}")

        col = await conn.fetchrow(
            "SELECT data_type, is_nullable, column_default FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'app_settings' "
            "AND column_name = 'mcp_oauth_redirect_hosts'"
        )
        if col is None:
            missing.append("app_settings.mcp_oauth_redirect_hosts column")
        elif not (col["data_type"] == "jsonb" and col["is_nullable"] == "NO"
                  and "claude.ai" in (col["column_default"] or "")
                  and "claude.com" in (col["column_default"] or "")):
            missing.append(f"mcp_oauth_redirect_hosts is not jsonb NOT NULL DEFAULT the two hosts ({dict(col)})")
        else:
            raw = await conn.fetchval(
                "SELECT mcp_oauth_redirect_hosts::text FROM public.app_settings WHERE id = 'global'"
            )
            if raw is None or not {"claude.ai", "claude.com"} <= {e.get("host") for e in json.loads(raw)}:
                missing.append("app_settings('global') does not read the two built-in hosts")
        arr = await def_of("app_settings_mcp_oauth_redirect_hosts_array") or ""
        if "jsonb_typeof" not in arr:
            missing.append("CHECK app_settings_mcp_oauth_redirect_hosts_array")
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
        print("migration 224 is NOT live. Missing:")
        for item in missing:
            print(f"  - {item}")
        return 1
    print("224 live")
    return 0


if __name__ == "__main__":
    sys.exit(main())
