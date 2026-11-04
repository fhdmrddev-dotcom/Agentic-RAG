"""Phase 306-04 (MCP-04; D-04 / D-05 / D-07 / D-16 / D-19 / D-29 / D-35 / D-36; T-306-07 / T-306-09 /
T-306-10) — ``ask_agent`` and ``get_answer``, live, through the real ``/mcp`` path.

A real minted key presented to ``register_mcp`` + ``mcp_lifespan`` (``phase305_mcp_client``), the
real dispatch pipeline, ``ask_tools``, ``outside_ask`` (thread + message + runs row + the REAL
``run_producer`` / ``run_agent_loop``) and ``outside_admission`` on the REAL local Redis. Only the
model is scripted, at ``provider_gateway.open_stream`` (the 306-03 harness), and the query embedder
is the 304 world's stub, so no provider is called.

The two outside-start knobs are read through ``load_app_settings_async``; this suite wraps that
reader in the two modules that read it (``ask_tools`` and ``outside_admission``) with the stored
row plus an override, so the SHARED ``app_settings`` row of the operator's local stack is never
written.

Run with ``-rs``: a skip is NOT RUN, never a pass. ⛔ No statement runs as the ``anon`` role
(BUG-261031-01). Every row this suite creates is deleted in teardown (the ``ask`` and ``world``
fixtures).
"""
from __future__ import annotations

import asyncio
from uuid import UUID

import pytest

from app.mcp import ask_tools
from app.models import user_settings as _us
from app.services import outside_admission as adm
from app.services import outside_ask as oa
from tests.integration._rls_harness import requires_pg
from tests.integration.phase304_fixtures import world  # noqa: F401 — a fixture
from tests.integration.phase305_mcp_client import mcp_session
from tests.integration.test_306_ask_live import (  # noqa: F401 — `ask` is a fixture
    ANSWER,
    _calls,
    _Script,
    _text,
    ask,
)

pytestmark = requires_pg

ASK_TOOLS = ("search_knowledge_base", "list_documents", "read_document", "ask_agent", "get_answer")


class _SlowScript(_Script):
    """The scripted model, sleeping before its FIRST round (a run still in flight)."""

    def __init__(self, rounds, *, delay: float):
        super().__init__(rounds)
        self.delay = delay

    async def __call__(self, provider, request):
        if self.delay:
            delay, self.delay = self.delay, 0
            await asyncio.sleep(delay)
        return await super().__call__(provider, request)


def _knobs(monkeypatch, **override):
    real = _us.load_app_settings_async

    async def _load():
        return (await real()).model_copy(update=override)

    monkeypatch.setattr(ask_tools, "load_app_settings_async", _load)
    monkeypatch.setattr(adm, "load_app_settings_async", _load)


def _wire(state, monkeypatch, script):
    monkeypatch.setattr("app.services.provider_gateway.open_stream", script)
    monkeypatch.setattr(ask_tools, "get_redis", lambda: state.redis)


def _search_then_answer(state) -> list:
    return [_calls([("search_documents", {"query": state.tokens["T_IN"]})]), _text(ANSWER)]


async def _mint(state, **kw) -> str:
    return await state.w.mint(tools=ASK_TOOLS, include_external=kw.pop("include_external", True), **kw)


async def _runs_for(state, run_id) -> int:
    thread_id = await state.w.pool.fetchval("SELECT thread_id FROM public.runs WHERE run_id = $1", UUID(run_id))
    return await state.w.pool.fetchval("SELECT count(*) FROM public.runs WHERE thread_id = $1", thread_id)


async def _audit(state) -> list[dict]:
    import json

    rows = await state.w.pool.fetch(
        "SELECT action_type, metadata FROM public.audit_log WHERE user_id = $1 AND action_type LIKE 'api_key.%'"
        " ORDER BY created_at",
        UUID(state.w.u),
    )
    out = []
    for r in rows:
        md = r["metadata"]
        out.append({"action_type": r["action_type"], "metadata": json.loads(md) if isinstance(md, str) else md})
    return out


async def _drain(run_id):
    """Wait for the run's producer so teardown never deletes rows under a live task."""
    from app.api.threads import RUN_TASKS

    task = RUN_TASKS.get(UUID(run_id))
    if task is not None:
        await asyncio.wait({task}, timeout=60)


# ── 1. an answer with a citation, once per idempotency key ───────────────────────────────────


async def test_ask_agent_answers_with_a_citation_and_one_run_per_idempotency_key(ask, monkeypatch):
    s = ask
    _wire(s, monkeypatch, _Script(_search_then_answer(s)))
    _knobs(monkeypatch, mcp_ask_wait_seconds=45)
    secret = await _mint(s)
    async with mcp_session(monkeypatch, secret) as mcp:
        names = [t["name"] for t in await mcp.list_tools()]
        assert names == list(ASK_TOOLS)
        first = await mcp.tool("ask_agent", {"question": "What do the notes say?", "idempotency_key": "q-1"})
        assert not first.is_error, first.text
        st = first.structured
        assert st["status"] == "answered", first.text
        assert st["answer"].startswith(ANSWER)
        links = [c["link"] for c in st["citations"]]
        assert links, "the answer must cite the in-scope document"
        assert all("/app/library/" in link for link in links)
        assert any(link.endswith("/app/library/" + s.docs["f2_doc"]) for link in links), links
        assert first.text.splitlines()[-1].startswith("Open this chat in Syrel: ")
        assert "/app/chat/" in first.text.splitlines()[-1]

        again = await mcp.tool("ask_agent", {"question": "What do the notes say?", "idempotency_key": "q-1"})
        assert again.structured["run_id"] == st["run_id"]
        assert await _runs_for(s, st["run_id"]) == 1

        other = await mcp.tool("ask_agent", {"question": "Something else?", "idempotency_key": "q-1"})
        assert other.structured["run_id"] == st["run_id"]
        assert other.text.startswith(
            "This idempotency key was already used for a different question; here is the first one.")
        assert await _runs_for(s, st["run_id"]) == 1

    answered = [r for r in await _audit(s)
                if r["action_type"] == "api_key.read" and r["metadata"].get("tool") == "ask_agent"]
    assert len(answered) == 3
    assert all(r["metadata"].get("run_id") == st["run_id"] for r in answered), answered


# ── 2. past the wait budget: a handle, then get_answer (and only for this key) ───────────────


async def test_past_the_budget_a_handle_then_get_answer_and_another_key_is_refused(ask, monkeypatch):
    s = ask
    _wire(s, monkeypatch, _SlowScript(_search_then_answer(s), delay=8))
    _knobs(monkeypatch, mcp_ask_wait_seconds=5)
    secret, other = await _mint(s), await _mint(s)
    async with mcp_session(monkeypatch, secret) as mcp:
        loop = asyncio.get_running_loop()
        t = loop.time()
        first = await mcp.tool("ask_agent", {"question": "What do the notes say?"})
        elapsed = loop.time() - t
        run_id = first.structured["run_id"]
        assert first.structured["status"] == "working", first.text
        assert first.text == f"Still working on it. Call get_answer with handle {run_id} in a few seconds."
        assert 4.5 <= elapsed < 8, elapsed

        async with mcp_session(monkeypatch, other) as foreign:
            refused = await foreign.tool("get_answer", {"handle": run_id})
            assert refused.is_error and refused.text == ask_tools.NO_HANDLE_SENTENCE
            garbage = await foreign.tool("get_answer", {"handle": "not-a-handle"})
            assert garbage.text == refused.text

        for _ in range(60):
            later = await mcp.tool("get_answer", {"handle": run_id})
            if later.structured and later.structured["status"] == "answered":
                break
            assert later.text.startswith("Still working on it."), later.text
            await asyncio.sleep(0.5)
        assert later.structured["status"] == "answered" and later.structured["answer"].startswith(ANSWER)
    await _drain(run_id)
    read = [r for r in await _audit(s) if r["action_type"] == "api_key.read" and r["metadata"].get("outcome") == "ok"]
    assert read and all(r["metadata"].get("run_id") == run_id for r in read)


# ── 3. admission per key (D-16 / D-35 / T-306-10) ────────────────────────────────────────────


async def test_a_second_concurrent_ask_on_a_one_slot_key_is_refused_and_audited(ask, monkeypatch):
    s = ask
    _wire(s, monkeypatch, _SlowScript(_search_then_answer(s), delay=6))
    _knobs(monkeypatch, mcp_ask_wait_seconds=30, outside_inflight_per_key=1)
    secret = await _mint(s)
    async with mcp_session(monkeypatch, secret) as mcp:
        async def second():
            await asyncio.sleep(2)
            return await mcp.tool("ask_agent", {"question": "And another thing?"})

        first, refused = await asyncio.gather(
            mcp.tool("ask_agent", {"question": "What do the notes say?"}), second())
        assert first.structured["status"] == "answered", first.text
        assert refused.is_error
        assert refused.text == adm.MCP_FULL_SENTENCE["credential"].format(retry=adm.ASK_RETRY_S)
        # the lease came back with the run: a third ask is admitted again
        third = await mcp.tool("ask_agent", {"question": "Once more?"})
        assert not third.is_error, third.text
        await _drain(third.structured["run_id"])
    rows = [r for r in await _audit(s) if r["action_type"] == "api_key.refused"]
    assert [r["metadata"]["reason"] for r in rows] == ["admission:credential"]
    assert rows[0]["metadata"]["tool"] == "ask_agent"


# ── 4. a key that leaves out connected-app documents (D-29) ──────────────────────────────────


async def test_a_key_without_connected_app_documents_gets_the_d29_sentence(ask, monkeypatch):
    s = ask
    script = _Script([_text(ANSWER)])
    _wire(s, monkeypatch, script)
    secret = await _mint(s, include_external=False)
    async with mcp_session(monkeypatch, secret) as mcp:
        out = await mcp.tool("ask_agent", {"question": "What do the notes say?"})
    assert out.is_error and out.text == oa.ASK_NEEDS_EXTERNAL_SENTENCE
    assert script.requests == [], "no run may start for a D-29 key"
    n = await s.w.pool.fetchval("SELECT count(*) FROM public.threads WHERE user_id = $1", UUID(s.w.u))
    assert n == 0
    rows = [r for r in await _audit(s) if r["action_type"] == "api_key.refused"]
    assert [r["metadata"]["reason"] for r in rows] == ["ask_needs_external"]
