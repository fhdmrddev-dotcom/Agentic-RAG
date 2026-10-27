"""Phase 292.1 (D-07, RESEARCH Pitfall 2, T-2921-04) — an empty-queue cap pause must never let a
later Continue re-run an OLDER pause's calls.

When the forced-final round wrote tool-call markup that could not be parsed, the run still pauses
``cap_paused`` with nothing queued. A carrier with ``tool_calls = []`` does NOT satisfy
``load_cap_paused_tool_calls``'s ``@> '[{"kind": "iteration_cap_paused"}]'`` filter, so the read
would fall through to the PREVIOUS pause in the thread and Continue would re-execute stale calls.

The fix has two halves, both pinned here:
  * ``persist_cap_paused`` with an empty buffer writes ONE marker entry (kind set, name None), so
    the newest carrier still matches the filter;
  * ``load_cap_paused_tool_calls`` drops name-less entries, so that carrier yields ``[]``.
Both SQL strings stay byte-identical (``$N`` placeholders only, T-073-02).
"""
from __future__ import annotations

import inspect
from uuid import uuid4

import pytest

from app.db import runs as runs_db
from app.services import agent_loop as _loop_mod

MARKER = {"kind": "iteration_cap_paused", "tool_call_id": None, "name": None, "arguments": None}
REAL = {"kind": "iteration_cap_paused", "tool_call_id": "call_1", "name": "search_documents",
        "arguments": '{"query": "x"}'}


class _Pool:
    def __init__(self, row):
        self._row = row
        self.calls: list[tuple] = []

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        return self._row


@pytest.mark.asyncio
@pytest.mark.parametrize("org_id", [None, uuid4()], ids=["no-org", "org"])
async def test_the_newest_carrier_being_a_marker_yields_nothing(org_id):
    pool = _Pool({"tool_calls": [MARKER]})
    assert await runs_db.load_cap_paused_tool_calls(pool, uuid4(), org_id=org_id) == []


@pytest.mark.asyncio
async def test_a_real_call_beside_a_marker_returns_only_the_real_call():
    pool = _Pool({"tool_calls": [REAL, MARKER]})
    assert await runs_db.load_cap_paused_tool_calls(pool, uuid4()) == [REAL]


@pytest.mark.asyncio
async def test_a_real_carrier_is_returned_unchanged():
    pool = _Pool({"tool_calls": [REAL]})
    assert await runs_db.load_cap_paused_tool_calls(pool, uuid4()) == [REAL]
    pool = _Pool(None)
    assert await runs_db.load_cap_paused_tool_calls(pool, uuid4()) == []


def test_both_sql_branches_are_unchanged():
    src = inspect.getsource(runs_db.load_cap_paused_tool_calls)
    assert src.count("""tool_calls @> '[{"kind": "iteration_cap_paused"}]'::jsonb""") == 2
    assert "AND org_id = $2" in src
    assert src.count("ORDER BY created_at DESC") == 2


class _Builder:
    def __init__(self, sink):
        self._sink = sink

    def insert(self, payload):
        self._sink.append(payload)
        return self


class _SB:
    def __init__(self):
        self.inserted: list = []

    def table(self, _name):
        return _Builder(self.inserted)


async def _persist(buffer, **kw):
    sb = _SB()
    events: list = []

    async def _emit(_redis, _rid, etype, **fields):
        events.append((etype, fields))

    async def _aexec(q):
        return None

    import unittest.mock as um

    with um.patch.object(_loop_mod, "aexec", _aexec):
        disp = await _loop_mod.persist_cap_paused(
            redis=None, run_id=uuid4(), thread_id=str(uuid4()), user_id=str(uuid4()),
            supabase=sb, tool_calls_buffer=buffer, continues_used=1, emit=_emit, **kw,
        )
    return disp, sb.inserted, events


@pytest.mark.asyncio
async def test_an_empty_buffer_writes_one_marker_and_the_limit_line():
    disp, inserted, events = await _persist({})
    assert disp == "cap_paused"
    assert inserted[0]["tool_calls"] == [MARKER]
    assert inserted[0]["content"] == "⏸ Reached the tool-use limit for this turn. Continue to keep going."
    (etype, fields), = events
    assert etype == "cap_paused"
    assert fields["message"] == "⏸ Reached the tool-use limit for this turn. Continue to keep going."
    assert fields["tool_names"] == []


@pytest.mark.asyncio
async def test_a_non_empty_buffer_is_byte_identical_and_reasoning_is_absent_by_default():
    buf = {0: {"id": "call_1", "name": "search_documents", "arguments": '{"query": "x"}'}}
    _, inserted, events = await _persist(buf)
    assert inserted[0]["tool_calls"] == [REAL]
    assert inserted[0]["content"] == "⏸ Reached the iteration limit with 1 tool(s) still queued. Continue to run them."
    assert events[0][1]["message"] == "⏸ Reached the iteration limit — 1 tool(s) weren't run yet. Continue to run them."


@pytest.mark.asyncio
async def test_reasoning_content_rides_the_first_carrier_entry_only():
    buf = {0: {"id": "call_1", "name": "search_documents", "arguments": "{}"},
           1: {"id": "call_2", "name": "grep", "arguments": "{}"}}
    _, inserted, _ = await _persist(buf, reasoning_content="think")
    calls = inserted[0]["tool_calls"]
    assert calls[0]["reasoning_content"] == "think"
    assert "reasoning_content" not in calls[1]
    _, inserted, _ = await _persist(buf, reasoning_content="")
    assert all("reasoning_content" not in c for c in inserted[0]["tool_calls"])
