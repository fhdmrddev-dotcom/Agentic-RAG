"""Unit and AST tests for Phase 260 Expert Chat Scoping (PACK-02, PACK-05, D-260-04, D-260-05).

Tests:
1. Thread Pydantic models (ThreadCreate, ThreadUpdate, ThreadResponse, ThreadSnapshotResponse) and active_expert_id.
2. PATCH endpoint handling of active_expert_id setting and clearing to None.
3. Pre-loop expert resolution via _resolve_thread_scoping populating RunContext with effective_folder_ids
   and (Phase 267) the ADDITIVE scoped_connection_keys / skill_catalog_additions — never a tool list.
4. Data-driven scoping in RunContext restricting folder subtrees (Phase 267: tools are never restricted).
5. AST closed-core invariant asserting zero "expert" branches or attributes inside agent_loop.py.
"""
from __future__ import annotations

import ast
import pathlib
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.models.thread import (
    ThreadCreate,
    ThreadResponse,
    ThreadSnapshotResponse,
    ThreadUpdate,
)
from app.services.agent_loop import RunContext
from app.services.expert_service import ResolvedExpertBundle
from app.services.run_producer import ThreadScoping, _resolve_thread_scoping

APP_DIR = pathlib.Path(__file__).resolve().parent.parent.parent / "app"


def test_thread_models_carry_active_expert_id():
    """PACK-02: ThreadCreate, ThreadUpdate, ThreadResponse, ThreadSnapshotResponse carry active_expert_id."""
    expert_id = uuid4()
    
    # Create
    tc = ThreadCreate(title="Test", active_expert_id=expert_id)
    assert tc.active_expert_id == expert_id
    tc_default = ThreadCreate()
    assert tc_default.active_expert_id is None

    # Update - set
    tu = ThreadUpdate(active_expert_id=expert_id)
    assert tu.active_expert_id == expert_id
    assert tu.clear_active_expert is False

    # Update - clear
    tu_clear = ThreadUpdate(clear_active_expert=True)
    assert tu_clear.clear_active_expert is True

    # Response
    tr = ThreadResponse(
        id=uuid4(),
        user_id=uuid4(),
        title="Chat",
        active_expert_id=expert_id,
        created_at="2026-09-20T00:00:00Z",
        updated_at="2026-09-20T00:00:00Z",
    )
    assert tr.active_expert_id == expert_id

    # Snapshot
    ts = ThreadSnapshotResponse(
        messages=[],
        active_runs=[],
        since_cursors={},
        active_expert_id=expert_id,
    )
    assert ts.active_expert_id == expert_id


@pytest.mark.asyncio
async def test_resolve_thread_scoping_no_expert():
    """PACK-02 / EXT-01: When thread has no active_expert_id, scoping returns all-None.

    Phase 264 (PACK-17 / D-264-03a): the tuple is five wide since the born-for carrier landed;
    the born-for field is the access-checked Expert bundle id and is None on the no-expert arm.
    Phase 267: the result is a ``ThreadScoping`` read by attribute; every field is still None.
    """
    mock_supabase = MagicMock()
    mock_query = MagicMock()
    mock_query.execute.return_value = MagicMock(data={"active_expert_id": None})
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = mock_query
    mock_pool = MagicMock()

    scoping = await _resolve_thread_scoping(
        supabase=mock_supabase,
        thread_id=str(uuid4()),
        current_user={"id": str(uuid4()), "org_id": str(uuid4())},
        pool=mock_pool,
    )
    born_for = scoping.born_for_bundle_id

    assert scoping == ThreadScoping(None, None, None, None, None)
    assert scoping.effective_folder_ids is None
    assert scoping.scoped_connection_keys is None
    assert scoping.skill_catalog_additions is None
    assert scoping.scoped_folder_path is None
    # Phase 264 (PACK-17 / D-264-03a) — the no-expert arm yields a None born-for
    # bundle id, so the carrier is a literal no-op on every Deep run.
    assert born_for is None


@pytest.mark.asyncio
async def test_resolve_thread_scoping_with_active_expert():
    """PACK-02 / D-260-05: When thread has active_expert_id, resolves bundle into RunContext data.

    Phase 267 RE-DRIVE: this used to assert a TOOL WHITELIST (`"search_documents" in tools`,
    `"load_skill" in tools`, the connection mixed in as `"github__read" in tools`) and the skills
    as a REPLACING override. The Expert now ADDS: its connection is an additive key, its skills an
    additive catalog, and there is no tool list to be "in" — the thread keeps every tool.
    """
    expert_id = uuid4()
    folder_id = uuid4()
    mock_supabase = MagicMock()
    mock_query = MagicMock()
    mock_query.execute.return_value = MagicMock(data={"active_expert_id": str(expert_id)})
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = mock_query
    mock_pool = MagicMock()

    resolved_bundle = ResolvedExpertBundle(
        bundle_id=expert_id,
        name="Financial Analyzer",
        slug="financial-analyzer",
        description="Analyze financial metrics",
        scope_mode="restricted",
        is_system=True,
        org_id=None,
        effective_skills=["financial_ratio_calculator"],
        effective_folder_ids=[folder_id],
        effective_connections=["github__read"],
        prompt_suggestions=[],
    )

    with patch("app.services.expert_service.resolve_expert_bundle", new_callable=AsyncMock) as mock_resolve:
        mock_resolve.return_value = resolved_bundle

        scoping = await _resolve_thread_scoping(
            supabase=mock_supabase,
            thread_id=str(uuid4()),
            current_user={"id": str(uuid4()), "org_id": str(uuid4())},
            pool=mock_pool,
        )

        # Phase 264 (PACK-17 / T-264-01) — the ACCESS-CHECKED ResolvedExpertBundle.bundle_id,
        # not the raw thread row's active_expert_id.
        assert scoping.born_for_bundle_id == expert_id
        assert scoping.effective_folder_ids == (str(folder_id),)
        assert not hasattr(scoping, "effective_tools")
        assert scoping.scoped_connection_keys == ("github__read",)
        assert scoping.skill_catalog_additions == ({"name": "financial_ratio_calculator", "description": "Expert member skill: financial_ratio_calculator"},)


def test_run_context_carries_scoping_data():
    """PACK-02: RunContext holds its scoping data as immutable tuples.

    Phase 267 RE-DRIVE: `effective_tools` (a tool whitelist) was replaced by the ADDITIVE
    `scoped_connection_keys` and `skill_catalog_additions`; the tool field no longer exists.
    """
    ctx = RunContext(
        run_id=uuid4(),
        thread_id=str(uuid4()),
        current_user={"id": str(uuid4())},
        user_settings=MagicMock(),
        body=MagicMock(),
        redis=MagicMock(),
        supabase=MagicMock(),
        resolved_model="gpt-4o",
        resolved_provider="openai",
        effective_folder_ids=("folder-1", "folder-2"),
        scoped_connection_keys=("hubspot",),
        skill_catalog_additions=({"name": "deal-review", "description": "d"},),
    )
    assert ctx.effective_folder_ids == ("folder-1", "folder-2")
    assert ctx.scoped_connection_keys == ("hubspot",)
    assert ctx.skill_catalog_additions == ({"name": "deal-review", "description": "d"},)
    assert not hasattr(ctx, "effective_tools")


def test_agent_loop_closed_core_ast_invariant():
    """PACK-01 / EXT-01 / D-260-05: Closed-Core Invariant.
    
    agent_loop.py MUST NOT contain any branching on 'expert' or attribute/name check containing 'expert'.
    The loop executes purely on data (effective_folder_ids, scoped_connection_keys, skill_catalog_additions).
    """
    loop_path = APP_DIR / "services" / "agent_loop.py"
    content = loop_path.read_text(encoding="utf-8")
    tree = ast.parse(content, filename=str(loop_path))

    for node in ast.walk(tree):
        # 1. No AST Name checking for 'expert'
        if isinstance(node, ast.Name):
            assert "expert" not in node.id.lower(), f"Forbidden AST Name '{node.id}' in agent_loop.py:{node.lineno}"
        
        # 2. No AST Attribute checking for 'expert'
        if isinstance(node, ast.Attribute):
            assert "expert" not in node.attr.lower(), f"Forbidden AST Attribute '{node.attr}' in agent_loop.py:{node.lineno}"

        # 3. No function or method defined in agent_loop mentioning 'expert'
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            assert "expert" not in node.name.lower(), f"Forbidden function name '{node.name}' in agent_loop.py:{node.lineno}"


@pytest.mark.asyncio
async def test_patch_thread_updates_and_clears_active_expert():
    """PACK-02 / D-260-01: PATCH /threads/{id} updates active_expert_id and clears to None."""
    from app.api.threads import rename_thread

    thread_id = str(uuid4())
    user_id = str(uuid4())
    expert_id = uuid4()
    current_user = {"id": user_id, "org_id": str(uuid4())}

    # Mock supabase client
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.update.return_value.eq.return_value.eq = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single = AsyncMock(
        return_value=MagicMock(data={"id": thread_id, "title": "Chat", "active_expert_id": str(expert_id)})
    )

    mock_request = MagicMock()

    # 1a. Phase 267 (D-267-31) — CONSCIOUSLY RETIRED EXPECTATION. This case used to assert that a
    # PATCH with NO validated active org SUCCEEDED (the fail-open skip: no entitlement check, no
    # access check). The shared binding gate now REFUSES it with a reason, and writes nothing.
    from fastapi import HTTPException
    with patch("app.api.threads.aexec", new_callable=AsyncMock) as mock_aexec, \
         patch("app.api.threads.resolve_active_org_or_none", new_callable=AsyncMock, return_value=None):
        with pytest.raises(HTTPException) as exc_info:
            await rename_thread(
                thread_id=thread_id,
                body=ThreadUpdate(active_expert_id=expert_id),
                request=mock_request,
                current_user=current_user,
                supabase=mock_supabase,
            )
        assert exc_info.value.status_code == 403
        assert exc_info.value.detail == "Choose an organization before inviting an Expert."
        mock_aexec.assert_not_awaited()

    # 1b. Update with active_expert_id, through the gate with a validated org.
    with patch("app.api.threads.aexec", new_callable=AsyncMock) as mock_aexec, \
         patch("app.api.threads.assert_expert_bindable", new_callable=AsyncMock,
               return_value=({"id": str(expert_id)}, current_user["org_id"])) as gate:
        # Phase 267 (D-267-09): the thread is read BEFORE the update (did the Expert change?), and
        # a changed Expert asks whether the thread has messages — 0 here, so no event is written
        # and the plain update below runs, exactly as before.
        mock_aexec.side_effect = [
            MagicMock(data={"active_expert_id": None, "folder_id": None, "org_id": current_user["org_id"]}), # before-read
            MagicMock(data=[]), # 267-REVIEW WR-04: no primary run streaming on this thread
            MagicMock(data=[], count=0), # user/assistant message count
            MagicMock(data=[]), # update
            MagicMock(data={"id": thread_id, "user_id": user_id, "title": "Chat", "active_expert_id": str(expert_id), "created_at": "2026-09-20T00:00:00Z", "updated_at": "2026-09-20T00:00:00Z"}), # select
        ]

        resp = await rename_thread(
            thread_id=thread_id,
            body=ThreadUpdate(active_expert_id=expert_id),
            request=mock_request,
            current_user=current_user,
            supabase=mock_supabase,
        )
        assert resp["active_expert_id"] == str(expert_id)
        gate.assert_awaited_once()

    # 2. Clear with clear_active_expert=True
    with patch("app.api.threads.aexec", new_callable=AsyncMock) as mock_aexec, \
         patch("app.api.threads.resolve_active_org_or_none", new_callable=AsyncMock, return_value=None):
        mock_aexec.side_effect = [
            MagicMock(data={"active_expert_id": str(expert_id), "folder_id": None, "org_id": current_user["org_id"]}), # before-read (Phase 267)
            MagicMock(data=[]), # 267-REVIEW WR-04: no primary run streaming on this thread
            MagicMock(data=[], count=0), # user/assistant message count (Phase 267) — empty thread: no event
            MagicMock(data=[]), # update
            MagicMock(data={"id": thread_id, "user_id": user_id, "title": "Chat", "active_expert_id": None, "created_at": "2026-09-20T00:00:00Z", "updated_at": "2026-09-20T00:00:00Z"}), # select
        ]

        resp_clear = await rename_thread(
            thread_id=thread_id,
            body=ThreadUpdate(clear_active_expert=True),
            request=mock_request,
            current_user=current_user,
            supabase=mock_supabase,
        )
        assert resp_clear["active_expert_id"] is None
