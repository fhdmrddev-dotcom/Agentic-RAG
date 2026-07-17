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
import pytest

# NEW service — skips cleanly until Wave 2 creates app/services/setup_service.py.
setup_service = pytest.importorskip("app.services.setup_service")


async def test_bootstrap_operator_creates_confirmed_user(mock_submitted_supabase, mock_asyncpg_pool, monkeypatch):
    """SC#1/D-11: ``bootstrap_operator`` calls ``admin.create_user`` with
    ``email_confirm=True`` — a verified account with no confirmation email — so the operator
    can log in immediately."""
    monkeypatch.setattr(setup_service, "create_client", lambda *a, **k: mock_submitted_supabase, raising=False)
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)

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


async def test_bootstrap_operator_upserts_on_conflict_do_nothing(mock_submitted_supabase, mock_asyncpg_pool, monkeypatch):
    """SC#1/D-11: the ``operator_users`` write is an idempotent
    ``INSERT ... ON CONFLICT (user_id) DO NOTHING`` upsert (WORKER_COUNT=2-safe, reused from
    operator_service — never a second upsert path)."""
    monkeypatch.setattr(setup_service, "create_client", lambda *a, **k: mock_submitted_supabase, raising=False)
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)

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


async def test_bootstrap_operator_rerun_existing_email_returns_already_exists(mock_submitted_supabase, mock_asyncpg_pool, monkeypatch):
    """SC#1/D-11 (idempotent create): a re-run with an EXISTING email must NOT 500 — it detects
    the existing user and returns ``already_exists`` (surface Supabase's password/dup error
    verbatim, never a raw 500)."""
    # simulate GoTrue rejecting a duplicate email
    mock_submitted_supabase.auth.admin.create_user.side_effect = Exception("User already registered")
    monkeypatch.setattr(setup_service, "create_client", lambda *a, **k: mock_submitted_supabase, raising=False)
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)

    result = await setup_service.bootstrap_operator(
        supabase_url="https://real.supabase.co",
        service_role_key="dummy-service-role",
        email="op@example.com",
        password="dummy-strong-pw",
        pg_dsn="postgresql://u:p@localhost:5432/db",
    )
    assert result.get("status") == "already_exists"
