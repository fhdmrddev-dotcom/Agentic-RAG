"""Phase 306-05 (GUARD-01; D-18 / D-34; T-306-33) — MCP asks and runs in operator spend, live.

The REAL spend queries (``db/rates``) against the local Postgres, over rows written the way the app
writes them: a thread stamped ``origin_kind 'mcp'`` + the key at INSERT (as ``outside_ask.start_ask``
and ``unattended_launch``'s ``thread_origin`` do, migration 223), a ROOT ``runs`` row through the
app's one writer (``db.runs.insert_run``, which stamps ``expert_attributed``) and its finalized
tokens; the workflow run's thread also carries a ``workflow_runs`` row.

* ``get_spend_runs``: the ask reads ``source 'mcp'`` + the key's label + ``mcp_tool 'ask_agent'``;
  the workflow run reads ``'run_workflow'``; an in-app run on a plain thread stays
  ``("run", None, None, None)``.
* ``get_org_spend_summary``: input and output totals rise by EXACTLY the two runs' tokens (the
  ``members`` join still counts them: Pitfall 9), the root count by two, and "No Expert" by two.

Run with ``-rs``: a skip is NOT RUN, never a pass. Holds the local-DB lock.
⛔ No role-``anon`` statement (BUG-261031-01). Every row it writes is deleted in teardown.
"""
from __future__ import annotations

from uuid import UUID, uuid4

import pytest_asyncio

from app.db.rates import get_org_spend_summary, get_spend_runs
from app.db.runs import insert_run
from tests.integration._rls_harness import requires_pg
from tests.integration.phase304_fixtures import world  # noqa: F401 — a fixture

pytestmark = requires_pg

MODEL, PROVIDER = "gpt-306-05-spend", "openai"


@pytest_asyncio.fixture
async def spend(world):
    w = world
    made: dict[str, list] = {"threads": [], "runs": [], "wruns": []}
    try:
        yield w, made
    finally:
        for sql, ids in (
            ("DELETE FROM public.workflow_runs WHERE id = ANY($1::uuid[])", made["wruns"]),
            ("DELETE FROM public.runs WHERE run_id = ANY($1::uuid[])", made["runs"]),
            ("DELETE FROM public.threads WHERE id = ANY($1::uuid[])", made["threads"]),
        ):
            try:
                await w.pool.execute(sql, ids)
            except Exception:  # noqa: BLE001 — teardown is best-effort; the world cleanup follows
                pass


async def _thread(w, made, *, key_id: str | None, label: str | None) -> UUID:
    origin = ("mcp", label, UUID(key_id)) if key_id else (None, None, None)
    tid = await w.pool.fetchval(
        "INSERT INTO public.threads (user_id, org_id, title, origin_kind, origin_label, origin_ref)"
        " VALUES ($1, $2, '306-05 spend', $3, $4, $5) RETURNING id",
        UUID(w.u), UUID(w.x), *origin,
    )
    made["threads"].append(tid)
    return tid


async def _run(w, made, thread_id: UUID, tokens: tuple[int, int]) -> UUID:
    rid = uuid4()
    await insert_run(w.pool, run_id=rid, thread_id=thread_id, user_id=UUID(w.u), status="streaming",
                     model=MODEL, provider=PROVIDER, org_id=UUID(w.x), expert_id=None)
    made["runs"].append(rid)
    await w.pool.execute(
        "UPDATE public.runs SET status = 'completed', completed_at = now(), input_tokens = $2,"
        " output_tokens = $3 WHERE run_id = $1", rid, *tokens)
    return rid


def _none_runs(summary) -> int:
    line = next((x for x in summary.expert_breakdown if x.get("key") == "none" or x.get("line_key") == "none"), None)
    return int(line["run_count"]) if line else 0


async def test_mcp_asks_and_runs_land_in_spend_by_key_with_totals_intact(spend):
    w, made = spend
    org = UUID(w.x)
    await w.mint(label="306-05 spend laptop", tools=("ask_agent", "get_answer", "run_workflow"),
                 include_external=True)
    key_id = str(await w.pool.fetchval(
        "SELECT id FROM public.api_keys WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", UUID(w.u)))
    before = await get_org_spend_summary(w.pool, org)

    ask_thread = await _thread(w, made, key_id=key_id, label="306-05 spend laptop")
    ask = await _run(w, made, ask_thread, (1000, 200))
    run_thread = await _thread(w, made, key_id=key_id, label="306-05 spend laptop")
    wrun = await w.pool.fetchval(
        "INSERT INTO public.workflow_runs (thread_id, definition_id, org_id, user_id, status, origin_kind,"
        " origin_label, origin_ref) VALUES ($1, $2, $3, $4, 'completed', 'mcp', $5, $6) RETURNING id",
        run_thread, UUID(w.wf["pub_x"]), org, UUID(w.u), "306-05 spend laptop", UUID(key_id))
    made["wruns"].append(wrun)
    run = await _run(w, made, run_thread, (3000, 700))

    after = await get_org_spend_summary(w.pool, org)
    assert after.total_input_tokens - before.total_input_tokens == 1000 + 3000
    assert after.total_output_tokens - before.total_output_tokens == 200 + 700
    roots = lambda s: s.rated_runs_count + s.unrated_runs_count  # noqa: E731
    assert roots(after) - roots(before) == 2
    assert after.window_run_count - before.window_run_count == 2
    assert _none_runs(after) - _none_runs(before) == 2
    assert sum(line["run_count"] for line in after.expert_breakdown) == after.window_run_count

    plain_thread = await _thread(w, made, key_id=None, label=None)
    plain = await _run(w, made, plain_thread, (10, 1))

    items, _ = await get_spend_runs(w.pool, org, limit=200, time_range="today")
    by_id = {i["run_id"]: i for i in items}
    a, r, p = by_id[str(ask)], by_id[str(run)], by_id[str(plain)]
    assert (a["source"], a["api_key_id"], a["api_key_label"], a["mcp_tool"]) == (
        "mcp", key_id, "306-05 spend laptop", "ask_agent")
    assert (r["source"], r["api_key_id"], r["api_key_label"], r["mcp_tool"]) == (
        "mcp", key_id, "306-05 spend laptop", "run_workflow")
    assert (a["input_tokens"], a["output_tokens"], a["model"]) == (1000, 200, MODEL)  # the run's own values
    assert (r["input_tokens"], r["output_tokens"]) == (3000, 700)
    assert a["expert_attributed"] is True and a["expert_id"] is None
    assert (p["source"], p["api_key_id"], p["api_key_label"], p["mcp_tool"]) == ("run", None, None, None)
    assert p["input_tokens"] == 10
