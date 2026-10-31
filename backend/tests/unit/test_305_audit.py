"""Phase 305-03 (KEY-07; D-26 / D-53; T-305-12 / T-305-29 / T-305-31) — one audit row per MCP call.

Every ``tools/call`` writes EXACTLY ONE row naming the key (id + label), the tool and the outcome:

* answered            -> ``api_key.read``    {kind: mcp, tool, outcome: ok}
* handler raised      -> ``api_key.read``    {outcome: error}
* bad arguments       -> ``api_key.read``    {outcome: error}
* not granted         -> ``api_key.refused`` {reason: tool_not_granted, tool}
* unknown tool name   -> ``api_key.refused`` {reason: tool_not_granted}, no ``tool`` key
* over the limit      -> ``api_key.refused`` {reason: rate_limited:*, detail.limit}
* limiter down        -> ``api_key.refused`` {reason: limiter_unavailable}
* maintenance         -> ``api_key.refused`` {reason: maintenance}

Refusals go through ``refusal_audit_slot`` (CR-02): a suppressed one writes nothing and the next
written row names the suppressed count. No metadata value ever carries the query text.

The writer is ``app.mcp.audit.insert_audit_row`` (patched here as the row recorder; BUG-261031-04
moved the row off the supabase-py / threadpool path onto the asyncpg pool); the per-key counters run
on ``FakeRedis``. Nothing touches a database.
"""
from __future__ import annotations

import json
import threading
from dataclasses import replace

import pytest
from mcp import types
from mcp.shared.exceptions import MCPError

from app.models.user_settings import _build_settings_from_row
from app.security import api_key_auth as auth
from app.services import rate_limit
from tests.unit import _mcp305_harness as h
from tests.unit.phase293_inbound_fakes import FakeRedis

QUERY = "the-confidential-query-text-7731"
PRINCIPAL = replace(h.PRINCIPAL, label="Laptop", tools=("t_read", "t_query", "t_boom", "t_write"))


@pytest.fixture
def world(monkeypatch):
    rows: list[dict] = []

    async def _write(user_id, action_type, metadata, org_id):
        rows.append({"user_id": user_id, "action_type": action_type, "metadata": metadata,
                     "org_id": org_id})

    import app.mcp.audit as mcp_audit

    monkeypatch.setattr(mcp_audit, "insert_audit_row", _write)

    knobs = {"api_key_reads_per_minute": 50, "api_key_searches_per_minute": 1}

    async def _load():
        return _build_settings_from_row(dict(knobs))

    monkeypatch.setattr(rate_limit, "load_app_settings_async", _load)

    import app.mcp.tools as tools

    async def ok(principal, args):
        return h.text_result("ran")

    async def boom(principal, args):
        raise RuntimeError("kaboom " + QUERY)

    monkeypatch.setitem(tools.REGISTERED, "t_read", h.make_spec("t_read", ok))
    monkeypatch.setitem(
        tools.REGISTERED, "t_query",
        replace(h.make_spec("t_query", ok, args_model=h.NeedsQuery), bucket="expensive"),
    )
    monkeypatch.setitem(tools.REGISTERED, "t_boom", h.make_spec("t_boom", boom))
    monkeypatch.setitem(tools.REGISTERED, "t_write", h.make_spec("t_write", ok, read_only=False))
    monkeypatch.setitem(tools.REGISTERED, "t_hidden", h.make_spec("t_hidden", ok))
    usage = h.stub_usage(monkeypatch)  # t_query is "expensive": its mcp_usage rows land here

    import app.mcp.dispatch as dispatch_mod

    async def _pii_off(org_id):
        # The org's redaction switch reads OFF (its default). Unstubbed, the live read fails here and
        # the guard fails SAFE (ON) — which, since 305-REVIEW-04 WR-04-02, withholds these test
        # tools' raw CallToolResult. These tests are about the audit row, not redaction.
        return False

    monkeypatch.setattr(dispatch_mod, "_pii_on", _pii_off)
    return {"rows": rows, "redis": FakeRedis(), "knobs": knobs, "usage": usage}


async def _dispatch(world, name, arguments=None, principal=PRINCIPAL):
    from app.mcp.dispatch import dispatch

    return await dispatch(principal, name, arguments, redis=world["redis"])


def _only(world) -> dict:
    assert len(world["rows"]) == 1, world["rows"]
    row = world["rows"][0]
    assert row["user_id"] == PRINCIPAL.user_id
    assert row["org_id"] == PRINCIPAL.org_id
    md = row["metadata"]
    assert md["api_key_id"] == PRINCIPAL.key_id
    assert md["api_key_label"] == "Laptop"
    assert md["kind"] == "mcp"
    assert md["call"] == "read"
    assert QUERY not in json.dumps(row), "query text reached the audit row"
    return row


async def test_an_answered_call_writes_one_read_row_with_outcome_ok(world):
    out = await _dispatch(world, "t_query", {"query": QUERY})
    assert out.is_error is not True
    row = _only(world)
    assert row["action_type"] == "api_key.read"
    assert row["metadata"]["tool"] == "t_query"
    assert row["metadata"]["outcome"] == "ok"
    assert "reason" not in row["metadata"]


async def test_a_handler_exception_writes_outcome_error_and_still_raises(world):
    with pytest.raises(RuntimeError):
        await _dispatch(world, "t_boom")
    row = _only(world)
    assert row["action_type"] == "api_key.read"
    assert row["metadata"] == {**row["metadata"], "tool": "t_boom", "outcome": "error"}


async def test_bad_arguments_write_outcome_error(world):
    out = await _dispatch(world, "t_query", {"limit": "many"})
    assert out.is_error is True
    row = _only(world)
    assert (row["action_type"], row["metadata"]["outcome"]) == ("api_key.read", "error")


async def test_an_ungranted_call_writes_a_refused_row_naming_the_tool(world):
    out = await _dispatch(world, "t_hidden")
    assert out.is_error is True
    row = _only(world)
    assert row["action_type"] == "api_key.refused"
    assert row["metadata"]["reason"] == "tool_not_granted"
    assert row["metadata"]["tool"] == "t_hidden"
    assert row["metadata"]["outcome"] == "refused"


async def test_an_unknown_tool_name_writes_a_refused_row_with_no_tool(world, monkeypatch):
    import importlib

    server = importlib.import_module("app.mcp.server")  # the package re-exports the Server object
    monkeypatch.setattr(server._edge, "current_principal", lambda: PRINCIPAL)
    import app.mcp.dispatch as dispatch_mod

    monkeypatch.setattr(dispatch_mod, "get_redis", lambda: world["redis"])
    params = types.CallToolRequestParams(name="no_such_tool_" + QUERY, arguments={})
    with pytest.raises(MCPError) as caught:
        await server.on_call_tool(object(), params)
    assert caught.value.error.code == types.INVALID_PARAMS
    row = _only(world)
    assert row["action_type"] == "api_key.refused"
    assert row["metadata"]["reason"] == "tool_not_granted"
    assert "tool" not in row["metadata"]


async def test_an_over_limit_call_writes_a_refused_row_with_the_limit(world):
    await _dispatch(world, "t_query", {"query": QUERY})
    world["rows"].clear()
    out = await _dispatch(world, "t_query", {"query": QUERY})
    assert out.is_error is True
    assert out.content[0].text.startswith("This key has made too many searches in the last minute.")
    row = _only(world)
    assert row["action_type"] == "api_key.refused"
    assert row["metadata"]["reason"] == "rate_limited:expensive"
    assert row["metadata"]["tool"] == "t_query"
    assert row["metadata"]["detail"] == {"limit": 1}


async def test_a_suppressed_refusal_writes_nothing_and_the_next_carries_the_count(world, monkeypatch):
    import app.mcp.audit as mcp_audit

    answers = iter([None, 3])

    async def _slot(redis, *, key_id, reason):
        assert key_id == PRINCIPAL.key_id
        return next(answers)

    monkeypatch.setattr(mcp_audit, "refusal_audit_slot", _slot)
    await _dispatch(world, "t_hidden")
    assert world["rows"] == []
    await _dispatch(world, "t_hidden")
    row = _only(world)
    assert row["metadata"]["detail"] == {"suppressed": 3}


async def test_limiter_unavailable_is_refused_and_audited(world, monkeypatch):
    async def _down(redis, *, key_id, kind):
        raise rate_limit.LimiterUnavailable()

    monkeypatch.setattr(rate_limit, "check_key_limit", _down)
    out = await _dispatch(world, "t_read")
    assert out.is_error is True
    assert out.content[0].text == rate_limit.UNAVAILABLE_DETAIL
    row = _only(world)
    assert (row["action_type"], row["metadata"]["reason"]) == ("api_key.refused", "limiter_unavailable")


async def test_maintenance_refusal_is_audited_before_the_error(world, monkeypatch):
    import app.mcp.dispatch as dispatch_mod

    monkeypatch.setattr(dispatch_mod._maintenance, "_read_maintenance", lambda: True)
    with pytest.raises(MCPError):
        await _dispatch(world, "t_write")
    row = _only(world)
    assert (row["action_type"], row["metadata"]["reason"]) == ("api_key.refused", "maintenance")


@pytest.mark.parametrize("arguments,name", [
    ({}, "t_read"), ({"query": QUERY}, "t_query"), ({"limit": "x"}, "t_query"), ({}, "t_hidden"),
])
async def test_exactly_one_row_per_dispatch_on_every_path(world, arguments, name):
    await _dispatch(world, name, arguments)
    assert len(world["rows"]) == 1


async def test_an_audit_failure_never_fails_the_call(world, monkeypatch):
    async def _broken(*a, **k):
        raise RuntimeError("audit store down")

    import app.mcp.audit as mcp_audit

    monkeypatch.setattr(mcp_audit, "insert_audit_row", _broken)
    out = await _dispatch(world, "t_read")
    assert out.is_error is not True


async def test_an_mcp_audit_row_never_builds_a_supabase_client_or_hops_the_threadpool(world, monkeypatch):
    """BUG-261031-04: the per-row service-role client build (~0.19 s of GIL-held work) and the
    PostgREST insert were two threadpool hops that serialized under concurrency, past the bound.
    The MCP row is one asyncpg INSERT: the 293 HTTP writer is never reached from dispatch."""
    reached: list[str] = []

    def _build(org):
        reached.append("get_service_role_supabase")
        return object()

    async def _old(*a, **k):
        reached.append("write_audit_entry")

    monkeypatch.setattr(auth, "get_service_role_supabase", _build)
    monkeypatch.setattr(auth, "write_audit_entry", _old)
    await _dispatch(world, "t_read")
    await _dispatch(world, "t_hidden")
    assert reached == []
    assert [r["action_type"] for r in world["rows"]] == ["api_key.read", "api_key.refused"]


async def test_insert_audit_row_is_one_parameterized_insert_on_the_pool(monkeypatch):
    """The write's own shape: explicit org, metadata as JSON text, nothing interpolated."""
    import app.mcp.audit as mcp_audit

    seen: list[tuple] = []

    class _Pool:
        async def execute(self, sql, *args):
            seen.append((sql, args))

    async def _pool():
        return _Pool()

    monkeypatch.setattr(mcp_audit, "get_pg_pool", _pool)
    await mcp_audit.insert_audit_row("u1", "api_key.read", {"tool": "t", "outcome": "ok"}, "o1")
    ((sql, args),) = seen
    assert sql.startswith("INSERT INTO public.audit_log (user_id, action_type, metadata, org_id)")
    assert args == ("u1", "api_key.read", json.dumps({"tool": "t", "outcome": "ok"}), "o1")


# ── 305-REVIEW WR-01 / WR-03 / WR-04 ──────────────────────────────────────────────────────────


async def test_bad_argument_calls_cost_their_bucket_and_are_then_limited(world):
    """WR-01: a call with bad arguments is COUNTED (the searches knob is 1 here), so a loop of them
    is stopped by the per-key limit — and the refusal rows go through the CR-02 throttle."""
    first = await _dispatch(world, "t_query", {"limit": "many"})
    assert first.is_error is True
    assert first.content[0].text.startswith("Those arguments don't fit t_query.")
    assert len(world["rows"]) == 1
    world["rows"].clear()
    second = await _dispatch(world, "t_query", {"limit": "many"})
    assert second.is_error is True
    assert second.content[0].text.startswith("This key has made too many searches in the last minute.")
    row = _only(world)
    assert row["action_type"] == "api_key.refused"
    assert row["metadata"]["reason"] == "rate_limited:expensive"


async def test_a_flood_of_bad_argument_calls_writes_throttled_refusals(world):
    """WR-01: N+1 bad-argument calls in one minute — one counted answered row, then refusals that
    the CR-02 throttle collapses (one written row, the rest counted), never N unthrottled rows."""
    for _ in range(6):
        await _dispatch(world, "t_query", {"limit": "many"})
    kinds = [r["action_type"] for r in world["rows"]]
    assert kinds == ["api_key.read", "api_key.refused"], kinds


async def test_a_cancelled_call_still_writes_its_one_audit_row_and_its_usage_row(world, monkeypatch):
    """WR-03: the client disconnects mid-search (anyio cancellation is level-triggered). The
    bookkeeping in ``finally`` is shielded, so the audit row AND the paid-for spend row land."""
    import anyio

    import app.mcp.dispatch as dispatch_mod
    import app.mcp.tools as tools
    from app.services import usage_sink

    usage: list[dict] = []

    async def _insert(pool, **row):
        await anyio.sleep(0)  # a real insert yields to the loop: a checkpoint cancellation hits
        usage.append(row)
        return "usage-id"

    monkeypatch.setattr(dispatch_mod, "insert_usage", _insert)
    entered = anyio.Event()

    async def slow(principal, args):
        usage_sink.record("text-embedding-3-small", 7, provider="openai")  # the embedding is paid for
        entered.set()
        await anyio.sleep(60)

    monkeypatch.setitem(
        tools.REGISTERED, "t_slow",
        replace(h.make_spec("t_slow", slow, args_model=h.NeedsQuery), bucket="expensive"),
    )
    principal = replace(PRINCIPAL, tools=PRINCIPAL.tools + ("t_slow",))
    with anyio.fail_after(10):
        async with anyio.create_task_group() as tg:
            tg.start_soon(_dispatch, world, "t_slow", {"query": QUERY}, principal)
            await entered.wait()
            tg.cancel_scope.cancel()
    row = _only(world)
    assert row["action_type"] == "api_key.read"
    assert row["metadata"]["tool"] == "t_slow"
    assert row["metadata"]["outcome"] == "error"
    assert len(usage) == 1, usage
    assert usage[0]["input_tokens"] == 7 and usage[0]["status"] == "failed"


async def test_a_hung_audit_write_is_bounded_and_never_hangs_the_call(world, monkeypatch):
    """WR-03: the shield has a deadline — a bookkeeping write that never returns is abandoned."""
    import anyio

    import app.mcp.dispatch as dispatch_mod

    monkeypatch.setattr(dispatch_mod, "BOOKKEEPING_DEADLINE_S", 0.2, raising=False)

    async def _hang(*a, **k):
        await anyio.sleep(60)

    import app.mcp.audit as mcp_audit

    monkeypatch.setattr(mcp_audit, "insert_audit_row", _hang)
    with anyio.fail_after(5):
        out = await _dispatch(world, "t_read")
    assert out.is_error is not True


@pytest.mark.parametrize("name,write", [
    ("t_read", "api_key.read outcome=ok"),
    ("t_hidden", "api_key.refused reason=tool_not_granted"),
])
async def test_a_fired_audit_bound_is_logged_naming_the_tool_the_key_and_the_write(
    world, monkeypatch, caplog, name, write
):
    """BUG-261031-04: a bound that fires CANCELS the write, and the cancellation passes every
    ``except Exception`` — so the row used to vanish with no log line at all. It must be named."""
    import logging

    import anyio

    import app.mcp.dispatch as dispatch_mod

    monkeypatch.setattr(dispatch_mod, "BOOKKEEPING_DEADLINE_S", 0.2, raising=False)

    async def _hang(*a, **k):
        await anyio.sleep(60)

    monkeypatch.setattr(dispatch_mod._audit, "audit_answered", _hang)
    monkeypatch.setattr(dispatch_mod._audit, "audit_refused", _hang)
    with caplog.at_level(logging.ERROR, logger="app.mcp"), anyio.fail_after(5):
        await _dispatch(world, name)
    lines = [r.getMessage() for r in caplog.records if r.levelno >= logging.ERROR]
    assert any(name in m and PRINCIPAL.key_id in m and write in m for m in lines), lines


async def test_a_fired_usage_bound_is_logged_naming_the_tool_and_the_key(world, monkeypatch, caplog):
    """BUG-261031-04: the same for the spend row of an expensive call."""
    import logging

    import anyio

    import app.mcp.dispatch as dispatch_mod

    monkeypatch.setattr(dispatch_mod, "BOOKKEEPING_DEADLINE_S", 0.2, raising=False)

    async def _hang(*a, **k):
        await anyio.sleep(60)

    monkeypatch.setattr(dispatch_mod, "_write_usage", _hang)
    with caplog.at_level(logging.ERROR, logger="app.mcp"), anyio.fail_after(5):
        await _dispatch(world, "t_query", {"query": QUERY})
    lines = [r.getMessage() for r in caplog.records if r.levelno >= logging.ERROR]
    assert any("t_query" in m and PRINCIPAL.key_id in m and "mcp_usage" in m for m in lines), lines
    assert len(world["rows"]) == 1  # the audit row is a separate write and still lands


@pytest.mark.parametrize("sentence_name", ["NOT_AVAILABLE_SENTENCE", "NO_TEXT_SENTENCE", "BAD_CURSOR_SENTENCE"])
async def test_a_handler_refusal_sentence_is_never_audited_ok(world, monkeypatch, sentence_name):
    """WR-04: the client is told the call failed (``isError``), so the owner's activity must not
    read "✓ answered": the row is ``outcome: not_available`` and the readback is ``ok: false``."""
    import app.mcp.tools as tools
    from app.api import api_keys as route
    from app.mcp import read_tools

    sentence = getattr(read_tools, sentence_name)

    async def refuse(principal, args):
        return sentence

    monkeypatch.setitem(tools.REGISTERED, "t_read", h.make_spec("t_read", refuse))
    out = await _dispatch(world, "t_read")
    assert out.is_error is True and out.content[0].text == sentence
    row = _only(world)
    assert row["action_type"] == "api_key.read"
    assert row["metadata"]["outcome"] == "not_available"
    call = route._call_from_audit({**row, "created_at": "2026-10-31T10:00:00Z"}, {})
    assert call.ok is False and call.outcome == "not_available"


# ── api_key_auth: the additive tool field and the off-loop client build ───────────────────────


WORKFLOW_KEY = {"id": "k1", "label": "n8n", "user_id": "u1", "org_id": "o1"}
MCP_KEY = {**WORKFLOW_KEY, "kind": "mcp"}


def test_audit_args_carry_tool_when_given():
    _, md, _ = auth._audit_args(MCP_KEY, call="read", workflow_id=None, run_id=None,
                                outcome="ok", reason=None, detail=None, tool="search_knowledge_base")
    assert md["tool"] == "search_knowledge_base"


def test_audit_args_without_tool_are_byte_identical_to_293_and_304():
    _, wf, _ = auth._audit_args(WORKFLOW_KEY, call="start", workflow_id="w1", run_id="r1",
                                outcome="started", reason=None, detail=None)
    assert wf == {"api_key_id": "k1", "api_key_label": "n8n", "call": "start",
                  "workflow_id": "w1", "run_id": "r1", "outcome": "started"}
    _, mcp, _ = auth._audit_args(MCP_KEY, call="read", workflow_id=None, run_id=None,
                                 outcome=None, reason="mcp_off_org", detail=None)
    assert mcp == {"api_key_id": "k1", "api_key_label": "n8n", "call": "read",
                   "reason": "mcp_off_org", "kind": "mcp"}


async def test_audit_key_call_now_builds_its_client_off_the_event_loop(monkeypatch):
    loop_thread = threading.get_ident()
    seen: list[int] = []

    def _build(org):
        seen.append(threading.get_ident())
        return object()

    async def _write(*a, **k):
        return None

    monkeypatch.setattr(auth, "get_service_role_supabase", _build)
    monkeypatch.setattr(auth, "write_audit_entry", _write)
    await auth.audit_key_call_now(MCP_KEY, "api_key.read", call="read", outcome="ok", tool="t")
    assert seen and seen[0] != loop_thread, "the service-role client was built on the event loop"


async def test_resolve_mcp_principal_carries_the_key_label(monkeypatch):
    from app.security import mcp_principal

    async def _core(presented, *, pool, redis, call, expected_kind):
        return auth.ResolvedKey(
            id="k9", org_id="o9", user_id="u9", label="Work laptop", workflows=[],
            expires_at=None, kind="mcp", folder_ids=None, tools=("list_documents",),
        )

    monkeypatch.setattr(auth, "authenticate_presented_key", _core)
    principal = await mcp_principal.resolve_mcp_principal("srl_mcp_x", pool=None, redis=None)
    assert principal.label == "Work laptop"


# ── 305-REVIEW LF-03: a refusal row that is not written gives its suppressed count back ──────────


_PENDING = f"apikey:refaudit:sup:{PRINCIPAL.key_id}:tool_not_granted"


def _open_a_new_minute(redis) -> None:
    """Drop the per-minute window keys (as if the minute rolled over); keep the pending count."""
    for k in [k for k in redis.store if k.startswith("apikey:refaudit:") and ":sup:" not in k]:
        del redis.store[k]


async def test_a_failed_refusal_write_restores_the_suppressed_count(world, monkeypatch, caplog):
    """CR-02: N suppressed refusals are named by the NEXT written row. When that row's INSERT fails,
    the count used to be gone from Redis AND the ledger. It must be restored, and the next written
    row must still carry it; the error line names it too."""
    import logging

    import app.mcp.audit as mcp_audit

    world["redis"].store[_PENDING] = "3"  # three refusals were counted since the last written row
    recorder = mcp_audit.insert_audit_row

    async def _broken(*a, **k):
        raise RuntimeError("pool exhausted")

    monkeypatch.setattr(mcp_audit, "insert_audit_row", _broken)
    with caplog.at_level(logging.ERROR, logger="app.mcp"):
        await _dispatch(world, "t_hidden")
    assert world["redis"].store.get(_PENDING) == "3", "the suppressed count was lost"
    assert any("suppressed=3" in r.getMessage() for r in caplog.records), caplog.records

    monkeypatch.setattr(mcp_audit, "insert_audit_row", recorder)
    _open_a_new_minute(world["redis"])
    await _dispatch(world, "t_hidden")
    row = _only(world)
    assert row["metadata"]["detail"] == {"suppressed": 3}


async def test_a_fired_bound_on_a_refusal_write_restores_the_suppressed_count(world, monkeypatch):
    """The same when dispatch's bookkeeping bound fires mid-INSERT (BUG-261031-04's case): the
    cancellation passes ``except Exception``, so the count must be given back on that path too."""
    import anyio

    import app.mcp.audit as mcp_audit
    import app.mcp.dispatch as dispatch_mod

    monkeypatch.setattr(dispatch_mod, "BOOKKEEPING_DEADLINE_S", 0.2, raising=False)
    world["redis"].store[_PENDING] = "5"

    async def _hang(*a, **k):
        await anyio.sleep(60)

    monkeypatch.setattr(mcp_audit, "insert_audit_row", _hang)
    with anyio.fail_after(5):
        await _dispatch(world, "t_hidden")
    assert world["redis"].store.get(_PENDING) == "5", "the suppressed count was lost"


async def test_a_written_refusal_row_still_clears_the_count(world):
    """CR-02 unchanged on the happy path: the written row takes the count and Redis forgets it."""
    world["redis"].store[_PENDING] = "2"
    await _dispatch(world, "t_hidden")
    row = _only(world)
    assert row["metadata"]["detail"] == {"suppressed": 2}
    assert _PENDING not in world["redis"].store
