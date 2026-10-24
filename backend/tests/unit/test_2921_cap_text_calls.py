"""Phase 292.1 (BUG-261024-03, SC#1 / SC#2) — a tool call written as TEXT reaches the cap pause,
runs mid-run, and never lands in the answer. Driven over the REAL ``run_agent_loop``.

The production failure: at the round cap the request carries no tools, a DeepSeek model wrote its
next call as DSML text, the cap check read only the structured buffer, and the markup became the
answer with no Continue (D-01 / D-02 / D-04). The harness is copied from
``test_273_structured_holdback.py`` (``_drive``): canned canonical provider events, a patched
dispatcher, and the recorded ``_emit`` calls as the browser's view.

Owners: this file pins the LOOP behaviour; ``test_2921_text_tool_calls.py`` pins the pure module.
It is the new owner of what ``test_dsml_leak_signal.py`` used to pin (retired in 292.1).
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
from app.services.structured_text_holdback import FAILED_CALL_NOTICE
from app.services.tool_dispatcher import ToolResult

# ── Planted fixtures (D-24), verbatim from 292.1-RESEARCH.md §"Planted fixtures" ────────────────
F1 = ('<｜DSML｜ calls>\n<｜DSML｜ invoke name="execute_code">\n'
      '<｜DSML｜ parameter name="code" string="true">\nimport matplotlib\n</｜DSML｜ parameter>\n'
      '<｜DSML｜ parameter name="description" string="true">Rendering chart</｜DSML｜ parameter>\n'
      '</｜DSML｜ invoke>\n</｜DSML｜ calls>')
F2 = ('<｜DSML｜tool_calls>\n<｜DSML｜invoke name="grep">\n'
      '<｜DSML｜parameter name="pattern" string="true">probation</｜DSML｜parameter>\n'
      '</｜DSML｜invoke>\n</｜DSML｜tool_calls>')
F3 = ('<｜｜DSML｜｜tool_calls>\n<｜｜DSML｜｜invoke name="execute_code">\n'
      '<｜｜DSML｜｜parameter name="libraries" string="false">["fpdf2"]</｜｜DSML｜｜parameter>\n'
      '<｜｜DSML｜｜parameter name="code" string="true">print(1)</｜｜DSML｜｜parameter>\n'
      '</｜｜DSML｜｜invoke>\n</｜｜DSML｜｜tool_calls>')
F4 = ('<tool_call>\n<function=search_documents>\n<parameter=query>\n'
      'project updates completed this week\n</parameter>\n</function>\n</tool_call>')
PREAMBLE = 'No matches for "notice". Call #8: searching for "probation\n\n'
F1_TRUNCATED = F1.replace("</｜DSML｜ invoke>", "")

F1_ARGS = {"code": "\nimport matplotlib\n", "description": "Rendering chart"}
F3_ARGS = {"libraries": ["fpdf2"], "code": "print(1)"}
ANSWER = "Revenue rose every month."


def _split(text: str, n: int) -> list[str]:
    return [text[i : i + n] for i in range(0, len(text), n)]


# ── Harness (copied from test_273_structured_holdback._drive, plus settings / cap capture) ──────


class _Stream:
    def __init__(self, events):
        self._events = list(events)

    def __iter__(self):
        return iter(self._events)

    def close(self):
        pass


class _Query:
    def __init__(self, table: str, inserts: list):
        self.table = table
        self._inserts = inserts

    def insert(self, payload):
        self._inserts.append((self.table, payload))
        return self

    def __getattr__(self, _name):
        return lambda *a, **k: self


def _deltas(text_chunks: list[str]) -> list[dict]:
    return [{"type": "delta", "content": c} for c in text_chunks] + [{"type": "finish", "finish_reason": "stop"}]


def _call(name: str, args: dict, idx: int = 0) -> list[dict]:
    """A STRUCTURED (native) tool call as the OpenAI-compat adapter yields it."""
    a = json.dumps(args)
    return [
        {"type": "tool_preparing", "index": idx, "id": f"call_struct{idx}", "name": name},
        {"type": "tool_args_progress", "tool_index": idx, "name": name, "args_so_far": a,
         "total_args_bytes_so_far": len(a), "code_so_far": a, "emit_sse": False},
        {"type": "finish", "finish_reason": "tool_calls"},
    ]


def _settings(**over) -> SimpleNamespace:
    base = dict(
        web_search_enabled=False,
        sandbox_enabled=True,  # execute_code is OFFERED (the F1 / F3 tool)
        self_improve_enabled=False,
        llm_model="test/model",
        active_provider="openrouter",
        embedding_model="text-embedding-3-small",
    )
    base.update(over)
    return SimpleNamespace(**base)


async def _drive(streams: list, *, user_settings=None, agent_mode=None,
                 calling_mode=CallingMode.NATIVE, tool_result: str = "[]",
                 ctx_extra: dict | None = None) -> dict:
    tables = {"threads": {"folder_id": None}, "messages": [], "skills": [], "user_memory": []}
    inserts: list = []

    async def _fake_aexec(q):
        return SimpleNamespace(data=tables.get(getattr(q, "table", None)))

    supabase = MagicMock()
    supabase.table.side_effect = lambda t: _Query(t, inserts)

    queue = [s if isinstance(s, _Stream) else _Stream(s) for s in streams]
    requests: list = []

    async def _open_stream(_provider, _request):
        requests.append(_request)
        return queue.pop(0), calling_mode

    emits: list[tuple[str, dict]] = []

    async def _emit(_redis, _run_id, etype, **kw):
        emits.append((etype, kw))

    dispatched: list[tuple[str, dict]] = []

    async def _dispatch(name, args, _ctx):
        dispatched.append((name, args))
        return ToolResult(result=tool_result)

    cap_calls: list[dict] = []
    _real_persist_cap = _loop_mod.persist_cap_paused

    async def _spy_persist_cap(**kw):
        cap_calls.append({**kw, "tool_calls_buffer": dict(kw["tool_calls_buffer"])})
        return await _real_persist_cap(**kw)

    insert = AsyncMock(return_value=uuid4())
    body = MessageCreate(content="chart my revenue", agent_mode=agent_mode or "default")
    ctx = RunContext(
        run_id=uuid4(),
        thread_id=str(uuid4()),
        current_user={"id": str(uuid4()), "org_id": str(uuid4())},
        user_settings=user_settings or _settings(),
        body=body,
        redis=MagicMock(),
        supabase=supabase,
        resolved_model="test/model",
        resolved_provider="openrouter",
        **(ctx_extra or {}),
    )

    def _no_embed(*_a, **_k):
        raise RuntimeError("no embedding in unit tests")

    with patch.object(_loop_mod, "aexec", _fake_aexec), \
         patch.object(_loop_mod, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch.object(_loop_mod, "resolve_skill_catalog_budget", lambda _s: 0), \
         patch.object(_loop_mod, "embed_texts", _no_embed), \
         patch.object(_loop_mod, "dispatch_tool", _dispatch), \
         patch.object(_loop_mod, "insert_assistant_message", insert), \
         patch.object(_loop_mod, "persist_cap_paused", _spy_persist_cap), \
         patch.object(_loop_mod, "get_per_call_timeout_async", AsyncMock(return_value=30)), \
         patch.object(_loop_mod, "get_model_capability_async", AsyncMock(return_value={"provider": "openrouter"})), \
         patch("app.services.provider_gateway.open_stream", _open_stream), \
         patch("app.services.tool_parser._KNOWN_TOOLS", {"show_artifact", "search_documents"}), \
         patch("app.services.connector_service.list_connections", AsyncMock(return_value=[])), \
         patch("app.db.workspace.list_files_in_thread", AsyncMock(return_value=[])), \
         patch("app.services.suggestion_service.generate_suggestions", return_value=([], None)):
        result = await _loop_mod.run_agent_loop(ctx, emit=_emit, emit_terminal=AsyncMock(), spawn=MagicMock())
        await result.persist()

    assert queue == [], "the loop did not consume every canned provider stream"
    insert.assert_awaited()
    return {"emits": emits, "dispatched": dispatched, "persisted": insert.await_args,
            "cap_calls": cap_calls, "inserts": inserts, "requests": requests, "result": result}


def _persisted_field(persisted, key):
    if key in persisted.kwargs:
        return persisted.kwargs[key]
    for a in persisted.args:
        if isinstance(a, dict) and key in a:
            return a[key]
    raise AssertionError(f"insert_assistant_message got no {key!r}: {persisted}")


def _delta_texts(emits) -> list[str]:
    return [kw["content"] for t, kw in emits if t == "delta"]


def _types(emits) -> list[str]:
    return [t for t, _ in emits]


CAP2 = _settings(chat_max_tool_rounds=2)
SEARCH = _call("search_documents", {"query": "revenue"})


# ── Loop test A (D-05, SC#1): a text call on the forced-final round pauses with it queued ───────


@pytest.mark.asyncio
async def test_a_f1_text_call_at_the_cap_pauses_with_the_call_queued():
    run = await _drive([SEARCH, _deltas(_split(F1, 9))], user_settings=CAP2)
    assert run["dispatched"] == [("search_documents", {"query": "revenue"})]
    assert len(run["cap_calls"]) == 1
    buf = run["cap_calls"][0]["tool_calls_buffer"]
    assert [tc["name"] for tc in buf.values()] == ["execute_code"]
    assert json.loads(next(iter(buf.values()))["arguments"]) == F1_ARGS
    assert "cap_paused" in _types(run["emits"])
    content = _persisted_field(run["persisted"], "content")
    assert "｜DSML｜" not in content
    assert "｜DSML｜" not in "".join(_delta_texts(run["emits"]))


# ── Loop test B (D-05): every measured spelling, and the preamble ───────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "block,name,args",
    [(F2, "grep", {"pattern": "probation"}), (F3, "execute_code", F3_ARGS)],
    ids=["F2", "F3"],
)
async def test_b_other_spellings_pause_with_the_call_queued(block, name, args):
    run = await _drive([SEARCH, _deltas(_split(block, 5))], user_settings=CAP2)
    buf = run["cap_calls"][0]["tool_calls_buffer"]
    assert [tc["name"] for tc in buf.values()] == [name]
    assert json.loads(next(iter(buf.values()))["arguments"]) == args
    assert "DSML" not in _persisted_field(run["persisted"], "content")


@pytest.mark.asyncio
async def test_b_the_preamble_is_the_only_text_streamed_and_persisted_at_the_cap():
    run = await _drive([SEARCH, _deltas(_split(PREAMBLE + F1, 6))], user_settings=CAP2)
    assert "".join(_delta_texts(run["emits"])) == PREAMBLE
    assert _persisted_field(run["persisted"], "content") == PREAMBLE
    assert len(run["cap_calls"]) == 1
    # Parity with a structured cap call: the paused round opens no fold.
    assert "turn_boundary" not in _types(run["emits"])


@pytest.mark.asyncio
async def test_b_a_preamble_before_a_mid_run_text_call_folds_exactly_once():
    run = await _drive([_deltas(_split(PREAMBLE + F1, 6)), _deltas([ANSWER])],
                       user_settings=_settings(chat_max_tool_rounds=3))
    assert run["dispatched"] == [("execute_code", F1_ARGS)]
    assert _types(run["emits"]).count("turn_boundary") == 1
    assert "".join(_delta_texts(run["emits"])) == PREAMBLE + ANSWER
    assert _persisted_field(run["persisted"], "content") == ANSWER


# ── Loop test E (D-09): a mid-run text call runs through the same dispatcher ────────────────────


@pytest.mark.asyncio
async def test_e_a_mid_run_f3_call_is_dispatched_with_its_decoded_arguments():
    run = await _drive([_deltas(_split(F3, 4)), _deltas([ANSWER])],
                       user_settings=_settings(chat_max_tool_rounds=3))
    assert run["dispatched"] == [("execute_code", F3_ARGS)]
    assert "tool_preparing" in _types(run["emits"])
    assert run["cap_calls"] == []
    assert _persisted_field(run["persisted"], "content") == ANSWER


@pytest.mark.asyncio
async def test_e_a_not_offered_name_is_never_dispatched_and_is_worded():
    # sandbox off: execute_code is not offered this run, so the parser refuses the block.
    run = await _drive([_deltas(_split(F1, 4))],
                       user_settings=_settings(sandbox_enabled=False, chat_max_tool_rounds=3))
    assert run["dispatched"] == []
    live = "".join(_delta_texts(run["emits"]))
    persisted = _persisted_field(run["persisted"], "content")
    for seen in (live, persisted):
        assert FAILED_CALL_NOTICE in seen
        assert "DSML" not in seen
    assert live == persisted


# ── Loop test E2 (D-07 wiring): unparseable at the cap still pauses, nothing queued ─────────────


@pytest.mark.asyncio
async def test_e2_truncated_markup_at_the_cap_pauses_with_an_empty_queue():
    run = await _drive([SEARCH, _deltas(_split(PREAMBLE + F1_TRUNCATED, 8))], user_settings=CAP2)
    assert run["dispatched"] == [("search_documents", {"query": "revenue"})]
    assert len(run["cap_calls"]) == 1
    assert run["cap_calls"][0]["tool_calls_buffer"] == {}
    assert _persisted_field(run["persisted"], "content") == PREAMBLE
    assert "".join(_delta_texts(run["emits"])) == PREAMBLE


# ── Loop test F (D-10, holdback half): clean answers stream and persist byte-identical ─────────

CLEAN = ("If a < b then b > a. Use <div> for blocks.\n"
         "Qwen writes calls like this:\n```\n<tool_call>\n<function=search_documents>\n</function>\n"
         "</tool_call>\n```\nThat is only an example.")


@pytest.mark.asyncio
@pytest.mark.parametrize("n", [1, 7, 50])
async def test_f_a_clean_answer_with_tags_streams_and_persists_byte_identical(n):
    run = await _drive([_deltas(_split(CLEAN, n))])
    assert "".join(_delta_texts(run["emits"])) == CLEAN
    assert _persisted_field(run["persisted"], "content") == CLEAN
    assert run["dispatched"] == [] and run["cap_calls"] == []


# ── Loop test G (D-11, I-2): live == persisted on every 1-char split ────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize("n", [1, 2, 3, 11])
async def test_g_live_deltas_equal_the_persisted_content(n):
    run = await _drive([SEARCH, _deltas(_split(PREAMBLE + F1, n))], user_settings=CAP2)
    assert "".join(_delta_texts(run["emits"])) == _persisted_field(run["persisted"], "content")


@pytest.mark.asyncio
async def test_g_text_with_no_opener_streams_byte_identical_chunks():
    chunks = _split("Plain answer with no tags at all, streamed as is.", 5)
    run = await _drive([_deltas(chunks)])
    assert _delta_texts(run["emits"]) == chunks


# ── Loop test H (D-17 / D-18): the round cap is read from the settings, defaults 15 / 8 ─────────


def _forced(run) -> list[bool]:
    return [bool(r.force_no_tools) for r in run["requests"]]


@pytest.mark.asyncio
async def test_h_general_default_forces_no_tools_on_call_15():
    run = await _drive([SEARCH] * 15)
    assert _forced(run) == [False] * 14 + [True]


@pytest.mark.asyncio
async def test_h_explorer_default_forces_no_tools_on_call_8():
    grep = _call("grep", {"pattern": "x"})
    run = await _drive([grep] * 8, agent_mode="explorer")
    assert _forced(run) == [False] * 7 + [True]


@pytest.mark.asyncio
async def test_h_a_cap_of_2_forces_no_tools_on_call_2():
    run = await _drive([SEARCH, SEARCH], user_settings=CAP2)
    assert _forced(run) == [False, True]


# ── Task 2b: the carrier, the reasoning carry and the save point ────────────────────────────────

LIMIT_LINE = "Reached the tool-use limit for this turn."
MARKER = {"kind": "iteration_cap_paused", "tool_call_id": None, "name": None, "arguments": None}


def _carriers(run) -> list[dict]:
    return [p for t, p in run["inserts"] if t == "messages" and p.get("role") == "system"]


def _cap_events(run) -> list[dict]:
    return [kw for t, kw in run["emits"] if t == "cap_paused"]


# ── Loop test C (D-07): unparseable at the cap writes the empty-queue MARKER ────────────────────


@pytest.mark.asyncio
async def test_c_truncated_markup_at_the_cap_writes_the_marker_carrier():
    run = await _drive([SEARCH, _deltas(_split(F1_TRUNCATED, 8))], user_settings=CAP2)
    assert run["dispatched"] == [("search_documents", {"query": "revenue"})]
    carriers = _carriers(run)
    assert len(carriers) == 1
    assert carriers[0]["tool_calls"] == [MARKER]
    assert LIMIT_LINE in carriers[0]["content"]
    events = _cap_events(run)
    assert len(events) == 1
    assert LIMIT_LINE in events[0]["message"]
    assert events[0]["tool_names"] == []


# ── Loop test D (D-07, XML): F4 at the cap pauses with the marker, never persists the tag ───────


@pytest.mark.asyncio
@pytest.mark.parametrize("prefix", ["", PREAMBLE], ids=["markup-only", "with-preamble"])
async def test_d_qwen_xml_at_the_cap_pauses_with_the_marker(prefix):
    run = await _drive([SEARCH, _deltas(_split(prefix + F4, 6))], user_settings=CAP2)
    assert _carriers(run)[0]["tool_calls"] == [MARKER]
    persisted = _persisted_field(run["persisted"], "content")
    assert "<tool_call>" not in persisted and "search_documents" not in persisted
    if prefix:
        assert persisted == prefix
    # (markup-only: the run ends with no text, so the loop's existing empty-answer sentence is what
    # persists — exactly as for a structured cap call with no preamble; never the markup.)
    assert "".join(_delta_texts(run["emits"])) == persisted


# ── Loop test I (D-05): a STRUCTURED cap call's copy is byte-identical to before ────────────────


@pytest.mark.asyncio
async def test_i_a_structured_cap_call_keeps_todays_copy_byte_for_byte():
    run = await _drive([SEARCH, _call("search_documents", {"query": "more"})], user_settings=CAP2)
    carrier = _carriers(run)[0]
    assert carrier["content"] == "⏸ Reached the iteration limit with 1 tool(s) still queued. Continue to run them."
    assert carrier["tool_calls"] == [{
        "kind": "iteration_cap_paused", "tool_call_id": "call_struct0",
        "name": "search_documents", "arguments": json.dumps({"query": "more"}),
    }]
    assert _cap_events(run)[0]["message"] == (
        "⏸ Reached the iteration limit — 1 tool(s) weren't run yet. Continue to run them."
    )


# ── Loop test J (SEED-323): the paused round's reasoning rides the carrier and the replay ───────


@pytest.mark.asyncio
async def test_j_reasoning_is_stored_on_the_carrier_and_replayed_on_continue():
    reasoning = [{"type": "reasoning_delta", "content": "I should render the PDF next."}]
    run = await _drive([SEARCH, reasoning + _deltas(_split(F3, 7))], user_settings=CAP2)
    carrier = _carriers(run)[0]["tool_calls"]
    assert carrier[0]["name"] == "execute_code"
    assert carrier[0]["reasoning_content"] == "I should render the PDF next."

    resumed = await _drive([_deltas([ANSWER])], ctx_extra={
        "resume_dropped_tool_calls": True, "dropped_tool_calls": tuple(carrier)})
    assert resumed["dispatched"][0] == ("execute_code", F3_ARGS)
    sent = resumed["requests"][0].messages
    turn = next(m for m in sent if m.get("role") == "assistant" and m.get("tool_calls")
                and m["tool_calls"][0]["id"] == carrier[0]["tool_call_id"])
    assert turn["reasoning_content"] == "I should render the PDF next."


@pytest.mark.asyncio
async def test_j_a_carrier_without_reasoning_replays_byte_identically():
    carrier = ({"kind": "iteration_cap_paused", "tool_call_id": "call_abc",
                "name": "search_documents", "arguments": '{"query": "x"}'},)
    resumed = await _drive([_deltas([ANSWER])], ctx_extra={
        "resume_dropped_tool_calls": True, "dropped_tool_calls": carrier})
    sent = resumed["requests"][0].messages
    turn = next(m for m in sent if m.get("role") == "assistant" and m.get("tool_calls")
                and m["tool_calls"][0]["id"] == "call_abc")
    assert set(turn) == {"role", "tool_calls"}


@pytest.mark.asyncio
async def test_j_a_structured_cap_without_reasoning_writes_no_reasoning_key():
    run = await _drive([SEARCH, _call("search_documents", {"query": "more"})], user_settings=CAP2)
    assert "reasoning_content" not in _carriers(run)[0]["tool_calls"][0]


# ── Loop test K (D-10, D-24): the save point strips markup for ANY route ────────────────────────


def _bypass_settle(full_content, _offered, *, buffer_has_calls):
    from app.services.text_tool_calls import Settled

    return Settled(kind="none", calls=[], visible=full_content)


@pytest.mark.asyncio
@pytest.mark.parametrize("block", [F3, F4], ids=["F3", "F4"])
async def test_k_markup_reaching_the_save_point_is_never_persisted(block):
    with patch.object(_loop_mod, "settle", _bypass_settle):
        only = await _drive([_deltas([block])])
        with_pre = await _drive([_deltas([PREAMBLE + block])])
    assert _persisted_field(only["persisted"], "content") == FAILED_CALL_NOTICE
    assert _persisted_field(with_pre["persisted"], "content") == PREAMBLE


@pytest.mark.asyncio
async def test_k_a_clean_answer_persists_byte_identical_through_the_save_point():
    with patch.object(_loop_mod, "settle", _bypass_settle):
        run = await _drive([_deltas([CLEAN])])
    assert _persisted_field(run["persisted"], "content") == CLEAN
