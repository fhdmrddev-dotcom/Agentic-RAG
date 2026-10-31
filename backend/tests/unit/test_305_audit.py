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

The writer is ``api_key_auth.write_audit_entry`` (patched here as the row recorder); the per-key
counters run on ``FakeRedis``. Nothing touches a database.
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

    async def _write(user_id, action_type, metadata, supabase, org_id=None):
        rows.append({"user_id": user_id, "action_type": action_type, "metadata": metadata,
                     "org_id": org_id})

    monkeypatch.setattr(auth, "write_audit_entry", _write)
    monkeypatch.setattr(auth, "get_service_role_supabase", lambda org: object())

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
    return {"rows": rows, "redis": FakeRedis(), "knobs": knobs}


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

    monkeypatch.setattr(auth, "write_audit_entry", _broken)
    out = await _dispatch(world, "t_read")
    assert out.is_error is not True


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
