"""Phase 267 (D-267-09 / D-267-11 / D-267-12 / D-267-34 / PACK-23) — a swap, join or removal on a
thread with messages leaves ONE persisted, org-correct transcript event that states its consequence.

* The payload (``ExpertChangedEvent``) is built by ``build_expert_changed_event`` from two
  ``ScopeStatement``s produced by ``describe_expert_scope`` — the same statement the preview reads.
  ``now`` / ``dropped`` are GENERIC scope lines, so Phase 268 adds a kind, not a renderer.
* ``rename_thread`` reads the thread BEFORE the update, and only when ``active_expert_id`` really
  changes on a thread with ≥ 1 user/assistant message does it write the event — inside ONE
  ``get_user_pg_connection`` transaction together with the UPDATE, with ``org_id`` taken from the
  thread row (never the LIMIT-1 autofill trigger). A failed INSERT rolls the update back.
* ``GET /snapshot`` and ``GET /messages`` return allowlisted transcript kinds through ONE helper;
  every other system kind stays excluded.
"""
from __future__ import annotations

import json
import pathlib
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.models.thread import ThreadUpdate
from tests.unit.test_267_scope_preview import (
    ACME_FOLDER,
    CR,
    CR_ID,
    FA,
    FA_ID,
    FIN_FOLDER,
    FIXTURES,
    HR_FOLDER,
    HR_ID,
    ORG_ID,
    USER_ID,
    FakeSupabase,
    _latest_acme_names,
    describe,
    resolved,
)

AT = datetime(2026, 9, 25, 14, 32, tzinfo=timezone.utc)
THREAD_ORG = "5a0c1d2e-0000-4000-8000-0000000000bb"  # the thread's org — NOT the caller's first org
THREAD_ID = "7d000000-0000-4000-8000-000000000001"


def _ref(folder_ref):
    return (str(folder_ref.id) if folder_ref.id else None, folder_ref.name, folder_ref.doc_count)


# ── the pure builder ───────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_swap_biased_to_restricted_states_now_dropped_and_the_exclusions():
    from app.services.expert_scope import build_expert_changed_event

    before = await describe(FakeSupabase(), FA_ID, ACME_FOLDER)
    after = await describe(FakeSupabase(), HR_ID, ACME_FOLDER)
    ev = build_expert_changed_event(before, after, at=AT)

    assert ev.kind == "expert_changed"
    assert (str(ev.before.id), ev.before.name, ev.before.scope_mode) == (FA_ID, "Financial Analyzer", "biased")
    assert (str(ev.after.id), ev.after.name, ev.after.scope_mode) == (HR_ID, "HR Advisor", "restricted")

    assert [_ref(f) for f in ev.now.folders] == [(HR_FOLDER, "HR Policies", None)]
    assert ev.now.thread_folder is None
    assert ev.now.all_documents is False
    assert ev.now.connections == []

    assert [_ref(f) for f in ev.dropped.folders] == [(FIN_FOLDER, "Financial Reports & Filings", None)]
    assert _ref(ev.dropped.thread_folder) == (ACME_FOLDER, "Client ACME", 4)
    assert ev.dropped.all_documents is False
    assert ev.dropped.connections == ["Slack"]

    assert ev.excluded is not None
    assert ev.excluded.count == 4
    assert ev.excluded.names == _latest_acme_names()


@pytest.mark.asyncio
async def test_join_on_a_plain_thread_states_the_measured_narrowing_honestly():
    """D-267-35: a biased Expert on a thread with NO folder narrows to its own folders — stated as
    ``Dropped: All your documents``, never hidden."""
    from app.services.expert_scope import build_expert_changed_event

    before = await describe(FakeSupabase(), None, None)
    after = await describe(FakeSupabase(), FA_ID, None)
    ev = build_expert_changed_event(before, after, at=AT)

    assert ev.before is None
    assert [_ref(f) for f in ev.now.folders] == [(FIN_FOLDER, "Financial Reports & Filings", None)]
    assert ev.now.connections == ["Slack"]
    assert ev.now.all_documents is False
    assert ev.dropped.all_documents is True
    assert ev.dropped.folders == [] and ev.dropped.thread_folder is None and ev.dropped.connections == []
    assert ev.excluded is None


@pytest.mark.asyncio
async def test_removal_in_a_folder_returns_to_the_thread_folder():
    from app.services.expert_scope import build_expert_changed_event

    before = await describe(FakeSupabase(), FA_ID, ACME_FOLDER)
    after = await describe(FakeSupabase(), None, ACME_FOLDER)
    ev = build_expert_changed_event(before, after, at=AT)

    assert ev.after is None
    assert _ref(ev.now.thread_folder) == (ACME_FOLDER, "Client ACME", 4)
    assert ev.now.folders == [] and ev.now.all_documents is False and ev.now.connections == []
    assert [_ref(f) for f in ev.dropped.folders] == [(FIN_FOLDER, "Financial Reports & Filings", None)]
    assert ev.dropped.thread_folder is None
    assert ev.dropped.connections == ["Slack"]
    assert ev.excluded is None


@pytest.mark.asyncio
async def test_removal_on_a_plain_thread_returns_to_all_documents():
    from app.services.expert_scope import build_expert_changed_event

    before = await describe(FakeSupabase(), FA_ID, None)
    after = await describe(FakeSupabase(), None, None)
    ev = build_expert_changed_event(before, after, at=AT)
    assert ev.now.all_documents is True
    assert ev.now.thread_folder is None


@pytest.mark.asyncio
async def test_connections_now_are_the_new_experts_and_dropped_only_what_it_lacks():
    """D-267-29: ``now`` lists the after-Expert's CONNECTED names (the Brings statement); ``dropped``
    lists the before-Expert's connected names the after-Expert does not bring."""
    from app.services.expert_scope import build_expert_changed_event

    both = resolved(FA_ID, "Financial Analyzer", "biased", [FIN_FOLDER], ["slack", "hubspot"])
    before = await describe(FakeSupabase(), FA_ID, None, bundles={FA_ID: both, CR_ID: CR})
    after = await describe(FakeSupabase(), CR_ID, None, bundles={FA_ID: both, CR_ID: CR})
    ev = build_expert_changed_event(before, after, at=AT)
    assert ev.now.connections == ["HubSpot"]
    assert ev.dropped.connections == ["Slack"]


@pytest.mark.asyncio
async def test_an_empty_dropped_side_is_all_empty_and_not_all_documents():
    from app.services.expert_scope import build_expert_changed_event

    st = await describe(FakeSupabase(), CR_ID, ACME_FOLDER)
    ev = build_expert_changed_event(st, st, at=AT)
    assert ev.dropped.folders == []
    assert ev.dropped.thread_folder is None
    assert ev.dropped.connections == []
    assert ev.dropped.all_documents is False


@pytest.mark.asyncio
async def test_the_sentence_is_plain_text_from_the_same_payload():
    from app.services.expert_scope import build_expert_changed_event, event_sentence

    fa_acme = await describe(FakeSupabase(), FA_ID, ACME_FOLDER)
    hr_acme = await describe(FakeSupabase(), HR_ID, ACME_FOLDER)
    plain = await describe(FakeSupabase(), None, None)
    fa_plain = await describe(FakeSupabase(), FA_ID, None)
    plain_acme = await describe(FakeSupabase(), None, ACME_FOLDER)

    assert event_sentence(build_expert_changed_event(fa_acme, hr_acme, at=AT)) == (
        "Financial Analyzer → HR Advisor. Now: HR Policies. "
        "Dropped: Financial Reports & Filings, /Client ACME (4), Slack."
    )
    assert event_sentence(build_expert_changed_event(plain, fa_plain, at=AT)) == (
        "Financial Analyzer joined. Now: Financial Reports & Filings, Slack. Dropped: All your documents."
    )
    assert event_sentence(build_expert_changed_event(fa_acme, plain_acme, at=AT)) == (
        "Financial Analyzer left. Now: /Client ACME (4). Dropped: Financial Reports & Filings, Slack."
    )
    st = await describe(FakeSupabase(), CR_ID, ACME_FOLDER)
    assert event_sentence(build_expert_changed_event(st, st, at=AT)).endswith("Dropped: Nothing.")


@pytest.mark.asyncio
async def test_the_expert_changed_fixture_is_the_real_builders_output():
    """The wire contract 267-04's ExpertEventCard renders (``fixtures/phase267/expert_changed.json``)."""
    from app.services.expert_scope import build_expert_changed_event

    before = await describe(FakeSupabase(), FA_ID, ACME_FOLDER)
    after = await describe(FakeSupabase(), HR_ID, ACME_FOLDER)
    ev = build_expert_changed_event(before, after, at=AT)
    fixture = json.loads((FIXTURES / "expert_changed.json").read_text(encoding="utf-8"))
    assert fixture == ev.model_dump(mode="json")


# ── rename_thread's event writer ───────────────────────────────────────────────────────────────


class ThreadsDb:
    """Answers the supabase-py reads/writes rename_thread routes through ``aexec``."""

    def __init__(self, *, before_expert, folder_id=ACME_FOLDER, messages=3, after_expert=None, streaming=()):
        self.before = {"active_expert_id": before_expert, "folder_id": folder_id, "org_id": THREAD_ORG}
        # 267-REVIEW WR-04: the thread's primary runs still streaming (none by default).
        self.streaming = [{"run_id": r} for r in streaming]
        self.final = {
            "id": THREAD_ID, "user_id": USER_ID, "title": "Chat", "folder_id": folder_id,
            "active_expert_id": after_expert, "org_id": THREAD_ORG,
            "created_at": "2026-09-25T00:00:00Z", "updated_at": "2026-09-25T00:00:00Z",
        }
        self.messages = messages
        self.seen: list = []

    def updates(self):
        return [q for q in self.seen if q.table_name == "threads" and q.call("update")]

    async def aexec(self, q):
        self.seen.append(q)
        if q.table_name == "threads" and q.call("update"):
            return SimpleNamespace(data=[])
        if q.table_name == "threads":
            cols = q.call("select")[0][1][0]
            return SimpleNamespace(data=dict(self.final) if cols == "*" else dict(self.before))
        if q.table_name == "runs":
            return SimpleNamespace(data=list(self.streaming))
        if q.table_name == "messages":
            n = self.messages
            return SimpleNamespace(data=[{"id": str(uuid4())}] if n else [], count=n)
        raise AssertionError(f"unexpected aexec on {q.table_name}")


class FakeConn:
    def __init__(self, fail_on: str | None = None):
        self.fail_on = fail_on
        self.executed: list[tuple] = []

    async def execute(self, sql, *args):
        self.executed.append((sql, args))
        if self.fail_on and self.fail_on in sql:
            raise RuntimeError("simulated INSERT failure")
        return "OK"


class FakeTxn:
    """Stands in for ``get_user_pg_connection``: records entry and whether it committed."""

    def __init__(self, conn: FakeConn):
        self.conn = conn
        self.entered = 0
        self.committed = None

    def __call__(self, request, current_user):
        return self

    async def __aenter__(self):
        self.entered += 1
        return self.conn

    async def __aexit__(self, et, e, tb):
        self.committed = et is None
        return False


# 267-REVIEW WR-03: a BIND is refused unless the gate's org is the thread's own org, so the gate
# fixture answers THREAD_ORG. The caller's active org stays ORG_ID (different), so the ungated
# removal path still proves D-267-34 (the event row carries the THREAD's org, never the active one).
def _writer_patches(db: ThreadsDb, txn: FakeTxn, *, gate_org=THREAD_ORG, active_org=ORG_ID):
    from app.api import threads as threads_mod
    from tests.unit.test_267_scope_preview import scope_patches

    p1, p2, p3 = scope_patches()
    return [
        p1, p2, p3,
        patch.object(threads_mod, "aexec", db.aexec),
        patch.object(threads_mod, "get_user_pg_connection", txn),
        patch.object(threads_mod, "get_pg_pool", AsyncMock(return_value=MagicMock())),
        patch.object(threads_mod, "assert_expert_bindable", AsyncMock(return_value=({"id": "x"}, gate_org))),
        patch.object(threads_mod, "resolve_active_org_or_none", AsyncMock(return_value=active_org)),
        patch("app.dependencies.resolve_caller_role", AsyncMock(return_value=("member", set()))),
        # expert_scope's own supabase-py calls run through the REAL aexec against FakeSupabase.
    ]


async def _patch_thread(body, db, txn, sb=None, **kw):
    from contextlib import ExitStack

    from app.api import threads as threads_mod

    with ExitStack() as stack:
        for p in _writer_patches(db, txn, **kw):
            stack.enter_context(p)
        return await threads_mod.rename_thread(
            thread_id=THREAD_ID,
            body=body,
            request=MagicMock(),
            current_user={"id": USER_ID},
            supabase=sb or FakeSupabase(),
        )


@pytest.mark.asyncio
async def test_a_swap_on_a_thread_with_messages_writes_one_event_with_the_update_in_one_txn():
    db = ThreadsDb(before_expert=FA_ID, after_expert=HR_ID)
    txn = FakeTxn(FakeConn())
    resp = await _patch_thread(ThreadUpdate(active_expert_id=UUID(HR_ID)), db, txn)

    assert txn.entered == 1 and txn.committed is True
    sqls = [s for s, _ in txn.conn.executed]
    assert len(sqls) == 2
    assert sqls[0].lstrip().startswith("UPDATE public.threads")
    assert "INSERT INTO public.messages" in sqls[1]
    assert "org_id" in sqls[1]

    upd_args = txn.conn.executed[0][1]
    assert HR_ID in [str(a) for a in upd_args]

    ins_args = txn.conn.executed[1][1]
    thread_id, user_id, org_id, content, tool_calls = ins_args
    assert (str(thread_id), str(user_id)) == (THREAD_ID, USER_ID)
    # D-267-34: the THREAD's org, explicitly (WR-03: a bind now requires the gate's org to equal it).
    assert str(org_id) == THREAD_ORG
    assert isinstance(tool_calls, list) and len(tool_calls) == 1
    assert tool_calls[0]["kind"] == "expert_changed"
    assert tool_calls[0]["before"]["name"] == "Financial Analyzer"
    assert tool_calls[0]["after"]["name"] == "HR Advisor"
    assert tool_calls[0]["excluded"]["count"] == 4
    assert content.startswith("Financial Analyzer → HR Advisor.")

    # the event path never ALSO runs the supabase update
    assert db.updates() == []
    assert resp["active_expert_id"] == HR_ID


@pytest.mark.asyncio
async def test_an_unchanged_expert_writes_no_event():
    db = ThreadsDb(before_expert=HR_ID, after_expert=HR_ID)
    txn = FakeTxn(FakeConn())
    await _patch_thread(ThreadUpdate(active_expert_id=UUID(HR_ID)), db, txn)
    assert txn.entered == 0
    assert len(db.updates()) == 1


@pytest.mark.asyncio
async def test_a_title_only_patch_reads_nothing_extra_and_writes_no_event():
    db = ThreadsDb(before_expert=FA_ID, after_expert=FA_ID)
    txn = FakeTxn(FakeConn())
    await _patch_thread(ThreadUpdate(title="Renamed"), db, txn)
    assert txn.entered == 0
    selects = [q for q in db.seen if q.table_name == "threads" and not q.call("update")]
    assert [q.call("select")[0][1][0] for q in selects] == ["*"]
    assert [q for q in db.seen if q.table_name == "messages"] == []


@pytest.mark.asyncio
async def test_an_empty_thread_writes_no_event():
    """D-267-12: the spotlight card is the announcement on an empty thread."""
    db = ThreadsDb(before_expert=None, messages=0, after_expert=HR_ID)
    txn = FakeTxn(FakeConn())
    await _patch_thread(ThreadUpdate(active_expert_id=UUID(HR_ID)), db, txn)
    assert txn.entered == 0
    assert len(db.updates()) == 1
    msg_q = [q for q in db.seen if q.table_name == "messages"][0]
    assert msg_q.call("in_") == [("in_", ("role", ["user", "assistant"]), {})]


@pytest.mark.asyncio
async def test_clearing_a_thread_that_has_no_expert_writes_no_event():
    db = ThreadsDb(before_expert=None, after_expert=None)
    txn = FakeTxn(FakeConn())
    await _patch_thread(ThreadUpdate(clear_active_expert=True), db, txn)
    assert txn.entered == 0
    assert len(db.updates()) == 1


@pytest.mark.asyncio
async def test_a_removal_with_messages_writes_the_event():
    db = ThreadsDb(before_expert=FA_ID, after_expert=None)
    txn = FakeTxn(FakeConn())
    await _patch_thread(ThreadUpdate(clear_active_expert=True), db, txn)
    assert txn.entered == 1 and txn.committed is True
    tool_calls = txn.conn.executed[1][1][4]
    assert tool_calls[0]["after"] is None
    assert tool_calls[0]["before"]["name"] == "Financial Analyzer"


@pytest.mark.asyncio
async def test_a_failed_event_insert_rolls_the_update_back_and_says_so():
    db = ThreadsDb(before_expert=FA_ID, after_expert=HR_ID)
    txn = FakeTxn(FakeConn(fail_on="INSERT INTO public.messages"))
    with pytest.raises(HTTPException) as exc:
        await _patch_thread(ThreadUpdate(active_expert_id=UUID(HR_ID)), db, txn)
    assert exc.value.status_code == 500
    assert exc.value.detail == "The Expert was not changed."
    assert txn.entered == 1
    assert txn.committed is False  # the exception left the transaction: asyncpg rolls back
    assert db.updates() == []


# ── 267-REVIEW WR-04: no Expert change while this thread has a run streaming ─────────────────────
#
# The event row is inserted at once (created_at = now()), but the streaming assistant row is written
# when the run finalizes — so after the run-end reconcile the transcript read: question, "A → B · Now:
# B's folders", then the answer A's scope produced. The event's Now line sat above an answer it does
# not describe. The change is refused while a primary run streams ("From your next message" holds).


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "before,after",
    [(FA_ID, HR_ID), (None, HR_ID), (FA_ID, None)],
    ids=["swap", "join", "removal"],
)
async def test_WR04_an_expert_change_while_a_run_streams_is_refused_and_writes_nothing(before, after):
    db = ThreadsDb(before_expert=before, after_expert=after, streaming=[str(uuid4())])
    txn = FakeTxn(FakeConn())
    body = ThreadUpdate(active_expert_id=UUID(after)) if after else ThreadUpdate(clear_active_expert=True)
    with pytest.raises(HTTPException) as exc:
        await _patch_thread(body, db, txn)
    assert exc.value.status_code == 409
    assert exc.value.detail == "Wait for this answer to finish before changing the Expert."
    assert txn.entered == 0
    assert db.updates() == []


@pytest.mark.asyncio
async def test_WR04_with_no_run_streaming_the_swap_is_unchanged():
    db = ThreadsDb(before_expert=FA_ID, after_expert=HR_ID, streaming=[])
    txn = FakeTxn(FakeConn())
    await _patch_thread(ThreadUpdate(active_expert_id=UUID(HR_ID)), db, txn)
    assert txn.entered == 1 and txn.committed is True


# ── the transcript allowlist on the two read paths ─────────────────────────────────────────────


def _row(role, kind=None, tool_calls="__kind__"):
    tc = [{"kind": kind}] if tool_calls == "__kind__" and kind else (None if tool_calls == "__kind__" else tool_calls)
    return {"id": str(uuid4()), "role": role, "content": role, "tool_calls": tc}


MIXED = [
    _row("user"),
    _row("assistant"),
    _row("system", "expert_changed"),
    _row("system", "expert_handoff"),
    _row("system", "ask_user_prompt"),
    _row("system", "ask_user_response"),
    _row("system", "context_truncated"),
    _row("system", "iteration_cap_paused"),
    _row("system", tool_calls=None),
    _row("system", tool_calls=[]),
]


def test_visible_transcript_rows_is_an_allowlist():
    from app.api.threads import _visible_transcript_rows

    kept = _visible_transcript_rows(MIXED)
    assert [(r["role"], (r["tool_calls"] or [{}])[0].get("kind")) for r in kept] == [
        ("user", None),
        ("assistant", None),
        ("system", "expert_changed"),
        ("system", "expert_handoff"),
    ]


def test_neither_read_path_filters_system_rows_in_sql_any_more():
    src = (pathlib.Path(__file__).resolve().parents[2] / "app" / "api" / "threads.py").read_text(encoding="utf-8")
    assert 'neq("role", "system")' not in src


@pytest.mark.asyncio
async def test_snapshot_returns_only_allowlisted_system_kinds():
    from app.api import threads as threads_mod

    answers = [SimpleNamespace(data={"id": THREAD_ID}), SimpleNamespace(data=list(MIXED)), SimpleNamespace(data=[])]
    seen = []

    async def _aexec(q):
        seen.append(q)
        return answers[len(seen) - 1]

    async def _identity(messages, **kw):
        return messages

    with patch.object(threads_mod, "aexec", _aexec), patch.object(threads_mod, "_enrich_messages_with_runs", _identity):
        res = await threads_mod.get_snapshot(
            thread_id=UUID(THREAD_ID), current_user={"id": USER_ID}, supabase=FakeSupabase(), redis=MagicMock(),
        )
    kinds = [(m["role"], (m["tool_calls"] or [{}])[0].get("kind")) for m in res["messages"]]
    assert kinds == [("user", None), ("assistant", None), ("system", "expert_changed"), ("system", "expert_handoff")]
    assert seen[1].table_name == "messages" and seen[1].call("neq") == []


@pytest.mark.asyncio
async def test_get_messages_returns_only_allowlisted_system_kinds():
    from app.api import threads as threads_mod

    answers = [SimpleNamespace(data={"id": THREAD_ID}), SimpleNamespace(data=list(MIXED))]
    seen = []

    async def _aexec(q):
        seen.append(q)
        return answers[len(seen) - 1]

    async def _identity(messages, **kw):
        return messages

    with patch.object(threads_mod, "aexec", _aexec), patch.object(threads_mod, "_enrich_messages_with_runs", _identity):
        res = await threads_mod.get_messages(thread_id=THREAD_ID, current_user={"id": USER_ID}, supabase=FakeSupabase())
    assert [m["role"] for m in res] == ["user", "assistant", "system", "system"]
    assert seen[1].call("neq") == []
