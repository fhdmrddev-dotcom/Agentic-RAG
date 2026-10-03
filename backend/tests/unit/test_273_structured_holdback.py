"""Phase 273 (SC#2 / RESEARCH OQ1 (RESOLVED) / OV-273-04 / Pitfall 2) — on the STRUCTURED calling
path a tool-call block never streams into the answer as text.

STRUCTURED-mode providers (every OpenRouter registry row) write a tool call as a ```json block in
their TEXT. Before this phase every chunk of it went out as a `delta`, then the parse cleared
`full_content` BEFORE the `turn_boundary` check — so nothing folded, and a 500-row show_artifact
spec stayed in the message body until reload.

Two halves:
  (a) `StructuredTextHoldback` — pure: what may be emitted now, what is held, and what the end of
      the stream releases. Driven at 1-, 3- and 50-char chunk splits.
  (b) `run_agent_loop` driven with a patched `open_stream` (canned canonical events) and a patched
      dispatcher — the recorded `_emit` calls are the browser's view. NATIVE must stay
      byte-identical; STRUCTURED must never carry the call text in a `delta`.
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.models.message import MessageCreate
from app.services import agent_loop as _loop_mod
from app.services.agent_loop import RunContext
from app.services.openai_service import CallingMode
from app.services.tool_dispatcher import ToolResult


def _holdback():
    from app.services.structured_text_holdback import StructuredTextHoldback

    return StructuredTextHoldback()


def _split(text: str, n: int) -> list[str]:
    return [text[i : i + n] for i in range(0, len(text), n)]


ROWS = [[f"2024-{m:02d}", m * 1000] for m in range(1, 13)]
PREAMBLE = "I'll chart it.\n"
FENCED_CALL = (
    "```json\n"
    + json.dumps({"tool": "show_artifact", "arguments": {"component": "chart", "title": "Revenue",
                                                        "columns": [{"name": "month"}, {"name": "rev"}],
                                                        "rows": ROWS}})
    + "\n```"
)
INLINE_CALL = json.dumps({"tool": "show_artifact", "arguments": {"component": "table", "rows": ROWS}})


def _feed_all(hb, chunks: list[str]) -> str:
    return "".join(hb.feed(c) for c in chunks)


# ── (a) the pure holdback ─────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("n", [1, 3, 50])
def test_a_fenced_tool_call_is_held_and_only_the_preamble_streams(n):
    hb = _holdback()
    assert _feed_all(hb, _split(PREAMBLE + FENCED_CALL, n)) == PREAMBLE
    assert hb.finish(True) == ""


def test_a_split_opener_is_held_across_chunk_boundaries():
    hb = _holdback()
    out = _feed_all(hb, [PREAMBLE, "``", "`js", "on", "\n{\"tool\": \"show_artifact\"", ", \"arguments\": {}}\n```"])
    assert out == PREAMBLE
    assert hb.finish(True) == ""


@pytest.mark.parametrize("n", [1, 3, 50])
def test_an_inline_tool_call_is_held_and_only_the_preamble_streams(n):
    hb = _holdback()
    assert _feed_all(hb, _split(PREAMBLE + INLINE_CALL, n)) == PREAMBLE
    assert hb.finish(True) == ""


@pytest.mark.parametrize("n", [1, 3, 50])
def test_a_python_block_streams_through_unchanged(n):
    text = "Here is the code:\n```python\nprint({'tool': 1})\n```\nDone."
    hb = _holdback()
    assert _feed_all(hb, _split(text, n)) + hb.finish(False) == text
    hb2 = _holdback()
    released = _feed_all(hb2, _split(text, n))
    assert released == text, "a python block must not be held at all"


@pytest.mark.parametrize("n", [1, 3, 50])
def test_a_json_block_that_is_not_a_tool_call_is_flushed_byte_for_byte(n):
    text = 'Set it like this:\n```json\n{"retention_days": 30}\n```\nThat keeps a month.'
    hb = _holdback()
    released = _feed_all(hb, _split(text, n))
    # 273-REVIEW WR-06(a): this used to assert `released == "Set it like this:\n"` — i.e. it PINNED
    # the stall (an ordinary JSON answer froze at its opener until the stream ended). A block with no
    # `"tool"` in it cannot be a call, so it is released at its closing fence and the rest streams.
    assert released == text
    assert released + hb.finish(False) == text


# ── 273-REVIEW WR-06(a): an ordinary ```json block is released at its closing fence ──────────────


@pytest.mark.parametrize("n", [1, 3, 50])
def test_wr06_a_closed_non_tool_json_block_streams_before_the_stream_ends(n):
    block = '```json\n{"retention_days": 30, "tiers": [{"name": "hot"}]}\n```\n'
    text = "Like this:\n" + block + "Then the rest of the answer streams"
    hb = _holdback()
    released = _feed_all(hb, _split(text, n))
    assert released.startswith("Like this:\n" + block), released
    assert released + hb.finish(False) == text


@pytest.mark.parametrize("n", [1, 3, 50])
def test_wr06_a_tool_call_after_a_released_block_is_still_held(n):
    text = 'First:\n```json\n{"a": 1}\n```\nNow the call:\n' + FENCED_CALL
    hb = _holdback()
    released = _feed_all(hb, _split(text, n))
    assert released == 'First:\n```json\n{"a": 1}\n```\nNow the call:\n'
    assert "show_artifact" not in released
    assert hb.finish(True) == ""


@pytest.mark.parametrize("n", [1, 3, 50])
def test_wr06_a_mid_line_fence_inside_a_json_string_does_not_release_a_call(n):
    # A ``` inside a JSON string is not a closing fence (a closing fence starts its own line).
    text = 'x\n```json\n{"code": "```", "tool": "search_documents", "arguments": {}}\n```'
    hb = _holdback()
    assert _feed_all(hb, _split(text, n)) == "x\n"
    assert hb.finish(True) == ""


@pytest.mark.parametrize("n", [1, 3, 50])
def test_wr06_a_block_naming_tool_is_held_to_the_end(n):
    text = 'Cfg:\n```json\n{"tool": "hammer", "weight": 2}\n```\nmore text'
    hb = _holdback()
    assert _feed_all(hb, _split(text, n)) == "Cfg:\n"
    assert hb.finish(False) == text[len("Cfg:\n"):]


def test_a_trailing_partial_opener_is_held_then_released_when_disambiguated():
    hb = _holdback()
    assert hb.feed("Use ```j") == "Use "
    # the closing fence at the very end could still become ```json — held until the stream ends
    assert hb.feed("ava\nint x;\n```") == "```java\nint x;\n"
    assert hb.feed("\nok") == "```\nok"
    assert hb.finish(False) == ""


def test_a_lone_brace_is_held_only_until_the_next_char_disambiguates():
    hb = _holdback()
    assert hb.feed("set {") == "set "
    assert hb.feed("x} now") == "{x} now"


def test_released_text_reports_only_non_whitespace_preamble():
    hb = _holdback()
    hb.feed("\n  ")
    hb.feed(FENCED_CALL)
    assert hb.released_text is False
    hb2 = _holdback()
    hb2.feed(PREAMBLE + FENCED_CALL)
    assert hb2.released_text is True


def test_finish_resets_the_holdback():
    hb = _holdback()
    hb.feed(FENCED_CALL)
    assert hb.finish(False) == FENCED_CALL
    assert hb.finish(False) == ""


# ── (b) run_agent_loop driven with canned STRUCTURED / NATIVE streams ─────────────────────────


class _Stream:
    def __init__(self, events):
        self._events = list(events)

    def __iter__(self):
        return iter(self._events)

    def close(self):
        pass


class _Query:
    def __init__(self, table: str):
        self.table = table

    def __getattr__(self, _name):
        return lambda *a, **k: self


def _deltas(text_chunks: list[str]) -> list[dict]:
    return [{"type": "delta", "content": c} for c in text_chunks] + [{"type": "finish", "finish_reason": "stop"}]


USER_SETTINGS = SimpleNamespace(
    web_search_enabled=False,
    sandbox_enabled=False,
    self_improve_enabled=False,
    llm_model="test/model",
    active_provider="openrouter",
    embedding_model="text-embedding-3-small",
)


async def _drive(streams: list, calling_mode, *, tool_result: str = "[]",
                 expect_raise: type[BaseException] | None = None) -> dict:
    """Run the real loop over canned provider streams. Returns emits, dispatches, persisted row."""
    tables = {"threads": {"folder_id": None}, "messages": [], "skills": [], "user_memory": []}

    async def _fake_aexec(q):
        return SimpleNamespace(data=tables.get(getattr(q, "table", None)))

    supabase = MagicMock()
    supabase.table.side_effect = _Query

    queue = [s if isinstance(s, _Stream) else _Stream(s) for s in streams]

    async def _open_stream(_provider, _request):
        return queue.pop(0), calling_mode

    emits: list[tuple[str, dict]] = []

    async def _emit(_redis, _run_id, etype, **kw):
        emits.append((etype, kw))

    dispatched: list[tuple[str, dict]] = []

    async def _dispatch(name, args, _ctx):
        dispatched.append((name, args))
        return ToolResult(result=tool_result)

    insert = AsyncMock(return_value=uuid4())
    body = MessageCreate(content="chart my revenue")
    ctx = RunContext(
        run_id=uuid4(),
        thread_id=str(uuid4()),
        current_user={"id": str(uuid4()), "org_id": str(uuid4())},
        user_settings=USER_SETTINGS,
        body=body,
        redis=MagicMock(),
        supabase=supabase,
        resolved_model="test/model",
        resolved_provider="openrouter",
    )

    def _no_embed(*_a, **_k):
        raise RuntimeError("no embedding in unit tests")

    with patch.object(_loop_mod, "aexec", _fake_aexec), \
         patch.object(_loop_mod, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch.object(_loop_mod, "resolve_skill_catalog_budget", lambda _s: 0), \
         patch.object(_loop_mod, "embed_texts", _no_embed), \
         patch.object(_loop_mod, "dispatch_tool", _dispatch), \
         patch.object(_loop_mod, "insert_assistant_message", insert), \
         patch.object(_loop_mod, "get_per_call_timeout_async", AsyncMock(return_value=30)), \
         patch.object(_loop_mod, "get_model_capability_async", AsyncMock(return_value={"provider": "openrouter"})), \
         patch("app.services.provider_gateway.open_stream", _open_stream), \
         patch("app.services.tool_parser._KNOWN_TOOLS", {"show_artifact", "search_documents"}), \
         patch("app.services.connector_service.list_connections", AsyncMock(return_value=[])), \
         patch("app.db.workspace.list_files_in_thread", AsyncMock(return_value=[])), \
         patch("app.services.suggestion_service.generate_suggestions", return_value=([], None)):
        if expect_raise is None:
            result = await _loop_mod.run_agent_loop(ctx, emit=_emit, emit_terminal=AsyncMock(), spawn=MagicMock())
            await result.persist()
        else:
            # An aborted stream: the loop re-raises and the producer shell persists via the sink.
            sink: dict = {}
            with pytest.raises(expect_raise):
                await _loop_mod.run_agent_loop(ctx, emit=_emit, emit_terminal=AsyncMock(), spawn=MagicMock(),
                                               result_sink=sink)
            await sink["persist"]()

    assert queue == [], "the loop did not consume every canned provider stream"
    insert.assert_awaited()
    return {"emits": emits, "dispatched": dispatched, "persisted": insert.await_args}


def _persisted_field(persisted, key):
    if key in persisted.kwargs:
        return persisted.kwargs[key]
    for a in persisted.args:
        if isinstance(a, dict) and key in a:
            return a[key]
    raise AssertionError(f"insert_assistant_message got no {key!r}: {persisted}")


def _delta_texts(emits) -> list[str]:
    return [kw["content"] for t, kw in emits if t == "delta"]


ANSWER = "Revenue rose every month. The chart above shows it."


@pytest.mark.asyncio
async def test_structured_show_artifact_call_never_streams_and_the_preamble_folds():
    stored = json.dumps({"artifact_id": "a_k3j9x0p2qd", "label": "chart 1"})
    run = await _drive(
        [_deltas(_split(PREAMBLE + FENCED_CALL, 7)), _deltas(_split(ANSWER, 5))],
        CallingMode.STRUCTURED,
        tool_result=stored,
    )
    emits = run["emits"]
    for text in _delta_texts(emits):
        assert "show_artifact" not in text and '"rows"' not in text, f"call text leaked as a delta: {text!r}"
    assert "".join(_delta_texts(emits)) == PREAMBLE + ANSWER

    types = [t for t, _ in emits]
    assert types.count("turn_boundary") == 1
    first_tool = min(types.index(t) for t in ("tool_preparing", "tool_start") if t in types)
    assert types.index("turn_boundary") < first_tool

    assert run["dispatched"] and run["dispatched"][0][0] == "show_artifact"
    assert _persisted_field(run["persisted"], "content") == ANSWER
    persisted_calls = _persisted_field(run["persisted"], "tool_calls")
    assert persisted_calls[0]["args"]["rows"] == "<stored in artifact a_k3j9x0p2qd, 12 rows>"


@pytest.mark.asyncio
async def test_structured_search_documents_call_is_dispatched_as_before_and_never_streams():
    call = '```json\n{"tool": "search_documents", "arguments": {"query": "revenue 2024"}}\n```'
    run = await _drive(
        [_deltas(_split("Let me look that up.\n" + call, 4)), _deltas([ANSWER])],
        CallingMode.STRUCTURED,
    )
    for text in _delta_texts(run["emits"]):
        assert "search_documents" not in text and '"tool"' not in text
    assert run["dispatched"] == [("search_documents", {"query": "revenue 2024"})]
    assert [t for t, _ in run["emits"]].count("turn_boundary") == 1


@pytest.mark.asyncio
async def test_a_call_with_no_preamble_opens_no_fold():
    run = await _drive([_deltas(_split(FENCED_CALL, 9)), _deltas([ANSWER])], CallingMode.STRUCTURED,
                       tool_result=json.dumps({"artifact_id": "a_k3j9x0p2qd"}))
    assert "turn_boundary" not in [t for t, _ in run["emits"]]
    assert "".join(_delta_texts(run["emits"])) == ANSWER


@pytest.mark.asyncio
async def test_structured_non_tool_json_reply_streams_byte_for_byte_and_never_folds():
    text = 'Use this config:\n```json\n{"retention_days": 30}\n```\nThat keeps a month of history.'
    run = await _drive([_deltas(_split(text, 6))], CallingMode.STRUCTURED)
    assert "".join(_delta_texts(run["emits"])) == _persisted_field(run["persisted"], "content") == text
    assert "turn_boundary" not in [t for t, _ in run["emits"]]
    assert run["dispatched"] == []


# ── 273-REVIEW CR-02: a show_artifact call that FAILS to parse never lands in the answer ─────────

# The likeliest real case: a large spec cut off at the output-token limit (no closing fence), and a
# weak model's trailing comma. Both reproduce the reviewer's repro verbatim in shape.
TRUNCATED_CALL = (
    'Here is the chart.\n```json\n{"tool": "show_artifact", "arguments": {"component": "chart", '
    '"title": "Revenue", "columns": [{"name": "q", "type": "string"}], "rows": [["Q1", 1'
)
# A missing comma after the tool name: neither the fence parse (json.loads) nor the inline fallback
# regex (which needs `"name",`) accepts it. (A trailing comma alone is NOT this case — the inline
# regex still extracts it as a call with unparseable args, which the model is told about.)
MALFORMED_CALL = (
    'Here is the chart.\n```json\n{"tool": "show_artifact" "arguments": {"component": "table", '
    '"title": "T", "columns": [{"name": "q", "type": "string"}], "rows": [["Q1"]]}}\n```'
)


def test_cr02_failed_tool_call_detects_a_truncated_and_a_malformed_call():
    from app.services.structured_text_holdback import failed_tool_call

    known = {"show_artifact", "search_documents"}
    for text in (TRUNCATED_CALL, MALFORMED_CALL):
        held = text[text.index("```json"):]
        assert failed_tool_call(held, known) is True
    # a call cut off inside its own tool name, or right after the key
    assert failed_tool_call('```json\n{"tool": "show_art', known) is True
    assert failed_tool_call('{"tool": ', known) is True
    # ordinary JSON answers are NOT failed calls — they must still flush byte-for-byte
    assert failed_tool_call('```json\n{"retention_days": 30}\n```', known) is False
    assert failed_tool_call('```json\n{"tool": "hammer" "weight": 2}\n```', known) is False


@pytest.mark.asyncio
@pytest.mark.parametrize("text", [TRUNCATED_CALL, MALFORMED_CALL], ids=["truncated", "malformed"])
async def test_cr02_an_unparsed_show_artifact_call_never_streams_or_persists(text):
    run = await _drive([_deltas(_split(text, 7))], CallingMode.STRUCTURED)
    assert run["dispatched"] == []
    live = "".join(_delta_texts(run["emits"]))
    persisted = _persisted_field(run["persisted"], "content")
    for seen in (live, persisted):
        assert "show_artifact" not in seen and '"rows"' not in seen and "```json" not in seen, seen
        assert seen.startswith("Here is the chart.")
        assert "was not run" in seen  # one plain sentence instead of the raw spec
    assert live == persisted, "live and reload must show the same answer (I-2)"


# ── 273-REVIEW WR-06(b): a stream that aborts while text is held — live and persisted agree ──────


class _AbortingStream(_Stream):
    """Yields its events, then raises — a provider dying mid-stream (or a per-call timeout)."""

    def __init__(self, events, exc: BaseException):
        super().__init__(events)
        self._exc = exc

    def __iter__(self):
        yield from self._events
        raise self._exc


@pytest.mark.asyncio
@pytest.mark.parametrize("exc", [RuntimeError("provider died"), TimeoutError("per-call budget")],
                         ids=["error", "timeout"])
async def test_wr06_held_text_of_an_aborted_stream_is_not_persisted_unseen(exc):
    text = PREAMBLE + FENCED_CALL[: len(FENCED_CALL) // 2]  # aborted inside the held call
    events = [{"type": "delta", "content": c} for c in _split(text, 9)]
    run = await _drive([_AbortingStream(events, exc)], CallingMode.STRUCTURED, expect_raise=type(exc))
    live = "".join(_delta_texts(run["emits"]))
    persisted = _persisted_field(run["persisted"], "content")
    assert "show_artifact" not in persisted and '"rows"' not in persisted, persisted
    assert persisted == live, "the reloaded message must hold exactly what the live view showed (I-2)"


@pytest.mark.asyncio
async def test_native_delta_sequence_is_byte_identical():
    """NATIVE never parses text for calls, so every chunk goes out exactly as the provider sent it."""
    chunks = _split(PREAMBLE + FENCED_CALL + "\n" + ANSWER, 11)
    run = await _drive([_deltas(chunks)], CallingMode.NATIVE)
    assert _delta_texts(run["emits"]) == chunks
    assert "turn_boundary" not in [t for t, _ in run["emits"]]
    assert run["dispatched"] == []
