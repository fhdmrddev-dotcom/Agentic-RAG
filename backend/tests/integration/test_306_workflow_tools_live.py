"""Phase 306-05 (MCP-06; D-10..D-15 / D-28 / D-35; T-306-07 / -13 / -17 / -35) — the workflow tools,
live, through the real ``/mcp`` path.

A real minted key presented to ``register_mcp`` + ``mcp_lifespan`` (``phase305_mcp_client``), the
real dispatch pipeline and ``run_tools``, the real ``validate_key_start`` on the local DB, the real
``outside_admission`` on the local Redis, and the REAL ``unattended_launch`` drive — the harness
engine, the phase executor and its sub-agent. Only the model is scripted, at
``provider_gateway.open_stream`` (the 306-03 harness).

* ``run_workflow`` returns the run id in under two seconds while the drive is still running (D-11);
  the ``workflow_runs`` row carries ``origin_kind 'mcp'`` + this key, and so does its thread.
* ``get_workflow_run`` reads it for this key and refuses a second key (D-12 / T-306-07).
* D-28 regression guard (T-306-35): an agent phase whose tool (``workspace_write``) is NOT on the
  ask allow-list still runs it — the outside-run branch never touches a published workflow's phases.
* an input step waits on a person and reads the waiting sentence, never the question (D-13).
* maintenance refuses ``run_workflow`` and ``get_workflow_run`` keeps answering (D-14 / T-306-17).
* the lease comes back when the drive ends (``ZCARD`` back to 0, D-35).

Run with ``-rs``: a skip is NOT RUN, never a pass. ⛔ No statement runs as the ``anon`` role
(BUG-261031-01). Every row this suite creates is deleted in teardown.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from types import SimpleNamespace
from uuid import UUID

import pytest
import pytest_asyncio

from app.mcp import run_tools
from app.services import outside_admission as adm
from app.services import unattended_launch
from tests.integration._rls_harness import requires_pg
from tests.integration.phase304_fixtures import world  # noqa: F401 — a fixture
from tests.integration.phase305_mcp_client import mcp_session
from tests.integration.test_306_ask_live import _calls, _Script, _text, ask  # noqa: F401 — `ask` is a fixture

pytestmark = requires_pg

READ3 = ("search_knowledge_base", "list_documents", "read_document")
RUN3 = ("list_workflows", "run_workflow", "get_workflow_run")
NOTE = "The notes, written by the phase."


def _definition(slug: str, name: str, phases: list[dict], *, folder: str) -> dict:
    return {"slug": slug, "version": 1, "name": name, "status": "published", "phases": phases,
            "project_folder_id": folder}


def _agent_phase(folder: str) -> dict:
    return {"slug": "write", "phase_index": 0, "name": "Write the notes",
            "config": {"phase_type": "llm_agent", "prompt": "Write the notes file with workspace_write.",
                       "available_tools": ["workspace_write"], "folder_scope": [folder]}}


def _input_phase() -> dict:
    return {"slug": "tone", "phase_index": 0, "name": "Pick a tone",
            "config": {"phase_type": "llm_human_input", "prompt": "Which tone should the brief use?",
                       "timeout_seconds": 120}}


@pytest_asyncio.fixture
async def wf(ask, monkeypatch):
    """The 306-03 ask world plus two published workflows in X, bound to F2."""
    s = ask
    w = s.w
    defs = {
        "agent": _definition(f"p306-05-agent-{uuid.uuid4().hex[:6]}", "306-05 agent",
                             [_agent_phase(w.f2)], folder=w.f2),
        "input": _definition(f"p306-05-input-{uuid.uuid4().hex[:6]}", "306-05 input",
                             [_input_phase()], folder=w.f2),
    }
    ids = {}
    for label, d in defs.items():
        ids[label] = str(await w.pool.fetchval(
            "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status, definition)"
            " VALUES ($1, $2, $3, $4, 'published', $5::text::jsonb) RETURNING id",
            d["slug"], d["name"], UUID(w.u), UUID(w.x), json.dumps(d),
        ))
    # The local org's plan is not what this suite measures; the entitlement check is 258's.
    from app.services import entitlement_service

    async def _entitled(pool, org_id, capability):
        return None

    monkeypatch.setattr(entitlement_service, "enforce_entitlement", _entitled)
    monkeypatch.setattr(run_tools, "get_redis", lambda: s.redis)
    state = SimpleNamespace(s=s, w=w, ids=ids)
    try:
        yield state
    finally:
        for task in list(unattended_launch._BACKGROUND_TASKS):
            task.cancel()
        if unattended_launch._BACKGROUND_TASKS:
            await asyncio.wait(set(unattended_launch._BACKGROUND_TASKS), timeout=30)
        u = UUID(w.u)
        for sql in (
            "DELETE FROM public.harness_audit WHERE run_id IN (SELECT id FROM public.workflow_runs WHERE user_id = $1)",
            "DELETE FROM public.workflow_phases WHERE workflow_run_id IN"
            " (SELECT id FROM public.workflow_runs WHERE user_id = $1)",
            "UPDATE public.threads SET active_workflow_run_id = NULL WHERE user_id = $1",
            "DELETE FROM public.workflow_runs WHERE user_id = $1",
            "DELETE FROM public.workspace_files WHERE thread_id IN (SELECT id FROM public.threads WHERE user_id = $1)",
        ):
            try:
                await w.pool.execute(sql, u)
            except Exception:  # noqa: BLE001 — teardown is best-effort; the world cleanup follows
                pass


async def _mint(state, *, folders=None) -> str:
    return await state.w.mint(tools=READ3 + RUN3, include_external=True, folder_ids=folders)


async def _wait_status(state, run_id: str, want: set[str], timeout: float = 90) -> str:
    loop = asyncio.get_running_loop()
    end = loop.time() + timeout
    status = None
    while loop.time() < end:
        status = await state.w.pool.fetchval("SELECT status FROM public.workflow_runs WHERE id = $1", UUID(run_id))
        if status in want:
            return status
        await asyncio.sleep(0.3)
    raise AssertionError(f"run {run_id} never reached {want}; last {status}")


async def _leases(state, key_id) -> int:
    """The key's own lease set (outside_admission: ``{adm}:cred:<key>``)."""
    return int(await state.s.redis.zcard("{adm}:cred:" + str(key_id)))


# ── 1. starts at once, stamped mcp, readable by this key only; D-28 guard ────────────────────


async def test_run_workflow_returns_at_once_and_the_phase_tool_still_runs(wf, monkeypatch):
    gate = asyncio.Event()

    class _Gated(_Script):
        async def __call__(self, provider, request):
            await gate.wait()
            return await super().__call__(provider, request)

    script = _Gated([
        _calls([("workspace_write", {"path": "notes.md", "content": NOTE})]),
        _text("Wrote notes.md."),
    ])
    monkeypatch.setattr("app.services.provider_gateway.open_stream", script)
    secret, other = await _mint(wf, folders=(wf.w.f2,)), await _mint(wf)
    async with mcp_session(monkeypatch, secret) as mcp:
        assert [t["name"] for t in await mcp.list_tools()] == list(READ3 + RUN3)
        listed = await mcp.tool("list_workflows", {})
        assert not listed.is_error, listed.text
        ids = [w["workflow_id"] for w in listed.structured["workflows"]]
        assert wf.ids["agent"] in ids and wf.ids["input"] in ids

        loop = asyncio.get_running_loop()
        t = loop.time()
        started = await mcp.tool("run_workflow", {"workflow_id": wf.ids["agent"]})
        elapsed = loop.time() - t
        assert not started.is_error, started.text
        run_id = started.structured["run_id"]
        assert elapsed < 2, elapsed
        assert started.text.startswith(f"Started 306-05 agent. Run id: {run_id}. Check it with get_workflow_run.")
        assert started.structured["link"].endswith(f"/app/runs/{run_id}")
        # the drive is blocked on the gated model: the call came back while the run is running
        assert await wf.w.pool.fetchval("SELECT status FROM public.workflow_runs WHERE id = $1",
                                        UUID(run_id)) not in ("completed", "failed", "cancelled")
        row = await wf.w.pool.fetchrow(
            "SELECT r.origin_kind, r.origin_ref, r.org_id, t.origin_kind AS t_kind, t.origin_ref AS t_ref,"
            " t.origin_label AS t_label FROM public.workflow_runs r JOIN public.threads t ON t.id = r.thread_id"
            " WHERE r.id = $1", UUID(run_id))
        key_id = await wf.w.pool.fetchval(
            "SELECT id FROM public.api_keys WHERE user_id = $1 AND tools @> ARRAY['run_workflow']"
            " ORDER BY created_at LIMIT 1", UUID(wf.w.u))
        assert row["origin_kind"] == "mcp" and row["origin_ref"] == key_id
        assert row["t_kind"] == "mcp" and row["t_ref"] == key_id and row["t_label"]
        assert str(row["org_id"]) == wf.w.x
        assert await _leases(wf, key_id) == 1

        running = await mcp.tool("get_workflow_run", {"run_id": run_id})
        assert not running.is_error and running.text.startswith("Running"), running.text

        async with mcp_session(monkeypatch, other) as foreign:
            refused = await foreign.tool("get_workflow_run", {"run_id": run_id})
            assert refused.is_error and refused.text == run_tools.NO_RUN_SENTENCE
            garbage = await foreign.tool("get_workflow_run", {"run_id": str(uuid.uuid4())})
            assert garbage.text == refused.text

        gate.set()
        assert await _wait_status(wf, run_id, {"completed", "failed"}) == "completed"
        done = await mcp.tool("get_workflow_run", {"run_id": run_id})
        assert done.text.startswith("Completed."), done.text
        assert "notes.md" in done.text and "/inbound/files/" not in done.text
        assert done.text.rstrip().endswith(f"/app/runs/{run_id}")

    written = await wf.w.pool.fetchval(
        "SELECT count(*) FROM public.workspace_files f JOIN public.workflow_runs r ON r.thread_id = f.thread_id"
        " WHERE r.id = $1 AND f.path LIKE '%notes.md'", UUID(run_id))
    assert written == 1, "the phase's own tool (not on the ask allow-list) must have run (D-28)"
    for _ in range(50):
        if await _leases(wf, key_id) == 0:
            break
        await asyncio.sleep(0.2)
    assert await _leases(wf, key_id) == 0, "the lease must come back when the drive ends"


# ── 2. an input step: waiting on a person, never the question (D-13) ────────────────────────


async def test_an_input_step_reads_waiting_on_a_person(wf, monkeypatch):
    monkeypatch.setattr("app.services.provider_gateway.open_stream", _Script([_text("unused")]))
    secret = await _mint(wf)
    async with mcp_session(monkeypatch, secret) as mcp:
        started = await mcp.tool("run_workflow", {"workflow_id": wf.ids["input"]})
        assert not started.is_error, started.text
        run_id = started.structured["run_id"]
        text = ""
        for _ in range(100):
            read = await mcp.tool("get_workflow_run", {"run_id": run_id})
            text = read.text
            if text.startswith("Waiting on "):
                break
            await asyncio.sleep(0.3)
        assert text.startswith("Waiting on "), text
        assert text.endswith(f"It can only be answered in Syrel: {started.structured['link']}")
        assert "Which tone" not in text, "the question is answered in the app, never shown over MCP"


# ── 3. maintenance and the narrowed list (D-14 / D-10) ───────────────────────────────────────


async def test_maintenance_refuses_the_start_and_the_reads_keep_answering(wf, monkeypatch):
    import app.mcp.dispatch as dispatch_mod

    monkeypatch.setattr("app.services.provider_gateway.open_stream", _Script([_text("unused")]))
    secret = await _mint(wf)
    async with mcp_session(monkeypatch, secret) as mcp:
        monkeypatch.setattr(dispatch_mod._maintenance, "_read_maintenance", lambda: True)
        refused = await mcp.tool("run_workflow", {"workflow_id": wf.ids["agent"]})
        assert "error" in refused.body and dispatch_mod.MAINTENANCE_SENTENCE in json.dumps(refused.body)
        listed = await mcp.tool("list_workflows", {})
        assert not listed.is_error, listed.text
        read = await mcp.tool("get_workflow_run", {"run_id": str(uuid.uuid4())})
        assert read.text == run_tools.NO_RUN_SENTENCE
    n = await wf.w.pool.fetchval("SELECT count(*) FROM public.workflow_runs WHERE user_id = $1", UUID(wf.w.u))
    assert n == 0


async def test_a_key_narrowed_to_another_folder_neither_lists_nor_starts_it(wf, monkeypatch):
    monkeypatch.setattr("app.services.provider_gateway.open_stream", _Script([_text("unused")]))
    secret = await _mint(wf, folders=(wf.w.f,))
    async with mcp_session(monkeypatch, secret) as mcp:
        listed = await mcp.tool("list_workflows", {})
        ids = [w["workflow_id"] for w in (listed.structured or {}).get("workflows", [])]
        assert wf.ids["agent"] not in ids and wf.ids["input"] not in ids
        refused = await mcp.tool("run_workflow", {"workflow_id": wf.ids["agent"]})
        assert refused.is_error and refused.text == run_tools.NO_WORKFLOW_SENTENCE
    n = await wf.w.pool.fetchval("SELECT count(*) FROM public.workflow_runs WHERE user_id = $1", UUID(wf.w.u))
    assert n == 0
    assert adm.REASON  # the admission vocabulary is the shared one (imported, not retyped)
