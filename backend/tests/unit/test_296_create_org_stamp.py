"""Phase 296-01 — BUG-261021-02: folder and workflow-draft create stamp the VALIDATED active org.

Before 296 neither ``POST /folders`` nor ``POST /workflows`` read ``X-Org-Id``. Both inserts left
``org_id`` NULL and the mig-106 ``autofill_org_id_by_owner`` trigger filled it with
``SELECT org_id FROM org_members WHERE user_id = … LIMIT 1`` — no ORDER BY — so a two-org user
working in org B got rows in whichever org the trigger happened to pick. ``create_thread`` was
fixed the same way in Phase 268 (D-268-07); these are its two siblings.

The contract pinned here (the real-Postgres proof is ``tests/integration/test_296_two_org_create.py``):

  * a validated active org (``resolve_active_org_or_none`` → ORG_B) is stamped on the row;
  * no header / a non-member header (→ ``None``) inserts NO ``org_id`` key, and the workflow
    INSERT is the EXACT pre-296 SQL text, so the trigger path is byte-identical;
  * a parent folder that lives in another org than the active org is refused with the existing
    404 ``Parent folder not found`` — no cross-org child (RESEARCH Pitfall 10, T-296-02).
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

import app.api.folders as folders_mod
import app.api.workflows as workflows_mod
from app.db import workflows as db_workflows
from app.models.folder import FolderCreate
from app.models.harness import WorkflowDefinition

USER_ID = str(uuid4())
ORG_A = str(uuid4())
ORG_B = str(uuid4())
PARENT_ID = str(uuid4())


def _request():
    return SimpleNamespace(headers={"X-Org-Id": ORG_B}, state=SimpleNamespace())


class _FakeFolders:
    """Just enough of the supabase-py builder chain for create_folder: a name check that finds
    nothing, and an insert whose row is captured."""

    def __init__(self):
        self.inserted: list[dict] = []

    def table(self, name):
        assert name == "folders"
        outer = self

        class _Q:
            def select(self, *_a, **_k):
                return self

            def eq(self, *_a, **_k):
                return self

            def is_(self, *_a, **_k):
                return self

            def maybe_single(self):
                return self

            def execute(self):
                return SimpleNamespace(data=None)

            def insert(self, row):
                outer.inserted.append(row)
                return SimpleNamespace(execute=lambda: SimpleNamespace(data=[{"id": str(uuid4()), **row}]))

        return _Q()


async def _create_folder(*, active_org, parent_org=None, parent_id=None):
    sb = _FakeFolders()
    visible = [{"id": PARENT_ID, "user_id": USER_ID, "org_id": parent_org, "parent_id": None}]
    with patch.object(folders_mod, "resolve_active_org_or_none", AsyncMock(return_value=active_org)), \
            patch.object(folders_mod, "fetch_visible_folders", AsyncMock(return_value=visible)):
        await folders_mod.create_folder(
            body=FolderCreate(name="Q3", parent_id=parent_id),
            request=_request(),
            current_user={"id": USER_ID},
            supabase=sb,
        )
    return sb.inserted


# ── folders ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_folder_stamps_the_validated_active_org():
    inserted = await _create_folder(active_org=ORG_B)
    assert inserted and inserted[0]["org_id"] == ORG_B


@pytest.mark.asyncio
async def test_create_folder_without_an_active_org_inserts_no_org_key():
    inserted = await _create_folder(active_org=None)
    assert inserted and "org_id" not in inserted[0]
    assert set(inserted[0]) == {"user_id", "name", "parent_id", "is_org_shared"}


@pytest.mark.asyncio
async def test_create_folder_under_a_same_org_parent_is_allowed():
    inserted = await _create_folder(active_org=ORG_B, parent_org=ORG_B, parent_id=PARENT_ID)
    assert inserted and inserted[0]["org_id"] == ORG_B
    assert inserted[0]["parent_id"] == PARENT_ID


@pytest.mark.asyncio
async def test_create_folder_refuses_a_parent_in_another_org():
    sb = _FakeFolders()
    visible = [{"id": PARENT_ID, "user_id": USER_ID, "org_id": ORG_A, "parent_id": None}]
    with patch.object(folders_mod, "resolve_active_org_or_none", AsyncMock(return_value=ORG_B)), \
            patch.object(folders_mod, "fetch_visible_folders", AsyncMock(return_value=visible)):
        with pytest.raises(HTTPException) as exc:
            await folders_mod.create_folder(
                body=FolderCreate(name="Q3", parent_id=PARENT_ID),
                request=_request(),
                current_user={"id": USER_ID},
                supabase=sb,
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == "Parent folder not found"
    assert sb.inserted == [], "a refused cross-org child must insert nothing"


@pytest.mark.asyncio
async def test_create_folder_without_an_active_org_keeps_any_visible_parent():
    """No header → today's rule exactly: a visible parent is accepted whatever its org."""
    inserted = await _create_folder(active_org=None, parent_org=ORG_A, parent_id=PARENT_ID)
    assert inserted and inserted[0]["parent_id"] == PARENT_ID and "org_id" not in inserted[0]


# ── workflows: the route ─────────────────────────────────────────────────────


def _definition() -> WorkflowDefinition:
    return WorkflowDefinition.model_validate({
        "slug": "org-stamp",
        "version": 1,
        "name": "Org stamp",
        "status": "draft",
        "phases": [{
            "slug": "answer", "phase_index": 0, "name": "Answer",
            "config": {"phase_type": "llm_single", "prompt": "Answer."}, "validators": [],
        }],
    })


async def _create_draft(active_org):
    create = AsyncMock(return_value={"id": str(uuid4()), "version": 1, "token": "t"})
    with patch.object(workflows_mod, "resolve_active_org_or_none", AsyncMock(return_value=active_org)), \
            patch.object(workflows_mod, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
            patch.object(workflows_mod, "assert_phase_models_registered", AsyncMock(return_value=None)), \
            patch.object(workflows_mod, "create_workflow_definition", create):
        await workflows_mod.create_draft(
            body=_definition(), request=_request(), current_user={"id": USER_ID},
        )
    return create


@pytest.mark.asyncio
async def test_create_draft_passes_the_validated_active_org():
    create = await _create_draft(ORG_B)
    assert create.await_count == 1
    assert str(create.await_args.kwargs["org_id"]) == ORG_B


@pytest.mark.asyncio
async def test_create_draft_without_an_active_org_passes_none():
    create = await _create_draft(None)
    assert create.await_args.kwargs["org_id"] is None


# ── workflows: the DB function ───────────────────────────────────────────────

#: The INSERT text as it stood at the 296 base — the None path must emit exactly this.
PRE_296_SQL = (
    f"INSERT INTO workflow_definitions (slug, version, name, status, definition, created_by, is_system_global) "
    f"VALUES ($1, $2, $3, 'draft', $4::jsonb, $5, false) "
    f"RETURNING id, version, {db_workflows.CONCURRENCY_TOKEN_SQL} AS token"
)


class _StubPool:
    def __init__(self):
        self.calls: list[tuple] = []

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        return {"id": uuid4(), "version": 1, "token": "t"}


@pytest.mark.asyncio
async def test_create_workflow_definition_without_org_is_byte_identical():
    pool = _StubPool()
    await db_workflows.create_workflow_definition(
        pool, definition=_definition(), user_id=UUID(USER_ID), org_id=None,
    )
    (sql, args), = pool.calls
    assert sql == PRE_296_SQL
    assert len(args) == 5


@pytest.mark.asyncio
async def test_create_workflow_definition_with_org_binds_it():
    pool = _StubPool()
    await db_workflows.create_workflow_definition(
        pool, definition=_definition(), user_id=UUID(USER_ID), org_id=UUID(ORG_B),
    )
    (sql, args), = pool.calls
    assert "org_id" in sql
    assert args[-1] == UUID(ORG_B)
    assert "$6" in sql and len(args) == 6
