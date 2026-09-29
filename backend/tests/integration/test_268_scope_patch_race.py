"""268-REVIEW WR-02 — a folder PATCH that lost a race must not write a transcript event with a false
"from". Real Postgres, the route's own writer under RLS.

``_apply_folder_change`` reads the thread's folder, builds the ``scope_changed`` event from that read,
then UPDATEs ``WHERE id = $1 AND user_id = $2`` — with no condition on the folder it read. Two PATCHes
that both read X (two tabs, a retry after a slow response): one writes "X → Y", the other "X → Z". The
second card then records a move from X that was never in effect (the real move was Y → Z), and the
D-268-26 history note hands the model that false ``from``. The event is the durable record of the
change (it "survives reload"), so this is a correctness defect, not a display one.

Driven here as the SECOND PATCH: the database already holds Y (the first PATCH landed); the route's
own thread read is pinned to the stale X it saw before that. What is real: ``_apply_folder_change``,
``_write_scope_change``, the transaction (``open_user_conn`` — the same RLS context
``get_user_pg_connection`` applies), the threads/messages rows. What is stubbed: the read that went
stale, folder authorization, the message/active-run probes and the scope statement (not the subject).

Skip-guarded on local Postgres :54322 — run with ``-rs``; a skip is a SKIP, never a pass.
"""
from __future__ import annotations

from contextlib import ExitStack
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.models.thread import ThreadUpdate
from tests.integration._rls_harness import open_user_conn, requires_pg
from tests.integration.test_163_rls_documents import _drop_user
from tests.unit.test_267_scope_preview import ACME_FOLDER, ACME_SUB

pytestmark = requires_pg

TRIGGER_ORG_SQL = "SELECT org_id FROM public.org_members WHERE user_id = $1 LIMIT 1"


@pytest.fixture
async def raced_thread(pg_pool):
    """U with folders X, Y, Z in one org; thread T (with a message) whose folder is ALREADY Y."""
    uid = uuid4()
    created_org = None
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            uid, f"phase-268-race-{uid}@test.local",
        )
        if await pg_pool.fetchrow(TRIGGER_ORG_SQL, uid) is None:
            created_org = uuid4()
            await pg_pool.execute(
                "INSERT INTO public.organizations (id, name) VALUES ($1, $2)",
                created_org, f"268-race-{created_org}",
            )
            await pg_pool.execute(
                "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')",
                created_org, uid,
            )
        org = (await pg_pool.fetchrow(TRIGGER_ORG_SQL, uid))["org_id"]
        folders = {}
        for label in ("X", "Y", "Z"):
            fid = uuid4()
            await pg_pool.execute(
                "INSERT INTO public.folders (id, user_id, org_id, name) VALUES ($1, $2, $3, $4)",
                fid, uid, org, f"268-race-{label}-{fid.hex[:6]}",
            )
            folders[label] = fid
        thread_id = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.threads (id, user_id, org_id, title, folder_id) "
            "VALUES ($1, $2, $3, '268 race', $4)",
            thread_id, uid, org, folders["Y"],
        )
        await pg_pool.execute(
            "INSERT INTO public.messages (thread_id, user_id, org_id, role, content) "
            "VALUES ($1, $2, $3, 'user', 'hi')",
            thread_id, uid, org,
        )
        yield {"uid": str(uid), "org": org, "thread_id": thread_id, **folders}
    finally:
        for sql in (
            "DELETE FROM public.messages WHERE user_id = $1",
            "DELETE FROM public.threads WHERE user_id = $1",
            "DELETE FROM public.folders WHERE user_id = $1",
        ):
            try:
                await pg_pool.execute(sql, uid)
            except Exception:
                pass
        await _drop_user(pg_pool, uid)
        if created_org is not None:
            try:
                await pg_pool.execute("DELETE FROM public.organizations WHERE id = $1", created_org)
            except Exception:
                pass


async def _patch_as_second_writer(pg_pool, s, *, stale_folder, to_folder):
    """Run the route's folder arm with its own thread read pinned to ``stale_folder``."""
    from app.api import threads as threads_mod
    from tests.unit.test_268_scope_effect import change

    async def _describe(_request, _current_user, _supabase, **kw):
        # Any real statement pair will do: the event's content is not the subject, its WRITE is.
        return await change(None, ACME_FOLDER, ACME_SUB)

    stale_row = {"folder_id": str(stale_folder), "active_expert_id": None, "org_id": str(s["org"])}
    with ExitStack() as stack:
        stack.enter_context(patch.object(threads_mod, "_read_thread_scope", AsyncMock(return_value=stale_row)))
        stack.enter_context(patch.object(threads_mod, "_authorize_thread_folder", AsyncMock()))
        stack.enter_context(patch.object(threads_mod, "_thread_has_messages", AsyncMock(return_value=True)))
        stack.enter_context(patch.object(threads_mod, "_thread_has_active_run", AsyncMock(return_value=False)))
        stack.enter_context(patch.object(threads_mod, "_describe_thread_scope_change", _describe))
        stack.enter_context(patch.object(
            threads_mod, "get_user_pg_connection",
            lambda _request, cu: open_user_conn(pg_pool, cu["id"]),
        ))
        stack.enter_context(patch.object(
            threads_mod, "aexec",
            AsyncMock(return_value=MagicMock(data={"id": str(s["thread_id"])})),
        ))
        return await threads_mod._apply_folder_change(
            str(s["thread_id"]), ThreadUpdate(folder_id=to_folder), MagicMock(),
            {"id": s["uid"]}, MagicMock(), {},
        )


async def _scope_events(pg_pool, thread_id):
    return await pg_pool.fetch(
        "SELECT content FROM public.messages WHERE thread_id = $1 AND role = 'system' "
        "AND tool_calls @> '[{\"kind\": \"scope_changed\"}]'::jsonb",
        thread_id,
    )


@pytest.mark.asyncio
async def test_a_patch_that_read_a_stale_folder_writes_no_event_and_is_a_409(pg_pool, raced_thread):
    s = raced_thread
    assert await pg_pool.fetchval("SELECT folder_id FROM public.threads WHERE id = $1", s["thread_id"]) == s["Y"]

    refused = None
    try:
        await _patch_as_second_writer(pg_pool, s, stale_folder=s["X"], to_folder=s["Z"])
    except HTTPException as exc:
        refused = exc

    events = await _scope_events(pg_pool, s["thread_id"])
    assert events == [], (
        "a scope_changed event was written from the folder this PATCH READ (X) while Y was in effect "
        f"— a false 'from' in the durable record: {[e['content'] for e in events]}"
    )
    folder = await pg_pool.fetchval("SELECT folder_id FROM public.threads WHERE id = $1", s["thread_id"])
    assert folder == s["Y"], "the losing PATCH overwrote the winner's folder"
    assert refused is not None and refused.status_code == 409


@pytest.mark.asyncio
async def test_control_a_patch_whose_read_is_current_writes_its_event(pg_pool, raced_thread):
    """Non-vacuity: the same drive with a CURRENT read commits the UPDATE and exactly one event."""
    s = raced_thread
    await _patch_as_second_writer(pg_pool, s, stale_folder=s["Y"], to_folder=s["Z"])
    assert len(await _scope_events(pg_pool, s["thread_id"])) == 1
    assert await pg_pool.fetchval("SELECT folder_id FROM public.threads WHERE id = $1", s["thread_id"]) == s["Z"]
