"""Phase 148 Wave 0 (ADMIN-03 / T-148-01) — RED scaffold: platform audit filters -> SQL.

SERVICE-level (owner: 148-04, wave 3). Encodes that ``governance_service.query_platform_audit``
builds a PARAMETERIZED, explicitly-scoped query (RESEARCH §Pattern 3): an ``action_type`` array
filter passes through as ``action_type = ANY($N)`` and a half-open date window as
``created_at >= $N AND created_at < $N`` — every filter a ``$N`` bind, never string-interpolated
(SC#4 no-RLS-backstop / no full-tenant leak).

Driven via the mock asyncpg pool's ``.calls`` recorder (captures ``(sql, args)`` per query) —
no live DB. RED-by-design: ``governance_service`` does not exist yet; imported inside the body.
Turns GREEN in wave 3. Owner: 148-04.
"""
import datetime as dt


async def test_action_type_array_and_date_window_are_bound_params(mock_asyncpg_pool, monkeypatch):
    """action_type IN + a half-open [since, until) window pass through as $N binds."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    from app.services.governance_service import query_platform_audit  # RED until 148-04

    since = dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)
    until = dt.datetime(2026, 2, 1, tzinfo=dt.timezone.utc)
    await query_platform_audit(
        user_id=None,
        action_types=["document.view", "chat.send"],
        since=since,
        until=until,
        page_size=50,
        offset=0,
    )

    audit_calls = [c for c in mock_asyncpg_pool.calls if "audit_log" in c[0]]
    assert audit_calls, "expected a SELECT against audit_log"
    sql, args = audit_calls[-1]
    assert "action_type = ANY" in sql, "action_type filter must be an ANY($N) array bind"
    assert "created_at >=" in sql and "created_at <" in sql, "date window must be half-open [since, until)"
    # The filter VALUES are bound params (never interpolated into the SQL text).
    assert ["document.view", "chat.send"] in args, "action_types must be a bound array param"
    assert since in args and until in args, "date bounds must be bound params"


async def test_no_filters_still_parameterized(mock_asyncpg_pool, monkeypatch):
    """With no filters the query is still fully parameterized + NULL-guarded (all-users read)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    from app.services.governance_service import query_platform_audit  # RED until 148-04

    await query_platform_audit(
        user_id=None, action_types=None, since=None, until=None, page_size=25, offset=0
    )

    audit_calls = [c for c in mock_asyncpg_pool.calls if "audit_log" in c[0]]
    assert audit_calls, "expected a SELECT against audit_log even with no filters"
    sql, _args = audit_calls[-1]
    assert "IS NULL OR action_type" in sql, "action_type filter is NULL-guarded ($N IS NULL OR ...)"
    assert "select *" not in sql.lower(), "must select explicit columns, never SELECT *"
