"""Phase 158 Plan 01 (SC#1 / D-11) — operator bootstrap via the verified Auth admin API.

Wave-0 Nyquist scaffold. The wizard creates the first admin account DIRECTLY so the operator
is an operator on their FIRST login (no signup-then-restart gap): create a CONFIRMED Supabase
auth user via ``auth.admin.create_user({"email","password","email_confirm": True})``
(supabase-py is blocking → run_in_threadpool; RESEARCH Pattern 6), then upsert ``operator_users``
with the idempotent ``ON CONFLICT (user_id) DO NOTHING`` shape (reused from
``operator_service.py:163``). Ordering is load-bearing: schema bootstrap → operator create
(the ``on_auth_user_created`` trigger needs its tables, Pitfall 6).

This file pins (158-VALIDATION.md, SC#1/D-11):
  - ``bootstrap_operator`` calls ``admin.create_user`` with ``email_confirm=True`` (verified,
    no confirmation email);
  - it upserts ``operator_users`` with ``ON CONFLICT (user_id) DO NOTHING`` (idempotent,
    WORKER_COUNT=2-safe);
  - a re-run with an existing email returns ``already_exists`` (no 500 — idempotent create).

Drives the data-access layer the seam actually uses (project lesson): ``mock_submitted_supabase``
for ``admin.create_user`` + ``mock_asyncpg_pool`` for the upsert.
``pytest.importorskip("app.services.setup_service")`` SKIPS the file cleanly until Wave 2.
"""
from unittest.mock import MagicMock

import pytest

# NEW service — skips cleanly until Wave 2 creates app/services/setup_service.py.
setup_service = pytest.importorskip("app.services.setup_service")


class _RecordingThrowawayConn:
    """A throwaway-connection stand-in for the operator upsert path (Wave 2 wiring).

    ``bootstrap_operator`` opens a THROWAWAY ``asyncpg.connect(pg_dsn)`` (never the app pool —
    RESEARCH Pattern 5); this records every ``execute(sql, *args)`` on the shared recorder's
    ``.calls`` so the ON CONFLICT upsert can be asserted, and supports ``close()`` like a real
    asyncpg connection."""

    def __init__(self, recorder):
        self._rec = recorder

    async def execute(self, sql, *args):
        self._rec.calls.append((sql, args))
        return "INSERT 0 1"

    async def close(self):
        return None


def _mock_throwaway_connect(monkeypatch, recorder):
    """Point ``asyncpg.connect`` at the recording throwaway conn (the setup service imports
    ``asyncpg`` and calls ``asyncpg.connect`` — the same module object)."""
    async def _connect(dsn, *a, **k):
        return _RecordingThrowawayConn(recorder)

    monkeypatch.setattr("asyncpg.connect", _connect)


async def test_bootstrap_operator_creates_confirmed_user(setup_store_path, mock_submitted_supabase, mock_asyncpg_pool, monkeypatch):
    """SC#1/D-11: ``bootstrap_operator`` calls ``admin.create_user`` with
    ``email_confirm=True`` — a verified account with no confirmation email — so the operator
    can log in immediately."""
    monkeypatch.setattr(setup_service, "create_client", lambda *a, **k: mock_submitted_supabase, raising=False)
    _mock_throwaway_connect(monkeypatch, mock_asyncpg_pool)

    await setup_service.bootstrap_operator(
        supabase_url="https://real.supabase.co",
        service_role_key="dummy-service-role",
        email="op@example.com",
        password="dummy-strong-pw",
        pg_dsn="postgresql://u:p@localhost:5432/db",
    )
    mock_submitted_supabase.auth.admin.create_user.assert_called_once()
    payload = mock_submitted_supabase.auth.admin.create_user.call_args[0][0]
    assert payload["email_confirm"] is True, "the operator account must be created verified (email_confirm=True)"


async def test_bootstrap_operator_upserts_on_conflict_do_nothing(setup_store_path, mock_submitted_supabase, mock_asyncpg_pool, monkeypatch):
    """SC#1/D-11: the ``operator_users`` write is an idempotent
    ``INSERT ... ON CONFLICT (user_id) DO NOTHING`` upsert (WORKER_COUNT=2-safe, reused from
    operator_service — never a second upsert path)."""
    monkeypatch.setattr(setup_service, "create_client", lambda *a, **k: mock_submitted_supabase, raising=False)
    _mock_throwaway_connect(monkeypatch, mock_asyncpg_pool)

    await setup_service.bootstrap_operator(
        supabase_url="https://real.supabase.co",
        service_role_key="dummy-service-role",
        email="op@example.com",
        password="dummy-strong-pw",
        pg_dsn="postgresql://u:p@localhost:5432/db",
    )
    upserts = [sql for (sql, _args) in mock_asyncpg_pool.calls if "operator_users" in str(sql)]
    assert upserts, "bootstrap must upsert operator_users"
    assert any("ON CONFLICT" in str(sql) and "DO NOTHING" in str(sql) for sql in upserts)


async def test_bootstrap_operator_rerun_existing_email_returns_already_exists(setup_store_path, mock_submitted_supabase, mock_asyncpg_pool, monkeypatch):
    """SC#1/D-11 (idempotent create): a re-run with an EXISTING email must NOT 500 — it detects
    the existing user and returns ``already_exists`` (surface Supabase's password/dup error
    verbatim, never a raw 500)."""
    # simulate GoTrue rejecting a duplicate email
    mock_submitted_supabase.auth.admin.create_user.side_effect = Exception("User already registered")
    monkeypatch.setattr(setup_service, "create_client", lambda *a, **k: mock_submitted_supabase, raising=False)
    _mock_throwaway_connect(monkeypatch, mock_asyncpg_pool)

    result = await setup_service.bootstrap_operator(
        supabase_url="https://real.supabase.co",
        service_role_key="dummy-service-role",
        email="op@example.com",
        password="dummy-strong-pw",
        pg_dsn="postgresql://u:p@localhost:5432/db",
    )
    assert result.get("status") == "already_exists"


async def test_bootstrap_operator_duplicate_still_upserts_operator_row(setup_store_path, mock_submitted_supabase, mock_asyncpg_pool, monkeypatch):
    """WR-01: on the DUPLICATE-email path, bootstrap STILL upserts ``operator_users`` with the
    resolved user id. Before the fix the duplicate branch returned ``already_exists`` WITHOUT
    the upsert, so a partial first attempt (auth user created, operator-row insert failed) was
    an unrecoverable stuck state — every retry said ``already_exists`` and the row was never
    written, blocking finalize forever. With a resolvable existing id, the retry now HEALS."""
    mock_submitted_supabase.auth.admin.create_user.side_effect = Exception("User already registered")
    existing = MagicMock()
    existing.email = "op@example.com"
    existing.id = "11111111-1111-1111-1111-1111111111bb"
    mock_submitted_supabase.auth.admin.list_users.return_value = MagicMock(users=[existing])
    monkeypatch.setattr(setup_service, "create_client", lambda *a, **k: mock_submitted_supabase, raising=False)
    _mock_throwaway_connect(monkeypatch, mock_asyncpg_pool)

    result = await setup_service.bootstrap_operator(
        supabase_url="https://real.supabase.co",
        service_role_key="dummy-service-role",
        email="op@example.com",
        password="dummy-strong-pw",
        pg_dsn="postgresql://u:p@localhost:5432/db",
    )
    assert result["status"] == "already_exists"
    assert result["user_id"] == "11111111-1111-1111-1111-1111111111bb"
    upserts = [sql for (sql, _args) in mock_asyncpg_pool.calls if "operator_users" in str(sql)]
    assert upserts, "the duplicate path must STILL upsert operator_users (WR-01 heal)"
    assert any("ON CONFLICT" in str(sql) and "DO NOTHING" in str(sql) for sql in upserts)


async def test_bootstrap_operator_weak_password_propagates_verbatim(setup_store_path, mock_submitted_supabase, mock_asyncpg_pool, monkeypatch):
    """SC#1/D-11 (T-158-06): a NON-duplicate GoTrue error (e.g. a weak-password policy
    rejection) is surfaced VERBATIM — never swallowed into ``already_exists`` and never a raw
    500 — so the router can map it to a 400 with the provider's own message."""
    mock_submitted_supabase.auth.admin.create_user.side_effect = Exception(
        "Password should be at least 6 characters"
    )
    monkeypatch.setattr(setup_service, "create_client", lambda *a, **k: mock_submitted_supabase, raising=False)
    _mock_throwaway_connect(monkeypatch, mock_asyncpg_pool)

    with pytest.raises(Exception, match="Password should be at least"):
        await setup_service.bootstrap_operator(
            supabase_url="https://real.supabase.co",
            service_role_key="dummy-service-role",
            email="op@example.com",
            password="123",
            pg_dsn="postgresql://u:p@localhost:5432/db",
        )


# ── WR-04: /operator must sanitize DB/connection errors but surface GoTrue password errors ────

class _FakeAsyncpgError(Exception):
    """A stand-in for an asyncpg connection error whose message leaks DB host/role."""


_FakeAsyncpgError.__module__ = "asyncpg.exceptions"  # what _is_password_policy_error keys off


class _FakeGoTrueError(Exception):
    """A stand-in for a GoTrue password-policy rejection (surfaced verbatim, T-158-06)."""


_FakeGoTrueError.__module__ = "gotrue.errors"


async def test_operator_endpoint_sanitizes_db_error(setup_store_path, monkeypatch):
    """WR-04: a DB/connection failure from bootstrap_operator must NOT reflect the raw error
    (which can carry the DB host/port/role) — the /operator 400 detail is a generic sanitized
    message. Before the fix the endpoint returned ``detail=str(exc)`` verbatim (topology leak)."""
    import app.api.setup as setup_api
    from fastapi import HTTPException

    leaky = _FakeAsyncpgError('password authentication failed for user "postgres" at host db.internal:5432')

    async def _boom(*a, **k):
        raise leaky

    monkeypatch.setattr(setup_api, "bootstrap_operator", _boom)
    body = setup_api.OperatorBody(
        email="op@example.com", password="x", supabase_url="https://real.supabase.co",
        supabase_service_role_key="svc", postgres_dsn="postgresql://u:p@db.internal:5432/db",
    )
    with pytest.raises(HTTPException) as ei:
        await setup_api.operator(body)
    assert ei.value.status_code == 400
    detail = str(ei.value.detail)
    assert "db.internal" not in detail and "postgres" not in detail, "DB host/role must not leak (WR-04)"


async def test_operator_endpoint_surfaces_password_policy_verbatim(setup_store_path, monkeypatch):
    """WR-04 (preserve intended UX): a GoTrue password-policy rejection is still surfaced
    VERBATIM as the 400 detail so the operator sees the real requirement (T-158-06 / D-11)."""
    import app.api.setup as setup_api
    from fastapi import HTTPException

    async def _weak(*a, **k):
        raise _FakeGoTrueError("Password should be at least 6 characters")

    monkeypatch.setattr(setup_api, "bootstrap_operator", _weak)
    body = setup_api.OperatorBody(
        email="op@example.com", password="123", supabase_url="https://real.supabase.co",
        supabase_service_role_key="svc", postgres_dsn="postgresql://u:p@localhost:5432/db",
    )
    with pytest.raises(HTTPException) as ei:
        await setup_api.operator(body)
    assert ei.value.status_code == 400
    assert ei.value.detail == "Password should be at least 6 characters"
