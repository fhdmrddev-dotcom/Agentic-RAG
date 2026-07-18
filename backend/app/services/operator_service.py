"""Operator role service — membership read, append-only audit write, env seed.

Phase 146 (ADMIN-01). Houses the three operator-role primitives so ``admin.py`` and
``dependencies.py`` stay thin (RESEARCH recommended structure):

  - ``is_operator(user_id)``       — membership read via the singleton asyncpg pool.
  - ``write_operator_audit(...)``  — one append-only ``operator_audit_log`` row,
                                     off-loop via ``aexec``, swallow-on-error
                                     (mirrors ``write_audit_entry``,
                                     audit_service.py:57-74).
  - ``seed_operators_from_env()``  — idempotent ``OPERATOR_EMAILS`` -> ``operator_users``
                                     upsert, concurrent-safe under WORKER_COUNT=2
                                     (``ON CONFLICT DO NOTHING``). Wired to lifespan
                                     startup in Plan 03; authored here because this
                                     file is owned by Plan 02.

Import discipline (breaks the ``dependencies`` <-> ``operator_service`` cycle): the
pool / supabase accessors are imported *lazily inside each function* so importing
this module never triggers a partial-import of ``app.dependencies``.
"""
import logging

from fastapi import HTTPException

from app.config import settings
from app.utils.db import aexec

logger = logging.getLogger(__name__)


async def is_operator(user_id: str) -> bool:
    """Return True iff a row exists in ``operator_users`` for ``user_id``.

    Reads via the singleton asyncpg pool. Parameterized (``$1``) — never f-string
    SQL (matches the ``coerce_uid`` discipline). Kept a small seam so tests drive
    BOTH branches by patching ``app.dependencies._pg_pool`` -> ``mock_asyncpg_pool``
    (``set_fetchrow_result(None)`` -> non-operator; ``set_fetchrow_result({...})``
    -> operator). Pitfall 6: the supabase builder mock has NO effect on this path.
    """
    from app.dependencies import get_pg_pool

    pool = await get_pg_pool()
    row = await pool.fetchrow(
        "SELECT 1 FROM operator_users WHERE user_id = $1", user_id
    )
    return row is not None


async def write_operator_audit(
    operator_user_id: str,
    action: str,
    label: str,
    is_write: bool = False,
    target_type: str | None = None,
    target_id: str | None = None,
    metadata: dict | None = None,
    supabase=None,
) -> None:
    """Insert exactly ONE append-only ``operator_audit_log`` row; NEVER raise.

    Off-loop via ``aexec`` (``run_in_threadpool`` — D-v2.5-01, Pitfall 5). On any
    exception, log LOUDLY via ``logger.error`` and swallow (Repudiation mitigation;
    mirrors ``write_audit_entry``). A failed write is logged, never silently dropped.

    ``supabase`` is injected by the audit-floor yield-dependency
    (``Depends(get_supabase)``) so tests assert on the shared Supabase mock; other
    callers may omit it and the module-level service-role client is used.
    """
    try:
        if supabase is None:
            from app.dependencies import get_supabase
            supabase = get_supabase()
        await aexec(
            supabase.table("operator_audit_log").insert({
                "operator_user_id": operator_user_id,
                "action": action,
                "label": label,
                "is_write": is_write,
                "target_type": target_type,
                "target_id": target_id,
                "metadata": metadata or {},
            })
        )
    except Exception as exc:
        logger.error(
            "operator audit write failed [action=%s operator=%s]: %s",
            action, operator_user_id, exc,
        )


async def get_recent_operator_audit(limit: int = 50) -> list[dict]:
    """Return the latest ``operator_audit_log`` rows, newest first (for the ledger feed).

    Off-loop via ``aexec`` (supabase-py), ordered by ``created_at DESC``. Read-only;
    never mutates. Returns ``[]`` on any error (best-effort feed, mirrors the swallow
    posture of the write path).
    """
    try:
        from app.dependencies import get_supabase

        resp = await aexec(
            get_supabase()
            .table("operator_audit_log")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
        )
        return resp.data or []
    except Exception as exc:
        logger.error("operator audit feed read failed: %s", exc)
        return []


async def get_operator_record(user_id: str) -> dict | None:
    """Return the ``operator_users`` row for ``user_id`` (id/email/granted_at), or None.

    Used by the ``GET /admin/me`` probe to surface ``granted_at`` for the band identity.
    Reads via the asyncpg pool; parameterized (``$1``). Returns None on miss/any error.
    """
    try:
        from app.dependencies import get_pg_pool

        pool = await get_pg_pool()
        row = await pool.fetchrow(
            "SELECT user_id, granted_at FROM operator_users WHERE user_id = $1",
            user_id,
        )
        if row is None:
            return None
        return dict(row)
    except Exception as exc:
        logger.error("operator record read failed [user=%s]: %s", user_id, exc)
        return None


async def seed_operators_from_env() -> None:
    """Idempotently seed ``OPERATOR_EMAILS`` into ``operator_users`` at startup.

    Resolves ``auth.users`` by lowercased email; upserts ``ON CONFLICT DO NOTHING``
    (concurrent-safe under WORKER_COUNT=2 — both workers race, first wins, second
    no-ops). ``granted_by = NULL`` marks env-bootstrap provenance. An email with no
    ``auth.users`` row logs a WARNING (bootstrap, not error) and re-seeds on a later
    restart once the user signs up. Wired to lifespan startup in Plan 03.
    """
    from app.dependencies import get_pg_pool

    emails = [e.strip().lower() for e in settings.operator_emails.split(",") if e.strip()]
    if not emails:
        return
    pool = await get_pg_pool()
    rows = await pool.fetch(
        "SELECT id, email FROM auth.users WHERE lower(email) = ANY($1::text[])",
        emails,
    )
    found = {r["email"].lower() for r in rows}
    for missing in set(emails) - found:
        logger.warning(
            "OPERATOR_EMAILS: no auth.users row for %s — will seed on a later "
            "restart once they sign up",
            missing,
        )
    for r in rows:
        await pool.execute(
            "INSERT INTO operator_users (user_id, granted_by, note) "
            "VALUES ($1, NULL, 'env-bootstrap') ON CONFLICT (user_id) DO NOTHING",
            r["id"],
        )


# ── Runtime grant / revoke (Phase 148 — ADMIN-03 / D-01) ──────────────────────

async def grant_operator(target_id: str, acting_operator_id: str) -> None:
    """Grant operator access to ``target_id``, recording ``granted_by`` = the acting operator.

    Mirrors ``seed_operators_from_env``'s INSERT shape but swaps the env-bootstrap provenance
    (``NULL, 'env-bootstrap'``) for the runtime provenance (``$2`` acting operator,
    ``'granted via roster'``) and adds ``ON CONFLICT (user_id) DO UPDATE SET granted_by =
    EXCLUDED.granted_by`` so it is idempotent AND re-stamps ``granted_by`` on a re-grant (D-01,
    mig 095 provenance). Parameterized (``$1``/``$2``) — never f-string SQL.
    """
    from app.dependencies import get_pg_pool

    pool = await get_pg_pool()
    await pool.execute(
        "INSERT INTO operator_users (user_id, granted_by, note) "
        "VALUES ($1, $2, 'granted via roster') "
        "ON CONFLICT (user_id) DO UPDATE SET granted_by = EXCLUDED.granted_by",
        target_id,
        acting_operator_id,
    )


async def revoke_operator(target_id: str, acting_operator_id: str) -> None:
    """Revoke operator access from ``target_id`` — REFUSING a self-revoke BEFORE any DELETE.

    Pitfall 7 (self-lockout): the server is the real wall, not the UI tooltip. If ``target_id``
    is the acting operator's own id, raise ``HTTPException(409)`` FIRST — before touching the
    pool — so no mutation can occur. Past ``operator_audit_log`` rows are UNTOUCHED (its
    ``operator_user_id`` is a plain uuid with no FK — mig 095); revocation only removes the
    live membership row.
    """
    if target_id == acting_operator_id:
        raise HTTPException(
            status_code=409,
            detail="You cannot remove your own operator access.",
        )

    from app.dependencies import get_pg_pool

    pool = await get_pg_pool()
    await pool.execute("DELETE FROM operator_users WHERE user_id = $1", target_id)
