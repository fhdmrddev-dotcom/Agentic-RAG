"""Phase 298-02 (ORG-05) — a workflow may not point at another org's folder.

The rule (D-13): every folder the definition binds lives in the DEFINITION's org. The set is every
folder the definition names (D-34): ``project_folder_id``, each phase ``config.folder_scope``, each
kb_auto ``inputs[].folder_scope`` and ``output_target_folder``, in that order.

Where it is enforced, through ONE helper (``app.services.foreign_folder_refusal``):

  * save — ``create_draft`` (against the active org it stamps; header-less = against the org the
    mig-106 trigger stamps, 298-review WR-06 / D-298-09) and ``update_draft`` (only ids the request ADDS or CHANGES; an
    unchanged stored foreign binding saves through, preserved). Coded 422 (D-36).
  * launch — the attended preflight (coded 422), the scheduler (a recorded schedule outcome,
    then ``ScheduledLaunchRefused``) and the API-key start (``_refused(reason="foreign_folder")``,
    a plain-string 422). D-30.

The words (D-14 / UI-SPEC §3) name the folder and both orgs when the caller can see the folder,
and never name the folder's org when the caller cannot.

Nothing here touches Postgres: the pool is a fake that answers by SQL shape and records every
statement, and every collaborator a route calls is patched.
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

import app.api.workflows as workflows_mod
from app.models.harness import WorkflowDefinition

USER = str(uuid4())
OTHER_USER = str(uuid4())
ORG_A = str(uuid4())  # "Personal" — the definition's org
ORG_B = str(uuid4())  # "Acme Legal"

F_A1 = str(uuid4())  # in-org, owned
F_A2 = str(uuid4())  # in-org, owned
F_B1 = str(uuid4())  # "Q3 Contracts" — org B, owned by USER
F_B2 = str(uuid4())  # "Board Minutes" — org B, owned by USER
F_B3 = str(uuid4())  # "Payroll" — org B, owned by OTHER_USER (the caller cannot open it)
F_B4 = str(uuid4())  # "Tax" — org B, owned by USER
F_MISSING = str(uuid4())  # no such folder

FOLDERS = {
    F_A1: {"id": F_A1, "name": "Client Files", "org_id": ORG_A, "user_id": USER},
    F_A2: {"id": F_A2, "name": "Drafts", "org_id": ORG_A, "user_id": USER},
    F_B1: {"id": F_B1, "name": "Q3 Contracts", "org_id": ORG_B, "user_id": USER},
    F_B2: {"id": F_B2, "name": "Board Minutes", "org_id": ORG_B, "user_id": USER},
    F_B3: {"id": F_B3, "name": "Payroll", "org_id": ORG_B, "user_id": OTHER_USER},
    F_B4: {"id": F_B4, "name": "Tax", "org_id": ORG_B, "user_id": USER},
}
ORGS = {ORG_A: "Personal", ORG_B: "Acme Legal"}

ONE_VISIBLE = (
    "“Q3 Contracts” is in Acme Legal, not in this workflow's organization (Personal). "
    "Pick a folder from Personal."
)
CANT_OPEN = (
    "This workflow points at a folder you can't open. "
    "Pick a folder from this workflow's organization (Personal)."
)


class FakePool:
    """Answers by SQL shape; records every statement in ``calls``."""

    def __init__(self, *, definitions: dict | None = None, owner_org: str | None = None):
        self.calls: list[tuple[str, tuple]] = []
        self.definitions = definitions or {}
        self.owner_org = owner_org  # the org the mig-106 trigger would stamp (298-review WR-06)

    def _log(self, sql, args):
        flat = " ".join(sql.split())
        self.calls.append((flat, args))
        return flat

    async def fetch(self, sql, *args):
        flat = self._log(sql, args)
        ids = [str(i) for i in (args[0] if args else [])]
        if "FROM folders" in flat:
            return [dict(FOLDERS[i]) for i in ids if i in FOLDERS]
        if "FROM organizations" in flat:
            return [{"id": i, "name": ORGS[i]} for i in ids if i in ORGS]
        raise AssertionError(f"unexpected fetch: {flat}")

    async def fetchrow(self, sql, *args):
        flat = self._log(sql, args)
        if "FROM workflow_definitions" in flat:
            row = self.definitions.get(str(args[0]))
            if row is None or str(row["created_by"]) != str(args[1]):
                return None
            return dict(row)
        raise AssertionError(f"unexpected fetchrow: {flat}")

    async def fetchval(self, sql, *args):
        flat = self._log(sql, args)
        if "FROM public.org_members" in flat:
            return self.owner_org
        if "FROM workflow_definitions" in flat:
            row = self.definitions.get(str(args[0]))
            if row is None:
                return None
            if "is_system_global" in flat and row.get("is_system_global"):
                return None
            return row["org_id"]
        raise AssertionError(f"unexpected fetchval: {flat}")

    def sql(self):
        return [c[0] for c in self.calls]


def _defn(*, project=None, phase_scopes=(), kb=None, output=None, as_json=False):
    phases = [
        {
            "slug": f"p{i}", "phase_index": i,
            "config": {"phase_type": "llm_single", "prompt": "Go.",
                       **({"folder_scope": scope} if scope is not None else {})},
        }
        for i, scope in enumerate(phase_scopes or [None])
    ]
    d = {"slug": "wf", "version": 1, "name": "Contract review", "phases": phases,
         "project_folder_id": project, "output_target_folder": output}
    if kb is not None:
        d["inputs"] = [{"key": "kb", "label": "Knowledge", "type": "kb_auto",
                        "source": "kb_auto", "folder_scope": kb}]
    return json.dumps(d) if as_json else d


def _ffr():
    from app.services import foreign_folder_refusal

    return foreign_folder_refusal


# ── bound_folder_ids (D-34) ──────────────────────────────────────────────────────────────────


def test_the_bound_set_is_every_named_folder_in_definition_order_de_duplicated():
    d = _defn(project=F_A1, phase_scopes=[[F_A2, F_B1], [F_A1]], kb=[F_B2], output=F_B4)
    assert _ffr().bound_folder_ids(d) == [F_A1, F_A2, F_B1, F_B2, F_B4]


def test_the_bound_set_reads_a_json_string_a_model_and_ignores_nulls():
    d = _defn(project=F_A1, phase_scopes=[[F_B1]], kb=None, output=None)
    assert _ffr().bound_folder_ids(json.dumps(d)) == [F_A1, F_B1]
    assert _ffr().bound_folder_ids(WorkflowDefinition.model_validate(d)) == [F_A1, F_B1]
    assert _ffr().bound_folder_ids(_defn()) == []
    assert _ffr().bound_folder_ids(None) == []
    assert _ffr().bound_folder_ids("not json") == []


# ── foreign_binding_refusal: when it says nothing ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_an_in_org_binding_is_never_refused():
    pool = FakePool()
    d = _defn(project=F_A1, phase_scopes=[[F_A2]], kb=[F_A1], output=F_A2)
    assert await _ffr().foreign_binding_refusal(
        d, definition_org=ORG_A, pool=pool, user_id=USER) is None


@pytest.mark.asyncio
async def test_empty_candidates_read_nothing_and_say_nothing():
    pool = FakePool()
    d = _defn(project=F_B1)
    assert await _ffr().foreign_binding_refusal(
        d, definition_org=ORG_A, pool=pool, user_id=USER, candidates=[]) is None
    assert pool.calls == []


@pytest.mark.asyncio
async def test_an_unbound_definition_reads_nothing():
    pool = FakePool()
    assert await _ffr().foreign_binding_refusal(
        _defn(), definition_org=ORG_A, pool=pool, user_id=USER) is None
    assert pool.calls == []


@pytest.mark.asyncio
async def test_a_missing_folder_is_not_an_org_offender():
    pool = FakePool()
    d = _defn(project=F_MISSING)
    assert await _ffr().foreign_binding_refusal(
        d, definition_org=ORG_A, pool=pool, user_id=USER) is None


@pytest.mark.asyncio
async def test_no_definition_org_means_no_check():
    pool = FakePool()
    d = _defn(project=F_B1)
    assert await _ffr().foreign_binding_refusal(
        d, definition_org=None, pool=pool, user_id=USER) is None
    assert pool.calls == []


# ── the words (D-14 / UI-SPEC §3) ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_one_visible_offender_names_the_folder_and_both_orgs():
    pool = FakePool()
    d = _defn(project=F_A1, phase_scopes=[[F_B1]])
    with patch.object(_ffr(), "folder_scope_violations", AsyncMock()) as fsv:
        out = await _ffr().foreign_binding_refusal(d, definition_org=ORG_A, pool=pool, user_id=USER)
    assert out == ONE_VISIBLE
    fsv.assert_not_called()  # no client → the pool read alone decides


@pytest.mark.asyncio
async def test_two_more_offenders_name_the_first_and_count_the_rest():
    pool = FakePool()
    d = _defn(project=F_A1, phase_scopes=[[F_B1]], kb=[F_B2], output=F_B4)
    out = await _ffr().foreign_binding_refusal(d, definition_org=ORG_A, pool=pool, user_id=USER)
    assert out == ONE_VISIBLE + " 2 other folders this workflow uses are outside Personal too."


@pytest.mark.asyncio
async def test_one_more_offender_is_singular():
    pool = FakePool()
    d = _defn(project=F_A1, phase_scopes=[[F_B1]], output=F_B2)
    out = await _ffr().foreign_binding_refusal(d, definition_org=ORG_A, pool=pool, user_id=USER)
    assert out == ONE_VISIBLE + " 1 other folder this workflow uses is outside Personal too."


@pytest.mark.asyncio
async def test_a_folder_the_caller_cannot_open_never_names_its_org():
    pool = FakePool()
    d = _defn(output=F_B3)  # owned by OTHER_USER; no client → only owned folders count as visible
    out = await _ffr().foreign_binding_refusal(d, definition_org=ORG_A, pool=pool, user_id=USER)
    assert out == CANT_OPEN
    assert "Acme" not in out and "Payroll" not in out


@pytest.mark.asyncio
async def test_with_a_client_visibility_is_the_unrestricted_visible_set():
    """An org-shared folder another member owns is visible to the caller → named."""
    pool = FakePool()
    d = _defn(output=F_B3)
    calls = []

    async def fake_fvf(supabase, user_id, **kw):
        calls.append(kw)
        return [FOLDERS[F_B3]]

    with patch.object(_ffr(), "fetch_visible_folders", fake_fvf):
        out = await _ffr().foreign_binding_refusal(
            d, definition_org=ORG_A, pool=pool, user_id=USER, supabase=MagicMock())
    assert out.startswith("“Payroll” is in Acme Legal")
    assert calls == [{}], "the visible set is read UNRESTRICTED (no restrict_org_ids keyword)"


@pytest.mark.asyncio
async def test_with_a_client_an_invisible_offender_reads_cant_open():
    pool = FakePool()
    d = _defn(output=F_B1)

    async def fake_fvf(supabase, user_id, **kw):
        return []

    with patch.object(_ffr(), "fetch_visible_folders", fake_fvf):
        out = await _ffr().foreign_binding_refusal(
            d, definition_org=ORG_A, pool=pool, user_id=USER, supabase=MagicMock())
    assert out == CANT_OPEN


# ── publish parity (D-13 rule reuse) ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_project_arm_offender_publish_accepts_is_not_refused():
    pool = FakePool()
    d = _defn(project=F_B1)
    fsv = AsyncMock(return_value=[])
    with patch.object(_ffr(), "folder_scope_violations", fsv), \
            patch.object(_ffr(), "fetch_visible_folders", AsyncMock(return_value=[FOLDERS[F_B1]])):
        out = await _ffr().foreign_binding_refusal(
            d, definition_org=ORG_A, pool=pool, user_id=USER, supabase=MagicMock())
    assert out is None
    assert fsv.await_count == 1
    kw = fsv.await_args.kwargs
    assert kw["restrict_org_ids"] == {ORG_A} and kw["user_id"] == USER


@pytest.mark.asyncio
async def test_a_project_arm_offender_publish_refuses_is_refused():
    from app.services.harness.scope import FolderScopeSubsetError

    pool = FakePool()
    d = _defn(project=F_B1)
    fsv = AsyncMock(return_value=[FolderScopeSubsetError("x", phase_slug=None)])
    with patch.object(_ffr(), "folder_scope_violations", fsv), \
            patch.object(_ffr(), "fetch_visible_folders", AsyncMock(return_value=[FOLDERS[F_B1]])):
        out = await _ffr().foreign_binding_refusal(
            d, definition_org=ORG_A, pool=pool, user_id=USER, supabase=MagicMock())
    assert out == ONE_VISIBLE


@pytest.mark.asyncio
async def test_a_kb_auto_or_output_offender_relies_on_the_pool_read_alone():
    pool = FakePool()
    d = _defn(project=F_A1, kb=[F_B1])
    fsv = AsyncMock(return_value=[])
    with patch.object(_ffr(), "folder_scope_violations", fsv), \
            patch.object(_ffr(), "fetch_visible_folders", AsyncMock(return_value=[FOLDERS[F_B1]])):
        out = await _ffr().foreign_binding_refusal(
            d, definition_org=ORG_A, pool=pool, user_id=USER, supabase=MagicMock())
    assert out == ONE_VISIBLE
    fsv.assert_not_called()


@pytest.mark.asyncio
async def test_the_definition_org_can_be_read_from_the_row_and_globals_are_skipped():
    gid, did = str(uuid4()), str(uuid4())
    pool = FakePool(definitions={
        did: {"org_id": ORG_A, "created_by": USER, "is_system_global": False, "definition": "{}"},
        gid: {"org_id": ORG_B, "created_by": USER, "is_system_global": True, "definition": "{}"},
    })
    d = _defn(project=F_B1)
    assert await _ffr().definition_org_id(pool, did) == ORG_A
    assert await _ffr().definition_org_id(pool, gid) is None
    assert await _ffr().foreign_binding_refusal(
        d, definition_id=did, pool=pool, user_id=USER) == ONE_VISIBLE
    assert await _ffr().foreign_binding_refusal(
        d, definition_id=gid, pool=pool, user_id=USER) is None


@pytest.mark.asyncio
async def test_raise_if_foreign_raises_the_coded_422():
    pool = FakePool()
    with pytest.raises(HTTPException) as exc:
        await _ffr().raise_if_foreign(
            _defn(project=F_A1, phase_scopes=[[F_B1]]), definition_org=ORG_A, pool=pool,
            user_id=USER)
    assert exc.value.status_code == 422
    assert exc.value.detail == {"code": "folder_in_other_org", "message": ONE_VISIBLE}
    assert _ffr().FOLDER_IN_OTHER_ORG == "folder_in_other_org"


# ── the save routes ──────────────────────────────────────────────────────────────────────────


def _request(org: str | None):
    return SimpleNamespace(headers={"X-Org-Id": org} if org else {}, state=SimpleNamespace())


async def _create(body: dict, *, active_org, pool):
    created = AsyncMock(return_value={"id": uuid4(), "version": 1, "token": "t"})
    with patch.object(workflows_mod, "get_pg_pool", AsyncMock(return_value=pool)), \
            patch.object(workflows_mod, "resolve_active_org_or_none",
                         AsyncMock(return_value=active_org)), \
            patch.object(workflows_mod, "assert_phase_models_registered", AsyncMock()), \
            patch.object(workflows_mod, "create_workflow_definition", created):
        try:
            await workflows_mod.create_draft(
                body=WorkflowDefinition.model_validate(body), request=_request(active_org),
                current_user={"id": USER})
            return created, None
        except HTTPException as e:
            return created, e


@pytest.mark.asyncio
async def test_create_with_the_active_org_refuses_a_foreign_folder_with_the_coded_422():
    pool = FakePool()
    created, exc = await _create(_defn(project=F_A1, phase_scopes=[[F_B1]]),
                                 active_org=ORG_A, pool=pool)
    assert exc is not None and exc.status_code == 422
    assert exc.detail == {"code": "folder_in_other_org", "message": ONE_VISIBLE}
    created.assert_not_called()


# D-298-09 (298-review WR-06): this case used to read "header-less = skipped" (exc None, no read).
# A header-less draft is still stamped — by the mig-106 trigger, with the owner's LIMIT 1 org — so
# the save is now checked against THAT org, read with the trigger's own statement, and only when
# the definition binds anything.
@pytest.mark.asyncio
async def test_create_with_no_header_checks_against_the_org_the_trigger_stamps():
    pool = FakePool(owner_org=ORG_A)
    created, exc = await _create(_defn(project=F_B1), active_org=None, pool=pool)
    assert exc is not None and exc.status_code == 422
    assert exc.detail == {"code": "folder_in_other_org", "message": ONE_VISIBLE}
    created.assert_not_called()


@pytest.mark.asyncio
async def test_create_with_no_header_saves_a_binding_in_the_stamped_org():
    pool = FakePool(owner_org=ORG_B)
    created, exc = await _create(_defn(project=F_B1), active_org=None, pool=pool)
    assert exc is None
    created.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_with_no_header_and_no_binding_reads_nothing():
    pool = FakePool(owner_org=ORG_A)
    created, exc = await _create(_defn(), active_org=None, pool=pool)
    assert exc is None
    created.assert_awaited_once()
    assert pool.calls == []


@pytest.mark.asyncio
async def test_create_in_org_saves():
    pool = FakePool()
    created, exc = await _create(_defn(project=F_A1, kb=[F_A2]), active_org=ORG_A, pool=pool)
    assert exc is None
    created.assert_awaited_once()


DEF_ID = uuid4()


def _stored(definition: dict, *, org=ORG_A, owner=USER, glob=False):
    return {str(DEF_ID): {"org_id": org, "created_by": owner, "is_system_global": glob,
                          "definition": json.dumps(definition)}}  # SEED-154: a JSON string


async def _update(body: dict, *, pool, write_row=None):
    write = AsyncMock(return_value=write_row or {"ok": True, "id": DEF_ID, "version": 1,
                                                 "token": "t"})
    with patch.object(workflows_mod, "get_pg_pool", AsyncMock(return_value=pool)), \
            patch.object(workflows_mod, "unregistered_phase_models", AsyncMock(return_value=[])), \
            patch.object(workflows_mod, "update_workflow_definition", write):
        try:
            await workflows_mod.update_draft(
                definition_id=DEF_ID, body=WorkflowDefinition.model_validate(body),
                current_user={"id": USER})
            return write, None
        except HTTPException as e:
            return write, e


@pytest.mark.asyncio
async def test_update_that_adds_a_foreign_folder_is_refused_coded():
    pool = FakePool(definitions=_stored(_defn(project=F_A1)))
    write, exc = await _update(_defn(project=F_A1, phase_scopes=[[F_B1]]), pool=pool)
    assert exc is not None and exc.status_code == 422
    assert exc.detail == {"code": "folder_in_other_org", "message": ONE_VISIBLE}
    write.assert_not_called()


@pytest.mark.asyncio
async def test_update_that_changes_a_binding_to_a_foreign_folder_is_refused():
    pool = FakePool(definitions=_stored(_defn(project=F_A1, output=F_A2)))
    write, exc = await _update(_defn(project=F_A1, output=F_B1), pool=pool)
    assert exc is not None and exc.status_code == 422
    write.assert_not_called()


@pytest.mark.asyncio
async def test_update_keeping_a_stored_foreign_binding_saves_it_through_untouched():
    stored = _defn(project=F_A1, kb=[F_B1])
    pool = FakePool(definitions=_stored(stored))
    write, exc = await _update(_defn(project=F_A1, kb=[F_B1]), pool=pool)
    assert exc is None
    write.assert_awaited_once()
    saved = write.await_args.kwargs["definition"]
    assert [str(f) for f in saved.inputs[0].folder_scope] == [F_B1], "preserved, never stripped"


@pytest.mark.asyncio
async def test_update_on_a_row_the_caller_does_not_own_answers_the_same_404():
    pool = FakePool(definitions=_stored(_defn(project=F_A1), owner=OTHER_USER))
    nf = {"ok": False, "cause": "not_found"}
    write, exc = await _update(_defn(project=F_B1), pool=pool, write_row=nf)
    assert exc is not None and exc.status_code == 404 and exc.detail == "draft not found"
    write.assert_awaited_once()
    # and byte-identical to the unbound not-owner answer
    pool2 = FakePool(definitions=_stored(_defn(), owner=OTHER_USER))
    _, exc2 = await _update(_defn(), pool=pool2, write_row=nf)
    assert (exc2.status_code, exc2.detail) == (exc.status_code, exc.detail)


@pytest.mark.asyncio
async def test_an_autosave_of_an_unbound_draft_issues_no_extra_read():
    pool = FakePool(definitions=_stored(_defn()))
    write, exc = await _update(_defn(), pool=pool)
    assert exc is None
    assert pool.calls == []


@pytest.mark.asyncio
async def test_a_system_global_row_is_never_checked():
    pool = FakePool(definitions=_stored(_defn(), glob=True))
    write, exc = await _update(_defn(project=F_B1), pool=pool)
    assert exc is None
    write.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_reads_the_definition_org_from_the_row_not_a_header():
    """The row is in org B, so a binding to org B is in-org, whatever the viewer has active."""
    pool = FakePool(definitions=_stored(_defn(), org=ORG_B))
    write, exc = await _update(_defn(project=F_B1), pool=pool)
    assert exc is None
    stmt = [s for s in pool.sql() if "FROM workflow_definitions" in s]
    assert stmt and "created_by = $2" in stmt[0]


def test_the_helper_never_imports_publish_service():
    from pathlib import Path

    src = Path(_ffr().__file__).read_text(encoding="utf-8")
    code = "\n".join(ln for ln in src.splitlines() if not ln.lstrip().startswith("#"))
    assert "publish_service" not in code


# ═════════════════════════════════════════════════════════════════════════════════════════════
# The three launch doors (D-30). Each is ONE call to the same helper.
# ═════════════════════════════════════════════════════════════════════════════════════════════


def _published_row(definition: dict, *, org=ORG_A, glob=False, owner=USER):
    return {"id": str(uuid4()), "definition": definition, "status": "published",
            "is_system_global": glob, "created_by": owner, "skill_snapshots": None,
            "org_id": org}


async def _preflight(row, *, pool, scope_assert=None, supabase=None):
    from app.services import workflow_kickoff
    from app.services.entitlement_service import EntitlementResult

    user = {"id": USER, "org_id": ORG_A}
    body = SimpleNamespace(workflow_definition_id=uuid4(), inputs={})
    allowed = EntitlementResult(allowed=True, capability="workflows", current_tier="enterprise")
    sb = supabase or MagicMock()

    async def _passthrough(**kw):
        return kw["definition"]

    with (
        patch("app.api.threads.workflows_enabled", return_value=True),
        patch("app.api.threads.get_pg_pool", new_callable=AsyncMock, return_value=pool),
        patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock,
              return_value=allowed),
        patch.object(workflow_kickoff, "aexec", AsyncMock(return_value=SimpleNamespace(data=row))),
        patch.object(workflow_kickoff, "assert_folder_scopes_subset",
                     scope_assert or AsyncMock()) as scope,
        patch.object(workflow_kickoff, "_ensure_skill_snapshots", side_effect=_passthrough) as snap,
        patch("app.services.template_service.pin_templates_for_run", AsyncMock()),
        patch.object(_ffr(), "fetch_visible_folders",
                     AsyncMock(return_value=list(FOLDERS.values()))),
        # publish's rule, stubbed to agree with the pool read (its parity is the matrix's subject)
        patch.object(_ffr(), "folder_scope_violations",
                     AsyncMock(return_value=[ValueError("outside the org")])),
    ):
        try:
            out = await workflow_kickoff.preflight_workflow_kickoff(
                request=MagicMock(), body=body, thread_id=str(uuid4()),
                thread_row={"active_workflow_run_id": None}, supabase=sb, current_user=user,
            )
            return out, snap, scope, None, sb
        except HTTPException as exc:
            return None, snap, scope, exc, sb


@pytest.mark.asyncio
async def test_preflight_refuses_a_foreign_binding_with_the_coded_422():
    pool = FakePool()
    out, snap, _scope, exc, _sb = await _preflight(
        _published_row(_defn(project=F_A1, output=F_B1)), pool=pool)
    assert out is None and exc is not None and exc.status_code == 422
    assert exc.detail == {"code": "folder_in_other_org", "message": ONE_VISIBLE}
    snap.assert_not_called()  # refused before the snapshot materialize (nothing written)


@pytest.mark.asyncio
async def test_preflight_selects_the_row_org_and_uses_it():
    pool = FakePool()
    _, _, _, exc, sb = await _preflight(
        _published_row(_defn(project=F_A1, output=F_B1), org=ORG_B), pool=pool)
    # the row is in org B, so org B's folder is in-org; F_A1 is now the foreign one
    assert exc is not None and exc.status_code == 422
    assert "“Client Files” is in Personal" in exc.detail["message"]
    selects = [c.args[0] for c in sb.table.return_value.select.call_args_list
               if c.args and "skill_snapshots" in c.args[0]]
    assert selects and "org_id" in [t.strip() for t in selects[0].split(",")]


@pytest.mark.asyncio
async def test_preflight_keeps_the_unrestricted_subset_400_first():
    pool = FakePool()
    boom = AsyncMock(side_effect=ValueError("phase 'p0' folder_scope is not a subset"))
    _, _, _, exc, _ = await _preflight(
        _published_row(_defn(project=F_A1, output=F_B1)), pool=pool, scope_assert=boom)
    assert exc.status_code == 400
    assert pool.calls == [], "the org check never ran"


@pytest.mark.asyncio
async def test_preflight_skips_system_global_definitions():
    pool = FakePool()
    out, _, _, exc, _ = await _preflight(
        _published_row(_defn(project=F_B1), glob=True), pool=pool)
    assert exc is None and out is not None
    assert pool.calls == []


@pytest.mark.asyncio
async def test_preflight_admits_a_clean_definition():
    pool = FakePool()
    out, snap, _, exc, _ = await _preflight(
        _published_row(_defn(project=F_A1, kb=[F_A2])), pool=pool)
    assert exc is None and out is not None
    snap.assert_called_once()


# ── scheduler ────────────────────────────────────────────────────────────────────────────────


WF_ID = str(uuid4())


def _schedule():
    return {"id": uuid4(), "user_id": USER, "workflow_id": WF_ID, "org_id": ORG_A,
            "name": "Weekly", "inputs": {}}


async def _schedule_launch(definition: dict, *, def_org=ORG_A, glob=False):
    from app.services import scheduler_service
    from app.services.entitlement_service import EntitlementResult

    pool = FakePool(definitions={WF_ID: {"org_id": def_org, "created_by": USER,
                                         "is_system_global": glob, "definition": "{}"}})
    allowed = EntitlementResult(allowed=True, capability="workflows", current_tier="enterprise")
    launch = AsyncMock(return_value=uuid4())
    with (
        patch("app.db.workflows.get_definition", new_callable=AsyncMock,
              return_value={"definition": definition}),
        patch("app.db.schedules.record_schedule_outcome", new_callable=AsyncMock) as record,
        patch("app.services.unattended_launch.launch_unattended_run", launch),
        patch("app.services.unattended_launch.workflows_disabled", return_value=False),
        patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock,
              return_value=allowed),
        patch("app.dependencies.get_active_org_id", AsyncMock(side_effect=AssertionError("400"))),
    ):
        try:
            await scheduler_service.launch_scheduled_run(_schedule(), pool=pool, redis=MagicMock())
            return record, launch, None, pool
        except scheduler_service.ScheduledLaunchRefused as refused:
            return record, launch, refused, pool


@pytest.mark.asyncio
async def test_a_scheduled_launch_records_the_sentence_then_refuses():
    record, launch, refused, _ = await _schedule_launch(_defn(project=F_A1, output=F_B1))
    assert refused is not None and str(refused) == ONE_VISIBLE
    record.assert_awaited_once()
    assert record.await_args.kwargs["status"] == ONE_VISIBLE
    launch.assert_not_called()


@pytest.mark.asyncio
async def test_a_clean_scheduled_launch_launches_with_no_extra_outcome_write():
    record, launch, refused, _ = await _schedule_launch(_defn(project=F_A1, kb=[F_A2]))
    assert refused is None
    record.assert_not_called()
    launch.assert_awaited_once()


@pytest.mark.asyncio
async def test_an_unbound_scheduled_launch_reads_nothing_new():
    record, launch, refused, pool = await _schedule_launch(_defn())
    assert refused is None and pool.calls == []
    launch.assert_awaited_once()


@pytest.mark.asyncio
async def test_a_system_global_scheduled_definition_is_never_checked():
    record, launch, refused, _ = await _schedule_launch(_defn(project=F_B1), glob=True)
    assert refused is None
    launch.assert_awaited_once()


# ── API key ──────────────────────────────────────────────────────────────────────────────────


def _inbound(monkeypatch, definition: dict, *, def_org=None):
    from uuid import UUID as _U

    from fastapi.testclient import TestClient

    from app.db import api_keys as api_keys_db
    from tests.unit import phase293_inbound_fakes as fakes

    org = def_org or fakes.ORG_ID

    class Pool(fakes.FakePool):
        async def fetchval(self, sql, *args):
            flat = " ".join(sql.split())
            if "FROM workflow_definitions" in flat:
                self._log(sql, args)
                return org
            return await super().fetchval(sql, *args)

        async def fetch(self, sql, *args):
            flat = " ".join(sql.split())
            if "FROM folders" in flat or "FROM organizations" in flat:
                self._log(sql, args)
                return await FakePool().fetch(sql, *args)
            return await super().fetch(sql, *args)

    events: list = []
    now, later, _ = fakes.audit_spies(monkeypatch, events)
    rows = [{"id": _U(fakes.WF_ID), "readable": True, "name": "Weekly digest",
             "status": "published", "definition": json.dumps(definition)}]

    async def _key_workflows(_pool, *, workflow_ids, user_id, org_id):
        return rows

    monkeypatch.setattr(api_keys_db, "get_key_workflows", _key_workflows)
    launch = AsyncMock(return_value=_U(fakes.RUN_ID))
    monkeypatch.setattr("app.services.unattended_launch.launch_unattended_run", launch)
    monkeypatch.setattr("app.services.entitlement_service.enforce_entitlement",
                        AsyncMock(return_value=None))
    monkeypatch.setattr("app.dependencies.get_active_org_id",
                        AsyncMock(side_effect=AssertionError("400")))
    pool = Pool(events)
    client = TestClient(fakes.build_app(key=fakes.make_key(), pool=pool, redis=fakes.FakeRedis()))
    return {"client": client, "launch": launch, "now": now, "later": later, "pool": pool,
            "url": f"/inbound/workflows/{fakes.WF_ID}/runs"}


def _inbound_defn(**kw):
    from tests.unit import phase293_inbound_fakes as fakes

    d = _defn(**kw)
    d["inputs"] = fakes.DEFINITION["inputs"]
    return d


def _key_owned_folders():
    """The fake key's owner owns F_A1 (in the key's org) and F_B1 (in org B)."""
    from tests.unit import phase293_inbound_fakes as fakes

    owned = {
        F_A1: {**FOLDERS[F_A1], "org_id": fakes.ORG_ID, "user_id": fakes.USER_ID},
        F_B1: {**FOLDERS[F_B1], "user_id": fakes.USER_ID},
    }
    return patch.dict(FOLDERS, owned), patch.dict(ORGS, {fakes.ORG_ID: "Personal"})


def test_an_api_key_start_bound_to_a_foreign_folder_is_refused_in_a_plain_string(monkeypatch):
    from tests.unit.phase293_inbound_fakes import all_audits

    p1, p2 = _key_owned_folders()
    with p1, p2:
        env = _inbound(monkeypatch, _inbound_defn(project=F_A1, output=F_B1))
        r = env["client"].post(env["url"], json={"inputs": {"topic": "x"}})
    assert r.status_code == 422
    assert r.json()["detail"] == ONE_VISIBLE, "a plain string, not the coded object"
    env["launch"].assert_not_called()
    refused = [a for a in all_audits(env["now"], env["later"]) if a[0] == "api_key.refused"]
    assert [a[1]["reason"] for a in refused] == ["foreign_folder"]


def test_a_clean_api_key_start_proceeds(monkeypatch):
    p1, p2 = _key_owned_folders()
    with p1, p2:
        env = _inbound(monkeypatch, _inbound_defn(project=F_A1))
        r = env["client"].post(env["url"], json={"inputs": {"topic": "x"}})
    assert r.status_code == 201, r.text
    env["launch"].assert_awaited_once()


def test_the_launch_doors_never_call_get_active_org_id():
    from pathlib import Path

    import app.api.inbound as inbound
    import app.services.scheduler_service as sched

    for mod in (inbound, sched):
        assert "get_active_org_id" not in Path(mod.__file__).read_text(encoding="utf-8")
