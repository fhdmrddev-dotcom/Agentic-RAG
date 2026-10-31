"""Phase 306-03 (D-30 / D-28 / D-02 / D-33) — an outside ask, live, across two orgs.

The REAL ask path against the local stack: ``outside_ask.ask_scope`` on the acting connection,
``resolve_ask_model``, ``start_ask`` (thread + message + runs row + the REAL ``run_producer`` and
``run_agent_loop`` in a fresh context under ``acting_org_scope``), ``wait_for_ask`` and ``read_ask``.
Only the model is scripted, at the provider gateway (``provider_gateway.open_stream``) — the way
the 267 / 292.1 loop harnesses do it, never by editing ``agent_loop.py``. The query embedder is
the 304 world's stub (``patch_search``), so no provider is called.

The world (``phase304_fixtures.world``): U is a plain member of X and Y. Four of its documents get
a UNIQUE token in their text and a chunk on a fourth embedding axis:

  · ``T_IN``   — ``f2_doc``, in X folder F2 (in every scope here: the non-vacuity witness);
  · ``T_OUT``  — ``f_doc``, in X folder F (outside the narrowed key, which ticks only F2);
  · ``T_ROOT`` — ``root_x``, in X with no folder (outside every ask, D-30);
  · ``T_Y``    — ``fy_doc``, in org Y (the member's OTHER org: never answers an X key).

A scripted model drives every allow-listed tool at those tokens and ids, then answers. No tool
result contains a token the key may not read, and the in-scope token IS found. A second script asks
for power tools and a connector tool: each is refused and nothing is written. A third hits the
round cap: ``read_ask`` reads ``needs_input`` while ``runs.status`` is ``completed``, and a later
in-app dispatch on that thread (ContextVar unset) is still refused for a power tool (D-28).

Run with ``-rs``: a skip is NOT RUN, never a pass. ⛔ No statement runs as the ``anon`` role
(BUG-261031-01). Every row this suite creates is deleted in teardown.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import UUID

import pytest
import pytest_asyncio

from app.services import agent_loop as _loop_mod
from app.services import inbound_inputs, outside_ask as oa
from app.services import outside_run_scope as ors
from app.services import tool_dispatcher as td
from app.services.openai_service import CallingMode
from app.services.outside_run_scope import ASK_TOOL_ALLOWLIST
from app.services.tools.base import ToolContext, ToolResult
from tests.integration._271_gotrue_users import _admin
from tests.integration._rls_harness import requires_pg
from tests.integration.phase304_fixtures import (  # noqa: F401 — `world` is a fixture
    patch_search,
    world,
)

pytestmark = requires_pg

ANSWER = "Here is what the documents say."
POWER = ("execute_code", "web_search", "remember", "save_skill", "gmail__send_message")


# ── the scripted model ────────────────────────────────────────────────────────────────────────


class _Stream:
    def __init__(self, events):
        self._events = list(events)

    def __iter__(self):
        return iter(self._events)

    def close(self):
        pass


def _calls(calls: list[tuple[str, dict]]) -> list[dict]:
    out: list[dict] = []
    for idx, (name, args) in enumerate(calls):
        a = json.dumps(args)
        out += [
            {"type": "tool_preparing", "index": idx, "id": f"call_{idx}", "name": name},
            {"type": "tool_args_progress", "tool_index": idx, "name": name, "args_so_far": a,
             "total_args_bytes_so_far": len(a), "code_so_far": a, "emit_sse": False},
        ]
    return out + [{"type": "finish", "finish_reason": "tool_calls"}]


def _text(text: str) -> list[dict]:
    return [{"type": "delta", "content": text}, {"type": "finish", "finish_reason": "stop"}]


class _Script:
    """Replaces ``provider_gateway.open_stream``; records every request the loop sends."""

    def __init__(self, rounds: list[list[dict]], *, repeat_last: bool = False):
        self.rounds = list(rounds)
        self.repeat_last = repeat_last
        self.requests: list = []

    async def __call__(self, _provider, request):
        self.requests.append(request)
        if len(self.rounds) > 1 or not self.repeat_last:
            events = self.rounds.pop(0) if self.rounds else _text(ANSWER)
        else:
            events = self.rounds[0]
        return _Stream(events), CallingMode.NATIVE


# ── the ask world ─────────────────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def ask(world, monkeypatch, redis_client):
    """The 304 world plus four unique-token documents, the local service client, and a spy on
    every dispatch. Tears down every thread / run / message U owns."""
    w = world
    patch_search(monkeypatch, w)
    started_at = datetime.now(timezone.utc)
    tokens = {
        "T_IN": ("f2_doc", f"zin{uuid.uuid4().hex[:10]}"),
        "T_OUT": ("f_doc", f"zout{uuid.uuid4().hex[:10]}"),
        "T_ROOT": ("root_x", f"zroot{uuid.uuid4().hex[:10]}"),
        "T_Y": ("fy_doc", f"zyy{uuid.uuid4().hex[:10]}"),
    }
    for label, token in tokens.values():
        org = w.y if label == "fy_doc" else w.x
        vec = ["0"] * w.dim
        vec[2] = "1"  # patch_search embeds any text without the world's org tokens on axis 2
        await w.pool.execute(
            "INSERT INTO public.document_chunks (document_id, user_id, org_id, content, chunk_index,"
            " embedding, embedding_model) VALUES ($1, $2, $3, $4, 7, $5::text::public.vector, $6)",
            UUID(w.docs[label]), UUID(w.u), UUID(org), f"{token} {token} reference passage",
            "[" + ",".join(vec) + "]", w.model,
        )
        await w.pool.execute(
            "UPDATE public.documents SET full_markdown = $2 WHERE id = $1",
            UUID(w.docs[label]), f"# Notes\n\n{token} reference passage\n",
        )

    monkeypatch.setattr(oa, "get_service_role_supabase", lambda org_id: _admin())
    monkeypatch.setattr(oa, "maybe_autotitle_thread", _no_title)
    monkeypatch.setattr("app.services.suggestion_service.generate_suggestions", lambda *a, **k: ([], None))

    dispatched: list[tuple[str, dict, str]] = []
    real_dispatch = _loop_mod.dispatch_tool

    async def _spy(name, args, ctx):
        result = await real_dispatch(name, args, ctx)
        dispatched.append((name, args, result.result))
        return result

    monkeypatch.setattr(_loop_mod, "dispatch_tool", _spy)
    ors._origin_is_mcp.clear()
    state = SimpleNamespace(
        w=w, tokens={k: v[1] for k, v in tokens.items()}, docs=w.docs, dispatched=dispatched,
        redis=redis_client, started_at=started_at,
    )
    try:
        yield state
    finally:
        ors._origin_is_mcp.clear()
        u = UUID(w.u)
        for sql in (
            "DELETE FROM public.messages WHERE user_id = $1",
            "DELETE FROM public.runs WHERE user_id = $1",
            "DELETE FROM public.threads WHERE user_id = $1",
            "DELETE FROM public.document_chunks WHERE user_id = $1 AND chunk_index = 7",
        ):
            try:
                await w.pool.execute(sql, u)
            except Exception:  # noqa: BLE001 — teardown is best-effort; world cleanup follows
                pass


async def _no_title(**_kw):
    return None


async def _run_ask(state, monkeypatch, principal, script: _Script, *, question="What do the notes say?",
                   cap: int | None = None):
    monkeypatch.setattr("app.services.provider_gateway.open_stream", script)
    scope = await oa.ask_scope(principal)
    assert not isinstance(scope, oa.AskScopeRefusal), scope
    envelope = inbound_inputs.wrap_untrusted_input(
        "question", question, source="mcp", notice=inbound_inputs.ASK_NOTICE
    )
    model = await oa.resolve_ask_model(principal, envelope)
    if cap is not None:
        model = oa.AskModel(
            model.settings.model_copy(update={"chat_max_tool_rounds": cap}),
            model.model, model.provider, model.body, model.notice,
        )
    started = await oa.start_ask(
        principal, question=question, envelope=envelope, scope_folder_ids=scope,
        ask_model=model, redis=state.redis,
    )
    loop = asyncio.get_running_loop()
    assert await oa.wait_for_ask(started, deadline=loop.time() + 90), "the ask did not finish"
    await started.task
    read = await oa.read_ask(state.w.pool, run_id=started.run_id, principal=principal)
    return started, envelope, scope, read


_ECHO_KEYS = ("pattern", "query")  # a tool result repeats the caller's own argument back


def _scrub(result: str) -> str:
    """A result without the echo of its own arguments (grep / search repeat the pattern / query),
    so a token the MODEL sent never reads as a token the knowledge base returned."""
    try:
        data = json.loads(result)
    except (TypeError, ValueError):
        return result
    if isinstance(data, dict):
        data = {k: v for k, v in data.items() if k not in _ECHO_KEYS}
    return json.dumps(data)


def _results_text(state) -> str:
    return "\n".join(_scrub(r) for _n, _a, r in state.dispatched)


def _tool_text(state, name: str, arg: str, value: str) -> str:
    return "\n".join(_scrub(r) for n, a, r in state.dispatched if n == name and a.get(arg) == value)


def _grep_hits(state, token: str) -> int:
    hits = [json.loads(r) for n, a, r in state.dispatched if n == "grep" and a.get("pattern") == token]
    assert hits, f"grep was never called for {token}"
    return sum(len(h.get("matches") or []) for h in hits)


def _read_tool_script(state) -> _Script:
    t, d = state.tokens, state.docs
    calls = [("search_documents", {"query": t[k]}) for k in ("T_IN", "T_OUT", "T_ROOT", "T_Y")]
    calls += [("grep", {"pattern": t[k]}) for k in ("T_IN", "T_OUT", "T_ROOT", "T_Y")]
    calls += [("ls", {"path": "/"}), ("tree", {"path": "/"}), ("glob", {"pattern": "**/*"})]
    calls += [("read_document", {"document_id": d[k]}) for k in ("f2_doc", "f_doc", "root_x", "fy_doc")]
    return _Script([_calls(calls), _text(ANSWER)])


def _offered(script: _Script) -> set[str]:
    names: set[str] = set()
    for req in script.requests:
        assert req.tools is not None, "an ask must send a concrete (narrowed) tool list"
        names |= {t["function"]["name"] for t in req.tools}
    return names


# ── 1. the folder wall across two orgs, all-folders key ──────────────────────────────────────


async def test_an_all_folders_key_reads_only_its_org_and_its_folders(ask, monkeypatch):
    s = ask
    principal = await s.w.principal(include_external=True)
    script = _read_tool_script(s)
    started, envelope, scope, read = await _run_ask(s, monkeypatch, principal, script)

    # the advertised set, on the wire, is the allow-list (no connector schema)
    assert _offered(script) == set(ASK_TOOL_ALLOWLIST)
    assert not [n for n in _offered(script) if "__" in n]

    names = [n for n, _a, _r in s.dispatched]
    assert sorted(set(names)) == sorted(ASK_TOOL_ALLOWLIST), names
    text = _results_text(s)
    assert s.tokens["T_IN"] in text, "non-vacuity: the in-scope token must be found"
    assert s.tokens["T_OUT"] in text, "F is inside an all-folders key"
    assert s.tokens["T_Y"] not in text, "the member's other org answered an X key"
    assert s.tokens["T_ROOT"] not in text, "a document outside every folder answered an ask"
    for doc in ("fy_doc", "root_x"):
        reads = [json.loads(r) for n, a, r in s.dispatched if n == "read_document" and a["document_id"] == s.docs[doc]]
        assert reads and all("error" in r for r in reads), (doc, reads)
    # per tool, so no single tool carries the non-vacuity for the others
    assert s.tokens["T_IN"] in _tool_text(s, "search_documents", "query", s.tokens["T_IN"])
    assert _grep_hits(s, s.tokens["T_IN"]) > 0 and _grep_hits(s, s.tokens["T_OUT"]) > 0
    assert _grep_hits(s, s.tokens["T_Y"]) == 0 and _grep_hits(s, s.tokens["T_ROOT"]) == 0
    assert s.tokens["T_IN"] in _tool_text(s, "read_document", "document_id", s.docs["f2_doc"])

    assert read.status == "answered" and read.answer == ANSWER
    for token in (s.tokens["T_Y"], s.tokens["T_ROOT"]):
        assert token not in (read.answer or "")

    # the rows
    thread = await s.w.pool.fetchrow(
        "SELECT org_id, user_id, origin_kind, origin_label, origin_ref, title FROM public.threads WHERE id = $1",
        started.thread_id,
    )
    assert str(thread["org_id"]) == s.w.x and str(thread["user_id"]) == s.w.u
    assert thread["origin_kind"] == "mcp"
    assert thread["origin_label"] == principal.label
    assert str(thread["origin_ref"]) == str(principal.key_id)
    first = await s.w.pool.fetchrow(
        "SELECT content, org_id FROM public.messages WHERE thread_id = $1 AND role = 'user' ORDER BY created_at LIMIT 1",
        started.thread_id,
    )
    assert first["content"] == envelope and str(first["org_id"]) == s.w.x
    run = await s.w.pool.fetchrow("SELECT org_id, user_id, status FROM public.runs WHERE run_id = $1", started.run_id)
    assert str(run["org_id"]) == s.w.x and str(run["user_id"]) == s.w.u and run["status"] == "completed"
    assert s.w.x != s.w.y and set(scope) and s.w.fy not in scope


# ── 2. a narrowed key ─────────────────────────────────────────────────────────────────────────


async def test_a_narrowed_key_reads_only_its_ticked_subtree(ask, monkeypatch):
    s = ask
    principal = await s.w.principal(include_external=True, folder_ids=(s.w.f2,))
    script = _read_tool_script(s)
    _started, _env, scope, read = await _run_ask(s, monkeypatch, principal, script)
    assert set(scope) == {s.w.f2}
    text = _results_text(s)
    assert s.tokens["T_IN"] in text, "non-vacuity: the ticked folder's token must be found"
    for k in ("T_OUT", "T_ROOT", "T_Y"):
        assert s.tokens[k] not in text, f"{k} leaked into a narrowed ask"
        assert s.tokens[k] not in (read.answer or "")
    for doc in ("f_doc", "fy_doc", "root_x"):
        reads = [json.loads(r) for n, a, r in s.dispatched if n == "read_document" and a["document_id"] == s.docs[doc]]
        assert reads and all("error" in r for r in reads), (doc, reads)
    assert s.tokens["T_IN"] in _tool_text(s, "search_documents", "query", s.tokens["T_IN"])
    assert _grep_hits(s, s.tokens["T_IN"]) > 0
    for k in ("T_OUT", "T_ROOT", "T_Y"):
        assert _grep_hits(s, s.tokens[k]) == 0, k


# ── 3. power tools and a connector tool: refused, no side effect ─────────────────────────────


async def test_power_and_connector_tools_are_refused_with_no_side_effect(ask, monkeypatch):
    s = ask
    entry_points: list[str] = []

    def _spy_handler(name):
        async def _h(_args, _ctx):
            entry_points.append(name)
            return ToolResult(result="RAN")
        return _h

    for name in ("execute_code", "web_search", "remember", "save_skill"):
        monkeypatch.setitem(td._TOOL_REGISTRY, name, _spy_handler(name))

    async def _connector(service_id, action, _args, _ctx):
        entry_points.append(f"{service_id}__{action}")
        return ToolResult(result="RAN")

    monkeypatch.setattr(td, "_handle_connector_chat_tool", _connector)
    principal = await s.w.principal(include_external=True)
    script = _Script([_calls([
        ("execute_code", {"code": "print(1)"}),
        ("web_search", {"query": "news"}),
        ("remember", {"content": "the user likes red"}),
        ("save_skill", {"name": "x", "description": "x", "instructions": "x"}),
        ("gmail__send_message", {"to": "a@example.com", "body": "hi"}),
    ]), _text(ANSWER)])
    _started, _env, _scope, read = await _run_ask(s, monkeypatch, principal, script)

    by_name = {n: json.loads(r) for n, _a, r in s.dispatched}
    assert set(by_name) == set(POWER)
    for name, payload in by_name.items():
        assert payload["error"] == "tool_not_available_for_outside_ask", (name, payload)
        assert payload["tool"] == name
    assert entry_points == []
    assert read.status == "answered"

    u = UUID(s.w.u)
    for table, owner in (("user_memory", "user_id"), ("skills", "user_id"), ("workspace_files", "created_by")):
        n = await s.w.pool.fetchval(
            f"SELECT count(*) FROM public.{table} WHERE {owner} = $1 AND created_at >= $2", u, s.started_at
        )
        assert n == 0, f"{table} gained {n} row(s) from a refused power tool"


# ── 4. the cap pause, and the durable closure on the paused thread (D-33 / D-28) ──────────────


async def test_a_cap_paused_ask_reads_needs_input_and_its_thread_stays_closed(ask, monkeypatch):
    s = ask
    principal = await s.w.principal(include_external=True)
    search = _calls([("search_documents", {"query": s.tokens["T_IN"]})])
    script = _Script([search], repeat_last=True)
    started, _env, _scope, read = await _run_ask(s, monkeypatch, principal, script, cap=2)

    run = await s.w.pool.fetchrow("SELECT status FROM public.runs WHERE run_id = $1", started.run_id)
    assert run["status"] == "completed", "a first-turn cap pause finalizes as completed by design"
    assert read.status == "needs_input", read
    assert read.chat_link.endswith(f"/app/chat/{started.thread_id}")

    # A member's in-app Continue / later turn: no ContextVar, phase_whitelist None, the real pool.
    assert ors.current_allowlist() is None
    ors._origin_is_mcp.clear()
    ran: list[str] = []

    async def _search(_args, _ctx):
        ran.append("search_documents")
        return ToolResult(result="SEARCHED")

    monkeypatch.setitem(td._TOOL_REGISTRY, "search_documents", _search)
    from app.dependencies import get_pg_pool

    ctx = ToolContext(
        redis=s.redis, run_id=uuid.uuid4(), thread_id=str(started.thread_id), supabase=_admin(),
        pool=await get_pg_pool(), user_settings=None, current_user={"id": s.w.u},
        folder_subtree_ids=None, scoped_folder_path=None, emit=None, spawn=lambda c: c.close(),
    )
    refused = json.loads((await td.dispatch_tool("execute_code", {"code": "print(1)"}, ctx)).result)
    assert refused["error"] == "tool_not_available_for_outside_ask"
    allowed = await td.dispatch_tool("search_documents", {"query": "x"}, ctx)
    assert allowed.result == "SEARCHED" and ran == ["search_documents"]


async def test_a_key_without_connected_app_documents_cannot_ask(ask):
    principal = await ask.w.principal(include_external=False)
    out = await oa.ask_scope(principal)
    assert isinstance(out, oa.AskScopeRefusal) and out.reason == "ask_needs_external"
