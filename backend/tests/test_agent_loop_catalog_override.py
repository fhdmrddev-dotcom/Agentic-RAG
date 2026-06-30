"""Phase 133 Plan 02 (EVAL-02) — RunContext.skill_catalog_override regression guard.

The honest eval A/B (WITH-skill vs WITHOUT-skill) needs ONE additive, default-off
input on the shared Deep/agent-loop path: ``RunContext.skill_catalog_override``.
Modeled byte-for-byte on the Phase 092 ``resume_dropped_tool_calls`` precedent, it
controls the data source of the skill-catalog injection block (agent_loop.py:1174-1195):

  * ``None``     → query the DB exactly as today (Deep Mode byte-identical, SC#4 / D-14).
  * ``()``       → inject NOTHING (WITHOUT arm, D-04 — the ``if enabled_skills:`` guard
                   short-circuits, so no ``## Available Skills`` note is appended).
  * ``(skill,)`` → inject EXACTLY those skills (WITH arm, D-03), no DB query.

This is a G-5 hot-file touch, so it ships RED-first: these tests FAIL today because
``RunContext`` has no ``skill_catalog_override`` field (constructing it raises
TypeError). After Task 2 lands the additive field + the single read-site branch,
all three go GREEN — ``test_deep_mode_unchanged`` is the SC#4 truth.

Pattern mirrors tests/integration/test_089_agent_loop_result_seam.py: drive
``run_agent_loop`` directly with a constructed ``RunContext`` and a mocked LLM,
capturing the system prompt via the ``create_adaptive_streaming_chat`` patch.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.agent_loop import RunContext, run_agent_loop
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import (
    _build_mock_supabase,
    _make_result,
    _make_table_builder,
)

THREAD_ID = str(uuid4())
USER_ID = "00000000-0000-0000-0000-000000000001"


# ---------------------------------------------------------------------------
# Helpers (mirror test_089_agent_loop_result_seam.py)
# ---------------------------------------------------------------------------

def _clean_sse_chunk(content, finish_reason=None):
    chunk = MagicMock()
    chunk.usage = None
    chunk.choices = [MagicMock()]
    chunk.choices[0].finish_reason = finish_reason
    delta = MagicMock()
    delta.content = content
    delta.tool_calls = None
    delta.reasoning_content = None
    chunk.choices[0].delta = delta
    return chunk


def _clean_chunks():
    for token in ("a", "b", "c"):
        yield _clean_sse_chunk(token)
    yield _clean_sse_chunk(None, finish_reason="stop")


def _make_user_settings() -> MagicMock:
    s = MagicMock()
    s.active_provider = "openai"
    s.llm_model = "gpt-5.4-mini"
    s.llm_api_key = "sk-test"
    s.llm_base_url = "https://api.openai.com/v1"
    s.openrouter_tool_strategy = "quality"
    s.web_search_enabled = True
    s.sandbox_enabled = True
    s.task_per_run_concurrency = 3
    return s


def _make_body() -> MagicMock:
    b = MagicMock()
    b.model = "gpt-5.4-mini"
    b.provider = None
    b.agent_mode = "general"  # != "explorer" → skill-injection block runs
    b.content = "catalog override test prompt"
    return b


def _make_redis_mock() -> MagicMock:
    redis_mock = MagicMock()
    redis_mock.xadd = AsyncMock(return_value=b"1-0")
    redis_mock.expire = AsyncMock(return_value=True)
    redis_mock.zadd = AsyncMock(return_value=1)
    redis_mock.zrem = AsyncMock(return_value=1)
    redis_mock.aclose = AsyncMock(return_value=None)
    return redis_mock


def _supabase_with_tracked_skills(skills_rows):
    """Build a mock supabase whose ``skills`` table returns ``skills_rows`` and
    records every ``.execute()`` so a test can assert the DB query path was
    (or was NOT) taken. ``user_memory`` returns [] so no memory note is appended.
    """
    sb = _build_mock_supabase()
    # threads folder SELECT → no folder scope (keeps the system prompt clean)
    sb.table("threads").execute.side_effect = (
        lambda *a, **k: _make_result({"id": THREAD_ID, "folder_id": None})
    )

    skills_calls: list = []

    def _skills_execute(*a, **k):
        skills_calls.append((a, k))
        return _make_result(list(skills_rows))

    skills_builder = _make_table_builder(_skills_execute)

    _orig_side = sb.table.side_effect

    def _route(name):
        if name == "skills":
            return skills_builder
        return _orig_side(name)

    sb.table.side_effect = _route
    return sb, skills_calls


async def _capture_system_prompt(ctx: RunContext) -> str:
    """Drive run_agent_loop with a mocked LLM and return the system-prompt
    content from the FIRST create_adaptive_streaming_chat call."""
    captured: dict = {}

    def _fake_chat(messages, *a, **k):
        if "messages" not in captured:
            captured["messages"] = list(messages)
        return iter(_clean_chunks()), CallingMode.NATIVE

    _emit = AsyncMock(return_value=None)
    _emit_terminal = AsyncMock(return_value=None)

    def _spawn(coro):
        return asyncio.ensure_future(coro)

    with patch(
        "app.services.provider_gateway.openai_compat.create_adaptive_streaming_chat",
        side_effect=_fake_chat,
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
            emit=_emit,
            emit_terminal=_emit_terminal,
            spawn=_spawn,
            result_sink={},
        )

    system_msgs = [m for m in captured.get("messages", []) if m.get("role") == "system"]
    assert len(system_msgs) == 1, f"expected one system message, got {len(system_msgs)}"
    return system_msgs[0]["content"]


def _make_ctx(supabase, *, skill_catalog_override) -> RunContext:
    return RunContext(
        run_id=uuid4(),
        thread_id=THREAD_ID,
        current_user={"id": USER_ID},
        user_settings=_make_user_settings(),
        body=_make_body(),
        redis=_make_redis_mock(),
        supabase=supabase,
        resolved_model="gpt-5.4-mini",
        resolved_provider="openai",
        skill_catalog_override=skill_catalog_override,
    )


# ---------------------------------------------------------------------------
# 1. None → DB query path UNCHANGED (SC#4 / D-14 Deep Mode byte-identical)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_deep_mode_unchanged():
    """With skill_catalog_override=None the injection block issues the existing
    skills DB query AND builds the `## Available Skills` note from the query
    results — byte-identical to the pre-field behavior (SC#4)."""
    rows = [
        {"name": "Alpha", "description": "alpha skill"},
        {"name": "Beta", "description": "beta skill"},
    ]
    sb, skills_calls = _supabase_with_tracked_skills(rows)
    ctx = _make_ctx(sb, skill_catalog_override=None)

    prompt = await _capture_system_prompt(ctx)

    # The DB query path WAS taken (default behavior preserved).
    assert len(skills_calls) >= 1, "skills DB query must be issued when override is None"
    # The catalog note is built from the query results.
    assert "## Available Skills" in prompt
    assert "- **Alpha**: alpha skill" in prompt
    assert "- **Beta**: beta skill" in prompt


# ---------------------------------------------------------------------------
# 2. (skill,) → inject ONLY that skill, no DB query (WITH arm, D-03)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_with_arm_injects_only_target():
    """With skill_catalog_override=({"name":"X",...},) NO skills DB query is
    issued and the catalog note contains exactly skill X and no other."""
    # The DB would return decoy rows; the override must shadow them entirely.
    decoy = [{"name": "Decoy", "description": "must not appear"}]
    sb, skills_calls = _supabase_with_tracked_skills(decoy)
    ctx = _make_ctx(
        sb,
        skill_catalog_override=({"name": "X", "description": "target skill"},),
    )

    prompt = await _capture_system_prompt(ctx)

    assert len(skills_calls) == 0, "no skills DB query when override is a tuple"
    assert "## Available Skills" in prompt
    assert "- **X**: target skill" in prompt
    assert "Decoy" not in prompt


# ---------------------------------------------------------------------------
# 3. () → inject NOTHING (WITHOUT arm, D-04)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_without_arm_injects_nothing():
    """With skill_catalog_override=() NO skills DB query is issued and NO
    `## Available Skills` note is appended (the `if enabled_skills:` guard
    short-circuits)."""
    decoy = [{"name": "Decoy", "description": "must not appear"}]
    sb, skills_calls = _supabase_with_tracked_skills(decoy)
    ctx = _make_ctx(sb, skill_catalog_override=())

    prompt = await _capture_system_prompt(ctx)

    assert len(skills_calls) == 0, "no skills DB query when override is ()"
    assert "## Available Skills" not in prompt
    assert "Decoy" not in prompt
