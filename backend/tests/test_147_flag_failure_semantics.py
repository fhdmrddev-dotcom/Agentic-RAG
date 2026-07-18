"""Phase 147 (FLAG-01) — operator control-plane flag failure-semantics suite.

Proves the three new app_settings kill-switches read through the per-worker 30s TTL
settings cache with the correct D-Q4 polarity and last-known-good behavior:

  1. Cold-cache polarity: a truly-uninitialized cache reads each flag's SAFE default —
     capability switches (self_improve_enabled / workflows_enabled) => True (never
     silently disable a capability); maintenance_mode => False (platform OPEN — a
     self-inflicted outage is worse than a stale-open window).
  2. Exception polarity: if load_app_settings() itself raises, the helper try/except
     falls back to the SAME D-Q4 polarity.
  3. Last-known-good: after a good load, a transient DB read failure returns the STALE
     cached value, NOT the cold default — a blip must never FLIP a flag (T-147-02).
  4. Write invalidates the cache so the next read reflects the new value in-worker.
  5. Read contract: FullSettingsResponse declares + maps all three flags (GET /settings
     carries them — the Control Plane capability grid's flag-read source).

Mocking matches the MEMORY lesson from Phase 146: drive the DATA-ACCESS layer the
settings loader actually uses — the asyncpg pool (`app.dependencies._pg_pool`, whose
`fetchrow`/`execute` `_load_settings_from_db` / `save_app_settings` call directly). We
do NOT mock the supabase query-builder — it has zero effect on the asyncpg path the
loader travels, and an unmocked read would hit the REAL local Postgres.
"""
import pytest

import app.models.user_settings as us
from app.models.user_settings import (
    invalidate_settings_cache,
    load_app_settings_async,
    maintenance_mode,
    save_app_settings,
    self_improve_enabled,
    workflows_enabled,
)


class _StubPool:
    """Minimal asyncpg-pool stand-in the settings loader calls DIRECTLY.

    `_load_settings_from_db` does `pool.fetchrow(...)`; `save_app_settings` does
    `pool.execute(...)`. `fetchrow` drains a per-call queue whose items are either a
    row dict (returned) or an Exception instance (raised) — that's how we simulate a
    ONE-SHOT transient DB read failure after a successful prime.
    """

    def __init__(self):
        self._fetchrow_queue: list = []
        self.execute_calls: list = []

    def queue_fetchrow(self, *items):
        self._fetchrow_queue.extend(items)

    async def fetchrow(self, sql, *args):
        item = self._fetchrow_queue.pop(0) if self._fetchrow_queue else None
        if isinstance(item, Exception):
            raise item
        return item

    async def execute(self, sql, *args):
        self.execute_calls.append((sql, args))
        return "UPDATE 1"

    async def close(self):  # tolerated by the _reset_pg_pool_singleton teardown
        return None


def _reset_cache_cold():
    """Force a truly-cold settings cache (no async load has run)."""
    us._settings_cache = None
    us._settings_cache_time = 0.0


# ── 1. Cold-cache polarity (D-Q4 defaults via _build_settings_from_row) ────────

def test_cold_cache_capability_flags_default_on():
    """A cold cache reads capability switches as True — a blip never silently disables."""
    _reset_cache_cold()
    assert self_improve_enabled() is True
    assert workflows_enabled() is True


def test_cold_cache_maintenance_defaults_open():
    """A cold cache reads maintenance_mode as False (platform OPEN) — D-Q4 inversion.

    Failing 'closed' on a fresh/cold read would wedge the whole platform read-only.
    """
    _reset_cache_cold()
    assert maintenance_mode() is False


# ── 2. Exception polarity (helper try/except belt-and-suspenders) ──────────────

def test_helpers_fall_back_to_polarity_when_load_raises(monkeypatch):
    """If load_app_settings() raises, each helper returns its D-Q4 fallback polarity."""
    def _boom():
        raise RuntimeError("settings read exploded")

    monkeypatch.setattr(us, "load_app_settings", _boom)
    assert self_improve_enabled() is True   # capability => default-ON on exception
    assert workflows_enabled() is True      # capability => default-ON on exception
    assert maintenance_mode() is False      # platform  => default-OPEN on exception


# ── 3. Last-known-good: a transient DB blip must NOT flip a flag (T-147-02) ─────

async def test_transient_db_failure_returns_last_known_good(monkeypatch):
    """After a good load, a one-shot DB read failure returns the STALE cached flags.

    The operator has deliberately set maintenance ON and both capabilities OFF — the
    OPPOSITE of every cold default. That lets us distinguish 'last-known-good preserved'
    from 'silently reset to the cold default'. The blip must preserve ALL THREE.
    """
    _reset_cache_cold()
    pool = _StubPool()
    # First fetchrow: the operator's live row. Second: a transient failure.
    good_row = {
        "self_improve_enabled": False,
        "workflows_enabled": False,
        "maintenance_mode": True,
    }
    pool.queue_fetchrow(good_row, RuntimeError("transient DB read failure"))
    monkeypatch.setattr("app.dependencies._pg_pool", pool)

    # Prime the cache with the good row.
    primed = await load_app_settings_async()
    assert primed.self_improve_enabled is False
    assert primed.workflows_enabled is False
    assert primed.maintenance_mode is True

    # Expire the TTL so the next read hits the DB (which now fails).
    invalidate_settings_cache()
    after_blip = await load_app_settings_async()

    # Last-known-good: the blip returned the STALE row, NOT the cold defaults
    # (which would be True/True/False — i.e. it would have FLIPPED all three).
    assert after_blip.self_improve_enabled is False, "blip flipped self_improve to cold default"
    assert after_blip.workflows_enabled is False, "blip flipped workflows to cold default"
    assert after_blip.maintenance_mode is True, "blip flipped maintenance to cold default (outage!)"

    # The sync helpers read the same stale last-known-good cache.
    assert self_improve_enabled() is False
    assert workflows_enabled() is False
    assert maintenance_mode() is True


# ── 4. A write invalidates the cache ───────────────────────────────────────────

async def test_write_invalidates_cache(monkeypatch):
    """save_app_settings writes via the pool then zeros the cache timestamp (D-07)."""
    _reset_cache_cold()
    pool = _StubPool()
    pool.queue_fetchrow({"maintenance_mode": False})
    monkeypatch.setattr("app.dependencies._pg_pool", pool)

    # Prime the cache; timestamp becomes non-zero.
    await load_app_settings_async()
    assert us._settings_cache_time != 0.0

    await save_app_settings({"maintenance_mode": True})

    # The parameterized UPDATE was issued for the flag column ...
    assert pool.execute_calls, "save_app_settings must issue an UPDATE via the pool"
    sql = pool.execute_calls[-1][0]
    assert "maintenance_mode" in sql
    assert "UPDATE app_settings" in sql
    # ... and the cache was invalidated so the next read re-hits the DB.
    assert us._settings_cache_time == 0.0


# ── 5. Read contract: FullSettingsResponse declares + maps the three flags ─────

async def test_get_settings_contract_exposes_flags():
    """FullSettingsResponse carries all three flags from the effective settings.

    Proves the GET /settings read contract (settings.py _build_response) surfaces the
    kill-switches — the Control Plane capability grid's flag-read source — with no new
    endpoint, alongside the existing web_search_enabled / sandbox_enabled booleans.
    """
    from app.api.settings import _build_response
    from app.models.user_settings import _build_settings_from_row

    s = _build_settings_from_row(
        {
            "self_improve_enabled": False,
            "workflows_enabled": True,
            "maintenance_mode": True,
        }
    )
    resp = await _build_response(s=s)
    assert resp.self_improve_enabled is False
    assert resp.workflows_enabled is True
    assert resp.maintenance_mode is True
