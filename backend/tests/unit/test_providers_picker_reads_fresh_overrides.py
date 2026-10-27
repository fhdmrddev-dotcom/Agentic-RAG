"""The chat picker's provider lists must include DB-only models on the FIRST read.

`_build_providers` (sync) adds DB-registered models from the enabled-only hot cache
(`_model_overrides_cache`). `load_app_settings_async` used to warm only the ALL-rows cache, so
on a freshly started worker — or after an invalidation that zeroed the TTL — the hot cache was
empty or stale and every model added through the registry was missing from the chat picker
until some unrelated path (a chat send) happened to reload it.
"""
from __future__ import annotations

import pytest

import app.models.user_settings as us


class _FakePool:
    def __init__(self, rows):
        self._rows = rows

    async def fetch(self, query, *args):
        if "removed = true" in query:
            return []  # no tombstones in these fixtures
        if "enabled = true" in query:
            return [r for r in self._rows if r["enabled"]]
        return list(self._rows)


@pytest.mark.asyncio
async def test_db_only_model_reaches_the_picker_on_a_cold_worker(monkeypatch):
    rows = [
        {"model_id": "claude-test-db-only", "provider": "anthropic", "enabled": True, "removed": False},
        {"model_id": "claude-test-disabled", "provider": "anthropic", "enabled": False, "removed": False},
    ]

    async def _fake_get_pg_pool():
        return _FakePool(rows)

    async def _fake_settings_row():
        return {}

    monkeypatch.setattr("app.dependencies.get_pg_pool", _fake_get_pg_pool)
    monkeypatch.setattr(us, "_load_settings_from_db", _fake_settings_row)
    # A cold worker: both caches empty and expired.
    monkeypatch.setattr(us, "_model_overrides_cache", {})
    monkeypatch.setattr(us, "_model_overrides_cache_time", 0.0)
    monkeypatch.setattr(us, "_all_model_overrides_cache", {})
    monkeypatch.setattr(us, "_all_model_overrides_cache_time", 0.0)
    monkeypatch.setattr(us, "_removed_model_ids_cache", set())
    monkeypatch.setattr(us, "_removed_model_ids_cache_time", 0.0)

    s = await us.load_app_settings_async()
    anthropic = next(p for p in s.providers if p.id == "anthropic")

    assert "claude-test-db-only" in anthropic.models
    assert "claude-test-disabled" not in anthropic.models


@pytest.mark.asyncio
async def test_a_stale_hot_cache_is_reloaded_after_invalidation(monkeypatch):
    rows = [{"model_id": "claude-test-new", "provider": "anthropic", "enabled": True, "removed": False}]

    async def _fake_get_pg_pool():
        return _FakePool(rows)

    async def _fake_settings_row():
        return {}

    monkeypatch.setattr("app.dependencies.get_pg_pool", _fake_get_pg_pool)
    monkeypatch.setattr(us, "_load_settings_from_db", _fake_settings_row)
    # The hot cache still holds the pre-write contents; invalidation zeroed only its timestamp.
    monkeypatch.setattr(us, "_model_overrides_cache", {"claude-test-old": {"provider": "anthropic", "enabled": True}})
    monkeypatch.setattr(us, "_model_overrides_cache_time", 0.0)
    monkeypatch.setattr(us, "_all_model_overrides_cache", {})
    monkeypatch.setattr(us, "_all_model_overrides_cache_time", 0.0)
    monkeypatch.setattr(us, "_removed_model_ids_cache", set())
    monkeypatch.setattr(us, "_removed_model_ids_cache_time", 0.0)

    s = await us.load_app_settings_async()
    anthropic = next(p for p in s.providers if p.id == "anthropic")

    assert "claude-test-new" in anthropic.models
    assert "claude-test-old" not in anthropic.models


class _FakePoolWithTombstones(_FakePool):
    async def fetch(self, query, *args):
        if "removed = true" in query:
            return [{"model_id": r["model_id"]} for r in self._rows if r["removed"]]
        live = [r for r in self._rows if not r["removed"]]
        if "enabled = true" in query:
            return [r for r in live if r["enabled"]]
        return live


@pytest.mark.asyncio
async def test_a_model_removed_in_the_registry_leaves_the_picker_even_if_settings_lists_it(monkeypatch):
    """The registry wins: a removal must hide the model even when the Settings page's own
    per-provider list (`provider_model_lists`) still carries it — the list Settings writes back
    in full on every save. Covers a built-in id and a DB-only id."""
    rows = [
        {"model_id": "claude-opus-4-6", "provider": "anthropic", "enabled": True, "removed": True},
        {"model_id": "claude-test-gone", "provider": "anthropic", "enabled": True, "removed": True},
        {"model_id": "claude-test-kept", "provider": "anthropic", "enabled": True, "removed": False},
    ]

    async def _fake_get_pg_pool():
        return _FakePoolWithTombstones(rows)

    async def _fake_settings_row():
        return {"provider_model_lists": {"anthropic": ["claude-opus-4-6", "claude-test-gone", "claude-test-kept"]}}

    monkeypatch.setattr("app.dependencies.get_pg_pool", _fake_get_pg_pool)
    monkeypatch.setattr(us, "_load_settings_from_db", _fake_settings_row)
    monkeypatch.setattr(us, "_model_overrides_cache", {})
    monkeypatch.setattr(us, "_model_overrides_cache_time", 0.0)
    monkeypatch.setattr(us, "_all_model_overrides_cache", {})
    monkeypatch.setattr(us, "_all_model_overrides_cache_time", 0.0)
    monkeypatch.setattr(us, "_removed_model_ids_cache", set())
    monkeypatch.setattr(us, "_removed_model_ids_cache_time", 0.0)

    s = await us.load_app_settings_async()
    anthropic = next(p for p in s.providers if p.id == "anthropic")

    assert "claude-opus-4-6" not in anthropic.models
    assert "claude-test-gone" not in anthropic.models
    assert "claude-test-kept" in anthropic.models
