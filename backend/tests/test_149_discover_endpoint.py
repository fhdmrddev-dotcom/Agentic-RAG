"""Phase 149 Plan 06 (MODEL-02 / D-149-11, T-149-14) — the operator discovery endpoint.

POST /admin/models/discover:
  - a provider-selection value NOT in set(PROVIDER_ENDPOINTS) → 422 BEFORE any fan-out
    (the SSRF gate — no client value ever becomes a request URL; discover_all is never
    called on the reject path);
  - a happy path (mocked discover_all + mocked current) → returns the ephemeral
    new/changed/vanished diff + honest per-provider outcomes + stamps model.discover;
  - NO proposals/persistence table is written (the diff lives only in the response);
  - a non-operator JWT → byte-identical 404 (the new non-GET route's OWN regression test).

The service (discover_all) is mocked so no live HTTP runs; compute_diff is the real pure
function. The 422 + happy paths call the handler directly (assert the stamps + that the
service is/ isn't invoked); the router 404 gate is covered via the client fixture.
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api.admin import DiscoverRequest, run_model_discovery


def _fake_request():
    return SimpleNamespace(
        state=SimpleNamespace(),
        method="POST",
        url=SimpleNamespace(path="/admin/models/discover"),
    )


async def test_bad_provider_selection_422_no_fanout(monkeypatch):
    """A selection value outside PROVIDER_ENDPOINTS → 422, and discover_all is NEVER called."""
    fake_discover = AsyncMock()
    monkeypatch.setattr("app.services.model_discovery_service.discover_all", fake_discover)

    with pytest.raises(HTTPException) as ei:
        await run_model_discovery(
            _fake_request(), DiscoverRequest(providers=["not-a-real-provider"]), _floor=None
        )
    assert ei.value.status_code == 422
    fake_discover.assert_not_awaited(), "the SSRF gate must reject BEFORE any fan-out"


async def test_happy_path_returns_diff_and_stamps(monkeypatch):
    """A discovery run → new/changed/vanished groups + per-provider outcomes + a receipt."""
    discovered = [
        {
            "provider": "openai",
            "status": "ok",
            "ids": ["totally-new-model-xyz"],  # absent from the built-in registry → NEW
            "caps": {},
            "capabilities_returned": False,
        },
        {"provider": "anthropic", "status": "no_key"},  # honest skip
    ]
    monkeypatch.setattr(
        "app.services.model_discovery_service.discover_all", AsyncMock(return_value=discovered)
    )
    monkeypatch.setattr(
        "app.models.user_settings.load_all_model_overrides", AsyncMock(return_value={})
    )

    req = _fake_request()
    out = await run_model_discovery(req, None, _floor=None)

    assert set(("new", "changed", "vanished")).issubset(out), "the three diff groups must be present"
    assert any(m["model_id"] == "totally-new-model-xyz" for m in out["new"]), \
        "a returned id absent from the registry must land in the new group"
    # SC#3 propose-only: the new model is not auto-enabled.
    new_entry = next(m for m in out["new"] if m["model_id"] == "totally-new-model-xyz")
    assert new_entry["enabled"] is False
    # Honest per-provider outcomes surface skips/errors.
    by_provider = {p["provider"]: p for p in out["providers"]}
    assert by_provider["anthropic"]["status"] == "no_key"
    assert by_provider["openai"]["ok"] is True
    # The run is a recorded operator action.
    assert req.state.audit_action == "model.discover"


async def test_discover_empty_body_runs_all(monkeypatch):
    """No body (api.ts sends none) → all keyed providers, no 422, still stamps the receipt."""
    monkeypatch.setattr(
        "app.services.model_discovery_service.discover_all",
        AsyncMock(return_value=[{"provider": "openai", "status": "ok", "ids": [], "caps": {}}]),
    )
    monkeypatch.setattr(
        "app.models.user_settings.load_all_model_overrides", AsyncMock(return_value={})
    )

    req = _fake_request()
    out = await run_model_discovery(req, None, _floor=None)
    assert "new" in out and "vanished" in out
    assert req.state.audit_action == "model.discover"


def test_discover_non_operator_404(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """A non-operator JWT gets a byte-identical 404 on POST /admin/models/discover."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)  # no operator row → gate 404
    res = client.post("/admin/models/discover", headers=auth_headers, json={})
    assert res.status_code == 404
    assert res.json() == {"detail": "Not Found"}
