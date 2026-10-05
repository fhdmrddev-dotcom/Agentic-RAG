"""267-REVIEW-INDEPENDENT CR-02 — an EMPTY biased composition means "no Expert narrowing".

The defect (driven by the independent review): a BIASED Expert with no effective folders, on a
thread with no folder, composed ``effective_folder_ids = ()``. ``()`` is not ``None``, so:

* ``agent_loop`` handed the tools ``folder_subtree_ids = []`` (``agent_loop.py`` — the override
  runs whenever ``ctx.effective_folder_ids is not None``);
* ``retrieval_service`` sent ``folder_ids if folder_ids else None`` → the RPC was UNFILTERED;
* ``tool_dispatcher._handle_search_documents``' post-query clip then ran with ``_scope = set()``
  and dropped EVERY hit, emitting ``scope_violation`` on every search — while every surface
  (``ScopeStatement.used()``, the ledger) said "All your documents".

⛔ WHY THE OLD FENCES WERE BLIND: ``test_267_tool_floor_union.py`` compares tool NAMES. The tools
were present; what they could REACH was empty. So this suite runs a real search through
``_handle_search_documents`` on the scoping ``_resolve_thread_scoping`` actually returns — only the
network edge (``search_documents``, i.e. the RPC) is faked, and the fake honours retrieval's own
``folder_ids if folder_ids else None`` rule.
"""
from __future__ import annotations

import inspect
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.services.expert_scope import compose_expert_scope
from app.services.expert_service import ResolvedExpertBundle
from app.services.run_producer import ExpertScopeUnavailable, _resolve_thread_scoping

KB_FOLDER = "f0000000-0000-4000-8000-00000000000a"  # where the org's documents actually live
HITS = [
    {
        "document_id": "d-1",
        "filename": "msa.pdf",
        "content": "Termination for convenience on 30 days' notice.",
        "chunk_index": 0,
        "similarity": 0.71,
        "folder_id": KB_FOLDER,
    }
]


def _bundle(*, scope_mode: str, folders: list[UUID], is_system: bool = False) -> ResolvedExpertBundle:
    return ResolvedExpertBundle(
        bundle_id=uuid4(),
        name="Contract Reviewer",
        slug="contract-reviewer",
        description="Reviews contracts",
        scope_mode=scope_mode,
        is_system=is_system,
        org_id=None if is_system else uuid4(),
        tool_floor_enabled=True,
        effective_skills=[],
        effective_folder_ids=folders,
        effective_connections=[],
    )


async def _scoping(resolved: ResolvedExpertBundle, *, thread_folder_id=None, visible=None):
    thread_resp = MagicMock(data={"active_expert_id": str(resolved.bundle_id), "folder_id": thread_folder_id})
    with patch("app.utils.db.aexec", AsyncMock(return_value=thread_resp)), \
         patch("app.services.expert_service.resolve_expert_bundle", AsyncMock(return_value=resolved)), \
         patch("app.utils.folder_utils.fetch_visible_folders", AsyncMock(return_value=list(visible or []))):
        return await _resolve_thread_scoping(
            supabase=MagicMock(),
            thread_id=str(uuid4()),
            current_user={"id": str(uuid4()), "org_id": str(uuid4())},
            pool=MagicMock(),
        )


def _folder_subtree_ids_for_a_no_folder_thread(scoping) -> list[str] | None:
    """What ``agent_loop`` hands the tools for a thread with NO folder (its own subtree is None).

    Mirrors the two lines pinned by ``test_agent_loop_override_is_the_one_this_suite_mirrors``."""
    folder_subtree_ids: list[str] | None = None
    if scoping.effective_folder_ids is not None:
        folder_subtree_ids = list(scoping.effective_folder_ids)
    return folder_subtree_ids


async def _search(folder_subtree_ids, monkeypatch):
    """A real ``_handle_search_documents`` call; only the RPC edge is faked."""
    import app.services.tool_dispatcher as td

    seen: dict = {}

    async def _rpc(query, user_id, supabase, *, metadata_filter=None, user_settings=None, folder_ids=None):
        seen["folder_ids"] = folder_ids
        # retrieval_service.py:121/153 — `folder_ids if folder_ids else None`: falsy = NO filter.
        if folder_ids:
            return [h for h in HITS if h["folder_id"] in set(map(str, folder_ids))], 0.71
        return list(HITS), 0.71

    monkeypatch.setattr("app.services.search_documents_tool.search_documents", _rpc)
    monkeypatch.setattr("app.services.search_documents_tool.write_audit_entry", AsyncMock())
    emit = AsyncMock()
    ctx = SimpleNamespace(
        current_user={"id": "user-1"},
        supabase=object(),
        user_settings=None,
        folder_subtree_ids=folder_subtree_ids,
        run_id=UUID("a1000000-0000-4000-8000-0000000000a1"),
        thread_id="7d000000-0000-4000-8000-000000000001",
        parent_run_id=None,
        redis=object(),
        emit=emit,
        spawn=lambda coro: coro.close(),
        has_connection_retrieval=False,
    )
    result = await td._handle_search_documents({"query": "termination", "metadata_filter": None}, ctx)
    return result, emit, seen


def _emitted(emit: AsyncMock, kind: str) -> list:
    return [c for c in emit.await_args_list if len(c.args) >= 3 and c.args[2] == kind]


# ── the defect ──────────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_biased_expert_with_no_folders_on_a_no_folder_thread_still_finds_documents(monkeypatch):
    scoping = await _scoping(_bundle(scope_mode="biased", folders=[]))
    result, emit, seen = await _search(_folder_subtree_ids_for_a_no_folder_thread(scoping), monkeypatch)

    assert result.result != "No relevant documents found.", (
        "a biased Expert with no folders walled the search to NOTHING; the statement says All your documents"
    )
    assert [c["document_id"] for c in result.citations] == ["d-1"]
    assert _emitted(emit, "scope_violation") == [], "every search emitted scope_violation"
    assert not seen["folder_ids"], "the RPC must be unfiltered, exactly as on a plain thread"


@pytest.mark.asyncio
async def test_the_empty_biased_scoping_is_the_plain_thread_scoping():
    """"No Expert narrowing, exactly as on a plain thread": no folder list, no scoped path."""
    scoping = await _scoping(_bundle(scope_mode="biased", folders=[]))
    assert scoping.effective_folder_ids is None
    assert scoping.scoped_folder_path is None
    # The rest of the Expert still rides the run (it only ADDS).
    assert scoping.born_for_bundle_id is not None


@pytest.mark.asyncio
async def test_it_matches_a_plain_thread_search_exactly(monkeypatch):
    scoping = await _scoping(_bundle(scope_mode="biased", folders=[]))
    expert_result, expert_emit, _ = await _search(_folder_subtree_ids_for_a_no_folder_thread(scoping), monkeypatch)
    plain_result, plain_emit, _ = await _search(None, monkeypatch)
    assert expert_result.result == plain_result.result
    assert expert_result.citations == plain_result.citations
    assert expert_emit.await_args_list == plain_emit.await_args_list


def test_agent_loop_override_is_the_one_this_suite_mirrors():
    """Non-vacuity: the derivation above is agent_loop's own two lines, not a paraphrase."""
    from app.services import agent_loop

    src = inspect.getsource(agent_loop)
    assert (
        "    if ctx.effective_folder_ids is not None:\n"
        "        folder_subtree_ids = list(ctx.effective_folder_ids)\n"
    ) in src


# ── controls: every NON-empty composition is byte-identical to before ────────────────────────────


@pytest.mark.asyncio
async def test_restricted_empty_is_still_refused():
    with pytest.raises(ExpertScopeUnavailable):
        await _scoping(_bundle(scope_mode="restricted", folders=[]))


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("mode", "thread_folder"),
    [("restricted", None), ("restricted", "tf"), ("biased", None), ("biased", "tf")],
)
async def test_every_non_empty_composition_is_the_composition_verbatim(mode, thread_folder):
    fid = "f1000000-0000-4000-8000-000000000001"
    tf = "f2000000-0000-4000-8000-000000000002" if thread_folder else None
    visible = [
        {"id": fid, "name": "HR Policies", "parent_id": None},
        {"id": "f2000000-0000-4000-8000-000000000002", "name": "Client ACME", "parent_id": None},
        {"id": "f3000000-0000-4000-8000-000000000003", "name": "Q3", "parent_id": "f2000000-0000-4000-8000-000000000002"},
    ]
    scoping = await _scoping(
        _bundle(scope_mode=mode, folders=[UUID(fid)]), thread_folder_id=tf, visible=visible
    )
    expected = compose_expert_scope(
        scope_mode=mode, thread_folder_id=tf, expert_folder_ids=[fid], visible_folders=visible
    )
    assert expected.effective_folder_ids, "control must be a non-empty composition"
    assert scoping.effective_folder_ids == expected.effective_folder_ids
    assert scoping.scoped_folder_path == expected.scoped_folder_path


@pytest.mark.asyncio
async def test_a_restricted_expert_with_folders_still_walls_the_search(monkeypatch):
    """The wall itself is untouched: a restricted Expert's search drops out-of-scope hits and says so."""
    other = "f9000000-0000-4000-8000-000000000009"
    scoping = await _scoping(_bundle(scope_mode="restricted", folders=[UUID(other)]))
    import app.services.tool_dispatcher as td

    async def _leaky_rpc(*a, **k):  # an RPC that ignored its filter — the clip is the backstop
        return list(HITS), 0.71

    monkeypatch.setattr("app.services.search_documents_tool.search_documents", _leaky_rpc)
    monkeypatch.setattr("app.services.search_documents_tool.write_audit_entry", AsyncMock())
    emit = AsyncMock()
    ctx = SimpleNamespace(
        current_user={"id": "user-1"}, supabase=object(), user_settings=None,
        folder_subtree_ids=_folder_subtree_ids_for_a_no_folder_thread(scoping),
        run_id=uuid4(), thread_id="t", parent_run_id=None, redis=object(), emit=emit,
        spawn=lambda coro: coro.close(), has_connection_retrieval=False,
    )
    result = await td._handle_search_documents({"query": "q", "metadata_filter": None}, ctx)
    assert result.result == "No relevant documents found."
    assert len(_emitted(emit, "scope_violation")) == 1
