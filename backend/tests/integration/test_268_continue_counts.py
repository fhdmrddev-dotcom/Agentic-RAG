"""268 D-2 — a Deep Continue must actually record itself on ``runs``. Real Postgres, real RLS.

Found by the 2026-09-29 SC#1-continued live drive: ``POST /runs/{id}/continue`` answered
``continues_used: 1`` twice while the row read ``0`` both times. ``continue_run`` wrote the
increment through the request-scoped USER-JWT client, and ``public.runs`` carries a single
SELECT policy (``runs_select_own``, mig 035 / 108) — so the UPDATE matched zero rows and
nothing said so. The per-run Continue cap (``max_continues_per_run``) therefore never counted.

Why earlier tests stayed green: their request client was a dict that APPLIED the update
(``test_268_continue_org.py``'s ``_RequestSupabase``), i.e. it modelled the RLS client as
writable. Here the request client is a real connection under the user's RLS context, exactly
as ``get_user_supabase_client`` is, and the service client is a real RLS-bypassing one.

What is stubbed: the carrier read and the continuation spawn (neither touches the counter).
Skip-guarded on local Postgres :54322 — run with ``-rs``; a skip is a SKIP, never a pass.
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.api.runs import continue_run
from app.config import settings
from tests.integration._reembed_adapter import SupabaseTxnAdapter, _Query
from tests.integration._rls_harness import open_user_conn, requires_pg
from tests.integration.test_268_two_org_rows import two_org_subject  # noqa: F401 — fixture by name

pytestmark = requires_pg


class _Single:
    """supabase-py's ``.maybe_single()`` terminal: one row as a dict, or ``None``."""

    def __init__(self, q: _Query):
        self._q = q

    def execute(self):
        rows = self._q.execute().data
        return SimpleNamespace(data=rows[0] if rows else None)


class _Client(SupabaseTxnAdapter):
    def table(self, name: str) -> _Query:
        q = _Query(self, name)
        q.maybe_single = lambda: _Single(q)
        return q


async def _continue(pg_pool, uid, run_id):
    """One Continue, with the request client under ``uid``'s RLS and a service client beside it."""
    async with open_user_conn(pg_pool, str(uid)) as user_conn, pg_pool.acquire() as svc_conn:
        with patch("app.db.runs.load_cap_paused_tool_calls", AsyncMock(return_value=[])), \
                patch("app.services.run_producer.spawn_continuation_run", AsyncMock()), \
                patch("app.dependencies.get_pg_pool", AsyncMock(return_value=pg_pool)):
            return await continue_run(
                run_id=run_id,
                current_user={"id": str(uid), "email": "d2@test.local"},
                supabase=_Client(user_conn),
                service_supabase=_Client(svc_conn),
                redis=MagicMock(),
            )


async def _paused_run(pg_pool, s):
    run_id = uuid4()
    await pg_pool.execute(
        "INSERT INTO public.runs (run_id, thread_id, user_id, org_id, status, continues_used, model, provider) "
        "VALUES ($1, $2, $3, $4, 'cap_paused', 0, 'gpt-5.4-nano', 'openai')",
        run_id, s["thread_id"], s["uid"], s["org_b"],
    )
    return run_id


@pytest.mark.asyncio
async def test_a_continue_is_recorded_on_the_run(pg_pool, two_org_subject):
    s = two_org_subject
    run_id = await _paused_run(pg_pool, s)

    resp = await _continue(pg_pool, s["uid"], run_id)
    assert resp["status"] == "ok" and resp["continues_used"] == 1, resp

    row = await pg_pool.fetchrow("SELECT continues_used, status FROM public.runs WHERE run_id = $1", run_id)
    assert row["continues_used"] == 1, (
        f"the endpoint answered continues_used=1 but the row reads {row['continues_used']} — "
        "the increment was written through a client RLS lets read runs but never write them"
    )
    assert row["status"] == "streaming", f"the Continue left the run {row['status']!r}"


@pytest.mark.asyncio
async def test_the_continue_cap_is_enforced_across_requests(pg_pool, two_org_subject):
    s = two_org_subject
    run_id = await _paused_run(pg_pool, s)
    cap = settings.max_continues_per_run

    for n in range(1, cap + 1):
        await pg_pool.execute("UPDATE public.runs SET status = 'cap_paused' WHERE run_id = $1", run_id)
        resp = await _continue(pg_pool, s["uid"], run_id)
        assert resp["status"] == "ok", f"Continue #{n} of {cap} was refused: {resp}"

    over = await _continue(pg_pool, s["uid"], run_id)
    if not isinstance(over, dict):  # the refusal is a JSONResponse; an accept is a plain dict
        over = json.loads(over.body)
    assert over["status"] == "refused", (
        f"Continue #{cap + 1} was accepted — the cap of {cap} never counted: {over}"
    )


@pytest.mark.asyncio
async def test_the_write_cannot_reach_another_users_run(pg_pool, two_org_subject):
    """The service client bypasses RLS, so the UPDATE itself must stay scoped to the caller."""
    s = two_org_subject
    run_id = await _paused_run(pg_pool, s)
    stranger = uuid4()

    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        await _continue(pg_pool, stranger, run_id)
    assert exc.value.status_code == 404
    row = await pg_pool.fetchrow("SELECT continues_used, status FROM public.runs WHERE run_id = $1", run_id)
    assert (row["continues_used"], row["status"]) == (0, "cap_paused")
