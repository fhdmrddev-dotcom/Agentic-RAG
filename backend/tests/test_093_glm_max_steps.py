"""Phase 093 / Plan 09 (D-19) — GLM/zhipu sub-agent max_steps convergence.

PINNED ROOT CAUSE (LIVE GLM literature_review run, thread
71502600-4c65-4ab9-9f6c-42b51ef93940, workflow_run f3cffe56, run 7db77efa +
LangSmith trace, project agentic-rag-module2 + DB runs rows + the D-20 log-sink):
Branch B — the 8-step cap was too low for a THOROUGH sub-agent. The workflow
SUCCEEDED end-to-end (~8,118-char merged review), but ONE of the three
``llm_batch_agents`` review sub-agents (the "RPA integration challenges"
sub-question) hit the 8-step cap WHILE STILL RESEARCHING — it issued 8 DISTINCT,
progressively-refined search queries (broad theme → technical → organizational →
academic authors → specific mechanisms; genuine thorough research, NOT a stuck
repetitive loop) — and so returned the useless placeholder
"Sub-agent reached max_steps without producing a final answer." (leaked into the
merged review as a thin "Result 1"). The other two GLM agents converged (one at
step ~5, one at EXACTLY step 8 — the cap edge), proving GLM knows how to stop and
write; the budget just sat on the knife's edge. ``finish_reason: tool_calls``
throughout → GLM used NATIVE tool calls (glm-4.6 is native_tools:True), so the
STRUCTURED post-parse is NOT the loop path (rules out Branch C) and there is no
deep provider defect (rules out Branch D). This is really a GENERAL reliability
gap: any thorough sub-agent (any provider) still searching at the cap returned
that placeholder; GLM trips it most because it searches more granularly.

OPERATOR-AUTHORIZED BRANCH (hybrid B+):
  1. PRIMARY — FORCE-SYNTHESIZE on exhaustion: in run_task_sub_agent's
     ``for step in range(max_steps): ... else:`` block, make ONE final TOOL-FREE
     synthesis turn so the sub-agent ALWAYS returns a real answer (closes the
     silent-failure class for ALL providers). tools=[] → the 093-05 WR-01 gate
     (``_has_tools = bool(tools)``) SKIPS the STRUCTURED inject + post-parse, so
     the synthesized answer is never blanked.
  2. COMPLEMENT — raise the EFFECTIVE per-phase step cap 8 → 12 (config.py
     harness_phase_max_steps + phase_types._MODEL_DEFAULT_MAX_STEPS +
     models/harness.py LlmAgentPhaseConfig/LlmBatchAgentsPhaseConfig.max_steps, all
     in lockstep) so thorough agents usually finish naturally before the fallback.

These tests pin the PRIMARY guarantee deterministically (no live provider calls —
feedback_mock_completeness: all network deps mocked):
  - A looping sub-agent (every step returns tool_calls, never a tool-free answer)
    → the loop exhausts → the FINAL synthesis call fires with tools=[] and the
    summary is the SYNTHESIZED answer, NOT the placeholder.
  - A control sub-agent that converges early via ``if not tool_calls: break`` →
    the force-synthesis path is NOT taken (no extra _stream_one_iteration call).

The cap-raise (the COMPLEMENT) is verified in test_harness_engine.py
(LOCKED-default assertions repinned to 12) + the live D-21 re-UAT (verifier-owned,
093-VALIDATION.md — the BINDING gate).
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


THREAD_ID = "33333333-3333-3333-3333-333333333333"
PARENT_RUN_ID = uuid4()

# A real-shaped tool schema so the sub-agent loop's `sub_tool_schemas` is NON-EMPTY
# (the loop filters get_tools(...) by allowed_tools). This is the load-bearing
# distinction in these tests: the LOOP body calls _stream_one_iteration with
# tools=[the schema] (truthy), while the FORCED synthesis turn calls it with
# tools=[] — so the fake can tell them apart on `bool(tools)`.
_SEARCH_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "search_documents",
        "description": "Search the knowledge base.",
        "parameters": {"type": "object", "properties": {}},
    },
}


def _build_sub_agent_ctx():
    """A parent ToolContext for direct run_task_sub_agent calls (no nesting cap).

    Mirrors test_085_task_service._build_sub_agent_ctx so the fixture shape stays
    consistent with the existing 093 sub-agent-loop tests."""
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


class Test093GlmMaxSteps:
    """093-09 (D-19) — the force-synthesis fallback guarantees a real terminal
    answer on max_steps exhaustion (the GLM symptom + the general silent-failure
    class), and converging sub-agents are byte-identical (no extra call)."""

    @pytest.mark.asyncio
    async def test_exhausted_loop_force_synthesizes_real_answer(self):
        """A glm-shaped sub-agent that NEVER returns a tool-free answer (every step
        emits a tool_call — the LIVE-UAT looping symptom) exhausts the loop → the
        FINAL synthesis turn fires with tools=[] and the summary is the SYNTHESIZED
        answer, NOT the 'reached max_steps' placeholder."""
        from app.services import task_service

        ctx = _build_sub_agent_ctx()
        calls: list[dict] = []
        result: dict = {}

        async def _fake_stream(*, messages, tools, model, user_settings,
                               provider=None, structured_injected=None,
                               reasoning_box=None, usage_box=None, **_kwargs):
            # Record every call so we can assert the synthesis turn fired with no tools.
            calls.append({"tools": list(tools), "messages": [dict(m) for m in messages]})
            if tools:
                # Still has tools → keep emitting a tool_call (never converges).
                # This is the GLM "thorough sub-agent still searching at the cap"
                # behavior: it never reaches `if not tool_calls: break`.
                return "", [{
                    "id": f"c{len(calls)}",
                    "name": "search_documents",
                    "arguments": '{"query": "rpa integration challenges"}',
                }]
            # tools=[] → the FORCED synthesis turn. The model writes its answer
            # from everything it gathered above.
            return ("Synthesized review of RPA integration challenges.", [])

        async def _fake_dispatch(name, args, sub_ctx):
            from app.services.tool_dispatcher import ToolResult
            return ToolResult(result="found 3 sources")

        max_steps = 4
        with patch.object(task_service, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
            patch.object(task_service, "insert_run", AsyncMock()), \
            patch.object(task_service, "finalize_run", AsyncMock()), \
            patch.object(task_service, "resolve_sub_agent_model_safely", lambda *a, **k: "glm-4.6"), \
            patch.object(task_service, "get_tools", lambda us: [_SEARCH_TOOL_SCHEMA]), \
            patch.object(task_service, "dispatch_tool", _fake_dispatch), \
            patch.object(task_service, "_stream_one_iteration", _fake_stream):
            result = await task_service.run_task_sub_agent(
                parent_ctx=ctx, description="RPA integration challenges",
                instructions=None, allowed_tools=["search_documents"],
                max_steps=max_steps,
            )

        # The summary is the SYNTHESIZED answer — NOT the placeholder.
        assert result["summary"] == "Synthesized review of RPA integration challenges."
        assert "reached max_steps" not in result["summary"]
        # The status is still completed (exhaustion is not an error).
        assert result["status"] == "completed"
        # There were exactly max_steps tool-emitting iterations PLUS one final
        # synthesis turn → max_steps + 1 calls, and the LAST call had NO tools.
        assert len(calls) == max_steps + 1
        assert calls[-1]["tools"] == []
        # Every prior call DID have tools (the loop body).
        assert all(c["tools"] for c in calls[:-1])
        # The synthesis turn's last message is the no-more-tools nudge.
        assert calls[-1]["messages"][-1]["role"] == "user"
        assert "Do not call any more tools" in calls[-1]["messages"][-1]["content"]

    @pytest.mark.asyncio
    async def test_converging_sub_agent_does_not_force_synthesize(self):
        """CONTROL: a sub-agent that returns a tool-free answer on an early step
        converges via the normal `if not tool_calls: break` → the force-synthesis
        path is NOT taken (no extra tools=[] call). Byte-identical to pre-093-09
        for the 4 passing providers + Google + Moonshot + the converging GLM agents
        + Deep — they never reach the else-branch."""
        from app.services import task_service

        ctx = _build_sub_agent_ctx()
        calls: list[dict] = []

        async def _fake_stream(*, messages, tools, model, user_settings,
                               provider=None, structured_injected=None,
                               reasoning_box=None, usage_box=None, **_kwargs):
            calls.append({"tools": list(tools)})
            i = len(calls)
            if i == 1:
                # First turn: one tool call.
                return "", [{
                    "id": "c1", "name": "search_documents",
                    "arguments": '{"query": "x"}',
                }]
            # Second turn: a tool-FREE final answer → the loop breaks here.
            return ("Converged final answer.", [])

        async def _fake_dispatch(name, args, sub_ctx):
            from app.services.tool_dispatcher import ToolResult
            return ToolResult(result="r")

        with patch.object(task_service, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
            patch.object(task_service, "insert_run", AsyncMock()), \
            patch.object(task_service, "finalize_run", AsyncMock()), \
            patch.object(task_service, "resolve_sub_agent_model_safely", lambda *a, **k: "glm-4.6"), \
            patch.object(task_service, "get_tools", lambda us: [_SEARCH_TOOL_SCHEMA]), \
            patch.object(task_service, "dispatch_tool", _fake_dispatch), \
            patch.object(task_service, "_stream_one_iteration", _fake_stream):
            result = await task_service.run_task_sub_agent(
                parent_ctx=ctx, description="digital maturity",
                instructions=None, allowed_tools=["search_documents"],
                max_steps=8,
            )

        # Converged on the 2nd turn → exactly 2 calls, NEITHER with tools=[]
        # (the force-synthesis turn never fired — its hallmark is a tools=[] call).
        assert result["summary"] == "Converged final answer."
        assert result["status"] == "completed"
        assert len(calls) == 2
        assert all(c["tools"] for c in calls), \
            "force-synthesis (tools=[]) fired for a CONVERGING sub-agent — regression"

    @pytest.mark.asyncio
    async def test_force_synthesis_failure_falls_back_to_placeholder(self):
        """Defensive (T-093-09-DOS): if the FORCED synthesis turn raises, the
        sub-agent never crashes — it falls back to the last content, then the
        original placeholder, so the run always terminates cleanly."""
        from app.services import task_service

        ctx = _build_sub_agent_ctx()
        _call = {"n": 0}

        async def _fake_stream(*, messages, tools, model, user_settings,
                               provider=None, structured_injected=None,
                               reasoning_box=None, usage_box=None, **_kwargs):
            _call["n"] += 1
            if tools:
                # Empty content on every tool turn so the last-content fallback is
                # also empty → the placeholder is the final fallback.
                return "", [{
                    "id": f"c{_call['n']}", "name": "search_documents",
                    "arguments": '{"query": "x"}',
                }]
            # The synthesis turn (tools=[]) RAISES.
            raise RuntimeError("synthesis provider blew up")

        async def _fake_dispatch(name, args, sub_ctx):
            from app.services.tool_dispatcher import ToolResult
            return ToolResult(result="r")

        with patch.object(task_service, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
            patch.object(task_service, "insert_run", AsyncMock()), \
            patch.object(task_service, "finalize_run", AsyncMock()), \
            patch.object(task_service, "resolve_sub_agent_model_safely", lambda *a, **k: "glm-4.6"), \
            patch.object(task_service, "get_tools", lambda us: [_SEARCH_TOOL_SCHEMA]), \
            patch.object(task_service, "dispatch_tool", _fake_dispatch), \
            patch.object(task_service, "_stream_one_iteration", _fake_stream):
            result = await task_service.run_task_sub_agent(
                parent_ctx=ctx, description="x", instructions=None,
                allowed_tools=["search_documents"], max_steps=2,
            )

        # The run terminated cleanly with the graceful placeholder (NOT a crash).
        assert result["status"] == "completed"
        assert result["summary"] == (
            "Sub-agent reached max_steps without producing a final answer."
        )
