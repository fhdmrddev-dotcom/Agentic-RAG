"""Phase 085 Plan 02 — task_service + sub_agent_models unit tests.

Covers:
  - Resolver Tests 1-3: resolve_sub_agent_model_safely behavior
    - No override -> returns user_settings.llm_model
    - Override in active provider's llm_models list -> passes through
    - Override cross-provider (not in list) -> falls back to provider default
  - Settings Test 4: config has 4 Phase 085 fields with expected defaults
  - Scaffold Test 5 (Wave 0): task_service module is importable

Handler-level tests (nesting cap / toolset validation / max_steps clamp /
per-run + global concurrency caps / happy path) live further down and are
populated by Tasks 3-4 of this plan.
"""
from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest


# ---------------------------------------------------------------------------
# Module-importable scaffolds (Wave 0)
# ---------------------------------------------------------------------------

def test_task_service_module_importable():
    """Wave 0: task_service.py must exist and expose run_task_sub_agent."""
    from app.services import task_service
    assert hasattr(task_service, "run_task_sub_agent")


def test_global_slot_helpers_importable():
    """Wave 0: acquire/release_global_task_slot must exist on task_service."""
    from app.services.task_service import (
        acquire_global_task_slot,
        release_global_task_slot,
    )
    assert callable(acquire_global_task_slot)
    assert callable(release_global_task_slot)


# ---------------------------------------------------------------------------
# resolve_sub_agent_model_safely tests (D-075.5-04 footgun mitigation)
# ---------------------------------------------------------------------------

class _StubUserSettings:
    """Minimal stand-in for UserEffectiveSettings (the real one is a Pydantic
    model with many fields). The helper reads .active_provider, .llm_model, and
    .available_models (list[str]).

    Phase 093-03 (D-06): the resolver now reads the REAL field
    ``available_models`` (list[str]) — NOT the non-existent ``llm_models``
    (which was always None on the real model, so the safety net was silently
    dead since Phase 085). These tests passed the model list as a
    comma-separated ``llm_models`` string, which the resolver never actually
    read — so the cross-provider-fallback cases were green for the WRONG reason
    (validation never fired). The stub now splits that string into the real
    ``available_models`` list so the tests exercise the genuinely-fixed path;
    the constructor keyword stays ``llm_models`` to avoid churning every call
    site, and ``.llm_models`` is preserved (unread) for back-compat."""

    def __init__(self, *, active_provider: str, llm_model: str, llm_models: str):
        self.active_provider = active_provider
        self.llm_model = llm_model
        # Back-compat attribute (no longer read by the resolver — D-06).
        self.llm_models = llm_models
        # The REAL field the resolver reads (models/user_settings.py:100).
        self.available_models = [m.strip() for m in llm_models.split(",") if m.strip()]


def test_resolve_no_override_returns_user_model():
    """Test 1: no override -> returns user_settings.llm_model."""
    from app.services.sub_agent_models import resolve_sub_agent_model_safely
    us = _StubUserSettings(
        active_provider="openai",
        llm_model="gpt-4o",
        llm_models="gpt-4o,gpt-4o-mini",
    )
    assert resolve_sub_agent_model_safely(us, override_model=None) == "gpt-4o"


def test_resolve_override_in_provider_list_passes_through():
    """Test 2: override is in the active provider's llm_models list -> use it as-is."""
    from app.services.sub_agent_models import resolve_sub_agent_model_safely
    us = _StubUserSettings(
        active_provider="openai",
        llm_model="gpt-4o",
        llm_models="gpt-4o,gpt-4o-mini",
    )
    assert resolve_sub_agent_model_safely(us, override_model="gpt-4o-mini") == "gpt-4o-mini"


def test_resolve_override_cross_provider_falls_back():
    """Test 3: claude-3 not in OpenAI's llm_models list -> falls back to safe default.

    Mitigates the D-075.5-04 cross-provider call footgun.
    """
    from app.services.sub_agent_models import resolve_sub_agent_model_safely
    us = _StubUserSettings(
        active_provider="openai",
        llm_model="gpt-4o",
        llm_models="gpt-4o,gpt-4o-mini",
    )
    result = resolve_sub_agent_model_safely(us, override_model="claude-3-haiku")
    # Must NOT echo back the cross-provider name
    assert result != "claude-3-haiku"
    # Provider default for "openai" in _SUB_AGENT_MODEL_DEFAULTS is "gpt-5.4-mini"
    # but the fallback chain also allows user's own llm_model. Accept any safe value.
    from app.config import _SUB_AGENT_MODEL_DEFAULTS
    openai_default = _SUB_AGENT_MODEL_DEFAULTS.get("openai", "")
    assert result in (openai_default, "gpt-4o", "gpt-4o-mini") or result.startswith("gpt-")


def test_resolve_with_no_user_settings_uses_global_settings():
    """Defensive: if user_settings is None, fall back to global settings.llm_model."""
    from app.services.sub_agent_models import resolve_sub_agent_model_safely
    from app.config import settings
    result = resolve_sub_agent_model_safely(None, override_model=None)
    # Must equal global settings.llm_model (no override, no user, no fallback supplied)
    assert result == settings.llm_model


def test_resolve_empty_llm_models_list_confident_cross_provider_falls_to_default():
    """Phase 175 XPROV-03 (D-03) — SUPERSEDES the pre-175 empty-list passthrough.

    Previously an empty available_models list meant the resolver could not
    validate, so it TRUSTED any override (leaking e.g. a 'claude-3' onto an
    openai-active caller — the blind spot). The folded inferred-provider gate
    now catches a CONFIDENT cross-provider override by INFERENCE (no list
    needed) and returns the active provider's default. (An UNRECOGNISED id still
    passes through — the fold fires only on a confident known-provider mismatch;
    see test_utility_model_guard.py.)"""
    from app.config import _SUB_AGENT_MODEL_DEFAULTS
    from app.services.sub_agent_models import resolve_sub_agent_model_safely
    us = _StubUserSettings(
        active_provider="openai",
        llm_model="gpt-4o",
        llm_models="",  # empty — but inference still detects cross-provider
    )
    # "claude-3" infers to anthropic != openai → dropped for the openai default.
    result = resolve_sub_agent_model_safely(us, override_model="claude-3")
    assert result == _SUB_AGENT_MODEL_DEFAULTS["openai"] == "gpt-5.4-mini"
    assert result != "claude-3"


# ---------------------------------------------------------------------------
# Plan 05 BUG-260528-01 — hardened validation on the default (override=None) path
# ---------------------------------------------------------------------------
#
# Pre-Plan-05, the safety net at sub_agent_models.py:58 only fired when
# override_model was truthy. The production call site at task_service.py:229
# passes override_model=None per D-085-11, so the safety net was dormant
# in production. These four tests pin the hardened-validation behavior
# that Plan 05 introduces.


def test_resolve_falls_back_when_user_settings_llm_model_is_cross_provider():
    """Plan 05 / BUG-260528-01 root case: active_provider switched to anthropic
    but user_settings.llm_model is still 'gpt-4.1' (stale-cross-provider).

    The default (override_model=None) path MUST detect the mismatch via the
    new always-on validation and return _SUB_AGENT_MODEL_DEFAULTS['anthropic']
    instead of leaking 'gpt-4.1' through to the Anthropic client.
    """
    from app.config import _SUB_AGENT_MODEL_DEFAULTS
    from app.services.sub_agent_models import resolve_sub_agent_model_safely

    us = _StubUserSettings(
        active_provider="anthropic",
        llm_model="gpt-4.1",  # stale-cross-provider
        llm_models="claude-haiku-4-5-20251001,claude-sonnet-4-5-20251022",
    )
    result = resolve_sub_agent_model_safely(us, override_model=None)

    # Must NOT leak gpt-4.1 through to the Anthropic API endpoint.
    assert result != "gpt-4.1"
    # Must return the canonical Anthropic sub-agent default.
    assert result == _SUB_AGENT_MODEL_DEFAULTS["anthropic"]
    assert result == "claude-haiku-4-5-20251001"


def test_resolve_returns_candidate_when_provider_default_is_empty():
    """Plan 05: flexible providers (openrouter, ollama) have intentionally
    empty _SUB_AGENT_MODEL_DEFAULTS entries.

    When the candidate is not in their llm_models list, the helper should
    return the candidate as-is (best-effort) with a WARNING log — those
    providers route flexibly and we don't have a safe forced default.
    """
    from app.services.sub_agent_models import resolve_sub_agent_model_safely

    us = _StubUserSettings(
        active_provider="openrouter",
        llm_model="gpt-4.1",  # candidate not in OpenRouter's list
        llm_models="deepseek/deepseek-r1,anthropic/claude-3.5-sonnet",
    )
    result = resolve_sub_agent_model_safely(us, override_model=None)

    # Flexible provider path — the candidate is preserved best-effort.
    # The downstream OpenRouter call may fail or route via the model id;
    # either way, the helper does not silently substitute.
    assert result == "gpt-4.1"


def test_resolve_short_circuits_when_candidate_in_active_list():
    """Plan 05: the happy path is unchanged.

    If the candidate is already a member of the active provider's
    llm_models list, the helper returns it as-is with no warning and no
    fallback.
    """
    from app.services.sub_agent_models import resolve_sub_agent_model_safely

    us = _StubUserSettings(
        active_provider="openai",
        llm_model="gpt-5.4-mini",  # in list
        llm_models="gpt-4.1,gpt-5.4-mini,gpt-5.4",
    )
    result = resolve_sub_agent_model_safely(us, override_model=None)
    assert result == "gpt-5.4-mini"


def test_resolve_with_empty_active_models_list_infers_cross_provider():
    """Phase 175 XPROV-03 (D-03) — SUPERSEDES the pre-175 empty-list trade-off.

    Pre-175 an empty available_models list skipped the cross-provider check and
    returned the stale candidate as-is ("we trust the caller when we have no
    list"). The folded inferred-provider gate now closes that blind spot by
    inference: a CONFIDENT cross-provider candidate falls to the active
    provider's default even with no list to validate against. (An UNRECOGNISED
    id still passes through — the fold fires only on a confident known-provider
    mismatch; see test_utility_model_guard.py.)
    """
    from app.config import _SUB_AGENT_MODEL_DEFAULTS
    from app.services.sub_agent_models import resolve_sub_agent_model_safely

    us = _StubUserSettings(
        active_provider="anthropic",
        llm_model="gpt-4.1",  # stale cross-provider (infers to openai)
        llm_models="",  # empty — inference detects the mismatch without a list
    )
    result = resolve_sub_agent_model_safely(us, override_model=None)
    # gpt-4.1 infers to openai != anthropic → dropped for the anthropic default.
    assert result == _SUB_AGENT_MODEL_DEFAULTS["anthropic"]
    assert result == "claude-haiku-4-5-20251001"
    assert result != "gpt-4.1"


# ---------------------------------------------------------------------------
# Settings tests (Test 4)
# ---------------------------------------------------------------------------

def test_config_settings_phase_085_fields():
    """Test 4: config.settings must expose the 4 Phase 085 knobs with expected defaults."""
    from app.config import settings
    assert settings.ask_user_max_timeout_seconds == 1800
    assert settings.task_max_steps == 10
    assert settings.task_per_run_concurrency == 3
    assert settings.task_global_concurrency == 20


# ---------------------------------------------------------------------------
# _handle_task handler tests (Task 4 — populated when handler lands)
# ---------------------------------------------------------------------------

THREAD_ID = "33333333-3333-3333-3333-333333333333"
PARENT_RUN_ID = uuid4()


def _make_parent_ctx(
    *,
    parent_run_id=None,
    available_tools=None,
    per_run_concurrency=3,
    redis_eval_result=1,
):
    """Build a top-level ToolContext for testing _handle_task.

    parent_run_id=None means top-level (sub-agent spawn is allowed).
    Set to a UUID to simulate "called from inside a sub-agent" (nesting cap).
    """
    from app.services.tool_dispatcher import ToolContext
    redis = MagicMock()
    redis.eval = AsyncMock(return_value=redis_eval_result)
    redis.decr = AsyncMock(return_value=0)
    sem = asyncio.Semaphore(per_run_concurrency)
    return ToolContext(
        redis=redis,
        run_id=PARENT_RUN_ID,
        thread_id=THREAD_ID,
        supabase=MagicMock(),
        pool=MagicMock(),
        user_settings=None,
        current_user={"id": "test-user"},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(),
        spawn=lambda c: None,
        parent_run_id=parent_run_id,
        per_run_task_semaphore=sem,
        available_tools=available_tools if available_tools is not None
                        else ["search_documents", "read_document", "web_search", "task", "ask_user", "write_todos"],
    )


@pytest.mark.asyncio
async def test_handle_task_nesting_cap_returns_friendly_error():
    """Test 1 (Task 4): parent_run_id != None -> short-circuit, no spawn."""
    from app.services.tool_dispatcher import _handle_task, ToolResult
    ctx = _make_parent_ctx(parent_run_id=uuid4())  # simulate sub-agent invoking task()
    result = await _handle_task({"description": "do x"}, ctx)
    assert isinstance(result, ToolResult)
    assert "1-level nesting cap" in result.result


@pytest.mark.asyncio
async def test_handle_task_missing_description_returns_error():
    """Test 2 (Task 4): empty description -> error."""
    from app.services.tool_dispatcher import _handle_task
    ctx = _make_parent_ctx()
    result = await _handle_task({"description": ""}, ctx)
    assert "description" in result.result


@pytest.mark.asyncio
async def test_handle_task_excluded_tool_rejected():
    """Test 3 (Task 4): requesting task/ask_user/write_todos in tools is refused."""
    from app.services.tool_dispatcher import _handle_task
    ctx = _make_parent_ctx()
    result = await _handle_task(
        {"description": "x", "tools": ["task", "search_documents"]}, ctx
    )
    assert "refused" in result.result or "not available" in result.result


@pytest.mark.asyncio
async def test_handle_task_nonexistent_tool_rejected():
    """Test 4 (Task 4): unknown tool in request -> refused (subset enforcement)."""
    from app.services.tool_dispatcher import _handle_task
    ctx = _make_parent_ctx(available_tools=["search_documents", "task"])
    result = await _handle_task(
        {"description": "x", "tools": ["nonexistent_tool"]}, ctx
    )
    assert "refused" in result.result or "not available" in result.result


@pytest.mark.asyncio
async def test_handle_task_default_tools_uses_read_only_intersection():
    """Test 5 (Task 4): tools=None -> default read-only subset, spawn runs."""
    from app.services.tool_dispatcher import _handle_task
    ctx = _make_parent_ctx(
        available_tools=["search_documents", "read_document", "task", "ask_user"],
    )
    fake_spawn = AsyncMock(
        return_value={"summary": "ok", "status": "completed", "sub_run_id": uuid4()}
    )
    with patch("app.services.task_service.run_task_sub_agent", fake_spawn):
        result = await _handle_task({"description": "do x"}, ctx)
    assert result.result == "ok"
    fake_spawn.assert_awaited_once()
    _, kwargs = fake_spawn.await_args
    # Default toolset should be the intersection of available_tools with DEFAULT_READ_ONLY
    # — and MUST NOT contain task/ask_user/write_todos.
    assert "task" not in kwargs["allowed_tools"]
    assert "ask_user" not in kwargs["allowed_tools"]
    assert "search_documents" in kwargs["allowed_tools"]


@pytest.mark.asyncio
async def test_handle_task_clamps_max_steps_to_settings():
    """Test 6 (Task 4): max_steps=99 -> clamped to settings.task_max_steps (10)."""
    from app.services.tool_dispatcher import _handle_task
    from app.config import settings
    ctx = _make_parent_ctx()
    fake_spawn = AsyncMock(
        return_value={"summary": "ok", "status": "completed", "sub_run_id": uuid4()}
    )
    with patch("app.services.task_service.run_task_sub_agent", fake_spawn):
        await _handle_task(
            {"description": "x", "max_steps": 99, "tools": ["search_documents"]}, ctx
        )
    _, kwargs = fake_spawn.await_args
    assert kwargs["max_steps"] == settings.task_max_steps


@pytest.mark.asyncio
async def test_handle_task_max_steps_default_when_omitted():
    """Task 4: max_steps omitted -> default 5 per D-085-10."""
    from app.services.tool_dispatcher import _handle_task
    ctx = _make_parent_ctx()
    fake_spawn = AsyncMock(
        return_value={"summary": "ok", "status": "completed", "sub_run_id": uuid4()}
    )
    with patch("app.services.task_service.run_task_sub_agent", fake_spawn):
        await _handle_task(
            {"description": "x", "tools": ["search_documents"]}, ctx
        )
    _, kwargs = fake_spawn.await_args
    assert kwargs["max_steps"] == 5


@pytest.mark.asyncio
async def test_handle_task_happy_path_returns_summary_text():
    """Test 9 (Task 4): happy path returns ToolResult(result=<summary>)."""
    from app.services.tool_dispatcher import _handle_task
    ctx = _make_parent_ctx()
    fake_spawn = AsyncMock(
        return_value={"summary": "final answer text", "status": "completed", "sub_run_id": uuid4()}
    )
    with patch("app.services.task_service.run_task_sub_agent", fake_spawn):
        result = await _handle_task(
            {"description": "do x", "tools": ["search_documents"]}, ctx
        )
    assert result.result == "final answer text"


@pytest.mark.asyncio
async def test_handle_task_global_cap_blocks_spawn():
    """Test 8 (Task 4): when acquire_global_task_slot returns False, spawn is blocked."""
    from app.services.tool_dispatcher import _handle_task
    # redis.eval returns 0 -> Lua "cap reached" -> handler refuses
    ctx = _make_parent_ctx(redis_eval_result=0)
    result = await _handle_task(
        {"description": "x", "tools": ["search_documents"]}, ctx
    )
    assert "concurrency limit reached" in result.result
    # Per-run semaphore must be released on refusal (so future calls can proceed)
    assert ctx.per_run_task_semaphore._value == 3


# ---------------------------------------------------------------------------
# Phase 091 OQ1 — additive system_prompt_override on run_task_sub_agent
# ---------------------------------------------------------------------------
#
# The harness llm_agent/llm_batch_agents executors need the phase's own prompt
# to be the system framing (not the hardcoded "focused sub-agent" text). The
# param is additive + keyword-only: None (every existing caller) is byte-
# identical to pre-091; a string REPLACES the helper-built prompt for that call.


def _build_sub_agent_ctx():
    """A parent ToolContext for direct run_task_sub_agent calls (no nesting cap)."""
    from app.services.tool_dispatcher import ToolContext
    redis = MagicMock()
    redis.eval = AsyncMock(return_value=1)
    redis.decr = AsyncMock(return_value=0)
    return ToolContext(
        redis=redis,
        run_id=PARENT_RUN_ID,
        thread_id=THREAD_ID,
        supabase=MagicMock(),
        pool=MagicMock(),
        user_settings=None,
        current_user={"id": "00000000-0000-0000-0000-000000000001"},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(),
        spawn=lambda c: None,
        parent_run_id=None,
        per_run_task_semaphore=asyncio.Semaphore(3),
        available_tools=["search_documents"],
    )


async def _capture_sub_agent_system_prompt(**override_kwargs) -> str:
    """Run run_task_sub_agent with all I/O mocked, returning the system prompt
    that reached the LLM (messages[0]['content'])."""
    from app.services import task_service

    ctx = _build_sub_agent_ctx()
    captured: dict = {}

    async def _fake_stream(*, messages, tools, model, user_settings, **_kwargs):
        # **_kwargs absorbs the Phase 093 additions (provider, structured_injected)
        # that run_task_sub_agent now threads through.
        captured["messages"] = messages
        # No tool calls -> the loop breaks with this content as the summary.
        return ("done", [])

    with patch.object(task_service, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
        patch.object(task_service, "insert_run", AsyncMock()), \
        patch.object(task_service, "finalize_run", AsyncMock()), \
        patch.object(task_service, "resolve_sub_agent_model_safely", lambda *a, **k: "gpt-4o"), \
        patch.object(task_service, "get_tools", lambda us: []), \
        patch.object(task_service, "_stream_one_iteration", _fake_stream):
        await task_service.run_task_sub_agent(
            parent_ctx=ctx,
            description="Phase: research",
            instructions=None,
            allowed_tools=["search_documents"],
            max_steps=2,
            **override_kwargs,
        )
    return captured["messages"][0]["content"]


@pytest.mark.asyncio
async def test_sub_agent_prompt_none_path_byte_identical():
    """OQ1: system_prompt_override=None (default) yields the SAME assembled system
    prompt as the helper builds — byte-identical to pre-091 for every caller."""
    from app.services.task_service import _build_sub_agent_system_prompt

    got = await _capture_sub_agent_system_prompt()  # no override -> None default
    expected = _build_sub_agent_system_prompt(
        "Phase: research", None, ["search_documents"]
    )
    assert got == expected
    # Sanity: the helper framing is the generic sub-agent text.
    assert "focused sub-agent" in got


@pytest.mark.asyncio
async def test_sub_agent_prompt_override_replaces_framing():
    """OQ1: a system_prompt_override string REPLACES the helper framing verbatim."""
    phase_prompt = "You are running phase 'research'. Investigate the corpus thoroughly."
    got = await _capture_sub_agent_system_prompt(system_prompt_override=phase_prompt)
    assert got == phase_prompt
    assert "focused sub-agent" not in got


def test_handle_task_in_registry():
    """Test 10 (Task 4): _TOOL_REGISTRY['task'] == _handle_task."""
    from app.services.tool_dispatcher import _TOOL_REGISTRY, _handle_task
    assert _TOOL_REGISTRY.get("task") is _handle_task


def test_registry_size_after_plan_02():
    """Task 4: after this plan ships, registry must contain at least 23 entries."""
    from app.services.tool_dispatcher import _TOOL_REGISTRY
    assert len(_TOOL_REGISTRY) >= 23


# ===========================================================================
# Phase 093 / Plan 02 — gateway consumption (F9 core fix) — RED contract
#
# These cases pin the contract Plan 02 must satisfy: _stream_one_iteration drives
# the SHARED provider gateway (open_stream) instead of the OpenAI-only
# create_adaptive_streaming_chat path that discards calling_mode
# (task_service.py:177, the F9 bug-site). They stay skipped until 093-02 lands the
# gateway-consumption rewrite — then 093-02 removes the class-level skip and wires
# the real monkeypatch/assert bodies. Authored here so the downstream plan has a
# NAMED RED contract to flip (D-13 Layer-1).
#
# Contract surface (from 093-PATTERNS.md Finding 1 + 093-CONTEXT.md D-02/D-03):
#   - open_stream(provider, GatewayRequest) -> (SYNC stream, CallingMode); the
#     stream is driven `for chunk in stream:` in run_in_threadpool (IN-05 trap —
#     NEVER `async for`).
#   - calling_mode is HONORED: on CallingMode.STRUCTURED the consumer injects
#     TOOL_USAGE_INSTRUCTIONS once + post-parses with parse_structured_tool_calls
#     (search_documents-shaped call extracted, content cleared).
#   - the tool_calls buffer is built from BOTH families: tool_preparing +
#     tool_args_progress (openai-compat) AND tool_start (anthropic/google).
# ===========================================================================

class _SyncEventStream:
    """A bare SYNC generator-like stream (the IN-05 shape the gateway adapters
    return): iterable + a sync ``.close()``. ``_stream_one_iteration`` MUST drive
    it with ``for event in stream:`` (never ``async for``)."""

    def __init__(self, events):
        self._events = list(events)
        self.closed = False

    def __iter__(self):
        yield from self._events

    def close(self):
        self.closed = True


def _make_open_stream_stub(events, calling_mode, *, captured: dict):
    """Build an async stub for app.services.task_service.open_stream that records
    the (provider, GatewayRequest) it was awaited with and returns
    (SYNC stream, calling_mode)."""
    stream = _SyncEventStream(events)

    async def _stub(provider, request):
        captured["provider"] = provider
        captured["request"] = request
        captured["stream"] = stream
        return stream, calling_mode

    return _stub, stream


class Test093GatewayConsumption:
    """093-02 — _stream_one_iteration consumes the SHARED provider gateway (F9 fix).

    Flipped GREEN from the Plan 01 RED scaffold: the function now awaits
    open_stream(provider, GatewayRequest), drives the returned SYNC stream in a
    threadpool (IN-05 — never async for), and HONORS calling_mode (STRUCTURED →
    inject-once + parse_structured_tool_calls post-parse).
    """

    @pytest.mark.asyncio
    async def test_stream_one_iteration_drives_gateway_open_stream(self):
        """_stream_one_iteration awaits open_stream with a GatewayRequest and drives
        the returned SYNC stream in a threadpool (NEVER async for — IN-05)."""
        from app.services import task_service
        from app.services.openai_service import CallingMode
        from app.services.provider_gateway import GatewayRequest

        captured: dict = {}
        events = [
            {"type": "delta", "content": "Hello "},
            {"type": "delta", "content": "world"},
        ]
        stub, stream = _make_open_stream_stub(
            events, CallingMode.NATIVE, captured=captured
        )

        with patch.object(task_service, "open_stream", stub):
            content, tool_calls = await task_service._stream_one_iteration(
                messages=[{"role": "system", "content": "sys"}],
                tools=[],
                model="claude-haiku-4-5-20251001",
                user_settings=None,
                provider="anthropic",
            )

        # open_stream was awaited with the provider + a GatewayRequest envelope.
        assert captured["provider"] == "anthropic"
        assert isinstance(captured["request"], GatewayRequest)
        assert captured["request"].model == "claude-haiku-4-5-20251001"
        # Content drained from the SYNC stream; stream was closed (resource cleanup).
        assert content == "Hello world"
        assert tool_calls == []
        assert stream.closed is True

    @pytest.mark.asyncio
    async def test_honors_structured_calling_mode(self):
        """When open_stream returns CallingMode.STRUCTURED, the phase HAS tools, and
        the drained content is a structured tool-call block, parse_structured_tool_calls
        is applied and the returned tool_calls are non-empty (search_documents-shaped),
        content cleared.

        WR-01 (093 REVIEW): the STRUCTURED post-parse is now gated on bool(tools) — a
        no-tools call (llm_single) must NOT run it. So this STRUCTURED-recovery-fires
        case passes a real tool schema (the sub-agent loop always does); the no-tools
        guard is pinned separately by test_no_tools_structured_call_preserves_content.
        """
        from app.services import task_service
        from app.services.openai_service import CallingMode

        captured: dict = {}
        # A STRUCTURED-mode compat native narrates the tool call as a JSON block in
        # the text content (NOT a native tool_call) — the consumer must recover it.
        structured_block = (
            '```json\n{"tool": "search_documents", '
            '"arguments": {"query": "neural nets"}}\n```'
        )
        events = [{"type": "delta", "content": structured_block}]
        stub, _stream = _make_open_stream_stub(
            events, CallingMode.STRUCTURED, captured=captured
        )

        # deepseek routes through the openai-compat branch → a registry cap lookup
        # happens; stub it so the test is offline + deterministic.
        async def _fake_cap(model):
            return {"provider": "deepseek"}

        tools = [
            {"function": {"name": "search_documents", "description": "d",
                          "parameters": {"properties": {}, "required": []}}}
        ]
        with patch.object(task_service, "open_stream", stub), \
            patch("app.config.get_model_capability_async", _fake_cap):
            content, tool_calls = await task_service._stream_one_iteration(
                messages=[{"role": "system", "content": "sys"}],
                tools=tools,
                model="deepseek-v4-flash",
                user_settings=None,
                provider="deepseek",
            )

        # parse_structured_tool_calls fired → tool_calls non-empty, content cleared.
        assert content == ""
        assert len(tool_calls) == 1
        assert tool_calls[0]["name"] == "search_documents"
        assert "neural nets" in tool_calls[0]["arguments"]

    # -- WR-01 (093 REVIEW): no-tools STRUCTURED call must NOT blank the answer --
    # llm_single passes tools=[] and a STRUCTURED-mode provider would otherwise (a)
    # inject the FULL tool catalog into a tool-free phase and (b) post-parse prose
    # into a spurious tool call, BLANKING the phase answer. The fix gates both the
    # inject and the post-parse on bool(tools).

    @pytest.mark.asyncio
    @pytest.mark.parametrize("empty_tools", [None, []])
    async def test_no_tools_structured_call_preserves_content(self, empty_tools):
        """WR-01: tools=None/[] + STRUCTURED → NO inject into the system message AND
        the returned content equals the streamed text verbatim (no parse, no blank)."""
        from app.services import task_service
        from app.services.openai_service import CallingMode

        captured: dict = {}
        # Content that LOOKS like a structured tool call — if the post-parse ran it
        # would extract this and blank the answer. With no tools it must NOT run.
        prose = (
            "Summary of the literature:\n"
            '```json\n{"tool": "search_documents", "arguments": {"query": "x"}}\n```\n'
            "(the model is just narrating an example, not calling a tool)"
        )
        events = [{"type": "delta", "content": prose}]
        stub, _stream = _make_open_stream_stub(
            events, CallingMode.STRUCTURED, captured=captured
        )

        async def _fake_cap(model):
            return {"provider": "deepseek"}

        messages = [{"role": "system", "content": "SYS"}]
        with patch.object(task_service, "open_stream", stub), \
            patch("app.config.get_model_capability_async", _fake_cap):
            content, tool_calls = await task_service._stream_one_iteration(
                messages=messages,
                tools=empty_tools,
                model="deepseek-v4-flash",
                user_settings=None,
                provider="deepseek",
            )

        # The answer is preserved verbatim — NOT blanked by a spurious parse.
        assert content == prose
        assert tool_calls == []
        # No TOOL_USAGE_INSTRUCTIONS dumped into a tool-free phase's system message.
        assert messages[0]["content"] == "SYS"

    @pytest.mark.asyncio
    async def test_structured_injection_is_idempotent_across_iterations(self):
        """STRUCTURED inject-once: a shared structured_injected box appends
        TOOL_USAGE_INSTRUCTIONS to the system message at most once across calls."""
        from app.services import task_service
        from app.services.openai_service import CallingMode

        captured: dict = {}
        stub, _stream = _make_open_stream_stub(
            [{"type": "delta", "content": "ok"}],
            CallingMode.STRUCTURED,
            captured=captured,
        )

        async def _fake_cap(model):
            return {"provider": "deepseek"}

        messages = [{"role": "system", "content": "SYS"}]
        box = [False]
        tools = [
            {"function": {"name": "search_documents", "description": "d",
                          "parameters": {"properties": {}, "required": []}}}
        ]
        with patch.object(task_service, "open_stream", stub), \
            patch("app.config.get_model_capability_async", _fake_cap):
            for _ in range(3):
                await task_service._stream_one_iteration(
                    messages=messages,
                    tools=tools,
                    model="deepseek-v4-flash",
                    user_settings=None,
                    provider="deepseek",
                    structured_injected=box,
                )

        assert box[0] is True
        # The TOOL_USAGE_INSTRUCTIONS header appears exactly once (no accumulation).
        assert messages[0]["content"].count("## Tool Usage Format") == 1

    @pytest.mark.asyncio
    async def test_buffer_built_from_openai_compat_family(self):
        """tool_preparing + tool_args_progress (openai-compat) rebuild the tool_calls
        buffer (full cumulative arguments — L-4)."""
        from app.services import task_service
        from app.services.openai_service import CallingMode

        captured: dict = {}
        events = [
            {"type": "tool_preparing", "id": "call_1", "name": "search_documents", "index": 0},
            {"type": "tool_args_progress", "tool_index": 0, "name": "search_documents",
             "args_so_far": '{"query":', "total_args_bytes_so_far": 9,
             "code_so_far": '{"query":'},
            # full cumulative args land in code_so_far (L-4) — last write wins.
            {"type": "tool_args_progress", "tool_index": 0, "name": "search_documents",
             "args_so_far": '{"query": "rag"}', "total_args_bytes_so_far": 16,
             "code_so_far": '{"query": "rag"}'},
        ]
        stub, _stream = _make_open_stream_stub(
            events, CallingMode.NATIVE, captured=captured
        )

        async def _fake_cap(model):
            return {"provider": "openai"}

        with patch.object(task_service, "open_stream", stub), \
            patch("app.config.get_model_capability_async", _fake_cap):
            content, tool_calls = await task_service._stream_one_iteration(
                messages=[{"role": "system", "content": "sys"}],
                tools=[],
                model="gpt-5.4-mini",
                user_settings=None,
                provider="openai",
            )

        assert content == ""
        assert len(tool_calls) == 1
        assert tool_calls[0]["id"] == "call_1"
        assert tool_calls[0]["name"] == "search_documents"
        # Full cumulative arguments (code_so_far), not concatenated fragments.
        assert tool_calls[0]["arguments"] == '{"query": "rag"}'

    @pytest.mark.asyncio
    async def test_buffer_built_from_native_family(self):
        """tool_start (anthropic/google) rebuilds the tool_calls buffer — the two
        families are non-colliding (one stream emits only one family)."""
        from app.services import task_service
        from app.services.openai_service import CallingMode

        captured: dict = {}
        events = [
            {"type": "tool_start", "id": "toolu_1", "name": "search_documents",
             "args": {"query": "graphs"}},
            {"type": "tool_start", "id": "toolu_2", "name": "read_document",
             "args": {"doc_id": "d1"}},
        ]
        stub, _stream = _make_open_stream_stub(
            events, CallingMode.NATIVE, captured=captured
        )

        with patch.object(task_service, "open_stream", stub):
            content, tool_calls = await task_service._stream_one_iteration(
                messages=[{"role": "system", "content": "sys"}],
                tools=[],
                model="claude-haiku-4-5-20251001",
                user_settings=None,
                provider="anthropic",
            )

        assert content == ""
        assert len(tool_calls) == 2
        assert tool_calls[0]["id"] == "toolu_1"
        assert tool_calls[0]["name"] == "search_documents"
        # tool_start args are JSON-encoded (the shape dispatch_tool re-parses).
        assert json.loads(tool_calls[0]["arguments"]) == {"query": "graphs"}
        assert tool_calls[1]["id"] == "toolu_2"
        assert json.loads(tool_calls[1]["arguments"]) == {"doc_id": "d1"}

    # -- CR-01 (093 REVIEW): native Anthropic system prompt must survive --------
    # The native Anthropic adapter STRIPS role="system" from messages and builds
    # the top-level system block from request.system_prompt ONLY. So
    # _stream_one_iteration MUST extract the system message and pass it as
    # system_prompt on the GatewayRequest — else the sub-agent / phase system
    # prompt is silently dropped on Anthropic (RED-LINE regression).

    @pytest.mark.asyncio
    async def test_anthropic_gateway_request_carries_system_prompt(self):
        """CR-01: when the active provider is anthropic, the GatewayRequest passed
        to open_stream carries system_prompt == the system message text (not "")."""
        from app.services import task_service
        from app.services.openai_service import CallingMode

        captured: dict = {}
        stub, _stream = _make_open_stream_stub(
            [{"type": "delta", "content": "ok"}], CallingMode.NATIVE, captured=captured
        )

        sys_text = "You are a focused sub-agent. Investigate the corpus thoroughly."
        with patch.object(task_service, "open_stream", stub):
            await task_service._stream_one_iteration(
                messages=[
                    {"role": "system", "content": sys_text},
                    {"role": "user", "content": "go"},
                ],
                tools=[],
                model="claude-haiku-4-5-20251001",
                user_settings=None,
                provider="anthropic",
            )

        # The native adapter reads request.system_prompt; it MUST be the system
        # message text, not the "" default that silently drops the prompt.
        assert captured["request"].system_prompt == sys_text
        assert captured["request"].system_prompt != ""

    @pytest.mark.asyncio
    async def test_openai_compat_system_stays_in_messages_unchanged(self):
        """CR-01 companion: the openai-compat path is byte-identical. system_prompt
        is additively set on the request (the compat adapter ignores it), and the
        system entry remains in the messages array the adapter actually reads."""
        from app.services import task_service
        from app.services.openai_service import CallingMode

        captured: dict = {}
        stub, _stream = _make_open_stream_stub(
            [{"type": "delta", "content": "ok"}], CallingMode.NATIVE, captured=captured
        )

        async def _fake_cap(model):
            return {"provider": "openai"}

        sys_text = "system framing for an openai-compat phase"
        with patch.object(task_service, "open_stream", stub), \
            patch("app.config.get_model_capability_async", _fake_cap):
            await task_service._stream_one_iteration(
                messages=[
                    {"role": "system", "content": sys_text},
                    {"role": "user", "content": "go"},
                ],
                tools=[],
                model="gpt-5.4-mini",
                user_settings=None,
                provider="openai",
            )

        req = captured["request"]
        # system stays in the messages array (the compat adapter's source of truth)…
        assert req.messages[0]["role"] == "system"
        assert req.messages[0]["content"] == sys_text
        # …and system_prompt is set too (additive; ignored by the compat adapter).
        assert req.system_prompt == sys_text


# ===========================================================================
# Phase 093 / Plan 07 — gateway FINISH-event consumption (D-16) + usage
# persistence (D-17). The harness sub-agent consumer used to DROP reasoning_delta
# and IGNORE finish/usage (task_service.py:271-273 + :299-300). The LIVE
# cross-provider UAT disproved the "no round-trip needed" assumption: Google needs
# thought_signature echoed on the NEXT assistant tool-call message; Moonshot/Kimi
# (thinking) needs reasoning_content echoed — else round 2 400s. The gateway
# adapters ALREADY emit this on the finish event + reasoning_delta; the harness
# just dropped it. The SAME finish/usage events carry usage → the sub-agent's
# runs row is NULL on every harness run (S4).
#
# Contract (mirror agent_loop.py:1399-1416 usage + :1422-1432 reasoning +
# :1492-1506 finish-branch hydrate + :1866-1901 assistant-message build):
#   - _stream_one_iteration threads two ADDITIVE caller-supplied accumulator
#     boxes (reasoning_box: list[str] | None, usage_box: dict | None) alongside
#     structured_injected — None defaults → byte-identical for the lone
#     llm_single caller + every _fake_stream fixture. Public return stays
#     (content, tool_calls).
#   - _drain consumes the finish event (hydrate thought_signature onto the
#     buffer), accumulates reasoning_content (into reasoning_box[0]), and sums
#     usage (into usage_box) — verbatim Deep semantics.
#   - run_task_sub_agent hydrates thought_signature + reasoning_content onto the
#     assistant replay message (conditional spread → no-op when absent) and
#     persists the accumulated usage to the sub-agent runs row (S4 closed).
# ===========================================================================


class Test093FinishEvent:
    """093-07 — finish-event consumption (thought_signature + reasoning_content
    hydration) + usage accumulation + token persistence on the sub-agent run."""

    # -- Task 1: _drain finish-branch + reasoning + usage accumulation ---------

    @pytest.mark.asyncio
    async def test_finish_event_hydrates_thought_signature_onto_tool_calls(self):
        """Google shape: a finish event whose tool_calls carry thought_signature
        hydrates it onto the matching buffer entry; the returned tool_calls each
        carry thought_signature; the usage_box is populated."""
        from app.services import task_service
        from app.services.openai_service import CallingMode

        captured: dict = {}
        events = [
            {"type": "tool_start", "id": "fn_1", "name": "search_documents",
             "args": {"query": "graphs"}},
            {"type": "usage", "input_tokens": 120, "output_tokens": 45},
            {"type": "finish", "finish_reason": "tool_calls",
             "tool_calls": [{"thought_signature": "SIG_ABC"}]},
        ]
        stub, _stream = _make_open_stream_stub(
            events, CallingMode.NATIVE, captured=captured
        )

        reasoning_box: list[str] = [""]
        usage_box: dict = {}
        with patch.object(task_service, "open_stream", stub):
            content, tool_calls = await task_service._stream_one_iteration(
                messages=[{"role": "system", "content": "sys"}],
                tools=[],
                model="gemini-3.5-flash",
                user_settings=None,
                provider="google",
                reasoning_box=reasoning_box,
                usage_box=usage_box,
            )

        assert len(tool_calls) == 1
        assert tool_calls[0]["thought_signature"] == "SIG_ABC"
        # No reasoning was streamed → reasoning_box stays empty.
        assert reasoning_box[0] == ""
        # usage accumulated.
        assert usage_box.get("input_tokens") == 120
        assert usage_box.get("output_tokens") == 45

    @pytest.mark.asyncio
    async def test_reasoning_delta_accumulated_into_box_not_content(self):
        """Moonshot/Kimi/DeepSeek shape: reasoning_delta events accumulate into
        reasoning_box[0] (NOT into the answer content)."""
        from app.services import task_service
        from app.services.openai_service import CallingMode

        captured: dict = {}
        events = [
            {"type": "reasoning_delta", "content": "Let me think. "},
            {"type": "reasoning_delta", "content": "Step 2."},
            {"type": "delta", "content": "Final answer."},
        ]
        stub, _stream = _make_open_stream_stub(
            events, CallingMode.NATIVE, captured=captured
        )

        async def _fake_cap(model):
            return {"provider": "moonshot"}

        reasoning_box: list[str] = [""]
        usage_box: dict = {}
        with patch.object(task_service, "open_stream", stub), \
            patch("app.config.get_model_capability_async", _fake_cap):
            content, tool_calls = await task_service._stream_one_iteration(
                messages=[{"role": "system", "content": "sys"}],
                tools=[],
                model="kimi-thinking-preview",
                user_settings=None,
                provider="moonshot",
                reasoning_box=reasoning_box,
                usage_box=usage_box,
            )

        # Reasoning went to the box; content is ONLY the answer delta.
        assert reasoning_box[0] == "Let me think. Step 2."
        assert content == "Final answer."

    @pytest.mark.asyncio
    async def test_usage_and_usage_delta_sum_into_box(self):
        """usage + usage_delta accumulate; the usage_box sums across the stream
        (and across iterations when the same box is reused)."""
        from app.services import task_service
        from app.services.openai_service import CallingMode

        captured: dict = {}
        events = [
            {"type": "usage", "input_tokens": 100, "output_tokens": 10},
            {"type": "usage_delta", "output_tokens": 5},
            {"type": "usage_delta", "output_tokens": 7},
            {"type": "delta", "content": "ok"},
        ]
        stub, _stream = _make_open_stream_stub(
            events, CallingMode.NATIVE, captured=captured
        )

        async def _fake_cap(model):
            return {"provider": "openai"}

        usage_box: dict = {}
        with patch.object(task_service, "open_stream", stub), \
            patch("app.config.get_model_capability_async", _fake_cap):
            await task_service._stream_one_iteration(
                messages=[{"role": "system", "content": "sys"}],
                tools=[],
                model="gpt-5.4-mini",
                user_settings=None,
                provider="openai",
                usage_box=usage_box,
            )
            # Reuse the SAME box for a second iteration → sums.
            await task_service._stream_one_iteration(
                messages=[{"role": "system", "content": "sys"}],
                tools=[],
                model="gpt-5.4-mini",
                user_settings=None,
                provider="openai",
                usage_box=usage_box,
            )

        # First iter: in=100, out=10+5+7=22. Second iter doubles it.
        assert usage_box["input_tokens"] == 200
        assert usage_box["output_tokens"] == 44

    @pytest.mark.asyncio
    async def test_plain_provider_no_signature_no_reasoning_no_usage(self):
        """OpenAI/Anthropic/DeepSeek/MiniMax happy path: no thought_signature, no
        reasoning_delta, no usage → returned tool_calls carry NO thought_signature
        key, reasoning_box[0]=="", usage_box stays empty (byte-identical)."""
        from app.services import task_service
        from app.services.openai_service import CallingMode

        captured: dict = {}
        events = [
            {"type": "tool_start", "id": "toolu_1", "name": "search_documents",
             "args": {"query": "x"}},
            {"type": "finish", "finish_reason": "tool_calls", "tool_calls": [{}]},
        ]
        stub, _stream = _make_open_stream_stub(
            events, CallingMode.NATIVE, captured=captured
        )

        reasoning_box: list[str] = [""]
        usage_box: dict = {}
        with patch.object(task_service, "open_stream", stub):
            content, tool_calls = await task_service._stream_one_iteration(
                messages=[{"role": "system", "content": "sys"}],
                tools=[],
                model="claude-haiku-4-5-20251001",
                user_settings=None,
                provider="anthropic",
                reasoning_box=reasoning_box,
                usage_box=usage_box,
            )

        assert len(tool_calls) == 1
        assert "thought_signature" not in tool_calls[0]
        assert reasoning_box[0] == ""
        assert usage_box == {}

    @pytest.mark.asyncio
    async def test_boxes_optional_none_default_byte_identical(self):
        """The boxes are ADDITIVE None-defaults: calling without them (the lone
        llm_single caller + _fake_stream fixtures) drives identically — finish/usage
        are consumed harmlessly into local accumulators and discarded."""
        from app.services import task_service
        from app.services.openai_service import CallingMode

        captured: dict = {}
        events = [
            {"type": "delta", "content": "answer"},
            {"type": "usage", "input_tokens": 5, "output_tokens": 3},
            {"type": "finish", "finish_reason": "stop", "tool_calls": []},
        ]
        stub, _stream = _make_open_stream_stub(
            events, CallingMode.NATIVE, captured=captured
        )

        async def _fake_cap(model):
            return {"provider": "openai"}

        with patch.object(task_service, "open_stream", stub), \
            patch("app.config.get_model_capability_async", _fake_cap):
            content, tool_calls = await task_service._stream_one_iteration(
                messages=[{"role": "system", "content": "sys"}],
                tools=[],
                model="gpt-5.4-mini",
                user_settings=None,
                provider="openai",
            )

        assert content == "answer"
        assert tool_calls == []

    # -- Task 2: assistant replay-message round-trip + usage persistence -------

    @pytest.mark.asyncio
    async def test_replay_message_carries_thought_signature_google(self):
        """A Google sub-agent iteration produces tool_calls carrying thought_signature
        → the assistant replay message (built for the NEXT iteration) carries
        thought_signature on each tool_call dict (so Google does NOT 400 on round 2)."""
        from app.services import task_service

        ctx = _build_sub_agent_ctx()
        snapshots: list = []
        finalize_capture: dict = {}
        _call = {"n": 0}

        async def _fake_stream(*, messages, tools, model, user_settings,
                               provider=None, structured_injected=None,
                               reasoning_box=None, usage_box=None, **_kwargs):
            snapshots.append([dict(m) for m in messages])
            i = _call["n"]
            _call["n"] += 1
            if i == 0:
                if usage_box is not None:
                    usage_box["input_tokens"] = 80
                    usage_box["output_tokens"] = 20
                return "", [{
                    "id": "fn_1", "name": "search_documents",
                    "arguments": '{"query": "x"}', "thought_signature": "SIG_G",
                }]
            return "Final.", []

        async def _fake_dispatch(name, args, sub_ctx):
            from app.services.tool_dispatcher import ToolResult
            return ToolResult(result="r")

        async def _capture_finalize(**kwargs):
            finalize_capture.update(kwargs)

        with patch.object(task_service, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
            patch.object(task_service, "insert_run", AsyncMock()), \
            patch.object(task_service, "finalize_run", _capture_finalize), \
            patch.object(task_service, "resolve_sub_agent_model_safely", lambda *a, **k: "m"), \
            patch.object(task_service, "get_tools", lambda us: []), \
            patch.object(task_service, "dispatch_tool", _fake_dispatch), \
            patch.object(task_service, "_stream_one_iteration", _fake_stream):
            await task_service.run_task_sub_agent(
                parent_ctx=ctx, description="go", instructions=None,
                allowed_tools=["search_documents"], max_steps=3,
            )

        # The SECOND iteration's inbound messages must include the assistant
        # tool-call message carrying thought_signature on the tool_call dict.
        second_inbound = snapshots[1]
        assistant_msgs = [m for m in second_inbound if m.get("role") == "assistant"
                          and m.get("tool_calls")]
        assert assistant_msgs, "no assistant tool-call message replayed"
        tc = assistant_msgs[-1]["tool_calls"][0]
        assert tc.get("thought_signature") == "SIG_G"

    @pytest.mark.asyncio
    async def test_replay_message_carries_reasoning_content_moonshot(self):
        """A Moonshot sub-agent iteration accumulates reasoning_content → the assistant
        replay message carries reasoning_content (so Moonshot does NOT 400 on round 2)."""
        from app.services import task_service

        ctx = _build_sub_agent_ctx()
        snapshots: list = []
        finalize_capture: dict = {}
        _call = {"n": 0}

        async def _fake_stream(*, messages, tools, model, user_settings,
                               provider=None, structured_injected=None,
                               reasoning_box=None, usage_box=None, **_kwargs):
            snapshots.append([dict(m) for m in messages])
            i = _call["n"]
            _call["n"] += 1
            if i == 0:
                if reasoning_box is not None:
                    reasoning_box[0] = "I will search the corpus."
                return "narration", [{
                    "id": "c1", "name": "search_documents", "arguments": '{"query":"x"}',
                }]
            return "Final.", []

        async def _fake_dispatch(name, args, sub_ctx):
            from app.services.tool_dispatcher import ToolResult
            return ToolResult(result="r")

        async def _capture_finalize(**kwargs):
            finalize_capture.update(kwargs)

        with patch.object(task_service, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
            patch.object(task_service, "insert_run", AsyncMock()), \
            patch.object(task_service, "finalize_run", _capture_finalize), \
            patch.object(task_service, "resolve_sub_agent_model_safely", lambda *a, **k: "m"), \
            patch.object(task_service, "get_tools", lambda us: []), \
            patch.object(task_service, "dispatch_tool", _fake_dispatch), \
            patch.object(task_service, "_stream_one_iteration", _fake_stream):
            await task_service.run_task_sub_agent(
                parent_ctx=ctx, description="go", instructions=None,
                allowed_tools=["search_documents"], max_steps=3,
            )

        second_inbound = snapshots[1]
        assistant_msgs = [m for m in second_inbound if m.get("role") == "assistant"
                          and m.get("tool_calls")]
        assert assistant_msgs, "no assistant tool-call message replayed"
        assert assistant_msgs[-1].get("reasoning_content") == "I will search the corpus."

    @pytest.mark.asyncio
    async def test_replay_message_no_metadata_for_plain_provider(self):
        """A plain OpenAI sub-agent's replay message carries NEITHER thought_signature
        NOR reasoning_content (conditional spread → byte-identical)."""
        from app.services import task_service

        ctx = _build_sub_agent_ctx()
        snapshots: list = []
        finalize_capture: dict = {}
        _call = {"n": 0}

        async def _fake_stream(*, messages, tools, model, user_settings,
                               provider=None, structured_injected=None,
                               reasoning_box=None, usage_box=None, **_kwargs):
            snapshots.append([dict(m) for m in messages])
            i = _call["n"]
            _call["n"] += 1
            if i == 0:
                # No reasoning, no thought_signature, no usage (plain provider).
                return "", [{"id": "c1", "name": "search_documents",
                             "arguments": '{"query":"x"}'}]
            return "Final.", []

        async def _fake_dispatch(name, args, sub_ctx):
            from app.services.tool_dispatcher import ToolResult
            return ToolResult(result="r")

        async def _capture_finalize(**kwargs):
            finalize_capture.update(kwargs)

        with patch.object(task_service, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
            patch.object(task_service, "insert_run", AsyncMock()), \
            patch.object(task_service, "finalize_run", _capture_finalize), \
            patch.object(task_service, "resolve_sub_agent_model_safely", lambda *a, **k: "m"), \
            patch.object(task_service, "get_tools", lambda us: []), \
            patch.object(task_service, "dispatch_tool", _fake_dispatch), \
            patch.object(task_service, "_stream_one_iteration", _fake_stream):
            await task_service.run_task_sub_agent(
                parent_ctx=ctx, description="go", instructions=None,
                allowed_tools=["search_documents"], max_steps=3,
            )

        second_inbound = snapshots[1]
        assistant_msgs = [m for m in second_inbound if m.get("role") == "assistant"
                          and m.get("tool_calls")]
        assert assistant_msgs
        am = assistant_msgs[-1]
        assert "reasoning_content" not in am
        assert "thought_signature" not in am["tool_calls"][0]
        # finalize_run was called with None tokens (no usage emitted — graceful).
        assert finalize_capture.get("input_tokens") is None
        assert finalize_capture.get("output_tokens") is None

    @pytest.mark.asyncio
    async def test_finalize_run_persists_accumulated_usage(self):
        """When usage was emitted across the loop, finalize_run is called with the
        SUMMED input/output tokens (NOT None) — S4 closed (D-17)."""
        from app.services import task_service

        ctx = _build_sub_agent_ctx()
        finalize_capture: dict = {}
        _call = {"n": 0}

        async def _fake_stream(*, messages, tools, model, user_settings,
                               provider=None, structured_injected=None,
                               reasoning_box=None, usage_box=None, **_kwargs):
            i = _call["n"]
            _call["n"] += 1
            if usage_box is not None:
                usage_box["input_tokens"] = (usage_box.get("input_tokens") or 0) + 100
                usage_box["output_tokens"] = (usage_box.get("output_tokens") or 0) + 30
            if i == 0:
                return "", [{"id": "c1", "name": "search_documents",
                             "arguments": '{"query":"x"}'}]
            return "Final.", []

        async def _fake_dispatch(name, args, sub_ctx):
            from app.services.tool_dispatcher import ToolResult
            return ToolResult(result="r")

        async def _capture_finalize(**kwargs):
            finalize_capture.update(kwargs)

        with patch.object(task_service, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
            patch.object(task_service, "insert_run", AsyncMock()), \
            patch.object(task_service, "finalize_run", _capture_finalize), \
            patch.object(task_service, "resolve_sub_agent_model_safely", lambda *a, **k: "m"), \
            patch.object(task_service, "get_tools", lambda us: []), \
            patch.object(task_service, "dispatch_tool", _fake_dispatch), \
            patch.object(task_service, "_stream_one_iteration", _fake_stream):
            await task_service.run_task_sub_agent(
                parent_ctx=ctx, description="go", instructions=None,
                allowed_tools=["search_documents"], max_steps=3,
            )

        # Two iterations each added (100, 30) → summed.
        assert finalize_capture.get("input_tokens") == 200
        assert finalize_capture.get("output_tokens") == 60
