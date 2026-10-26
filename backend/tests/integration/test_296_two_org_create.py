"""Phase 296-01 — BUG-261021-02 on REAL Postgres: a two-org user's folder and draft land in the active org.

The subject is the exact user shape the mig-106 ``autofill_org_id_by_owner`` trigger gets wrong:
U belongs to TWO orgs. With no ``org_id`` on the insert the trigger resolves one with
``SELECT org_id FROM org_members WHERE user_id = … LIMIT 1`` (no ORDER BY). The fixture DERIVES
that org (A) by running the trigger's own query — never assumes it — and B is the other one.

What is driven, with nothing about the INSERT mocked:

  * NON-VACUITY first: the trigger's LIMIT-1 org (A) differs from the active org (B). Without this
    a green below could come from the trigger happening to agree with the header.
  * ``create_folder`` and ``create_draft`` — the real route handlers, called with a request carrying
    ``X-Org-Id: B``, the REAL ``resolve_active_org_or_none`` (membership validated on an RLS
    connection as U) and the real writers (the folder through the service-role PostgREST client,
    the draft through ``create_workflow_definition`` on the asyncpg pool). Both rows' ``org_id``
    must read B.
  * The control: the same two creates WITHOUT a header land in A — the trigger still decides when
    no org was chosen, so the B rows above are the header's doing.
  * Mig 216 rides along: U's signup-provisioned personal org is named ``My organization`` and
    carries no email.

The handlers are called directly rather than over HTTP: the auth/visibility/tier dependencies are
not this bug's subject, and the stamp lives entirely inside the handler body.

Everything seeded is deleted in ``finally``. Skip-guarded on the local Postgres :54322 — run with
``-rs``; a skip is a SKIP, never a pass.
"""
from __future__ import annotations

from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest

from app.api import folders as folders_mod
from app.api import workflows as workflows_mod
from app.dependencies import get_supabase
from app.models.folder import FolderCreate
from app.models.harness import WorkflowDefinition
from tests.integration._rls_harness import requires_pg
from tests.integration.test_163_rls_documents import _drop_user

pytestmark = requires_pg

TRIGGER_ORG_SQL = "SELECT org_id FROM public.org_members WHERE user_id = $1 LIMIT 1"


def _request(org: UUID | None):
    headers = {"X-Org-Id": str(org)} if org else {}
    return SimpleNamespace(headers=headers, state=SimpleNamespace())


def _definition(slug: str) -> WorkflowDefinition:
    return WorkflowDefinition.model_validate({
        "slug": slug,
        "version": 1,
        "name": "296 two-org draft",
        "status": "draft",
        "phases": [{
            "slug": "answer", "phase_index": 0, "name": "Answer",
            "config": {"phase_type": "llm_single", "prompt": "Answer."}, "validators": [],
        }],
    })


@pytest.fixture
async def two_org_subject(pg_pool):
    """U in orgs A (the trigger's LIMIT-1 pick) and B."""
    uid = uuid4()
    created_orgs: list[UUID] = []
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            uid, f"phase-296-two-org-{uid}@test.local",
        )
        personal = await pg_pool.fetchrow(TRIGGER_ORG_SQL, uid)
        assert personal is not None, "handle_new_user must provision a personal org at signup"
        created_orgs.append(personal["org_id"])

        second = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.organizations (id, name) VALUES ($1, $2)",
            second, f"296-two-org-second-{second}",
        )
        created_orgs.append(second)
        await pg_pool.execute(
            "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')",
            second, uid,
        )
        members = {r["org_id"] for r in await pg_pool.fetch(
            "SELECT org_id FROM public.org_members WHERE user_id = $1", uid
        )}
        assert len(members) == 2, f"U must belong to exactly two orgs, got {members}"
        org_a = (await pg_pool.fetchrow(TRIGGER_ORG_SQL, uid))["org_id"]
        (org_b,) = members - {org_a}
        yield {"uid": uid, "org_a": org_a, "org_b": org_b, "personal": personal["org_id"]}
    finally:
        for sql in (
            "DELETE FROM public.folders WHERE user_id = $1",
            "DELETE FROM public.workflow_definitions WHERE created_by = $1",
            "DELETE FROM public.audit_log WHERE user_id = $1",
        ):
            try:
                await pg_pool.execute(sql, uid)
            except Exception:
                pass
        await _drop_user(pg_pool, uid)
        for org in created_orgs:
            try:
                await pg_pool.execute("DELETE FROM public.organizations WHERE id = $1", org)
            except Exception:
                pass


async def _create_folder(uid: UUID, org: UUID | None, name: str) -> UUID:
    row = await folders_mod.create_folder(
        body=FolderCreate(name=name),
        request=_request(org),
        current_user={"id": str(uid)},
        supabase=get_supabase(),
    )
    return UUID(str(row["id"]))


async def _create_draft(uid: UUID, org: UUID | None, slug: str) -> UUID:
    resp = await workflows_mod.create_draft(
        body=_definition(slug), request=_request(org), current_user={"id": str(uid)},
    )
    return UUID(str(resp.id))


@pytest.mark.asyncio
async def test_folder_and_draft_land_in_the_active_org_not_the_triggers(pg_pool, two_org_subject):
    s = two_org_subject
    # NON-VACUITY CONTROL — must hold before any org assertion.
    assert s["org_a"] != s["org_b"]
    assert (await pg_pool.fetchrow(TRIGGER_ORG_SQL, s["uid"]))["org_id"] == s["org_a"]

    folder_id = await _create_folder(s["uid"], s["org_b"], f"296-b-{uuid4().hex[:8]}")
    f_org = await pg_pool.fetchval("SELECT org_id FROM public.folders WHERE id = $1", folder_id)
    assert f_org == s["org_b"], f"folder landed in {f_org}, expected B (trigger's A = {s['org_a']})"

    draft_id = await _create_draft(s["uid"], s["org_b"], f"296-b-{uuid4().hex[:8]}")
    d_org = await pg_pool.fetchval("SELECT org_id FROM public.workflow_definitions WHERE id = $1", draft_id)
    assert d_org == s["org_b"], f"draft landed in {d_org}, expected B (trigger's A = {s['org_a']})"


@pytest.mark.asyncio
async def test_control_without_a_header_the_trigger_still_decides(pg_pool, two_org_subject):
    s = two_org_subject
    assert s["org_a"] != s["org_b"]
    folder_id = await _create_folder(s["uid"], None, f"296-none-{uuid4().hex[:8]}")
    assert await pg_pool.fetchval("SELECT org_id FROM public.folders WHERE id = $1", folder_id) == s["org_a"]
    draft_id = await _create_draft(s["uid"], None, f"296-none-{uuid4().hex[:8]}")
    assert await pg_pool.fetchval(
        "SELECT org_id FROM public.workflow_definitions WHERE id = $1", draft_id
    ) == s["org_a"]


@pytest.mark.asyncio
async def test_a_non_member_header_is_ignored(pg_pool, two_org_subject):
    """A header naming an org U does not belong to is never trusted: the trigger decides."""
    s = two_org_subject
    stranger = uuid4()
    folder_id = await _create_folder(s["uid"], stranger, f"296-x-{uuid4().hex[:8]}")
    assert await pg_pool.fetchval("SELECT org_id FROM public.folders WHERE id = $1", folder_id) == s["org_a"]


@pytest.mark.asyncio
async def test_signup_org_is_named_my_organization(pg_pool, two_org_subject):
    """Migration 216 (SEED-364): the personal org created at signup carries no email."""
    name = await pg_pool.fetchval(
        "SELECT name FROM public.organizations WHERE id = $1", two_org_subject["personal"]
    )
    assert name == "My organization"
    assert "@" not in name
