"""Phase 159 Plan 02 (MODEL-03 / D-159-02) — POST /admin/models add-by-ID.

``add_model_by_id`` writes a DB-only ``model_capabilities_overrides`` row that lands
``enabled=false`` (never auto-enabled — SC#3), reusing the SQLi-safe parameterized upsert
proven in ``set_model_capability``. Most tests call the handler directly with a fake
Request + a recording pool so the upsert (SQL/params), the FORCED ``enabled=false``, the
case-folded duplicate guard, the roster allowlist, and the ✎ receipt stamps are asserted
precisely (mirrors tests/test_149_model_write.py). The non-operator 404 gate is exercised
over HTTP via the ``client`` fixture (the router-level gate covers POST too — the 146 gate
auto-enumerates GET only, so a non-GET route carries its OWN regression test).

The pool is driven via ``app.dependencies._pg_pool`` (CR-02 — the LIVE module attr the
handler reads); ``load_all_model_overrides`` (the duplicate-guard source) is stubbed so no
test touches the live DB.
"""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import app.api.admin as admin_mod
import app.dependencies as deps
from app.api.admin import AddModelRequest, add_model_by_id


class _RecordingPool:
    """asyncpg-pool stand-in recording every ``execute(sql, *args)``; optionally fails."""

    def __init__(self, fail=False):
        self.calls = []
        self._fail = fail

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        if self._fail:
            raise RuntimeError("db down")
        return "INSERT 0 1"


def _fake_request():
    return SimpleNamespace(
        state=SimpleNamespace(),
        method="POST",
        url=SimpleNamespace(path="/admin/models"),
    )


def _spy_invalidate(monkeypatch):
    flag = {"called": False}
    monkeypatch.setattr(
        admin_mod, "invalidate_model_overrides_cache",
        lambda: flag.__setitem__("called", True),
    )
    return flag


def _stub_overrides(monkeypatch, rows):
    """Stub the function-local ``load_all_model_overrides`` → controlled duplicate-guard rows."""
    async def _fake():
        return rows

    monkeypatch.setattr("app.models.user_settings.load_all_model_overrides", _fake)


# ── Happy path: a new DB-only model lands enabled=false, served next request ────

async def test_add_model_happy_path_lands_disabled(monkeypatch):
    """A valid add → 200, body ``enabled:false``, a parameterized upsert with the caps, a
    forced ``enabled=false`` bind, cache invalidation, and a ✎ model.added stamp."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    flag = _spy_invalidate(monkeypatch)
    _stub_overrides(monkeypatch, {})
    req = _fake_request()

    body = AddModelRequest(
        model_id="kimi-k3", provider="moonshot",
        context_window_tokens=262144, max_output_tokens=65536, native_tools=True,
    )
    out = await add_model_by_id(req, body, _floor=None)

    assert out == {"ok": True, "model_id": "kimi-k3", "provider": "moonshot", "enabled": False}
    assert len(pool.calls) == 1
    sql, args = pool.calls[0]
    assert "INSERT INTO model_capabilities_overrides" in sql
    # WR-01: a PLAIN insert — a duplicate must fail SAFE via the DB unique constraint (→409), NOT
    # an ON CONFLICT DO UPDATE that would silently clobber an existing row's caps + force disabled.
    assert "ON CONFLICT" not in sql, "add-by-ID must not upsert — a duplicate fails safe as 409"
    assert "enabled" in sql, "the enabled column is always written"
    # The value list is bound params ($N) — the id/provider/caps are NEVER in the SQL text.
    assert "kimi-k3" not in sql and "moonshot" not in sql, "no client value is interpolated"
    assert "$1" in sql, "columns/values are positional $N binds"
    assert "kimi-k3" in args and "moonshot" in args
    assert 262144 in args and 65536 in args
    assert flag["called"] is True
    assert req.state.audit_action == "model.added"
    assert "kimi-k3" in req.state.audit_label and "moonshot" in req.state.audit_label


async def test_add_model_forces_enabled_false_even_with_caps(monkeypatch):
    """``get_model_capability_async`` rides the existing read path — the persisted row is
    ``enabled=false`` with ``native_tools=true`` intact. Here we assert the WRITE binds the
    literal False for enabled (the read path is proven end-to-end by Phase 149)."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    _spy_invalidate(monkeypatch)
    _stub_overrides(monkeypatch, {})

    body = AddModelRequest(model_id="kimi-k3", provider="moonshot", native_tools=True)
    out = await add_model_by_id(_fake_request(), body, _floor=None)

    assert out["enabled"] is False
    sql, args = pool.calls[0]
    # native_tools=True is written, but the enabled column is bound False (never True).
    assert True in args, "native_tools=True is preserved"
    assert args[-1] is False, "enabled is the LAST bind and is the forced literal False"


# ── Roster allowlist: a bogus provider is refused BEFORE any DB touch ───────────

async def test_bogus_provider_rejected_422_before_db(monkeypatch):
    """``provider:"bogus"`` → 422 BEFORE any DB touch (no upsert, no cache invalidation)."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    flag = _spy_invalidate(monkeypatch)
    _stub_overrides(monkeypatch, {})

    body = AddModelRequest(model_id="foo-1", provider="bogus")
    with pytest.raises(HTTPException) as ei:
        await add_model_by_id(_fake_request(), body, _floor=None)
    assert ei.value.status_code == 422
    assert not pool.calls, "an unknown provider must be refused before any DB touch"
    assert flag["called"] is False


# ── Empty / whitespace id → 422 ────────────────────────────────────────────────

async def test_empty_model_id_rejected_422(monkeypatch):
    """A whitespace/slash-only id strips to empty → 422 (never a phantom '' row)."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    _stub_overrides(monkeypatch, {})

    body = AddModelRequest(model_id="  / \t", provider="openai")
    with pytest.raises(HTTPException) as ei:
        await add_model_by_id(_fake_request(), body, _floor=None)
    assert ei.value.status_code == 422
    assert not pool.calls


# ── Duplicate guard (case-folded, WR-02 precedent) ─────────────────────────────

async def test_duplicate_builtin_rejected_409(monkeypatch):
    """An id already built-in (``gpt-4o``) → 409 with NO write (edit it in the table instead)."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    _stub_overrides(monkeypatch, {})

    body = AddModelRequest(model_id="gpt-4o", provider="openai")
    with pytest.raises(HTTPException) as ei:
        await add_model_by_id(_fake_request(), body, _floor=None)
    assert ei.value.status_code == 409
    assert not pool.calls


async def test_duplicate_override_rejected_409(monkeypatch):
    """An id already present as an override row → 409 with NO write."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    _stub_overrides(monkeypatch, {"my-db-model": {"provider": "openai", "enabled": True}})

    body = AddModelRequest(model_id="my-db-model", provider="openai")
    with pytest.raises(HTTPException) as ei:
        await add_model_by_id(_fake_request(), body, _floor=None)
    assert ei.value.status_code == 409
    assert not pool.calls


async def test_case_variant_of_builtin_rejected_409(monkeypatch):
    """``GPT-4o`` (case variant of the built-in ``gpt-4o``) → 409, NOT a second row."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    _stub_overrides(monkeypatch, {})

    body = AddModelRequest(model_id="GPT-4o", provider="openai")
    with pytest.raises(HTTPException) as ei:
        await add_model_by_id(_fake_request(), body, _floor=None)
    assert ei.value.status_code == 409
    assert not pool.calls, "a case-variant of a built-in must NOT create a second row"


async def test_case_variant_of_override_rejected_409(monkeypatch):
    """``GLM-4.5`` (case variant of an existing override ``glm-4.5``) → 409, NOT a second row."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    _stub_overrides(monkeypatch, {"glm-4.5": {"provider": "zhipu", "enabled": True}})

    body = AddModelRequest(model_id="GLM-4.5", provider="zhipu")
    with pytest.raises(HTTPException) as ei:
        await add_model_by_id(_fake_request(), body, _floor=None)
    assert ei.value.status_code == 409
    assert not pool.calls, "a case-variant of an override must NOT create a second row"


async def test_duplicate_race_unique_violation_409(monkeypatch):
    """WR-01: the case-folded cache guard can miss a concurrent add under WORKER_COUNT=2 (per-worker
    30s override cache). The DB ``model_id`` unique constraint is the backstop — a
    ``UniqueViolationError`` from the pool maps to 409 (fail safe: never a silent clobber, never a
    false 500), and the row is NOT cache-invalidated."""
    import asyncpg

    class _ConflictPool:
        def __init__(self):
            self.calls = []

        async def execute(self, sql, *args):
            self.calls.append((sql, args))
            raise asyncpg.exceptions.UniqueViolationError("duplicate key value violates unique constraint")

    pool = _ConflictPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    flag = _spy_invalidate(monkeypatch)
    _stub_overrides(monkeypatch, {})  # cache guard PASSES — this is the race (stale cache)

    body = AddModelRequest(model_id="kimi-k3", provider="moonshot")
    with pytest.raises(HTTPException) as ei:
        await add_model_by_id(_fake_request(), body, _floor=None)
    assert ei.value.status_code == 409, "a DB unique violation must map to 409, not 500"
    assert len(pool.calls) == 1, "the insert was attempted (the race slipped past the cache guard)"
    assert flag["called"] is False, "no cache invalidation on a refused add"


# ── enabled:true in the body is IGNORED (the field isn't on AddModelRequest) ────

async def test_enabled_in_body_is_ignored_row_lands_false(monkeypatch):
    """A body carrying ``enabled:true`` is IGNORED — AddModelRequest has no such field, so the
    persisted row is still ``enabled=false`` (the model forces False, the field can't be set)."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    _spy_invalidate(monkeypatch)
    _stub_overrides(monkeypatch, {})

    body = AddModelRequest.model_validate(
        {"model_id": "sneaky-1", "provider": "openai", "enabled": True}
    )
    assert not hasattr(body, "enabled"), "AddModelRequest must not carry an enabled field"

    out = await add_model_by_id(_fake_request(), body, _floor=None)
    assert out["enabled"] is False
    _, args = pool.calls[0]
    # No caps + no native_tools set → the only bools bound are deprecated(False) + enabled(False);
    # a True anywhere would mean an auto-enable slipped through.
    assert True not in args, "no True may be bound — the add can never auto-enable"
    assert args[-1] is False, "enabled is bound the forced literal False"


# ── Honest failure: a persist error → 500 + model.add_failed (never a false 2xx) ─

async def test_persistence_failure_500_and_add_failed(monkeypatch):
    """A DB failure → 500 + a ``model.add_failed`` receipt; the cache is NOT invalidated."""
    pool = _RecordingPool(fail=True)
    monkeypatch.setattr(deps, "_pg_pool", pool)
    flag = _spy_invalidate(monkeypatch)
    _stub_overrides(monkeypatch, {})
    req = _fake_request()

    body = AddModelRequest(model_id="kimi-k3", provider="moonshot")
    with pytest.raises(HTTPException) as ei:
        await add_model_by_id(req, body, _floor=None)
    assert ei.value.status_code == 500
    assert req.state.audit_action == "model.add_failed"
    assert flag["called"] is False, "no cache invalidation when the write did not persist"


# ── Non-operator 404 (the new POST route's OWN regression test — 146 gate) ──────

def test_post_model_404_for_non_operator(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """A non-operator JWT gets a byte-identical 404 on POST /admin/models (router gate); no
    upsert may run — the gate 404s BEFORE the handler."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)  # operator_users lookup → no row
    res = client.post(
        "/admin/models", headers=auth_headers, json={"model_id": "x", "provider": "openai"}
    )
    assert res.status_code == 404
    assert res.json() == {"detail": "Not Found"}
    upserts = [c for c in mock_asyncpg_pool.calls
               if "model_capabilities_overrides" in c[0] and "INSERT" in c[0].upper()]
    assert not upserts, "the gate must 404 a non-operator BEFORE any add write"
