"""Phase 308-01 — is migration 225 live in the LOCAL database? SELECT-only.

Run with the backend venv from the repo root:

    backend/venv/Scripts/python scripts/check-migration-225-live.py

Opens ONE asyncpg connection to ``settings.postgres_dsn`` (the backend's local DB URL), runs
read-only catalog checks, prints ``225 live`` and exits 0 — or names each missing item and exits 1.
Exit 2 means the database could not be reached or refused the connection (any
``asyncpg.PostgresError``, e.g. a wrong password) — a harness error, never a pass.

What it checks: the four webhook tables with their columns, RLS on, NO policy, no privilege for
anon / authenticated and every privilege for service_role (D-32); both emit functions exist,
definer-rights with an empty search_path, and nobody but service_role may EXECUTE them (PUBLIC
included); the three emit triggers; the two duplicate walls (D-07); notifications.run_id nullable,
endpoint_id with its ON DELETE CASCADE foreign key, the widened kind / closed_reason CHECKs and the
shape CHECK (D-48); the nine webhook.endpoint.* literals in the audit CHECK (D-31).

It applies nothing. Migration 225 is applied by pasting it into the Supabase SQL editor (CLAUDE.md);
this script only confirms the paste took. ⛔ It never switches role: every privilege fact is a
catalog function called as the connecting role (BUG-261031-01).
"""

from __future__ import annotations

import asyncio
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))

TABLE_COLUMNS = {
    "webhook_endpoints": (
        "id", "user_id", "org_id", "url", "description", "event_types", "enabled", "disabled_reason",
        "disabled_at", "secret_ciphertext", "previous_secret_ciphertext", "previous_secret_expires_at",
        "consecutive_failures", "last_success_at", "created_at", "updated_at",
    ),
    "webhook_events": (
        "id", "type", "org_id", "item_id", "owner_id", "status", "origin_kind", "definition_id",
        "folder_id", "endpoint_id", "payload", "fanned_out_at", "created_at",
    ),
    "webhook_deliveries": (
        "id", "endpoint_id", "event_id", "status", "reason", "attempts", "next_attempt_at",
        "claimed_at", "last_status_code", "last_latency_ms", "last_error", "last_attempt_at",
        "sent_at", "created_at", "updated_at",
    ),
    "webhook_delivery_attempts": (
        "id", "delivery_id", "attempt", "status_code", "latency_ms", "error", "created_at",
    ),
}
FUNCTIONS = ("public.webhook_emit_run_event()", "public.webhook_emit_document_event()")
TRIGGERS = (
    ("workflow_runs_webhook_emit", "public.workflow_runs"),
    ("documents_webhook_emit_insert", "public.documents"),
    ("documents_webhook_emit_update", "public.documents"),
)
INDEXES = (
    "webhook_events_run_finished_once",
    "webhook_deliveries_endpoint_event_uq",
    "notifications_one_open_per_endpoint",
)
CLIENT_ROLES = ("anon", "authenticated")
FUNCTION_CLIENT_ROLES = ("public", "anon", "authenticated")
TABLE_PRIVS = ("SELECT", "INSERT", "UPDATE", "DELETE")
AUDIT_LITERALS = tuple(
    f"webhook.endpoint.{v}"
    for v in ("created", "updated", "deleted", "enabled", "disabled",
              "secret_rolled", "test_sent", "delivery_resent", "auto_disabled")
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
                    f"SELECT has_table_privilege($1, 'public.{table}', $2)", "service_role", priv
                ):
                    missing.append(f"service_role lacks {priv} on public.{table}")

        for fn in FUNCTIONS:
            if not await conn.fetchval("SELECT to_regprocedure($1) IS NOT NULL", fn):
                missing.append(f"function {fn}")
                continue
            for role in FUNCTION_CLIENT_ROLES:
                if await conn.fetchval(
                    "SELECT has_function_privilege($1, $2::regprocedure, 'EXECUTE')", role, fn
                ):
                    missing.append(f"{role} may EXECUTE {fn} (revoke FROM PUBLIC first)")
            if not await conn.fetchval("SELECT prosecdef FROM pg_proc WHERE oid = $1::regprocedure", fn):
                missing.append(f"{fn} must be SECURITY DEFINER")
            config = await conn.fetchval("SELECT proconfig FROM pg_proc WHERE oid = $1::regprocedure", fn) or []
            if not any(c.replace('"', "").replace("'", "") == "search_path=" for c in config):
                missing.append(f"{fn} must SET search_path = ''")

        for name, table in TRIGGERS:
            if await conn.fetchval(
                "SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname = $1 "
                "AND tgrelid = $2::regclass",
                name, table,
            ) != 1:
                missing.append(f"trigger {name} on {table}")

        for idx in INDEXES:
            if not await conn.fetchval(
                "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1)",
                idx,
            ):
                missing.append(f"unique index {idx}")

        if await conn.fetchval(
            "SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' "
            "AND table_name = 'notifications' AND column_name = 'run_id'"
        ) != "YES":
            missing.append("notifications.run_id must be nullable")
        if await conn.fetchval(
            "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' "
            "AND table_name = 'notifications' AND column_name = 'endpoint_id'"
        ) != 1:
            missing.append("notifications.endpoint_id column")
        else:
            fk = await conn.fetchval(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = "
                "'public.notifications'::regclass AND contype = 'f' "
                "AND pg_get_constraintdef(oid) LIKE '%webhook_endpoints%'"
            ) or ""
            if "ON DELETE CASCADE" not in fk:
                missing.append("notifications.endpoint_id FK to webhook_endpoints ON DELETE CASCADE")

        def_of = lambda name: conn.fetchval(  # noqa: E731
            "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = $1", name
        )
        if "webhook_disabled" not in (await def_of("notifications_kind_check") or ""):
            missing.append("notifications_kind_check allows webhook_disabled")
        if "endpoint_enabled" not in (await def_of("notifications_closed_reason_check") or ""):
            missing.append("notifications_closed_reason_check allows endpoint_enabled")
        if not await def_of("notifications_kind_shape_check"):
            missing.append("CHECK notifications_kind_shape_check")
        audit = await def_of("audit_log_action_type_check") or ""
        for literal in AUDIT_LITERALS:
            if f"'{literal}'" not in audit:
                missing.append(f"audit_log_action_type_check literal {literal}")
    finally:
        await conn.close()
    return missing


def main() -> int:
    import asyncpg

    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # pragma: no cover
        pass
    try:
        missing = asyncio.run(_check())
    except (OSError, ConnectionError, asyncpg.PostgresError, asyncpg.InterfaceError) as exc:
        # a refused login or a missing database is a harness error, never "migration missing"
        print(f"FATAL: could not reach or query the local database: {type(exc).__name__}: {exc}")
        return 2
    if missing:
        print("migration 225 is NOT live. Missing:")
        for item in missing:
            print(f"  - {item}")
        return 1
    print("225 live")
    return 0


if __name__ == "__main__":
    sys.exit(main())
