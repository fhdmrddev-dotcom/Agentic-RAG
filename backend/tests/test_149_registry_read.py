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


# ── Task 2: GET /admin/models — the full-union registry read ──────────────────


def _prime_endpoint(monkeypatch, mock_asyncpg_pool, fetchrow_row, override_rows):
    """Drive the operator branch + seed the reads for the union endpoint.

    The mock pool's sticky ``fetchrow`` doubles as (a) the operator-membership row for
    ``is_operator`` (any truthy dict → operator) and (b) the app_settings row for
    ``_load_settings_from_db`` (read via ``.get`` — extra keys like llm_model steer
    is_default/is_locked). ``fetch`` returns the override rows for load_all_model_overrides.
    """
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(fetchrow_row)
    mock_asyncpg_pool.set_fetch_result(override_rows)
    us._settings_cache = None
    us._settings_cache_time = 0.0
    _reset_override_caches()


def test_get_models_returns_union_with_sources(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """The union carries DEF (registry) + OVR (db_override) + DB-only rows; a disabled
    row is PRESENT (all-rows, not filtered)."""
    _prime_endpoint(monkeypatch, mock_asyncpg_pool, {"user_id": "op-1"}, [
        # OVR over a built-in model, DISABLED — must still appear in the registry read.
        {"model_id": "gpt-4o", "provider": "openai", "enabled": False, "deprecated": True,
         "context_window_tokens": 128000, "max_output_tokens": 8192,
         "native_tools": True, "llm_call_timeout_seconds": 300},
        # DB-only row (not in MODEL_CAPABILITIES) — a discovery-confirmed model.
        {"model_id": "brand-new-model", "provider": "openai", "enabled": True,
         "deprecated": False},
    ])

    res = client.get("/admin/models", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert "models" in body
    by_id = {r["model_id"]: r for r in body["models"]}

    # OVR row: db_override source, present despite being disabled.
    assert "gpt-4o" in by_id
    assert by_id["gpt-4o"]["capability_source"] == "db_override"
    assert by_id["gpt-4o"]["enabled"] is False
    assert by_id["gpt-4o"]["deprecated"] is True
    # per-field OVR-vs-DEF is discernible so the editor can render Reset.
    assert "enabled" in by_id["gpt-4o"]["overridden_fields"]

    # DB-only row: db_override source (in overrides, not in the built-in registry).
    assert "brand-new-model" in by_id
    assert by_id["brand-new-model"]["capability_source"] == "db_override"

    # A pure DEF row (no override): registry source, enabled by default, render-ready.
    assert "claude-opus-4-8" in by_id
    def_row = by_id["claude-opus-4-8"]
    assert def_row["capability_source"] == "registry"
    assert def_row["enabled"] is True
    assert def_row["overridden_fields"] == []  # nothing stored → all inherited from DEF
    assert "is_default" in def_row and "is_locked" in def_row


def test_get_models_marks_default_and_lock(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """is_default / is_locked are derived from app_settings (llm_model + llm_model_locked)."""
    _prime_endpoint(
        monkeypatch, mock_asyncpg_pool,
        {"user_id": "op-1", "llm_model": "claude-opus-4-8", "llm_model_locked": True},
        [],  # no overrides
    )

    res = client.get("/admin/models", headers=auth_headers)
    assert res.status_code == 200
    by_id = {r["model_id"]: r for r in res.json()["models"]}
    assert by_id["claude-opus-4-8"]["is_default"] is True
    assert by_id["claude-opus-4-8"]["is_locked"] is True
    # a different model is neither the default nor locked
    assert by_id["gpt-4o"]["is_default"] is False
    assert by_id["gpt-4o"]["is_locked"] is False
