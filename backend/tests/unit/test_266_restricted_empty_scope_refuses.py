"""Phase 266 CR-01 — a RESTRICTED Expert with no usable folders must refuse the run, never search everything.

The hole (266-REVIEW.md CR-01, confirmed by code trace): with no install row, a first-party Expert
resolves to zero folders; `_resolve_thread_scoping` hands `()` down; `retrieval_service` sends
`folder_ids if folder_ids else None`, and `match_document_chunks` treats NULL as "no folder filter"
— so a restricted Expert searched every document in every org the user belongs to. Before 266 the
Financial Analyzer pointed at a dead global folder, which matched nothing; deleting it made this
reachable (every org right after deploy has no install).

Operator decision (2026-09-25): refuse the run in `run_producer`, overriding D-266-11
("run_producer byte-unchanged") as a security fix. A BIASED Expert with no folders keeps searching
everything — that is what biased (soft priority) means.

⚠ CORRECTED 2026-09-29 (267-REVIEW-INDEPENDENT CR-02) — the last sentence above was FALSE when it was
written, and it is kept rather than deleted. This analysis traced `retrieval_service` and missed the
098/262 folder wall in `tool_dispatcher`: the biased-empty `()` reached the tools as `[]`, the RPC ran
unfiltered, and the post-query clip dropped EVERY hit (and ls/tree/grep were walled to nothing). It is
true since `run_producer` maps an empty biased composition to `None`.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.services.expert_service import ResolvedExpertBundle
from app.services.run_producer import ExpertScopeUnavailable, _resolve_thread_scoping


def _bundle(*, scope_mode: str, is_system: bool, folders: list[UUID]) -> ResolvedExpertBundle:
    return ResolvedExpertBundle(
        bundle_id=uuid4(),
        name="Financial Analyzer",
        slug="financial-analyzer",
        description="Reads the org's financial reports",
        scope_mode=scope_mode,
        is_system=is_system,
        org_id=None if is_system else uuid4(),
        tool_floor_enabled=True,
        effective_skills=[],
        effective_folder_ids=folders,
        effective_connections=[],
    )


async def _scope(resolved: ResolvedExpertBundle, aexec: AsyncMock):
    thread_resp = MagicMock(data={"active_expert_id": str(resolved.bundle_id), "folder_id": None})
    aexec.return_value = thread_resp
    with patch("app.utils.db.aexec", aexec), \
         patch("app.services.expert_service.resolve_expert_bundle", AsyncMock(return_value=resolved)), \
         patch("app.utils.folder_utils.fetch_visible_folders", AsyncMock(return_value=[])):
        return await _resolve_thread_scoping(
            supabase=MagicMock(),
            thread_id=str(uuid4()),
            current_user={"id": str(uuid4()), "org_id": str(uuid4())},
            pool=MagicMock(),
        )


@pytest.mark.asyncio
async def test_restricted_first_party_expert_not_installed_refuses_the_run():
    aexec = AsyncMock()
    with pytest.raises(ExpertScopeUnavailable) as exc:
        await _scope(_bundle(scope_mode="restricted", is_system=True, folders=[]), aexec)
    msg = str(exc.value)
    assert "Financial Analyzer" in msg
    assert "install" in msg.lower()


@pytest.mark.asyncio
async def test_restricted_org_expert_with_every_folder_stripped_refuses_the_run():
    aexec = AsyncMock()
    with pytest.raises(ExpertScopeUnavailable):
        await _scope(_bundle(scope_mode="restricted", is_system=False, folders=[]), aexec)


@pytest.mark.asyncio
async def test_refusal_keeps_the_expert_on_the_thread():
    """Unlike the stale-bundle path, an uninstalled Expert is NOT cleared from the thread —
    the user installs it and carries on in the same chat."""
    aexec = AsyncMock()
    with pytest.raises(ExpertScopeUnavailable):
        await _scope(_bundle(scope_mode="restricted", is_system=True, folders=[]), aexec)
    # Only the thread SELECT ran; no UPDATE of active_expert_id.
    assert aexec.await_count == 1


def test_refusal_is_a_value_error_so_existing_fail_closed_handling_applies():
    assert issubclass(ExpertScopeUnavailable, ValueError)


@pytest.mark.asyncio
async def test_biased_expert_with_no_folders_is_unchanged():
    # ⚠ CORRECTED 2026-09-29 (267-REVIEW-INDEPENDENT CR-02): this read `== ()` and PINNED THE DEFECT —
    # `()` reached the tool_dispatcher folder wall as `[]` and dropped every hit. An empty biased
    # composition is now `None` ("no Expert narrowing", as on a plain thread); the search-level proof
    # is `test_267_cr02_empty_biased_scope_searches.py`.
    scoping = await _scope(_bundle(scope_mode="biased", is_system=False, folders=[]), AsyncMock())
    assert scoping.effective_folder_ids is None


@pytest.mark.asyncio
async def test_restricted_expert_with_a_folder_is_unchanged():
    fid = uuid4()
    scoping = await _scope(_bundle(scope_mode="restricted", is_system=True, folders=[fid]), AsyncMock())
    assert scoping.effective_folder_ids == (str(fid),)
