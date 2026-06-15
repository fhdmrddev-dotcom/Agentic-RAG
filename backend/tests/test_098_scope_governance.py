"""Phase 098 — server-side KB scope governance (GOV-01 + PROJ-02).

This is the cross-plan TDD contract for the scope-governance behavior.

  GREEN from THIS plan (Plan 03):
    - test_narrow_only_reject  — scope.assert_folder_scopes_subset raises on a
      phase folder_scope that is NOT ⊆ the project subtree (D-07 DB half).
    - test_per_phase_narrowing — phase_types._build_phase_tool_context narrows the
      resolved project subtree by the phase folder_scope (∩, narrow-only; PROJ-02).
    - test_deep_noop           — _handle_search_documents emits NO scope_violation
      when folder_subtree_ids is None (Deep whole-KB is byte-identical; D-05a) —
      and MUST stay green after Plan 05.

  RED-by-design until Plans 04 and 05 land (cross-plan TDD); they assert the TARGET
  behavior and are marked xfail so the full suite stays exit-0 in the interim:
    - test_run_start_resolution — run-start sources scope from
      definition.project_folder_id (not the thread folder). GREEN once Plan 04
      wires resolve_project_subtree into the resume/Continue/kickoff ctx-build sites.
    - test_clip_and_emit        — an injected out-of-scope retrieval row is clipped
      AND a scope_violation event is XADDed to run:{run_id}. GREEN once Plan 05
      adds the gated ⊆ clip + emit to _handle_search_documents.

Offline only — fakes (conftest `_FakeRedis` / `make_tool_context` / `mock_asyncpg_pool`),
no live Redis/Postgres. Analog: test_harness_whitelist.py (Deep-no-op + fire-and-forget
spawn capture) + the conftest XADD recorder.
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.api.threads import _emit
from app.models.harness import WorkflowDefinition
from app.services.harness import scope as scope_mod
from app.services.harness.scope import assert_folder_scopes_subset
from app.services.harness.phase_types import _build_phase_tool_context
import app.services.tool_dispatcher as td
from app.services.tool_dispatcher import _handle_search_documents


def _close_spawn(coro, *a, **k):
    """Discard the fire-and-forget audit coro cleanly (mirror test_harness_whitelist)."""
    try:
        coro.close()
    except (AttributeError, RuntimeError):
        pass


def _phase(folder_scope):
    """A minimal llm_agent-shaped phase namespace for _build_phase_tool_context."""
    return SimpleNamespace(
        config=SimpleNamespace(
            folder_scope=folder_scope,
            available_tools=["search_documents"],
            model=None,
        )
    )


def _harness_ctx(folder_subtree_ids):
    """A minimal harness ctx bag (producer_run_id is REQUIRED — the seam raises without it)."""
    return SimpleNamespace(
        producer_run_id=uuid4(),
        run_id=uuid4(),
        folder_subtree_ids=folder_subtree_ids,
        model="m",
    )


# ── GREEN from this plan ──────────────────────────────────────────────────────
async def test_narrow_only_reject(monkeypatch):
    """assert_folder_scopes_subset raises when a phase folder_scope ⊄ project subtree (D-07)."""
    A = str(uuid4())
    child = str(uuid4())
    X = str(uuid4())  # X is NOT in the subtree

    async def _fake_resolve(project_folder_id, *, supabase, user_id):
        return [A, child]

    # assert_folder_scopes_subset looks up resolve_project_subtree as a module global.
    monkeypatch.setattr(scope_mod, "resolve_project_subtree", _fake_resolve)

    definition = WorkflowDefinition.model_validate(
        {
            "slug": "wf",
            "version": 1,
            "name": "WF",
            "project_folder_id": A,
            "phases": [
                {
                    "slug": "p1",
                    "phase_index": 0,
                    "config": {
                        "phase_type": "llm_agent",
                        "prompt": "x",
                        "available_tools": ["search_documents"],
                        "folder_scope": [X],
                    },
                }
            ],
        }
    )

    with pytest.raises(ValueError, match="is not a subset"):
        await assert_folder_scopes_subset(definition, supabase=object(), user_id="u")


def test_per_phase_narrowing():
    """_build_phase_tool_context narrows the project subtree by the phase folder_scope (∩)."""
    # subtree [A,B,C] narrowed by phase scope [B] → [B] (a list, not a set — Pitfall 1)
    tc = _build_phase_tool_context(_phase(["B"]), _harness_ctx(["A", "B", "C"]))
    assert tc.folder_subtree_ids == ["B"]
    assert isinstance(tc.folder_subtree_ids, list)

    # phase folder_scope None → project subtree unchanged
    tc2 = _build_phase_tool_context(_phase(None), _harness_ctx(["A", "B", "C"]))
    assert tc2.folder_subtree_ids == ["A", "B", "C"]

    # project subtree None (unbound / Deep) → stays None (no narrowing)
    tc3 = _build_phase_tool_context(_phase(["B"]), _harness_ctx(None))
    assert tc3.folder_subtree_ids is None


async def test_deep_noop(make_tool_context, fake_redis, monkeypatch):
    """Deep path (folder_subtree_ids=None) emits NO scope_violation — byte-identical (D-05a).

    Stays green after Plan 05: the clip block is gated `if ctx.folder_subtree_ids is not None`.
    """

    async def _fake_search(*a, **k):
        return (
            [
                {"document_id": str(uuid4()), "filename": "a.md", "folder_id": "A", "content": "x", "similarity": 0.9},
                {"document_id": str(uuid4()), "filename": "z.md", "folder_id": "Z", "content": "y", "similarity": 0.8},
            ],
            0.85,
        )

    monkeypatch.setattr(td, "search_documents", _fake_search)
    ctx = make_tool_context(folder_subtree_ids=None, emit=_emit, spawn=_close_spawn)

    await _handle_search_documents({"query": "q"}, ctx)

    emitted = [json.loads(f["data"]) for _s, f in fake_redis.xadds if "data" in f]
    assert not any(p.get("type") == "scope_violation" for p in emitted)


# ── Cross-plan governance guards (Plans 04/05 shipped — now GREEN, active regression protection) ──
async def test_run_start_resolution(fake_redis, mock_asyncpg_pool, monkeypatch):
    # RED until Plan 04 — run-start MUST source scope from definition.project_folder_id
    # (not the thread folder). Drives the resume resolution helper (_build_resume_context);
    # today it hard-codes folder_subtree_ids=None (the GOV-01 resume-bypass gap).
    import app.services.harness_engine as he

    A = str(uuid4())

    async def _fake_resolve(project_folder_id, *, supabase, user_id):
        return [A]

    async def _fake_assert(definition, *, supabase, user_id):
        return None

    bound_def = WorkflowDefinition.model_validate(
        {
            "slug": "wf",
            "version": 1,
            "name": "WF",
            "project_folder_id": str(uuid4()),
            "phases": [{"slug": "p", "phase_index": 0, "config": {"phase_type": "llm_single", "prompt": "x"}}],
        }
    )

    async def _fake_load_def(pool, run_id):
        return bound_def

    # Patch the shared resolver at BOTH the source module and the (future) harness_engine
    # binding, so whichever import style Plan 04 uses is covered (raising=False — the
    # harness_engine names don't exist until Plan 04 imports them).
    monkeypatch.setattr("app.services.harness.scope.resolve_project_subtree", _fake_resolve, raising=False)
    monkeypatch.setattr("app.services.harness.scope.assert_folder_scopes_subset", _fake_assert, raising=False)
    monkeypatch.setattr(he, "resolve_project_subtree", _fake_resolve, raising=False)
    monkeypatch.setattr(he, "assert_folder_scopes_subset", _fake_assert, raising=False)
    monkeypatch.setattr(he, "_load_run_definition", _fake_load_def, raising=False)

    # Neutralize the producer-shell insert + service-role client + owner-settings load
    # (local imports inside _build_resume_context resolve these at call time).
    async def _noop_insert(*a, **k):
        return None

    monkeypatch.setattr("app.db.runs.insert_run", _noop_insert, raising=False)
    monkeypatch.setattr("app.dependencies.get_supabase", lambda: object(), raising=False)
    monkeypatch.setattr("app.models.user_settings.load_user_settings", lambda uid: None, raising=False)
    monkeypatch.setattr("app.services.sub_agent_models.resolve_workflow_ctx_model", lambda s: "", raising=False)

    run = {"run_id": uuid4(), "thread_id": str(uuid4()), "user_id": str(uuid4()), "inputs": {}}
    ctx = await he._build_resume_context(run, fake_redis, mock_asyncpg_pool)

    assert ctx.folder_subtree_ids == [A]  # RED now (None); GREEN once Plan 04 resolves from the binding


async def test_clip_and_emit(make_tool_context, fake_redis, monkeypatch):
    # RED until Plan 05 — INJECT an out-of-scope row (Pitfall 4: the RPC p_folder_ids
    # primary filter means a live run never naturally emits one). Target: the out-of-scope
    # row is clipped AND a scope_violation event lands on run:{run_id}.
    in_scope = {"document_id": str(uuid4()), "filename": "a.md", "folder_id": "A", "content": "x", "similarity": 0.9}
    out_scope = {"document_id": str(uuid4()), "filename": "z.md", "folder_id": "Z", "content": "y", "similarity": 0.8}

    async def _fake_search(*a, **k):
        return ([in_scope, out_scope], 0.85)

    monkeypatch.setattr(td, "search_documents", _fake_search)
    ctx = make_tool_context(folder_subtree_ids=["A"], emit=_emit, spawn=_close_spawn)

    result = await _handle_search_documents({"query": "q"}, ctx)

    returned_folders = {str(r.get("folder_id")) for r in json.loads(result.result)}
    assert "Z" not in returned_folders  # out-of-scope row dropped
    assert "A" in returned_folders

    emitted = [(s, json.loads(f["data"])) for s, f in fake_redis.xadds if "data" in f]
    assert any(
        s == f"run:{ctx.run_id}" and p.get("type") == "scope_violation" for s, p in emitted
    )


# ── secure-phase 098 hardening guards ─────────────────────────────────────────
async def test_resolve_project_subtree_cycle_guard(monkeypatch):
    """IN-01 (098 secure-phase): a cyclic / self-parented folder hierarchy resolves
    without a RecursionError. The _walk visited-set guard makes the subtree finite and
    de-duplicated even when the folder rows form a parent_id cycle (corrupt/legacy data
    the UI normally prevents). The Deep copy in agent_loop.py is the RED LINE and is
    intentionally NOT covered here — only the shared resolver is hardened."""
    A = str(uuid4())
    B = str(uuid4())
    C = str(uuid4())

    # A↔B is a 2-cycle (A's parent is B, B's parent is A) and C is a self-parent
    # under B — both would recurse unbounded without the seen-set guard.
    cyclic = [
        {"id": A, "parent_id": B},
        {"id": B, "parent_id": A},
        {"id": C, "parent_id": C},  # self-parent
        {"id": C, "parent_id": B},  # ...also a child of B
    ]

    async def _fake_fetch(supabase, user_id):
        return cyclic

    monkeypatch.setattr(scope_mod, "fetch_visible_folders", _fake_fetch)

    out = await scope_mod.resolve_project_subtree(A, supabase=object(), user_id="u")

    assert out is not None
    assert isinstance(out, list)  # Pitfall 1: never a set
    assert A in out  # root always included
    assert len(out) == len(set(out))  # de-duplicated despite the cycle (no infinite walk)
