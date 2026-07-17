"""Phase 159 Plan 02 (MODEL-03 / D-159-04 write half) — the filter-toggle write path.

The persisted discovery-filter toggle rides the SHIPPED ``PUT /admin/flags`` path with ZERO
new endpoint code: adding ``model_discovery_filter_enabled`` to the ``_FLAG_HUMAN_NAMES``
code-constant allowlist auto-includes it in ``_FLAG_KEYS``, so ``set_flag`` accepts the key and
routes the write through ``save_app_settings`` (parameterized, honest-500-on-failure — T-147-01).

These tests functionally exercise the endpoint OVER HTTP (``operator_override`` forces the gate
so the request reaches the handler; ``save_app_settings`` is stubbed because this Wave-1 plan
lands AHEAD of the operator-applied migration 103 that adds the column — so we assert the write
is ROUTED, not that it hits a live column). This is the real proof the key is wired: a grep only
proves the literal exists, not that ``PUT /admin/flags`` accepts + routes it. The non-operator
404 gate is exercised via the ``client`` + asyncpg-pool-mock pattern (mirrors test_149_model_gate).
"""
from unittest.mock import AsyncMock

import app.api.admin as admin_mod
from app.api.admin import _FLAG_HUMAN_NAMES, _FLAG_KEYS

_KEY = "model_discovery_filter_enabled"


def test_flag_key_in_allowlist():
    """The toggle key joins the code-constant allowlist (auto-derived into _FLAG_KEYS)."""
    assert _KEY in _FLAG_HUMAN_NAMES, "the toggle key must be in the human-name allowlist"
    assert _KEY in _FLAG_KEYS, "_FLAG_KEYS derives from _FLAG_HUMAN_NAMES → the key is accepted"


def test_put_flag_off_routes_to_save(client, operator_override, monkeypatch):
    """PUT /admin/flags {key, value:false} → 204 AND routes the write to save_app_settings with
    exactly {model_discovery_filter_enabled: False}. The persistence layer is stubbed — this
    Wave-1 plan runs AHEAD of the operator-applied migration 103, so we assert ROUTING."""
    fake_save = AsyncMock(return_value=True)
    monkeypatch.setattr(admin_mod, "save_app_settings", fake_save)

    res = client.put("/admin/flags", json={"key": _KEY, "value": False})

    assert res.status_code == 204, "the new key must be accepted + written over HTTP"
    fake_save.assert_awaited_once_with({_KEY: False})


def test_put_flag_on_routes_to_save(client, operator_override, monkeypatch):
    """Flipping the toggle back ON also returns 204 (a real over-HTTP toggle, both ways)."""
    fake_save = AsyncMock(return_value=True)
    monkeypatch.setattr(admin_mod, "save_app_settings", fake_save)

    res = client.put("/admin/flags", json={"key": _KEY, "value": True})

    assert res.status_code == 204
    fake_save.assert_awaited_once_with({_KEY: True})


def test_unknown_flag_key_still_422(client, operator_override, monkeypatch):
    """An unknown key is STILL rejected 422 (the allowlist wall holds; no write is routed)."""
    fake_save = AsyncMock(return_value=True)
    monkeypatch.setattr(admin_mod, "save_app_settings", fake_save)

    res = client.put("/admin/flags", json={"key": "bogus", "value": True})

    assert res.status_code == 422
    fake_save.assert_not_awaited()


def test_put_flag_non_operator_404(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """A non-operator JWT gets a byte-identical 404 on PUT /admin/flags (the router gate is the
    sole authority — no RLS backstop), so the new key can never be toggled by a non-operator."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)  # operator_users lookup → no row → gate 404
    res = client.put("/admin/flags", headers=auth_headers, json={"key": _KEY, "value": False})
    assert res.status_code == 404
    assert res.json() == {"detail": "Not Found"}
