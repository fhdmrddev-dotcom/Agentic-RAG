"""Phase 295, gap fix round 2 (295-10): the two BACKEND defects the round-1 re-drive measured.

* D-r1-04 — "Search another folder" offered a two-org owner's OWN folders from the other org.
  295-09's WR-06 fix narrowed shared folders only, because ``fetch_visible_folders`` admitted every
  owned folder whatever its ``org_id``. These cases drive the REAL ``fetch_visible_folders`` (only
  its two DB reads are faked), so they test the rule rather than a double of it.
* D-r1-03 — on a paused run the composer's send is refused 409 with "cancel the active workflow",
  but the thread has no cancel control for a paused run. The refusal now says where the run is
  waiting and how to stop it.

Every network edge is faked (no live DB, no live Redis, no provider call).
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

ORG_A, ORG_B = str(uuid4()), str(uuid4())
OWNER, OTHER = str(uuid4()), str(uuid4())


# ═════════════════════════════════════════════════════════════════════════════════════════
# D-r1-04 — a two-org owner's folders, owned AND shared, stay inside the run's org
# ═════════════════════════════════════════════════════════════════════════════════════════
def _folders():
    """The round-1 re-drive's shape: the owner has a project in each org, and each org has a
    folder another member shared."""
    ids = {k: str(uuid4()) for k in ("A_PROJ", "A_OWN", "B_PROJ", "B_OWN", "A_SHARED", "B_SHARED")}
    rows = [
        {"id": ids["A_PROJ"], "name": "Org A project", "user_id": OWNER, "org_id": ORG_A,
         "parent_id": None, "is_org_shared": False},
        {"id": ids["A_OWN"], "name": "Org A other folder", "user_id": OWNER, "org_id": ORG_A,
         "parent_id": None, "is_org_shared": False},
        {"id": ids["B_PROJ"], "name": "Org B project", "user_id": OWNER, "org_id": ORG_B,
         "parent_id": None, "is_org_shared": False},
        {"id": ids["B_OWN"], "name": "Org B other folder", "user_id": OWNER, "org_id": ORG_B,
         "parent_id": None, "is_org_shared": False},
        {"id": ids["A_SHARED"], "name": "Org A shared", "user_id": OTHER, "org_id": ORG_A,
         "parent_id": None, "is_org_shared": True},
        {"id": ids["B_SHARED"], "name": "Org B shared", "user_id": OTHER, "org_id": ORG_B,
         "parent_id": None, "is_org_shared": True},
    ]
    return ids, rows


def _patched_reads(rows):
    """Fake ONLY the two DB reads inside ``fetch_visible_folders``; the rule itself runs for real."""
    async def _orgs(_supabase, _user_id):
        return {ORG_A, ORG_B}

    async def _all(_supabase, fields="*", *, strict=False):
        return [dict(r) for r in rows]

    return (
        patch("app.utils.folder_utils._resolve_caller_org_ids", _orgs),
        patch("app.utils.folder_utils.fetch_all_folders", _all),
    )


def _visible_names(restrict):
    from app.utils.folder_utils import fetch_visible_folders

    _ids, rows = _folders()
    p1, p2 = _patched_reads(rows)
    kw = {} if restrict == "omit" else {"restrict_org_ids": restrict}
    with p1, p2:
        out = asyncio.run(fetch_visible_folders(object(), OWNER, **kw))
    return {f["name"] for f in out}


def test_r1_04_an_org_a_restriction_drops_the_owners_own_org_b_folders():
    names = _visible_names({ORG_A})
    assert "Org B project" not in names and "Org B other folder" not in names, (
        "the owner's own org-B folders were admitted under an org-A restriction"
    )
    assert names == {"Org A project", "Org A other folder", "Org A shared"}


def test_r1_04_an_org_b_restriction_drops_the_owners_own_org_a_folders():
    names = _visible_names({ORG_B})
    assert names == {"Org B project", "Org B other folder", "Org B shared"}


def test_r1_04_no_restriction_is_unchanged():
    """Every caller that omits the keyword (chat, the /folders routes, run start, resume,
    Continue, NL generation, the per-run override gate) keeps the full owned + shared set."""
    assert _visible_names("omit") == {
        "Org A project", "Org A other folder", "Org B project", "Org B other folder",
        "Org A shared", "Org B shared",
    }
    assert _visible_names(None) == _visible_names("omit")


def test_r1_04_an_empty_restriction_still_means_owned_folders_only():
    """The documented fail-closed reading of ``set()`` (an unknown org): no shared folder, and
    the owner's own folders as before. Unchanged by this fix."""
    assert _visible_names(set()) == {
        "Org A project", "Org A other folder", "Org B project", "Org B other folder",
    }


def _offered(org_id, project_key):
    """Through ``permitted_folder_options`` with the REAL ``fetch_visible_folders`` and the real
    scope rule: what "Search another folder" offers a run in ``org_id`` whose project is
    ``project_key`` and came up empty."""
    from app.models.harness import WorkflowDefinition
    from app.services.harness import engine_ask

    ids, rows = _folders()
    definition = WorkflowDefinition(
        slug="w", name="W", version=1, project_folder_id=ids[project_key],
        phases=[{"slug": "research", "phase_index": 0, "config": {
            "phase_type": "llm_agent", "prompt": "p", "available_tools": ["search_documents"]}}],
    )
    p1, p2 = _patched_reads(rows)
    with p1, p2:
        out = asyncio.run(engine_ask.permitted_folder_options(
            definition, phase=definition.phases[0], searched_ids=[ids[project_key]],
            supabase=object(), user_id=OWNER, org_id=org_id,
        ))
    return {f["name"] for f in out}


def test_r1_04_an_org_a_run_offers_no_org_b_folder_owned_or_shared():
    names = _offered(ORG_A, "A_PROJ")
    assert not {"Org B project", "Org B other folder", "Org B shared"} & names, names
    assert names == {"Org A other folder", "Org A shared"}


def test_r1_04_an_org_b_run_offers_no_org_a_folder_owned_or_shared():
    names = _offered(ORG_B, "B_PROJ")
    assert not {"Org A project", "Org A other folder", "Org A shared"} & names, names
    assert names == {"Org B other folder", "Org B shared"}


# ═════════════════════════════════════════════════════════════════════════════════════════
# D-r1-03 — a send into a thread whose run is PAUSED says where the run is waiting
# ═════════════════════════════════════════════════════════════════════════════════════════
def _preflight_refusal(anchor_status):
    from app.services.workflow_kickoff import preflight_workflow_kickoff

    class _Conn:
        async def fetchval(self, *_a, **_k):
            return anchor_status

    @asynccontextmanager
    async def _user_conn(_request, _user):
        yield _Conn()

    body = SimpleNamespace(workflow_definition_id=None)
    with patch("app.dependencies.get_user_pg_connection", _user_conn):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(preflight_workflow_kickoff(
                request=object(), body=body, thread_id=str(uuid4()),
                thread_row={"active_workflow_run_id": str(uuid4())},
                supabase=object(), current_user={"id": OWNER},
            ))
    return exc.value


def test_r1_03_a_paused_run_says_it_is_waiting_for_an_answer_and_how_to_stop_it():
    err = _preflight_refusal("paused")
    assert err.status_code == 409
    detail = err.detail
    assert "waiting for your answer" in detail
    assert "run page" in detail and "stop" in detail.lower()
    # The thread has no cancel control for a paused run, so the refusal must not send the
    # person looking for one.
    assert "cancel the active workflow" not in detail
    # And it must not start with the fixed lock prefix: the client replaces any detail that does
    # with its own "cancel it to send a Deep message" line (StreamsProvider WORKFLOW_LOCK_DETAIL_PREFIX).
    assert not detail.startswith("Thread is workflow-locked")


@pytest.mark.parametrize("status", ["active", "cap_paused", "pending"])
def test_r1_03_every_other_live_status_keeps_the_old_wording(status):
    err = _preflight_refusal(status)
    assert err.status_code == 409
    assert err.detail == (
        "Thread is workflow-locked — cancel the active workflow to switch back to Deep mode."
    )


@pytest.mark.parametrize("status", ["completed", "failed", "cancelled", None])
def test_r1_03_a_terminal_or_missing_anchor_still_lets_the_send_through(status):
    from app.services.workflow_kickoff import preflight_workflow_kickoff

    class _Conn:
        async def fetchval(self, *_a, **_k):
            return status

    @asynccontextmanager
    async def _user_conn(_request, _user):
        yield _Conn()

    with patch("app.dependencies.get_user_pg_connection", _user_conn):
        out = asyncio.run(preflight_workflow_kickoff(
            request=object(), body=SimpleNamespace(workflow_definition_id=None),
            thread_id=str(uuid4()), thread_row={"active_workflow_run_id": str(uuid4())},
            supabase=object(), current_user={"id": OWNER},
        ))
    assert out == (None, None)
