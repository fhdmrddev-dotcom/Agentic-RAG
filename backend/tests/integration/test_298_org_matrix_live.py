"""Phase 298-02 (ORG-05, D-25 live row) — the attended launch refuses a foreign binding on REAL Postgres.

The subject is the two-org user U (the 298-01 fixture shape, copied here rather than imported so the
two files can change independently). The mig-106 trigger's ``LIMIT 1`` org is READ and called A; the
other is B. U owns one folder in each. Two published workflows are seeded in org A:

  * ``bad``  — its project folder is U's org-B folder;
  * ``good`` — its project folder is U's org-A folder.

Driven with nothing about the refusal mocked — the real ``preflight_workflow_kickoff`` on U's real
GoTrue user-JWT PostgREST client (RLS enforced) and the real pool, so the definition org is read from
the row, the folder org from ``folders``, the publish-parity confirm runs publish's own rule against
the real tree, and the org names come from ``organizations``. Only the kill switch and the tier
check (not this plan's subject) and the post-check snapshot / template pin (side effects past the
point under test) are patched.

  * NON-VACUITY first: A ≠ B, both folders exist, each in the org the test says.
  * ``bad``  → 422, ``detail == {code: "folder_in_other_org", message}``, the message names the
    folder and both orgs.
  * ``good`` → passes the check (the preflight returns the parsed definition).

Everything seeded is deleted in ``finally``. Skip-guarded on :54322 and :54321 — run with ``-rs``;
a skip is a SKIP, never a pass.
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from tests.integration._271_gotrue_users import (
    GoTrueUsers,
    create_org,
    drop_org,
    memberships,
    require_gotrue,
    user_client,
)
from tests.integration._rls_harness import requires_pg

pytestmark = requires_pg

TRIGGER_ORG_SQL = "SELECT org_id FROM public.org_members WHERE user_id = $1 LIMIT 1"


def _definition(slug: str, project: str) -> str:
    return json.dumps({
        "slug": slug, "version": 1, "name": f"298 matrix {slug}",
        "phases": [{"slug": "p0", "phase_index": 0,
                    "config": {"phase_type": "llm_single", "prompt": "Summarise."}}],
        "project_folder_id": project,
    })


async def _seed_workflow(pool, *, uid: str, org: str, project: str, tag: str) -> str:
    slug = f"p298m-{tag}-{uuid4().hex[:8]}"
    return str(await pool.fetchval(
        "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status, definition)"
        " VALUES ($1, $2, $3, $4, 'published', $5::jsonb) RETURNING id",
        slug, f"298 matrix {tag}", UUID(uid), UUID(org), _definition(slug, project),
    ))


async def _cleanup(pool, uid: str | None) -> None:
    if not uid:
        return
    for sql in (
        "DELETE FROM public.workflow_definitions WHERE created_by = $1",
        "DELETE FROM public.folders WHERE user_id = $1",
    ):
        try:
            await pool.execute(sql, UUID(uid))
        except Exception:
            pass


@pytest.fixture
async def subject(pg_pool):
    require_gotrue()
    users = GoTrueUsers(pg_pool)
    org_x = org_y = uid = None
    try:
        org_x = await create_org(pg_pool, "298m-x")
        org_y = await create_org(pg_pool, "298m-y")
        uid, tok = await users.create_signed_in_user(org_x, label="p298matrix")
        await pg_pool.execute(
            "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')",
            UUID(org_y), UUID(uid),
        )
        assert await memberships(pg_pool, uid) == {org_x, org_y}, "U is not in exactly two orgs"
        org_a = str(await pg_pool.fetchval(TRIGGER_ORG_SQL, UUID(uid)))  # READ, never predicted
        org_b = org_y if org_a == org_x else org_x
        folders = {}
        for tag, org in (("a", org_a), ("b", org_b)):
            name = f"298m-{tag}-folder-{uuid4().hex[:6]}"
            fid = await pg_pool.fetchval(
                "INSERT INTO public.folders (user_id, org_id, name) VALUES ($1, $2, $3) RETURNING id",
                UUID(uid), UUID(org), name,
            )
            folders[tag] = {"id": str(fid), "name": name}
        bad = await _seed_workflow(pg_pool, uid=uid, org=org_a, project=folders["b"]["id"], tag="bad")
        good = await _seed_workflow(pg_pool, uid=uid, org=org_a, project=folders["a"]["id"], tag="good")
        names = {str(r["id"]): r["name"] for r in await pg_pool.fetch(
            "SELECT id, name FROM public.organizations WHERE id = ANY($1::uuid[])",
            [UUID(org_a), UUID(org_b)],
        )}
        yield {"uid": uid, "tok": tok, "org_a": org_a, "org_b": org_b, "folders": folders,
               "bad": bad, "good": good, "names": names}
    finally:
        await _cleanup(pg_pool, uid)
        await users.drop_all()
        await drop_org(pg_pool, org_x)
        await drop_org(pg_pool, org_y)


async def _preflight(s, definition_id: str):
    from app.services import workflow_kickoff

    async def _passthrough(**kw):
        return kw["definition"]

    with (
        patch("app.api.threads.workflows_enabled", return_value=True),
        patch("app.services.entitlement_service.enforce_entitlement", AsyncMock(return_value=None)),
        patch.object(workflow_kickoff, "_ensure_skill_snapshots", side_effect=_passthrough),
        patch("app.services.template_service.pin_templates_for_run", AsyncMock()),
    ):
        return await workflow_kickoff.preflight_workflow_kickoff(
            request=SimpleNamespace(headers={"X-Org-Id": s["org_a"]}),
            body=SimpleNamespace(workflow_definition_id=UUID(definition_id), inputs={}),
            thread_id=str(uuid4()), thread_row={"active_workflow_run_id": None},
            supabase=user_client(s["tok"]), current_user={"id": s["uid"], "org_id": s["org_a"]},
        )


@pytest.mark.asyncio
async def test_the_fixture_is_not_vacuous(subject, pg_pool):
    s = subject
    assert s["org_a"] != s["org_b"]
    for tag, org in (("a", s["org_a"]), ("b", s["org_b"])):
        got = await pg_pool.fetchval(
            "SELECT org_id FROM public.folders WHERE id = $1", UUID(s["folders"][tag]["id"]))
        assert str(got) == org
    for wid in (s["bad"], s["good"]):
        assert str(await pg_pool.fetchval(
            "SELECT org_id FROM public.workflow_definitions WHERE id = $1", UUID(wid))) == s["org_a"]
    assert s["names"].get(s["org_a"]) and s["names"].get(s["org_b"])


@pytest.mark.asyncio
async def test_an_attended_launch_bound_to_the_other_orgs_folder_is_refused_coded(subject):
    s = subject
    with pytest.raises(HTTPException) as exc:
        await _preflight(s, s["bad"])
    assert exc.value.status_code == 422
    detail = exc.value.detail
    assert detail["code"] == "folder_in_other_org"
    folder, org_a, org_b = s["folders"]["b"]["name"], s["names"][s["org_a"]], s["names"][s["org_b"]]
    assert detail["message"] == (
        f"“{folder}” is in {org_b}, not in this workflow's organization ({org_a}). "
        f"Pick a folder from {org_a}."
    )


@pytest.mark.asyncio
async def test_the_same_workflow_rebound_in_org_launches_past_the_check(subject):
    s = subject
    definition, definition_id = await _preflight(s, s["good"])
    assert definition is not None
    assert str(definition_id) == s["good"]
    assert str(definition.project_folder_id) == s["folders"]["a"]["id"]
