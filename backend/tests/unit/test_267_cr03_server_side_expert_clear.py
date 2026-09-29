"""267-REVIEW-INDEPENDENT CR-03 — the server silently removed a thread's Expert.

Scenario the review drove: HR Advisor is active on thread T; an admin disables it (or the grant is
revoked). The next send's ``_resolve_thread_scoping`` clears ``active_expert_id`` and refuses the run —
but:

* (a) NO ``expert_changed`` event was written, so the transcript never stated the change (PACK-23);
* (c) the snapshot OMITTED ``active_expert_id`` when it was null, so the client had nothing to
  reconcile the chip from — it kept saying "HR Advisor · Restricted" over an unscoped thread;
* (d) ``GET /experts/{id}`` had no ``is_enabled`` check, so a DISABLED Expert still hydrated the chip
  for a member (the list endpoint already hides disabled Experts from non-managers).

(b) — a 409 before the run when the thread's org is not the active org — is NOT implemented here: the
send path has no shared org-equality helper to reuse (PATCH and handoff each compare inline, with
different sentences), so it would be a new send-path branch. Deferred; see the fix summary.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import status

from tests.unit.test_267_connection_overlay import _get, app_and_pool  # noqa: F401 — fixture reuse

THREAD = "7d000000-0000-4000-8000-0000000000c3"
USER = "11111111-1111-4111-8111-111111111111"
THREAD_ORG = "22222222-2222-4222-8222-222222222222"
ACTIVE_ORG = "33333333-3333-4333-8333-333333333333"
EXPERT = "44444444-4444-4444-8444-444444444444"


# ── (a) the stale-Expert clear is STATED in the thread's org ─────────────────────────────────────


class _Conn:
    def __init__(self):
        self.execute = AsyncMock()

    @asynccontextmanager
    async def transaction(self):
        yield self


class _Pool:
    def __init__(self):
        self.conn = _Conn()
        self.fetchval = AsyncMock(return_value="member")

    @asynccontextmanager
    async def acquire(self):
        yield self.conn


def _aexec(cleared_rows):
    """1st call: the thread read. 2nd call: the conditional clear (returns the rows it cleared)."""
    thread = MagicMock(data={"active_expert_id": EXPERT, "folder_id": None, "org_id": THREAD_ORG})
    return AsyncMock(side_effect=[thread, MagicMock(data=cleared_rows)])


async def _stale_send(pool, aexec, *, get_expert=None, describe_error=None):
    from app.services.run_producer import _resolve_thread_scoping

    get_expert = get_expert or AsyncMock(return_value={"name": "HR Advisor", "scope_mode": "restricted"})
    patches = [
        patch("app.utils.db.aexec", aexec),
        patch("app.services.expert_service.resolve_expert_bundle", AsyncMock(return_value=None)),
        patch("app.services.expert_scope.resolve_expert_bundle", AsyncMock(return_value=None)),
        patch("app.services.expert_scope.get_expert_service", get_expert),
        patch("app.services.expert_scope.fetch_visible_folders", AsyncMock(return_value=[])),
    ]
    if describe_error is not None:
        patches.append(patch("app.services.expert_scope.describe_expert_scope", AsyncMock(side_effect=describe_error)))
    for p in patches:
        p.start()
    try:
        with pytest.raises(ValueError) as exc:
            await _resolve_thread_scoping(
                supabase=MagicMock(),
                thread_id=THREAD,
                current_user={"id": USER, "org_id": ACTIVE_ORG},
                pool=pool,
            )
    finally:
        for p in reversed(patches):
            p.stop()
    return exc.value, get_expert


def _inserts(pool: _Pool) -> list:
    return [c for c in pool.conn.execute.await_args_list if "INSERT INTO public.messages" in c.args[0]]


@pytest.mark.asyncio
async def test_a_the_clear_writes_the_expert_changed_removal_row_in_the_threads_org():
    pool = _Pool()
    err, get_expert = await _stale_send(pool, _aexec([{"id": THREAD}]))

    # The run is still refused, with the same message (fail-closed is unchanged).
    assert "could not be resolved or is inaccessible; refusing run (fail-closed)" in str(err)

    rows = _inserts(pool)
    assert len(rows) == 1, "the server removed the Expert and wrote nothing the transcript could state"
    _, thread_id, user_id, org_id, content, tool_calls = rows[0].args
    assert thread_id == UUID(THREAD) and user_id == UUID(USER)
    assert org_id == UUID(THREAD_ORG), "the row belongs to the THREAD's org (D-267-34), never the active org"
    assert content == "HR Advisor left. Now: All your documents. Dropped: Nothing."
    (payload,) = tool_calls
    assert payload["kind"] == "expert_changed"
    assert payload["before"]["name"] == "HR Advisor" and payload["before"]["id"] == EXPERT
    assert payload["after"] is None
    # "before = the bundle named by get_expert_service", named in the thread's org.
    assert get_expert.await_args.kwargs["caller_org_id"] == UUID(THREAD_ORG)


@pytest.mark.asyncio
async def test_a_the_clear_is_conditional_on_the_expert_it_read():
    """A concurrent PATCH that bound a NEW Expert between the read and the clear is not clobbered."""
    pool = _Pool()
    aexec = _aexec([{"id": THREAD}])
    from app.services.run_producer import _resolve_thread_scoping

    supabase = MagicMock()
    table = supabase.table.return_value
    table.select.return_value = table
    table.eq.return_value = table
    table.maybe_single.return_value = table
    table.update.return_value = table
    with patch("app.utils.db.aexec", aexec), \
         patch("app.services.expert_service.resolve_expert_bundle", AsyncMock(return_value=None)), \
         patch("app.services.expert_scope.resolve_expert_bundle", AsyncMock(return_value=None)), \
         patch("app.services.expert_scope.get_expert_service", AsyncMock(return_value={"name": "HR Advisor"})), \
         patch("app.services.expert_scope.fetch_visible_folders", AsyncMock(return_value=[])):
        with pytest.raises(ValueError):
            await _resolve_thread_scoping(
                supabase=supabase, thread_id=THREAD,
                current_user={"id": USER, "org_id": ACTIVE_ORG}, pool=pool,
            )
    table.update.assert_called_with({"active_expert_id": None})
    assert ("active_expert_id", EXPERT) in [c.args for c in table.eq.call_args_list]


@pytest.mark.asyncio
async def test_a_nothing_cleared_means_nothing_stated():
    """Another send already cleared it (and stated it): no second row."""
    pool = _Pool()
    await _stale_send(pool, _aexec([]))
    assert _inserts(pool) == []


@pytest.mark.asyncio
async def test_a_a_failed_statement_never_masks_the_refusal():
    pool = _Pool()
    err, _ = await _stale_send(pool, _aexec([{"id": THREAD}]), describe_error=RuntimeError("db down"))
    assert "refusing run (fail-closed)" in str(err)
    assert _inserts(pool) == []


@pytest.mark.asyncio
async def test_a_the_patch_door_and_the_send_door_write_one_row_shape():
    """ONE writer of the event row: PATCH's transaction and the send-time clear call the same helper."""
    import inspect

    from app.api import threads as threads_mod
    from app.services import expert_scope, run_producer

    assert "insert_expert_changed_row(" in inspect.getsource(threads_mod._write_expert_change)
    assert "insert_expert_changed_row(" in inspect.getsource(run_producer)
    assert "INSERT INTO public.messages" not in inspect.getsource(threads_mod._write_expert_change)
    assert "INSERT INTO public.messages" in inspect.getsource(expert_scope.insert_expert_changed_row)


# ── (c) the snapshot always carries active_expert_id ─────────────────────────────────────────────


async def _snapshot(active_expert_id, *, active_runs):
    from app.api import threads as threads_mod

    results = [
        MagicMock(data={"id": THREAD, "active_expert_id": active_expert_id}),  # ownership read
        MagicMock(data=[]),  # messages
        MagicMock(data=active_runs),  # runs
    ]
    redis = MagicMock()
    redis.xinfo_stream = AsyncMock(return_value={"first-entry": ("1-0", {})})
    with patch.object(threads_mod, "aexec", AsyncMock(side_effect=results)), \
         patch.object(threads_mod, "_enrich_messages_with_runs", AsyncMock(side_effect=lambda m, **k: m)):
        return await threads_mod.get_snapshot(
            thread_id=UUID(THREAD), current_user={"id": USER}, supabase=MagicMock(), redis=redis
        )


@pytest.mark.asyncio
@pytest.mark.parametrize("runs", [[], [{"run_id": "r1", "started_at": "2026-09-29T00:00:00Z", "status": "streaming"}]])
async def test_c_a_cleared_expert_is_stated_as_null_in_the_snapshot(runs):
    res = await _snapshot(None, active_runs=runs)
    assert "active_expert_id" in res, "the snapshot said nothing, so the client could not clear the chip"
    assert res["active_expert_id"] is None


def test_c_on_the_wire_a_cleared_expert_reads_null():
    """The route's response_model is what the client receives — measured, not assumed."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api import threads as threads_mod
    from app.dependencies import get_current_user, get_redis, get_user_supabase_client

    app = FastAPI()
    app.include_router(threads_mod.router)
    app.dependency_overrides[get_current_user] = lambda: {"id": USER}
    app.dependency_overrides[get_user_supabase_client] = lambda: MagicMock()
    app.dependency_overrides[get_redis] = lambda: MagicMock()
    results = [MagicMock(data={"id": THREAD, "active_expert_id": None}), MagicMock(data=[]), MagicMock(data=[])]
    with patch.object(threads_mod, "aexec", AsyncMock(side_effect=results)), \
         patch.object(threads_mod, "_enrich_messages_with_runs", AsyncMock(side_effect=lambda m, **k: m)):
        body = TestClient(app).get(f"/threads/{THREAD}/snapshot").json()
    assert "active_expert_id" in body and body["active_expert_id"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize("runs", [[], [{"run_id": "r1", "started_at": "2026-09-29T00:00:00Z", "status": "streaming"}]])
async def test_c_a_bound_expert_is_still_carried(runs):
    res = await _snapshot(EXPERT, active_runs=runs)
    assert res["active_expert_id"] == EXPERT


# ── (d) GET /experts/{id} hides a disabled Expert from non-managers ──────────────────────────────


def _bundle(enabled: bool) -> dict:
    return {
        "id": EXPERT, "name": "HR Advisor", "slug": "hr-advisor", "is_system": False,
        "is_enabled": enabled, "visibility": "org", "required_connections": [],
    }


def test_d_a_member_gets_404_for_a_disabled_expert(app_and_pool):  # noqa: F811
    app, _ = app_and_pool
    resp, _, _ = _get(app, f"/experts/{EXPERT}", bundle=_bundle(False), perms=set())
    assert resp.status_code == status.HTTP_404_NOT_FOUND, "a disabled Expert still hydrated the chip"
    assert resp.json()["detail"] == "Expert bundle not found"


def test_d_a_manager_still_sees_a_disabled_expert(app_and_pool):  # noqa: F811
    app, _ = app_and_pool
    resp, _, _ = _get(app, f"/experts/{EXPERT}", bundle=_bundle(False), perms={"experts:manage"})
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["is_enabled"] is False


def test_d_an_enabled_expert_asks_no_permission(app_and_pool):  # noqa: F811
    app, _ = app_and_pool
    resp, has_perm, _ = _get(app, f"/experts/{EXPERT}", bundle=_bundle(True), perms=set())
    assert resp.status_code == status.HTTP_200_OK
    asked = [c.args[3] for c in has_perm.await_args_list]
    assert "experts:manage" not in asked, "an enabled Expert costs no permission read"
