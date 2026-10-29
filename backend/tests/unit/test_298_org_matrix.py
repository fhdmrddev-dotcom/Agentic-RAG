"""Phase 298-02 (ORG-05 / D-25) — the before/after matrix: nothing in-org changes behaviour.

SC#3 says the ORG-05 refusal must leave every in-org launch and every chat retrieval exactly as it
was. This file is that claim, as a table. The subject is the user shape the phase exists for: U is a
member of TWO orgs, A and B, and owns folders in both. A second member V of org B owns an
org-shared folder there. A workflow definition lives in org A and binds ONLY org-A folders, through
every arm D-34 names (project, phase scope, kb_auto input, output folder).

Rows — each door × each header case {A, B, none}:

  * chat retrieval      — ``document_search_service._resolve_folder`` (the Find-tool folder scope)
  * scheduled launch    — ``scheduler_service.launch_scheduled_run``
  * API-key launch      — ``POST /inbound/workflows/{id}/runs`` (a real HTTP header is sent)
  * publish stage 2.6   — ``harness.scope.folder_scope_violations(..., restrict_org_ids={A})``
  * attended launch     — ``workflow_kickoff.preflight_workflow_kickoff``

Each row must give the SAME folder set / admit decision in all three header cases, and the same as
the reference computed from today's UNRESTRICTED visible set (the "before"). The visibility rule is
the REAL ``fetch_visible_folders`` (only its two reads are faked), wrapped by a recording seam, so
"chat retrieval passes no ``restrict_org_ids``" (D-05) and "no 298 path issues
``restrict_org_ids=set()``" (T-298-12) are measured on the calls made, never read from prose.

Then the empty-set polarity rows, the header-less unattended rows (never a 400, T-298-11), and the
publish-parity rows at the four refusal doors (plan-check W5) — including the ONE shape where a door
with no supabase client is stricter than publish, pinned so it can never be a surprise.

D-28: one provider, stubbed — no provider, prompt or streaming code changes in this plan.
"""
from __future__ import annotations

import inspect
import json
from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.models.harness import WorkflowDefinition
from app.utils import folder_utils
from tests.unit import phase293_inbound_fakes as fakes

U = fakes.USER_ID
V = str(uuid4())
ORG_A = fakes.ORG_ID  # the API key's org, so the key door is in-org by construction
ORG_B = str(uuid4())

RA = str(uuid4())       # U, org A — the project root
RA_C = str(uuid4())     # U, org A — child of RA
RB = str(uuid4())       # U, org B
SB = str(uuid4())       # V, org B, org-shared
# the one stricter-than-publish shape (legacy data only — see the last section)
SA = str(uuid4())       # V, org A, org-shared
XB = str(uuid4())       # V, stamped org B, child of SA

FOLDERS = [
    {"id": RA, "user_id": U, "name": "Client Files", "parent_id": None, "is_org_shared": False,
     "org_id": ORG_A},
    {"id": RA_C, "user_id": U, "name": "Contracts", "parent_id": RA, "is_org_shared": False,
     "org_id": ORG_A},
    {"id": RB, "user_id": U, "name": "Q3 Contracts", "parent_id": None, "is_org_shared": False,
     "org_id": ORG_B},
    {"id": SB, "user_id": V, "name": "Board", "parent_id": None, "is_org_shared": True,
     "org_id": ORG_B},
    {"id": SA, "user_id": V, "name": "Shared Policies", "parent_id": None, "is_org_shared": True,
     "org_id": ORG_A},
    {"id": XB, "user_id": V, "name": "Old Policies", "parent_id": SA, "is_org_shared": False,
     "org_id": ORG_B},
]
BY_ID = {f["id"]: f for f in FOLDERS}
ORG_NAMES = {ORG_A: "Personal", ORG_B: "Acme Legal"}
MEMBERSHIPS = {U: {ORG_A, ORG_B}, V: {ORG_A, ORG_B}}

HEADERS = ["A", "B", "none"]
HEADER_ORG = {"A": ORG_A, "B": ORG_B, "none": None}

DEF_ID = str(uuid4())


def _definition(*, project=RA, scope=(RA_C,), kb=(RA,), output=RA_C) -> dict:
    return {
        "slug": "m", "version": 1, "name": "Matrix workflow",
        "phases": [{"slug": "p0", "phase_index": 0,
                    "config": {"phase_type": "llm_agent", "prompt": "Go.", "available_tools": [],
                               "folder_scope": list(scope)}}],
        "project_folder_id": project, "output_target_folder": output,
        "inputs": [
            *fakes.DEFINITION["inputs"],
            {"key": "kb", "label": "Knowledge", "type": "kb_auto", "source": "kb_auto",
             "folder_scope": list(kb)},
        ],
    }


IN_ORG = _definition()


class MatrixPool(fakes.FakePool):
    """The inbound fake, plus the reads the refusal helper makes (folders / orgs / def org)."""

    def __init__(self, events=None, *, def_org=ORG_A):
        super().__init__(events)
        self.def_org = def_org

    async def fetch(self, sql, *args):
        flat = " ".join(sql.split())
        if "FROM folders" in flat:
            self._log(sql, args)
            return [{"id": UUID(BY_ID[str(i)]["id"]), "name": BY_ID[str(i)]["name"],
                     "org_id": UUID(BY_ID[str(i)]["org_id"]), "user_id": UUID(BY_ID[str(i)]["user_id"])}
                    for i in args[0] if str(i) in BY_ID]
        if "FROM organizations" in flat:
            self._log(sql, args)
            return [{"id": UUID(str(i)), "name": ORG_NAMES[str(i)]} for i in args[0]
                    if str(i) in ORG_NAMES]
        return await super().fetch(sql, *args)

    async def fetchval(self, sql, *args):
        flat = " ".join(sql.split())
        if "FROM workflow_definitions" in flat:
            self._log(sql, args)
            return UUID(self.def_org)
        return await super().fetchval(sql, *args)


@pytest.fixture
def seam():
    """The REAL visibility rule over the fake universe, with every call recorded."""
    calls: list[dict] = []
    real = folder_utils.fetch_visible_folders

    async def recording(supabase, user_id, **kw):
        calls.append({"user_id": str(user_id), **kw})
        return await real(supabase, user_id, **kw)

    async def all_folders(_supabase, fields="*", *, strict=False):
        return [dict(f) for f in FOLDERS]

    async def caller_orgs(_supabase, user_id):
        return set(MEMBERSHIPS.get(str(user_id), set()))

    with ExitStack() as st:
        st.enter_context(patch.object(folder_utils, "fetch_all_folders", all_folders))
        st.enter_context(patch.object(folder_utils, "_resolve_caller_org_ids", caller_orgs))
        for target in (
            "app.services.harness.scope.fetch_visible_folders",
            "app.services.document_search_service.fetch_visible_folders",
            "app.services.foreign_folder_refusal.fetch_visible_folders",
            "app.services.workflow_kickoff.fetch_visible_folders",
        ):
            st.enter_context(patch(target, recording))
        st.enter_context(patch("app.dependencies.get_active_org_id",
                               AsyncMock(side_effect=AssertionError("get_active_org_id → 400"))))
        yield calls


async def _reference_visible() -> set[str]:
    """The "before": today's unrestricted visible set, through the real rule."""
    return {f["id"] for f in await folder_utils.fetch_visible_folders(MagicMock(), U)}


# ── the five doors ───────────────────────────────────────────────────────────────────────────


async def _chat_retrieval(header):
    """The Find tool's folder scope. It takes no request and no org: the header cannot reach it."""
    from app.services import document_search_service as dss

    assert "request" not in inspect.signature(dss._resolve_folder).parameters
    req = SimpleNamespace(folder=SimpleNamespace(folder_id=RA, include_subfolders=True))
    return set(await dss._resolve_folder(req, U, MagicMock()))


async def _scheduled(header, definition=IN_ORG, *, def_org=ORG_A):
    from app.services import scheduler_service
    from app.services.entitlement_service import EntitlementResult

    # 300-01 (D-14): the definition's required "topic" carries a value, or fire time refuses it
    # for the blank input before the org check this matrix is about.
    schedule = {"id": uuid4(), "user_id": U, "workflow_id": DEF_ID, "org_id": ORG_A,
                "name": "Weekly", "inputs": {"topic": "Lisbon"}}
    allowed = EntitlementResult(allowed=True, capability="workflows", current_tier="enterprise")
    launch = AsyncMock(return_value=uuid4())
    with (
        patch("app.db.workflows.get_definition", new_callable=AsyncMock,
              return_value={"definition": definition}),
        patch("app.db.schedules.record_schedule_outcome", new_callable=AsyncMock),
        patch("app.services.unattended_launch.launch_unattended_run", launch),
        patch("app.services.unattended_launch.workflows_disabled", return_value=False),
        patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock,
              return_value=allowed),
    ):
        try:
            await scheduler_service.launch_scheduled_run(
                schedule, pool=MatrixPool(def_org=def_org), redis=MagicMock())
        except scheduler_service.ScheduledLaunchRefused:
            return False
    return launch.await_count == 1


def _api_key(monkeypatch, header, definition=IN_ORG) -> bool:
    from fastapi.testclient import TestClient

    from app.db import api_keys as api_keys_db

    fakes.audit_spies(monkeypatch)
    rows = [{"id": UUID(fakes.WF_ID), "readable": True, "name": "Matrix workflow",
             "status": "published", "definition": json.dumps(definition)}]

    async def _key_workflows(_pool, *, workflow_ids, user_id, org_id):
        return rows

    monkeypatch.setattr(api_keys_db, "get_key_workflows", _key_workflows)
    launch = AsyncMock(return_value=UUID(fakes.RUN_ID))
    monkeypatch.setattr("app.services.unattended_launch.launch_unattended_run", launch)
    monkeypatch.setattr("app.services.entitlement_service.enforce_entitlement",
                        AsyncMock(return_value=None))
    client = TestClient(fakes.build_app(key=fakes.make_key(), pool=MatrixPool(),
                                        redis=fakes.FakeRedis()))
    org = HEADER_ORG[header]
    r = client.post(f"/inbound/workflows/{fakes.WF_ID}/runs", json={"inputs": {"topic": "x"}},
                    headers={"X-Org-Id": org} if org else {})
    assert r.status_code in (201, 422), r.text  # never a 400 for a missing/other header
    return r.status_code == 201 and launch.await_count == 1


async def _publish(header, definition=IN_ORG) -> list:
    from app.services.harness.scope import folder_scope_violations

    return await folder_scope_violations(
        WorkflowDefinition.model_validate(definition), supabase=MagicMock(), user_id=U,
        restrict_org_ids={ORG_A},
    )


async def _attended(header, definition=IN_ORG, *, def_org=ORG_A) -> bool:
    from app.services import workflow_kickoff
    from app.services.entitlement_service import EntitlementResult

    org = HEADER_ORG[header]
    row = {"id": DEF_ID, "definition": definition, "status": "published",
           "is_system_global": False, "created_by": U, "skill_snapshots": None, "org_id": def_org}
    allowed = EntitlementResult(allowed=True, capability="workflows", current_tier="enterprise")

    async def _passthrough(**kw):
        return kw["definition"]

    with (
        patch("app.api.threads.workflows_enabled", return_value=True),
        patch("app.api.threads.get_pg_pool", new_callable=AsyncMock, return_value=MatrixPool()),
        patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock,
              return_value=allowed),
        patch.object(workflow_kickoff, "aexec", AsyncMock(return_value=SimpleNamespace(data=row))),
        patch.object(workflow_kickoff, "_ensure_skill_snapshots", side_effect=_passthrough),
        patch("app.services.template_service.pin_templates_for_run", AsyncMock()),
    ):
        try:
            out = await workflow_kickoff.preflight_workflow_kickoff(
                request=SimpleNamespace(headers={"X-Org-Id": org} if org else {}),
                body=SimpleNamespace(workflow_definition_id=UUID(DEF_ID), inputs={"topic": "x"}),
                thread_id=str(uuid4()), thread_row={"active_workflow_run_id": None},
                # send_message stamps the validated org, else the caller's default (entitlement
                # is not this matrix's subject; the header is what varies)
                supabase=MagicMock(), current_user={"id": U, "org_id": org or ORG_A},
            )
        except HTTPException as exc:
            if exc.status_code == 422 and isinstance(exc.detail, dict):
                return False
            raise
    return out[0] is not None


async def _save(header, definition=IN_ORG) -> bool:
    import app.api.workflows as wf_api

    org = HEADER_ORG[header]
    with (
        patch.object(wf_api, "get_pg_pool", AsyncMock(return_value=MatrixPool())),
        patch.object(wf_api, "resolve_active_org_or_none", AsyncMock(return_value=org)),
        patch.object(wf_api, "assert_phase_models_registered", AsyncMock()),
        patch.object(wf_api, "create_workflow_definition",
                     AsyncMock(return_value={"id": uuid4(), "version": 1, "token": "t"})),
    ):
        try:
            await wf_api.create_draft(
                body=WorkflowDefinition.model_validate(definition),
                request=SimpleNamespace(headers={"X-Org-Id": org} if org else {}),
                current_user={"id": U})
        except HTTPException as exc:
            if exc.status_code == 422:
                return False
            raise
    return True


# ── the matrix ───────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize("header", HEADERS)
async def test_chat_retrieval_sees_the_same_folders_and_passes_no_org_restriction(seam, header):
    before = await _reference_visible()
    seam.clear()
    got = await _chat_retrieval(header)
    expected = {f for f in (RA, RA_C) if f in before}  # RA's subtree within today's visible set
    assert got == expected == {RA, RA_C}
    assert seam, "chat retrieval read the visible set through the recorded seam"
    assert all("restrict_org_ids" not in c for c in seam), "D-05: chat retrieval is unrestricted"


@pytest.mark.asyncio
@pytest.mark.parametrize("header", HEADERS)
async def test_a_scheduled_launch_admits_the_in_org_workflow(seam, header):
    assert await _scheduled(header) is True
    assert all(c.get("restrict_org_ids") != set() for c in seam)


@pytest.mark.parametrize("header", HEADERS)
def test_an_api_key_launch_admits_the_in_org_workflow(monkeypatch, seam, header):
    assert _api_key(monkeypatch, header) is True
    assert all(c.get("restrict_org_ids") != set() for c in seam)


@pytest.mark.asyncio
@pytest.mark.parametrize("header", HEADERS)
async def test_publish_2_6_accepts_the_in_org_workflow(seam, header):
    assert await _publish(header) == []
    assert seam and all(c.get("restrict_org_ids") == {ORG_A} for c in seam)


@pytest.mark.asyncio
@pytest.mark.parametrize("header", HEADERS)
async def test_an_attended_launch_admits_the_in_org_workflow(seam, header):
    assert await _attended(header) is True
    # the pre-existing unrestricted ⊆ check still runs, unrestricted; nothing passes set()
    assert any("restrict_org_ids" not in c for c in seam)
    assert all(c.get("restrict_org_ids") != set() for c in seam)


@pytest.mark.asyncio
async def test_the_matrix_is_not_vacuous(seam):
    """A foreign binding IS refused at each door — so the admits above are decisions, not no-ops."""
    foreign = _definition(output=RB)
    assert await _scheduled("none", foreign) is False
    assert await _attended("A", foreign) is False
    assert await _save("A", foreign) is False


def test_the_api_key_door_refuses_a_foreign_binding_too(monkeypatch, seam):
    assert _api_key(monkeypatch, "none", _definition(output=RB)) is False


# ── empty-set polarity (T-298-12) ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_no_org_gives_no_keyword_and_never_an_empty_set(monkeypatch):
    from app.services import org_lists

    monkeypatch.setattr(org_lists, "resolve_active_org_or_none", AsyncMock(return_value=None))
    kw = await org_lists.folder_kw(SimpleNamespace(headers={}), {"id": U})
    assert kw == {}
    assert kw.get("restrict_org_ids", None) != set()


@pytest.mark.asyncio
async def test_an_absent_org_never_widens_the_visible_set(seam):
    before = await _reference_visible()
    unrestricted = {f["id"] for f in await folder_utils.fetch_visible_folders(MagicMock(), U)}
    assert unrestricted == before, "no keyword = today's set, never more"
    narrowed = {f["id"] for f in await folder_utils.fetch_visible_folders(
        MagicMock(), U, restrict_org_ids={ORG_A})}
    assert narrowed <= before


@pytest.mark.asyncio
async def test_a_definition_with_no_org_is_never_checked_and_never_passes_an_empty_set(seam):
    from app.services.foreign_folder_refusal import foreign_binding_refusal

    seam.clear()
    out = await foreign_binding_refusal(
        _definition(output=RB), definition_org=None, pool=MatrixPool(), user_id=U,
        supabase=MagicMock())
    assert out is None
    assert seam == [], "no visibility read at all — so certainly no restrict_org_ids=set()"


@pytest.mark.asyncio
async def test_no_298_path_issues_an_empty_restriction(seam):
    """Drive every door once with a foreign binding (the paths that DO read visibility)."""
    foreign = _definition(project=RB, scope=(), kb=(RA,), output=RA_C)
    await _attended("A", foreign)
    await _scheduled("none", foreign)
    await _save("A", foreign)
    assert seam, "the refusal paths read visibility"
    assert all(c.get("restrict_org_ids") != set() for c in seam)


# ── header-less unattended launches never 400 (T-298-11) ─────────────────────────────────────


@pytest.mark.asyncio
async def test_a_header_less_scheduled_launch_never_400s(seam):
    # get_active_org_id is patched to raise in the seam fixture; reaching it would fail here
    assert await _scheduled("none") is True


def test_a_header_less_api_key_launch_never_400s(monkeypatch, seam):
    assert _api_key(monkeypatch, "none") is True


# ── publish parity at the four refusal doors (plan-check W5) ─────────────────────────────────


@pytest.mark.asyncio
async def test_what_publish_accepts_every_door_admits(monkeypatch, seam):
    """The in-org definition: publish 2.6 accepts it, and so does each door — attended (with the
    parity confirm available), scheduler / API key / save (pool read alone)."""
    assert await _publish("none") == []
    assert await _attended("none") is True
    assert await _scheduled("none") is True
    assert _api_key(monkeypatch, "none") is True
    assert await _save("A") is True


@pytest.mark.asyncio
async def test_what_publish_refuses_for_org_reasons_every_door_refuses(monkeypatch, seam):
    """U's own org-B folder as the project root: publish 2.6 under {A} drops it (295-10 narrows
    owned folders too) and reports a violation; every door refuses it as well."""
    foreign = _definition(project=RB, scope=(), kb=(RA,), output=RA_C)
    assert await _publish("none", foreign) != []
    assert await _attended("none", foreign) is False
    assert await _scheduled("none", foreign) is False
    assert _api_key(monkeypatch, "none", foreign) is False
    assert await _save("A", foreign) is False


@pytest.mark.asyncio
async def test_the_one_shape_where_a_door_without_a_client_is_stricter_than_publish(
    monkeypatch, seam
):
    """A folder STAMPED org B beneath an org-shared ancestor in org A (legacy data only: since
    296-01 a child is created in its parent's org, and the 298 audit measured 0 cross-org
    bindings). Publish 2.6 admits it — the shared ancestor makes it visible under {A} — and so
    does the attended door, whose parity confirm asks publish's own rule. The three doors that
    hold no supabase client (scheduler, API key, save) rest on the pool read alone and refuse
    it. Pinned so the difference is a recorded decision, never a surprise."""
    edge = _definition(project=SA, scope=(XB,), kb=(), output=None)
    assert await _publish("none", edge) == []
    assert await _attended("none", edge) is True
    assert await _scheduled("none", edge) is False
    assert _api_key(monkeypatch, "none", edge) is False
    assert await _save("A", edge) is False
