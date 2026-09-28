"""Phase 268 (CHAT-08 / D-268-12 / D-268-12a / D-268-12b / D-268-25) — PATCH /threads/{id} changes a
live thread's folder scope, and GET /threads/{id}/scope-effect states the effect first.

* The folder arm has the 267 Expert arm's shape: read the thread BEFORE the update; authorize the new
  folder as visible WITHIN THE THREAD'S ORG (Pitfall 12 — ``create_thread`` never checked it); an
  unchanged value is a no-op; an empty thread gets a plain UPDATE and no event (D-268-12b); a thread
  with messages gets the UPDATE and ONE ``scope_changed`` row in ONE user-JWT transaction, with the
  THREAD's org (D-267-34).
* A change while an answer streams is ALLOWED (no 409, D-268-12a — research Q1 proved the loop reads
  ``threads.folder_id`` once per run); ``during_run`` is snapshotted so the card's footer says so.
* A body changing both the Expert and the folder is a 422: one PATCH writes one event.
* The route resolves with the producer's own inputs — the ACTIVE org and the caller's role
  (Pitfall 9) — and 404s a thread the caller does not own before any other read.

The writer fakes are imported from 267's suite, never copied.
"""
from __future__ import annotations

from contextlib import ExitStack
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.models.thread import ThreadUpdate
from tests.unit.test_267_expert_changed_event import (
    THREAD_ID,
    THREAD_ORG,
    FakeConn,
    FakeTxn,
    ThreadsDb,
    _writer_patches,
)
from tests.unit.test_267_scope_preview import (
    ACME_FOLDER,
    ACME_SUB,
    HIDDEN_FOLDER,
    HR_ID,
    ORG_ID,
    USER_ID,
    FakeSupabase,
)

OTHER_ORG_FOLDER = "f6000000-0000-4000-8000-000000000006"

# What fetch_visible_folders returns for the caller restricted to the THREAD's org. The second-org
# folder is one the caller OWNS (owned folders pass the visibility rule in any org), which is exactly
# why the folder row's own org must be checked too.
AUTH_FOLDERS = [
    {"id": ACME_FOLDER, "name": "Client ACME", "parent_id": None, "org_id": THREAD_ORG, "user_id": USER_ID},
    {"id": ACME_SUB, "name": "Contracts", "parent_id": ACME_FOLDER, "org_id": THREAD_ORG, "user_id": USER_ID},
    {"id": OTHER_ORG_FOLDER, "name": "Other org", "parent_id": None, "org_id": ORG_ID, "user_id": USER_ID},
]


def _auth_patch(rows=None):
    return patch(
        "app.utils.folder_utils.fetch_visible_folders",
        AsyncMock(return_value=list(AUTH_FOLDERS if rows is None else rows)),
    )


async def _patch_folder(body, db, txn, *, auth=None):
    from app.api import threads as threads_mod

    with ExitStack() as stack:
        for p in _writer_patches(db, txn):
            stack.enter_context(p)
        auth_mock = stack.enter_context(_auth_patch(auth))
        resp = await threads_mod.rename_thread(
            thread_id=THREAD_ID,
            body=body,
            request=MagicMock(),
            current_user={"id": USER_ID},
            supabase=FakeSupabase(),
        )
        return resp, auth_mock


def _event_of(txn):
    return txn.conn.executed[1][1][4][0]


# ── authorization before any write (Pitfall 12 / T-268-20) ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_folder_the_caller_cannot_see_is_a_404_and_nothing_is_written():
    db = ThreadsDb(before_expert=None, folder_id=ACME_FOLDER)
    txn = FakeTxn(FakeConn())
    with pytest.raises(HTTPException) as exc:
        await _patch_folder(ThreadUpdate(folder_id=UUID(HIDDEN_FOLDER)), db, txn)
    assert exc.value.status_code == 404
    assert exc.value.detail == "Folder not found"
    assert txn.entered == 0
    assert db.updates() == []


@pytest.mark.asyncio
async def test_a_visible_folder_in_another_org_than_the_thread_is_a_404():
    db = ThreadsDb(before_expert=None, folder_id=ACME_FOLDER)
    txn = FakeTxn(FakeConn())
    with pytest.raises(HTTPException) as exc:
        await _patch_folder(ThreadUpdate(folder_id=UUID(OTHER_ORG_FOLDER)), db, txn)
    assert exc.value.status_code == 404
    assert exc.value.detail == "Folder not found"
    assert txn.entered == 0
    assert db.updates() == []


@pytest.mark.asyncio
async def test_visibility_is_asked_within_the_threads_org():
    db = ThreadsDb(before_expert=None, folder_id=ACME_FOLDER, messages=0)
    txn = FakeTxn(FakeConn())
    _resp, auth = await _patch_folder(ThreadUpdate(folder_id=UUID(ACME_SUB)), db, txn)
    kw = auth.await_args.kwargs
    assert {str(o) for o in kw["restrict_org_ids"]} == {THREAD_ORG}
    assert str(auth.await_args.args[1]) == USER_ID


@pytest.mark.asyncio
async def test_another_users_thread_is_a_404():
    db = ThreadsDb(before_expert=None, folder_id=ACME_FOLDER)
    db.before = None  # the ownership read answers nothing
    txn = FakeTxn(FakeConn())

    async def _aexec(q):
        db.seen.append(q)
        from types import SimpleNamespace
        return SimpleNamespace(data=None)

    db.aexec = _aexec
    with pytest.raises(HTTPException) as exc:
        await _patch_folder(ThreadUpdate(folder_id=UUID(ACME_SUB)), db, txn)
    assert exc.value.status_code == 404
    assert exc.value.detail == "Thread not found"
    assert txn.entered == 0


# ── the write paths ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_same_folder_is_a_no_op():
    db = ThreadsDb(before_expert=None, folder_id=ACME_FOLDER)
    txn = FakeTxn(FakeConn())
    await _patch_folder(ThreadUpdate(folder_id=UUID(ACME_FOLDER)), db, txn)
    assert txn.entered == 0
    assert db.updates() == []
    assert [q for q in db.seen if q.table_name == "messages"] == []


@pytest.mark.asyncio
async def test_an_empty_thread_is_a_plain_update_with_no_event():
    db = ThreadsDb(before_expert=None, folder_id=ACME_FOLDER, messages=0)
    txn = FakeTxn(FakeConn())
    await _patch_folder(ThreadUpdate(folder_id=UUID(ACME_SUB)), db, txn)
    assert txn.entered == 0
    ups = db.updates()
    assert len(ups) == 1
    assert ups[0].call("update") == [("update", ({"folder_id": ACME_SUB},), {})]


@pytest.mark.asyncio
async def test_a_thread_with_messages_writes_the_update_and_one_event_in_one_txn():
    db = ThreadsDb(before_expert=None, folder_id=ACME_FOLDER)
    txn = FakeTxn(FakeConn())
    await _patch_folder(ThreadUpdate(folder_id=UUID(ACME_SUB)), db, txn)

    assert txn.entered == 1 and txn.committed is True
    sqls = [s for s, _ in txn.conn.executed]
    assert len(sqls) == 2
    assert sqls[0].lstrip().startswith("UPDATE public.threads")
    assert "folder_id" in sqls[0]
    assert ACME_SUB in [str(a) for a in txn.conn.executed[0][1]]
    assert "INSERT INTO public.messages" in sqls[1]

    thread_id, user_id, org_id, content, tool_calls = txn.conn.executed[1][1]
    assert (str(thread_id), str(user_id)) == (THREAD_ID, USER_ID)
    # D-267-34: the THREAD's org — never the caller's active org (ORG_ID) or the LIMIT-1 trigger.
    assert str(org_id) == THREAD_ORG
    assert isinstance(tool_calls, list) and len(tool_calls) == 1
    ev = tool_calls[0]
    assert ev["kind"] == "scope_changed"
    assert ev["from_folder"]["id"] == ACME_FOLDER and ev["to_folder"]["id"] == ACME_SUB
    assert ev["to_folder"]["path"] == "Client ACME/Contracts"
    assert ev["during_run"] is False
    assert content.startswith("Scope /Client ACME → /Client ACME/Contracts.")
    assert db.updates() == []


@pytest.mark.asyncio
async def test_a_change_while_an_answer_streams_is_ALLOWED_and_says_so():
    """D-268-12a: no 409 — the in-flight run keeps its scope; the snapshot records during_run."""
    db = ThreadsDb(before_expert=None, folder_id=ACME_FOLDER, streaming=[str(uuid4())])
    txn = FakeTxn(FakeConn())
    resp, _ = await _patch_folder(ThreadUpdate(folder_id=UUID(ACME_SUB)), db, txn)
    assert txn.entered == 1 and txn.committed is True
    assert _event_of(txn)["during_run"] is True
    assert resp["id"] == THREAD_ID


@pytest.mark.asyncio
async def test_clear_folder_writes_null_and_an_event_with_to_folder_none():
    db = ThreadsDb(before_expert=None, folder_id=ACME_FOLDER)
    txn = FakeTxn(FakeConn())
    await _patch_folder(ThreadUpdate(clear_folder=True), db, txn)
    assert txn.entered == 1
    assert None in list(txn.conn.executed[0][1])
    ev = _event_of(txn)
    assert ev["to_folder"] is None
    assert ev["now"]["all_documents"] is True


@pytest.mark.asyncio
async def test_under_a_restricted_expert_the_change_is_saved_and_held():
    db = ThreadsDb(before_expert=HR_ID, folder_id=ACME_FOLDER)
    txn = FakeTxn(FakeConn())
    await _patch_folder(ThreadUpdate(folder_id=UUID(ACME_SUB)), db, txn)
    ev = _event_of(txn)
    assert ev["held"] is True
    assert ev["expert"]["name"] == "HR Advisor"
    assert ev["saved"]["id"] == ACME_SUB


@pytest.mark.asyncio
async def test_a_failed_event_insert_rolls_the_update_back_and_says_so():
    db = ThreadsDb(before_expert=None, folder_id=ACME_FOLDER)
    txn = FakeTxn(FakeConn(fail_on="INSERT INTO public.messages"))
    with pytest.raises(HTTPException) as exc:
        await _patch_folder(ThreadUpdate(folder_id=UUID(ACME_SUB)), db, txn)
    assert exc.value.status_code == 500
    assert exc.value.detail == "The folder was not changed."
    assert txn.committed is False
    assert db.updates() == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "body",
    [
        {"active_expert_id": HR_ID, "folder_id": ACME_SUB},
        {"clear_active_expert": True, "folder_id": ACME_SUB},
        {"active_expert_id": HR_ID, "clear_folder": True},
    ],
)
async def test_changing_both_the_expert_and_the_folder_is_a_422(body):
    db = ThreadsDb(before_expert=None, folder_id=ACME_FOLDER)
    txn = FakeTxn(FakeConn())
    with pytest.raises(HTTPException) as exc:
        await _patch_folder(ThreadUpdate(**body), db, txn)
    assert exc.value.status_code == 422
    assert exc.value.detail == "Change the Expert or the folder, not both."
    assert txn.entered == 0
    assert db.seen == []


def test_the_folder_arm_region_raises_no_409():
    """D-268-12a / D-268-23: neither streaming nor cap_paused refuses a scope change."""
    import inspect

    from app.api import threads as threads_mod

    src = inspect.getsource(threads_mod._apply_folder_change)
    assert "HTTP_409" not in src


# ── GET /threads/{id}/scope-effect ────────────────────────────────────────────────────────────────


def _route_patches(db_aexec, desc, *, auth=None):
    from app.api import threads as threads_mod

    return [
        patch.object(threads_mod, "aexec", db_aexec),
        patch.object(threads_mod, "describe_scope_change", desc),
        patch.object(threads_mod, "get_pg_pool", AsyncMock(return_value=MagicMock())),
        patch.object(threads_mod, "resolve_active_org_or_none", AsyncMock(return_value=ORG_ID)),
        patch("app.dependencies.resolve_caller_role", AsyncMock(return_value=("admin", set()))),
        _auth_patch(auth),
    ]


async def _stated(desc_statements):
    """A describe_scope_change stand-in answering with real statements for (from, to)."""
    from tests.unit.test_268_scope_effect import change

    async def _desc(**kw):
        return await change(kw["expert_id"], kw["from_folder_id"], kw["to_folder_id"])

    return AsyncMock(side_effect=_desc)


async def _get_effect(*, thread_row, folder_id=None, clear=False, auth=None):
    from app.api import threads as threads_mod
    from types import SimpleNamespace

    desc = await _stated(None)
    seen = []

    async def _aexec(q):
        seen.append(q)
        return SimpleNamespace(data=thread_row)

    with ExitStack() as stack:
        for p in _route_patches(_aexec, desc, auth=auth):
            stack.enter_context(p)
        out = await threads_mod.get_scope_effect(
            thread_id=UUID(THREAD_ID),
            request=MagicMock(),
            folder_id=UUID(folder_id) if folder_id else None,
            clear=clear,
            current_user={"id": USER_ID},
            supabase=FakeSupabase(),
        )
    return out, desc, seen


ROW = {"id": THREAD_ID, "folder_id": ACME_FOLDER, "active_expert_id": None, "org_id": THREAD_ORG}


@pytest.mark.asyncio
async def test_the_route_404s_a_thread_the_caller_does_not_own_before_any_other_read():
    from app.api import threads as threads_mod

    desc = AsyncMock()
    with patch.object(threads_mod, "aexec", AsyncMock(return_value=MagicMock(data=None))), \
         patch.object(threads_mod, "describe_scope_change", desc), \
         _auth_patch() as auth:
        with pytest.raises(HTTPException) as exc:
            await threads_mod.get_scope_effect(
                thread_id=uuid4(),
                request=MagicMock(),
                folder_id=UUID(ACME_SUB),
                clear=False,
                current_user={"id": USER_ID},
                supabase=MagicMock(),
            )
    assert exc.value.status_code == 404
    assert exc.value.detail == "Thread not found"
    desc.assert_not_awaited()
    auth.assert_not_awaited()


@pytest.mark.asyncio
async def test_the_route_resolves_with_the_producers_inputs_active_org_and_caller_role():
    out, desc, seen = await _get_effect(thread_row=dict(ROW, active_expert_id=HR_ID))
    kw = desc.await_args.kwargs
    assert kw["org_id"] == ORG_ID          # the ACTIVE org, never the thread's (Pitfall 9)
    assert kw["caller_roles"] == ["admin"]
    assert kw["expert_id"] == HR_ID
    assert seen[0].table_name == "threads" and seen[0].call("eq")[1] == ("eq", ("user_id", USER_ID), {})
    assert out.held is True


@pytest.mark.asyncio
async def test_no_params_states_the_current_folder_at_rest():
    out, desc, _ = await _get_effect(thread_row=ROW)
    kw = desc.await_args.kwargs
    assert (kw["from_folder_id"], kw["to_folder_id"]) == (ACME_FOLDER, ACME_FOLDER)
    assert str(out.next.thread_folder.id) == ACME_FOLDER
    assert out.stops.thread_folder is None


@pytest.mark.asyncio
async def test_a_draft_folder_states_the_drafts_effect():
    out, desc, _ = await _get_effect(thread_row=ROW, folder_id=ACME_SUB)
    kw = desc.await_args.kwargs
    assert (kw["from_folder_id"], kw["to_folder_id"]) == (ACME_FOLDER, ACME_SUB)
    assert str(out.stops.thread_folder.id) == ACME_FOLDER


@pytest.mark.asyncio
async def test_clear_true_states_all_documents():
    out, desc, _ = await _get_effect(thread_row=ROW, clear=True)
    assert desc.await_args.kwargs["to_folder_id"] is None
    assert out.next.all_documents is True


@pytest.mark.asyncio
async def test_an_unauthorized_draft_folder_is_a_404():
    with pytest.raises(HTTPException) as exc:
        await _get_effect(thread_row=ROW, folder_id=OTHER_ORG_FOLDER)
    assert exc.value.status_code == 404
    assert exc.value.detail == "Folder not found"


def test_the_scope_effect_route_is_registered_under_the_thread():
    from app.api.threads import router

    paths = {(r.path, tuple(sorted(getattr(r, "methods", ())))) for r in router.routes}
    assert ("/threads/{thread_id}/scope-effect", ("GET",)) in paths
