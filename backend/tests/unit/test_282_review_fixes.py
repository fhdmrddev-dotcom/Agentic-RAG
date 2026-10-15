"""Phase 282 code review (282-REVIEW.md) — one RED-driven pin per fixed finding.

Each test here was run FAILING against ``3268b6228`` (the reviewed HEAD) before its fix landed,
so it proves the defect the review CLAIMED rather than restating the fix.

- CR-01: the SDK retry count follows the provider that chose the ENDPOINT (the routing provider
  ``open_stream`` was called with), never the registry vendor of the model id.
- WR-01: an open still queued for a thread when the guard fires never starts a request.
- WR-02: a sub-agent ended by the per-call timeout records WHY, not an empty string.
- WR-03: forced_emit treats a per-call timeout as terminal for its ladder.
- WR-04: an env override above the ceiling clamps to it, like the DB tier, rather than dropping.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import app.config as config
from app.services import openai_service
from app.services.provider_gateway import dispatcher, openai_compat, openai_responses
from app.services.provider_gateway.dispatcher import GatewayRequest


class _Stop(Exception):
    """Raised by a recorder once it has captured its kwargs."""


def _compat_recorder(record: dict):
    def _fake(**kwargs):
        record.update(kwargs)
        raise _Stop

    return _fake


# ── CR-01 ─────────────────────────────────────────────────────────────────────────────────


def test_cr01_compat_retries_follow_the_endpoint_provider_not_the_registry_vendor(monkeypatch):
    """An LM Studio model id shaped ``qwen/qwen3-30b-a3b`` resolves to registry vendor
    ``openrouter`` (the review measured it with the live resolver), while the client is pointed
    at LM Studio by ``user_settings``. The local GPU must be tried ONCE (D-19)."""
    rec: dict = {}
    monkeypatch.setattr(openai_compat, "create_adaptive_streaming_chat", _compat_recorder(rec))
    req = GatewayRequest(
        messages=[],
        model="qwen/qwen3-30b-a3b",
        active_provider_name="openrouter",
        user_settings=SimpleNamespace(active_provider="lmstudio"),
        timeout_s=900,
    )
    with pytest.raises(_Stop):
        openai_compat.open_openai_compat_stream(req)
    assert rec["max_retries"] == 0


async def test_cr01_open_stream_stamps_its_routing_provider_on_the_request(monkeypatch):
    """``open_stream``'s first argument IS the routing provider at every caller (agent_loop:
    ``user_settings.active_provider``; task_service: ``_provider``; forced_emit: the target,
    whose endpoint it injects). No user_settings at all → that argument still decides."""
    rec: dict = {}
    monkeypatch.setattr(openai_compat, "create_adaptive_streaming_chat", _compat_recorder(rec))
    monkeypatch.setattr(openai_service, "resolve_api_surface", lambda *_a, **_k: None)
    req = GatewayRequest(
        messages=[], model="deepseek-r1:14b", active_provider_name="deepseek", timeout_s=900
    )
    with pytest.raises(_Stop):
        await dispatcher.open_stream("ollama", req)
    assert rec["max_retries"] == 0


def test_cr01_cloud_routing_keeps_cloud_retries(monkeypatch):
    rec: dict = {}
    monkeypatch.setattr(openai_compat, "create_adaptive_streaming_chat", _compat_recorder(rec))
    req = GatewayRequest(
        messages=[],
        model="qwen/qwen3-30b-a3b",
        active_provider_name="openrouter",
        user_settings=SimpleNamespace(active_provider="openrouter"),
        timeout_s=900,
    )
    with pytest.raises(_Stop):
        openai_compat.open_openai_compat_stream(req)
    assert rec["max_retries"] == 2


def test_cr01_responses_adapter_keys_retries_on_the_same_routing_provider(monkeypatch):
    rec: dict = {}

    def _fake(user_settings=None, **kw):
        rec.update(kw)
        raise _Stop

    monkeypatch.setattr(openai_responses, "get_llm_client", _fake)
    req = GatewayRequest(
        messages=[],
        model="gpt-5.6",
        active_provider_name="openai",
        user_settings=SimpleNamespace(active_provider="lmstudio"),
        timeout_s=900,
    )
    with pytest.raises(_Stop):
        openai_responses.open_openai_responses_stream(req)
    assert rec["max_retries"] == 0


# ── WR-01 ─────────────────────────────────────────────────────────────────────────────────


async def test_wr01_an_open_still_queued_when_the_guard_fires_never_starts(monkeypatch):
    """Simulate a saturated default executor: the thread hop waits 0.3 s before running the
    open, and the run's budget is 0.05 s. The guard fires first; the shielded work item must
    then NOT open a request nobody will read."""
    opened: list = []

    def _fake_open(request):
        opened.append(request)
        raise _Stop

    real_to_thread = asyncio.to_thread

    async def _queued_to_thread(fn, *args, **kwargs):
        await asyncio.sleep(0.3)
        return await real_to_thread(fn, *args, **kwargs)

    monkeypatch.setattr(dispatcher, "_open_openai_family", _fake_open)
    monkeypatch.setattr(dispatcher.asyncio, "to_thread", _queued_to_thread)
    req = GatewayRequest(messages=[], model="m", active_provider_name="openai", timeout_s=0.05)
    with pytest.raises(TimeoutError):
        await dispatcher._open_off_loop(req)
    await asyncio.sleep(0.5)  # let the shielded work item run to its end
    assert opened == []


# ── WR-02 ─────────────────────────────────────────────────────────────────────────────────


def _parent_ctx():
    from app.services.tool_dispatcher import ToolContext

    ctx = MagicMock(spec=ToolContext)
    ctx.redis = MagicMock()
    ctx.run_id = "00000000-0000-0000-0000-000000000002"
    ctx.current_user = {"id": "00000000-0000-0000-0000-000000000003"}
    ctx.user_settings = MagicMock()
    ctx.user_settings.active_provider = "lmstudio"
    ctx.user_settings.sub_agent_model = "qwen/qwen3-30b-a3b"
    ctx.model = "qwen/qwen3-30b-a3b"
    ctx.thread_id = "00000000-0000-0000-0000-000000000001"
    ctx.pool = MagicMock()
    ctx.supabase = MagicMock()
    ctx.spawn = MagicMock()
    ctx.emit = AsyncMock()
    ctx.scoped_folder_path = None
    ctx.folder_subtree_ids = None
    ctx.dead_gap_tokens_in_run = set()
    ctx.skill_instructions_override = None
    ctx.phase_whitelist = None
    ctx.workflow_run_id = None
    ctx.skill_snapshot = None
    ctx.per_run_task_semaphore = None
    ctx.parent_run_id = None
    return ctx


async def test_wr02_a_timed_out_sub_agent_records_why():
    from app.services.task_service import run_task_sub_agent

    finalize = AsyncMock()
    # The REAL _stream_one_iteration runs; only the gateway open times out, exactly as the
    # 282 open guard does (a bare TimeoutError whose str() is "").
    with patch("app.services.task_service.open_stream", AsyncMock(side_effect=TimeoutError())), \
         patch("app.config.get_model_capability_async", AsyncMock(return_value={"provider": "openrouter"})), \
         patch("app.services.task_service.get_per_call_timeout_async", AsyncMock(return_value=900)), \
         patch("app.services.task_service.get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch("app.services.task_service.insert_run", AsyncMock()), \
         patch("app.services.task_service.finalize_run", finalize):
        res = await run_task_sub_agent(
            parent_ctx=_parent_ctx(),
            description="Summarise the brief",
            instructions=None,
            allowed_tools=[],
            max_steps=3,
        )

    error = finalize.await_args.kwargs["error"]
    assert error.startswith("timed_out: 900s per-call deadline exceeded")
    assert "did not answer within 900 s" in error
    assert "Model Registry" in error
    assert res["summary"] == f"Sub-agent failed: {error}"


async def test_wr02_an_empty_exception_message_still_names_the_exception():
    from app.services.task_service import run_task_sub_agent

    class _Silent(Exception):
        pass

    finalize = AsyncMock()
    with patch("app.services.task_service._stream_one_iteration", AsyncMock(side_effect=_Silent())), \
         patch("app.services.task_service.get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch("app.services.task_service.insert_run", AsyncMock()), \
         patch("app.services.task_service.finalize_run", finalize):
        res = await run_task_sub_agent(
            parent_ctx=_parent_ctx(),
            description="Summarise the brief",
            instructions=None,
            allowed_tools=[],
            max_steps=3,
        )
    assert finalize.await_args.kwargs["error"] == "_Silent"
    assert res["summary"] == "Sub-agent failed: _Silent"


# ── WR-03 ─────────────────────────────────────────────────────────────────────────────────


async def test_wr03_a_timeout_ends_the_ladder_instead_of_resending_the_prompt(monkeypatch):
    import app.services.forced_emit as fe

    calls: list = []

    async def _timing_out_open(provider, request):
        calls.append(request)
        raise TimeoutError()

    monkeypatch.setattr(fe, "open_stream", _timing_out_open)
    monkeypatch.setattr(fe, "get_model_capability", lambda _m: {"emit_tier": "force_strict"})
    monkeypatch.setattr(fe, "get_per_call_timeout_async", AsyncMock(return_value=900))
    result = await fe.forced_emit(
        messages=[{"role": "user", "content": "fill it"}],
        model="qwen/qwen3-30b-a3b",
        provider="lmstudio",
        emitter="emit_fields",
        tools=[],
        user_settings=None,
    )
    assert len(calls) == 1, "a timed-out rung must not re-send the prompt on the next rung"
    assert result["emitted"] is None
    assert result["failure"] == "provider_error"
    assert result["truncated"] is False


async def test_wr03_a_non_timeout_raise_still_descends(monkeypatch):
    import app.services.forced_emit as fe

    calls: list = []

    async def _failing_open(provider, request):
        calls.append(request)
        raise RuntimeError("400 strict schema")

    monkeypatch.setattr(fe, "open_stream", _failing_open)
    monkeypatch.setattr(fe, "get_model_capability", lambda _m: {"emit_tier": "force_strict"})
    monkeypatch.setattr(fe, "get_per_call_timeout_async", AsyncMock(return_value=900))
    result = await fe.forced_emit(
        messages=[{"role": "user", "content": "fill it"}],
        model="gpt-5.6",
        provider="openai",
        emitter="emit_fields",
        tools=[],
        user_settings=None,
    )
    assert len(calls) == 3
    assert result["failure"] == "provider_error"


# ── WR-04 ─────────────────────────────────────────────────────────────────────────────────


def test_wr04_env_override_above_the_ceiling_clamps_like_the_db_tier():
    out = config._parse_llm_call_timeout_overrides("my-local=2400,cloud-x=600")
    assert out == {"my-local": config._LLM_CALL_TIMEOUT_MAX_S, "cloud-x": 600}


@pytest.mark.parametrize("bad", ["0", "-5", "abc", "900.5"])
def test_wr04_env_override_below_one_or_non_integer_is_still_dropped(bad):
    assert config._parse_llm_call_timeout_overrides(f"my-local={bad}") == {}
