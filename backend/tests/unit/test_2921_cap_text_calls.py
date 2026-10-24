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
                 ctx_extra: dict | None = None, history: list | None = None) -> dict:
    tables = {"threads": {"folder_id": None}, "messages": list(history or []), "skills": [], "user_memory": []}
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


@pytest.mark.asyncio
async def test_e_text_after_a_mid_run_block_is_shown_and_a_second_block_runs_too():
    """292.1-REVIEW WR-06: before, everything after the first block's closer vanished — trailing
    prose and a second block's calls alike, with no log line."""
    text = "Pre " + F3 + " and then " + F2 + " done."
    run = await _drive([_deltas(_split(text, 6)), _deltas([ANSWER])],
                       user_settings=_settings(chat_max_tool_rounds=3))
    assert run["dispatched"] == [("execute_code", F3_ARGS), ("grep", {"pattern": "probation"})]
    live = "".join(_delta_texts(run["emits"]))
    assert live == "Pre  and then  done." + ANSWER
    assert "DSML" not in live


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


# ── Loop test F2 (292.1-REVIEW WR-01): an answer that MENTIONS a tag is an answer ──────────────
# Before: cut at the tag and worded as a failed call on a middle round; on the forced-final round
# `_cap_markup_seen` paused a run that had actually answered, with a limit line and a Continue.

PROSE_QWEN = ("Qwen-style models wrap each call in <tool_call> tags, and the server parses them out. "
              "That is why you never see them.")
PROSE_GEMMA = "In Gemma the marker is <|tool_call> and it closes with <tool_call|>; the server strips both."


@pytest.mark.asyncio
@pytest.mark.parametrize("prose", [PROSE_QWEN, PROSE_GEMMA], ids=["qwen", "gemma"])
@pytest.mark.parametrize("n", [1, 7, 50])
async def test_f2_prose_mentioning_a_tag_on_a_middle_round_is_byte_identical(prose, n):
    run = await _drive([SEARCH, _deltas(_split(prose, n))], user_settings=_settings(chat_max_tool_rounds=5))
    assert "".join(_delta_texts(run["emits"])) == prose
    assert _persisted_field(run["persisted"], "content") == prose
    assert run["cap_calls"] == [] and "cap_paused" not in _types(run["emits"])
    assert FAILED_CALL_NOTICE not in _persisted_field(run["persisted"], "content")


@pytest.mark.asyncio
@pytest.mark.parametrize("prose", [PROSE_QWEN, PROSE_GEMMA], ids=["qwen", "gemma"])
@pytest.mark.parametrize("n", [1, 7, 50])
async def test_f2_prose_mentioning_a_tag_on_the_forced_final_round_is_no_false_pause(prose, n):
    run = await _drive([SEARCH, _deltas(_split(prose, n))], user_settings=CAP2)
    assert _forced(run) == [False, True], "the prose IS the forced-final round"
    assert run["cap_calls"] == [] and _carriers(run) == []
    assert "cap_paused" not in _types(run["emits"])
    assert "".join(_delta_texts(run["emits"])) == prose
    assert _persisted_field(run["persisted"], "content") == prose


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


# ── Loop test L (292.1 D-UAT-1): Gemini's thought_signature rides the carrier and the replay ────
# Measured on the live board (run 578f2f1e, gemini-3.8-flash): Continue replayed the paused call
# without its thought_signature and Gemini 400'd "Function call is missing a thought_signature",
# ending the continuation `failed`. Same class as SEED-323 (DeepSeek reasoning_content).


def _signed_call(name: str, args: dict, sig: str) -> list[dict]:
    chunks = _call(name, args)
    chunks[-1] = {"type": "finish", "finish_reason": "tool_calls",
                  "tool_calls": [{"id": "call_struct0", "thought_signature": sig}]}
    return chunks


@pytest.mark.asyncio
async def test_l_thought_signature_is_stored_on_the_carrier_and_replayed_on_continue():
    run = await _drive([SEARCH, _signed_call("search_documents", {"query": "more"}, "c2lnLWJ5dGVz")],
                       user_settings=CAP2)
    carrier = _carriers(run)[0]["tool_calls"]
    assert carrier[0]["name"] == "search_documents"
    assert carrier[0]["thought_signature"] == "c2lnLWJ5dGVz"

    resumed = await _drive([_deltas([ANSWER])], ctx_extra={
        "resume_dropped_tool_calls": True, "dropped_tool_calls": tuple(carrier)})
    sent = resumed["requests"][0].messages
    turn = next(m for m in sent if m.get("role") == "assistant" and m.get("tool_calls")
                and m["tool_calls"][0]["id"] == carrier[0]["tool_call_id"])
    assert turn["tool_calls"][0]["thought_signature"] == "c2lnLWJ5dGVz"


@pytest.mark.asyncio
async def test_l_an_unsigned_carrier_replays_without_a_signature_key():
    carrier = ({"kind": "iteration_cap_paused", "tool_call_id": "call_abc",
                "name": "search_documents", "arguments": '{"query": "x"}'},)
    resumed = await _drive([_deltas([ANSWER])], ctx_extra={
        "resume_dropped_tool_calls": True, "dropped_tool_calls": carrier})
    sent = resumed["requests"][0].messages
    turn = next(m for m in sent if m.get("role") == "assistant" and m.get("tool_calls")
                and m["tool_calls"][0]["id"] == "call_abc")
    assert set(turn["tool_calls"][0]) == {"id", "type", "function"}


# ── Loop test M (292.1 UAT, run 238b0589): a SECOND Continue replays every chain turn's reasoning ─
# Measured live (deepseek-v4-flash, cap 2): pause → Continue #1 re-paused → Continue #2 400'd
# "The reasoning_content in the thinking mode must be passed back to the API". The carriers were
# fine; the assistant tool-call turns REBUILT from the DB rows of this same chain went out with no
# reasoning_content, though each row stores one. DeepSeek: with tools, reasoning "must be fully
# passed back" (https://api-docs.deepseek.com/guides/thinking_mode).


def _call_as(cid: str, name: str, args: dict) -> list[dict]:
    chunks = _call(name, args)
    chunks[0] = {**chunks[0], "id": cid}
    return chunks


def _thinking(text: str) -> list[dict]:
    return [{"type": "reasoning_delta", "content": text}] if text else []


def _rows_written(run) -> list[dict]:
    """The rows a drive wrote, in the order the next run's history query reads them back."""
    rows = [{"role": "system", "content": p["content"], "tool_calls": p["tool_calls"], "reasoning_content": None}
            for t, p in run["inserts"] if t == "messages" and p.get("role") == "system"]
    kw = run["persisted"].kwargs
    rows.append({"role": "assistant", "content": kw["content"], "tool_calls": kw.get("tool_calls"),
                 "reasoning_content": kw.get("reasoning_content")})
    return rows


async def _pause_continue_continue(r: tuple[str, str, str, str]) -> tuple[dict, dict, dict]:
    """First turn pauses, Continue #1 re-pauses, Continue #2 answers — each reads the rows before it."""
    user = [{"role": "user", "content": "chart my revenue", "tool_calls": None, "reasoning_content": None}]
    first = await _drive([_thinking(r[0]) + _call_as("call_a", "search_documents", {"query": "a"}),
                          _thinking(r[1]) + _call_as("call_b", "search_documents", {"query": "b"})],
                         user_settings=CAP2, history=user)
    hist1 = user + _rows_written(first)
    cont1 = await _drive([_thinking(r[2]) + _call_as("call_c", "search_documents", {"query": "c"}),
                          _thinking(r[3]) + _call_as("call_d", "search_documents", {"query": "d"})],
                         user_settings=CAP2, history=hist1, ctx_extra={
                             "resume_dropped_tool_calls": True,
                             "dropped_tool_calls": tuple(_carriers(first)[0]["tool_calls"])})
    cont2 = await _drive([_deltas([ANSWER])], user_settings=CAP2, history=hist1 + _rows_written(cont1),
                         ctx_extra={"resume_dropped_tool_calls": True,
                                    "dropped_tool_calls": tuple(_carriers(cont1)[0]["tool_calls"])})
    return first, cont1, cont2


def _tool_turns(run) -> dict[str, dict]:
    """A run's first request: each assistant tool-call turn, keyed by its first call id."""
    return {m["tool_calls"][0]["id"]: m for m in run["requests"][0].messages
            if m.get("role") == "assistant" and m.get("tool_calls")}


@pytest.mark.asyncio
async def test_m_a_second_continue_replays_reasoning_on_every_tool_call_turn_of_the_chain():
    _first, cont1, cont2 = await _pause_continue_continue(("R0", "R1", "R2", "R3"))
    assert _carriers(cont1), "Continue #1 must re-pause for the drive to reach Continue #2"
    # call_a: the first turn's row (stores R1, the paused round's thinking); call_b: Continue #1's
    # row (stores R3); call_d: Continue #1's carrier, replayed (R3, SEED-323).
    assert {k: t.get("reasoning_content") for k, t in _tool_turns(cont2).items()} == {
        "call_a": "R1", "call_b": "R3", "call_d": "R3"}


@pytest.mark.asyncio
async def test_m_continue_one_replays_the_first_rows_reasoning_too():
    _first, cont1, _cont2 = await _pause_continue_continue(("R0", "R1", "R2", "R3"))
    # The request's list is the loop's own (appended in place), so call_c — Continue #1's in-loop
    # round, which always carried its reasoning (Phase 076.2 D-03) — shows here too.
    assert {k: t.get("reasoning_content") for k, t in _tool_turns(cont1).items()} == {
        "call_a": "R1", "call_b": "R1", "call_c": "R2"}


@pytest.mark.asyncio
async def test_m_a_chain_with_no_reasoning_replays_byte_identically():
    _first, _cont1, cont2 = await _pause_continue_continue(("", "", "", ""))
    turns = _tool_turns(cont2)
    assert set(turns) == {"call_a", "call_b", "call_d"}
    assert set(turns["call_a"]) == {"role", "content", "tool_calls"}
    assert set(turns["call_b"]) == {"role", "content", "tool_calls"}
    assert set(turns["call_d"]) == {"role", "tool_calls"}


def test_m_an_earlier_turns_tool_calls_stay_byte_identical_on_a_new_send():
    """Only the CURRENT turn (rows after the last user row) changes; a fresh send has none."""
    from app.services.agent_loop import _reconstruct_history

    signed = {"tool_call_id": "call_g", "name": "search_documents", "args": {"query": "x"},
              "result": "[]", "thought_signature": "c2ln"}
    rows = [
        {"role": "user", "content": "q1"},
        {"role": "assistant", "content": "a1", "tool_calls": [signed], "reasoning_content": "R"},
        {"role": "user", "content": "q2"},
    ]
    assert _reconstruct_history(rows) == [
        {"role": "user", "content": "q1"},
        {"role": "assistant", "content": None, "tool_calls": [{
            "id": "call_g", "type": "function",
            "function": {"name": "search_documents", "arguments": '{"query": "x"}'},
            "thought_signature": "c2ln"}]},
        {"role": "tool", "tool_call_id": "call_g", "content": "[]"},
        {"role": "assistant", "content": "a1", "reasoning_content": "R"},
        {"role": "user", "content": "q2"},
    ]


def test_m_a_row_with_no_reasoning_in_the_current_turn_stays_byte_identical():
    """Anthropic / Gemini / OpenAI chat rows never store reasoning: a Continue's rebuild is unchanged."""
    from app.services.agent_loop import _reconstruct_history

    call = {"tool_call_id": "call_h", "name": "search_documents", "args": {}, "result": "ok"}
    rows = [{"role": "user", "content": "q"},
            {"role": "assistant", "content": "", "tool_calls": [call], "reasoning_content": None}]
    assert _reconstruct_history(rows, resuming=True) == [
        {"role": "user", "content": "q"},
        {"role": "assistant", "content": None, "tool_calls": [{
            "id": "call_h", "type": "function",
            "function": {"name": "search_documents", "arguments": "{}"}}]},
        {"role": "tool", "tool_call_id": "call_h", "content": "ok"},
    ]


# ── Loop test N (292.1 SC#2, F7): harmony-style text calls, measured on the forced-pending board ─
# openai gpt-5.6-luna, forced-final round (no tools sent): the pending calls were written as harmony
# text and saved verbatim in 3/3 runs + the main board's 34748d7c. Rows: ``harmony_measured``.

from tests.unit.harmony_measured import H1_ed030690, H2_2b7c16a0, H3_f1c46597, H4_34748d7c  # noqa: E402

H2_NAMES = ["search_documents"] * 8 + ["execute_code"] * 2
H3_NAMES = ["search_documents"] * 10 + ["execute_code"] + ["search_documents"] * 2 + ["execute_code"] * 2
H1_TAIL = ("I’m unable to complete the requested tool-call sequence because the document tools "
           "stopped responding after the first call.")
HARMONY_ONE = ' to=functions.search_documents  code:\n{"query":"project plan"}'


def _no_recipient(*texts: str) -> None:
    for t in texts:
        assert "to=functions" not in t and "to=search_documents" not in t, t[:200]


@pytest.mark.asyncio
@pytest.mark.parametrize("n", [1, 5, 50])
async def test_n_the_measured_34748d7c_row_at_the_cap_pauses_with_its_call_queued(n):
    run = await _drive([SEARCH, _deltas(_split(H4_34748d7c, n))], user_settings=CAP2)
    assert _forced(run) == [False, True]
    assert run["dispatched"] == [("search_documents", {"query": "revenue"})]
    assert len(run["cap_calls"]) == 1
    buf = run["cap_calls"][0]["tool_calls_buffer"]
    assert [tc["name"] for tc in buf.values()] == ["search_documents"]
    assert json.loads(next(iter(buf.values()))["arguments"]) == {"query": "project plan"}
    assert "cap_paused" in _types(run["emits"])
    carrier = _carriers(run)[0]["tool_calls"]
    assert [(c["name"], json.loads(c["arguments"])) for c in carrier] == [
        ("search_documents", {"query": "project plan"})]
    live = "".join(_delta_texts(run["emits"]))
    persisted = _persisted_field(run["persisted"], "content")
    _no_recipient(live, persisted)
    assert live == persisted


@pytest.mark.asyncio
async def test_n_the_measured_2b7c16a0_row_at_the_cap_queues_all_ten_calls_in_order():
    run = await _drive([SEARCH, _deltas(_split(H2_2b7c16a0, 9))], user_settings=CAP2)
    buf = run["cap_calls"][0]["tool_calls_buffer"]
    assert [tc["name"] for tc in buf.values()] == H2_NAMES
    assert [c["name"] for c in _carriers(run)[0]["tool_calls"]] == H2_NAMES
    _no_recipient("".join(_delta_texts(run["emits"])), _persisted_field(run["persisted"], "content"))


@pytest.mark.asyncio
async def test_n_a_mid_run_harmony_round_is_dispatched_through_the_dispatcher():
    run = await _drive([_deltas(_split(H3_f1c46597, 11)), _deltas([ANSWER])],
                       user_settings=_settings(chat_max_tool_rounds=20))
    assert [name for name, _ in run["dispatched"]] == H3_NAMES
    assert run["dispatched"][4] == ("search_documents", {"query": "milestones"})
    assert "tool_preparing" in _types(run["emits"])
    assert run["cap_calls"] == []
    live = "".join(_delta_texts(run["emits"]))
    _no_recipient(live)
    assert _persisted_field(run["persisted"], "content") == ANSWER


@pytest.mark.asyncio
async def test_n_a_not_offered_name_is_never_dispatched_and_is_worded():
    # sandbox off: execute_code is not offered, so the whole 2b7c16a0 block is refused (D-07).
    run = await _drive([_deltas(_split(H2_2b7c16a0, 6))],
                       user_settings=_settings(sandbox_enabled=False, chat_max_tool_rounds=3))
    assert run["dispatched"] == []
    live = "".join(_delta_texts(run["emits"]))
    persisted = _persisted_field(run["persisted"], "content")
    for seen in (live, persisted):
        assert FAILED_CALL_NOTICE in seen
    _no_recipient(live, persisted)
    assert live == persisted


@pytest.mark.asyncio
async def test_n_a_not_offered_name_at_the_cap_pauses_with_an_empty_queue():
    run = await _drive([SEARCH, _deltas(_split(HARMONY_ONE.replace("search_documents", "rm_rf"), 7))],
                       user_settings=CAP2)
    assert run["dispatched"] == [("search_documents", {"query": "revenue"})]
    assert _carriers(run)[0]["tool_calls"] == [MARKER]
    _no_recipient(_persisted_field(run["persisted"], "content"))
    assert "rm_rf" not in _persisted_field(run["persisted"], "content")


@pytest.mark.asyncio
async def test_n_the_measured_ed030690_row_at_the_cap_pauses_and_keeps_only_its_prose():
    """A namespace-less recipient (``to=search_documents``) is refused, never repaired into a call."""
    run = await _drive([SEARCH, _deltas(_split(H1_ed030690, 13))], user_settings=CAP2)
    assert _carriers(run)[0]["tool_calls"] == [MARKER]
    persisted = _persisted_field(run["persisted"], "content")
    assert persisted == H1_TAIL
    assert "".join(_delta_texts(run["emits"])) == persisted


PROSE_HARMONY = "The model writes to=functions.search_documents and then its arguments, as JSON."


@pytest.mark.asyncio
@pytest.mark.parametrize("n", [1, 7, 50])
async def test_n_prose_mentioning_a_recipient_is_byte_identical_and_never_pauses(n):
    mid = await _drive([SEARCH, _deltas(_split(PROSE_HARMONY, n))], user_settings=_settings(chat_max_tool_rounds=5))
    final = await _drive([SEARCH, _deltas(_split(PROSE_HARMONY, n))], user_settings=CAP2)
    for run in (mid, final):
        assert "".join(_delta_texts(run["emits"])) == PROSE_HARMONY
        assert _persisted_field(run["persisted"], "content") == PROSE_HARMONY
        assert run["cap_calls"] == [] and "cap_paused" not in _types(run["emits"])


@pytest.mark.asyncio
@pytest.mark.parametrize("n", [1, 2, 3, 11])
async def test_n_live_deltas_equal_the_persisted_content(n):
    run = await _drive([SEARCH, _deltas(_split("Let me search." + H4_34748d7c, n))], user_settings=CAP2)
    assert "".join(_delta_texts(run["emits"])) == _persisted_field(run["persisted"], "content")
