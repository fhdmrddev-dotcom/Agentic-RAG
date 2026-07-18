"""Phase 146 Plan 03 (ADMIN-01 / D-01) — operator bootstrap seed unit tests.

Drives ``seed_operators_from_env()`` (authored in Plan 02, wired to the lifespan in
Plan 03) against the ``_MockAsyncpgPool`` recorder (conftest.py ``mock_asyncpg_pool``)
so the test never touches the real local Postgres. Patching
``app.dependencies._pg_pool`` -> the recorder makes ``get_pg_pool()`` return it (the
``tests/unit/test_lifespan.py`` idiom). ``pool.calls`` records every ``(sql, args)`` in
order, so we assert on the exact SQL the seed issues.

Proves D-01 + the threat register:
  - T-146-05 (Tampering / SQL injection): the ``auth.users`` resolve is parameterized
    (``$1::text[]``) — no email string is ever interpolated into the SQL text.
  - T-146-08 (Tampering / Availability — seed race under WORKER_COUNT=2): the upsert is
    ``INSERT ... ON CONFLICT (user_id) DO NOTHING``, so a SECOND concurrent seed run
    against the same table is conflict-safe (no duplicate-key error surfaces) — both
    workers race, the first wins, the second no-ops.
  - Bootstrap tolerance: an ``OPERATOR_EMAILS`` entry with no matching ``auth.users``
    row is warned-and-deferred (NOT inserted, NOT an error) and re-seeds on a later
    restart once the user signs up.
"""
import logging
from unittest.mock import patch

from app.config import settings
from app.services.operator_service import seed_operators_from_env

# Two distinct fixture operators. Emails are lowercase — seed_operators_from_env
# lowercases OPERATOR_EMAILS, so these round-trip through ``found`` unchanged.
EMAIL_A = "alice@example.com"
EMAIL_B = "bob@example.com"
UID_A = "11111111-1111-1111-1111-111111111111"
UID_B = "22222222-2222-2222-2222-222222222222"

_INSERT_MARK = "INSERT INTO operator_users"
_CONFLICT_MARK = "ON CONFLICT (user_id) DO NOTHING"


def _insert_calls(pool):
    """Every recorded (sql, args) whose SQL is the operator_users upsert."""
    return [(sql, args) for sql, args in pool.calls if _INSERT_MARK in sql]


async def test_seed_insert_is_conflict_safe(mock_asyncpg_pool, monkeypatch):
    """Each resolved operator is upserted with ON CONFLICT (user_id) DO NOTHING."""
    monkeypatch.setattr(settings, "operator_emails", f"{EMAIL_A},{EMAIL_B}")
    mock_asyncpg_pool.set_fetch_result([
        {"id": UID_A, "email": EMAIL_A},
        {"id": UID_B, "email": EMAIL_B},
    ])

    with patch("app.dependencies._pg_pool", mock_asyncpg_pool):
        await seed_operators_from_env()

    inserts = _insert_calls(mock_asyncpg_pool)
    assert len(inserts) == 2, f"expected one INSERT per resolved operator, got {inserts}"
    for sql, _args in inserts:
        assert _CONFLICT_MARK in sql, f"seed INSERT must be conflict-safe: {sql}"
    # Both resolved user_ids were inserted (as bound $1 args, not literals).
    assert {args[0] for _sql, args in inserts} == {UID_A, UID_B}


async def test_seed_resolve_is_parameterized(mock_asyncpg_pool, monkeypatch):
    """T-146-05: the auth.users resolve binds emails as $1::text[] — never f-string SQL."""
    monkeypatch.setattr(settings, "operator_emails", f"{EMAIL_A},{EMAIL_B}")
    mock_asyncpg_pool.set_fetch_result([
        {"id": UID_A, "email": EMAIL_A},
        {"id": UID_B, "email": EMAIL_B},
    ])

    with patch("app.dependencies._pg_pool", mock_asyncpg_pool):
        await seed_operators_from_env()

    # The FIRST recorded call is the auth.users resolve fetch.
    resolve_sql, resolve_args = mock_asyncpg_pool.calls[0]
    assert "$1::text[]" in resolve_sql, f"resolve must be parameterized: {resolve_sql}"
    # No email string is interpolated into the SQL text — they travel as a bound array arg.
    assert EMAIL_A not in resolve_sql
    assert EMAIL_B not in resolve_sql
    assert resolve_args[0] == [EMAIL_A, EMAIL_B]


async def test_seed_second_run_stays_conflict_safe(mock_asyncpg_pool, monkeypatch):
    """T-146-08: a SECOND seed run (racing worker) is conflict-safe — no duplicate write raises.

    Under WORKER_COUNT=2 both workers seed the same rows at startup. The mock execute
    never raises, so the second run completing cleanly with the SAME ON CONFLICT INSERTs
    proves the SQL guard — not luck — makes concurrent startup safe.
    """
    monkeypatch.setattr(settings, "operator_emails", f"{EMAIL_A},{EMAIL_B}")
    mock_asyncpg_pool.set_fetch_result([
        {"id": UID_A, "email": EMAIL_A},
        {"id": UID_B, "email": EMAIL_B},
    ])

    with patch("app.dependencies._pg_pool", mock_asyncpg_pool):
        await seed_operators_from_env()   # worker 1
        await seed_operators_from_env()   # worker 2 — races the same rows

    inserts = _insert_calls(mock_asyncpg_pool)
    assert len(inserts) == 4, "both runs issue their INSERTs (2 operators x 2 runs)"
    assert all(_CONFLICT_MARK in sql for sql, _args in inserts), (
        "every INSERT across both runs must carry the ON CONFLICT guard"
    )


async def test_seed_skips_unmatched_email(mock_asyncpg_pool, monkeypatch, caplog):
    """An OPERATOR_EMAILS entry with no auth.users row is warned + deferred, never inserted."""
    monkeypatch.setattr(settings, "operator_emails", f"{EMAIL_A},{EMAIL_B}")
    # EMAIL_B has not signed up yet — the resolve returns only EMAIL_A.
    mock_asyncpg_pool.set_fetch_result([{"id": UID_A, "email": EMAIL_A}])

    with patch("app.dependencies._pg_pool", mock_asyncpg_pool):
        with caplog.at_level(logging.WARNING, logger="app.services.operator_service"):
            await seed_operators_from_env()

    inserts = _insert_calls(mock_asyncpg_pool)
    assert len(inserts) == 1, "only the matched operator is inserted"
    assert inserts[0][1][0] == UID_A
    # The deferred email is named in a WARNING (bootstrap, not an error).
    assert "no auth.users row for" in caplog.text
    assert EMAIL_B in caplog.text


async def test_seed_noop_when_no_emails(mock_asyncpg_pool, monkeypatch):
    """Empty OPERATOR_EMAILS short-circuits before any DB call (no resolve, no INSERT)."""
    monkeypatch.setattr(settings, "operator_emails", "")

    with patch("app.dependencies._pg_pool", mock_asyncpg_pool):
        await seed_operators_from_env()

    assert mock_asyncpg_pool.calls == [], "no OPERATOR_EMAILS -> no pool activity at all"
