"""Phase 306-01 — is migration 223 live in the LOCAL database? SELECT-only.

Run with the backend venv from the repo root:

    backend/venv/Scripts/python scripts/check-migration-223-live.py

Opens ONE asyncpg connection to ``settings.postgres_dsn`` (the backend's local DB URL), runs
read-only catalog checks, prints ``223 live`` and exits 0 — or names each missing item and
exits 1. Exit 2 means the database could not be reached (a harness error, never a pass).

It applies nothing. Migration 223 is applied by pasting it into the Supabase SQL editor
(CLAUDE.md); this script only confirms the paste took. ⛔ It never switches role: every privilege
fact is a catalog function called as the connecting role (BUG-261031-01).
"""

from __future__ import annotations

import asyncio
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))

ORIGIN_COLUMNS = {"origin_kind": "text", "origin_label": "text", "origin_ref": "uuid"}
ORIGIN_KINDS = ("app", "schedule", "key", "mcp")
TRIGGERS = ("threads_origin_freeze_update", "threads_origin_freeze_insert")
FN = "public.threads_origin_immutable()"
# column -> (default, low, high)
KNOBS = {
    "mcp_ask_wait_seconds": (30, 5, 45),
    "outside_inflight_per_key": (2, 1, 50),
    "outside_inflight_per_org": (4, 1, 50),
    "outside_inflight_per_provider": (6, 1, 50),
}


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
            r["column_name"]: r["data_type"]
            for r in await conn.fetch(
                "SELECT column_name, data_type FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = 'threads'"
            )
        }
        for col, typ in ORIGIN_COLUMNS.items():
            if cols.get(col) != typ:
                missing.append(f"threads.{col} {typ} column (found {cols.get(col)!r})")

        check = await conn.fetchval(
            "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
            "WHERE conrelid = 'public.threads'::regclass AND conname = 'threads_origin_kind_check'"
        ) or ""
        for kind in ORIGIN_KINDS:
            if f"'{kind}'" not in check:
                missing.append(f"threads_origin_kind_check naming '{kind}'")

        idx = await conn.fetchval(
            "SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' "
            "AND tablename = 'threads' AND indexname = 'threads_mcp_origin_ref_idx'"
        ) or ""
        if not ("(origin_ref)" in idx and "'mcp'" in idx):
            missing.append("partial index threads_mcp_origin_ref_idx ON threads (origin_ref) WHERE mcp")

        found = {
            r["tgname"]: r["def"]
            for r in await conn.fetch(
                "SELECT tgname, pg_get_triggerdef(oid) AS def FROM pg_trigger "
                "WHERE tgrelid = 'public.threads'::regclass AND NOT tgisinternal"
            )
        }
        for name, when in zip(TRIGGERS, ("BEFORE UPDATE", "BEFORE INSERT")):
            definition = found.get(name, "")
            if when not in definition or "threads_origin_immutable()" not in definition:
                missing.append(f"trigger {name} {when} ... EXECUTE FUNCTION {FN}")

        if await conn.fetchval("SELECT to_regprocedure($1) IS NULL", FN):
            missing.append(f"function {FN}")
        else:
            config = await conn.fetchval(
                "SELECT array_to_string(proconfig, ',') FROM pg_proc WHERE oid = to_regprocedure($1)", FN
            ) or ""
            if 'search_path=""' not in config and "search_path=''" not in config:
                missing.append(f"{FN} SET search_path = '' (found {config!r})")
            for role, expected in (("anon", False), ("authenticated", False), ("service_role", True)):
                if await conn.fetchval("SELECT has_function_privilege($1, $2, 'EXECUTE')", role, FN) \
                        is not expected:
                    missing.append(f"{role} EXECUTE on {FN} must be {expected}")

        for col, (default, low, high) in KNOBS.items():
            knob = await conn.fetchrow(
                "SELECT data_type, is_nullable, column_default FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = $1",
                col,
            )
            if knob is None:
                missing.append(f"app_settings.{col} column")
                continue
            if not (knob["data_type"] == "integer" and knob["is_nullable"] == "NO"
                    and (knob["column_default"] or "").strip() == str(default)):
                missing.append(f"{col} is not integer NOT NULL DEFAULT {default} ({dict(knob)})")
            bound = await conn.fetchval(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = $1",
                f"app_settings_{col}_bound",
            ) or ""
            if not (f">= {low}" in bound and f"<= {high}" in bound):
                missing.append(f"CHECK app_settings_{col}_bound ({low}..{high})")
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
        print("migration 223 is NOT live. Missing:")
        for item in missing:
            print(f"  - {item}")
        return 1
    print("223 live")
    return 0


if __name__ == "__main__":
    sys.exit(main())
