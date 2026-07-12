"""Phase 149 Plan 05 (MODEL-01) — the registry reads.

Task 1: ``load_all_model_overrides`` returns disabled rows that the enabled-only hot
cache (``_load_model_overrides``) omits (Pitfall 1 — the editor + the picker filter must
see disabled rows; the request hot path must not).

Task 2 extends this file with the ``GET /admin/models`` full-union assertions.
"""
import app.models.user_settings as us


# ── Task 1: all-rows read vs enabled-only hot cache ───────────────────────────


class _RegistryPool:
    """asyncpg-pool stand-in that HONORS the ``WHERE enabled = true`` filter, so the two
    reads (all-rows vs the hot cache) return genuinely different row sets."""

    def __init__(self, rows):
        self._rows = rows

    async def fetch(self, sql, *args):
        if "enabled = true" in sql:
            return [r for r in self._rows if r.get("enabled", True)]
        return list(self._rows)

    async def fetchrow(self, sql, *args):
        return None

    async def close(self):
        return None


def _reset_override_caches():
    us._model_overrides_cache = {}
    us._model_overrides_cache_time = 0.0
    us._all_model_overrides_cache = {}
    us._all_model_overrides_cache_time = 0.0


async def test_all_rows_read_sees_disabled_that_hot_cache_omits(monkeypatch):
    """load_all_model_overrides surfaces a disabled row; _load_model_overrides omits it."""
    _reset_override_caches()
    rows = [
        {"model_id": "gpt-4o", "provider": "openai", "enabled": True, "deprecated": False},
        {"model_id": "old-model", "provider": "openai", "enabled": False, "deprecated": True},
    ]
    monkeypatch.setattr("app.dependencies._pg_pool", _RegistryPool(rows))

    all_rows = await us.load_all_model_overrides()
    assert "old-model" in all_rows, "the all-rows read must surface a disabled row (Pitfall 1)"
    assert all_rows["old-model"]["enabled"] is False

    _reset_override_caches()  # force the hot cache to re-read from the same pool
    hot = await us._load_model_overrides()
    assert "old-model" not in hot, "the enabled-only hot cache must omit the disabled row"
    assert "gpt-4o" in hot, "the hot cache still carries the enabled row"


async def test_all_rows_read_is_ttl_cached(monkeypatch):
    """A second call within the TTL returns the cache without a second DB read (mirrors
    the hot-cache TTL discipline; a write calls invalidate to force a refresh)."""
    _reset_override_caches()

    class _CountingPool(_RegistryPool):
        def __init__(self, rows):
            super().__init__(rows)
            self.fetches = 0

        async def fetch(self, sql, *args):
            self.fetches += 1
            return await super().fetch(sql, *args)

    pool = _CountingPool([{"model_id": "m", "provider": "openai", "enabled": True}])
    monkeypatch.setattr("app.dependencies._pg_pool", pool)

    await us.load_all_model_overrides()
    await us.load_all_model_overrides()
    assert pool.fetches == 1, "the second read within the TTL must hit the cache, not the DB"

    us.invalidate_model_overrides_cache()  # a write zeros the timestamp
    await us.load_all_model_overrides()
    assert pool.fetches == 2, "invalidate must force the next read to re-hit the DB"
