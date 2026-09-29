"""Phase 267 (D-267-17 / D-267-18 / D-267-19 / PACK-25) — a restricted Expert's cost, stated before
the invite, from the SAME code the run uses.

``describe_expert_scope`` (``app.services.expert_scope``) builds one ``ScopeStatement`` from
``resolve_expert_bundle`` (install-aware folders), ``fetch_visible_folders``, ``compose_expert_scope``
and ``connection_states``. The invite-dialog preview (``scope_preview``) and the transcript event
(``build_expert_changed_event``) both read that one statement — never a second derivation.

"Excluded" = the thread-folder subtree minus the Expert's folders, only when restricted. Its count
and its ≤5 names come from ONE documents query on the user-JWT client, whose RLS SELECT policy is
retrieval's visibility predicate, with retrieval's own filters (``is_latest``, not
``source_disconnected``).

The fakes below are shared with ``test_267_expert_changed_event.py`` (imported from here).
"""
from __future__ import annotations

import json
import pathlib
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.services.expert_service import ConnectionState, ResolvedExpertBundle

FIXTURES = pathlib.Path(__file__).resolve().parent.parent / "fixtures" / "phase267"

USER_ID = "5a0c1d2e-0000-4000-8000-000000000001"
ORG_ID = "5a0c1d2e-0000-4000-8000-0000000000aa"

FIN_FOLDER = "f1000000-0000-4000-8000-000000000001"   # Financial Reports & Filings
HR_FOLDER = "f2000000-0000-4000-8000-000000000002"    # HR Policies
ACME_FOLDER = "f3000000-0000-4000-8000-000000000003"  # Client ACME (the thread's folder)
ACME_SUB = "f4000000-0000-4000-8000-000000000004"     # Client ACME / Contracts
HIDDEN_FOLDER = "f5000000-0000-4000-8000-000000000005"  # not visible to the caller

FA_ID = "e1000000-0000-4000-8000-0000000000fa"  # Financial Analyzer (biased)
HR_ID = "e2000000-0000-4000-8000-0000000000b2"  # HR Advisor (restricted)
CR_ID = "e3000000-0000-4000-8000-0000000000c3"  # Contract Reviewer (biased)

VISIBLE_FOLDERS = [
    {"id": FIN_FOLDER, "name": "Financial Reports & Filings", "parent_id": None},
    {"id": HR_FOLDER, "name": "HR Policies", "parent_id": None},
    {"id": ACME_FOLDER, "name": "Client ACME", "parent_id": None},
    {"id": ACME_SUB, "name": "Contracts", "parent_id": ACME_FOLDER},
]

CONNECTION_NAMES = {"slack": "Slack", "hubspot": "HubSpot"}

# The documents table as RLS would let the caller see it. Retrieval reads only is_latest rows that
# are not source-disconnected; the fake applies those filters ONLY when the query asks for them,
# so a query that forgot one counts the wrong number and fails.
ACME_DOCS = [
    {"filename": "ACME_MSA_2026.pdf", "folder_id": ACME_FOLDER, "is_latest": True, "source_state": None},
    {"filename": "ACME_SOW_03.docx", "folder_id": ACME_SUB, "is_latest": True, "source_state": None},
    {"filename": "ACME_invoices_Q3.xlsx", "folder_id": ACME_FOLDER, "is_latest": True, "source_state": "synced"},
    {"filename": "Board_deck_Q3.pptx", "folder_id": ACME_SUB, "is_latest": True, "source_state": None},
    # noise the predicate must drop
    {"filename": "ACME_MSA_2025.pdf", "folder_id": ACME_FOLDER, "is_latest": False, "source_state": None},
    {"filename": "Old_drive_export.docx", "folder_id": ACME_FOLDER, "is_latest": True, "source_state": "source_disconnected"},
]
HR_DOCS = [
    {"filename": "Leave_policy.pdf", "folder_id": HR_FOLDER, "is_latest": True, "source_state": None},
]

RETRIEVAL_OR = "source_state.is.null,source_state.neq.source_disconnected"


class FakeQuery:
    """Records a supabase-py builder chain; ``execute()`` answers from the owning FakeSupabase."""

    def __init__(self, sb: "FakeSupabase", table: str):
        self.sb = sb
        self.table_name = table
        self.calls: list[tuple] = []

    def __getattr__(self, name):
        def _method(*args, **kwargs):
            self.calls.append((name, args, kwargs))
            return self

        return _method

    def call(self, name):
        return [c for c in self.calls if c[0] == name]

    def execute(self):
        self.sb.executed.append(self)
        return self.sb.answer(self)


class FakeSupabase:
    def __init__(self, docs=None, answers=None):
        self.docs = list(docs if docs is not None else ACME_DOCS + HR_DOCS)
        self.answers = answers or {}
        self.executed: list[FakeQuery] = []

    def table(self, name):
        return FakeQuery(self, name)

    def queries(self, table):
        return [q for q in self.executed if q.table_name == table]

    def answer(self, q: FakeQuery):
        if q.table_name in self.answers:
            a = self.answers[q.table_name]
            return a(q) if callable(a) else a
        if q.table_name != "documents":
            return SimpleNamespace(data=[], count=0)
        rows = list(self.docs)
        for _, args, _kw in q.call("in_"):
            if args[0] == "folder_id":
                rows = [r for r in rows if r["folder_id"] in set(args[1])]
        for _, args, _kw in q.call("eq"):
            rows = [r for r in rows if r.get(args[0]) == args[1]]
        for _, args, _kw in q.call("or_"):
            if args[0] == RETRIEVAL_OR:
                rows = [r for r in rows if r.get("source_state") != "source_disconnected"]
        rows.sort(key=lambda r: r["filename"])
        count = len(rows)
        for _, args, _kw in q.call("limit"):
            rows = rows[: args[0]]
        return SimpleNamespace(data=[{"id": str(uuid4()), "filename": r["filename"]} for r in rows], count=count)


def resolved(expert_id, name, scope_mode, folders, connections=()):
    return ResolvedExpertBundle(
        bundle_id=UUID(expert_id),
        name=name,
        slug=name.lower().replace(" ", "-"),
        description="",
        scope_mode=scope_mode,
        is_system=False,
        org_id=UUID(ORG_ID),
        effective_folder_ids=[UUID(f) for f in folders],
        effective_connections=list(connections),
    )


FA = resolved(FA_ID, "Financial Analyzer", "biased", [FIN_FOLDER], ["slack"])
HR = resolved(HR_ID, "HR Advisor", "restricted", [HR_FOLDER])
CR = resolved(CR_ID, "Contract Reviewer", "biased", [ACME_SUB], ["hubspot"])
BUNDLES = {FA_ID: FA, HR_ID: HR, CR_ID: CR}


async def _states(pool, org_id, required):
    return [ConnectionState(slug=s, name=CONNECTION_NAMES.get(s, s), connected=True) for s in required]


def scope_patches(*, bundles=None, visible=None):
    """Patch describe_expert_scope's collaborators at the expert_scope import site."""
    table = BUNDLES if bundles is None else bundles

    async def _resolve(*, pool, bundle_id, caller_org_id, caller_user_id, caller_roles=None):
        return table.get(str(bundle_id))

    return (
        patch("app.services.expert_scope.resolve_expert_bundle", AsyncMock(side_effect=_resolve)),
        patch("app.services.expert_scope.connection_states", AsyncMock(side_effect=_states)),
        patch(
            "app.services.expert_scope.fetch_visible_folders",
            AsyncMock(return_value=list(VISIBLE_FOLDERS if visible is None else visible)),
        ),
    )


async def describe(sb, expert_id, thread_folder_id, **kw):
    from app.services.expert_scope import describe_expert_scope

    p1, p2, p3 = scope_patches(**kw)
    with p1, p2, p3:
        return await describe_expert_scope(
            supabase=sb,
            pool=MagicMock(),
            user_id=USER_ID,
            org_id=ORG_ID,
            caller_roles=["member"],
            expert_id=expert_id,
            thread_folder_id=thread_folder_id,
        )


def _latest_acme_names():
    return sorted(
        d["filename"]
        for d in ACME_DOCS
        if d["is_latest"] and d["source_state"] != "source_disconnected"
    )


# ── the preview, from one statement ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_restricted_in_a_folder_states_the_excluded_documents_from_one_query():
    from app.services.expert_scope import scope_preview

    sb = FakeSupabase()
    preview = scope_preview(await describe(sb, HR_ID, ACME_FOLDER))

    assert preview.mode == "restricted"
    assert preview.expert_name == "HR Advisor"
    assert [(str(f.id), f.name) for f in preview.expert_folders] == [(HR_FOLDER, "HR Policies")]
    assert preview.excluded_count == 4
    assert preview.excluded_names == _latest_acme_names()
    assert preview.thread_folder is not None
    assert (str(preview.thread_folder.id), preview.thread_folder.name, preview.thread_folder.doc_count) == (
        ACME_FOLDER, "Client ACME", 4,
    )

    # ONE documents query answers both the count and the names (UI-SPEC §5.3), with retrieval's
    # own predicate written once.
    docs = sb.queries("documents")
    assert len(docs) == 1
    q = docs[0]
    assert q.call("select") == [("select", ("id, filename",), {"count": "exact"})]
    assert q.call("in_") == [("in_", ("folder_id", sorted([ACME_FOLDER, ACME_SUB])), {})]
    assert q.call("eq") == [("eq", ("is_latest", True), {})]
    assert q.call("or_") == [("or_", (RETRIEVAL_OR,), {})]
    assert q.call("order") == [("order", ("filename",), {})]
    assert q.call("limit") == [("limit", (5,), {})]


@pytest.mark.asyncio
async def test_seven_excluded_documents_report_seven_and_name_five():
    from app.services.expert_scope import scope_preview

    many = [
        {"filename": f"Doc_{i:02d}.pdf", "folder_id": ACME_FOLDER, "is_latest": True, "source_state": None}
        for i in range(7)
    ]
    preview = scope_preview(await describe(FakeSupabase(docs=many), HR_ID, ACME_FOLDER))
    assert preview.excluded_count == 7
    assert preview.excluded_names == [f"Doc_{i:02d}.pdf" for i in range(5)]


@pytest.mark.asyncio
async def test_a_biased_expert_excludes_nothing():
    from app.services.expert_scope import scope_preview

    preview = scope_preview(await describe(FakeSupabase(), FA_ID, ACME_FOLDER))
    assert preview.mode == "biased"
    assert preview.excluded_count == 0
    assert preview.excluded_names == []
    assert preview.thread_folder is not None and preview.thread_folder.doc_count == 4


@pytest.mark.asyncio
async def test_no_thread_means_no_thread_folder_and_no_document_query():
    from app.services.expert_scope import scope_preview

    sb = FakeSupabase()
    preview = scope_preview(await describe(sb, HR_ID, None))
    assert preview.thread_folder is None
    assert preview.excluded_count == 0
    assert preview.excluded_names == []
    assert sb.queries("documents") == []


@pytest.mark.asyncio
async def test_a_restricted_expert_with_zero_folders_states_the_gate_line_without_raising():
    from app.services.expert_scope import scope_preview

    empty = resolved(HR_ID, "HR Advisor", "restricted", [])
    preview = scope_preview(await describe(FakeSupabase(), HR_ID, ACME_FOLDER, bundles={HR_ID: empty}))
    assert preview.expert_folders == []
    assert preview.excluded_count == 4


@pytest.mark.asyncio
async def test_an_unnameable_expert_folder_is_named_none():
    from app.services.expert_scope import scope_preview

    hidden = resolved(HR_ID, "HR Advisor", "restricted", [HIDDEN_FOLDER])
    preview = scope_preview(await describe(FakeSupabase(), HR_ID, None, bundles={HR_ID: hidden}))
    assert [(str(f.id), f.name) for f in preview.expert_folders] == [(HIDDEN_FOLDER, None)]


@pytest.mark.asyncio
async def test_an_expert_the_resolver_refuses_is_a_lookup_error():
    from app.services.expert_scope import describe_expert_scope

    p1, p2, p3 = scope_patches(bundles={})
    with p1, p2, p3, patch("app.services.expert_scope.get_expert_service", AsyncMock(return_value=None)):
        with pytest.raises(LookupError):
            await describe_expert_scope(
                supabase=FakeSupabase(), pool=MagicMock(), user_id=USER_ID, org_id=ORG_ID,
                caller_roles=[], expert_id=HR_ID, thread_folder_id=None,
            )


@pytest.mark.asyncio
async def test_the_scope_preview_fixture_is_the_real_builders_output():
    """The wire contract 267-04 renders (``fixtures/phase267/scope_preview.json``)."""
    from app.services.expert_scope import scope_preview

    preview = scope_preview(await describe(FakeSupabase(), HR_ID, ACME_FOLDER))
    fixture = json.loads((FIXTURES / "scope_preview.json").read_text(encoding="utf-8"))
    assert fixture == preview.model_dump(mode="json")


# ── GET /threads/expert-scope-preview ──────────────────────────────────────────────────────────


def test_the_preview_route_is_declared_above_get_thread():
    """``/threads/expert-scope-preview`` must never be captured by ``/threads/{thread_id}``."""
    from app.api.threads import router

    first = next(
        r for r in router.routes
        if "GET" in getattr(r, "methods", set()) and r.path_regex.match("/threads/expert-scope-preview")
    )
    assert first.path == "/threads/expert-scope-preview"


@pytest.mark.asyncio
async def test_another_users_thread_is_a_404_before_any_other_read():
    from app.api import threads as threads_mod

    gate = AsyncMock()
    desc = AsyncMock()
    with patch.object(threads_mod, "assert_expert_bindable", gate), \
         patch.object(threads_mod, "describe_expert_scope", desc), \
         patch.object(threads_mod, "aexec", AsyncMock(return_value=MagicMock(data=None))):
        with pytest.raises(HTTPException) as exc:
            await threads_mod.get_expert_scope_preview(
                request=MagicMock(),
                expert_id=UUID(HR_ID),
                thread_id=uuid4(),
                current_user={"id": USER_ID},
                supabase=MagicMock(),
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == "Thread not found"
    gate.assert_not_awaited()
    desc.assert_not_awaited()


@pytest.mark.asyncio
async def test_the_preview_route_gates_then_describes_the_threads_folder():
    from app.api import threads as threads_mod
    from app.models.thread import ExpertScopePreview

    sb = FakeSupabase()
    statement = await describe(sb, HR_ID, ACME_FOLDER)
    gate = AsyncMock(return_value=({"id": HR_ID}, ORG_ID))
    desc = AsyncMock(return_value=statement)
    thread_id = uuid4()
    with patch.object(threads_mod, "assert_expert_bindable", gate), \
         patch.object(threads_mod, "describe_expert_scope", desc), \
         patch.object(threads_mod, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
         patch("app.dependencies.resolve_caller_role", AsyncMock(return_value=("member", set()))), \
         patch.object(threads_mod, "aexec", AsyncMock(return_value=MagicMock(data={"id": str(thread_id), "folder_id": ACME_FOLDER}))):
        out = await threads_mod.get_expert_scope_preview(
            request=MagicMock(),
            expert_id=UUID(HR_ID),
            thread_id=thread_id,
            current_user={"id": USER_ID},
            supabase=MagicMock(),
        )
    gate.assert_awaited_once()
    kw = desc.await_args.kwargs
    assert kw["expert_id"] == HR_ID
    assert kw["thread_folder_id"] == ACME_FOLDER
    assert kw["org_id"] == ORG_ID
    assert isinstance(out, ExpertScopePreview)
    assert out.excluded_count == 4


# ── 267-REVIEW WR-07: a brand-new chat's picked folder reaches the preview ──────────────────────────
#
# Before the first message the dialog's context line reads "This chat · /Client ACME", but the preview
# had no way to learn that folder (no thread yet, no folder parameter), so it described a chat with no
# folder: no `Won't use`. The thread `handleSend` then creates DOES carry the folder, and the restricted
# run excludes its documents — a cost stated as zero. `folder_id` is read ONLY when there is no thread,
# and only for a folder the caller can see (404 otherwise, before the gate or any statement).


def _route_patches(gate, desc, visible):
    from app.api import threads as threads_mod

    return (
        patch.object(threads_mod, "assert_expert_bindable", gate),
        patch.object(threads_mod, "describe_expert_scope", desc),
        patch.object(threads_mod, "get_pg_pool", AsyncMock(return_value=MagicMock())),
        patch("app.dependencies.resolve_caller_role", AsyncMock(return_value=("member", set()))),
        patch("app.utils.folder_utils.fetch_visible_folders", AsyncMock(return_value=list(visible))),
    )


@pytest.mark.asyncio
async def test_WR07_a_new_chats_visible_folder_is_the_statements_thread_folder():
    from app.api import threads as threads_mod

    statement = await describe(FakeSupabase(), HR_ID, ACME_FOLDER)
    gate = AsyncMock(return_value=({"id": HR_ID}, ORG_ID))
    desc = AsyncMock(return_value=statement)
    p = _route_patches(gate, desc, VISIBLE_FOLDERS)
    with p[0], p[1], p[2], p[3], p[4], patch.object(threads_mod, "aexec", AsyncMock(side_effect=AssertionError("no thread read"))):
        out = await threads_mod.get_expert_scope_preview(
            request=MagicMock(),
            expert_id=UUID(HR_ID),
            thread_id=None,
            folder_id=UUID(ACME_FOLDER),
            current_user={"id": USER_ID},
            supabase=MagicMock(),
        )
    assert desc.await_args.kwargs["thread_folder_id"] == ACME_FOLDER
    assert out.excluded_count == 4


@pytest.mark.asyncio
async def test_WR07_a_folder_the_caller_cannot_see_is_a_404_before_the_gate():
    from app.api import threads as threads_mod

    gate = AsyncMock()
    desc = AsyncMock()
    p = _route_patches(gate, desc, VISIBLE_FOLDERS)
    with p[0], p[1], p[2], p[3], p[4]:
        with pytest.raises(HTTPException) as exc:
            await threads_mod.get_expert_scope_preview(
                request=MagicMock(),
                expert_id=UUID(HR_ID),
                thread_id=None,
                folder_id=UUID(HIDDEN_FOLDER),
                current_user={"id": USER_ID},
                supabase=MagicMock(),
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == "Folder not found"
    gate.assert_not_awaited()
    desc.assert_not_awaited()


@pytest.mark.asyncio
async def test_WR07_with_a_thread_the_threads_own_folder_wins_over_folder_id():
    from app.api import threads as threads_mod

    statement = await describe(FakeSupabase(), HR_ID, ACME_FOLDER)
    gate = AsyncMock(return_value=({"id": HR_ID}, ORG_ID))
    desc = AsyncMock(return_value=statement)
    thread_id = uuid4()
    p = _route_patches(gate, desc, VISIBLE_FOLDERS)
    with p[0], p[1], p[2], p[3], p[4], \
         patch.object(threads_mod, "aexec", AsyncMock(return_value=MagicMock(data={"id": str(thread_id), "folder_id": None}))):
        await threads_mod.get_expert_scope_preview(
            request=MagicMock(),
            expert_id=UUID(HR_ID),
            thread_id=thread_id,
            folder_id=UUID(ACME_FOLDER),
            current_user={"id": USER_ID},
            supabase=MagicMock(),
        )
    assert desc.await_args.kwargs["thread_folder_id"] is None
