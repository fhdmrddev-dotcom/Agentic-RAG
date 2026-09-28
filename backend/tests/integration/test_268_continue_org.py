"""268-REVIEW CR-01 — a Deep Continue segment writes into the RUN's org, so a SECOND Continue consumes
the SECOND pause's calls. Real Postgres.

The defect the review claims: D-268-22 stamps the send path's writes with the validated active org
(``current_user["org_id"]``). ``continue_run`` passes the plain ``get_current_user`` dict
(``{"id", "email"}`` — no ``org_id``) into ``spawn_continuation_run``, which puts it on the
``RunContext``. So during a Continue segment the assistant message and a RE-PAUSE carrier fall back
to the mig-106 trigger's ``LIMIT 1`` guess. For a two-org user whose run is in B:

  1. pause #1 writes carrier C1 in B (send path, correct);
  2. Continue #1 reads C1 (``load_cap_paused_tool_calls(org_id=B)``) and pauses again — carrier C2
     lands in the trigger's A;
  3. Continue #2 reads ``org_id=B … ORDER BY created_at DESC LIMIT 1`` → **C1 again**: the old,
     already-executed calls are re-driven and C2's calls are lost.

What is REAL here: ``continue_run`` (the endpoint function, both calls), ``spawn_continuation_run``
(the producer that builds the ``RunContext``), ``persist_cap_paused``, ``insert_assistant_message``,
``load_cap_paused_tool_calls`` and the mig-106 trigger. What is stubbed: the request-scoped supabase
client (a dict-backed ``runs``/``threads`` reader), the LLM loop (``run_agent_loop``), settings load,
scope resolution and the finalizer. The stubbed loop writes with the SAME expressions
``agent_loop.py`` uses at its stamps (``org_id=current_user.get("org_id")``), and a source pin below
holds those expressions to the file, so the stub cannot drift from the code it stands in for.

Skip-guarded on local Postgres :54322 — run with ``-rs``; a skip is a SKIP, never a pass.
"""
from __future__ import annotations

import ast
import inspect
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

import app.api.threads as threads_mod
import app.services.run_producer as rp
from app.api.runs import continue_run
from app.db.runs import insert_assistant_message, load_cap_paused_tool_calls
from app.services.agent_loop import persist_cap_paused
from app.services.run_lifecycle import register_run_start
from tests.integration._rls_harness import requires_pg
from tests.integration.test_268_two_org_rows import (  # noqa: F401 — the fixture is used by name
    _CapturingSupabase,
    _Redis,
    two_org_subject,
)

pytestmark = requires_pg


class _Resp(SimpleNamespace):
    pass


class _RequestSupabase:
    """The request-scoped (RLS) client ``continue_run`` reads its run + thread through.

    Dict-backed: the ``runs`` row carries the org the RLS-verified row really has (B), and the
    ``continues_used`` / ``status`` update is applied so the second Continue sees the first.
    """

    def __init__(self, run_row: dict):
        self.run_row = run_row

    def table(self, name):
        outer = self

        class _Q:
            def __init__(self):
                self._update = None

            def select(self, *_a, **_k):
                return self

            def eq(self, *_a, **_k):
                return self

            def maybe_single(self):
                return self

            def update(self, values):
                self._update = values
                return self

            def execute(self):
                if name == "runs":
                    if self._update is not None:
                        outer.run_row.update(self._update)
                        return _Resp(data=[dict(outer.run_row)])
                    return _Resp(data=dict(outer.run_row))
                if name == "threads":
                    return _Resp(data={"active_workflow_run_id": None})
                return _Resp(data=None)

        return _Q()


async def _write_system_row(pool, row: dict):
    """Write a carrier dict exactly as supabase would: an ABSENT ``org_id`` key is left to the
    trigger (which is the whole defect), a present one is bound."""
    cols = ["thread_id", "user_id", "role", "content", "tool_calls"]
    casts = ["::uuid", "::uuid", "", "", "::jsonb"]
    if "org_id" in row:
        cols.append("org_id")
        casts.append("::uuid")
    placeholders = ", ".join(f"${i + 1}{c}" for i, c in enumerate(casts))
    return await pool.fetchval(
        f"INSERT INTO public.messages ({', '.join(cols)}) VALUES ({placeholders}) RETURNING id",
        *[row[c] for c in cols],
    )


@pytest.mark.asyncio
async def test_pause_continue_pause_continue_consumes_the_SECOND_carrier(pg_pool, two_org_subject):
    s = two_org_subject
    assert s["org_a"] != s["org_b"], "the subject must be two-org or this proves nothing"
    uid, tid = str(s["uid"]), s["thread_id"]
    org_b = str(s["org_b"])

    # The run, stamped B at the send path (D-268-07), then paused.
    run_id = uuid4()
    await register_run_start(
        pool=pg_pool, redis=_Redis(), run_id=run_id, thread_id=tid, user_id=s["uid"],
        model="gpt-4o", provider="openai", spawned_by_worker="268-review-cr01", org_id=org_b,
    )
    assert await pg_pool.fetchval("SELECT org_id FROM public.runs WHERE run_id = $1", run_id) == s["org_b"]

    # Pause #1 — the SEND path's carrier, with the active org (correct before and after the fix).
    sb = _CapturingSupabase()
    await persist_cap_paused(
        redis=None, run_id=run_id, thread_id=str(tid), user_id=uid, supabase=sb,
        tool_calls_buffer={0: {"id": "call_1", "name": "execute_code", "arguments": "{}"}},
        continues_used=0, emit=AsyncMock(), org_id=org_b,
    )
    await _write_system_row(pg_pool, sb.rows[0])

    # ── the two Continue segments, driven through the REAL endpoint + producer ──
    consumed: list[list[str]] = []
    segment_user: list[dict] = []
    segment_msg_ids: list[UUID] = []
    carrier_ids: list[UUID] = []
    next_call = iter(["call_2", "call_3"])

    async def _segment(ctx, *, result_sink, **_kw):
        """One Continue segment: consume the dropped calls, answer, then hit the cap AGAIN."""
        consumed.append([c["tool_call_id"] for c in ctx.dropped_tool_calls])
        cu = ctx.current_user
        segment_user.append(dict(cu))
        # agent_loop.py's assistant-message stamp, verbatim: org_id=current_user.get("org_id")
        segment_msg_ids.append(await insert_assistant_message(
            pg_pool, thread_id=tid, user_id=s["uid"], content="segment answer",
            org_id=cu.get("org_id"),
        ))
        # agent_loop.py's re-pause stamp, verbatim: org_id=current_user.get("org_id")
        cap_sb = _CapturingSupabase()
        await persist_cap_paused(
            redis=None, run_id=ctx.run_id, thread_id=str(tid), user_id=cu["id"], supabase=cap_sb,
            tool_calls_buffer={0: {"id": next(next_call), "name": "execute_code", "arguments": "{}"}},
            continues_used=len(consumed), emit=AsyncMock(), org_id=cu.get("org_id"),
        )
        carrier_ids.append(await _write_system_row(pg_pool, cap_sb.rows[0]))
        result_sink["cap_disposition"] = "cap_paused"

    run_row = {
        "run_id": str(run_id), "status": "cap_paused", "thread_id": str(tid),
        "continues_used": 0, "org_id": org_b,
    }
    req_sb = _RequestSupabase(run_row)
    # get_current_user's real shape: NO org_id key (dependencies.py) — the defect's precondition.
    current_user = {"id": uid, "email": "two-org@test.local"}
    tasks: dict = {}
    redis = MagicMock()
    redis.zrange = AsyncMock(return_value=[])
    redis.expire = AsyncMock(return_value=True)

    async def _pool():
        return pg_pool

    user_settings = SimpleNamespace(llm_model="gpt-4o", active_provider="openai")
    with patch.object(threads_mod, "run_agent_loop", _segment), \
            patch.object(threads_mod, "get_pg_pool", _pool), \
            patch("app.dependencies.get_pg_pool", _pool), \
            patch.object(threads_mod, "load_user_settings", MagicMock(return_value=user_settings)), \
            patch.object(threads_mod, "finalize_run_terminal", AsyncMock()), \
            patch.object(threads_mod, "finalize_run", AsyncMock()), \
            patch.object(threads_mod, "_emit", AsyncMock()), \
            patch.object(threads_mod, "_emit_terminal", AsyncMock()), \
            patch.object(threads_mod, "RUN_TASKS", tasks), \
            patch("app.services.todos_service.reconcile_open_todos_on_run_end", AsyncMock()), \
            patch.object(rp, "_resolve_thread_scoping",
                         AsyncMock(return_value=rp.ThreadScoping(None, None, None, None, None))):
        for _ in range(2):
            resp = await continue_run(
                run_id=run_id, current_user=current_user, supabase=req_sb,
                service_supabase=MagicMock(), redis=redis,
            )
            assert resp["status"] == "ok", resp
            await tasks[run_id]

    # Continue #1 consumed pause #1's call; Continue #2 must consume pause #2's call — NOT call_1.
    assert consumed[0] == ["call_1"]
    assert consumed[1] == ["call_2"], (
        f"the second Continue re-drove {consumed[1]} — it read the FIRST pause's carrier because the "
        "second carrier landed outside the run's org"
    )

    # Every continuation-segment write carries the run's org (B), never the trigger's guess (A).
    for mid in segment_msg_ids + carrier_ids:
        got = await pg_pool.fetchval("SELECT org_id FROM public.messages WHERE id = $1", mid)
        assert got == s["org_b"], f"a continuation-segment row landed in {got}, expected the run's B"
    assert all(str(cu.get("org_id")) == org_b for cu in segment_user)

    # And the next Continue's lookup returns the LATEST carrier (C3), consistent with the run's org.
    latest = await load_cap_paused_tool_calls(pg_pool, tid, org_id=s["org_b"])
    assert [c["tool_call_id"] for c in latest] == ["call_3"]


def test_the_stub_writes_with_agent_loops_own_stamp_expressions():
    """Pin the stubbed loop to ``agent_loop.py``: its assistant-message and re-pause stamps read
    ``current_user.get("org_id")``. If a stamp ever reads something else, this test's stub no
    longer stands in for the code and must be revisited."""
    src = Path(inspect.getfile(persist_cap_paused)).read_text(encoding="utf-8")
    tree = ast.parse(src)
    stamps = [
        kw for node in ast.walk(tree) if isinstance(node, ast.Call)
        for kw in node.keywords if kw.arg == "org_id"
        and ast.unparse(kw.value) == "current_user.get('org_id')"
    ]
    assert len(stamps) >= 2, "agent_loop's org stamps no longer read current_user.get('org_id')"
