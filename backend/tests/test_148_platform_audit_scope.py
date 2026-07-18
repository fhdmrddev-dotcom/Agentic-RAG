"""Phase 148 Wave 0 (ADMIN-03 / T-148-01) — RED scaffold: no full-tenant leak.

SERVICE-level (owner: 148-04, wave 3). The no-RLS-backstop guard: ``query_platform_audit``
is ALWAYS paginated (page_size clamped le=100 — an over-cap request is clamped, never passed
through) AND explicitly scoped (a NULL user_id param = "all users"; a value = single-user
scope) — never an unbounded ``SELECT *``.

Driven via the mock asyncpg pool recorder. RED-by-design: imported inside the body; turns
GREEN in wave 3. Owner: 148-04.
"""


async def test_page_size_clamped_to_100(mock_asyncpg_pool, monkeypatch):
    """A request for page_size 5000 is clamped to <= 100 — never a full-table dump."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    from app.services.governance_service import query_platform_audit  # RED until 148-04

    await query_platform_audit(
        user_id=None, action_types=None, since=None, until=None, page_size=5000, offset=0
    )

    sql, args = [c for c in mock_asyncpg_pool.calls if "audit_log" in c[0]][-1]
    assert "LIMIT" in sql, "the query must always LIMIT"
    assert 5000 not in args, "an over-cap page_size must be clamped, never bound as-is"
    numeric = [a for a in args if isinstance(a, int)]
    assert numeric and all(a <= 100 for a in numeric if a > 0), "effective LIMIT must be <= 100"


async def test_null_user_id_means_all_users(mock_asyncpg_pool, monkeypatch):
    """NULL user_id -> the deliberate cross-user read (all users), still NULL-guarded + bound."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    from app.services.governance_service import query_platform_audit  # RED until 148-04

    await query_platform_audit(
        user_id=None, action_types=None, since=None, until=None, page_size=50, offset=0
    )

    sql, args = [c for c in mock_asyncpg_pool.calls if "audit_log" in c[0]][-1]
    assert args[0] is None, "user_id=None must be bound as NULL (all-users param)"
    assert "IS NULL OR user_id" in sql, "user scope is a NULL-guarded param, not an unbounded read"


async def test_user_scoped_read_binds_the_user_id(mock_asyncpg_pool, monkeypatch):
    """A user_id value -> single-user scope: the id is a bound param and there is no SELECT *."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    from app.services.governance_service import query_platform_audit  # RED until 148-04

    uid = "11111111-1111-1111-1111-111111111111"
    await query_platform_audit(
        user_id=uid, action_types=None, since=None, until=None, page_size=50, offset=0
    )

    sql, args = [c for c in mock_asyncpg_pool.calls if "audit_log" in c[0]][-1]
    assert uid in args, "a user_id value must be a bound param for single-user scope"
    assert "user_id = $1" in sql, "user scope filters on a $N param"
    assert "select *" not in sql.lower(), "must select explicit columns, never SELECT *"
