"""Phase 304-01 — is migration 221 live in the LOCAL database? SELECT-only.

Run with the backend venv from the repo root:

    backend/venv/Scripts/python scripts/check-migration-221-live.py

Opens ONE asyncpg connection to ``settings.postgres_dsn`` (the backend's local DB URL), runs
read-only catalog checks, prints ``221 live`` and exits 0 — or names each missing item and
exits 1. Exit 2 means the database could not be reached (a harness error, never a pass).

It applies nothing. Migration 221 is applied by pasting it into the Supabase SQL editor
(CLAUDE.md); this script only confirms the paste took.
"""

from __future__ import annotations

import asyncio
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))

ORG_IDS_FN = "public.current_user_org_ids()"
PERM_FN = "public.current_user_has_permission(uuid, text)"
ROUTED_POLICIES = (
    "expert_bundles_read_policy",
    "expert_bundles_write_policy",
    "expert_grants_read_policy",
    "expert_grants_write_policy",
    "model_rates_select_policy",
    "model_rates_insert_policy",
)
#: Measured with pg_proc before 221 was written: the function relies on the default ROWS / COST.
EXPECTED_ROWS = 1000.0
EXPECTED_COST = 100.0
ORG_PRIVS = ("DELETE", "TRUNCATE", "TRIGGER", "REFERENCES")


async def _check() -> list[str]:
    import os

    import asyncpg

    # Settings reads backend/.env relative to the working directory, as uvicorn does.
    os.chdir(REPO_ROOT / "backend")
    from app.config import settings

    conn = await asyncpg.connect(settings.postgres_dsn)
    missing: list[str] = []
    try:
        body = await conn.fetchval("SELECT pg_get_functiondef($1::regprocedure)", ORG_IDS_FN) or ""
        if "app.acting_org_id" not in body:
            missing.append("current_user_org_ids() does not read app.acting_org_id")
        attrs = await conn.fetchrow(
            "SELECT provolatile, prosecdef, prorows, procost, proconfig, l.lanname "
            "FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang WHERE p.oid = $1::regprocedure",
            ORG_IDS_FN,
        )
        # asyncpg returns the "char" column as bytes.
        if attrs["provolatile"] not in (b"s", "s"):
            missing.append(f"current_user_org_ids() volatility is {attrs['provolatile']!r}, not STABLE")
        if not attrs["prosecdef"]:
            missing.append("current_user_org_ids() is not SECURITY DEFINER")
        if float(attrs["prorows"]) != EXPECTED_ROWS:
            missing.append(f"current_user_org_ids() ROWS is {attrs['prorows']}, not {EXPECTED_ROWS}")
        if float(attrs["procost"]) != EXPECTED_COST:
            missing.append(f"current_user_org_ids() COST is {attrs['procost']}, not {EXPECTED_COST}")
        if not any("search_path" in c for c in (attrs["proconfig"] or [])):
            missing.append("current_user_org_ids() lost its SET search_path")
        if attrs["lanname"] != "sql":
            missing.append(f"current_user_org_ids() language is {attrs['lanname']}, not sql")

        perm = await conn.fetchval("SELECT pg_get_functiondef($1::regprocedure)", PERM_FN) or ""
        if "current_user_org_ids" not in perm:
            missing.append("current_user_has_permission does not route through current_user_org_ids()")

        rows = await conn.fetch(
            "SELECT policyname, coalesce(qual, '') AS q, coalesce(with_check, '') AS w "
            "FROM pg_policies WHERE schemaname = 'public' AND policyname = ANY($1::text[])",
            list(ROUTED_POLICIES),
        )
        seen = {r["policyname"]: (r["q"], r["w"]) for r in rows}
        for name in ROUTED_POLICIES:
            if name not in seen:
                missing.append(f"policy {name}")
                continue
            text = seen[name][0] + " " + seen[name][1]
            if "current_user_org_ids" not in text:
                missing.append(f"policy {name} does not use current_user_org_ids()")
            allowed = 1 if name == "model_rates_insert_policy" else 0
            if text.count("org_members") != allowed:
                missing.append(f"policy {name} reads org_members directly ({text.count('org_members')}x)")

        for fn in (ORG_IDS_FN, PERM_FN):
            if await conn.fetchval("SELECT has_function_privilege('anon', $1, 'EXECUTE')", fn):
                missing.append(f"anon can EXECUTE {fn}")
            if await conn.fetchval("SELECT has_function_privilege('public', $1, 'EXECUTE')", fn):
                missing.append(f"PUBLIC can EXECUTE {fn}")

        for role in ("anon", "authenticated"):
            for priv in ORG_PRIVS:
                if await conn.fetchval(
                    "SELECT has_table_privilege($1, 'public.organizations', $2)", role, priv
                ):
                    missing.append(f"{role} holds {priv} on public.organizations (D-42)")
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
        print("migration 221 is NOT live. Missing:")
        for item in missing:
            print(f"  - {item}")
        return 1
    print("221 live")
    return 0


if __name__ == "__main__":
    sys.exit(main())
