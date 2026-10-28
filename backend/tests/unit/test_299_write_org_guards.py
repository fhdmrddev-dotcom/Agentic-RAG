"""Phase 299 (299-01, D-18 / D-38 / T-299-07 / T-299-09) — a write from an item page lands in the
item's org, or is refused in words.

A person can open a link to an item in another of their orgs. If they then switch orgs by hand
while that page is open, every write the page can start must either take its org from the ROW, or
be refused with a sentence that names the item's org and says what to do. The write inventory:

  * send / Continue on a NON-Expert thread — refused (409, chat sentence) when the resolved active
    org differs from the thread's org; an Expert thread keeps ``_require_thread_org``'s own 409 first;
  * workflow kickoff — refused (409, run sentence) for a NON-global definition whose org differs
    from the thread's org; a system-global definition is never refused;
  * POST /workflows with ``from_definition_id`` (Tweak) — refused (409, tweak sentence) when the
    caller's OWN non-global source lives in another org than the active one; an unreadable or
    foreign source id is silent (the guard is never an existence oracle);
  * the ask_user answer message and a new schedule are STAMPED with the item's org (Task 3 cases).

Polarity (298 D-03): every guard is a no-op when no active org resolves — a header-less caller is
byte-identical to today. Nothing here touches Postgres.
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from fastapi.responses import JSONResponse

USER = str(uuid4())
ORG_A = str(uuid4())
ORG_B = str(uuid4())
ORGS = {ORG_A: "Acme Legal", ORG_B: "Personal"}

CHAT_A = "This chat is in Acme Legal. Switch to Acme Legal to keep chatting."
RUN_A = "This workflow is in Acme Legal. Switch to Acme Legal to run it."
TWEAK_A = "This workflow is in Acme Legal. Switch to Acme Legal to make your own copy."


class OrgPool:
    """Answers the org-name read and the owner-scoped source-org read; records every statement."""

    def __init__(self, *, definitions: dict | None = None, names: dict | None = None,
                 boom: bool = False):
        self.calls: list[tuple[str, tuple]] = []
        self.definitions = definitions or {}
        self.names = ORGS if names is None else names
        self.boom = boom

    async def fetchval(self, sql, *args):
        flat = " ".join(sql.split())
        self.calls.append((flat, args))
        if self.boom:
            raise RuntimeError("db down")
        if "FROM public.organizations" in flat:
            return self.names.get(str(args[0]))
        if "FROM public.workflow_definitions" in flat:
            row = self.definitions.get(str(args[0]))
            if row is None or str(row["created_by"]) != str(args[1]):
                return None
            return None if row.get("is_system_global") else UUID(row["org_id"])
        raise AssertionError(f"unexpected fetchval: {flat}")

    async def fetch(self, sql, *args):  # raise_if_foreign on an unbound definition reads nothing
        raise AssertionError(f"unexpected fetch: {sql}")

    async def fetchrow(self, sql, *args):
        raise AssertionError(f"unexpected fetchrow: {sql}")


def _guard():
    from app.services import item_org_guard

    return item_org_guard


# ── §1 the helper ────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("row_org, active", [(ORG_A, None), (None, ORG_B), (None, None), (ORG_A, "")])
async def test_no_active_org_or_no_row_org_is_a_no_op_without_io(row_org, active):
    pool = OrgPool()
    await _guard().refuse_if_other_org(row_org, active, kind="chat", pool=pool)
    assert pool.calls == []


async def test_the_same_org_is_a_no_op_without_io_whatever_its_type():
    pool = OrgPool()
    await _guard().refuse_if_other_org(UUID(ORG_A), ORG_A.upper(), kind="run", pool=pool)
    await _guard().refuse_if_other_org(ORG_A, UUID(ORG_A), kind="run", pool=pool)
    assert pool.calls == []


@pytest.mark.parametrize("kind, sentence", [("chat", CHAT_A), ("run", RUN_A), ("tweak", TWEAK_A)])
async def test_another_org_is_a_409_that_names_the_items_org(kind, sentence):
    pool = OrgPool()
    with pytest.raises(HTTPException) as exc:
        await _guard().refuse_if_other_org(ORG_A, ORG_B, kind=kind, pool=pool)
    assert exc.value.status_code == 409
    assert exc.value.detail == sentence
    assert len(pool.calls) == 1 and "FROM public.organizations" in pool.calls[0][0]
    assert pool.calls[0][1] == (UUID(ORG_A),)


@pytest.mark.parametrize("names, boom", [({}, False), (ORGS, True)])
async def test_an_unreadable_org_name_still_says_what_to_do(names, boom):
    pool = OrgPool(names=names, boom=boom)
    with pytest.raises(HTTPException) as exc:
        await _guard().refuse_if_other_org(ORG_A, ORG_B, kind="chat", pool=pool)
    assert exc.value.status_code == 409
    assert "another of your organizations" in exc.value.detail
    assert "keep chatting" in exc.value.detail


async def test_a_pool_factory_is_only_resolved_on_a_mismatch():
    pool = OrgPool()
    factory = AsyncMock(return_value=pool)
    await _guard().refuse_if_other_org(ORG_A, ORG_A, kind="chat", pool=factory)
    await _guard().refuse_if_other_org(ORG_A, None, kind="chat", pool=factory)
    factory.assert_not_awaited()
    with pytest.raises(HTTPException):
        await _guard().refuse_if_other_org(ORG_A, ORG_B, kind="chat", pool=factory)
    factory.assert_awaited_once()


def test_no_sentence_carries_a_status_word():
    sentences = list(_guard().REFUSALS.values()) + list(_guard().REFUSALS_UNNAMED.values())
    assert len(sentences) == 6
    for s in sentences:
        for word in ("409", "conflict", "forbidden", "invalid"):
            assert word not in s.lower(), (word, s)


# ── §2 send_message ──────────────────────────────────────────────────────────────────────────

SENTINEL = JSONResponse({"passed": "the guard"})


async def _send(thread_row: dict, *, active_org, pool=None):
    from app.api import threads as threads_mod

    pool = pool or OrgPool()
    aexec = AsyncMock(return_value=SimpleNamespace(data=thread_row))
    typed = AsyncMock(return_value=SENTINEL)
    with patch.object(threads_mod, "resolve_active_org_or_none", AsyncMock(return_value=active_org)), \
            patch.object(threads_mod, "aexec", aexec), \
            patch.object(threads_mod, "get_pg_pool", AsyncMock(return_value=pool)), \
            patch.object(threads_mod, "_typed_continue_or_none", typed):
        try:
            out = await threads_mod.send_message(
                thread_id=str(thread_row["id"]),
                body=SimpleNamespace(content="hi", workflow_definition_id=None),
                request=SimpleNamespace(headers={}, state=SimpleNamespace()),
                current_user={"id": USER}, supabase=MagicMock(), service_supabase=MagicMock(),
                redis=MagicMock(),
            )
            return out, None, aexec, typed, pool
        except HTTPException as exc:
            return None, exc, aexec, typed, pool


def _thread(org=ORG_A, expert=None):
    return {"id": str(uuid4()), "active_workflow_run_id": None, "org_id": org,
            "active_expert_id": expert}


async def test_send_on_another_orgs_chat_is_refused_before_anything_is_written():
    out, exc, aexec, typed, _ = await _send(_thread(), active_org=ORG_B)
    assert exc is not None and exc.status_code == 409 and exc.detail == CHAT_A
    assert aexec.await_count == 1  # the thread read only — no user-message INSERT
    typed.assert_not_awaited()  # refused before the typed Continue and the preflight


async def test_send_with_no_active_org_is_todays_behaviour():
    out, exc, aexec, typed, pool = await _send(_thread(), active_org=None)
    assert exc is None and out is SENTINEL
    assert pool.calls == []


async def test_send_in_the_chats_own_org_passes():
    out, exc, _aexec, _typed, pool = await _send(_thread(), active_org=ORG_A)
    assert exc is None and out is SENTINEL
    assert pool.calls == []


async def test_an_expert_thread_keeps_its_own_refusal_first():
    _out, exc, _aexec, _typed, pool = await _send(_thread(expert=str(uuid4())), active_org=ORG_B)
    assert exc is not None and exc.status_code == 409
    assert exc.detail == "Switch to this chat's organization to keep chatting with its Expert."
    assert pool.calls == []


# ── §3 workflow kickoff (preflight) ──────────────────────────────────────────────────────────


def _defn_json():
    return {"slug": "wf", "version": 1, "name": "Contract review",
            "phases": [{"slug": "p0", "phase_index": 0,
                        "config": {"phase_type": "llm_single", "prompt": "Go."}}]}


async def _preflight(*, def_org, glob, thread_org):
    from app.services import workflow_kickoff
    from app.services.entitlement_service import EntitlementResult

    pool = OrgPool()
    row = {"id": str(uuid4()), "definition": _defn_json(), "status": "published",
           "is_system_global": glob, "created_by": USER, "skill_snapshots": None,
           "org_id": def_org}
    allowed = EntitlementResult(allowed=True, capability="workflows", current_tier="enterprise")

    async def _passthrough(**kw):
        return kw["definition"]

    with (
        patch("app.api.threads.workflows_enabled", return_value=True),
        patch("app.api.threads.get_pg_pool", new_callable=AsyncMock, return_value=pool),
        patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock,
              return_value=allowed),
        patch.object(workflow_kickoff, "aexec", AsyncMock(return_value=SimpleNamespace(data=row))),
        patch.object(workflow_kickoff, "assert_folder_scopes_subset", AsyncMock()),
        patch.object(workflow_kickoff, "_ensure_skill_snapshots", side_effect=_passthrough) as snap,
        patch("app.services.template_service.pin_templates_for_run", AsyncMock()),
    ):
        try:
            out = await workflow_kickoff.preflight_workflow_kickoff(
                request=MagicMock(), body=SimpleNamespace(workflow_definition_id=uuid4(), inputs={}),
                thread_id=str(uuid4()),
                thread_row={"active_workflow_run_id": None, "org_id": thread_org},
                supabase=MagicMock(), current_user={"id": USER, "org_id": thread_org},
            )
            return out, None, snap, pool
        except HTTPException as exc:
            return None, exc, snap, pool


async def test_kickoff_of_another_orgs_workflow_is_refused():
    out, exc, snap, _pool = await _preflight(def_org=ORG_A, glob=False, thread_org=ORG_B)
    assert exc is not None and exc.status_code == 409 and exc.detail == RUN_A
    snap.assert_not_called()  # refused before the snapshot materialize


async def test_kickoff_of_a_global_workflow_is_never_refused():
    out, exc, _snap, pool = await _preflight(def_org=ORG_A, glob=True, thread_org=ORG_B)
    assert exc is None and out is not None
    assert not [c for c in pool.calls if "organizations" in c[0]]


async def test_kickoff_in_the_same_org_passes():
    out, exc, _snap, pool = await _preflight(def_org=ORG_A, glob=False, thread_org=ORG_A)
    assert exc is None and out is not None
    assert not [c for c in pool.calls if "organizations" in c[0]]


# ── §4 Tweak: POST /workflows?from_definition_id= ────────────────────────────────────────────

SRC = str(uuid4())


async def _create(*, active_org, from_definition_id="__absent__", definitions=None):
    import app.api.workflows as workflows_mod
    from app.models.harness import WorkflowDefinition

    pool = OrgPool(definitions=definitions)
    created = AsyncMock(return_value={"id": uuid4(), "version": 1, "token": "t"})
    kwargs = {} if from_definition_id == "__absent__" else {"from_definition_id": from_definition_id}
    with patch.object(workflows_mod, "get_pg_pool", AsyncMock(return_value=pool)), \
            patch.object(workflows_mod, "resolve_active_org_or_none", AsyncMock(return_value=active_org)), \
            patch.object(workflows_mod, "assert_phase_models_registered", AsyncMock()), \
            patch.object(workflows_mod, "create_workflow_definition", created):
        try:
            await workflows_mod.create_draft(
                body=WorkflowDefinition.model_validate(_defn_json()),
                request=SimpleNamespace(headers={}, state=SimpleNamespace()),
                current_user={"id": USER}, **kwargs,
            )
            return created, None, pool
        except HTTPException as exc:
            return created, exc, pool


def _src(org=ORG_A, owner=USER, glob=False):
    return {SRC: {"org_id": org, "created_by": owner, "is_system_global": glob}}


async def test_tweak_of_your_workflow_in_another_org_is_refused_and_mints_nothing():
    created, exc, _pool = await _create(active_org=ORG_B, from_definition_id=SRC, definitions=_src())
    assert exc is not None and exc.status_code == 409 and exc.detail == TWEAK_A
    created.assert_not_called()


async def test_create_without_the_param_is_byte_identical_to_today():
    created, exc, pool = await _create(active_org=ORG_B)
    assert exc is None
    created.assert_awaited_once()
    assert pool.calls == []


async def test_tweak_of_a_global_source_is_not_refused():
    created, exc, _ = await _create(active_org=ORG_B, from_definition_id=SRC,
                                    definitions=_src(glob=True))
    assert exc is None
    created.assert_awaited_once()


async def test_tweak_of_an_unreadable_source_is_silent():
    """Someone else's definition (or none at all) reads as no org — never a 409 naming its org."""
    for defs in (_src(owner=str(uuid4())), {}):
        created, exc, pool = await _create(active_org=ORG_B, from_definition_id=SRC, definitions=defs)
        assert exc is None
        created.assert_awaited_once()
        assert not [c for c in pool.calls if "organizations" in c[0]]


async def test_tweak_with_a_malformed_id_or_no_active_org_reads_nothing():
    for active, src in ((ORG_B, "not-a-uuid"), (None, SRC)):
        created, exc, pool = await _create(active_org=active, from_definition_id=src,
                                           definitions=_src())
        assert exc is None
        created.assert_awaited_once()
        assert not [c for c in pool.calls if "workflow_definitions" in c[0] or "organizations" in c[0]]


async def test_tweak_in_the_same_org_passes():
    created, exc, _ = await _create(active_org=ORG_A, from_definition_id=SRC, definitions=_src())
    assert exc is None
    created.assert_awaited_once()


def test_the_source_org_read_is_owner_scoped():
    from app.services import link_resolver

    sql = " ".join(link_resolver.WORKFLOW_ORG_SQL.split())
    assert "d.created_by = $2" in sql
    assert "CASE WHEN d.is_system_global THEN NULL ELSE d.org_id END" in sql


def test_create_draft_declares_the_optional_query_param():
    import inspect

    import app.api.workflows as workflows_mod

    sig = inspect.signature(workflows_mod.create_draft)
    param = sig.parameters["from_definition_id"]
    # A plain None default (Annotated Query), so a DIRECT caller that omits it gets None — never a
    # truthy FieldInfo object that would send every direct create down the guarded read.
    assert param.default is None
    assert "Query" in repr(param.annotation) or "Query" in json.dumps(str(param.annotation))


# ── §5 the ask_user answer is stamped with the RUN's org (Task 3) ───────────────────────────


class _Builder:
    def __init__(self, table):
        self.table, self.cols, self.payload, self.filters = table, None, None, []

    def select(self, cols):
        self.cols = cols
        return self

    def eq(self, k, v):
        self.filters.append((k, v))
        return self

    def maybe_single(self):
        return self

    def insert(self, payload):
        self.payload = payload
        return self


class _Supabase:
    def __init__(self):
        self.builders: list[_Builder] = []

    def table(self, name):
        b = _Builder(name)
        self.builders.append(b)
        return b


async def _answer(*, deep_row, wf_row=None, anchor=None):
    from app.api import runs as runs_mod

    sb = _Supabase()
    run_id = uuid4()

    async def fake_aexec(b):
        if b.payload is not None:
            return SimpleNamespace(data=[{"id": str(uuid4())}])
        if b.table == "runs":
            return SimpleNamespace(data=deep_row)
        if b.table == "workflow_runs":
            return SimpleNamespace(data=wf_row)
        if b.table == "threads":
            return SimpleNamespace(data={"active_workflow_run_id": str(run_id)} if anchor else None)
        raise AssertionError(b.table)

    body = SimpleNamespace(tool_call_id="tc1", response_text="Yes", choice_index=0, folder_id=None)
    with patch.object(runs_mod, "aexec", side_effect=fake_aexec), \
            patch.object(runs_mod, "_is_current_question", AsyncMock(return_value=True)), \
            patch.object(runs_mod, "_engine_answer_refusal", AsyncMock(return_value=None)), \
            patch.object(runs_mod, "_redrive_paused_workflow_run", AsyncMock()), \
            patch("app.api.threads._emit", AsyncMock()), \
            patch("app.services.ask_user_service.publish_response", AsyncMock()):
        out = await runs_mod.submit_ask_user_response(
            run_id=run_id, body=body, current_user={"id": USER}, supabase=sb, redis=MagicMock())
    inserts = [b for b in sb.builders if b.payload is not None]
    return out, sb, inserts


async def test_a_deep_answer_carries_the_runs_org():
    out, sb, inserts = await _answer(deep_row={"run_id": "r", "thread_id": "t", "status": "active",
                                               "org_id": ORG_A})
    assert out == {"status": "ok"}
    runs_select = [b for b in sb.builders if b.table == "runs"][0]
    assert "org_id" in [c.strip() for c in runs_select.cols.split(",")]
    assert len(inserts) == 1 and inserts[0].table == "messages"
    assert inserts[0].payload["org_id"] == ORG_A


async def test_a_workflow_answer_carries_the_workflow_runs_org():
    out, sb, inserts = await _answer(deep_row=None,
                                     wf_row={"id": "w", "thread_id": "t", "org_id": ORG_A},
                                     anchor=True)
    assert out == {"status": "ok"}
    wf_select = [b for b in sb.builders if b.table == "workflow_runs"][0]
    assert "org_id" in [c.strip() for c in wf_select.cols.split(",")]
    assert inserts[0].payload["org_id"] == ORG_A
    assert inserts[0].payload["origin"] == "harness"


# ── §6 a new schedule is stamped with the definition's org (Task 3) ─────────────────────────

BASE_CREATE_SCHEDULE_SQL_SHA256 = "45acad7ff821ef9ccd7f3a5f701ffaa795a19df56225f03583035571edb5a9bf"


class _SchedPool:
    def __init__(self):
        self.calls: list[tuple[str, tuple]] = []

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        return {}


def _sched_kwargs(**extra):
    return dict(workflow_id=uuid4(), user_id=uuid4(), name="n", cron_expression="0 * * * *",
                interval_seconds=None, timezone="UTC", is_active=True, max_tokens_per_run=1,
                max_duration_seconds=1, inputs={}, **extra)


async def test_create_schedule_without_an_org_issues_todays_insert_byte_for_byte():
    import hashlib

    from app.db import schedules

    pool = _SchedPool()
    await schedules.create_schedule(pool, **_sched_kwargs())
    sql, args = pool.calls[0]
    assert hashlib.sha256(sql.encode()).hexdigest() == BASE_CREATE_SCHEDULE_SQL_SHA256
    assert len(args) == 11


async def test_create_schedule_with_an_org_names_and_binds_the_column():
    from app.db import schedules

    pool = _SchedPool()
    await schedules.create_schedule(pool, **_sched_kwargs(org_id=UUID(ORG_A)))
    sql, args = pool.calls[0]
    flat = " ".join(sql.split())
    assert "next_run_at, org_id)" in flat and "$12)" in flat
    assert args[-1] == UUID(ORG_A) and len(args) == 12


async def _schedule_route(*, definitions, active_org):
    from app.api import schedules as sched_api

    pool = OrgPool(definitions=definitions)
    created = AsyncMock(return_value={"id": uuid4()})
    wf = next(iter(definitions)) if definitions else str(uuid4())
    body = SimpleNamespace(name="n", cron_expression="0 * * * *", interval_seconds=None,
                           timezone="UTC", is_active=True, max_tokens_per_run=1,
                           max_duration_seconds=1, inputs={})
    with patch.object(sched_api, "get_pg_pool", AsyncMock(return_value=pool)), \
            patch.object(sched_api, "get_definition", AsyncMock(return_value={"status": "published"})), \
            patch.object(sched_api, "create_schedule", created), \
            patch.object(sched_api, "_serialize", lambda row: row), \
            patch("app.services.org_lists.resolve_active_org_or_none", AsyncMock(return_value=active_org)):
        await sched_api.create_workflow_schedule(
            workflow_id=UUID(wf), body=body, current_user={"id": USER},
            request=SimpleNamespace(headers={}, state=SimpleNamespace()),
        )
    return created.await_args.kwargs


async def test_a_schedule_of_your_workflow_is_stamped_with_its_org_not_the_active_one():
    kw = await _schedule_route(definitions=_src(org=ORG_A), active_org=ORG_B)
    assert kw["org_id"] == UUID(ORG_A)


async def test_a_schedule_of_a_global_workflow_is_stamped_with_the_active_org():
    kw = await _schedule_route(definitions=_src(glob=True), active_org=ORG_B)
    assert kw["org_id"] == UUID(ORG_B)


async def test_a_schedule_of_a_global_workflow_with_no_active_org_leaves_it_to_the_trigger():
    kw = await _schedule_route(definitions=_src(glob=True), active_org=None)
    assert kw.get("org_id") is None
