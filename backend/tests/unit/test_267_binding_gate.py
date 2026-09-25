"""Phase 267 (D-267-31 / D-267-21 / D-267-24 R265-audit-fixes-03 / D-267-07) — ONE fail-closed
Expert-binding gate.

``assert_expert_bindable(request, current_user, expert_id)`` in ``app.api.threads`` is the only code
that decides whether an Expert may be bound to a thread. PATCH /threads/{id}, POST /threads and
POST /threads/{id}/handoff all call it.

* No validated active org → 403 with a REASON (it used to be a silent fail-open skip in PATCH).
* Entitlement refused → the existing structured EntitlementDeniedException; access is never read.
* Access denied → 404 "Expert bundle not found or access denied" (text unchanged).
* The org role comes from ``resolve_caller_role`` — NEVER ``current_user["role"]``
  (``get_current_user`` returns ``{id, email}`` only). R265-audit-fixes-03 drove a plant that read
  the role off ``current_user`` and five suites stayed green; the case below is the one that fails.
* Clearing an Expert stays ungated, and no refusal exists for a missing connection (D-267-07).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.models.thread import ThreadCreate, ThreadUpdate

ORG_ID = str(uuid4())
USER_ID = str(uuid4())
EXPERT_ID = uuid4()
NO_ORG_DETAIL = "Choose an organization before inviting an Expert."
ACCESS_DETAIL = "Expert bundle not found or access denied"


def _allowed():
    return MagicMock(allowed=True)


def _denied():
    from app.services.entitlement_service import EntitlementResult

    return EntitlementResult(allowed=False, capability="experts", current_tier="free", required_tier="pro")


def _gate_patches(*, org=ORG_ID, ent=None, bundle=None, role=("member", set())):
    """The gate's collaborators, patched where the helper reads them."""
    ent_mock = AsyncMock(return_value=ent if ent is not None else _allowed())
    svc_mock = AsyncMock(return_value=bundle if bundle is not None else {"id": str(EXPERT_ID), "name": "HR Advisor"})
    role_mock = AsyncMock(return_value=role)
    return (
        patch("app.api.threads.resolve_active_org_or_none", AsyncMock(return_value=org)),
        patch("app.api.threads.get_pg_pool", AsyncMock(return_value=MagicMock())),
        patch("app.services.entitlement_service.check_entitlement", ent_mock),
        patch("app.services.expert_service.get_expert_service", svc_mock),
        patch("app.dependencies.resolve_caller_role", role_mock),
        ent_mock,
        svc_mock,
        role_mock,
    )


# ── the helper itself ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_no_validated_org_refuses_with_a_reason_and_reads_nothing():
    from app.api.threads import assert_expert_bindable

    p_org, p_pool, p_ent, p_svc, p_role, ent_mock, svc_mock, _ = _gate_patches(org=None)
    with p_org, p_pool, p_ent, p_svc, p_role:
        with pytest.raises(HTTPException) as exc:
            await assert_expert_bindable(MagicMock(), {"id": USER_ID}, EXPERT_ID)
    assert exc.value.status_code == 403
    assert exc.value.detail == NO_ORG_DETAIL
    ent_mock.assert_not_awaited()
    svc_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_entitlement_refusal_raises_the_structured_exception_before_access_is_read():
    from app.api.threads import assert_expert_bindable
    from app.services.entitlement_service import EntitlementDeniedException

    p_org, p_pool, p_ent, p_svc, p_role, ent_mock, svc_mock, _ = _gate_patches(ent=_denied())
    with p_org, p_pool, p_ent, p_svc, p_role:
        with pytest.raises(EntitlementDeniedException) as exc:
            await assert_expert_bindable(MagicMock(), {"id": USER_ID}, EXPERT_ID)
    assert exc.value.status_code == 403
    ent_mock.assert_awaited_once()
    assert ent_mock.await_args.args[1] == ORG_ID
    assert ent_mock.await_args.args[2] == "experts"
    svc_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_access_denied_is_the_unchanged_404():
    from app.api.threads import assert_expert_bindable

    p_org, p_pool, p_ent, p_svc, p_role, _, svc_mock, _ = _gate_patches()
    svc_mock.return_value = None
    with p_org, p_pool, p_ent, p_svc, p_role:
        with pytest.raises(HTTPException) as exc:
            await assert_expert_bindable(MagicMock(), {"id": USER_ID}, EXPERT_ID)
    assert exc.value.status_code == 404
    assert exc.value.detail == ACCESS_DETAIL


@pytest.mark.asyncio
async def test_success_returns_the_bundle_and_the_validated_org():
    from app.api.threads import assert_expert_bindable

    bundle = {"id": str(EXPERT_ID), "name": "HR Advisor"}
    p_org, p_pool, p_ent, p_svc, p_role, _, svc_mock, _ = _gate_patches(bundle=bundle)
    with p_org, p_pool, p_ent, p_svc, p_role:
        got_bundle, got_org = await assert_expert_bindable(MagicMock(), {"id": USER_ID}, EXPERT_ID)
    assert got_bundle == bundle
    assert got_org == ORG_ID
    kw = svc_mock.await_args.kwargs
    assert kw["bundle_id"] == EXPERT_ID
    assert kw["caller_org_id"] == UUID(ORG_ID)
    assert kw["caller_user_id"] == UUID(USER_ID)


@pytest.mark.asyncio
async def test_R265_audit_fixes_03_the_role_is_resolved_never_read_off_current_user():
    """SEED-309 R265-audit-fixes-03 (D-267-24). ``current_user`` carries NO "role" key — the real
    ``get_current_user`` shape. The org role reaches the access check only through
    ``resolve_caller_role``. The review's plant (``caller_roles`` from ``current_user.get("role")``)
    turns this RED: it yields ``[]``."""
    from app.api.threads import assert_expert_bindable

    p_org, p_pool, p_ent, p_svc, p_role, _, svc_mock, role_mock = _gate_patches(role=("org-admin", set()))
    current_user = {"id": USER_ID, "email": "a@example.com"}
    assert "role" not in current_user
    with p_org, p_pool, p_ent, p_svc, p_role:
        await assert_expert_bindable(MagicMock(), current_user, EXPERT_ID)
    role_mock.assert_awaited_once()
    assert svc_mock.await_args.kwargs["caller_roles"] == ["org-admin"]


# ── PATCH /threads/{id} ────────────────────────────────────────────────────────────────────────


def _thread_row(expert_id=None):
    return {
        "id": str(uuid4()),
        "user_id": USER_ID,
        "title": "Chat",
        "active_expert_id": str(expert_id) if expert_id else None,
        "folder_id": None,
        "org_id": ORG_ID,
        "created_at": "2026-09-25T00:00:00Z",
        "updated_at": "2026-09-25T00:00:00Z",
    }


@pytest.mark.asyncio
async def test_patch_setting_an_expert_calls_the_one_helper_once():
    from app.api import threads as threads_mod

    helper = AsyncMock(return_value=({"id": str(EXPERT_ID)}, ORG_ID))
    row = _thread_row(EXPERT_ID)
    # Every read returns the thread already holding this Expert: the value does not change, so no
    # transcript event is involved and the plain update path runs.
    with patch.object(threads_mod, "assert_expert_bindable", helper), \
         patch.object(threads_mod, "aexec", AsyncMock(return_value=MagicMock(data=row))):
        resp = await threads_mod.rename_thread(
            thread_id=row["id"],
            body=ThreadUpdate(active_expert_id=EXPERT_ID),
            request=MagicMock(),
            current_user={"id": USER_ID},
            supabase=MagicMock(),
        )
    helper.assert_awaited_once()
    assert helper.await_args.args[2] == EXPERT_ID
    assert resp["active_expert_id"] == str(EXPERT_ID)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "body",
    [ThreadUpdate(clear_active_expert=True), ThreadUpdate(active_expert_id=None)],
    ids=["clear_active_expert", "explicit_null"],
)
async def test_patch_clearing_an_expert_is_ungated(body):
    from app.api import threads as threads_mod

    helper = AsyncMock(side_effect=AssertionError("clearing must never call the binding gate"))
    row = _thread_row(None)
    with patch.object(threads_mod, "assert_expert_bindable", helper), \
         patch.object(threads_mod, "aexec", AsyncMock(return_value=MagicMock(data=row))):
        resp = await threads_mod.rename_thread(
            thread_id=row["id"],
            body=body,
            request=MagicMock(),
            current_user={"id": USER_ID},
            supabase=MagicMock(),
        )
    helper.assert_not_awaited()
    assert resp["active_expert_id"] is None


@pytest.mark.asyncio
async def test_patch_without_a_validated_org_now_refuses():
    """D-267-31: the no-org PATCH that used to SUCCEED (fail-open skip) now answers 403."""
    from app.api import threads as threads_mod

    aexec = AsyncMock(side_effect=AssertionError("a refused PATCH must write nothing"))
    p_org, p_pool, p_ent, p_svc, p_role, _, _, _ = _gate_patches(org=None)
    with p_org, p_pool, p_ent, p_svc, p_role, patch.object(threads_mod, "aexec", aexec):
        with pytest.raises(HTTPException) as exc:
            await threads_mod.rename_thread(
                thread_id=str(uuid4()),
                body=ThreadUpdate(active_expert_id=EXPERT_ID),
                request=MagicMock(),
                current_user={"id": USER_ID},
                supabase=MagicMock(),
            )
    assert exc.value.status_code == 403
    assert exc.value.detail == NO_ORG_DETAIL
    aexec.assert_not_awaited()


# ── POST /threads (D-267-21 server half) ───────────────────────────────────────────────────────


def _insert_supabase():
    sb = MagicMock()
    return sb


@pytest.mark.asyncio
async def test_post_with_an_expert_is_gated_and_carries_the_validated_org():
    from app.api import threads as threads_mod

    helper = AsyncMock(return_value=({"id": str(EXPERT_ID)}, ORG_ID))
    created = _thread_row(EXPERT_ID)
    aexec = AsyncMock(return_value=MagicMock(data=[created]))
    sb = _insert_supabase()
    with patch.object(threads_mod, "assert_expert_bindable", helper), \
         patch.object(threads_mod, "aexec", aexec):
        resp = await threads_mod.create_thread(
            background_tasks=MagicMock(),
            request=MagicMock(),
            body=ThreadCreate(title="New Chat", active_expert_id=EXPERT_ID),
            current_user={"id": USER_ID},
            supabase=sb,
        )
    helper.assert_awaited_once()
    assert helper.await_args.args[2] == EXPERT_ID
    payload = sb.table.return_value.insert.call_args.args[0]
    assert payload["active_expert_id"] == str(EXPERT_ID)
    assert payload["org_id"] == ORG_ID
    assert resp == created


@pytest.mark.asyncio
async def test_post_refused_by_the_gate_inserts_nothing():
    from app.api import threads as threads_mod

    helper = AsyncMock(side_effect=HTTPException(status_code=403, detail=NO_ORG_DETAIL))
    aexec = AsyncMock()
    sb = _insert_supabase()
    with patch.object(threads_mod, "assert_expert_bindable", helper), \
         patch.object(threads_mod, "aexec", aexec):
        with pytest.raises(HTTPException) as exc:
            await threads_mod.create_thread(
                background_tasks=MagicMock(),
                request=MagicMock(),
                body=ThreadCreate(title="New Chat", active_expert_id=EXPERT_ID),
                current_user={"id": USER_ID},
                supabase=sb,
            )
    assert exc.value.status_code == 403
    aexec.assert_not_awaited()
    sb.table.return_value.insert.assert_not_called()


@pytest.mark.asyncio
async def test_post_without_an_expert_is_byte_identical_to_base():
    from app.api import threads as threads_mod

    helper = AsyncMock(side_effect=AssertionError("no Expert means no gate"))
    folder_id = uuid4()
    created = _thread_row(None)
    sb = _insert_supabase()
    with patch.object(threads_mod, "assert_expert_bindable", helper), \
         patch.object(threads_mod, "aexec", AsyncMock(return_value=MagicMock(data=[created]))):
        await threads_mod.create_thread(
            background_tasks=MagicMock(),
            request=MagicMock(),
            body=ThreadCreate(title="New Chat", folder_id=folder_id),
            current_user={"id": USER_ID},
            supabase=sb,
        )
    helper.assert_not_awaited()
    payload = sb.table.return_value.insert.call_args.args[0]
    assert payload == {"user_id": USER_ID, "title": "New Chat", "folder_id": str(folder_id)}
    assert "org_id" not in payload


# ── 267-REVIEW CR-02: a DISABLED Expert is refused by the one gate, at every door, and at run time ──
#
# The admin "disable" toggle (``expert_bundles.is_enabled = false``) is the administrative kill for a
# broken or leaking Expert. Before this fix the gate read visibility and grants only, so anyone holding
# the id could bind a disabled Expert through PATCH, POST /threads or the handoff, and runs kept using
# it. The refusal text is the gate's existing 404 sentence — a disabled Expert is "not found" to a
# binder, exactly as the list already hides it from non-managers.

DISABLED = {"id": str(EXPERT_ID), "name": "HR Advisor", "is_enabled": False}


@pytest.mark.asyncio
async def test_CR02_the_gate_refuses_a_disabled_expert_with_the_unchanged_404():
    from app.api.threads import assert_expert_bindable

    p_org, p_pool, p_ent, p_svc, p_role, _, _, _ = _gate_patches(bundle=DISABLED)
    with p_org, p_pool, p_ent, p_svc, p_role:
        with pytest.raises(HTTPException) as exc:
            await assert_expert_bindable(MagicMock(), {"id": USER_ID}, EXPERT_ID)
    assert exc.value.status_code == 404
    assert exc.value.detail == ACCESS_DETAIL


@pytest.mark.asyncio
async def test_CR02_an_enabled_expert_and_a_legacy_row_without_the_key_still_bind():
    from app.api.threads import assert_expert_bindable

    for bundle in ({"id": str(EXPERT_ID), "is_enabled": True}, {"id": str(EXPERT_ID)}):
        p_org, p_pool, p_ent, p_svc, p_role, _, _, _ = _gate_patches(bundle=bundle)
        with p_org, p_pool, p_ent, p_svc, p_role:
            got, _org = await assert_expert_bindable(MagicMock(), {"id": USER_ID}, EXPERT_ID)
        assert got == bundle


@pytest.mark.asyncio
async def test_CR02_door_PATCH_refuses_a_disabled_expert_and_writes_nothing():
    from app.api import threads as threads_mod

    aexec = AsyncMock(side_effect=AssertionError("a refused PATCH must write nothing"))
    p_org, p_pool, p_ent, p_svc, p_role, _, _, _ = _gate_patches(bundle=DISABLED)
    with p_org, p_pool, p_ent, p_svc, p_role, patch.object(threads_mod, "aexec", aexec):
        with pytest.raises(HTTPException) as exc:
            await threads_mod.rename_thread(
                thread_id=str(uuid4()),
                body=ThreadUpdate(active_expert_id=EXPERT_ID),
                request=MagicMock(),
                current_user={"id": USER_ID},
                supabase=MagicMock(),
            )
    assert exc.value.status_code == 404
    aexec.assert_not_awaited()


@pytest.mark.asyncio
async def test_CR02_door_POST_refuses_a_disabled_expert_and_inserts_nothing():
    from app.api import threads as threads_mod

    aexec = AsyncMock()
    sb = _insert_supabase()
    p_org, p_pool, p_ent, p_svc, p_role, _, _, _ = _gate_patches(bundle=DISABLED)
    with p_org, p_pool, p_ent, p_svc, p_role, patch.object(threads_mod, "aexec", aexec):
        with pytest.raises(HTTPException) as exc:
            await threads_mod.create_thread(
                background_tasks=MagicMock(),
                request=MagicMock(),
                body=ThreadCreate(title="New Chat", active_expert_id=EXPERT_ID),
                current_user={"id": USER_ID},
                supabase=sb,
            )
    assert exc.value.status_code == 404
    aexec.assert_not_awaited()
    sb.table.return_value.insert.assert_not_called()


@pytest.mark.asyncio
async def test_CR02_door_handoff_refuses_a_disabled_expert_before_any_read_of_the_transcript():
    from app.api import threads as threads_mod
    from app.models.thread import ThreadHandoffRequest

    source = {"id": str(uuid4()), "title": "Q3", "folder_id": None, "org_id": ORG_ID, "active_expert_id": None}
    reads: list[int] = []

    async def aexec(_q):
        reads.append(1)
        if len(reads) == 1:
            return MagicMock(data=source)
        raise AssertionError("a refused handoff must read no transcript and write nothing")

    txn = MagicMock(side_effect=AssertionError("a refused handoff opens no transaction"))
    p_org, p_pool, p_ent, p_svc, p_role, _, _, _ = _gate_patches(bundle=DISABLED)
    with p_org, p_pool, p_ent, p_svc, p_role, \
         patch.object(threads_mod, "aexec", aexec), \
         patch.object(threads_mod, "get_user_pg_connection", txn):
        with pytest.raises(HTTPException) as exc:
            await threads_mod.handoff_thread(
                thread_id=source["id"],
                body=ThreadHandoffRequest(expert_id=EXPERT_ID),
                request=MagicMock(),
                current_user={"id": USER_ID},
                supabase=MagicMock(),
            )
    assert exc.value.status_code == 404
    assert len(reads) == 1


@pytest.mark.asyncio
async def test_CR02_the_run_resolver_fails_closed_on_a_disabled_expert():
    """``resolve_expert_bundle`` returning ``None`` is what makes ``_resolve_thread_scoping`` clear the
    stale id and refuse the run — so an ALREADY-bound thread stops running a disabled Expert too."""
    from app.services import expert_service

    bundle = {
        "id": EXPERT_ID, "name": "HR Advisor", "slug": "hr-advisor", "is_enabled": False, "is_system": False,
        "scope_mode": "biased", "member_skills": [], "knowledge_folder_ids": [], "required_connections": [],
    }
    grant = AsyncMock(return_value=True)
    with patch.object(expert_service.experts_db, "get_expert_bundle_by_id", AsyncMock(return_value=bundle)), \
         patch.object(expert_service.experts_db, "check_expert_grant_access", grant):
        got = await expert_service.resolve_expert_bundle(
            pool=MagicMock(),
            bundle_id=EXPERT_ID,
            caller_org_id=UUID(ORG_ID),
            caller_user_id=UUID(USER_ID),
        )
    assert got is None


# ── 267-REVIEW WR-03 (PATCH door): the thread's own org must be the org the gate validated ─────────


@pytest.mark.asyncio
async def test_WR03_patch_refuses_binding_into_a_thread_of_another_org_and_writes_nothing():
    from app.api import threads as threads_mod

    other_org = str(uuid4())
    # The thread already holds this Expert, so the plain update path runs (no event machinery).
    row = {**_thread_row(EXPERT_ID), "org_id": other_org}
    helper = AsyncMock(return_value=({"id": str(EXPERT_ID)}, ORG_ID))
    sb = MagicMock()
    txn = MagicMock(side_effect=AssertionError("a refused PATCH opens no transaction"))
    with patch.object(threads_mod, "assert_expert_bindable", helper), \
         patch.object(threads_mod, "get_user_pg_connection", txn), \
         patch.object(threads_mod, "aexec", AsyncMock(return_value=MagicMock(data=row))):
        with pytest.raises(HTTPException) as exc:
            await threads_mod.rename_thread(
                thread_id=row["id"],
                body=ThreadUpdate(active_expert_id=EXPERT_ID),
                request=MagicMock(),
                current_user={"id": USER_ID},
                supabase=sb,
            )
    assert exc.value.status_code == 409
    assert exc.value.detail == "Switch to this chat's organization to invite an Expert."
    sb.table.return_value.update.assert_not_called()
