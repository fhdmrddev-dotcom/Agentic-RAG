"""Phase 149 Plan 05 (MODEL-01 / T-149-11/12) — the SQLi-safe capability write.

PATCH /admin/models/{model_id}:
  - an unknown field → 422 BEFORE any SQL (the allowlist is the SQLi wall);
  - a valid patch → a parameterized upsert + invalidate_model_overrides_cache() +
    ``model.capability.set`` receipt;
  - an explicit ``null`` clears that column to DEF (SQL NULL) while an OMITTED sibling is
    left untouched (null-clears vs absent-untouched — the D-149-02 Reset mechanism);
  - a persistence failure → 500 + a ``*.write_failed`` receipt (never a false 2xx).

Tests call the handler ``set_model_capability`` directly with a fake Request so the
``request.state`` stamps + the recorded upsert (SQL/params) are asserted precisely; the
non-operator 404 gate is covered in test_149_model_gate.py. The pool is driven via
``app.dependencies._pg_pool`` (CR-02 — the LIVE module attr the handler reads).
"""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import app.api.admin as admin_mod
import app.dependencies as deps
from app.api.admin import _MODEL_CAP_COLUMNS, set_model_capability


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
        method="PATCH",
        url=SimpleNamespace(path="/admin/models/gpt-4o"),
    )


def _spy_invalidate(monkeypatch):
    flag = {"called": False}
    monkeypatch.setattr(
        admin_mod, "invalidate_model_overrides_cache",
        lambda: flag.__setitem__("called", True),
    )
    return flag


def test_columns_constant_is_exactly_the_seven_editable():
    assert _MODEL_CAP_COLUMNS == {
        "llm_call_timeout_seconds", "context_window_tokens", "max_output_tokens",
        "native_tools", "enabled", "deprecated", "deprecated_reason",
    }


async def test_unknown_field_rejected_before_any_sql(monkeypatch):
    """A body key outside the allowlist → 422, and NO SQL runs (the reject path)."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    flag = _spy_invalidate(monkeypatch)

    with pytest.raises(HTTPException) as ei:
        await set_model_capability(
            "gpt-4o", {"bogus_col": 1, "enabled": False}, _fake_request(), _floor=None
        )
    assert ei.value.status_code == 422
    assert not pool.calls, "no SQL may run when an unknown field is present"
    assert flag["called"] is False, "no cache invalidation on the reject path"


async def test_wrong_typed_enabled_string_rejected_422(monkeypatch):
    """WR-01: ``enabled`` sent as the STRING "true" → 422 BEFORE any SQL (never a 500)."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)

    with pytest.raises(HTTPException) as ei:
        await set_model_capability("gpt-4o", {"enabled": "true"}, _fake_request(), _floor=None)
    assert ei.value.status_code == 422
    assert not pool.calls, "a wrong-typed value must be rejected before any SQL"


async def test_wrong_typed_int_column_string_rejected_422(monkeypatch):
    """WR-01: ``max_output_tokens`` sent as a non-numeric string → 422 (not a 500)."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)

    with pytest.raises(HTTPException) as ei:
        await set_model_capability("gpt-4o", {"max_output_tokens": "big"}, _fake_request(), _floor=None)
    assert ei.value.status_code == 422
    assert not pool.calls


async def test_bool_for_int_column_rejected_422(monkeypatch):
    """WR-01: a bool for an int column → 422 (bool is an int subclass, rejected explicitly)."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)

    with pytest.raises(HTTPException) as ei:
        await set_model_capability("gpt-4o", {"max_output_tokens": True}, _fake_request(), _floor=None)
    assert ei.value.status_code == 422
    assert not pool.calls


async def test_valid_patch_upserts_invalidates_and_stamps(monkeypatch):
    """A valid patch → a parameterized upsert + invalidate + model.capability.set stamp."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    flag = _spy_invalidate(monkeypatch)
    req = _fake_request()

    await set_model_capability("gpt-4o", {"context_window_tokens": 200000}, req, _floor=None)

    assert len(pool.calls) == 1
    sql, args = pool.calls[0]
    assert "INSERT INTO model_capabilities_overrides" in sql
    assert "ON CONFLICT (model_id) DO UPDATE" in sql
    assert "context_window_tokens" in sql
    assert 200000 in args, "the value is bound as a parameter ($N), never interpolated"
    assert "gpt-4o" in args, "the model_id is stored verbatim as a bound param"
    assert flag["called"] is True
    assert req.state.audit_action == "model.capability.set"


async def test_explicit_null_clears_while_omitted_untouched(monkeypatch):
    """An explicit null for a column writes SQL NULL (clear→DEF); an OMITTED column is
    never touched (null-clears vs absent-untouched — the D-149-02 Reset)."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    _spy_invalidate(monkeypatch)

    # max_output_tokens sent as explicit null; context_window_tokens OMITTED.
    await set_model_capability("gpt-4o", {"max_output_tokens": None}, _fake_request(), _floor=None)

    sql, args = pool.calls[0]
    assert "max_output_tokens" in sql, "the explicit-null column IS written (cleared)"
    assert None in args, "an explicit null is bound as SQL NULL (clears the override to DEF)"
    assert "context_window_tokens" not in sql, "an OMITTED column is never touched (untouched)"


async def test_omitted_only_body_is_noop_success(monkeypatch):
    """An empty patch changes nothing and never writes a bare all-DEF override row."""
    pool = _RecordingPool()
    monkeypatch.setattr(deps, "_pg_pool", pool)
    flag = _spy_invalidate(monkeypatch)
    req = _fake_request()

    out = await set_model_capability("gpt-4o", {}, req, _floor=None)
    assert out["changed"] == []
    assert not pool.calls, "an empty patch must not write a bare override row"
    assert flag["called"] is False


async def test_persistence_failure_500_and_write_failed(monkeypatch):
    """A DB failure → 500 + a model.capability.write_failed receipt (no false 2xx)."""
    pool = _RecordingPool(fail=True)
    monkeypatch.setattr(deps, "_pg_pool", pool)
    flag = _spy_invalidate(monkeypatch)
    req = _fake_request()

    with pytest.raises(HTTPException) as ei:
        await set_model_capability("gpt-4o", {"enabled": False}, req, _floor=None)
    assert ei.value.status_code == 500
    assert req.state.audit_action == "model.capability.write_failed"
    assert flag["called"] is False, "no cache invalidation when the write did not persist"
