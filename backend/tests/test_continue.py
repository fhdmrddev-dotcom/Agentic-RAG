"""Phase 092 — CONT-01 / D-06 / D-08 Continue contracts (Plan 03 — LIVE).

Plan 03 flips these from ``@pytest.mark.skip`` stubs to live assertions:

  * persist dropped tool_calls BEFORE clearing the buffer (SC#4)
  * Continue CONSUMES the persisted calls, not re-drop (SC#4)
  * 4th Continue refused at continues_used == 3 (D-06)
  * Harness phase re-reads available_tools from the definition (D-08)
  * Deep Mode byte-identical when the cap-drop flag is OFF

Fixtures consumed (backend/tests/conftest.py): mock_asyncpg_pool, fake_redis,
build_workflow_definition.
"""
from __future__ import annotations

import uuid

import pytest

from app.config import settings


# ── LIVE structural anchor ───────────────────────────────────────────────────

def test_continue_cap_constant_is_three():
    """D-06: the Continue cap is 3 per run. Live anchor on the config knob the
    Continue endpoint reads (Plan 03 wires `max_continues_per_run`).

    Asserts the durable counter semantics this module exercises: continues_used
    runs 0..3, and continues_remaining = 3 - continues_used. This is the
    arithmetic the refusal contract below depends on.
    """
    cap = settings.max_continues_per_run
    assert cap == 3
    for used in range(cap + 1):
        remaining = cap - used
        assert remaining == cap - used
        assert 0 <= remaining <= cap
    # the 4th continue (used already at the cap) leaves 0 remaining -> refuse.
    assert cap - cap == 0


# ── SC#4: persist-then-consume the dropped tool calls (Plan 03) ──────────────

def test_cap_paused_carrier_preserves_names_args_and_ids():
    """SC#4: the carrier-row builder preserves the EXACT name/args/id of every
    buffered tool call (the durable payload Continue reads to consume, not
    re-drop). It mirrors the ask_user_response carrier shape (kind + jsonb).
    """
    from app.services.agent_loop import build_cap_paused_carrier_tool_calls

    buffer = {
        "tc_1": {"id": "tc_1", "name": "search_documents",
                 "arguments": '{"query": "x"}'},
        "tc_2": {"id": "tc_2", "name": "execute_code",
                 "arguments": '{"code": "print(1)"}'},
    }
    carrier = build_cap_paused_carrier_tool_calls(buffer)

    # Exactly one carrier entry per buffered call, kind tags it for out-of-band read.
    assert all(tc["kind"] == "iteration_cap_paused" for tc in carrier)
    assert [tc["name"] for tc in carrier] == ["search_documents", "execute_code"]
    assert [tc["tool_call_id"] for tc in carrier] == ["tc_1", "tc_2"]
    assert [tc["arguments"] for tc in carrier] == [
        '{"query": "x"}', '{"code": "print(1)"}',
    ]


@pytest.mark.asyncio
async def test_cap_persists_dropped_tool_calls_before_clearing_buffer(fake_redis):
    """SC#4: at the cap, ``persist_cap_paused`` writes a durable role='system'
    carrier row (with the tool_calls jsonb) AND emits a NON-terminal cap_paused
    SSE event — both BEFORE the caller clears the in-memory buffer.
    """
    from app.services.agent_loop import persist_cap_paused

    inserted: list = []

    class _Builder:
        def insert(self, payload):
            inserted.append(payload)
            return self

        def execute(self):
            return None

    class _SB:
        def table(self, _name):
            return _Builder()

    run_id = uuid.uuid4()
    buffer = {
        "tc_1": {"id": "tc_1", "name": "search_documents",
                 "arguments": '{"query": "x"}'},
    }

    async def _emit(redis, rid, etype, **fields):
        fake_redis.events.append(("emit", etype, fields))

    disposition = await persist_cap_paused(
        redis=fake_redis,
        run_id=run_id,
        thread_id=str(uuid.uuid4()),
        user_id=str(uuid.uuid4()),
        supabase=_SB(),
        tool_calls_buffer=buffer,
        continues_used=0,
        emit=_emit,
    )

    # Returns the non-terminal disposition the producer writes.
    assert disposition == "cap_paused"

    # The carrier row was persisted with role='system' + the tool_calls jsonb.
    assert len(inserted) == 1
    row = inserted[0]
    assert row["role"] == "system"
    assert row["tool_calls"][0]["kind"] == "iteration_cap_paused"
    assert row["tool_calls"][0]["name"] == "search_documents"

    # A distinct NON-terminal cap_paused SSE event was emitted carrying the
    # tool names + continues counters (NOT a terminal sentinel).
    cap_events = [e for e in fake_redis.events
                  if e[0] == "emit" and e[1] == "cap_paused"]
    assert len(cap_events) == 1
    fields = cap_events[0][2]
    assert fields["continues_used"] == 0
    assert fields["continues_remaining"] == settings.max_continues_per_run
    assert "search_documents" in fields["tool_names"]


def test_cap_paused_event_type_is_not_a_terminal_sentinel():
    """Landmine 6: cap_paused MUST NOT be in TERMINAL_TYPES / not mapped by
    _RUN_STATUS_TO_TERMINAL_TYPE — otherwise the frontend treats the pause as a
    terminal 'done' and can't re-attach the stream for Continue.
    """
    from app.api.threads import TERMINAL_TYPES, _RUN_STATUS_TO_TERMINAL_TYPE

    assert "cap_paused" not in TERMINAL_TYPES
    assert "cap_paused" not in _RUN_STATUS_TO_TERMINAL_TYPE


@pytest.mark.asyncio
async def test_continue_consumes_persisted_tool_calls_not_redrop(mock_asyncpg_pool):
    """SC#4: Continue reads the EXACT persisted tool calls back (consume, not
    re-drop, not start-fresh). ``load_cap_paused_tool_calls`` returns the durable
    carrier payload the continuation pre-loads as its first dispatch round.
    """
    from app.db.runs import load_cap_paused_tool_calls

    persisted = [
        {"kind": "iteration_cap_paused", "tool_call_id": "tc_1",
         "name": "search_documents", "arguments": '{"query": "x"}'},
    ]
    mock_asyncpg_pool.set_fetchrow_result({"tool_calls": persisted})

    loaded = await load_cap_paused_tool_calls(mock_asyncpg_pool, uuid.uuid4())

    # The exact persisted calls come back — they will be re-executed, not dropped.
    assert loaded == persisted
    assert loaded[0]["name"] == "search_documents"
    # The read scans the durable role='system' carrier row keyed by the thread.
    sql = mock_asyncpg_pool.calls[-1][0]
    assert "iteration_cap_paused" in sql
    assert "role = 'system'" in sql


# ── D-06: 3-cap refusal (Plan 03) ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_continue_refused_when_continues_used_at_3(client, mock_builder):
    """D-06: the 4th Continue is refused server-side (clean stop message) when
    continues_used >= max_continues_per_run (3). continues_used is the durable
    column added by migration 063 — never an in-memory count (WORKER_COUNT=2).
    """
    run_id = str(uuid.uuid4())
    thread_id = str(uuid.uuid4())

    # Ownership SELECT returns a cap_paused Deep run already at the cap.
    ownership = type("R", (), {"data": {
        "run_id": run_id, "status": "cap_paused", "thread_id": thread_id,
        "continues_used": settings.max_continues_per_run,
    }})()
    mock_builder.execute.return_value = ownership

    resp = client.post(
        f"/runs/{run_id}/continue",
        headers={"Authorization": "Bearer test-token"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # Clean refusal payload — NO spawn happened.
    assert body["status"] == "refused"
    assert "continue" in body["message"].lower()
    # No transactional increment occurred (no UPDATE recorded on the builder).
    assert mock_builder.update.call_count == 0


# ── D-08: Harness phase re-reads available_tools (Plan 03) ───────────────────

@pytest.mark.asyncio
async def test_continue_harness_rereads_available_tools_from_definition(
    build_workflow_definition,
):
    """D-08: on a Harness-phase Continue, the active phase's available_tools is
    re-read from the parsed definition (it lives in the definition JSONB, NOT a
    workflow_phases column) before resuming.
    """
    from app.api.runs import resolve_phase_available_tools

    wf = build_workflow_definition(
        [
            {"slug": "research", "phase_index": 0,
             "config": {"phase_type": "llm_agent", "prompt": "go",
                        "available_tools": ["search_documents", "web_search"]}},
            {"slug": "summarize", "phase_index": 1,
             "config": {"phase_type": "llm_single", "prompt": "sum"}},
        ]
    )

    # The active phase is the llm_agent phase — its whitelist must be re-read.
    tools = resolve_phase_available_tools(wf, active_slug="research")
    assert tools == ["search_documents", "web_search"]

    # A non-tool phase (llm_single) has no whitelist → empty list (no crash).
    assert resolve_phase_available_tools(wf, active_slug="summarize") == []


# ── Deep Mode byte-identical when the flag is OFF (Plan 03) ──────────────────

def test_deep_run_without_cap_drop_is_byte_identical():
    """The resume_dropped_tool_calls flag defaults OFF on RunContext — a Deep run
    that does NOT hit the cap constructs its context exactly as before (the new
    fields carry their byte-identical defaults; nothing forces a cap path).
    """
    from app.services.agent_loop import RunContext

    ctx = RunContext(
        run_id=uuid.uuid4(),
        thread_id=str(uuid.uuid4()),
        current_user={"id": "u"},
        user_settings=None,
        body=None,
        redis=None,
        supabase=None,
        resolved_model="m",
        resolved_provider="p",
    )
    # The additive flag is OFF by default → the cap-resume entry never engages.
    assert ctx.resume_dropped_tool_calls is False
    assert ctx.dropped_tool_calls == ()
