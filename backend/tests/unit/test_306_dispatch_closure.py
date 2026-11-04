"""Phase 306-03 (D-26 / D-28 / D-02) — Seam B: the dispatch-side allow-list for OUTSIDE runs.

Inside an outside run every name outside the six read tools is refused at ``dispatch_tool``'s first
branch and NO handler runs: every other registry name, every POWER_TOOLS name, a ``svc__tool``
connector name and an unknown name. Outside one, dispatch is a literal no-op change.

The durable half (D-28): with the ContextVar unset, a chat-run dispatch on a thread whose frozen
``threads.origin_kind`` is ``'mcp'`` is refused too — a member's in-app Continue of a cap-paused ask
and every later in-app turn. Cached per thread; a read error refuses and is not cached.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services import outside_run_scope as ors
from app.services import tool_dispatcher as td
from app.services.describe_draft_guards import POWER_TOOLS
from app.services.tools.base import ToolContext, ToolResult

SIX = frozenset({"search_documents", "ls", "tree", "grep", "glob", "read_document"})
ALL_FLAGS_ON = SimpleNamespace(
    web_search_enabled=True, sandbox_enabled=True, self_improve_enabled=True,
)


def _ctx(*, thread_id=None, pool=None, phase_whitelist=None) -> ToolContext:
    return ToolContext(
        redis=None, run_id=uuid.uuid4(), thread_id=thread_id or str(uuid.uuid4()),
        supabase=None, pool=pool, user_settings=None, current_user={"id": str(uuid.uuid4())},
        folder_subtree_ids=None, scoped_folder_path=None, emit=AsyncMock(), spawn=lambda c: c.close(),
        phase_whitelist=phase_whitelist,
    )


@pytest.fixture(autouse=True)
def _clean_cache():
    ors._origin_is_mcp.clear()
    yield
    ors._origin_is_mcp.clear()


@pytest.fixture
def recorders(monkeypatch):
    """Every registry handler and the connector fallback replaced by a recorder."""
    calls: list[str] = []
    results: dict[str, ToolResult] = {}

    def _make(name):
        res = ToolResult(result=f"ran {name}")
        results[name] = res

        async def _h(_args, _ctx):
            calls.append(name)
            return res
        return _h

    for name in list(td._TOOL_REGISTRY):
        monkeypatch.setitem(td._TOOL_REGISTRY, name, _make(name))

    async def _connector(service_id, action, _args, _ctx):
        calls.append(f"{service_id}__{action}")
        return ToolResult(result="ran connector")

    monkeypatch.setattr(td, "_handle_connector_chat_tool", _connector)
    monkeypatch.setattr(td, "load_app_settings", lambda: ALL_FLAGS_ON)
    return SimpleNamespace(calls=calls, results=results)


async def _outside(coro_fn):
    return await asyncio.create_task(coro_fn(), context=ors.outside_run_context(ors.ASK_TOOL_ALLOWLIST))


def _refused(result: ToolResult, name: str) -> bool:
    try:
        payload = json.loads(result.result)
    except (TypeError, ValueError):
        return False
    return payload.get("error") == "tool_not_available_for_outside_ask" and payload.get("tool") == name


# ── inside an outside run ─────────────────────────────────────────────────────────────────────

_REFUSED_NAMES = sorted(
    (set(td._TOOL_REGISTRY) - SIX) | set(POWER_TOOLS) | {"gmail__send_message", "no_such_tool"}
)


@pytest.mark.asyncio
@pytest.mark.parametrize("name", _REFUSED_NAMES)
async def test_a_non_listed_name_is_refused_and_no_handler_runs(recorders, name):
    async def _go():
        return await td.dispatch_tool(name, {}, _ctx())

    result = await _outside(_go)
    assert _refused(result, name), result.result
    assert recorders.calls == []


def test_the_refused_set_is_not_vacuous():
    assert len(_REFUSED_NAMES) >= 26
    assert {"execute_code", "web_search", "remember", "save_skill", "attach_skill_file"} <= set(_REFUSED_NAMES)


@pytest.mark.asyncio
@pytest.mark.parametrize("name", sorted(SIX))
async def test_a_listed_name_reaches_its_handler(recorders, name):
    async def _go():
        return await td.dispatch_tool(name, {}, _ctx())

    result = await _outside(_go)
    assert result is recorders.results[name]
    assert recorders.calls == [name]


@pytest.mark.asyncio
async def test_the_outside_refusal_comes_before_the_phase_whitelist(recorders):
    async def _go():
        return await td.dispatch_tool("execute_code", {}, _ctx(phase_whitelist=frozenset({"execute_code"})))

    assert _refused(await _outside(_go), "execute_code")
    assert recorders.calls == []


# ── outside an outside run: a literal no-op ───────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize("name", sorted(td._TOOL_REGISTRY))
async def test_outside_an_outside_run_every_registry_name_reaches_its_handler(recorders, monkeypatch, name):
    read = AsyncMock(return_value=None)  # an in-app thread: origin NULL
    monkeypatch.setattr(ors, "_read_origin_kind", read)
    result = await td.dispatch_tool(name, {}, _ctx(pool=object()))
    assert result is recorders.results[name]
    assert recorders.calls == [name]


@pytest.mark.asyncio
async def test_outside_an_outside_run_a_connector_name_still_routes(recorders, monkeypatch):
    monkeypatch.setattr(ors, "_read_origin_kind", AsyncMock(return_value=None))
    await td.dispatch_tool("gmail__send_message", {}, _ctx(pool=object()))
    assert recorders.calls == ["gmail__send_message"]


@pytest.mark.asyncio
async def test_the_phase_whitelist_branch_is_unchanged(recorders, monkeypatch):
    read = AsyncMock(return_value="mcp")
    monkeypatch.setattr(ors, "_read_origin_kind", read)
    monkeypatch.setattr(td, "_spawn_tool_refused_audit", lambda *a, **k: None)
    result = await td.dispatch_tool("execute_code", {}, _ctx(pool=object(), phase_whitelist=frozenset({"ls"})))
    assert json.loads(result.result)["error"] == "tool_not_available_in_phase"
    allowed = await td.dispatch_tool("execute_code", {}, _ctx(pool=object(), phase_whitelist=frozenset({"execute_code"})))
    assert allowed is recorders.results["execute_code"]
    read.assert_not_awaited()  # phase_whitelist set -> the origin is never read


# ── the durable half (D-28) ───────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_an_mcp_thread_refuses_a_power_tool_with_the_contextvar_unset(recorders, monkeypatch):
    read = AsyncMock(return_value="mcp")
    monkeypatch.setattr(ors, "_read_origin_kind", read)
    tid = str(uuid.uuid4())
    result = await td.dispatch_tool("execute_code", {}, _ctx(thread_id=tid, pool=object()))
    assert _refused(result, "execute_code")
    assert recorders.calls == []
    read.assert_awaited_once()


@pytest.mark.asyncio
async def test_a_listed_name_on_an_mcp_thread_runs_without_any_read(recorders, monkeypatch):
    read = AsyncMock(return_value="mcp")
    monkeypatch.setattr(ors, "_read_origin_kind", read)
    result = await td.dispatch_tool("search_documents", {}, _ctx(pool=object()))
    assert result is recorders.results["search_documents"]
    read.assert_not_awaited()


@pytest.mark.asyncio
async def test_the_origin_is_read_once_per_thread(recorders, monkeypatch):
    read = AsyncMock(return_value="mcp")
    monkeypatch.setattr(ors, "_read_origin_kind", read)
    tid = str(uuid.uuid4())
    for name in ("execute_code", "web_search", "remember"):
        assert _refused(await td.dispatch_tool(name, {}, _ctx(thread_id=tid, pool=object())), name)
    assert read.await_count == 1


@pytest.mark.asyncio
async def test_an_in_app_thread_is_cached_too(recorders, monkeypatch):
    read = AsyncMock(return_value=None)
    monkeypatch.setattr(ors, "_read_origin_kind", read)
    tid = str(uuid.uuid4())
    for _ in range(3):
        await td.dispatch_tool("execute_code", {}, _ctx(thread_id=tid, pool=object()))
    assert recorders.calls == ["execute_code"] * 3
    assert read.await_count == 1


@pytest.mark.asyncio
async def test_a_key_origin_thread_is_not_restricted(recorders, monkeypatch):
    """293 key-run threads ('key') keep the in-app tool set; only 'mcp' is closed."""
    monkeypatch.setattr(ors, "_read_origin_kind", AsyncMock(return_value="key"))
    result = await td.dispatch_tool("execute_code", {}, _ctx(pool=object()))
    assert result is recorders.results["execute_code"]


@pytest.mark.asyncio
async def test_a_read_error_refuses_and_is_not_cached(recorders, monkeypatch):
    read = AsyncMock(side_effect=[RuntimeError("pool closed"), None])
    monkeypatch.setattr(ors, "_read_origin_kind", read)
    tid = str(uuid.uuid4())
    first = await td.dispatch_tool("execute_code", {}, _ctx(thread_id=tid, pool=object()))
    assert _refused(first, "execute_code")
    assert tid not in ors._origin_is_mcp
    second = await td.dispatch_tool("execute_code", {}, _ctx(thread_id=tid, pool=object()))
    assert second is recorders.results["execute_code"]
    assert read.await_count == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("pool,thread_id", [(None, str(uuid.uuid4())), (object(), "test-thread")])
async def test_no_pool_or_a_non_uuid_thread_is_a_no_op(recorders, monkeypatch, pool, thread_id):
    read = AsyncMock(return_value="mcp")
    monkeypatch.setattr(ors, "_read_origin_kind", read)
    result = await td.dispatch_tool("execute_code", {}, _ctx(thread_id=thread_id, pool=pool))
    assert result is recorders.results["execute_code"]
    read.assert_not_awaited()


@pytest.mark.asyncio
async def test_the_cache_is_bounded(monkeypatch):
    monkeypatch.setattr(ors, "_ORIGIN_CACHE_MAX", 3)
    monkeypatch.setattr(ors, "_read_origin_kind", AsyncMock(return_value=None))
    for _ in range(7):
        await ors.outside_allowlist_for(_ctx(pool=object()), "execute_code")
        assert len(ors._origin_is_mcp) <= 3


@pytest.mark.asyncio
async def test_the_real_read_asks_for_the_frozen_origin_column():
    class _Pool:
        def __init__(self):
            self.calls = []

        async def fetchval(self, sql, *args):
            self.calls.append((sql, args))
            return "mcp"

    pool = _Pool()
    tid = str(uuid.uuid4())
    assert await ors.outside_allowlist_for(_ctx(thread_id=tid, pool=pool), "execute_code") == SIX
    (sql, args), = pool.calls
    assert "origin_kind" in sql and "public.threads" in sql
    assert args == (uuid.UUID(tid),)


# ── the registry and the comment ──────────────────────────────────────────────────────────────


def test_the_registry_is_unchanged():
    assert len(td._TOOL_REGISTRY) == 30


def test_the_owed_comment_names_the_outside_run_arm():
    from pathlib import Path

    src = Path(td.__file__).read_text(encoding="utf-8")
    assert "OWED, NOT BUILT" not in src
    assert "SEED-303 stays partially-answered" in src
