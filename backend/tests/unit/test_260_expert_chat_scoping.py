"""Unit and AST tests for Phase 260 Expert Chat Scoping (PACK-02, PACK-05, D-260-04, D-260-05).

Tests:
1. Thread Pydantic models (ThreadCreate, ThreadUpdate, ThreadResponse, ThreadSnapshotResponse) and active_expert_id.
2. PATCH endpoint handling of active_expert_id setting and clearing to None.
3. Pre-loop expert resolution via _resolve_thread_scoping populating RunContext with effective_folder_ids and effective_tools.
4. Data-driven scoping in RunContext restricting folder subtrees and active tools.
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
from app.services.run_producer import _resolve_thread_scoping

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
    the fifth element is the access-checked Expert bundle id and is None on the no-expert arm.
    """
    mock_supabase = MagicMock()
    mock_query = MagicMock()
    mock_query.execute.return_value = MagicMock(data={"active_expert_id": None})
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = mock_query
    mock_pool = MagicMock()

    folders, tools, skills, scoped_path, born_for = await _resolve_thread_scoping(
        supabase=mock_supabase,
        thread_id=str(uuid4()),
        current_user={"id": str(uuid4()), "org_id": str(uuid4())},
        pool=mock_pool,
    )

    assert folders is None
    assert tools is None
    assert skills is None
    assert scoped_path is None
    # Phase 264 (PACK-17 / D-264-03a) — the no-expert arm yields a None born-for
    # bundle id, so the carrier is a literal no-op on every Deep run.
    assert born_for is None


@pytest.mark.asyncio
async def test_resolve_thread_scoping_with_active_expert():
    """PACK-02 / D-260-05: When thread has active_expert_id, resolves bundle into RunContext data."""
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

        folders, tools, skills, scoped_path, born_for = await _resolve_thread_scoping(
            supabase=mock_supabase,
            thread_id=str(uuid4()),
            current_user={"id": str(uuid4()), "org_id": str(uuid4())},
            pool=mock_pool,
        )

        # Phase 264 (PACK-17 / T-264-01) — the fifth element is the ACCESS-CHECKED
        # ResolvedExpertBundle.bundle_id, not the raw thread row's active_expert_id.
        assert born_for == expert_id
        assert folders == (str(folder_id),)
        assert "search_documents" in tools
        assert "load_skill" in tools
        assert "github__read" in tools
        assert skills == ({"name": "financial_ratio_calculator", "description": "Expert member skill: financial_ratio_calculator"},)


def test_run_context_carries_scoping_data():
    """PACK-02: RunContext holds effective_folder_ids and effective_tools as immutable tuples."""
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
        effective_tools=("search_documents", "query_documents"),
    )
    assert ctx.effective_folder_ids == ("folder-1", "folder-2")
    assert ctx.effective_tools == ("search_documents", "query_documents")


def test_agent_loop_closed_core_ast_invariant():
    """PACK-01 / EXT-01 / D-260-05: Closed-Core Invariant.
    
    agent_loop.py MUST NOT contain any branching on 'expert' or attribute/name check containing 'expert'.
    The loop executes purely on data (effective_folder_ids, effective_tools).
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

    # 1. Update with active_expert_id
    with patch("app.api.threads.aexec", new_callable=AsyncMock) as mock_aexec, \
         patch("app.api.threads.resolve_active_org_or_none", new_callable=AsyncMock, return_value=None):
        mock_aexec.side_effect = [
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

    # 2. Clear with clear_active_expert=True
    with patch("app.api.threads.aexec", new_callable=AsyncMock) as mock_aexec, \
         patch("app.api.threads.resolve_active_org_or_none", new_callable=AsyncMock, return_value=None):
        mock_aexec.side_effect = [
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
