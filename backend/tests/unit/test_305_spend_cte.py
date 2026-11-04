"""Phase 305-03 (GUARD-02; D-29 / D-30 / D-55; T-305-14 / T-305-30) — MCP usage in the ONE spend CTE.

MCP usage rows (``public.mcp_usage``) enter operator spend ONLY as a second leg of ``per_root``
(``db/rates._per_root_cte``): a UNION ALL leg in ``roots`` (source ``'mcp'``) and one in ``members``
joined on the usage row's own id. Every spend query inherits it, so totals, the daily chart, the
model breakdown, Spend by Expert and the ledger agree by construction — never a second dialect.

Mocked pools: these pin the SQL SHAPE and the Python mapping. The real-Postgres proof is
``tests/integration/test_305_spend_live.py``. The 268 invariants are re-asserted here because the
leg is exactly the kind of edit that could break them.
"""
from __future__ import annotations

from decimal import Decimal
from pathlib import Path
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.db.rates import get_org_spend_summary, get_spend_runs

_RATES_SRC = (Path(__file__).resolve().parents[2] / "app" / "db" / "rates.py").read_text(encoding="utf-8")


def _pool() -> AsyncMock:
    pool = AsyncMock()
    pool.fetchrow = AsyncMock()
    pool.fetch = AsyncMock()
    return pool


def _flat(sql: str) -> str:
    return " ".join(sql.split())


async def _summary_sqls() -> list[str]:
    pool = _pool()
    pool.fetchrow.side_effect = [
        {"total_spend_usd": Decimal("0"), "rated_runs_count": 0, "unrated_runs_count": 0,
         "unmeasured_runs_count": 0, "total_input_tokens": 0, "total_output_tokens": 0,
         "unpriced_subagents": 0},
        {"incomplete_count": 0},
        {"window_total_usd": Decimal("0"), "window_run_count": 0},
    ]
    pool.fetch.side_effect = [[], [], []]
    await get_org_spend_summary(pool, uuid4())
    sqls = [c.args[0] for c in pool.fetchrow.call_args_list] + [c.args[0] for c in pool.fetch.call_args_list]
    return [s for s in sqls if "per_root AS (" in s]


async def _ledger_sqls() -> tuple[str, str]:
    pool = _pool()
    pool.fetchrow.return_value = {"total": 0}
    pool.fetch.return_value = []
    await get_spend_runs(pool, uuid4(), time_range="7d")
    return pool.fetchrow.call_args.args[0], pool.fetch.call_args.args[0]


async def test_every_spend_query_carries_the_mcp_usage_legs():
    sqls = await _summary_sqls() + list(await _ledger_sqls())
    assert len(sqls) == 7
    for sql in sqls:
        flat = _flat(sql)
        assert flat.count("FROM public.mcp_usage") >= 2, "a roots leg AND a members leg"
        assert "'run'::text AS source" in flat
        # 306-05 (D-34): the runs arm's ``NULL::uuid AS api_key_id`` literal is RETIRED on purpose;
        # the key now comes from the thread's mcp origin (test_306_spend_by_key pins the new text).
        # ``source`` stays 'run' and a plain run row still reads ("run", None, None, None) below.
        assert "t.origin_ref AS api_key_id" in flat and "NULL::uuid AS api_key_id" not in flat
        assert "'mcp'::text AS source" in flat
        assert "WHERE ro.source = 'run'" in flat
        assert "FROM public.mcp_usage u JOIN roots ro ON ro.run_id = u.id WHERE ro.source = 'mcp'" in flat
        # the 268 invariants, unchanged
        assert "m.run_id = ro.run_id OR m.parent_run_id = ro.run_id" in flat
        assert "m.org_id" not in flat


async def test_the_mcp_roots_leg_is_org_filtered_with_the_same_window_and_expert_text():
    (summary, *_rest) = await _summary_sqls()
    flat = _flat(summary)
    leg = flat.split("'mcp'::text AS source", 1)[1].split("members AS (", 1)[0]
    assert "WHERE r.org_id = $1" in leg
    assert "($3::timestamptz IS NULL OR r.started_at >= $3)" in leg
    assert "r.expert_id::text = $2::text" in leg
    assert "parent_run_id" not in leg, "the root predicate lives on ONE line (test_268)"


async def test_the_ledger_carries_source_key_and_tool_with_an_org_constrained_key_join():
    count_sql, rows_sql = await _ledger_sqls()
    join = "LEFT JOIN public.api_keys k ON k.id = ro.api_key_id AND k.org_id = ro.org_id"
    assert join in _flat(count_sql), "the COUNT carries the same joins as the rows (257)"
    assert join in _flat(rows_sql)
    for column in ("ro.source", "ro.api_key_id", "k.label AS api_key_label", "ro.tool AS mcp_tool"):
        assert column in _flat(rows_sql), column


def test_the_268_pins_still_hold_in_source():
    assert len([ln for ln in _RATES_SRC.splitlines() if "parent_run_id IS NULL" in ln]) == 1
    assert "m.org_id" not in _RATES_SRC
    assert "(r.model = 'unknown' AND r.provider = 'unknown') AS is_box_shell" in _RATES_SRC


def _ledger_row(**over):
    row = {
        "run_id": uuid4(), "thread_id": None, "user_id": uuid4(), "status": "completed",
        "model": "text-embedding-3-small", "provider": "openai", "started_at": None,
        "completed_at": None, "input_tokens": None, "output_tokens": 0,
        "input_cost_per_million": None, "output_cost_per_million": None, "token_coverage": None,
        "cost_usd": None, "subagent_count": 0, "expert_id": None, "expert_attributed": True,
        "expert_name": None, "expert_found": False,
    }
    row.update(over)
    return row


async def test_an_mcp_ledger_row_maps_source_key_and_tool_and_is_never_complete():
    key = uuid4()
    pool = _pool()
    pool.fetchrow.return_value = {"total": 2}
    pool.fetch.return_value = [
        _ledger_row(source="mcp", api_key_id=key, api_key_label="Laptop", mcp_tool="search_knowledge_base"),
        _ledger_row(source="run", api_key_id=None, api_key_label=None, mcp_tool=None,
                    thread_id=uuid4(), token_coverage=["agent", "single", "batch", "emit"]),
    ]
    items, total = await get_spend_runs(pool, uuid4())
    mcp, run = items
    assert total == 2
    assert (mcp["source"], mcp["api_key_id"], mcp["api_key_label"], mcp["mcp_tool"]) == (
        "mcp", str(key), "Laptop", "search_knowledge_base")
    assert mcp["is_rated"] is False and mcp["cost_usd"] is None   # Unrated, never $0.00 (D-30)
    assert mcp["is_coverage_complete"] is False
    assert mcp["input_tokens"] is None                            # unmeasured, never 0
    assert (run["source"], run["api_key_id"], run["api_key_label"], run["mcp_tool"]) == ("run", None, None, None)


async def test_a_row_without_the_new_columns_reads_as_a_run():
    pool = _pool()
    pool.fetchrow.return_value = {"total": 1}
    pool.fetch.return_value = [_ledger_row()]
    (item,), _ = await get_spend_runs(pool, uuid4())
    assert (item["source"], item["api_key_id"], item["api_key_label"], item["mcp_tool"]) == ("run", None, None, None)


@pytest.mark.parametrize("bad", ["m.org_id"])
def test_no_spend_sql_names_a_member_org(bad):
    assert bad not in _RATES_SRC
