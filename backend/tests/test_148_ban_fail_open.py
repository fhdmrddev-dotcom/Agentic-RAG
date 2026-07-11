"""Phase 148 Wave 0 (ADMIN-03 / T-148-04) — RED scaffold: the ban check fails OPEN.

SUBSTRATE-level (owner: 148-02, wave 2). The "no self-inflicted outage" polarity: ``_is_banned``
reads ``auth.users.banned_until`` via the pool, but a DB blip must NEVER lock out every user — on
any read exception it returns False (fail-OPEN; the JWT window is already bounded and re-enforced
on the next successful read). It returns True ONLY for a real future ``banned_until``.

Targets ``_is_banned`` directly (RED via ImportError until 148-02 adds it) so the fail-open
behavior is proven independently of behaving-like-no-check. Turns GREEN in wave 2. Owner: 148-02.
"""
import datetime as dt


async def test_is_banned_fails_open_on_db_error(mock_asyncpg_pool, monkeypatch):
    """A DB read error -> False (fail-OPEN): a blip must not lock out everyone."""
    from app.dependencies import _is_banned  # RED until 148-02

    async def _boom_fetchrow(*args, **kwargs):
        raise RuntimeError("transient DB blip on the ban-check read")

    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    monkeypatch.setattr(mock_asyncpg_pool, "fetchrow", _boom_fetchrow)

    assert await _is_banned("u1") is False, "the ban check must FAIL OPEN on a read error"


async def test_is_banned_true_for_future_banned_until(mock_asyncpg_pool, monkeypatch):
    """A future banned_until -> True (the user is genuinely disabled)."""
    from app.dependencies import _is_banned  # RED until 148-02

    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    future = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=3650)
    mock_asyncpg_pool.set_fetchrow_result({"banned_until": future})

    assert await _is_banned("u1") is True


async def test_is_banned_false_when_no_ban(mock_asyncpg_pool, monkeypatch):
    """A NULL banned_until -> False (an active user is never blocked)."""
    from app.dependencies import _is_banned  # RED until 148-02

    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"banned_until": None})

    assert await _is_banned("u1") is False
