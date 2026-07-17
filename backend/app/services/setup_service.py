"""Phase 158 (DEPLOY-02, Plan 05) — the first-run setup-service logic layer.

The pure, unit-testable logic the token-gated ``/setup/*`` router (158-06) orchestrates.
Kept OUT of the router so it can be exercised without the ASGI stack. Everything here
composes shipped seams (RESEARCH "Key insight" — the wizard is ~90% orchestration):

* **Submitted-value probes** (D-10 / T-158-03 SSRF) — validate the values the operator
  TYPED via THROWAWAY connections (``asyncpg.connect`` / ``redis.asyncio.from_url`` /
  ``create_client``), NEVER the app connection singletons (which stay bound to placeholder
  config until restart). On ANY failure a probe returns ONLY ``type(exc).__name__`` — never
  the raw connection error, DSN, or host (SSRF telemetry hygiene). Every probe is bounded.
* **Light env-detect** (D-08) — a few cheap booleans to pre-fill defaults, not auto-discovery.
* **Operator bootstrap** (D-11) — create the first CONFIRMED auth user via the service-role
  Auth admin API (``run_in_threadpool`` — supabase-py is blocking, D-v2.5-01), then upsert
  ``operator_users`` with the idempotent ``ON CONFLICT (user_id) DO NOTHING`` shape reused
  from ``operator_service``. Ordering is LOAD-BEARING: schema bootstrap runs BEFORE this (the
  ``on_auth_user_created`` trigger needs its tables — RESEARCH Pitfall 6).
* **Provider-key save** (D-12) — funnels through the existing ``save_app_settings`` seam so
  the encrypt-on-write (Phase-150 ``SECRET_COLUMNS``) is inherited for free — NEVER a second
  encrypt path.
* **5-way smoke checklist** (D-13) — Supabase auth / Postgres+schema / Redis PING / provider
  key / operator row; a row is green ONLY on server truth, never optimistically.
* **Schema-bootstrap auto-runner** (D-10 / D-18 SHOULD) — schema-absent-gated,
  ``conn.transaction()``-wrapped (all-or-nothing), guide-fallback on a privilege error.

CLAUDE.md D-v2.5-01: the blocking supabase-py calls are wrapped in ``run_in_threadpool`` so
they never stall the event loop under ``WORKER_COUNT=2``.
"""
from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any

import asyncpg
import redis.asyncio as aioredis
from fastapi.concurrency import run_in_threadpool
from supabase import create_client  # module-level so tests can monkeypatch the boundary

from app.config import settings

logger = logging.getLogger(__name__)

# Bound every submitted-value probe so one unreachable operator-supplied host can't stall the
# wizard (RESEARCH Pattern 5 — a 3s ceiling; the write path is token-gated at the router).
_PROBE_TIMEOUT_S = 3.0

# Duplicate-user markers GoTrue surfaces on a re-run (idempotency, RESEARCH Pattern 6 Pitfall 1).
_DUP_MARKERS = (
    "already registered",
    "already been registered",
    "already exists",
    "user_already_exists",
    "email_exists",
    "email address has already",
)


# ── Task 1: submitted-value probes (throwaway, sanitized) + light env-detect ───────────────

async def probe_submitted_postgres(dsn: str) -> dict:
    """Validate a SUBMITTED Postgres DSN via a THROWAWAY connection (never the app pool).

    Reachable → ``{"state":"up", "schema_present": <bool>}`` where ``schema_present`` is the
    ``to_regclass('public.app_settings')`` sentinel (returns NULL for a missing relation
    instead of raising — one round-trip tells present-vs-absent). Unreachable / bad DSN →
    ``{"state":"down", "reason": type(exc).__name__}`` — a SANITIZED bare class name only; the
    raw error and the submitted host are NEVER reflected (T-158-03 SSRF telemetry).
    """
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=_PROBE_TIMEOUT_S)
    except Exception as exc:  # noqa: BLE001 — sanitized: class name only, never the host/DSN
        logger.warning("setup probe: submitted Postgres unreachable (%s)", type(exc).__name__)
        return {"state": "down", "reason": type(exc).__name__}
    try:
        present = await conn.fetchval(
            "SELECT to_regclass('public.app_settings') IS NOT NULL"
        )
        return {"state": "up", "schema_present": bool(present)}
    except Exception as exc:  # noqa: BLE001 — sanitized reason, no raw error/host leak
        logger.warning("setup probe: submitted Postgres query failed (%s)", type(exc).__name__)
        return {"state": "down", "reason": type(exc).__name__}
    finally:
        try:
            await conn.close()
        except Exception:  # noqa: BLE001 — best-effort close; a throwaway conn is disposable
            pass


async def probe_submitted_redis(url: str) -> dict:
    """Validate a SUBMITTED Redis URL via a THROWAWAY client PING (bounded).

    PING within the timeout → ``{"state":"up"}``; else ``{"state":"down", "reason":
    type(exc).__name__}`` — the sanitized bare class name only (no host leak, T-158-03).
    """
    client = None
    try:
        # WR-03: from_url parses the URL EAGERLY and raises (ValueError) on a bad scheme or an
        # empty string, so it MUST be inside the try — otherwise a malformed redis_url raises
        # uncaught and 500s /validate + /detect instead of returning the sanitized down state
        # the docstring promises (and detect_environment is documented as never-raising).
        client = aioredis.from_url(url, socket_connect_timeout=_PROBE_TIMEOUT_S)
        await asyncio.wait_for(client.ping(), timeout=_PROBE_TIMEOUT_S)
        return {"state": "up"}
    except Exception as exc:  # noqa: BLE001 — sanitized reason, never the raw error/host
        logger.warning("setup probe: submitted Redis unreachable (%s)", type(exc).__name__)
        return {"state": "down", "reason": type(exc).__name__}
    finally:
        # The client may be unbound if from_url raised — guard the close.
        if client is not None:
            try:
                await client.aclose()
            except Exception:  # noqa: BLE001 — best-effort close of the throwaway client
                pass


async def probe_submitted_supabase(url: str, service_role_key: str) -> dict:
    """Validate a SUBMITTED Supabase URL + service-role key via a THROWAWAY admin client."""
    def _reach():  # supabase-py is BLOCKING — wrapped below (D-v2.5-01), never on the loop
        sb = create_client(url, service_role_key)
        return sb.auth.admin.list_users(page=1, per_page=1)
    try:
        await asyncio.wait_for(run_in_threadpool(_reach), timeout=_PROBE_TIMEOUT_S)
        return {"state": "up"}
    except Exception as exc:  # noqa: BLE001 — sanitized reason, never the raw error/host
        logger.warning("setup probe: submitted Supabase unreachable (%s)", type(exc).__name__)
        return {"state": "down", "reason": type(exc).__name__}


def _store_present() -> bool:
    """Whether a setup-store file exists on disk (mirrors setup_store's lazy path read)."""
    return Path(os.getenv("SETUP_STORE_PATH", "/data/setup.json")).exists()


def _in_docker() -> bool:
    """Cheap best-effort in-container detection (the ``/.dockerenv`` sentinel)."""
    try:
        return Path("/.dockerenv").exists()
    except Exception:  # noqa: BLE001 — orientation only; never fail env-detect on this
        return False


async def detect_environment() -> dict:
    """D-08: LIGHT env-detect — a few cheap booleans to inform defaults, not auto-discovery.

    Returns ``{in_docker, store_present, db_reachable, redis_reachable}``. The reachability
    flags are best-effort throwaway probes of the CURRENTLY-configured values, swallowed to
    ``False`` — this orients the operator (pre-fill defaults), it never blocks the event loop
    or raises.
    """
    db = await probe_submitted_postgres(settings.postgres_dsn)
    rd = await probe_submitted_redis(settings.redis_url)
    return {
        "in_docker": _in_docker(),
        "store_present": _store_present(),
        "db_reachable": db.get("state") == "up",
        "redis_reachable": rd.get("state") == "up",
    }


# ── Entry status (static, blip-proof) — consumed by the 158-06 GET /setup/status route ─────

def compute_setup_status(supabase_url: str | None = None) -> dict:
    """D-06: the STATIC, blip-proof setup-entry signal — NEVER a live DB probe (Pitfall 1).

    ``needs_setup = (not finalized_marker) AND (infra still placeholder)`` — a pure string
    check so a DB blip can never re-trigger the wizard on a configured box. A hand-filled
    157-style box (real ``SUPABASE_URL``, no marker) reports ``needs_setup=false``.

    Reads the ``finalized`` marker DIRECTLY from the setup-store FILE (the D-05 gate
    authority) rather than the middleware's per-process sticky latch, so the status probe is
    deterministic and reflects the on-disk marker. Returns ``{needs_setup, finalized,
    has_token}`` for the router's open ``GET /setup/status``.
    """
    from app.services.setup_store import _is_placeholder, read_store

    store = read_store()
    finalized = store.get("finalized") is True
    url = settings.supabase_url if supabase_url is None else supabase_url
    needs = (not finalized) and _is_placeholder(url)
    return {
        "needs_setup": bool(needs),
        "finalized": bool(finalized),
        "has_token": bool(store.get("setup_token")),
    }


# ── Task 2: operator bootstrap + encrypted provider-key save ───────────────────────────────

def _looks_like_duplicate(exc: Exception) -> bool:
    """True when a GoTrue create_user error indicates the email already exists (idempotency).

    A duplicate → ``already_exists`` (never a 500). Any OTHER error (e.g. a weak-password
    policy rejection) is NOT a duplicate — it is surfaced verbatim so the router maps it to a
    400 (RESEARCH Pattern 6 Pitfall 2).
    """
    msg = str(exc).lower()
    return any(marker in msg for marker in _DUP_MARKERS)


async def _find_existing_user_id(sb: Any, email: str) -> str | None:
    """Best-effort lookup of an existing operator's user id by email (idempotent re-run).

    Never raises — on any failure it returns ``None`` and the caller still reports
    ``already_exists`` (the operator row is upserted ``ON CONFLICT DO NOTHING`` regardless).
    """
    target = (email or "").strip().lower()

    def _list():
        return sb.auth.admin.list_users()
    try:
        resp = await run_in_threadpool(_list)
        users = getattr(resp, "users", None)
        if users is None and isinstance(resp, (list, tuple)):
            users = resp
        for u in users or []:
            u_email = getattr(u, "email", None)
            if u_email and str(u_email).strip().lower() == target:
                return getattr(u, "id", None)
    except Exception:  # noqa: BLE001 — best-effort; idempotency does not depend on the id
        logger.warning("setup: existing-operator lookup failed (best-effort)")
    return None


def _remember_operator_email(email: str) -> None:
    """Belt-and-suspenders: persist the operator email into the setup-store's OPERATOR_EMAILS.

    So a later boot's ``seed_operators_from_env`` re-seeds ``operator_users`` on restart
    (RESEARCH Pattern 6 Pitfall 3). Best-effort — a store-write failure never fails the
    operator create (the auth user + operator row are already committed).
    """
    try:
        from app.services.setup_store import read_store, write_store

        store = read_store()
        existing = str(store.get("operator_emails") or "")
        emails = [e.strip() for e in existing.split(",") if e.strip()]
        if email not in emails:
            emails.append(email)
            store["operator_emails"] = ",".join(emails)
            write_store(store)
    except Exception:  # noqa: BLE001 — best-effort re-seed hint; never fail bootstrap on this
        logger.warning("setup: could not persist OPERATOR_EMAILS to the setup-store (best-effort)")


async def bootstrap_operator(
    supabase_url: str,
    service_role_key: str,
    email: str,
    password: str,
    pg_dsn: str,
) -> dict:
    """D-11: create the first CONFIRMED operator, then upsert ``operator_users`` (idempotent).

    Ordering contract (LOAD-BEARING): the router MUST call the schema bootstrap BEFORE this —
    ``create_user`` fires the ``on_auth_user_created`` trigger, which needs its tables
    (RESEARCH Pitfall 6).

    1. ``sb.auth.admin.create_user({... "email_confirm": True})`` via ``run_in_threadpool``
       (supabase-py is blocking) → a verified account, no confirmation email, login-ready.
    2. Upsert ``operator_users`` ``ON CONFLICT (user_id) DO NOTHING`` over a THROWAWAY
       connection (reused ``operator_service`` shape; note ``'setup-wizard'``).
    3. Persist ``OPERATOR_EMAILS`` to the setup-store (best-effort re-seed on restart).

    Idempotent: a duplicate email returns ``{"status":"already_exists", ...}`` (never a 500);
    a weak/rejected password propagates the GoTrue error verbatim (router → 400, not 500).
    """
    sb = create_client(supabase_url, service_role_key)

    def _create():
        return sb.auth.admin.create_user(
            {"email": email, "password": password, "email_confirm": True}
        )

    try:
        resp = await run_in_threadpool(_create)
    except Exception as exc:  # noqa: BLE001 — duplicate → already_exists; else re-raise for 400
        if _looks_like_duplicate(exc):
            existing_id = await _find_existing_user_id(sb, email)
            _remember_operator_email(email)
            return {"status": "already_exists", "already_exists": True, "user_id": existing_id}
        raise  # not a duplicate (e.g. weak password) — surfaced verbatim (router maps to 400)

    user_id = getattr(getattr(resp, "user", None), "id", None)

    conn = await asyncpg.connect(pg_dsn)  # THROWAWAY — never the app connection singletons
    try:
        await conn.execute(
            "INSERT INTO operator_users (user_id, granted_by, note) "
            "VALUES ($1, NULL, 'setup-wizard') ON CONFLICT (user_id) DO NOTHING",
            user_id,
        )
    finally:
        try:
            await conn.close()
        except Exception:  # noqa: BLE001 — best-effort close of the throwaway conn
            pass

    _remember_operator_email(email)
    return {"status": "created", "already_exists": False, "user_id": user_id}


async def persist_provider_key(
    provider: str,
    api_key: str,
    embedding_key: str | None = None,
) -> bool:
    """D-12: persist the collected provider key(s) through the EXISTING ``save_app_settings``
    seam — encrypt-on-write (Phase-150 ``SECRET_COLUMNS``) is inherited for free, NEVER a
    second encrypt path.

    Writes ``{f"{provider}_api_key": api_key}`` (+ ``embedding_api_key`` when supplied). With
    a master key configured the value lands as an encrypted-at-rest envelope; with no key it
    passes through byte-identical (Phase-150 fail-open) plus the boot warning the wizard
    surfaces. Returns the ``save_app_settings`` boolean (False = a real DB write failure the
    router surfaces as a 500, never a false success).
    """
    from app.models.user_settings import save_app_settings

    updates: dict[str, Any] = {f"{provider}_api_key": api_key}
    if embedding_key:
        updates["embedding_api_key"] = embedding_key
    return await save_app_settings(updates)


# Plan key-link alias (the ``save_provider_key`` name in the plan's key_links maps here — the
# single persist path; both names funnel through ``save_app_settings``, no fork).
save_provider_key = persist_provider_key


# ── Task 3: 5-way smoke checklist + (SHOULD) schema-bootstrap auto-runner ───────────────────

async def _probe_provider_key(provider: str, api_key: str | None) -> dict:
    """Server-truth provider-key validation via the SSRF-safe model-discovery seam.

    Reuses ``model_discovery_service.discover_all`` (the hardcoded, allowlisted ``/models``
    endpoint table — no client-supplied URL ever reaches the HTTP client). A ``status=='ok''``
    outcome (a 200 from the provider's ``/models`` with the submitted key) → ``up``; anything
    else → ``down`` with the sanitized ``http-{status}`` / ``error-{Type}`` reason (never a
    body echo). No key → ``down`` / ``not_configured``.
    """
    if not api_key:
        return {"state": "down", "reason": "not_configured"}
    try:
        from app.services.model_discovery_service import discover_all

        results = await discover_all({provider: api_key})
    except Exception as exc:  # noqa: BLE001 — sanitized reason, never the raw error
        return {"state": "down", "reason": type(exc).__name__}
    match = next((r for r in results if r.get("provider") == provider), None)
    if match and match.get("status") == "ok":
        return {"state": "up"}
    return {"state": "down", "reason": (match or {}).get("status", "unknown_provider")}


async def _probe_operator_row(pg_dsn: str) -> dict:
    """Whether at least one ``operator_users`` row exists (a THROWAWAY connection, sanitized)."""
    try:
        conn = await asyncio.wait_for(asyncpg.connect(pg_dsn), timeout=_PROBE_TIMEOUT_S)
    except Exception as exc:  # noqa: BLE001 — sanitized reason, no host leak
        return {"state": "down", "reason": type(exc).__name__}
    try:
        row = await conn.fetchval("SELECT 1 FROM operator_users LIMIT 1")
        return {"state": "up"} if row else {"state": "down", "reason": "no_operator_row"}
    except Exception as exc:  # noqa: BLE001 — sanitized reason
        return {"state": "down", "reason": type(exc).__name__}
    finally:
        try:
            await conn.close()
        except Exception:  # noqa: BLE001 — best-effort close of the throwaway conn
            pass


async def run_smoke_checks(cfg: dict | None = None) -> dict:
    """D-13: the 5-way green-checklist that IS the finalize gate.

    Returns ``{"checks": {id: {state, reason}}, "all_green": bool}`` for the five rows —
    ``supabase_auth`` / ``postgres_schema`` / ``redis_ping`` / ``provider_key`` /
    ``operator_row``. A row is green (``state=="up"``) ONLY on SERVER TRUTH — an unrun /
    unreachable check is ``down``, never optimistically green. ``all_green`` is True only when
    every row is up (any single red disables Finalize). ``cfg`` (optional) supplies the
    submitted values; absent, the currently-configured settings are probed.
    """
    cfg = cfg or {}
    supabase_url = cfg.get("supabase_url") or settings.supabase_url
    service_role_key = cfg.get("service_role_key") or settings.supabase_service_role_key
    pg_dsn = cfg.get("postgres_dsn") or settings.postgres_dsn
    redis_url = cfg.get("redis_url") or settings.redis_url
    provider = cfg.get("provider") or ""
    provider_key = cfg.get("provider_key") or ""

    sa, pg, rd, pk, op = await asyncio.gather(
        probe_submitted_supabase(supabase_url, service_role_key),
        probe_submitted_postgres(pg_dsn),
        probe_submitted_redis(redis_url),
        _probe_provider_key(provider, provider_key),
        _probe_operator_row(pg_dsn),
    )

    # Postgres is green ONLY when reachable AND the schema is present (a reachable-but-empty
    # DB is not a working box — it still needs the OPERATOR.md Step-3 bootstrap).
    pg_green = pg.get("state") == "up" and bool(pg.get("schema_present"))
    pg_reason = pg.get("reason") if pg.get("state") == "down" else (
        None if pg_green else "schema_absent"
    )

    checks = {
        "supabase_auth": {"state": sa.get("state"), "reason": sa.get("reason")},
        "postgres_schema": {"state": "up" if pg_green else "down", "reason": pg_reason},
        "redis_ping": {"state": rd.get("state"), "reason": rd.get("reason")},
        "provider_key": {"state": pk.get("state"), "reason": pk.get("reason")},
        "operator_row": {"state": op.get("state"), "reason": op.get("reason")},
    }
    all_green = all(row["state"] == "up" for row in checks.values())
    return {"checks": checks, "all_green": all_green}


class SchemaBootstrapPrivilegeError(Exception):
    """The throwaway connection lacks the DDL/extension/auth-schema rights to apply the schema.

    Raised by ``run_schema_bootstrap`` on an asyncpg privilege error so the router falls back
    to the copy-guide (the D-18 MUST path) — never a half-applied silent success.
    """


def _is_privilege_error(exc: Exception) -> bool:
    """True for an asyncpg insufficient-privilege error (SQLSTATE 42501)."""
    sqlstate = getattr(exc, "sqlstate", None)
    return sqlstate == "42501" or type(exc).__name__ == "InsufficientPrivilegeError"


async def run_schema_bootstrap(
    pg_dsn: str,
    full_schema_sql: str,
    seed_sqls: list[str] | None = None,
) -> None:
    """D-10 / D-18 (SHOULD): the schema-absent-gated, transaction-wrapped auto-runner.

    The CALLER gates this on the schema-absent probe result (``probe_submitted_postgres``
    ``schema_present is False``) — this runner must NEVER run against a present schema
    (non-idempotent ``CREATE TABLE`` would error). Over a THROWAWAY connection it:

    1. ``async with conn.transaction(): await conn.execute(full_schema_sql)`` — all-or-nothing
       (the pg_dump artifact is NOT self-wrapped, so a mid-script failure must roll back whole).
    2. Applies the ordered, idempotent seed migrations.
    3. ``INSERT INTO app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING`` — the A6
       gotcha row (``save_app_settings`` UPDATEs ``WHERE id='global'``; a missing row silently
       no-ops — RESEARCH Pitfall 5).

    On an asyncpg privilege error raises ``SchemaBootstrapPrivilegeError`` → the router maps it
    to "use the copy-guide instead" (the MUST fallback), never a partial silent success.
    """
    conn = await asyncpg.connect(pg_dsn)  # THROWAWAY — never the app connection singletons
    try:
        try:
            async with conn.transaction():  # all-or-nothing wrap of the multi-statement dump
                await conn.execute(full_schema_sql)
            for sql in seed_sqls or []:  # the ordered, idempotent seed migrations
                await conn.execute(sql)
            await conn.execute(
                "INSERT INTO app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING"
            )
        except asyncpg.PostgresError as exc:
            if _is_privilege_error(exc):
                logger.warning(
                    "setup: schema auto-runner hit a privilege error (%s) — falling back to "
                    "the copy-guide",
                    type(exc).__name__,
                )
                raise SchemaBootstrapPrivilegeError(type(exc).__name__) from exc
            raise
    finally:
        try:
            await conn.close()
        except Exception:  # noqa: BLE001 — best-effort close of the throwaway conn
            pass


__all__ = [
    "probe_submitted_postgres",
    "probe_submitted_redis",
    "probe_submitted_supabase",
    "detect_environment",
    "compute_setup_status",
    "bootstrap_operator",
    "persist_provider_key",
    "save_provider_key",
    "run_smoke_checks",
    "run_schema_bootstrap",
    "SchemaBootstrapPrivilegeError",
    "create_client",
]
