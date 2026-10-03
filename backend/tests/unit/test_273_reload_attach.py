"""Phase 273 (I-2 / ART-05 / Pitfall 5) — reload shows the same stored record the live event carried.

`attach_artifacts` walks each assistant message's persisted `show_artifact` results, parses the
artifact id (NEVER the tool_call_id — Gemini's `call_0` repeats every turn), and does ONE batched
select through the caller's user-JWT client with an explicit thread_id + user_id filter.
"""
from __future__ import annotations

import json
import logging
from types import SimpleNamespace

import pytest

from app.models.artifact import REFUSED_STATUS, RESULT_ID_KEY
from app.services.artifact_history import attach_artifacts

T = "11111111-1111-1111-1111-111111111111"
U = "22222222-2222-2222-2222-222222222222"
A1, A2, A3 = "a_aaaaaaaaa1", "a_aaaaaaaaa2", "a_aaaaaaaaa3"


def _row(art_id: str) -> dict:
    return {"id": art_id, "thread_id": T, "user_id": U, "component": "chart", "label": f"chart {art_id[-1]}",
            "spec": {"title": art_id}}


def _sa(tool_call_id: str, art_id: str | None) -> dict:
    result = (
        json.dumps({RESULT_ID_KEY: art_id, "label": "chart 1"})
        if art_id
        else json.dumps({"status": REFUSED_STATUS, "reason": "too many rows"})
    )
    return {"tool_call_id": tool_call_id, "name": "show_artifact", "args": {"rows": "<stored>"},
            "result": result, "status": "done"}


class _FakeQuery:
    def __init__(self, client, table):
        self.client = client
        self.calls: list[tuple] = [("table", table)]
        client.queries.append(self)

    def __getattr__(self, name):
        def _chain(*args, **kwargs):
            self.calls.append((name, *args))
            return self
        return _chain

    def execute(self):
        if self.client.raise_on_execute:
            raise RuntimeError("postgrest down")
        ids = next(c[2] for c in self.calls if c[0] == "in_")
        return SimpleNamespace(data=[r for r in self.client.rows if r["id"] in ids])


class _FakeClient:
    def __init__(self, rows, *, raise_on_execute=False):
        self.rows = rows
        self.raise_on_execute = raise_on_execute
        self.queries: list[_FakeQuery] = []

    def table(self, name):
        return _FakeQuery(self, name)


def _messages() -> list[dict]:
    return [
        {"id": "m0", "role": "user", "content": "chart it"},
        {"id": "mA", "role": "assistant", "content": "two charts",
         "tool_calls": [_sa("call_0", A1), _sa("call_1", None), _sa("call_2", A2),
                        {"tool_call_id": "x", "name": "search_documents", "args": {}, "result": "[]", "status": "done"}]},
        {"id": "m1", "role": "user", "content": "and another"},
        # the Gemini collision fixture: the SAME tool_call_id as message A's first call
        {"id": "mB", "role": "assistant", "content": "one more", "tool_calls": [_sa("call_0", A3)]},
    ]


@pytest.mark.asyncio
async def test_one_batched_rls_select_attaches_in_call_order():
    client = _FakeClient([_row(A3), _row(A2), _row(A1)])
    msgs = _messages()
    out = await attach_artifacts(msgs, thread_id=T, user_id=U, supabase=client)

    assert out is msgs
    assert len(client.queries) == 1
    q = client.queries[0].calls
    assert q[0] == ("table", "message_artifacts")
    assert ("select", "*") in q
    assert ("in_", "id", [A1, A2, A3]) in q
    assert ("eq", "thread_id", T) in q
    assert ("eq", "user_id", U) in q

    by_id = {m["id"]: m for m in out}
    assert [a["id"] for a in by_id["mA"]["artifacts"]] == [A1, A2]
    assert by_id["mA"]["artifacts"][0] == _row(A1)
    assert by_id["mB"]["artifacts"] == [_row(A3)]
    assert "artifacts" not in by_id["m0"]
    assert "artifacts" not in by_id["m1"]


@pytest.mark.asyncio
async def test_a_referenced_id_with_no_row_is_marked_missing():
    client = _FakeClient([_row(A1), _row(A3)])
    out = await attach_artifacts(_messages(), thread_id=T, user_id=U, supabase=client)
    by_id = {m["id"]: m for m in out}
    assert by_id["mA"]["artifacts"] == [_row(A1), {"id": A2, "missing": True}]


@pytest.mark.asyncio
async def test_a_failed_select_marks_every_id_missing_and_never_raises(caplog):
    client = _FakeClient([_row(A1)], raise_on_execute=True)
    with caplog.at_level(logging.WARNING):
        out = await attach_artifacts(_messages(), thread_id=T, user_id=U, supabase=client)
    by_id = {m["id"]: m for m in out}
    assert by_id["mA"]["artifacts"] == [{"id": A1, "missing": True}, {"id": A2, "missing": True}]
    assert by_id["mB"]["artifacts"] == [{"id": A3, "missing": True}]
    assert any("artifact" in r.getMessage().lower() for r in caplog.records)


@pytest.mark.asyncio
async def test_no_show_artifact_calls_means_zero_db_calls():
    client = _FakeClient([])
    msgs = [
        {"id": "m0", "role": "user", "content": "hi"},
        {"id": "m1", "role": "assistant", "content": "hello", "tool_calls": None},
        {"id": "m2", "role": "assistant", "content": "x",
         "tool_calls": [{"tool_call_id": "c", "name": "web_search", "args": {}, "result": "{}", "status": "done"}]},
        {"id": "m3", "role": "assistant", "content": "refused only", "tool_calls": [_sa("call_0", None)]},
    ]
    out = await attach_artifacts(msgs, thread_id=T, user_id=U, supabase=client)
    assert client.queries == []
    assert all("artifacts" not in m for m in out)


@pytest.mark.asyncio
async def test_a_system_transcript_row_is_never_walked():
    client = _FakeClient([_row(A1)])
    msgs = [{"id": "s", "role": "system", "content": "scope", "tool_calls": [{"kind": "scope_changed"}]}]
    await attach_artifacts(msgs, thread_id=T, user_id=U, supabase=client)
    assert client.queries == []


# ── the response field ────────────────────────────────────────────────────────────────────────


def _db_row(**extra) -> dict:
    return {
        "id": "33333333-3333-3333-3333-333333333333", "thread_id": T, "user_id": U, "role": "assistant",
        "content": "x", "created_at": "2026-10-03T00:00:00Z", "updated_at": "2026-10-03T00:00:00Z", **extra,
    }


def test_message_response_round_trips_artifacts():
    from app.models.message import MessageResponse

    arts = [_row(A1), {"id": A2, "missing": True}]
    assert MessageResponse(**_db_row(artifacts=arts)).model_dump()["artifacts"] == arts


def test_message_response_artifacts_absent_is_none():
    from app.models.message import MessageResponse

    assert MessageResponse(**_db_row()).artifacts is None
