"""292.1-REVIEW WR-02 — tool-call markup never flows raw out of ``task_service._stream_one_iteration``.

Before 292.1 the OpenAI-compat adapter stripped the two-bar DSML spelling for every ``open_stream``
consumer. 292.1 retired that strip and put the provider-blind replacement (``TagHoldback`` +
``settle``) in ``agent_loop`` only — so ``_stream_one_iteration``, used by ``task()`` sub-agents
and by harness workflow phases (``harness/phase_types.py``), appended every delta straight into
its content. Two-bar DSML then reached sub-agent results (fed to the parent, emitted in
``tool_end``, persisted in ``messages.tool_calls``) and harness phase outputs.

This path does not parse or execute text calls (it never did); it strips them and words a
markup-only answer with the one shared sentence, the same as the Deep loop's save point.
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.services.openai_service import CallingMode
from app.services.structured_text_holdback import FAILED_CALL_NOTICE

# F3 — two-bar DSML, the spelling the retired adapter strip used to catch (local msg dcf1b29e).
F3 = ('<｜｜DSML｜｜tool_calls>\n<｜｜DSML｜｜invoke name="execute_code">\n'
      '<｜｜DSML｜｜parameter name="code" string="true">print(1)</｜｜DSML｜｜parameter>\n'
      '</｜｜DSML｜｜invoke>\n</｜｜DSML｜｜tool_calls>')
PREAMBLE = "The totals are below.\n\n"


class _Stream:
    def __init__(self, events):
        self._events = events

    def __iter__(self):
        return iter(self._events)

    def close(self):
        pass


def _deltas(text: str, n: int = 7) -> list[dict]:
    return [{"type": "delta", "content": text[i:i + n]} for i in range(0, len(text), n)] + [
        {"type": "finish", "finish_reason": "stop"}]


async def _iterate(events: list[dict], *, tools: list | None = None) -> tuple[str, list[dict]]:
    from app.services import task_service

    with patch.object(task_service, "open_stream",
                      AsyncMock(return_value=(_Stream(events), CallingMode.NATIVE))), \
            patch("app.config.get_model_capability_async", AsyncMock(return_value={"provider": "deepseek"})), \
            patch.object(task_service, "get_per_call_timeout_async", AsyncMock(return_value=60)):
        return await task_service._stream_one_iteration(
            messages=[{"role": "system", "content": "You are a sub-agent."},
                      {"role": "user", "content": "Total it."}],
            tools=tools or [],
            model="deepseek-v4-pro",
            user_settings=SimpleNamespace(active_provider="deepseek"),
            provider="deepseek",
        )


@pytest.mark.asyncio
async def test_two_bar_dsml_after_a_preamble_never_reaches_the_output():
    content, calls = await _iterate(_deltas(PREAMBLE + F3))
    assert "DSML" not in content and "｜" not in content
    assert content.startswith(PREAMBLE.rstrip())
    assert content.endswith(FAILED_CALL_NOTICE)
    assert calls == [], "this path strips text calls; it does not run them"


@pytest.mark.asyncio
async def test_a_markup_only_answer_becomes_the_one_worded_sentence_never_empty():
    content, calls = await _iterate(_deltas(F3))
    assert content == FAILED_CALL_NOTICE
    assert calls == []


@pytest.mark.asyncio
async def test_markup_beside_a_native_call_is_stripped_without_wording():
    events = [{"type": "delta", "content": PREAMBLE + F3},
              {"type": "tool_preparing", "index": 0, "id": "call_1", "name": "search_documents"},
              {"type": "tool_args_progress", "tool_index": 0, "name": "search_documents",
               "code_so_far": '{"query": "x"}'},
              {"type": "finish", "finish_reason": "tool_calls"}]
    content, calls = await _iterate(events, tools=[{"type": "function", "function": {"name": "search_documents"}}])
    assert content == PREAMBLE
    assert [c["name"] for c in calls] == ["search_documents"]


@pytest.mark.asyncio
@pytest.mark.parametrize("text", [
    "Revenue rose every month.",
    "Qwen-style models wrap each call in <tool_call> tags, and the server parses them out.",
])
async def test_a_clean_answer_is_byte_identical(text):
    content, _calls = await _iterate(_deltas(text))
    assert content == text
