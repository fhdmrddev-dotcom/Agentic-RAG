"""Phase 148 Wave 0 (ADMIN-03 / D-01, T-148-04) — RED scaffold: grant + self-revoke guard.

SERVICE-level ONLY (owner: 148-04, wave 3). Encodes two membership-write contracts in
``operator_service``:
  - ``grant_operator(target_id, acting_operator_id)`` INSERTs into ``operator_users`` populating
    ``granted_by`` = the acting operator (mig 095 provenance), idempotent via ON CONFLICT DO UPDATE;
  - ``revoke_operator(target_id, acting_operator_id)`` REFUSES a self-revoke server-side with 409
    BEFORE any DELETE (lockout-proof — the server is the real wall, not the UI tooltip).

Scope (wave-ownership split): this file holds ONLY the two service-level assertions above so
148-04's <verify> passes in wave 3. The self-target account-lock guard is a controller surface and
lives in its own 148-06 test file — it is intentionally NOT asserted here.

Driven via the mock asyncpg pool's ``.calls`` recorder. RED-by-design: ``operator_service`` gains
these helpers in wave 3; imported inside the body so collection succeeds. Owner: 148-04.
"""
import pytest

ACTING = "22222222-2222-2222-2222-222222222222"
TARGET = "11111111-1111-1111-1111-111111111111"


async def test_grant_populates_granted_by(mock_asyncpg_pool, monkeypatch):
    """grant INSERTs into operator_users with granted_by = the acting operator (idempotent)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    from app.services.operator_service import grant_operator  # RED until 148-04

    await grant_operator(TARGET, ACTING)

    inserts = [c for c in mock_asyncpg_pool.calls
               if "operator_users" in c[0] and "INSERT" in c[0].upper()]
    assert inserts, "grant must INSERT into operator_users"
    sql, args = inserts[-1]
    assert "granted_by" in sql, "the INSERT must populate granted_by"
    assert ACTING in args, "granted_by must bind the acting operator id (D-01 provenance)"
    assert "ON CONFLICT" in sql.upper(), "grant must be idempotent (ON CONFLICT DO UPDATE)"


async def test_self_revoke_refused_409_before_delete(mock_asyncpg_pool, monkeypatch):
    """An operator revoking their OWN access is refused 409 BEFORE any DELETE (lockout-proof)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    from fastapi import HTTPException
    from app.services.operator_service import revoke_operator  # RED until 148-04

    with pytest.raises(HTTPException) as ei:
        await revoke_operator(ACTING, ACTING)  # self-revoke
    assert ei.value.status_code == 409, "self-revoke must be refused 409"

    deletes = [c for c in mock_asyncpg_pool.calls
               if "operator_users" in c[0] and "DELETE" in c[0].upper()]
    assert not deletes, "the self-revoke refusal must precede any DELETE (no mutation)"
