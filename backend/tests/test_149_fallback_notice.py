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


# ---------------------------------------------------------------------------
# Phase 149 Plan 09 Task 1 (D-149-10 bookkeeping honesty) — after a disabled-model
# fallback the RECORDED provider must be re-resolved to the EFFECTIVE (fallback)
# model's provider, so runs.provider matches the model that actually served the run
# (the UAT Test-7 secondary wart: a MiniMax-served fallback recorded provider='anthropic').
# The re-resolve is a pure, additive helper (`_reresolve_fallback_provider`) driven off
# the same cached `get_model_capability_async` the send_message handler already calls —
# no restructure of the existing if/else provider block, routing unchanged.
# ---------------------------------------------------------------------------
async def test_fallback_run_records_effective_provider(monkeypatch):
    """A disabled-model fallback → the provider that reaches register_run_start is
    re-resolved from the EFFECTIVE (fallback) model. Selected an anthropic model that the
    operator just disabled; the org default is a minimax model → the run must record
    provider='minimax', NOT the pre-fallback 'anthropic'."""
    monkeypatch.setattr(
        threads_mod, "load_all_model_overrides",
        AsyncMock(return_value={"claude-opus-4-8": {"enabled": False}}),
    )

    async def _fake_capability(model_id):
        # The org-default fallback model is served by minimax.
        return {"provider": "minimax", "capability_source": "db_override"}

    monkeypatch.setattr(threads_mod, "get_model_capability_async", _fake_capability)

    effective, notice = await _resolve_enabled_model("claude-opus-4-8", "MiniMax-M2.7-highspeed")
    assert effective == "MiniMax-M2.7-highspeed"
    assert notice is not None, "a fallback must fire"

    # Pre-fallback the recorded provider was 'anthropic'; the re-resolve corrects it to the
    # fallback model's provider (minimax) — the runs row no longer lies about who served it.
    recorded = await threads_mod._reresolve_fallback_provider(effective, "anthropic")
    assert recorded == "minimax"


async def test_reresolve_provider_guards_garbage_capability(monkeypatch):
    """A garbage / 'unknown' capability never yanks the recorded provider — the guard keeps
    the pre-fallback provider (byte-identical, no dishonest re-record)."""
    async def _unknown_capability(model_id):
        return {"provider": "unknown"}

    monkeypatch.setattr(threads_mod, "get_model_capability_async", _unknown_capability)
    assert await threads_mod._reresolve_fallback_provider("garbage-model", "anthropic") == "anthropic"


async def test_reresolve_provider_handles_none_capability(monkeypatch):
    """A None capability (no registry/DB row at all) keeps the provider unchanged too —
    the no-usable-capability path never blanks or garbles runs.provider."""
    async def _none_capability(model_id):
        return None

    monkeypatch.setattr(threads_mod, "get_model_capability_async", _none_capability)
    assert await threads_mod._reresolve_fallback_provider("mystery", "openai") == "openai"


async def test_reresolve_provider_rejects_inferred_capability(monkeypatch):
    """WR-01 (review round 2): post-075.3 a registry/DB miss never returns
    provider='unknown' — it returns a pattern-INFERRED provider with
    capability_source='inferred' (slashed ids → openrouter, garbage → ollama). The
    re-resolve must KEEP the current provider for that shape: an org default absent from
    the registry/DB must never yank runs.provider + live SDK routing to an inference
    bucket (a slashed local-model default routed to OpenRouter is the BUG-260616-01
    data-egress class — D-075.3-08 semantics, same as the provider-resolution block)."""
    async def _inferred_capability(model_id):
        # The real-world garbage shape: an LM-Studio-style slashed id inferred → openrouter.
        return {"provider": "openrouter", "capability_source": "inferred"}

    monkeypatch.setattr(threads_mod, "get_model_capability_async", _inferred_capability)
    assert await threads_mod._reresolve_fallback_provider("google/gemma-3-4b", "ollama") == "ollama"


async def test_reresolve_provider_accepts_db_override_capability(monkeypatch):
    """WR-01 companion: a discovery-confirmed DB-only model (capability_source=
    'db_override') IS operator-verified — the re-resolve accepts it (alongside
    'registry'), so DB-catalog fallback targets still record honestly."""
    async def _db_capability(model_id):
        return {"provider": "minimax", "capability_source": "db_override"}

    monkeypatch.setattr(threads_mod, "get_model_capability_async", _db_capability)
    assert await threads_mod._reresolve_fallback_provider("MiniMax-M2.5", "anthropic") == "minimax"


# ---------------------------------------------------------------------------
# Review round-2 CR-01 — the fallback must change the model ACTUALLY SENT, not just
# the bookkeeping. The LLM request model is always body.model (agent_loop.py native
# + compat paths → the gateway's model=request.model; ctx.resolved_model is a dead
# local there), so `_apply_fallback_to_request` must rewrite body.model to the
# EFFECTIVE fallback model. Before the fix, a cross-provider fallback aimed the
# still-DISABLED model at the fallback model's provider (400/404 hard-fail — the
# UAT Test-7 shape) and a same-provider fallback silently served the disabled model
# under a notice claiming otherwise. These tests drive the REAL seam helper with a
# REAL MessageCreate + REAL override_provider (no fixture-masking of the served
# model), plus a wire-level test asserting the model handed to the gateway.
# ---------------------------------------------------------------------------
def _settings_with_providers():
    """A real UserEffectiveSettings (model_construct — only the fields the seam touches)
    with anthropic (current) + minimax (fallback target) BOTH key-configured."""
    from app.models.user_settings import LLMProvider, UserEffectiveSettings

    return UserEffectiveSettings.model_construct(
        llm_api_key="sk-anthropic",
        llm_base_url="https://api.anthropic.com",
        llm_model="MiniMax-M2.5-highspeed",
        available_models=[],
        active_provider="anthropic",
        providers=[
            LLMProvider(
                id="anthropic", name="Anthropic",
                base_url="https://api.anthropic.com", api_key="sk-anthropic",
            ),
            LLMProvider(
                id="minimax", name="MiniMax",
                base_url="https://api.minimax.io/v1", api_key="sk-minimax",
            ),
        ],
    )


async def test_fallback_rewrites_outbound_body_model(monkeypatch):
    """CR-01: a cross-provider fallback rewrites body.model to the EFFECTIVE fallback
    model AND re-resolves provider/credentials — the outbound request is coherent
    (fallback model at the fallback model's provider), never the disabled model aimed
    at a provider that cannot serve it."""
    from app.models.message import MessageCreate

    async def _fake_capability(model_id):
        return {"provider": "minimax", "capability_source": "registry"}

    monkeypatch.setattr(threads_mod, "get_model_capability_async", _fake_capability)

    body = MessageCreate(content="hi", model="claude-haiku-4-5-20251001")
    new_body, provider, new_settings = await threads_mod._apply_fallback_to_request(
        body, "MiniMax-M2.5-highspeed", "anthropic", _settings_with_providers()
    )

    # THE CR-01 assertion: the outbound request model IS the fallback model.
    assert new_body.model == "MiniMax-M2.5-highspeed", (
        "body.model is what the agent loop / gateway send — it must carry the "
        "EFFECTIVE fallback model, never the disabled one"
    )
    assert new_body.content == "hi"  # the rest of the request is untouched
    # The plan-09 provider re-resolve still lands: routing + runs.provider go minimax.
    assert provider == "minimax"
    assert new_settings.active_provider == "minimax"
    assert new_settings.llm_api_key == "sk-minimax"


async def test_same_provider_fallback_still_rewrites_model(monkeypatch):
    """CR-01 (the false-notice half): a SAME-provider fallback (disabled gpt-4o-mini →
    org default gpt-4o) has a no-op provider flip, but body.model must STILL be
    rewritten — otherwise the disabled model is silently served while the inline
    notice tells the user the fallback model replied."""
    from app.models.message import MessageCreate

    async def _fake_capability(model_id):
        return {"provider": "anthropic", "capability_source": "registry"}

    monkeypatch.setattr(threads_mod, "get_model_capability_async", _fake_capability)

    settings = _settings_with_providers()
    body = MessageCreate(content="hi", model="claude-haiku-4-5-20251001")
    new_body, provider, new_settings = await threads_mod._apply_fallback_to_request(
        body, "claude-opus-4-8", "anthropic", settings
    )

    assert new_body.model == "claude-opus-4-8", (
        "a same-provider fallback must still swap the served model (the notice names it)"
    )
    assert provider == "anthropic"  # provider unchanged — the flip is a no-op
    assert new_settings is settings  # no credential switch needed


async def test_gateway_receives_effective_model_from_body():
    """CR-01 wire-level regression: drive the REAL run_agent_loop with the post-seam
    request state (body.model = the fallback model) and assert the model handed to the
    gateway's create_adaptive_streaming_chat IS body.model. This pins the seam invariant
    the plan-09 unit tests masked: the request model on the wire comes from body.model,
    so the threads.py rewrite is what makes the fallback real end-to-end."""
    import asyncio
    from unittest.mock import MagicMock, patch

    from app.services.agent_loop import RunContext, run_agent_loop
    from app.services.openai_service import CallingMode
    from tests.integration._run_helpers import _build_mock_supabase, _make_result

    thread_id = str(uuid4())

    def _chunk(content, finish_reason=None):
        c = MagicMock()
        c.usage = None
        c.choices = [MagicMock()]
        c.choices[0].finish_reason = finish_reason
        delta = MagicMock()
        delta.content = content
        delta.tool_calls = None
        delta.reasoning_content = None
        c.choices[0].delta = delta
        return c

    def _chunks():
        yield _chunk("ok")
        yield _chunk(None, finish_reason="stop")

    mock_supabase = _build_mock_supabase()
    mock_supabase.table("threads").execute.side_effect = (
        lambda *a, **k: _make_result({"id": thread_id, "folder_id": None})
    )

    redis_mock = MagicMock()
    redis_mock.xadd = AsyncMock(return_value=b"1-0")
    redis_mock.expire = AsyncMock(return_value=True)

    user_settings = MagicMock()
    user_settings.active_provider = "minimax"  # compat path (not anthropic/google native)
    user_settings.llm_model = "MiniMax-M2.5-highspeed"
    user_settings.llm_api_key = "sk-minimax"
    user_settings.llm_base_url = "https://api.minimax.io/v1"
    user_settings.openrouter_tool_strategy = "quality"
    user_settings.web_search_enabled = False
    user_settings.sandbox_enabled = False
    user_settings.task_per_run_concurrency = 3

    body = MagicMock()
    body.model = "MiniMax-M2.5-highspeed"  # the post-seam EFFECTIVE (fallback) model
    body.provider = None
    body.agent_mode = "general"
    body.content = "fallback wire test"

    ctx = RunContext(
        run_id=uuid4(),
        thread_id=thread_id,
        current_user={"id": "00000000-0000-0000-0000-000000000001"},
        user_settings=user_settings,
        body=body,
        redis=redis_mock,
        supabase=mock_supabase,
        resolved_model="MiniMax-M2.5-highspeed",
        resolved_provider="minimax",
    )

    captured: dict = {}

    def _capture_stream(*args, **kwargs):
        captured["model"] = kwargs.get("model")
        return (iter(_chunks()), CallingMode.NATIVE)

    with patch(
        "app.services.provider_gateway.openai_compat.create_adaptive_streaming_chat",
        side_effect=_capture_stream,
    ), patch(
        "app.services.agent_loop.get_pg_pool",
        new=AsyncMock(return_value=MagicMock()),
    ), patch(
        "app.services.agent_loop.insert_assistant_message",
        new=AsyncMock(return_value=uuid4()),
    ), patch(
        "app.services.suggestion_service.generate_suggestions",
        return_value=([], None),
    ):
        await run_agent_loop(
            ctx,
            emit=AsyncMock(return_value=None),
            emit_terminal=AsyncMock(return_value=None),
            spawn=lambda coro: asyncio.ensure_future(coro),
            result_sink={},
        )

    assert captured.get("model") == "MiniMax-M2.5-highspeed", (
        "the model handed to the gateway must equal body.model (the effective fallback "
        f"model) — got {captured.get('model')!r}"
    )
    assert captured["model"] == ctx.body.model
