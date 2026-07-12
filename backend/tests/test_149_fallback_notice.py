"""Phase 149 Plan 06 (MODEL-02 / D-149-10, T-149-16) — the disabled-model fallback.

The enabled-enforcement guard at the ONE shared threads.py model-resolution seam:
  - a resolved model with a DISABLED override → resolution falls back to the org default
    AND an honest notice naming BOTH models is produced (never silent, never mid-run break);
  - an enabled / no-override model → NO fallback, NO notice (the shared path is byte-identical);
  - the emitted SSE notice (via the canonical _emit shape) carries both model names + a
    plain-language message on the run stream.

The seam logic lives in the pure helper ``_resolve_enabled_model`` (unit-tested here so the
huge send_message handler need not be driven), and the wire payload is proven by emitting
through the real ``_emit`` into a fake Redis. The disabled set comes from the CACHED all-rows
override read (``load_all_model_overrides``) — the enabled-only hot cache is never touched.
"""
import json
from unittest.mock import AsyncMock
from uuid import uuid4

import app.api.threads as threads_mod
from app.api.threads import _emit, _resolve_enabled_model


class _FakeRedis:
    """Minimal async Redis capturing every XADD (stream, decoded fields)."""

    def __init__(self):
        self.xadds = []

    async def xadd(self, stream, fields, *args, **kwargs):
        decoded = {
            (k.decode() if isinstance(k, (bytes, bytearray)) else k):
            (v.decode() if isinstance(v, (bytes, bytearray)) else v)
            for k, v in fields.items()
        }
        self.xadds.append((stream, decoded))
        return f"{len(self.xadds)}-0"


async def test_disabled_model_falls_back_and_names_both(monkeypatch):
    """A disabled resolved model → the effective model becomes the org default + a notice
    naming BOTH models is produced."""
    monkeypatch.setattr(
        threads_mod, "load_all_model_overrides",
        AsyncMock(return_value={"gpt-4o": {"enabled": False}}),
    )

    effective, notice = await _resolve_enabled_model("gpt-4o", "claude-opus-4-8")

    assert effective == "claude-opus-4-8", "a disabled model must fall back to the org default"
    assert notice is not None, "the fallback must not be silent"
    assert notice["disabled_model"] == "gpt-4o"
    assert notice["fallback_model"] == "claude-opus-4-8"
    # Both model names appear in the honest inline message.
    assert "gpt-4o" in notice["message"]
    assert "claude-opus-4-8" in notice["message"]


async def test_dead_default_surfaces_honest_notice_and_logs(monkeypatch, caplog):
    """WR-03/WR-04 defense-in-depth: if the org default is ITSELF disabled (a dead default
    that slipped past the Plan-06 write-side guards under multi-worker cache staleness), the
    fallback still returns an HONEST notice — never a silent route to a disabled model — and
    the re-verify logs the anomaly."""
    monkeypatch.setattr(
        threads_mod, "load_all_model_overrides",
        AsyncMock(return_value={
            "gpt-4o": {"enabled": False},
            "claude-opus-4-8": {"enabled": False},  # the org default is a DEAD default
        }),
    )

    with caplog.at_level("WARNING"):
        effective, notice = await _resolve_enabled_model("gpt-4o", "claude-opus-4-8")

    # The fallback still fires an honest notice (never a silent None) even though the org
    # default is itself disabled — we never silently serve a disabled model.
    assert notice is not None
    assert notice["disabled_model"] == "gpt-4o"
    assert notice["fallback_model"] == "claude-opus-4-8"
    # The dead-default anomaly is logged (the re-verify path executed).
    assert any("dead default" in r.getMessage().lower() for r in caplog.records)


async def test_enabled_model_no_fallback_no_notice(monkeypatch):
    """An enabled override → NO fallback, NO notice (shared path unchanged)."""
    monkeypatch.setattr(
        threads_mod, "load_all_model_overrides",
        AsyncMock(return_value={"gpt-4o": {"enabled": True}}),
    )
    effective, notice = await _resolve_enabled_model("gpt-4o", "claude-opus-4-8")
    assert effective == "gpt-4o"
    assert notice is None


async def test_absent_override_is_byte_identical(monkeypatch):
    """A model with NO override row → no fallback, no notice (default-enabled)."""
    monkeypatch.setattr(
        threads_mod, "load_all_model_overrides", AsyncMock(return_value={})
    )
    effective, notice = await _resolve_enabled_model("some-model", "claude-opus-4-8")
    assert effective == "some-model"
    assert notice is None


async def test_override_read_blip_never_breaks(monkeypatch):
    """A settings-read failure is swallowed — the model resolves unchanged (no fallback)."""
    async def _boom():
        raise RuntimeError("db down")

    monkeypatch.setattr(threads_mod, "load_all_model_overrides", _boom)
    effective, notice = await _resolve_enabled_model("gpt-4o", "claude-opus-4-8")
    assert effective == "gpt-4o"
    assert notice is None


async def test_fallback_notice_emit_names_both_on_the_wire(monkeypatch):
    """The emitted SSE notice carries the model_disabled_fallback type + BOTH names."""
    monkeypatch.setattr(
        threads_mod, "load_all_model_overrides",
        AsyncMock(return_value={"gpt-4o": {"enabled": False}}),
    )
    _effective, notice = await _resolve_enabled_model("gpt-4o", "claude-opus-4-8")

    redis = _FakeRedis()
    run_id = uuid4()
    await _emit(redis, run_id, "model_disabled_fallback", **notice)

    assert len(redis.xadds) == 1
    stream, fields = redis.xadds[0]
    assert stream == f"run:{run_id}"
    payload = json.loads(fields["data"])
    assert payload["type"] == "model_disabled_fallback"
    assert payload["disabled_model"] == "gpt-4o"
    assert payload["fallback_model"] == "claude-opus-4-8"
    assert "gpt-4o" in payload["message"] and "claude-opus-4-8" in payload["message"]
