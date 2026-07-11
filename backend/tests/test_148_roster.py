"""Phase 148 Wave 0 (ADMIN-03) — RED scaffold: roster last-active honesty.

SERVICE-level (owner: 148-04, wave 3). Encodes that ``governance_service.list_users_roster``
returns HONEST last-active: a user whose ``last_sign_in_at`` is NULL surfaces as None (rendered
"never signed in" — NEVER fabricated/backfilled), while a real timestamp is preserved. The
serializer must not invent activity the auth system never recorded.

Driven via the mock asyncpg pool (set_fetch_result). RED-by-design: ``governance_service``
does not exist yet; imported inside the body. Turns GREEN in wave 3. Owner: 148-04.
"""


async def test_last_active_honesty(mock_asyncpg_pool, monkeypatch):
    """NULL last_sign_in_at is preserved as None (never fabricated); a real value is kept."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    from app.services.governance_service import list_users_roster  # RED until 148-04

    never = {
        "id": "11111111-1111-1111-1111-111111111111", "email": "never@x.co",
        "created_at": "2026-01-01T00:00:00Z", "last_sign_in_at": None,
        "banned_until": None, "is_operator": False, "doc_count": 0, "chat_count": 0,
    }
    recent = {
        "id": "22222222-2222-2222-2222-222222222222", "email": "recent@x.co",
        "created_at": "2026-01-01T00:00:00Z", "last_sign_in_at": "2026-07-10T00:00:00Z",
        "banned_until": None, "is_operator": True, "doc_count": 3, "chat_count": 5,
    }
    mock_asyncpg_pool.set_fetch_result([never, recent])

    rows = await list_users_roster(page_size=50, offset=0)
    by_id = {r["id"]: r for r in rows}
    assert by_id[never["id"]]["last_sign_in_at"] is None, \
        "a user who never signed in must surface last_sign_in_at=None (never fabricated)"
    assert by_id[recent["id"]]["last_sign_in_at"] is not None, \
        "a real last_sign_in_at must be preserved"
