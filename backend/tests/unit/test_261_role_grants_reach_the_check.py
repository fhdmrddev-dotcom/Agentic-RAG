"""PACK-10 — a ROLE grant must be able to match (v4.3 independent verification of 261).

Every grant-aware surface built `caller_roles` from `current_user.get("role")`, and
`get_current_user` returns only `{id, email}` — so `caller_roles` was ALWAYS `[]` and a role
grant could never admit anyone. The 261 tests passed a fabricated `{"id", "role"}` user, an
identity shape production never produces. These tests use the REAL shape and assert the org
role actually reaches the grant check on the list, detail, resolve and run paths.
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.api import experts as experts_api

REAL_USER = {"id": str(uuid4()), "email": "member@example.com"}  # what get_current_user returns
ORG = str(uuid4())


def _request(org_role="dept-admin"):
    return SimpleNamespace(state=SimpleNamespace(org_role=org_role), headers={})


@pytest.mark.asyncio
async def test_list_passes_the_callers_org_role():
    with patch.object(experts_api, "list_experts_service", new_callable=AsyncMock, return_value=[]) as svc:
        await experts_api.list_experts(
            request=_request(), include_system=True, enabled_only=True, for_management=False,
            active_org=ORG, current_user=REAL_USER, pool=MagicMock(),
        )
    assert svc.await_args.kwargs["caller_roles"] == ["dept-admin"]


@pytest.mark.asyncio
async def test_detail_passes_the_callers_org_role():
    with patch.object(experts_api, "get_expert_service", new_callable=AsyncMock, return_value={"id": "x"}) as svc:
        await experts_api.get_expert(
            bundle_id=uuid4(), request=_request(), active_org=ORG, current_user=REAL_USER, pool=MagicMock(),
        )
    assert svc.await_args.kwargs["caller_roles"] == ["dept-admin"]


@pytest.mark.asyncio
async def test_resolve_passes_the_callers_org_role():
    with patch.object(experts_api, "resolve_expert_bundle", new_callable=AsyncMock, return_value=None) as svc:
        with pytest.raises(Exception):
            await experts_api.resolve_expert(
                bundle_id=uuid4(), request=_request(), active_org=ORG, current_user=REAL_USER, pool=MagicMock(),
            )
    assert svc.await_args.kwargs["caller_roles"] == ["dept-admin"]


@pytest.mark.asyncio
async def test_run_scoping_reads_the_role_from_org_members():
    """The detached producer has no request; it reads the caller's role in the run's org."""
    from app.services import run_producer

    thread = MagicMock()
    thread.data = {"active_expert_id": str(uuid4()), "folder_id": None}
    supabase = MagicMock()
    supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = thread
    pool = MagicMock()
    pool.fetchval = AsyncMock(return_value="dept-admin")
    user = {**REAL_USER, "org_id": ORG}
    with patch("app.utils.db.aexec", new_callable=AsyncMock, return_value=thread), \
         patch("app.services.expert_service.resolve_expert_bundle", new_callable=AsyncMock, return_value=None) as rb:
        with pytest.raises(Exception):
            await run_producer._resolve_thread_scoping(supabase, "t-1", user, pool)
    assert rb.await_args.kwargs["caller_roles"] == ["dept-admin"]
