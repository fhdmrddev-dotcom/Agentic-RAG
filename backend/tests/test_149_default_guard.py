"""Phase 149 Plan 06 (MODEL-02 / D-149-07 / D-149-09) — the no-dead-default guard + lock.

The two-part no-dead-default guard + the dedicated lock endpoint:
  - PATCH enabled=false on the org-default model → 409 "org default" BEFORE any write;
  - PATCH enabled=false on the LOCKED model → 409 "unlock it first" BEFORE any write;
  - an ordinary disable (non-default, non-locked) → a direct, reversible flip;
  - PUT /admin/models/{id}/lock {locked:true} on an ENABLED model → pins the org default
    (app_settings.llm_model + llm_model_locked=true) + ✎ model.lock;
  - lock {locked:true} on a DISABLED model → 409 "enable it first" with NO save (the
    lock-path half of the guard — together with the disable guard, no dead default exists);
  - unlock {locked:false} → llm_model_locked=false + ✎ model.unlock;
  - a non-operator JWT → byte-identical 404 on PUT .../lock (the new non-GET route's own
    regression test — the 146 gate auto-enumerates GET only).

Guard/lock logic is exercised by calling the handlers directly with a fake Request (so the
request.state stamps + the exact write args are asserted); the router 404 gate is covered
via the client fixture (mirrors test_149_model_gate.py + test_147_operator_kill.py).
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

import app.api.admin as admin_mod
import app.dependencies as deps
import app.main as main_mod
from app.api.admin import ModelLockUpdate, set_model_capability, set_model_lock


class _RecordingPool:
    """asyncpg-pool stand-in recording every ``execute(sql, *args)`` — proves whether the
    upsert write path was reached (a 409 guard must leave ``.calls`` empty)."""

    def __init__(self):
        self.calls = []

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        return "INSERT 0 1"


def _fake_request(method="PATCH"):
    return SimpleNamespace(
        state=SimpleNamespace(),
        method=method,
        url=SimpleNamespace(path="/admin/models/gpt-4o"),
    )


def _mock_settings(monkeypatch, *, llm_model="", llm_model_locked=False):
    """Patch the function-local _load_settings_from_db the disable guard reads."""
    async def _fake():
        return {"llm_model": llm_model, "llm_model_locked": llm_model_locked}

    monkeypatch.setattr("app.models.user_settings._load_settings_from_db", _fake)


def _mock_overrides(monkeypatch, overrides):
    """Patch the function-local load_all_model_overrides the lock guard reads."""
    async def _fake():
        return overrides

    monkeypatch.setattr("app.models.user_settings.load_all_model_overrides", _fake)


# ── main._DIRECT_COLUMNS allowlist ─────────────────────────────────────────────

def test_direct_columns_contains_llm_model_locked():
    """The lock flag joins the code-constant write allowlist (SQLi-safe save_app_settings)."""
    assert "llm_model_locked" in main_mod._DIRECT_COLUMNS


# ── PATCH disable guard (D-149-09 disable-path half) ───────────────────────────

async def test_disable_org_default_409_no_write(monkeypatch):
    """Disabling the current org default → 409 with a plain reason, and NO upsert runs."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    _mock_settings(monkeypatch, llm_model="gpt-4o", llm_model_locked=False)

    with pytest.raises(HTTPException) as ei:
        await set_model_capability("gpt-4o", {"enabled": False}, _fake_request(), _floor=None)
    assert ei.value.status_code == 409
    assert "org default" in ei.value.detail.lower()
    assert not pool.calls, "the disable guard must 409 BEFORE any capability write"


async def test_disable_guard_forces_fresh_settings_read(monkeypatch):
    """WR-03: the disable guard invalidates the settings cache BEFORE reading the org
    default, so a STALE per-worker cache can't let a disable of the true default slip past
    (no cross-worker dead default). Assert the fresh-read ordering: invalidate THEN load."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)

    order: list[str] = []

    def _fake_invalidate():
        order.append("invalidate")

    async def _fake_load():
        order.append("load")
        return {"llm_model": "gpt-4o", "llm_model_locked": False}

    monkeypatch.setattr("app.models.user_settings.invalidate_settings_cache", _fake_invalidate)
    monkeypatch.setattr("app.models.user_settings._load_settings_from_db", _fake_load)

    with pytest.raises(HTTPException) as ei:
        await set_model_capability("gpt-4o", {"enabled": False}, _fake_request(), _floor=None)
    assert ei.value.status_code == 409, "gpt-4o is the org default → refused"
    assert order == ["invalidate", "load"], "the guard must invalidate the cache BEFORE reading"
    assert not pool.calls


async def test_lock_guard_forces_fresh_override_read(monkeypatch):
    """WR-03: the lock guard invalidates the all-rows override cache BEFORE reading the
    target's enabled state, so a STALE cache can't let a lock pin a just-disabled model."""
    order: list[str] = []

    def _fake_invalidate():
        order.append("invalidate")

    async def _fake_load():
        order.append("load")
        return {"gpt-4o": {"enabled": False}}

    monkeypatch.setattr("app.models.user_settings.invalidate_model_overrides_cache", _fake_invalidate)
    monkeypatch.setattr("app.models.user_settings.load_all_model_overrides", _fake_load)
    fake_save = AsyncMock(return_value=True)
    monkeypatch.setattr(admin_mod, "save_app_settings", fake_save)

    with pytest.raises(HTTPException) as ei:
        await set_model_lock("gpt-4o", ModelLockUpdate(locked=True), _fake_request("PUT"), _floor=None)
    assert ei.value.status_code == 409
    assert order == ["invalidate", "load"], "the lock guard must invalidate the cache BEFORE reading"
    fake_save.assert_not_awaited()


async def test_disable_locked_model_409_unlock_first(monkeypatch):
    """Disabling the LOCKED model → 409 telling the operator to unlock first, no write."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    _mock_settings(monkeypatch, llm_model="gpt-4o", llm_model_locked=True)

    with pytest.raises(HTTPException) as ei:
        await set_model_capability("gpt-4o", {"enabled": False}, _fake_request(), _floor=None)
    assert ei.value.status_code == 409
    assert "unlock" in ei.value.detail.lower()
    assert not pool.calls, "the locked-disable guard must 409 BEFORE any write"


async def test_disable_ordinary_model_succeeds(monkeypatch):
    """An ordinary disable of a non-default, non-locked model → a direct flip (upsert runs)."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    _mock_settings(monkeypatch, llm_model="claude-opus-4-8", llm_model_locked=False)
    monkeypatch.setattr(admin_mod, "invalidate_model_overrides_cache", lambda: None)

    req = _fake_request()
    out = await set_model_capability("gpt-4o", {"enabled": False}, req, _floor=None)
    assert out["changed"] == ["enabled"]
    assert len(pool.calls) == 1, "an ordinary disable must reach the upsert"
    assert req.state.audit_action == "model.capability.set"


# ── PUT /admin/models/{id}/lock (D-149-07 + D-149-09 lock-path half) ───────────

async def test_lock_enabled_model_pins_default(monkeypatch):
    """Locking an ENABLED model pins the org default (llm_model + llm_model_locked=true)."""
    _mock_overrides(monkeypatch, {})  # no override → gpt-4o is enabled
    fake_save = AsyncMock(return_value=True)
    monkeypatch.setattr(admin_mod, "save_app_settings", fake_save)

    req = _fake_request(method="PUT")
    await set_model_lock("gpt-4o", ModelLockUpdate(locked=True), req, _floor=None)

    fake_save.assert_awaited_once_with({"llm_model": "gpt-4o", "llm_model_locked": True})
    assert req.state.audit_action == "model.lock"
    assert "gpt-4o" in req.state.audit_label


async def test_lock_disabled_model_409(monkeypatch):
    """Locking a DISABLED model → 409 'enable it first' with NO save (no dead default)."""
    _mock_overrides(monkeypatch, {"gpt-4o": {"enabled": False}})
    fake_save = AsyncMock(return_value=True)
    monkeypatch.setattr(admin_mod, "save_app_settings", fake_save)

    with pytest.raises(HTTPException) as ei:
        await set_model_lock("gpt-4o", ModelLockUpdate(locked=True), _fake_request("PUT"), _floor=None)
    assert ei.value.status_code == 409
    assert "disabled" in ei.value.detail.lower()
    fake_save.assert_not_awaited(), "a disabled model must never reach the lock write"


async def test_unlock_clears_lock_flag(monkeypatch):
    """Unlocking clears llm_model_locked (llm_model untouched) + stamps model.unlock."""
    _mock_overrides(monkeypatch, {})
    fake_save = AsyncMock(return_value=True)
    monkeypatch.setattr(admin_mod, "save_app_settings", fake_save)

    req = _fake_request(method="PUT")
    await set_model_lock("gpt-4o", ModelLockUpdate(locked=False), req, _floor=None)

    fake_save.assert_awaited_once_with({"llm_model_locked": False})
    assert req.state.audit_action == "model.unlock"


async def test_lock_persistence_failure_500(monkeypatch):
    """A failed lock write → 500 + a *.write_failed stamp (never a false 204)."""
    _mock_overrides(monkeypatch, {})
    monkeypatch.setattr(admin_mod, "save_app_settings", AsyncMock(return_value=False))

    req = _fake_request(method="PUT")
    with pytest.raises(HTTPException) as ei:
        await set_model_lock("gpt-4o", ModelLockUpdate(locked=True), req, _floor=None)
    assert ei.value.status_code == 500
    assert req.state.audit_action == "model.lock.write_failed"


# ── Non-operator 404 (the new PUT .../lock route's OWN regression test) ────────

def test_lock_non_operator_404(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """A non-operator JWT gets a byte-identical 404 on PUT /admin/models/{id}/lock."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)  # no operator row → gate 404
    res = client.put("/admin/models/gpt-4o/lock", headers=auth_headers, json={"locked": True})
    assert res.status_code == 404
    assert res.json() == {"detail": "Not Found"}
