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
    model with many fields). The helper only reads .active_provider,
    .llm_model, and .llm_models."""

    def __init__(self, *, active_provider: str, llm_model: str, llm_models: str):
        self.active_provider = active_provider
        self.llm_model = llm_model
        self.llm_models = llm_models


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


def test_resolve_empty_llm_models_list_lets_override_pass_through():
    """Edge case: user has no llm_models declared -> resolver can't validate,
    so override_model is trusted (matches sub_agent_service.py:67 conditional)."""
    from app.services.sub_agent_models import resolve_sub_agent_model_safely
    us = _StubUserSettings(
        active_provider="openai",
        llm_model="gpt-4o",
        llm_models="",  # empty — no validation possible
    )
    # Without a llm_models list, the helper cannot detect cross-provider —
    # it must trust the override and let downstream provider errors surface.
    assert resolve_sub_agent_model_safely(us, override_model="claude-3") == "claude-3"


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


def test_resolve_with_empty_active_models_list_skips_validation():
    """Plan 05: if the user's llm_models is empty, there's nothing to
    validate against, so the helper returns the candidate without engaging
    the new safety net.

    This preserves the pre-Plan-05 behavior for users who haven't yet
    populated their provider's model list (fresh installs / partial settings
    rows).
    """
    from app.services.sub_agent_models import resolve_sub_agent_model_safely

    us = _StubUserSettings(
        active_provider="anthropic",
        llm_model="gpt-4.1",  # would normally be cross-provider
        llm_models="",  # empty — no list to validate against
    )
    result = resolve_sub_agent_model_safely(us, override_model=None)
    # Without an llm_models list, validation is skipped — return candidate
    # as-is. Documents the trade-off: we trust the caller when we have
    # no list to compare against.
    assert result == "gpt-4.1"


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

    async def _fake_stream(*, messages, tools, model, user_settings):
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
